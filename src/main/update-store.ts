/**
 * The two files the updater keeps in the user-data folder. No Electron imports, so it runs under
 * vitest.
 *
 *   <dir>/updates.json   what this computer knows about updates (see StoredUpdates)
 *   <dir>/updates.log    the updater's own log lines, newest last, capped in size
 *
 * Neither is part of the save: both describe this computer, not the collection.
 */

import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { atomicWrite, isMissing, readIfExists } from './fs-util'
import { defaultStoredUpdates, MAX_UPDATES_BYTES, parseStoredUpdates, rescueStoredUpdates, RESCUE_SCAN_LENGTH, serializeStoredUpdates, type StoredUpdates } from './update-model'

export const UPDATES_FILE = 'updates.json'
export const UPDATES_LOG_FILE = 'updates.log'
export const MAX_LOG_BYTES = 256 * 1024
/** One entry is one line; a stack trace or a dump of response headers is cut here. */
const MAX_LOG_LINE = 2000
/** Only this much of a message is looked at: an error can quote a megabyte of release feed. */
const MAX_LOG_SCAN = MAX_LOG_LINE * 4

const STALE_TMP_NAME = /^updates\.(?:json|log)\.\d+\.\d+\.\d+\.tmp$/

export interface UpdateLog {
  info(message: unknown): void
  warn(message: unknown): void
  error(message: unknown): void
  /** True while lines are still on their way to the disk. */
  readonly busy: boolean
  /** Resolves once every line so far is on disk. */
  idle(): Promise<void>
}

export interface UpdateLogOptions {
  /** Clock override for tests. */
  now?: () => Date
  maxBytes?: number
}

function oneLine(message: unknown): string {
  const text = message instanceof Error ? (message.stack ?? message.message) : String(message)
  // Cut before anything else is done with it, and split and trim rather than match "blanks around
  // a line break" with one pattern: on a long run of blanks that pattern starts over at each of them.
  const head = text.length > MAX_LOG_SCAN ? text.slice(0, MAX_LOG_SCAN) : text
  const flat = head
    .split(/[\r\n]+/)
    .map((part) => part.trim())
    .join(' | ')
  return flat.length > MAX_LOG_LINE || head.length < text.length ? `${flat.slice(0, MAX_LOG_LINE)}…` : flat
}

/**
 * A packaged app has no console, so the updater writes here instead. Nothing is created until
 * the first line, and a log that cannot be written is dropped without a sound: it must never be
 * the reason an update fails.
 */
export function createUpdateLog(file: string, options: UpdateLogOptions = {}): UpdateLog {
  const now = options.now ?? (() => new Date())
  const maxBytes = options.maxBytes ?? MAX_LOG_BYTES
  let tail: Promise<void> = Promise.resolve()
  /** Lines handed in that have not been written, or given up on, yet. */
  let waiting = 0
  /** Bytes in the file; unknown until the first write looks. */
  let size: number | null = null

  /** Keeps the newest half, cut at the start of a line. */
  async function trim(): Promise<void> {
    const bytes = await readIfExists(file)
    if (bytes === null) {
      size = 0
      return
    }
    const cut = bytes.indexOf(0x0a, Math.max(0, bytes.length - Math.floor(maxBytes / 2))) + 1
    const kept = cut > 0 ? bytes.subarray(cut) : Buffer.alloc(0)
    await atomicWrite(file, kept, { fsync: false })
    size = kept.length
  }

  async function append(line: string): Promise<void> {
    if (size === null) {
      await fs.mkdir(dirname(file), { recursive: true })
      size = await fs.stat(file).then(
        (stat) => stat.size,
        () => 0
      )
    }
    const bytes = Buffer.byteLength(line, 'utf8')
    if (size + bytes > maxBytes) await trim()
    await fs.appendFile(file, line, 'utf8')
    size = (size ?? 0) + bytes
  }

  function write(level: string, message: unknown): void {
    const line = `${now().toISOString()} ${level} ${oneLine(message)}\n`
    waiting++
    tail = tail
      .then(() => append(line))
      .catch(() => {})
      .then(() => {
        waiting--
      })
  }

  return {
    info: (message) => write('info', message),
    warn: (message) => write('warn', message),
    error: (message) => write('error', message),
    get busy() {
      return waiting > 0
    },
    idle: () => tail
  }
}

/**
 * Where the result of a read comes from.
 * - `file`: updates.json, read and understood.
 * - `none`: there is no updates.json. The defaults.
 * - `damaged`: the file is there but is not something this app wrote (cut short, not JSON, far too
 *   large). The defaults, except that a switched-off automatic check is rescued from what is
 *   left of it. The next write replaces the file.
 * - `unreadable`: the file is there and could not be opened (another program holds it, the disk
 *   failed, a folder sits in its place). The defaults, but the file may be perfectly good: the
 *   caller must not take them for what the user chose, nor write them over it.
 */
export type StoredSource = 'file' | 'none' | 'damaged' | 'unreadable'

export interface StoredRead {
  data: StoredUpdates
  source: StoredSource
}

export interface UpdateStore {
  readonly file: string
  /** What the file holds, and how far that can be trusted. Never rejects. */
  read(): Promise<StoredRead>
  /** Replaces the file. Writes are applied in the order they were asked for. */
  write(data: StoredUpdates): Promise<void>
}

export interface UpdateStoreOptions {
  log?: (message: string, err?: unknown) => void
}

export function createUpdateStore(dir: string, options: UpdateStoreOptions = {}): UpdateStore {
  const log = options.log ?? ((message, err) => console.warn(`[updates] ${message}`, err ?? ''))
  const file = join(dir, UPDATES_FILE)
  let tail: Promise<unknown> = Promise.resolve()

  /** Removes temp files a crashed write left behind. */
  async function sweepTemps(): Promise<void> {
    try {
      for (const name of await fs.readdir(dir)) {
        if (STALE_TMP_NAME.test(name)) await fs.rm(join(dir, name), { force: true })
      }
    } catch (err) {
      if (!isMissing(err)) log('could not clean up temp files', err)
    }
  }

  /** The start of the file as text, for a file too large to be read whole. */
  async function readHead(): Promise<string> {
    const handle = await fs.open(file, 'r')
    try {
      const buffer = Buffer.alloc(RESCUE_SCAN_LENGTH)
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
      return buffer.toString('utf8', 0, bytesRead)
    } finally {
      await handle.close()
    }
  }

  async function read(): Promise<StoredRead> {
    await sweepTemps()
    try {
      const stat = await fs.stat(file)
      if (!stat.isFile()) {
        log('updates.json is not a file, so it is neither read nor replaced')
        return { data: defaultStoredUpdates(), source: 'unreadable' }
      }
      // Checked before reading: nothing this app writes is ever that large.
      if (stat.size > MAX_UPDATES_BYTES) {
        log('updates.json is not a file of a sensible size, starting over')
        return { data: rescueStoredUpdates(await readHead()), source: 'damaged' }
      }
      const bytes = await readIfExists(file)
      if (bytes === null) return { data: defaultStoredUpdates(), source: 'none' }
      // A UTF-8 BOM is legal in a hand-edited file but not in JSON.
      const text = bytes.toString('utf8').replace(/^\uFEFF/, '')
      let raw: unknown
      try {
        raw = JSON.parse(text)
      } catch (err) {
        log('updates.json is damaged, starting over', err)
        return { data: rescueStoredUpdates(text), source: 'damaged' }
      }
      return { data: parseStoredUpdates(raw), source: 'file' }
    } catch (err) {
      if (isMissing(err)) return { data: defaultStoredUpdates(), source: 'none' }
      log('updates.json could not be read', err)
      return { data: defaultStoredUpdates(), source: 'unreadable' }
    }
  }

  function write(data: StoredUpdates): Promise<void> {
    // Serialised now, so a later change to the object cannot leak into this write.
    const json = serializeStoredUpdates(data)
    const run = tail.then(() => atomicWrite(file, json))
    tail = run.catch(() => {})
    return run
  }

  return { file, read, write }
}
