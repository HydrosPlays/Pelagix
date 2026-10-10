import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MAX_POKEMON, parseReaderOutput, readGameSave, readerPath, READER_EXE, runReader, type ReaderRun } from './game-save'

const save = {
  type: 'SAV8SWSH', version: { id: 44, name: 'SW' }, generation: 8, trainer: 'Hydro',
  boxes: 32, boxSlots: 30, party: 1, boxed: 1, eggs: 0
}

/** A record exactly as the reader writes it. */
const boxed = {
  place: 'box', box: 2, boxName: 'Box 3', slot: 7, species: 292, form: 0, formArgument: null, gender: 'n',
  shiny: false, gmax: false, alpha: false, egg: false, ball: 4, version: { id: 45, name: 'SH' },
  metLocation: { id: 124, name: 'Dappled Grove (Wild Area)' }, eggLocation: null, metLevel: 29, metDate: '2019-12-05',
  level: 32, nickname: null, ot: 'Yuzu', fateful: false, legal: true,
  encounter: {
    kind: 'raid', type: 'raid', species: 290, form: 0, version: { id: 45, name: 'SH' },
    location: { id: 162, name: 'Pokémon Den' }, levelMin: 15, levelMax: 30
  },
  pid: '5B63395C', ivs: [31, 0, 17, 31, 9, 30], evs: [252, 0, 4, 0, 0, 252],
  fingerprint: '45:217bf47d:5b63395c'
}
const inParty = { ...boxed, place: 'party', box: null, boxName: null, slot: 0, species: 869, formArgument: 3, nickname: 'Cream', encounter: null }

const output = (pokemon: unknown[], extra: object = {}): string => JSON.stringify({ ok: true, save, pokemon, ...extra })
const ran = (stdout: string, error: ReaderRun['error'] = null) => async (): Promise<ReaderRun> => ({ error, stdout })
const exited = (code: unknown, extra: object = {}): ReaderRun['error'] => Object.assign(new Error('Command failed: C:\\secret\\path'), { code, ...extra })

describe('readerPath', () => {
  it('is beside the asar in an installed app and in the artifacts folder otherwise', () => {
    const where = { resourcesPath: join('C:', 'app', 'resources'), appPath: join('C:', 'repo') }
    expect(readerPath({ ...where, packaged: true })).toBe(join('C:', 'app', 'resources', 'save-reader', READER_EXE))
    expect(readerPath({ ...where, packaged: false })).toBe(join('C:', 'repo', 'tools', 'save-reader', '.artifacts', 'publish', READER_EXE))
  })
})

describe('parseReaderOutput', () => {
  it('reads a document the reader wrote', () => {
    const contents = parseReaderOutput(output([inParty, boxed]), 'main')
    expect(contents).toEqual({
      fileName: 'main',
      save: { type: 'SAV8SWSH', version: { id: 44, name: 'SW' }, generation: 8, trainer: 'Hydro', boxes: 32, boxSlots: 30 },
      pokemon: [inParty, boxed],
      dropped: 0
    })
  })

  it('keeps only the fields it knows', () => {
    const contents = parseReaderOutput(output([{ ...boxed, path: 'C:\\Users\\someone', encounter: { ...boxed.encounter, note: 'x' } }], { debug: 1 }), 'a.sav')
    expect(contents?.pokemon).toEqual([boxed])
    expect(contents).not.toHaveProperty('debug')
  })

  it.each([
    ['no species', { ...boxed, species: undefined }],
    ['species 0', { ...boxed, species: 0 }],
    ['a fractional form', { ...boxed, form: 1.5 }],
    ['an unknown gender', { ...boxed, gender: 'x' }],
    ['an unknown place', { ...boxed, place: 'daycare' }],
    ['a box Pokémon without a box', { ...boxed, box: null }],
    ['a level above 100', { ...boxed, level: 101 }],
    ['shiny as a number', { ...boxed, shiny: 1 }],
    ['a version name with other characters', { ...boxed, version: { id: 45, name: '<SH>' } }],
    ['no fingerprint', { ...boxed, fingerprint: '' }],
    ['an oversized fingerprint', { ...boxed, fingerprint: 'f'.repeat(200) }],
    ['a string', 'Pikachu'],
    ['null', null]
  ])('drops a record with %s', (_what, record) => {
    const contents = parseReaderOutput(output([record, boxed]), 'a.sav')
    expect(contents?.pokemon).toEqual([boxed])
    expect(contents?.dropped).toBe(1)
  })

  it('turns unknown or broken optional values into null instead of dropping the Pokémon', () => {
    const contents = parseReaderOutput(output([{
      ...boxed,
      formArgument: -1,
      metDate: '2019-13-40',
      metLocation: { id: 124 },
      eggLocation: { id: 70000, name: 'Nowhere' },
      nickname: 7,
      encounter: { ...boxed.encounter, kind: 'teleported' }
    }]), 'a.sav')
    expect(contents?.pokemon).toEqual([{ ...boxed, metDate: null, metLocation: null, encounter: null }])
  })

  it('caps string lengths and removes control characters', () => {
    const contents = parseReaderOutput(output([{ ...boxed, nickname: 'N'.repeat(500), ot: 'A\u0000B\nC', boxName: 'x'.repeat(500) }]), 'n'.repeat(999))
    const one = contents?.pokemon[0]
    expect(one?.nickname).toHaveLength(64)
    expect(one?.boxName).toHaveLength(64)
    expect(one?.ot).toBe('ABC')
    expect(contents?.fileName).toHaveLength(255)
  })

  it('caps the number of Pokémon', () => {
    const contents = parseReaderOutput(output(Array.from({ length: MAX_POKEMON + 5 }, () => boxed)), 'a.sav')
    expect(contents?.pokemon).toHaveLength(MAX_POKEMON)
    expect(contents?.dropped).toBe(5)
  })

  it.each([
    ['not JSON', 'Unhandled exception.'],
    ['an empty output', ''],
    ['an array', '[]'],
    ['a failure document', '{"ok":false,"error":"not-a-save"}'],
    ['no Pokémon list', JSON.stringify({ ok: true, save })],
    ['no save', JSON.stringify({ ok: true, pokemon: [] })],
    ['a broken save', JSON.stringify({ ok: true, save: { ...save, generation: 'eight' }, pokemon: [] })]
  ])('rejects %s', (_what, stdout) => {
    expect(parseReaderOutput(stdout, 'a.sav')).toBeNull()
  })
})

describe('readGameSave', () => {
  const read = (run: () => Promise<ReaderRun>) => readGameSave('reader.exe', join('C:', 'saves', 'main'), run)

  it('passes the path as the only argument and names the file without its folder', async () => {
    const calls: [string, string[]][] = []
    const result = await readGameSave('reader.exe', join('C:', 'saves', 'main'), async (exe, args) => {
      calls.push([exe, args])
      return { error: null, stdout: output([boxed]) }
    })
    expect(calls).toEqual([['reader.exe', [join('C:', 'saves', 'main')]]])
    expect(result).toEqual({ ok: true, contents: expect.objectContaining({ fileName: 'main', pokemon: [boxed] }) })
  })

  it.each(['not-a-save', 'too-large', 'unreadable'] as const)('reports the reader saying %s', async (code) => {
    expect(await read(ran(`{"ok":false,"error":"${code}"}`, exited(2)))).toEqual({ ok: false, reason: code })
  })

  it.each([
    ['an error code it does not know', '{"ok":false,"error":"usage"}', exited(1)],
    ['a crash', 'Unhandled exception. System.Exception: C:\\secret', exited(0xe0434352)],
    ['a success document with a failing exit code', output([boxed]), exited(5)],
    ['too much output', '', exited('ERR_CHILD_PROCESS_STDIO_MAXBUFFER', { killed: true })],
    ['a reader that cannot be started', '', exited('EACCES')],
    ['an unreadable success document', '{"ok":true}', null]
  ])('reports a failed reader for %s', async (_what, stdout, error) => {
    expect(await read(ran(stdout, error))).toEqual({ ok: false, reason: 'reader-failed' })
  })

  it('reports a missing reader', async () => {
    expect(await read(ran('', exited('ENOENT')))).toEqual({ ok: false, reason: 'reader-missing' })
  })

  it('reports a reader that was stopped for taking too long', async () => {
    expect(await read(ran('', exited(null, { killed: true, signal: 'SIGTERM' })))).toEqual({ ok: false, reason: 'timed-out' })
  })

  it('does not reject when running the reader throws', async () => {
    expect(await read(() => Promise.reject(new Error('spawn failed')))).toEqual({ ok: false, reason: 'reader-failed' })
  })

  it('reports a missing reader when the program is really not there', async () => {
    expect(await readGameSave(join(__dirname, 'no-such-reader.exe'), __filename)).toEqual({ ok: false, reason: 'reader-missing' })
  })

  // Needs `npm run reader:build`; skipped on a checkout that has not built the reader.
  const built = readerPath({ packaged: false, resourcesPath: '', appPath: join(__dirname, '..', '..') })
  it.skipIf(!existsSync(built))('runs the built reader, which turns down a file that is no save', async () => {
    expect(await readGameSave(built, __filename, runReader)).toEqual({ ok: false, reason: 'not-a-save' })
  })
})

describe('PID, IVs and EVs in the reader output', () => {
  const read = (record: object) => parseReaderOutput(output([record]), 'a.sav')

  it('passes them on as they are', () => {
    expect(read(boxed)?.pokemon[0]).toMatchObject({ pid: '5B63395C', ivs: [31, 0, 17, 31, 9, 30], evs: [252, 0, 4, 0, 0, 252] })
  })

  it('keeps null where the game has no such value', () => {
    expect(read({ ...boxed, pid: null, ivs: [15, 15, 15, 15, 15, 15], evs: null })?.pokemon[0]).toMatchObject({ pid: null, ivs: [15, 15, 15, 15, 15, 15], evs: null })
  })

  it.each([
    ['a missing PID', { pid: undefined }, 'pid'],
    ['a lower-case PID', { pid: '5b63395c' }, 'pid'],
    ['a short PID', { pid: '5B6' }, 'pid'],
    ['a PID that is a number', { pid: 1533229404 }, 'pid'],
    ['five IVs', { ivs: [31, 31, 31, 31, 31] }, 'ivs'],
    ['an IV above 31', { ivs: [31, 31, 32, 31, 31, 31] }, 'ivs'],
    ['a negative IV', { ivs: [31, -1, 31, 31, 31, 31] }, 'ivs'],
    ['IVs as text', { ivs: '31/31/31/31/31/31' }, 'ivs'],
    ['an EV above 255', { evs: [0, 0, 0, 0, 0, 256] }, 'evs'],
    ['a fractional EV', { evs: [0, 0, 0.5, 0, 0, 0] }, 'evs'],
    ['seven EVs', { evs: [0, 0, 0, 0, 0, 0, 0] }, 'evs']
  ] as const)('turns %s into null without dropping the Pokémon', (_what, broken, key) => {
    const contents = read({ ...boxed, ...broken })
    expect(contents?.dropped).toBe(0)
    expect(contents?.pokemon[0]).toEqual({ ...boxed, [key]: null })
  })
})
