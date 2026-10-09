import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_RULES, DEFAULT_SETTINGS, SAVE_VERSION, type CatchEntry, type SaveFile } from '@shared/save-types'
import {
  checkEntry, createApiBackend, createMemoryBackend, createStorageBackend, exportFileName, parseSave, parseSaveReport, sanitizeEntry, sanitizeRules,
  sanitizeSettings, SAVE_STORAGE_KEY
} from './storage'

const NOW = '2026-10-09T12:00:00.000Z'
const T1 = '2026-03-01T08:00:00.000Z'
const T2 = '2026-03-02T09:30:00.000Z'

const fullEntry: CatchEntry = {
  id: 'a1',
  species: 25,
  form: 0,
  variant: 2,
  gender: 'f',
  shiny: true,
  gmax: true,
  alpha: true,
  game: 'sword',
  kind: 'raid',
  method: 'Max Raid Battle',
  location: 'Wild Area · Stony Wilderness',
  origin: [172, 0],
  ball: 4,
  level: 42,
  date: '2026-02-28',
  nickname: 'Sparky',
  ot: 'Red',
  notes: 'First shiny',
  createdAt: T1,
  updatedAt: T2
}
const minimalEntry: CatchEntry = { id: 'b2', species: 1, form: 0, shiny: false, game: 'red', kind: 'gift', createdAt: T1, updatedAt: T1 }

const validSave: SaveFile = {
  version: SAVE_VERSION,
  entries: [fullEntry, minimalEntry],
  settings: { rules: { ...DEFAULT_RULES, mega: true, regional: false }, theme: 'light', reduceMotion: true, trainerName: 'Ash' },
  achievements: { 'first-catch': T1 },
  createdAt: T1,
  updatedAt: T2
}

function expectValidSave(save: SaveFile): void {
  expect(save.version).toBe(SAVE_VERSION)
  expect(Array.isArray(save.entries)).toBe(true)
  expect(Object.keys(save.settings.rules).sort()).toEqual(Object.keys(DEFAULT_RULES).sort())
  expect(Object.values(save.settings.rules).every((v) => typeof v === 'boolean')).toBe(true)
  expect(['dark', 'light']).toContain(save.settings.theme)
  expect(typeof save.settings.reduceMotion).toBe('boolean')
  expect(typeof save.settings.trainerName).toBe('string')
  expect(typeof save.achievements).toBe('object')
  expect(Number.isNaN(Date.parse(save.createdAt))).toBe(false)
  expect(Number.isNaN(Date.parse(save.updatedAt))).toBe(false)
}

describe('parseSave: garbage in', () => {
  const garbage: Array<[string, unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
    ['a string', 'save'],
    ['a boolean', true],
    ['an empty array', []],
    ['an array of junk', [1, 'two', null]],
    ['an empty object', {}],
    ['unrelated JSON', { name: 'pelagix', version: '0.1.0', lockfileVersion: 3 }],
    ['a function', () => 1],
    ['a date', new Date(0)]
  ]

  it.each(garbage)('returns a fresh empty save for %s', (_label, raw) => {
    const report = parseSaveReport(raw, NOW)
    expect(report.recognized).toBe(false)
    expect(report.save).toEqual({ version: SAVE_VERSION, entries: [], settings: DEFAULT_SETTINGS, achievements: {}, createdAt: NOW, updatedAt: NOW })
    expect(report).toMatchObject({ total: 0, dropped: 0, repaired: 0, fromVersion: null, newer: false })
    expectValidSave(parseSave(raw))
  })

  it('does not hand out the shared default objects', () => {
    const a = parseSave(null)
    a.settings.rules.mega = true
    a.entries.push(minimalEntry)
    const b = parseSave(null)
    expect(b.settings.rules.mega).toBe(false)
    expect(b.entries).toEqual([])
    expect(DEFAULT_RULES.mega).toBe(false)
  })

  it('survives hostile field types without throwing', () => {
    const report = parseSaveReport({ version: 1, entries: 'nope', settings: 5, achievements: [1, 2], createdAt: 12, updatedAt: {} }, NOW)
    expect(report.recognized).toBe(false)
    const second = parseSaveReport({ version: 1, entries: [null, 3, 'x', [], { species: {} }], settings: [], achievements: 'x', createdAt: 'yesterday' }, NOW)
    expect(second.recognized).toBe(true)
    expect(second.save.entries).toEqual([])
    expect(second.dropped).toBe(5)
    expect(second.save.settings).toEqual(DEFAULT_SETTINGS)
    expect(second.save.achievements).toEqual({})
    expect(second.save.createdAt).toBe(NOW)
  })
})

describe('parseSave: valid and partial saves', () => {
  it('returns a valid save unchanged', () => {
    const report = parseSaveReport(validSave, NOW)
    expect(report.save).toEqual(validSave)
    expect(report).toMatchObject({ recognized: true, total: 2, dropped: 0, repaired: 0, fromVersion: SAVE_VERSION, newer: false, warnings: [] })
  })

  it('returns new objects, not the input', () => {
    const save = parseSave(validSave)
    expect(save).not.toBe(validSave)
    expect(save.entries[0]).not.toBe(validSave.entries[0])
    expect(save.settings.rules).not.toBe(validSave.settings.rules)
  })

  it('survives a JSON round trip', () => {
    expect(parseSave(JSON.parse(JSON.stringify(validSave)), NOW)).toEqual(validSave)
  })

  it('fills in everything a bare entry list lacks', () => {
    const save = parseSave({ version: SAVE_VERSION, entries: [minimalEntry] }, NOW)
    expect(save).toEqual({ version: SAVE_VERSION, entries: [minimalEntry], settings: DEFAULT_SETTINGS, achievements: {}, createdAt: NOW, updatedAt: NOW })
  })

  it('accepts a save with settings but no entries', () => {
    const report = parseSaveReport({ version: SAVE_VERSION, settings: { theme: 'light' } }, NOW)
    expect(report.recognized).toBe(true)
    expect(report.save.entries).toEqual([])
    expect(report.save.settings).toEqual({ ...DEFAULT_SETTINGS, theme: 'light' })
  })

  it('fills missing rules and settings with defaults and ignores unknown or mistyped ones', () => {
    const save = parseSave({ version: 1, entries: [], settings: { theme: 'neon', reduceMotion: 'yes', trainerName: 7, rules: { regional: false, mega: 'yes', bogus: true } } }, NOW)
    expect(save.settings.theme).toBe('dark')
    expect(save.settings.reduceMotion).toBe(false)
    expect(save.settings.trainerName).toBe('')
    expect(save.settings.rules).toEqual({ ...DEFAULT_RULES, regional: false })
    expect('bogus' in save.settings.rules).toBe(false)
  })

  it('trims and caps the trainer name', () => {
    expect(sanitizeSettings({ trainerName: '  Ash  ' }).trainerName).toBe('Ash')
    expect(sanitizeSettings({ trainerName: 'x'.repeat(100) }).trainerName).toHaveLength(40)
  })

  it('sanitizeRules falls back to all defaults for non-objects', () => {
    expect(sanitizeRules(null)).toEqual(DEFAULT_RULES)
    expect(sanitizeRules('all')).toEqual(DEFAULT_RULES)
    expect(sanitizeRules({ gmax: true })).toEqual({ ...DEFAULT_RULES, gmax: true })
    expect(sanitizeRules(null)).not.toBe(DEFAULT_RULES)
  })

  it('keeps achievements, repairing bad timestamps and dropping bad ids', () => {
    const save = parseSave({ version: 1, entries: [], updatedAt: T2, achievements: { ok: T1, stale: 'last week', '': T1, numeric: 5 } }, NOW)
    expect(save.achievements).toEqual({ ok: T1, stale: T2, numeric: T2 })
  })

  it('falls back to createdAt when updatedAt is missing', () => {
    const save = parseSave({ version: 1, entries: [], createdAt: T1 }, NOW)
    expect(save.createdAt).toBe(T1)
    expect(save.updatedAt).toBe(T1)
  })
})

describe('parseSave: entries', () => {
  const parseEntries = (entries: unknown[]) => parseSaveReport({ version: SAVE_VERSION, entries, createdAt: T1, updatedAt: T2 }, NOW)

  it.each<[string, unknown]>([
    ['a non-object', 'pikachu'],
    ['null', null],
    ['an array', [25, 0]],
    ['a missing species', { ...minimalEntry, species: undefined }],
    ['species 0', { ...minimalEntry, species: 0 }],
    ['a fractional species', { ...minimalEntry, species: 25.5 }],
    ['a string species', { ...minimalEntry, species: '25' }],
    ['an absurd species', { ...minimalEntry, species: 1e9 }],
    ['a negative form', { ...minimalEntry, form: -1 }],
    ['a fractional form', { ...minimalEntry, form: 0.5 }],
    ['a string form', { ...minimalEntry, form: '1' }],
    ['a missing game', { ...minimalEntry, game: undefined }],
    ['an empty game', { ...minimalEntry, game: '' }],
    ['a game that is not a slug', { ...minimalEntry, game: 'Pokémon Red' }],
    ['a numeric game', { ...minimalEntry, game: 7 }]
  ])('drops an entry with %s', (_label, bad) => {
    const report = parseEntries([minimalEntry, bad])
    expect(report.save.entries).toEqual([minimalEntry])
    expect(report).toMatchObject({ total: 2, dropped: 1, repaired: 0 })
    expect(report.warnings.join(' ')).toContain('1 invalid or duplicate entry was skipped')
  })

  it('reports how many entries were dropped', () => {
    const report = parseEntries([{ species: 0 }, minimalEntry, null, { ...fullEntry }, { game: 'red' }])
    expect(report.save.entries.map((e) => e.id)).toEqual(['b2', 'a1'])
    expect(report).toMatchObject({ total: 5, dropped: 3 })
  })

  it('drops a repeated id and keeps the first', () => {
    const report = parseEntries([minimalEntry, { ...minimalEntry, species: 2 }, fullEntry])
    expect(report.save.entries.map((e) => [e.id, e.species])).toEqual([['b2', 1], ['a1', 25]])
    expect(report.dropped).toBe(1)
  })

  it('keeps an entry whose game is unknown to this version', () => {
    expect(parseEntries([{ ...minimalEntry, game: 'legends-future' }]).save.entries[0]?.game).toBe('legends-future')
  })

  it('assigns an id when it is missing or unusable', () => {
    const report = parseEntries([{ ...minimalEntry, id: undefined }, { ...minimalEntry, id: '' }, { ...minimalEntry, id: 5 }])
    const ids = report.save.entries.map((e) => e.id)
    expect(ids).toHaveLength(3)
    expect(new Set(ids).size).toBe(3)
    expect(ids.every((id) => typeof id === 'string' && id.length >= 8)).toBe(true)
    expect(report).toMatchObject({ dropped: 0, repaired: 3 })
  })

  it('defaults a missing form to 0 and an unknown kind to "other"', () => {
    const { form: _form, ...noForm } = minimalEntry
    const report = parseEntries([noForm, { ...minimalEntry, id: 'k', kind: 'teleported' }])
    expect(report.save.entries[0]).toEqual(minimalEntry)
    expect(report.save.entries[1]?.kind).toBe('other')
    expect(report.repaired).toBe(2)
  })

  it('discards each invalid optional field and keeps the entry', () => {
    const report = parseEntries([
      {
        ...fullEntry,
        variant: -1,
        gender: 'x',
        gmax: 'yes',
        alpha: 1,
        method: 12,
        location: ['Route 1'],
        origin: [0, 0],
        ball: 999,
        level: 101,
        date: '2023-02-30',
        nickname: {},
        ot: false,
        notes: 3
      }
    ])
    expect(report.save.entries).toEqual([{ id: 'a1', species: 25, form: 0, shiny: true, game: 'sword', kind: 'raid', createdAt: T1, updatedAt: T2 }])
    expect(report).toMatchObject({ dropped: 0, repaired: 1 })
    expect(report.warnings.join(' ')).toContain('1 entry had invalid details removed')
  })

  it.each<[string, Partial<Record<keyof CatchEntry, unknown>>]>([
    ['level 0', { level: 0 }],
    ['a fractional level', { level: 12.5 }],
    ['a three-element origin', { origin: [25, 0, 1] }],
    ['an origin with a bad form', { origin: [25, -1] }],
    ['a ball that is not a PKHeX ball id', { ball: 0 }],
    ['a date in the wrong format', { date: '28/02/2026' }],
    ['month 13', { date: '2026-13-01' }],
    ['a fractional variant', { variant: 1.5 }]
  ])('discards %s', (_label, patch) => {
    const entry = parseEntries([{ ...minimalEntry, ...patch }]).save.entries[0]
    expect(entry).toEqual(minimalEntry)
  })

  it('treats only true as true for flags and omits false ones', () => {
    const entry = parseEntries([{ ...minimalEntry, shiny: 'true', gmax: false, alpha: false }]).save.entries[0]!
    expect(entry.shiny).toBe(false)
    expect('gmax' in entry).toBe(false)
    expect('alpha' in entry).toBe(false)
  })

  it('trims text, drops blank text and cuts over-long text', () => {
    const report = parseEntries([{ ...minimalEntry, nickname: '  Bulby ', location: '   ', notes: 'n'.repeat(5000), ot: '' }])
    const entry = report.save.entries[0]!
    expect(entry.nickname).toBe('Bulby')
    expect('location' in entry).toBe(false)
    expect('ot' in entry).toBe(false)
    expect(entry.notes).toHaveLength(4000)
    expect(report.repaired).toBe(1) // only the truncation counts as a repair
  })

  it('reduces a timestamp in the date field to its local day', () => {
    const stamp = new Date(2026, 4, 17, 23, 30).toISOString()
    expect(parseEntries([{ ...minimalEntry, date: stamp }]).save.entries[0]?.date).toBe('2026-05-17')
  })

  it('strips fields it does not know', () => {
    const entry = parseEntries([{ ...minimalEntry, favourite: true, __proto__: { hacked: true } }]).save.entries[0]!
    expect(entry).toEqual(minimalEntry)
    expect(Object.keys(entry)).toEqual(['id', 'species', 'form', 'shiny', 'game', 'kind', 'createdAt', 'updatedAt'])
  })

  it('repairs entry timestamps from the save', () => {
    const entry = parseEntries([{ ...minimalEntry, createdAt: 'soon', updatedAt: null }]).save.entries[0]!
    expect(entry.createdAt).toBe(T1) // the save's createdAt
    expect(entry.updatedAt).toBe(T1)
  })

  it('stores every timestamp in canonical UTC form so they sort as strings', () => {
    const report = parseSaveReport(
      {
        version: SAVE_VERSION,
        entries: [{ ...minimalEntry, createdAt: '2026-03-01T10:00:00+02:00', updatedAt: '2026-03-01T10:30:00.5+02:00' }],
        achievements: { first: '2026-03-01T09:00:00-01:00' },
        createdAt: '2026-03-01T08:00:00Z',
        updatedAt: '2026-03-02T08:00:00.000+00:00'
      },
      NOW
    )
    expect(report.save.entries[0]).toMatchObject({ createdAt: '2026-03-01T08:00:00.000Z', updatedAt: '2026-03-01T08:30:00.500Z' })
    expect(report.save.achievements.first).toBe('2026-03-01T10:00:00.000Z')
    expect(report.save.createdAt).toBe('2026-03-01T08:00:00.000Z')
    expect(report.save.updatedAt).toBe('2026-03-02T08:00:00.000Z')
    expect(report.repaired).toBe(0)
  })

  it('writes keys in a stable order with no undefined values', () => {
    const shuffled = Object.fromEntries(Object.entries(fullEntry).reverse())
    const entry = parseEntries([shuffled]).save.entries[0]!
    expect(Object.keys(entry)).toEqual(Object.keys(fullEntry))
    expect(Object.values(entry).includes(undefined)).toBe(false)
  })

  it('checkEntry explains a rejection and sanitizeEntry returns null', () => {
    expect(checkEntry({ species: 1, form: 0 }, NOW)).toEqual({ entry: null, repaired: false, reason: 'invalid game' })
    expect(checkEntry({ game: 'red' }, NOW).reason).toBe('invalid species')
    expect(checkEntry({ species: 1, form: 300, game: 'red' }, NOW).reason).toBe('invalid form')
    expect(checkEntry(7, NOW).reason).toBe('not an object')
    expect(sanitizeEntry({ species: 1 })).toBeNull()
    expect(sanitizeEntry(minimalEntry)).toEqual(minimalEntry)
  })
})

describe('parseSave: versions', () => {
  it('treats a save without a version as format 0 and upgrades it', () => {
    const report = parseSaveReport({ entries: [minimalEntry], rules: { mega: true, regional: false }, achievements: ['first-catch', 7, 'ten-catches'], updatedAt: T2 }, NOW)
    expect(report.fromVersion).toBeNull()
    expect(report.save.version).toBe(SAVE_VERSION)
    expect(report.save.settings.rules).toEqual({ ...DEFAULT_RULES, mega: true, regional: false })
    expect(report.save.achievements).toEqual({ 'first-catch': T2, 'ten-catches': T2 })
    expect(report.save.entries).toEqual([minimalEntry])
    expect(report.warnings.join(' ')).toContain('upgraded from format 0')
  })

  it('upgrades an explicit version 0 the same way', () => {
    const report = parseSaveReport({ version: 0, entries: [], rules: { gmax: true } }, NOW)
    expect(report.fromVersion).toBe(0)
    expect(report.save.settings.rules.gmax).toBe(true)
    expect(report.save.version).toBe(SAVE_VERSION)
  })

  it('prefers rules already under settings over legacy top-level rules', () => {
    const report = parseSaveReport({ entries: [], rules: { gmax: true }, settings: { rules: { gmax: false, mega: true } } }, NOW)
    expect(report.save.settings.rules).toEqual({ ...DEFAULT_RULES, mega: true })
  })

  it('accepts a bare list of entries', () => {
    const report = parseSaveReport([minimalEntry, fullEntry, 'junk'], NOW)
    expect(report.recognized).toBe(true)
    expect(report.save.entries).toEqual([minimalEntry, fullEntry])
    expect(report).toMatchObject({ total: 3, dropped: 1, fromVersion: null })
  })

  it('does not run migrations on a current save', () => {
    // A top-level `rules` key means nothing in the current format.
    const report = parseSaveReport({ ...validSave, rules: { gmax: true } }, NOW)
    expect(report.save).toEqual(validSave)
    expect(report.warnings).toEqual([])
  })

  it('reads what it can from a newer format and says so', () => {
    const report = parseSaveReport({ ...validSave, version: SAVE_VERSION + 5, futureThing: { a: 1 } }, NOW)
    expect(report.newer).toBe(true)
    expect(report.fromVersion).toBe(SAVE_VERSION + 5)
    expect(report.save.version).toBe(SAVE_VERSION)
    expect(report.save.entries).toEqual(validSave.entries)
    expect('futureThing' in report.save).toBe(false)
    expect(report.warnings.join(' ')).toContain('newer version')
  })

  it('ignores a nonsensical version', () => {
    expect(parseSaveReport({ version: 'one', entries: [] }, NOW).fromVersion).toBeNull()
    expect(parseSaveReport({ version: -3, entries: [] }, NOW).fromVersion).toBeNull()
    expect(parseSaveReport({ version: 1.5, entries: [] }, NOW).fromVersion).toBeNull()
  })
})

describe('save backends', () => {
  function fakeStorage(initial: Record<string, string> = {}) {
    const items = new Map(Object.entries(initial))
    return {
      items,
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value)
    }
  }

  it('storage backend: nothing stored loads as null', async () => {
    expect(await createStorageBackend(fakeStorage()).load()).toBeNull()
  })

  it('storage backend: round-trips a save under pelagix.save.v1', async () => {
    const storage = fakeStorage()
    const backend = createStorageBackend(storage)
    expect(backend.kind).toBe('browser')
    await backend.write(validSave)
    expect([...storage.items.keys()]).toEqual([SAVE_STORAGE_KEY])
    expect(SAVE_STORAGE_KEY).toBe('pelagix.save.v1')
    expect(parseSave(await backend.load())).toEqual(validSave)
  })

  it('storage backend: writes synchronously, before the promise settles', () => {
    const storage = fakeStorage()
    void createStorageBackend(storage).write(validSave)
    expect(storage.items.has(SAVE_STORAGE_KEY)).toBe(true)
  })

  it('storage backend: sets unreadable JSON aside instead of failing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: '{"entries": [' })
    expect(await createStorageBackend(storage).load()).toBeNull()
    expect(storage.items.get(`${SAVE_STORAGE_KEY}.corrupt`)).toBe('{"entries": [')
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('storage backend: reports a full storage in plain words', async () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
      }
    }
    await expect(createStorageBackend(storage).write(validSave)).rejects.toThrow('Browser storage is full')
  })

  it('storage backend: rejects when storage cannot be read', async () => {
    const storage = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {}
    }
    await expect(createStorageBackend(storage).load()).rejects.toThrow('Could not read the save')
  })

  it('api backend: delegates to window.api', async () => {
    const api = { loadSave: vi.fn(async () => validSave as unknown), writeSave: vi.fn(async () => {}) }
    const backend = createApiBackend(api)
    expect(backend.kind).toBe('electron')
    expect(await backend.load()).toBe(validSave)
    await backend.write(validSave)
    expect(api.writeSave).toHaveBeenCalledWith(validSave)
  })

  it('memory backend: stores a copy', async () => {
    const backend = createMemoryBackend()
    expect(await backend.load()).toBeNull()
    await backend.write(validSave)
    expect(backend.current()).toEqual(validSave)
    expect(backend.current()).not.toBe(validSave)
    const loaded = await backend.load()
    expect(loaded).toEqual(validSave)
    expect(loaded).not.toBe(backend.current())
  })
})

describe('exportFileName', () => {
  it('matches the main process: pelagix-save-YYYY-MM-DD.json in local time', () => {
    expect(exportFileName(new Date(2026, 9, 9, 23, 59))).toBe('pelagix-save-2026-10-09.json')
    expect(exportFileName(new Date(2026, 0, 5))).toBe('pelagix-save-2026-01-05.json')
  })
})
