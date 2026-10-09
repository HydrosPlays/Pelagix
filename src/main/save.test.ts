import { mkdtemp, mkdir, readdir, readFile, rm, truncate, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BACKUPS_TO_KEEP, createSaveStore, exportFileName, MAX_IMPORT_BYTES, readImportFile, writeExportFile } from './save'

let dir: string
let clock: Date
const quiet = { now: () => clock, log: () => {} }
const save = (n: number) => ({ version: 1, entries: [], marker: n })

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pelagix-save-'))
  clock = new Date(2026, 9, 9, 12, 0, 0)
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('save store', () => {
  it('returns null when there is no save yet', async () => {
    expect(await createSaveStore(dir, quiet).load()).toBeNull()
  })

  it('round-trips a save and leaves no temp files behind', async () => {
    const store = createSaveStore(dir, quiet)
    await store.write(save(1))
    expect(await store.load()).toEqual(save(1))
    expect(JSON.parse(await readFile(store.file, 'utf8'))).toEqual(save(1))
    expect(await readdir(dir)).toEqual(['save.json'])
  })

  it('applies queued writes in order', async () => {
    const store = createSaveStore(dir, quiet)
    const writes = Array.from({ length: 25 }, (_, i) => store.write(save(i)))
    expect(store.busy).toBe(true)
    await store.idle()
    expect(store.busy).toBe(false)
    await Promise.all(writes)
    expect(await store.load()).toEqual(save(24))
    expect((await readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual([])
  })

  it('keeps working after a write that cannot be serialised', async () => {
    const store = createSaveStore(dir, quiet)
    await store.write(save(1))
    const cyclic: Record<string, unknown> = {}
    cyclic['self'] = cyclic
    await expect(store.write(cyclic)).rejects.toThrow()
    await expect(store.write(undefined)).rejects.toThrow(TypeError)
    expect(await store.load()).toEqual(save(1))
    await store.write(save(2))
    expect(await store.load()).toEqual(save(2))
  })

  it('removes temp files left by a crashed write', async () => {
    await writeFile(join(dir, 'save.json.4242.1700000000000.0.tmp'), '{"half":')
    await writeFile(join(dir, 'save.json'), JSON.stringify(save(7)))
    expect(await createSaveStore(dir, quiet).load()).toEqual(save(7))
    expect(await readdir(dir)).toEqual(['save.json'])
  })

  it('backs up the previous save on the first write of each day only', async () => {
    const store = createSaveStore(dir, quiet)
    await store.write(save(1)) // nothing to back up yet
    expect(await readdir(dir)).toEqual(['save.json'])

    clock = new Date(2026, 9, 10, 9, 0, 0)
    await store.write(save(2))
    await store.write(save(3))
    expect(await readdir(store.backupsDir)).toEqual(['save-20261010.json'])
    expect(JSON.parse(await readFile(join(store.backupsDir, 'save-20261010.json'), 'utf8'))).toEqual(save(1))

    // a restart on the same day must not replace that day's backup
    await createSaveStore(dir, quiet).write(save(4))
    expect(JSON.parse(await readFile(join(store.backupsDir, 'save-20261010.json'), 'utf8'))).toEqual(save(1))

    clock = new Date(2026, 9, 11, 9, 0, 0)
    await store.write(save(5))
    expect(await readdir(store.backupsDir)).toEqual(['save-20261010.json', 'save-20261011.json'])
    expect(JSON.parse(await readFile(join(store.backupsDir, 'save-20261011.json'), 'utf8'))).toEqual(save(4))
  })

  it(`keeps only the newest ${BACKUPS_TO_KEEP} backups`, async () => {
    const store = createSaveStore(dir, quiet)
    await store.write(save(0))
    for (let day = 1; day <= 20; day++) {
      clock = new Date(2026, 0, day, 8, 0, 0)
      await store.write(save(day))
    }
    const backups = await readdir(store.backupsDir)
    expect(backups).toHaveLength(BACKUPS_TO_KEEP)
    expect(backups[0]).toBe('save-20260107.json')
    expect(backups.at(-1)).toBe('save-20260120.json')
  })

  it('moves a corrupt save aside and restores the newest readable backup', async () => {
    const store = createSaveStore(dir, quiet)
    await mkdir(store.backupsDir)
    await writeFile(join(store.backupsDir, 'save-20261001.json'), JSON.stringify(save(1)))
    await writeFile(join(store.backupsDir, 'save-20261005.json'), JSON.stringify(save(5)))
    await writeFile(join(store.backupsDir, 'save-20261008.json'), '{"version":1,"entr') // truncated
    await writeFile(join(store.backupsDir, 'notes.txt'), 'ignored')
    await writeFile(store.file, '\u0000\u0000\u0000')

    expect(await store.load()).toEqual(save(5))
    const names = await readdir(dir)
    expect(names).toContain('save.corrupt-20261009-120000.json')
    expect(await readFile(join(dir, 'save.corrupt-20261009-120000.json'), 'utf8')).toBe('\u0000\u0000\u0000')
    // restored in place, so a restart without further writes still sees it
    expect(await createSaveStore(dir, quiet).load()).toEqual(save(5))
  })

  it('treats JSON that is not an object as corrupt and returns null without backups', async () => {
    const store = createSaveStore(dir, quiet)
    await writeFile(store.file, '[1,2,3]')
    expect(await store.load()).toBeNull()
    expect(await readdir(dir)).toEqual(['save.corrupt-20261009-120000.json'])
  })

  it('does not rotate a good backup out for a corrupt previous save', async () => {
    const store = createSaveStore(dir, quiet)
    await writeFile(store.file, 'garbage')
    await store.write(save(1))
    expect(await readdir(dir)).toEqual(['save.json'])
  })

  it('accepts a save file with a UTF-8 byte order mark', async () => {
    const store = createSaveStore(dir, quiet)
    await writeFile(store.file, `﻿${JSON.stringify(save(3))}`)
    expect(await store.load()).toEqual(save(3))
  })
})

describe('import and export files', () => {
  it('names exports by local date', () => {
    expect(exportFileName(new Date(2026, 0, 5))).toBe('pelagix-save-2026-01-05.json')
  })

  it('writes pretty JSON that imports back unchanged', async () => {
    const file = join(dir, 'export.json')
    await writeExportFile(file, save(9))
    const text = await readFile(file, 'utf8')
    expect(text).toBe(`${JSON.stringify(save(9), null, 2)}\n`)
    expect(await readImportFile(file)).toEqual(save(9))
  })

  it('rejects files that are not JSON', async () => {
    const file = join(dir, 'bad.json')
    await writeFile(file, 'not json')
    await expect(readImportFile(file)).rejects.toThrow('not valid JSON')
    await expect(readImportFile(dir)).rejects.toThrow('not a file')
    await expect(readImportFile(join(dir, 'missing.json'))).rejects.toThrow()
  })

  it('rejects files over 50 MB without reading them', async () => {
    const file = join(dir, 'huge.json')
    await writeFile(file, '{}')
    await truncate(file, MAX_IMPORT_BYTES + 1)
    await expect(readImportFile(file)).rejects.toThrow('larger than 50 MB')
    await truncate(file, 2)
    expect(await readImportFile(file)).toEqual({})
  })
})
