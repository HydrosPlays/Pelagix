import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultStoredUpdates, MAX_UPDATES_BYTES, type StoredUpdates } from './update-model'
import { createUpdateLog, createUpdateStore, MAX_LOG_BYTES, UPDATES_FILE, UPDATES_LOG_FILE } from './update-store'

let dir: string
let warnings: string[]
const quiet = { log: (message: string) => void warnings.push(message) }

const sample: StoredUpdates = {
  autoCheck: false,
  lastCheckedAt: 1_800_000_000_000,
  offeredVersion: '0.3.0',
  lastRunVersion: '0.2.0',
  announcedVersion: '0.3.0',
  rateLimitedUntil: null,
  whatsNew: { version: '0.2.0', from: '0.1.0', notes: [{ tag: 'v0.2.0', version: '0.2.0', name: 'Pelagix 0.2.0', publishedAt: '2026-11-01T10:00:00Z', body: 'In-app **updates**.\r\n', prerelease: false }] },
  pendingNotes: null,
  cache: null
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pelagix-updates-'))
  warnings = []
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('updates.json store', () => {
  it('does not touch the disk until it is used', async () => {
    const store = createUpdateStore(join(dir, 'not-yet'), quiet)
    expect(store.file).toBe(join(dir, 'not-yet', UPDATES_FILE))
    expect(await readdir(dir)).toEqual([])
  })

  it('returns the defaults when there is no file, without creating one or complaining', async () => {
    expect(await createUpdateStore(dir, quiet).read()).toEqual({ data: defaultStoredUpdates(), source: 'none' })
    expect(await createUpdateStore(join(dir, 'missing-folder'), quiet).read()).toEqual({ data: defaultStoredUpdates(), source: 'none' })
    expect(await readdir(dir)).toEqual([])
    expect(warnings).toEqual([])
  })

  it('round-trips what it is given and leaves no temp files behind', async () => {
    const store = createUpdateStore(dir, quiet)
    await store.write(sample)
    expect(await store.read()).toEqual({ data: sample, source: 'file' })
    expect(await createUpdateStore(dir, quiet).read()).toEqual({ data: sample, source: 'file' })
    expect(await readdir(dir)).toEqual([UPDATES_FILE])
    expect(JSON.parse(await readFile(store.file, 'utf8'))).toMatchObject({ v: 1, autoCheck: false, lastRunVersion: '0.2.0' })
  })

  it('creates the folder on the first write', async () => {
    const store = createUpdateStore(join(dir, 'a', 'b'), quiet)
    await store.write(sample)
    expect((await store.read()).data).toEqual(sample)
  })

  it('applies writes in the order they were asked for', async () => {
    const store = createUpdateStore(dir, quiet)
    const writes = Array.from({ length: 25 }, (_, i) => store.write({ ...sample, lastCheckedAt: i }))
    await Promise.all(writes)
    expect((await store.read()).data.lastCheckedAt).toBe(24)
    expect((await readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual([])
  })

  it('writes what the object held when write was called, not what it holds later', async () => {
    const store = createUpdateStore(dir, quiet)
    const changing = { ...sample }
    const written = store.write(changing)
    changing.autoCheck = true
    changing.lastRunVersion = '9.9.9'
    await written
    expect((await store.read()).data).toEqual(sample)
  })

  it('keeps working after a write that failed', async () => {
    const store = createUpdateStore(dir, quiet)
    await store.write(sample)
    // A folder where the file should be makes the rename fail.
    await rm(store.file)
    await mkdir(store.file)
    await expect(store.write({ ...sample, autoCheck: true })).rejects.toThrow()
    await rm(store.file, { recursive: true })
    await store.write({ ...sample, lastRunVersion: '0.4.0' })
    expect((await store.read()).data.lastRunVersion).toBe('0.4.0')
    expect((await readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual([])
  })

  it('starts from the defaults when the file is not JSON, and says so once', async () => {
    const store = createUpdateStore(dir, quiet)
    for (const text of ['', 'not json', '{"autoCheck": fal', '\u0000\u0000\u0000', '{"a":1}{"b":2}']) {
      await writeFile(store.file, text)
      warnings = []
      expect(await store.read()).toEqual({ data: defaultStoredUpdates(), source: 'damaged' })
      expect(warnings).toHaveLength(1)
    }
  })

  it('keeps a switched-off automatic check when the rest of the file is lost', async () => {
    const store = createUpdateStore(dir, quiet)
    const written = JSON.stringify({ v: 1, ...sample, cache: { fetchedAt: 1, releases: sample.whatsNew?.notes } })
    const off = { data: { ...defaultStoredUpdates(), autoCheck: false }, source: 'damaged' }
    // Cut short by a write that never finished, and one stray byte in the middle of an intact file.
    for (const text of [written.slice(0, -3), written.slice(0, 30), written.replace('"cache":', '"cache":\u0000')]) {
      await writeFile(store.file, text)
      expect(await store.read()).toEqual(off)
    }
    // The file is replaced by the next write, and the choice is in it.
    await store.write((await store.read()).data)
    expect(await store.read()).toEqual({ data: { ...defaultStoredUpdates(), autoCheck: false }, source: 'file' })
  })

  it('starts from the defaults when the JSON is not an object', async () => {
    const store = createUpdateStore(dir, quiet)
    for (const text of ['null', '[1,2,3]', '"text"', '42', 'true']) {
      await writeFile(store.file, text)
      expect((await store.read()).data).toEqual(defaultStoredUpdates())
    }
  })

  it('keeps the good fields of a damaged file', async () => {
    const store = createUpdateStore(dir, quiet)
    await writeFile(store.file, JSON.stringify({ v: 1, autoCheck: false, lastRunVersion: 'v0.2.0', lastCheckedAt: 'x', cache: 'gone', whatsNew: { version: 7 } }))
    expect(await store.read()).toEqual({ data: { ...defaultStoredUpdates(), autoCheck: false, lastRunVersion: '0.2.0' }, source: 'file' })
  })

  it('accepts a file with a UTF-8 byte order mark', async () => {
    const store = createUpdateStore(dir, quiet)
    await writeFile(store.file, `﻿${JSON.stringify({ autoCheck: false })}`)
    expect((await store.read()).data.autoCheck).toBe(false)
  })

  it('refuses an oversized file, even one that is valid JSON, but still honours its switch', async () => {
    const store = createUpdateStore(dir, quiet)
    await writeFile(store.file, JSON.stringify({ autoCheck: false, lastRunVersion: '0.2.0', padding: 'x'.repeat(MAX_UPDATES_BYTES) }))
    expect(await store.read()).toEqual({ data: { ...defaultStoredUpdates(), autoCheck: false }, source: 'damaged' })
    expect(warnings).toEqual(['updates.json is not a file of a sensible size, starting over'])
    await writeFile(store.file, JSON.stringify({ autoCheck: true, padding: 'x'.repeat(MAX_UPDATES_BYTES) }))
    expect(await store.read()).toEqual({ data: defaultStoredUpdates(), source: 'damaged' })
    // It is replaced by the next write like any other content.
    await store.write(sample)
    expect((await store.read()).data).toEqual(sample)
  })

  it('reads a file exactly at the size limit', async () => {
    const store = createUpdateStore(dir, quiet)
    const json = JSON.stringify({ autoCheck: false })
    await writeFile(store.file, json + ' '.repeat(MAX_UPDATES_BYTES - json.length))
    expect((await stat(store.file)).size).toBe(MAX_UPDATES_BYTES)
    expect((await store.read()).data.autoCheck).toBe(false)
  })

  it('says so when the file is there but cannot be read, instead of passing the defaults off as its content', async () => {
    const store = createUpdateStore(dir, quiet)
    // A folder where the file should be: as close to "cannot be opened" as a test gets on every system.
    await mkdir(store.file)
    expect(await store.read()).toEqual({ data: defaultStoredUpdates(), source: 'unreadable' })
    expect(warnings).toEqual(['updates.json is not a file, so it is neither read nor replaced'])
  })

  it('removes temp files left by a crashed write, and nothing else', async () => {
    await writeFile(join(dir, 'updates.json.4242.1700000000000.0.tmp'), '{"half":')
    await writeFile(join(dir, 'updates.log.4242.1700000000000.3.tmp'), 'half a log')
    await writeFile(join(dir, 'save.json.4242.1700000000000.0.tmp'), 'not ours')
    await writeFile(join(dir, 'save.json'), '{}')
    await writeFile(join(dir, UPDATES_FILE), JSON.stringify({ autoCheck: false }))
    expect((await createUpdateStore(dir, quiet).read()).data.autoCheck).toBe(false)
    expect((await readdir(dir)).sort()).toEqual(['save.json', 'save.json.4242.1700000000000.0.tmp', UPDATES_FILE])
  })

  it('never writes a file larger than the cap', async () => {
    const store = createUpdateStore(dir, quiet)
    const huge = Array.from({ length: 30 }, (_, i) => ({ tag: `v1.${i}.0`, version: `1.${i}.0`, name: '', publishedAt: null, body: 'x'.repeat(125_000), prerelease: false }))
    await store.write({ ...sample, cache: { fetchedAt: 1, releases: huge } })
    expect((await stat(store.file)).size).toBeLessThanOrEqual(MAX_UPDATES_BYTES)
    expect((await store.read()).data).toEqual(sample)
  })
})

describe('updates.log', () => {
  let clock: Date
  const at = { now: () => clock }
  const file = (): string => join(dir, UPDATES_LOG_FILE)

  beforeEach(() => {
    clock = new Date('2026-10-09T12:00:00.000Z')
  })

  it('creates nothing until the first line', async () => {
    const log = createUpdateLog(join(dir, 'later', UPDATES_LOG_FILE), at)
    await log.idle()
    expect(await readdir(dir)).toEqual([])
  })

  it('writes one timestamped line per entry, in order', async () => {
    const log = createUpdateLog(file(), at)
    log.info('Checking for update')
    clock = new Date('2026-10-09T12:00:01.500Z')
    log.warn('slow')
    log.error('failed')
    await log.idle()
    expect(await readFile(file(), 'utf8')).toBe('2026-10-09T12:00:00.000Z info Checking for update\n2026-10-09T12:00:01.500Z warn slow\n2026-10-09T12:00:01.500Z error failed\n')
  })

  it('creates the folder it needs and appends to a log from an earlier run', async () => {
    const nested = join(dir, 'user-data', UPDATES_LOG_FILE)
    const first = createUpdateLog(nested, at)
    first.info('one')
    await first.idle()
    const second = createUpdateLog(nested, at)
    second.info('two')
    await second.idle()
    expect((await readFile(nested, 'utf8')).split('\n')).toEqual(['2026-10-09T12:00:00.000Z info one', '2026-10-09T12:00:00.000Z info two', ''])
  })

  it('keeps a stack trace or a header dump on one line, and cuts it', async () => {
    const log = createUpdateLog(file(), at)
    log.error('HttpError: 404\r\n"method: GET url: https://github.com/x"\n\n   Headers: {\n  "server": "GitHub.com"\n}')
    log.error(`first\n${'x'.repeat(10_000)}`)
    await log.idle()
    const lines = (await readFile(file(), 'utf8')).split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('2026-10-09T12:00:00.000Z error HttpError: 404 | "method: GET url: https://github.com/x" | Headers: { | "server": "GitHub.com" | }')
    expect(lines[1]?.length).toBeLessThan(2100)
    expect(lines[1]?.endsWith('…')).toBe(true)
  })

  it('is not slowed down by a message that is one long run of blanks', async () => {
    // What a failed check can quote: a megabyte of release feed with a line of blanks in it.
    // Flattening that used to take seconds per line, on the thread the window lives on.
    const log = createUpdateLog(file(), at)
    const started = performance.now()
    for (const blank of [' ', '\t', ' ']) log.error(`Cannot parse releases feed: Error, XML: <feed>${blank.repeat(400_000)}</feed>\nat parse`)
    const took = performance.now() - started
    await log.idle()
    expect(took).toBeLessThan(500)
    const lines = (await readFile(file(), 'utf8')).split('\n')
    expect(lines).toHaveLength(4)
    for (const line of lines.slice(0, 3)) {
      expect(line.startsWith('2026-10-09T12:00:00.000Z error Cannot parse releases feed: Error, XML: <feed>')).toBe(true)
      expect(line.length).toBeLessThan(2100)
      expect(line.endsWith('…')).toBe(true)
    }
  })

  it('marks a message as cut even when what is left of it is short', async () => {
    const log = createUpdateLog(file(), at)
    log.error(`first\n${' '.repeat(50_000)}\nlast`)
    await log.idle()
    expect(await readFile(file(), 'utf8')).toBe('2026-10-09T12:00:00.000Z error first | …\n')
  })

  it('says whether lines are still on their way to the disk', async () => {
    const log = createUpdateLog(file(), at)
    expect(log.busy).toBe(false)
    log.info('one')
    log.info('two')
    expect(log.busy).toBe(true)
    await log.idle()
    expect(log.busy).toBe(false)
    expect((await readFile(file(), 'utf8')).split('\n')).toHaveLength(3)
  })

  it('logs errors with their stack and anything else as text', async () => {
    const log = createUpdateLog(file(), at)
    log.error(new Error('boom'))
    log.info(42)
    log.info(null)
    log.info(undefined)
    log.info({ toString: () => 'custom' })
    await log.idle()
    const lines = (await readFile(file(), 'utf8')).split('\n')
    expect(lines[0]).toMatch(/^2026-10-09T12:00:00\.000Z error Error: boom \| at /)
    expect(lines.slice(1, 5).map((line) => line.split(' info ')[1])).toEqual(['42', 'null', 'undefined', 'custom'])
  })

  it('stays under its size cap by dropping the oldest lines', async () => {
    const log = createUpdateLog(file(), { ...at, maxBytes: 2000 })
    for (let i = 0; i < 200; i++) log.info(`line ${String(i).padStart(3, '0')} ${'.'.repeat(40)}`)
    await log.idle()
    const text = await readFile(file(), 'utf8')
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(2000)
    const lines = text.split('\n').filter((line) => line !== '')
    expect(lines.at(-1)).toContain('line 199')
    expect(lines.length).toBeGreaterThan(5)
    // Whole lines only, and still in order.
    for (const line of lines) expect(line).toMatch(/^2026-10-09T12:00:00\.000Z info line \d{3} \.{40}$/)
    const numbers = lines.map((line) => Number(/line (\d{3})/.exec(line)?.[1]))
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
    expect((await readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual([])
  })

  it('trims an oversized log left by an earlier run', async () => {
    await writeFile(file(), `${'old line\n'.repeat(1000)}`)
    const log = createUpdateLog(file(), { ...at, maxBytes: 1000 })
    log.info('new')
    await log.idle()
    const text = await readFile(file(), 'utf8')
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(1000)
    expect(text.endsWith('info new\n')).toBe(true)
    expect(text.startsWith('old line\n')).toBe(true)
  })

  it('has a default cap that holds a few thousand lines', () => {
    expect(MAX_LOG_BYTES).toBe(256 * 1024)
  })

  it('never throws or rejects when the log cannot be written, and recovers when it can', async () => {
    await mkdir(file()) // a folder where the file should be
    const log = createUpdateLog(file(), at)
    expect(() => log.info('lost')).not.toThrow()
    await expect(log.idle()).resolves.toBeUndefined()
    expect(log.busy).toBe(false)
    await rm(file(), { recursive: true })
    log.info('kept')
    await log.idle()
    expect(await readFile(file(), 'utf8')).toBe('2026-10-09T12:00:00.000Z info kept\n')
  })
})
