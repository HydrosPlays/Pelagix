/**
 * The standard verbs on a logged entry, so every list, card and drawer behaves the same:
 *
 *   editEntry(id)                 opens the entry editor on it
 *   duplicateEntryWithToast(id)   logs a copy and says so (the toast offers "Edit")
 *   deleteEntryWithUndo(id)       deletes it and offers "Undo", which puts the exact entry back
 *   restoreEntry(entry)           what Undo runs; usable on its own
 *   openEntrySpecies(entry)       goes to the Pokédex page of the entry's Pokémon and form
 *   entryMenuItems(entry, opts)   the `Menu` items every entry menu shows
 *
 * plus the wording shared by everything that describes an entry (`entrySummary`,
 * `entryMethodText`, `entryOriginText`). Nothing here throws: a failure becomes an error toast.
 */

import { GAME_BY_ID } from '@shared/games'
import type { CatchEntry } from '@shared/save-types'
import type { MenuItem } from '@renderer/components/ui/Menu'
import { describeEntry } from '@renderer/domain/entries'
import { t } from '@renderer/i18n/runtime'
import { formFullName, gameName, speciesName } from '@renderer/i18n/terms'
import { navigate, paths } from '@renderer/shell/router'
import { useSaveStore, type SaveState } from '@renderer/store/save'
import { useUiStore, type UiState } from '@renderer/store/ui'
import { useDexStore, type Dex } from './data'
import { errorMessage, kindLabel, shownMethod } from './format'

// ---------------------------------------------------------------- wording

/**
 * How the entry was obtained, as one short phrase: the method that was logged ("Tall grass",
 * "5★ Tera Raid"), else the kind ("Gift", "Evolved"). Undefined when neither says anything.
 */
export function entryMethodText(entry: Pick<CatchEntry, 'kind' | 'method'>): string | undefined {
  if (entry.method !== undefined && entry.method.trim() !== '') return shownMethod(entry.method)
  return entry.kind === 'other' ? undefined : kindLabel(entry.kind)
}

/**
 * What the Pokémon was before it became what the entry shows: "Evolved from Pichu" for another
 * species, "Changed from Kyurem" for another form of the same one. Undefined without an origin.
 * `dex` may be null while the data is still loading; the name then falls back to the dex number.
 */
export function entryOriginText(dex: Dex | null, entry: Pick<CatchEntry, 'species' | 'form' | 'origin'>): string | undefined {
  const origin = entry.origin
  if (!origin) return undefined
  const [species, form] = origin
  if (species === entry.species && form === entry.form) return undefined
  const summary = dex?.species(species)
  const formSummary = dex?.form(species, form)
  const name = formSummary ? formFullName(species, formSummary) : summary ? speciesName(summary) : t('lib.entry.unknownPokemon', { number: String(species) })
  return t(species === entry.species ? 'lib.entry.changedFrom' : 'lib.entry.evolvedFrom', { name })
}

/**
 * One line that identifies an entry in toasts, confirmations and accessible names:
 * "Shiny Alolan Raichu · Pokémon Sun", "Sparky (Pikachu) · Pokémon Yellow".
 */
export function entrySummary(dex: Dex | null, entry: CatchEntry): string {
  const name = dex ? describeEntry(dex, entry).name : t('lib.entry.unknownPokemon', { number: String(entry.species) })
  const full = entry.shiny ? t('lib.entry.shinyName', { name }) : name
  const who = entry.nickname !== undefined && entry.nickname !== '' ? t('lib.entry.nicknamed', { nickname: entry.nickname, name: full }) : full
  return t('lib.entry.summary', { who, game: GAME_BY_ID.has(entry.game) ? gameName(entry.game) : t('lib.entry.unknownGame') })
}

// ---------------------------------------------------------------- actions

export interface EntryMenuOptions {
  /** Include "Open Pokédex page". Default true; pass false on the Pokémon's own page. */
  openSpecies?: boolean
  /** Called with the copy after "Duplicate" succeeded (scroll to it, highlight it). */
  onDuplicated?: (copy: CatchEntry) => void
  /** Called with the removed entry after "Delete" succeeded (close a drawer that showed it). */
  onDeleted?: (entry: CatchEntry) => void
}

export interface EntryActions {
  /** Opens the editor on an existing entry. False (and an error toast) when the entry is gone. */
  editEntry(id: string): boolean
  /** Logs a copy under a new id and confirms it with a toast that offers "Edit". Null when it could not. */
  duplicateEntryWithToast(id: string): CatchEntry | null
  /**
   * Deletes the entry and pushes "Entry deleted" with an Undo action. Undo restores the very same
   * entry (same id, same timestamps). Also closes the editor if it was open on that entry.
   * Returns the removed entry, or null when there was nothing to delete.
   */
  deleteEntryWithUndo(id: string): CatchEntry | null
  /** Puts a deleted entry back, unchanged. False when an entry with that id already exists. */
  restoreEntry(entry: CatchEntry): boolean
  /** Navigates to the Pokédex page of the entry's Pokémon, on the form that was caught. */
  openEntrySpecies(entry: Pick<CatchEntry, 'species' | 'form'>): void
  /** Menu items for an entry: Open Pokédex page, Edit, Duplicate, then Delete below a separator. */
  entryMenuItems(entry: CatchEntry, options?: EntryMenuOptions): MenuItem[]
}

/** What the actions work on. The app wires the real stores; tests pass their own. */
export interface EntryActionDeps {
  save: { getState(): Pick<SaveState, 'save' | 'deleteEntry' | 'duplicateEntry' | 'mergeEntries'> }
  ui: { getState(): Pick<UiState, 'push' | 'entryEditor' | 'openEdit' | 'closeEditor' | 'lastCapture' | 'setLastCapture'> }
  /** The loaded dataset, or null: only used to name the Pokémon in toasts. */
  dex: () => Dex | null
  navigate: (to: string) => void
}

export function createEntryActions(overrides: Partial<EntryActionDeps> = {}): EntryActions {
  const deps: EntryActionDeps = { save: useSaveStore, ui: useUiStore, dex: () => useDexStore.getState().dex, navigate, ...overrides }
  const save = (): ReturnType<EntryActionDeps['save']['getState']> => deps.save.getState()
  const ui = (): ReturnType<EntryActionDeps['ui']['getState']> => deps.ui.getState()

  const gone = (): void => void ui().push({ kind: 'error', title: t('lib.actions.gone.title'), body: t('lib.actions.gone.body') })
  const failed = (title: string, err: unknown): void => void ui().push({ kind: 'error', title, body: errorMessage(err) })

  const actions: EntryActions = {
    editEntry(id) {
      if (!save().save.entries.some((e) => e.id === id)) {
        gone()
        return false
      }
      ui().openEdit(id)
      return true
    },

    duplicateEntryWithToast(id) {
      let copy: CatchEntry | null
      try {
        copy = save().duplicateEntry(id)
      } catch (err) {
        failed(t('lib.actions.duplicateFailed'), err)
        return null
      }
      if (!copy) {
        gone()
        return null
      }
      const copyId = copy.id
      ui().push({
        kind: 'success',
        title: t('lib.actions.duplicated'),
        body: entrySummary(deps.dex(), copy),
        icon: 'copy',
        action: { label: t('common.edit'), onSelect: () => void actions.editEntry(copyId) }
      })
      return copy
    },

    deleteEntryWithUndo(id) {
      let removed: CatchEntry | null
      try {
        removed = save().deleteEntry(id)
      } catch (err) {
        failed(t('lib.actions.deleteFailed'), err)
        return null
      }
      if (!removed) {
        gone()
        return null
      }
      const entry = removed
      const editor = ui().entryEditor
      if (editor.open && editor.mode === 'edit' && editor.entryId === id) ui().closeEditor()
      if (ui().lastCapture === id) ui().setLastCapture(null)
      ui().push({
        kind: 'info',
        title: t('lib.actions.deleted'),
        body: entrySummary(deps.dex(), entry),
        icon: 'trash',
        action: { label: t('common.undo'), onSelect: () => void actions.restoreEntry(entry) }
      })
      return entry
    },

    restoreEntry(entry) {
      let added: number
      try {
        added = save().mergeEntries([entry]).added
      } catch (err) {
        failed(t('lib.actions.restoreFailed'), err)
        return false
      }
      if (added === 0) {
        ui().push({ kind: 'info', title: t('lib.actions.nothingToRestore.title'), body: t('lib.actions.nothingToRestore.body') })
        return false
      }
      ui().push({ kind: 'success', title: t('lib.actions.restored'), body: entrySummary(deps.dex(), entry), icon: 'undo' })
      return true
    },

    openEntrySpecies(entry) {
      deps.navigate(paths.species(entry.species, entry.form))
    },

    entryMenuItems(entry, options = {}) {
      const items: MenuItem[] = []
      // A Pokémon this version's data does not know has no Pokédex page to open.
      const dex = deps.dex()
      const hasPage = dex === null || dex.species(entry.species) !== undefined
      if (options.openSpecies !== false && hasPage) items.push({ id: 'open-species', label: t('lib.actions.menu.openSpecies'), icon: 'dex', onSelect: () => actions.openEntrySpecies(entry) })
      items.push(
        { id: 'edit', label: t('common.edit'), icon: 'edit', onSelect: () => void actions.editEntry(entry.id) },
        {
          id: 'duplicate',
          label: t('common.duplicate'),
          icon: 'copy',
          onSelect: () => {
            const copy = actions.duplicateEntryWithToast(entry.id)
            if (copy) options.onDuplicated?.(copy)
          }
        },
        { separator: true, id: 'before-delete' },
        {
          id: 'delete',
          label: t('common.delete'),
          icon: 'trash',
          danger: true,
          onSelect: () => {
            const removed = actions.deleteEntryWithUndo(entry.id)
            if (removed) options.onDeleted?.(removed)
          }
        }
      )
      return items
    }
  }
  return actions
}

/** The app's instance, bound to the real save and UI stores. */
const app = createEntryActions()

export const editEntry: EntryActions['editEntry'] = app.editEntry
export const duplicateEntryWithToast: EntryActions['duplicateEntryWithToast'] = app.duplicateEntryWithToast
export const deleteEntryWithUndo: EntryActions['deleteEntryWithUndo'] = app.deleteEntryWithUndo
export const restoreEntry: EntryActions['restoreEntry'] = app.restoreEntry
export const openEntrySpecies: EntryActions['openEntrySpecies'] = app.openEntrySpecies
export const entryMenuItems: EntryActions['entryMenuItems'] = app.entryMenuItems
