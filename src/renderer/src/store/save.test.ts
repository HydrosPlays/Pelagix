import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_RULES, DEFAULT_SETTINGS, SAVE_VERSION, type CatchEntry, type SaveFile } from '@shared/save-types'
import { createMemoryBackend, type SaveBackend } from '@renderer/lib/storage'
import { createSaveStore, entriesBySpecies, type EntryInput } from './save'

const pikachu: EntryInput = { species: 25, form: 0, shiny: false, game: 'yellow', kind: 'gift', ball: 4, location: 'Pallet Town' }
const eevee: EntryInput = { species: 133, form: 0, shiny: true, game: 'scarlet', kind: 'wild' }

/** A clock that advances one second per reading, so every mutation gets a distinct timestamp. */
function clock(start = Date.UTC(2026, 5, 1, 10, 0, 0)) {
  let t = start
  return () => new Date((t += 1000)).toISOString()
}

interface TestBackend extends SaveBackend {
  loads: number
  writes: SaveFile[]
  /** Makes the next n writes fail. */
  failNext(n: number): void
  current(): unknown | null
}

function testBackend(initial: unknown | null = null): TestBackend {
  const memory = createMemoryBackend(initial)
  let failing = 0
  const backend: TestBackend = {
    kind: 'memory',
    loads: 0,
    writes: [],
    failNext: (n) => void (failing = n),
    current: memory.current,
    load() {
      backend.loads++
      return memory.load()
    },
    write(save) {
      backend.writes.push(structuredClone(save))
      if (failing > 0) {
        failing--
        return Promise.reject(new Error('disk full'))
      }
      return memory.write(save)
    }
  }
  return backend
}

async function ready(initial: unknown | null = null) {
  const backend = testBackend(initial)
  const store = createSaveStore({ backend, now: clock(), flushOnUnload: false })
  await store.getState().hydrate()
  return { backend, store, get: store.getState }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('hydrate', () => {
  it('starts idle with an empty, valid save', () => {
    const store = createSaveStore({ backend: testBackend(), flushOnUnload: false })
    const s = store.getState()
    expect(s.status).toBe('idle')
    expect(s.save).toMatchObject({ version: SAVE_VERSION, entries: [], achievements: {}, settings: DEFAULT_SETTINGS })
    expect(s.lastError).toBeNull()
    expect(s.dirty).toBe(false)
  })

  it('becomes ready with a fresh save when nothing is stored, without writing', async () => {
    const { backend, get } = await ready()
    expect(get().status).toBe('ready')
    expect(get().save.entries).toEqual([])
    expect(get().loadReport).toBeNull()
    await vi.advanceTimersByTimeAsync(5000)
    expect(backend.writes).toHaveLength(0)
  })

  it('loads a stored save and reports what it had to drop', async () => {
    const stored = { version: 1, entries: [{ id: 'x', species: 1, form: 0, shiny: false, game: 'red', kind: 'gift', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }, { species: 0 }], settings: { theme: 'light' } }
    const { get } = await ready(stored)
    expect(get().save.entries.map((e) => e.id)).toEqual(['x'])
    expect(get().save.settings.theme).toBe('light')
    expect(get().loadReport).toMatchObject({ recognized: true, total: 2, dropped: 1 })
  })

  it('flags stored data that is not a save', async () => {
    const { get } = await ready({ hello: 'world' })
    expect(get().status).toBe('ready')
    expect(get().loadReport).toMatchObject({ recognized: false })
    expect(get().save.entries).toEqual([])
  })

  it('loads once for concurrent and repeated calls', async () => {
    const backend = testBackend()
    const store = createSaveStore({ backend, flushOnUnload: false })
    const a = store.getState().hydrate()
    const b = store.getState().hydrate()
    expect(store.getState().status).toBe('loading')
    await Promise.all([a, b])
    await store.getState().hydrate()
    expect(backend.loads).toBe(1)
  })

  it('reports a load failure without rejecting, and can be retried', async () => {
    const backend = testBackend()
    let fail = true
    const load = backend.load.bind(backend)
    backend.load = () => (fail ? Promise.reject(new Error("Error invoking remote method 'pelagix:save-load': Error: EACCES")) : load())
    const store = createSaveStore({ backend, flushOnUnload: false })
    await expect(store.getState().hydrate()).resolves.toBeUndefined()
    expect(store.getState().status).toBe('error')
    expect(store.getState().lastError).toBe('Your save could not be loaded: EACCES')
    fail = false
    await store.getState().hydrate()
    expect(store.getState().status).toBe('ready')
    expect(store.getState().lastError).toBeNull()
  })

  it('refuses mutations until the save is loaded', () => {
    const store = createSaveStore({ backend: testBackend(), flushOnUnload: false })
    expect(() => store.getState().addEntry(pikachu)).toThrow(/before the save was loaded/)
    expect(() => store.getState().setRules({ mega: true })).toThrow(/before the save was loaded/)
    expect(() => store.getState().resetAll()).toThrow(/before the save was loaded/)
    expect(store.getState().save.entries).toEqual([])
  })
})

describe('persistence', () => {
  it('writes 400 ms after a mutation, not before', async () => {
    const { backend, get } = await ready()
    get().addEntry(pikachu)
    expect(get().dirty).toBe(true)
    await vi.advanceTimersByTimeAsync(399)
    expect(backend.writes).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(backend.writes).toHaveLength(1)
    expect(backend.writes[0]).toEqual(get().save)
    expect(get().dirty).toBe(false)
  })

  it('coalesces a burst of mutations into one write of the final state', async () => {
    const { backend, get } = await ready()
    get().addEntry(pikachu)
    await vi.advanceTimersByTimeAsync(300)
    get().addEntry(eevee)
    await vi.advanceTimersByTimeAsync(300)
    get().setRules({ mega: true })
    expect(backend.writes).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(400)
    expect(backend.writes).toHaveLength(1)
    expect(backend.writes[0]?.entries).toHaveLength(2)
    expect(backend.writes[0]?.settings.rules.mega).toBe(true)
  })

  it('flush() starts the write synchronously and resolves true once it is stored', async () => {
    const { backend, get } = await ready()
    get().addEntry(pikachu)
    const flushed = get().flush()
    expect(backend.writes).toHaveLength(1) // before any await: usable from pagehide
    await expect(flushed).resolves.toBe(true)
    expect(backend.current()).toEqual(get().save)
    await vi.advanceTimersByTimeAsync(1000)
    expect(backend.writes).toHaveLength(1) // the debounce timer was cancelled
  })

  it('flush() with nothing pending writes nothing', async () => {
    const { backend, get } = await ready()
    await expect(get().flush()).resolves.toBe(true)
    get().addEntry(pikachu)
    await get().flush()
    await get().flush()
    expect(backend.writes).toHaveLength(1)
  })

  it('keeps state and reports the error when a write fails, then retries', async () => {
    const { backend, get } = await ready()
    backend.failNext(1)
    const entry = get().addEntry(pikachu)
    await expect(get().flush()).resolves.toBe(false)
    expect(get().lastError).toBe('Your changes could not be saved: disk full')
    expect(get().save.entries).toEqual([entry])
    expect(get().dirty).toBe(true)
    expect(backend.current()).toBeNull()

    await vi.advanceTimersByTimeAsync(2000) // first retry
    expect(backend.writes).toHaveLength(2)
    expect(get().lastError).toBeNull()
    expect(get().dirty).toBe(false)
    expect(backend.current()).toEqual(get().save)
  })

  it('backs off between retries and gives up quietly, resuming on the next mutation', async () => {
    const { backend, get } = await ready()
    backend.failNext(100)
    get().addEntry(pikachu)
    await vi.advanceTimersByTimeAsync(400)
    expect(backend.writes).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(2000)
    expect(backend.writes).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(5000)
    expect(backend.writes).toHaveLength(3)
    await vi.advanceTimersByTimeAsync(15_000 + 30_000 + 60_000)
    expect(backend.writes).toHaveLength(6)
    await vi.advanceTimersByTimeAsync(600_000)
    expect(backend.writes).toHaveLength(6)
    expect(get().lastError).toContain('disk full')

    backend.failNext(0)
    get().addEntry(eevee)
    await vi.advanceTimersByTimeAsync(400)
    expect(backend.writes).toHaveLength(7)
    expect(get().lastError).toBeNull()
    expect(backend.current()).toEqual(get().save)
  })

  it('a mutation during a failed write is not lost', async () => {
    const { backend, get } = await ready()
    backend.failNext(1)
    get().addEntry(pikachu)
    await get().flush()
    get().addEntry(eevee)
    await expect(get().flush()).resolves.toBe(true)
    expect((backend.current() as SaveFile).entries).toHaveLength(2)
  })

  it('surfaces a backend that throws synchronously', async () => {
    const backend = testBackend()
    backend.write = () => {
      throw new Error('boom')
    }
    const store = createSaveStore({ backend, flushOnUnload: false })
    await store.getState().hydrate()
    store.getState().addEntry(pikachu)
    await expect(store.getState().flush()).resolves.toBe(false)
    expect(store.getState().lastError).toContain('boom')
    expect(store.getState().save.entries).toHaveLength(1)
  })
})

describe('entries', () => {
  it('addEntry assigns an id and ISO timestamps, bumps updatedAt and appends', async () => {
    const { get } = await ready()
    const before = get().save.updatedAt
    const a = get().addEntry(pikachu)
    const b = get().addEntry(eevee)
    expect(a.id).not.toBe(b.id)
    expect(a.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(a.updatedAt).toBe(a.createdAt)
    expect(a).toMatchObject(pikachu)
    expect(get().save.entries).toEqual([a, b])
    expect(get().save.updatedAt > before).toBe(true)
    expect(get().save.updatedAt).toBe(b.createdAt)
  })

  it('addEntry cleans its input and rejects unusable data', async () => {
    const { get } = await ready()
    const messy = { ...pikachu, nickname: '  Sparky ', notes: '', level: 500, bogus: 1 } as EntryInput
    const entry = get().addEntry(messy)
    expect(entry.nickname).toBe('Sparky')
    expect('notes' in entry).toBe(false)
    expect('level' in entry).toBe(false)
    expect('bogus' in entry).toBe(false)
    expect(() => get().addEntry({ ...pikachu, species: 0 })).toThrow('invalid species')
    expect(() => get().addEntry({ ...pikachu, game: '' })).toThrow('invalid game')
    expect(get().save.entries).toHaveLength(1)
  })

  it('does not let the caller pick the id or timestamps', async () => {
    const { get } = await ready()
    const sneaky = { ...pikachu, id: 'mine', createdAt: '1999-01-01T00:00:00.000Z' } as unknown as EntryInput
    const entry = get().addEntry(sneaky)
    expect(entry.id).not.toBe('mine')
    expect(entry.createdAt.startsWith('2026')).toBe(true)
  })

  it('updateEntry patches fields, clears undefined ones and keeps id and createdAt', async () => {
    const { get } = await ready()
    const original = get().addEntry({ ...pikachu, nickname: 'Sparky', level: 5 })
    const untouched = get().addEntry(eevee)
    const updated = get().updateEntry(original.id, { shiny: true, level: 6, nickname: undefined, location: 'Viridian Forest' })!
    expect(updated).toMatchObject({ id: original.id, createdAt: original.createdAt, shiny: true, level: 6, location: 'Viridian Forest' })
    expect('nickname' in updated).toBe(false)
    expect(updated.updatedAt > original.updatedAt).toBe(true)
    expect(get().save.entries).toEqual([updated, untouched])
    expect(get().save.entries[1]).toBe(untouched) // unchanged entries keep their identity
  })

  it('updateEntry ignores attempts to change the id', async () => {
    const { get } = await ready()
    const entry = get().addEntry(pikachu)
    const updated = get().updateEntry(entry.id, { id: 'other', createdAt: 'x' } as never)!
    expect(updated.id).toBe(entry.id)
    expect(updated.createdAt).toBe(entry.createdAt)
  })

  it('updateEntry returns null for an unknown id and throws on invalid results, leaving state alone', async () => {
    const { backend, get } = await ready()
    const entry = get().addEntry(pikachu)
    await get().flush()
    const snapshot = get().save
    expect(get().updateEntry('nope', { shiny: true })).toBeNull()
    expect(() => get().updateEntry(entry.id, { species: -4 })).toThrow('invalid species')
    expect(get().save).toBe(snapshot)
    await vi.advanceTimersByTimeAsync(1000)
    expect(backend.writes).toHaveLength(1)
  })

  it('deleteEntry removes and returns the entry', async () => {
    const { get } = await ready()
    const a = get().addEntry(pikachu)
    const b = get().addEntry(eevee)
    expect(get().deleteEntry(a.id)).toEqual(a)
    expect(get().save.entries).toEqual([b])
    expect(get().deleteEntry(a.id)).toBeNull()
  })

  it('a deleted entry can be restored with mergeEntries', async () => {
    const { get } = await ready()
    const a = get().addEntry(pikachu)
    const removed = get().deleteEntry(a.id)!
    expect(get().mergeEntries([removed])).toEqual({ added: 1, skipped: 0 })
    expect(get().save.entries).toEqual([a])
  })

  it('duplicateEntry copies everything under a new id and timestamp', async () => {
    const { get } = await ready()
    const a = get().addEntry({ ...pikachu, nickname: 'Sparky' })
    const copy = get().duplicateEntry(a.id)!
    expect(copy.id).not.toBe(a.id)
    expect(copy.createdAt > a.createdAt).toBe(true)
    expect({ ...copy, id: '', createdAt: '', updatedAt: '' }).toEqual({ ...a, id: '', createdAt: '', updatedAt: '' })
    expect(get().save.entries).toEqual([a, copy])
    expect(get().duplicateEntry('nope')).toBeNull()
  })

  it('keeps the game-save fingerprint through an edit and a merge, but not on a duplicate', async () => {
    const { get } = await ready()
    const [a] = [get().mergeEntries([{ ...pikachu, id: 'gs-1', fingerprint: '44:0000beef:0000cafe', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }])].map(() => get().save.entries[0]!)
    expect(a.fingerprint).toBe('44:0000beef:0000cafe')
    expect(get().updateEntry(a.id, { nickname: 'Volt' })?.fingerprint).toBe(a.fingerprint)
    expect(get().duplicateEntry(a.id)).not.toHaveProperty('fingerprint')
  })

  it('mergeEntries skips duplicate ids and invalid entries', async () => {
    const { get } = await ready()
    const a = get().addEntry(pikachu)
    const incoming: CatchEntry[] = [
      { ...a, shiny: true }, // same id: skipped, original kept
      { id: 'new-1', species: 1, form: 0, shiny: false, game: 'red', kind: 'gift', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'new-1', species: 2, form: 0, shiny: false, game: 'red', kind: 'evolved', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'bad', species: 0 } as unknown as CatchEntry
    ]
    expect(get().mergeEntries(incoming)).toEqual({ added: 1, skipped: 3 })
    expect(get().save.entries.map((e) => [e.id, e.species, e.shiny])).toEqual([[a.id, 25, false], ['new-1', 1, false]])
  })

  it('mergeEntries with nothing new does not touch the save', async () => {
    const { backend, get } = await ready()
    const a = get().addEntry(pikachu)
    await get().flush()
    const snapshot = get().save
    expect(get().mergeEntries([a])).toEqual({ added: 0, skipped: 1 })
    expect(get().save).toBe(snapshot)
    await vi.advanceTimersByTimeAsync(1000)
    expect(backend.writes).toHaveLength(1)
  })
})

describe('settings, rules and achievements', () => {
  it('setRules merges, and replaces the rules object only when something changed', async () => {
    const { backend, get } = await ready()
    const before = get().save.settings.rules
    get().setRules({ regional: true }) // already true
    expect(get().save.settings.rules).toBe(before)
    expect(get().dirty).toBe(false)
    get().setRules({ mega: true })
    expect(get().save.settings.rules).toEqual({ ...DEFAULT_RULES, mega: true })
    expect(get().save.settings.rules).not.toBe(before)
    await get().flush()
    expect(backend.writes).toHaveLength(1)
  })

  it('setRules ignores keys and values that are not rules', async () => {
    const { get } = await ready()
    get().setRules({ mega: 'yes', bogus: true } as never)
    expect(get().save.settings.rules).toEqual(DEFAULT_RULES)
  })

  it('setSettings changes settings and keeps the rules object when rules are untouched', async () => {
    const { get } = await ready()
    const rules = get().save.settings.rules
    get().setSettings({ theme: 'light', trainerName: '  Ash ' })
    expect(get().save.settings).toEqual({ ...DEFAULT_SETTINGS, theme: 'light', trainerName: 'Ash' })
    expect(get().save.settings.rules).toBe(rules)
    get().setSettings({ reduceMotion: true, rules: { gmax: true } })
    expect(get().save.settings.reduceMotion).toBe(true)
    expect(get().save.settings.rules.gmax).toBe(true)
    expect(get().save.settings.theme).toBe('light')
  })

  it('setSettings rejects invalid values by keeping the old ones', async () => {
    const { get } = await ready()
    get().setSettings({ theme: 'light', trainerName: 'Ash' })
    await get().flush()
    get().setSettings({ theme: 'neon', reduceMotion: 'on', trainerName: 7 } as never)
    expect(get().save.settings).toEqual({ ...DEFAULT_SETTINGS, theme: 'light', trainerName: 'Ash' })
    expect(get().dirty).toBe(false)
  })

  it('unlockAchievements records new ids once and returns them', async () => {
    const { get } = await ready()
    expect(get().unlockAchievements(['first', 'second', 'first'], '2026-02-02T00:00:00.000Z')).toEqual(['first', 'second'])
    expect(get().save.achievements).toEqual({ first: '2026-02-02T00:00:00.000Z', second: '2026-02-02T00:00:00.000Z' })
    const snapshot = get().save
    expect(get().unlockAchievements(['second'])).toEqual([])
    expect(get().save).toBe(snapshot)
    const [third] = get().unlockAchievements(['third', ''])
    expect(third).toBe('third')
    expect(get().save.achievements.second).toBe('2026-02-02T00:00:00.000Z')
    expect(get().save.achievements.third).toBe(get().save.updatedAt)
  })

  it('stores the unlock time canonically and ignores an unusable one', async () => {
    const { get } = await ready()
    get().unlockAchievements(['a'], '2026-02-02T10:00:00+02:00')
    get().unlockAchievements(['b'], 'whenever')
    expect(get().save.achievements.a).toBe('2026-02-02T08:00:00.000Z')
    expect(get().save.achievements.b).toBe(get().save.updatedAt)
  })

  it('treats inherited property names as ordinary achievement ids', async () => {
    const { get } = await ready()
    expect(get().unlockAchievements(['constructor', 'toString'])).toEqual(['constructor', 'toString'])
  })
})

describe('replaceSave and resetAll', () => {
  it('replaceSave swaps in a validated copy and persists it', async () => {
    const { backend, get } = await ready()
    get().addEntry(pikachu)
    const imported = {
      version: SAVE_VERSION,
      entries: [{ id: 'i1', species: 150, form: 0, shiny: false, game: 'red', kind: 'static', createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z' }, { id: 'junk' }],
      settings: { ...DEFAULT_SETTINGS, theme: 'light', rules: { ...DEFAULT_RULES, fusion: true } },
      achievements: { first: '2020-01-02T00:00:00.000Z' },
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-02T00:00:00.000Z'
    } as unknown as SaveFile
    get().replaceSave(imported)
    expect(get().save.entries.map((e) => e.id)).toEqual(['i1'])
    expect(get().save.settings.theme).toBe('light')
    expect(get().save.settings.rules.fusion).toBe(true)
    expect(get().save.createdAt).toBe('2020-01-01T00:00:00.000Z')
    expect(get().save.updatedAt.startsWith('2026')).toBe(true)
    await get().flush()
    expect(backend.current()).toEqual(get().save)
  })

  it('resetAll clears entries, achievements and settings', async () => {
    const { get } = await ready()
    get().addEntry(pikachu)
    get().unlockAchievements(['first'])
    get().setSettings({ theme: 'light', rules: { mega: true } })
    get().resetAll()
    expect(get().save).toMatchObject({ entries: [], achievements: {}, settings: DEFAULT_SETTINGS })
    expect(get().dirty).toBe(true)
  })

  it('resetAll can keep the settings', async () => {
    const { get } = await ready()
    get().addEntry(pikachu)
    get().setSettings({ theme: 'light', rules: { mega: true } })
    const settings = get().save.settings
    get().resetAll({ keepSettings: true })
    expect(get().save.entries).toEqual([])
    expect(get().save.settings).toBe(settings)
  })
})

describe('subscriptions and selectors', () => {
  it('subscribeWithSelector fires only for the selected slice', async () => {
    const { store, get } = await ready()
    const onEntries = vi.fn()
    const onRules = vi.fn()
    store.subscribe((s) => s.save.entries, onEntries)
    store.subscribe((s) => s.save.settings.rules, onRules)
    get().setSettings({ theme: 'light' })
    expect(onEntries).not.toHaveBeenCalled()
    expect(onRules).not.toHaveBeenCalled()
    get().addEntry(pikachu)
    expect(onEntries).toHaveBeenCalledOnce()
    get().setRules({ gmax: true })
    expect(onRules).toHaveBeenCalledOnce()
    expect(onEntries).toHaveBeenCalledOnce()
  })

  it('entries keep their array identity across unrelated changes', async () => {
    const { get } = await ready()
    get().addEntry(pikachu)
    const entries = get().save.entries
    get().setRules({ gmax: true })
    get().unlockAchievements(['first'])
    expect(get().save.entries).toBe(entries)
  })

  it('entriesBySpecies groups once per entries array', async () => {
    const { get } = await ready()
    const a = get().addEntry(pikachu)
    const b = get().addEntry(eevee)
    const c = get().addEntry({ ...pikachu, form: 3 })
    const index = entriesBySpecies(get().save.entries)
    expect(index.get(25)).toEqual([a, c])
    expect(index.get(133)).toEqual([b])
    expect(index.get(1)).toBeUndefined()
    expect(entriesBySpecies(get().save.entries)).toBe(index)
    get().addEntry(eevee)
    expect(entriesBySpecies(get().save.entries)).not.toBe(index)
  })

  it('stores are independent of each other', async () => {
    const one = await ready()
    const two = await ready()
    one.get().addEntry(pikachu)
    expect(two.get().save.entries).toEqual([])
  })
})

describe('flush on unload', () => {
  it('writes pending changes when the page is hidden or unloaded', async () => {
    const listeners = new Map<string, () => void>()
    vi.stubGlobal('window', { addEventListener: (type: string, fn: () => void) => listeners.set(type, fn) })
    try {
      const backend = testBackend()
      const store = createSaveStore({ backend, now: clock() })
      expect([...listeners.keys()].sort()).toEqual(['beforeunload', 'pagehide'])
      await store.getState().hydrate()
      store.getState().addEntry(pikachu)
      listeners.get('pagehide')!()
      expect(backend.writes).toHaveLength(1) // synchronously, inside the event handler
      listeners.get('beforeunload')!()
      expect(backend.writes).toHaveLength(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
