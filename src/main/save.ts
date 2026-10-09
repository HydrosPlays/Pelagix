/**
 * The save file on disk: atomic writes through a queue, daily rolling backups, and recovery from
 * a corrupt file. No Electron imports, so it runs under vitest.
 *
 *   <dir>/save.json
 *   <dir>/save.corrupt-<yyyymmdd-hhmmss>.json    unreadable saves, moved aside on load
 *   <dir>/backups/save-<yyyymmdd>.json           the save as it was before that day's first write
 */

import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { atomicWrite, isMissing, readIfExists, retryTransient } from './fs-util'

export const BACKUPS_TO_KEEP = 14
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024

const BACKUP_NAME = /^save-\d{8}\.json$/
const STALE_TMP_NAME = /^save\.json\.\d+\.\d+\.\d+\.tmp$/

const pad = (n: number, width = 2): string => String(n).padStart(width, '0')

/** Local calendar day, yyyymmdd. */
export const dayStamp = (d: Date): string => `${pad(d.getFullYear(), 4)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`

const timeStamp = (d: Date): string => `${dayStamp(d)}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`

/** Default file name offered by the export dialog: pelagix-save-YYYY-MM-DD.json. */
export function exportFileName(d: Date): string {
  return `pelagix-save-${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseJson(bytes: Buffer): { ok: true; value: unknown } | { ok: false } {
  try {
    // A UTF-8 BOM is legal in a hand-edited file but not in JSON.
    return { ok: true, value: JSON.parse(bytes.toString('utf8').replace(/^﻿/, '')) }
  } catch {
    return { ok: false }
  }
}

type ReadResult = { state: 'ok'; value: Record<string, unknown>; bytes: Buffer } | { state: 'missing' } | { state: 'corrupt' }

/** A save is usable when it parses to a JSON object; anything deeper is the renderer's call. */
async function readSaveObject(file: string): Promise<ReadResult> {
  const bytes = await readIfExists(file)
  if (bytes === null) return { state: 'missing' }
  const parsed = parseJson(bytes)
  if (!parsed.ok || !isPlainObject(parsed.value)) return { state: 'corrupt' }
  return { state: 'ok', value: parsed.value, bytes }
}

export interface SaveStore {
  readonly file: string
  readonly backupsDir: string
  /** Parsed save, or null when there is none. Recovers from a corrupt file via the backups. */
  load(): Promise<unknown | null>
  write(save: unknown): Promise<void>
  /** True while a load or write is queued or running. */
  readonly busy: boolean
  /** Resolves once the queue is empty. */
  idle(): Promise<void>
}

export interface SaveStoreOptions {
  /** Clock override for tests. */
  now?: () => Date
  log?: (message: string, err?: unknown) => void
}

export function createSaveStore(dir: string, options: SaveStoreOptions = {}): SaveStore {
  const now = options.now ?? (() => new Date())
  const log = options.log ?? ((message, err) => console.warn(`[save] ${message}`, err ?? ''))
  const file = join(dir, 'save.json')
  const backupsDir = join(dir, 'backups')

  let tail: Promise<unknown> = Promise.resolve()
  let pending = 0
  /** Day whose backup is known to be taken care of. */
  let backedUpDay: string | null = null
  let sweptTemps = false

  // Loads and writes share one queue so a load never observes a half-finished recovery or write.
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    pending++
    const run = tail.then(task).finally(() => {
      pending--
    })
    tail = run.catch(() => {})
    return run
  }

  async function listBackups(): Promise<string[]> {
    try {
      const names = await fs.readdir(backupsDir)
      return names.filter((name) => BACKUP_NAME.test(name)).sort().reverse() // newest first
    } catch (err) {
      if (isMissing(err)) return []
      throw err
    }
  }

  /** Removes temp files a crashed write left behind. */
  async function sweepTemps(): Promise<void> {
    if (sweptTemps) return
    sweptTemps = true
    try {
      for (const name of await fs.readdir(dir)) {
        if (STALE_TMP_NAME.test(name)) await fs.rm(join(dir, name), { force: true })
      }
    } catch (err) {
      if (!isMissing(err)) log('could not clean up temp files', err)
    }
  }

  async function moveAside(): Promise<void> {
    const aside = join(dir, `save.corrupt-${timeStamp(now())}.json`)
    try {
      await retryTransient(() => fs.rename(file, aside))
      return
    } catch (err) {
      log('could not rename the corrupt save, copying it instead', err)
    }
    try {
      await fs.copyFile(file, aside)
      await fs.rm(file, { force: true })
    } catch (err) {
      // Left in place: it is only replaced once the user saves again.
      log('could not preserve the corrupt save', err)
    }
  }

  async function load(): Promise<unknown | null> {
    await sweepTemps()
    const current = await readSaveObject(file)
    if (current.state === 'ok') return current.value
    if (current.state === 'missing') return null

    log('save.json is not a valid save, moving it aside and restoring the newest backup')
    await moveAside()
    for (const name of await listBackups()) {
      const backup = await readSaveObject(join(backupsDir, name)).catch((): ReadResult => ({ state: 'corrupt' }))
      if (backup.state !== 'ok') continue
      // Put it back as save.json so the recovery survives a restart with no further writes.
      await atomicWrite(file, backup.bytes)
      log(`restored ${name}`)
      return backup.value
    }
    return null
  }

  /** Copies the save about to be replaced to backups/save-<day>.json unless that day has one. */
  async function backupPrevious(day: string): Promise<void> {
    const target = join(backupsDir, `save-${day}.json`)
    if ((await readIfExists(target)) !== null) return
    const previous = await readSaveObject(file)
    // Nothing to keep on the very first write; never rotate a good backup out for garbage.
    if (previous.state !== 'ok') return
    await atomicWrite(target, previous.bytes)
    for (const stale of (await listBackups()).slice(BACKUPS_TO_KEEP)) {
      await fs.rm(join(backupsDir, stale), { force: true })
    }
  }

  async function write(save: unknown): Promise<void> {
    const json = JSON.stringify(save)
    if (typeof json !== 'string') throw new TypeError('save is not serialisable')
    const day = dayStamp(now())
    if (backedUpDay !== day) {
      // A failed backup must not cost the user the write itself.
      await backupPrevious(day).catch((err) => log('backup failed', err))
    }
    await atomicWrite(file, json)
    backedUpDay = day
  }

  return {
    file,
    backupsDir,
    load: () => enqueue(load),
    write: (save) => enqueue(() => write(save)),
    get busy() {
      return pending > 0
    },
    async idle() {
      let seen: Promise<unknown>
      do {
        seen = tail
        await seen
      } while (seen !== tail)
    }
  }
}

/** Reads a file the user picked for import. Throws an Error with a user-presentable message. */
export async function readImportFile(path: string): Promise<unknown> {
  const stat = await fs.stat(path)
  if (!stat.isFile()) throw new Error('The selected item is not a file.')
  if (stat.size > MAX_IMPORT_BYTES) throw new Error('The selected file is larger than 50 MB and cannot be a Pelagix save.')
  const parsed = parseJson(await fs.readFile(path))
  if (!parsed.ok) throw new Error('The selected file is not valid JSON.')
  return parsed.value
}

/** Writes a human-readable copy of the save to a path the user picked. */
export async function writeExportFile(path: string, save: unknown): Promise<void> {
  await fs.writeFile(path, `${JSON.stringify(save, null, 2)}\n`, 'utf8')
}
