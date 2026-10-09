import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CatchEntry } from '@shared/save-types'
import { createSaveStore } from '@renderer/store/save'
import { TOAST_ACTION_MIN_MS, useUiStore, type Toast } from '@renderer/store/ui'
import { createEntryActions, entryMethodText, entryOriginText, entrySummary, type EntryActions } from './entry-actions'
import { createMemoryBackend } from './storage'
import { fixtureDex, ID, makeEntry, makeSave } from './test-fixture'

const ui = useUiStore.getState
const initialUi = useUiStore.getInitialState()

/** A clock that advances one second per reading, so every mutation gets a distinct timestamp. */
function clock(start = Date.UTC(2026, 9, 9, 10, 0, 0)) {
  let t = start
  return () => new Date((t += 1000)).toISOString()
}

interface Harness {
  actions: EntryActions
  entries: () => readonly CatchEntry[]
  navigate: ReturnType<typeof vi.fn<(to: string) => void>>
  toasts: () => readonly Toast[]
  lastToast: () => Toast
}

async function harness(entries: CatchEntry[], options: { hydrate?: boolean; dex?: boolean } = {}): Promise<Harness> {
  const store = createSaveStore({ backend: createMemoryBackend(makeSave(entries)), now: clock(), flushOnUnload: false })
  if (options.hydrate !== false) await store.getState().hydrate()
  const navigate = vi.fn<(to: string) => void>()
  const actions = createEntryActions({ save: store, ui: useUiStore, dex: () => (options.dex === false ? null : fixtureDex), navigate })
  return {
    actions,
    navigate,
    entries: () => store.getState().save.entries,
    toasts: () => ui().toasts,
    lastToast: () => {
      const last = ui().toasts.at(-1)
      if (!last) throw new Error('no toast was pushed')
      return last
    }
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  useUiStore.setState(initialUi, true)
})
afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------- wording

describe('entryMethodText', () => {
  it('prefers the method that was logged', () => {
    expect(entryMethodText({ kind: 'wild', method: 'Tall grass' })).toBe('Tall grass')
    expect(entryMethodText({ kind: 'tera', method: '5★ Tera Raid' })).toBe('5★ Tera Raid')
  })

  it('falls back to the kind, and to nothing for a bare "other"', () => {
    expect(entryMethodText({ kind: 'gift' })).toBe('Gift')
    expect(entryMethodText({ kind: 'evolved' })).toBe('Evolved')
    expect(entryMethodText({ kind: 'transfer', method: '   ' })).toBe('Transferred')
    expect(entryMethodText({ kind: 'other' })).toBeUndefined()
    expect(entryMethodText({ kind: 'other', method: 'Wonder Trade' })).toBe('Wonder Trade')
  })
})

describe('entryOriginText', () => {
  it('names the species it evolved from', () => {
    expect(entryOriginText(fixtureDex, { species: ID.pikachu, form: 0, origin: [ID.pichu, 0] })).toBe('Evolved from Pichu')
    expect(entryOriginText(fixtureDex, { species: ID.raichu, form: 1, origin: [ID.pikachu, 0] })).toBe('Evolved from Pikachu')
  })

  it('says "Changed from" for another form of the same species', () => {
    expect(entryOriginText(fixtureDex, { species: ID.kyurem, form: 2, origin: [ID.kyurem, 0] })).toBe('Changed from Kyurem')
    expect(entryOriginText(fixtureDex, { species: ID.raichu, form: 0, origin: [ID.raichu, 1] })).toBe('Changed from Alolan Raichu')
  })

  it('is undefined without an origin or when the origin is the entry itself', () => {
    expect(entryOriginText(fixtureDex, { species: ID.pikachu, form: 0 })).toBeUndefined()
    expect(entryOriginText(fixtureDex, { species: ID.pikachu, form: 0, origin: [ID.pikachu, 0] })).toBeUndefined()
  })

  it('falls back to the dex number for unknown Pokémon and while the data is loading', () => {
    expect(entryOriginText(fixtureDex, { species: ID.pikachu, form: 0, origin: [9999, 0] })).toBe('Evolved from Pokémon #9999')
    expect(entryOriginText(null, { species: ID.pikachu, form: 0, origin: [ID.pichu, 0] })).toBe('Evolved from Pokémon #172')
    // An unknown form of a known species still gets the species name.
    expect(entryOriginText(fixtureDex, { species: ID.pikachu, form: 0, origin: [ID.pichu, 200] })).toBe('Evolved from Pichu')
  })
})

describe('entrySummary', () => {
  it('names the Pokémon with its form and the game', () => {
    expect(entrySummary(fixtureDex, makeEntry(ID.pikachu, 0, { game: 'yellow' }))).toBe('Pikachu · Pokémon Yellow')
    expect(entrySummary(fixtureDex, makeEntry(ID.raichu, 1, { game: 'sun' }))).toBe('Alolan Raichu · Pokémon Sun')
  })

  it('marks shinies and puts a nickname first', () => {
    expect(entrySummary(fixtureDex, makeEntry(ID.raichu, 1, { game: 'sun', shiny: true }))).toBe('Shiny Alolan Raichu · Pokémon Sun')
    expect(entrySummary(fixtureDex, makeEntry(ID.pikachu, 0, { nickname: 'Sparky' }))).toBe('Sparky (Pikachu) · Pokémon Scarlet')
    expect(entrySummary(fixtureDex, makeEntry(ID.pikachu, 0, { nickname: 'Sparky', shiny: true }))).toBe('Sparky (Shiny Pikachu) · Pokémon Scarlet')
  })

  it('never prints an internal id: unknown games, unknown species, no data yet', () => {
    expect(entrySummary(fixtureDex, makeEntry(ID.pikachu, 0, { game: 'future-game' }))).toBe('Pikachu · Unknown game')
    expect(entrySummary(fixtureDex, makeEntry(9999))).toBe('Pokémon #9999 · Pokémon Scarlet')
    expect(entrySummary(null, makeEntry(ID.pikachu, 0, { shiny: true }))).toBe('Shiny Pokémon #25 · Pokémon Scarlet')
  })
})

// ---------------------------------------------------------------- menu

describe('entryMenuItems', () => {
  const describeItems = (items: ReturnType<EntryActions['entryMenuItems']>): string[] =>
    items.map((item) => ('separator' in item ? '---' : 'heading' in item ? `# ${item.heading}` : `${item.id}:${item.label}${item.danger ? ':danger' : ''}`))

  it('lists Open Pokédex page, Edit, Duplicate, then Delete below a separator', async () => {
    const entry = makeEntry(ID.raichu, 1)
    const { actions } = await harness([entry])
    const items = actions.entryMenuItems(entry)
    expect(describeItems(items)).toEqual(['open-species:Open Pokédex page', 'edit:Edit', 'duplicate:Duplicate', '---', 'delete:Delete:danger'])
    for (const item of items) if ('label' in item) expect(item.icon, item.id).toBeTypeOf('string')
    const ids = items.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('leaves out the Pokédex item on request', async () => {
    const entry = makeEntry(ID.pikachu)
    const { actions } = await harness([entry])
    expect(describeItems(actions.entryMenuItems(entry, { openSpecies: false }))).toEqual(['edit:Edit', 'duplicate:Duplicate', '---', 'delete:Delete:danger'])
  })

  it('leaves out the Pokédex item for a Pokémon the data does not know', async () => {
    const entry = makeEntry(1400)
    const { actions } = await harness([entry])
    expect(describeItems(actions.entryMenuItems(entry))).toEqual(['edit:Edit', 'duplicate:Duplicate', '---', 'delete:Delete:danger'])
    // Without a dataset there is nothing to check against, so the item stays.
    const blind = await harness([entry], { dex: false })
    expect(describeItems(blind.actions.entryMenuItems(entry))[0]).toBe('open-species:Open Pokédex page')
  })

  const select = (items: ReturnType<EntryActions['entryMenuItems']>, id: string): void => {
    const item = items.find((i) => 'label' in i && i.id === id)
    if (!item || !('onSelect' in item)) throw new Error(`no menu item "${id}"`)
    item.onSelect()
  }

  it('opens the Pokédex page on the form that was caught', async () => {
    const alolan = makeEntry(ID.raichu, 1)
    const base = makeEntry(ID.pikachu, 0)
    const { actions, navigate } = await harness([alolan, base])
    select(actions.entryMenuItems(alolan), 'open-species')
    select(actions.entryMenuItems(base), 'open-species')
    expect(navigate.mock.calls).toEqual([['/dex/26?form=1'], ['/dex/25']])
  })

  it('Edit opens the editor on the entry', async () => {
    const entry = makeEntry(ID.pikachu)
    const { actions } = await harness([entry])
    select(actions.entryMenuItems(entry), 'edit')
    expect(ui().entryEditor).toEqual({ open: true, mode: 'edit', entryId: entry.id })
  })

  it('Duplicate and Delete run the standard actions and report back', async () => {
    const entry = makeEntry(ID.pikachu)
    const { actions, entries } = await harness([entry])
    const onDuplicated = vi.fn()
    const onDeleted = vi.fn()
    const items = actions.entryMenuItems(entry, { onDuplicated, onDeleted })

    select(items, 'duplicate')
    expect(entries()).toHaveLength(2)
    expect(onDuplicated).toHaveBeenCalledExactlyOnceWith(entries()[1])

    select(items, 'delete')
    expect(entries().map((e) => e.id)).toEqual([entries()[0]?.id])
    expect(entries()[0]?.id).not.toBe(entry.id)
    expect(onDeleted).toHaveBeenCalledExactlyOnceWith(entry)

    // The entry is gone now: neither callback fires again.
    select(items, 'delete')
    select(items, 'duplicate')
    expect(onDeleted).toHaveBeenCalledTimes(1)
    expect(onDuplicated).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------- actions

describe('editEntry', () => {
  it('opens the editor and closes the command palette', async () => {
    const entry = makeEntry(ID.eevee)
    const { actions, toasts } = await harness([entry])
    ui().setCommandPalette(true)
    expect(actions.editEntry(entry.id)).toBe(true)
    expect(ui().entryEditor).toEqual({ open: true, mode: 'edit', entryId: entry.id })
    expect(ui().commandPalette).toBe(false)
    expect(toasts()).toEqual([])
  })

  it('says so when the entry is gone instead of opening an empty editor', async () => {
    const { actions, lastToast } = await harness([makeEntry(ID.eevee)])
    expect(actions.editEntry('missing')).toBe(false)
    expect(ui().entryEditor).toEqual({ open: false })
    expect(lastToast()).toMatchObject({ kind: 'error', title: 'That entry no longer exists' })
  })
})

describe('duplicateEntryWithToast', () => {
  it('logs a copy under a new id and confirms it', async () => {
    const entry = makeEntry(ID.raichu, 1, { game: 'sun', shiny: true, ball: 4, location: 'Route 1', notes: 'First try' })
    const { actions, entries, lastToast } = await harness([entry])
    const copy = actions.duplicateEntryWithToast(entry.id)
    expect(copy).not.toBeNull()
    expect(entries()).toEqual([entry, copy])
    expect(copy).toMatchObject({ species: ID.raichu, form: 1, game: 'sun', shiny: true, ball: 4, location: 'Route 1', notes: 'First try' })
    expect(copy?.id).not.toBe(entry.id)
    expect(copy?.createdAt).not.toBe(entry.createdAt)
    expect(lastToast()).toMatchObject({ kind: 'success', title: 'Entry duplicated', body: 'Shiny Alolan Raichu · Pokémon Sun', action: { label: 'Edit' } })
  })

  it('its toast action opens the editor on the copy', async () => {
    const entry = makeEntry(ID.pikachu)
    const { actions, lastToast } = await harness([entry])
    const copy = actions.duplicateEntryWithToast(entry.id)
    expect(ui().runToastAction(lastToast().id)).toBe(true)
    expect(ui().entryEditor).toEqual({ open: true, mode: 'edit', entryId: copy?.id })
  })

  it('returns null with an error toast for an unknown id', async () => {
    const { actions, entries, lastToast } = await harness([makeEntry(ID.pikachu)])
    expect(actions.duplicateEntryWithToast('missing')).toBeNull()
    expect(entries()).toHaveLength(1)
    expect(lastToast()).toMatchObject({ kind: 'error', title: 'That entry no longer exists' })
  })
})

describe('deleteEntryWithUndo', () => {
  const full = (): CatchEntry =>
    makeEntry(ID.raichu, 1, {
      game: 'ultrasun',
      kind: 'evolved',
      method: 'Use Thunder Stone',
      origin: [ID.pikachu, 0],
      gender: 'f',
      shiny: true,
      ball: 26,
      level: 37,
      date: '2026-03-14',
      location: 'Hau’oli City',
      nickname: 'Surfer',
      ot: 'Hydro',
      notes: 'Evolved on the beach.',
      updatedAt: '2026-04-01T08:30:00.000Z'
    })

  it('deletes the entry and offers Undo', async () => {
    const keep = makeEntry(ID.pikachu)
    const entry = full()
    const { actions, entries, toasts, lastToast } = await harness([keep, entry])
    expect(actions.deleteEntryWithUndo(entry.id)).toEqual(entry)
    expect(entries()).toEqual([keep])
    expect(toasts()).toHaveLength(1)
    expect(lastToast()).toMatchObject({
      kind: 'info',
      title: 'Entry deleted',
      body: 'Surfer (Shiny Alolan Raichu) · Pokémon Ultra Sun',
      action: { label: 'Undo' },
      durationMs: TOAST_ACTION_MIN_MS
    })
  })

  it('Undo restores the exact entry: same id, same fields, same timestamps', async () => {
    const keep = makeEntry(ID.pikachu)
    const entry = full()
    const { actions, entries, lastToast } = await harness([entry, keep])
    actions.deleteEntryWithUndo(entry.id)
    const deleted = lastToast()

    expect(ui().runToastAction(deleted.id)).toBe(true)
    const restored = entries().find((e) => e.id === entry.id)
    expect(restored).toEqual(entry)
    expect(restored?.createdAt).toBe(entry.createdAt)
    expect(restored?.updatedAt).toBe('2026-04-01T08:30:00.000Z')
    expect(entries()).toHaveLength(2)
    expect(lastToast()).toMatchObject({ kind: 'success', title: 'Entry restored', body: 'Surfer (Shiny Alolan Raichu) · Pokémon Ultra Sun' })

    // Undo cannot run twice.
    expect(ui().runToastAction(deleted.id)).toBe(false)
    expect(entries()).toHaveLength(2)
  })

  it('can be undone after other changes, and restoring twice adds nothing', async () => {
    const a = makeEntry(ID.pikachu)
    const b = makeEntry(ID.eevee)
    const { actions, entries, lastToast } = await harness([a, b])
    const removedA = actions.deleteEntryWithUndo(a.id)
    const removedB = actions.deleteEntryWithUndo(b.id)
    expect(entries()).toEqual([])

    expect(actions.restoreEntry(removedA!)).toBe(true)
    expect(actions.restoreEntry(removedB!)).toBe(true)
    expect([...entries()].sort((x, y) => (x.createdAt < y.createdAt ? -1 : 1))).toEqual([a, b])

    expect(actions.restoreEntry(removedA!)).toBe(false)
    expect(entries()).toHaveLength(2)
    expect(lastToast()).toMatchObject({ kind: 'info', title: 'Nothing to restore' })
  })

  it('closes the editor when it was open on the deleted entry, and only then', async () => {
    const a = makeEntry(ID.pikachu)
    const b = makeEntry(ID.eevee)
    const { actions } = await harness([a, b])
    ui().openEdit(a.id)
    actions.deleteEntryWithUndo(b.id)
    expect(ui().entryEditor).toEqual({ open: true, mode: 'edit', entryId: a.id })
    actions.deleteEntryWithUndo(a.id)
    expect(ui().entryEditor).toEqual({ open: false })
  })

  it('leaves a "log a catch" editor alone and forgets a pending celebration of the deleted entry', async () => {
    const a = makeEntry(ID.pikachu)
    const b = makeEntry(ID.eevee)
    const { actions } = await harness([a, b])
    ui().openCreate({ species: ID.pikachu, form: 0 })
    ui().setLastCapture(b.id)
    actions.deleteEntryWithUndo(a.id)
    expect(ui().entryEditor).toMatchObject({ open: true, mode: 'create' })
    expect(ui().lastCapture).toBe(b.id)
    actions.deleteEntryWithUndo(b.id)
    expect(ui().lastCapture).toBeNull()
  })

  it('returns null with an error toast for an unknown id', async () => {
    const { actions, entries, lastToast } = await harness([makeEntry(ID.pikachu)])
    expect(actions.deleteEntryWithUndo('missing')).toBeNull()
    expect(entries()).toHaveLength(1)
    expect(lastToast()).toMatchObject({ kind: 'error', title: 'That entry no longer exists' })
    expect(lastToast().action).toBeUndefined()
  })

  it('names the Pokémon by number while the data is not loaded', async () => {
    const entry = makeEntry(ID.pikachu, 0, { game: 'future-game' })
    const { actions, lastToast } = await harness([entry], { dex: false })
    actions.deleteEntryWithUndo(entry.id)
    expect(lastToast().body).toBe('Pokémon #25 · Unknown game')
  })
})

describe('before the save is loaded', () => {
  it('turns every failure into an error toast instead of throwing', async () => {
    const entry = makeEntry(ID.pikachu)
    const { actions, toasts } = await harness([entry], { hydrate: false })
    expect(actions.deleteEntryWithUndo(entry.id)).toBeNull()
    expect(actions.duplicateEntryWithToast(entry.id)).toBeNull()
    expect(actions.restoreEntry(entry)).toBe(false)
    expect(actions.editEntry(entry.id)).toBe(false)
    expect(toasts().map((t) => `${t.kind}:${t.title}`)).toEqual([
      'error:The entry could not be deleted',
      'error:The entry could not be duplicated',
      'error:The entry could not be restored',
      'error:That entry no longer exists'
    ])
    expect(toasts().every((t) => typeof t.body === 'string' && t.body.length > 0)).toBe(true)
  })
})
