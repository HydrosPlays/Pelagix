/**
 * View state of the Pokédex browser. It lives outside the page component so that the search, the
 * filters, the sort, the display mode and the scroll position are all still there when the user
 * comes back from a species page. Display mode and sort are also remembered between sessions;
 * filters deliberately are not (a fresh start shows the whole Pokédex).
 */

import { create } from 'zustand'
import type { SpeciesTag, TypeId } from '@shared/dex-types'
import { DEX_DISPLAYS, DEX_SORTS, NO_FILTERS, SPECIES_TAGS, toggled, type DexDisplay, type DexFilters, type DexLinkState, type DexSort } from './dex-query'

export const DEX_STORAGE_KEY = 'pelagix.dex.v1'

interface StoredPrefs {
  display: DexDisplay
  sort: DexSort
}

const DEFAULT_PREFS: StoredPrefs = { display: 'species', sort: 'number' }

function readPrefs(): StoredPrefs {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_PREFS
    const raw = JSON.parse(localStorage.getItem(DEX_STORAGE_KEY) ?? 'null') as Partial<StoredPrefs> | null
    return {
      display: DEX_DISPLAYS.find((d) => d === raw?.display) ?? DEFAULT_PREFS.display,
      sort: DEX_SORTS.find((s) => s === raw?.sort) ?? DEFAULT_PREFS.sort
    }
  } catch {
    return DEFAULT_PREFS
  }
}

function writePrefs(prefs: StoredPrefs): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(DEX_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // A convenience only: a full or blocked storage is not worth an error.
  }
}

export interface DexBrowserState {
  /** Search box content, as typed. */
  text: string
  filters: DexFilters
  display: DexDisplay
  sort: DexSort

  setText(text: string): void
  setFilters(patch: Partial<DexFilters>): void
  /** Adds or removes one value of a multi-choice filter. `order` is the display order to keep the list in. */
  toggleGen(gen: number): void
  toggleType(type: TypeId, order: readonly TypeId[]): void
  toggleTag(tag: SpeciesTag): void
  /** Replaces the search text and the filters in one step (chip removal). */
  setQuery(next: { text: string; filters: DexFilters }): void
  setDisplay(display: DexDisplay): void
  setSort(sort: DexSort): void
  /** Clears the search text and every filter; display and sort stay. */
  clearAll(): void
  /** Applies a link into the browser: anything the link does not mention goes back to its default. */
  applyLink(link: DexLinkState): void
}

export const useDexBrowser = create<DexBrowserState>()((set, get) => {
  const prefs = readPrefs()
  return {
    text: '',
    filters: NO_FILTERS,
    display: prefs.display,
    sort: prefs.sort,

    setText(text) {
      if (get().text !== text) set({ text })
    },
    setFilters(patch) {
      set((s) => ({ filters: { ...s.filters, ...patch } }))
    },
    toggleGen(gen) {
      set((s) => ({ filters: { ...s.filters, gens: toggled(s.filters.gens, gen).sort((a, b) => a - b) } }))
    },
    toggleType(type, order) {
      set((s) => ({ filters: { ...s.filters, types: toggled(s.filters.types, type, order) } }))
    },
    toggleTag(tag) {
      set((s) => ({ filters: { ...s.filters, tags: toggled(s.filters.tags, tag, SPECIES_TAGS) } }))
    },
    setQuery(next) {
      set({ text: next.text, filters: next.filters })
    },
    setDisplay(display) {
      if (get().display === display) return
      set({ display })
      writePrefs({ display, sort: get().sort })
    },
    setSort(sort) {
      if (get().sort === sort) return
      set({ sort })
      writePrefs({ display: get().display, sort })
    },
    clearAll() {
      set({ text: '', filters: NO_FILTERS })
    },
    applyLink(link) {
      set((s) => ({
        text: link.text ?? '',
        filters: { ...NO_FILTERS, ...link.filters },
        display: link.display ?? s.display,
        sort: link.sort ?? s.sort
      }))
    }
  }
})

/**
 * Where the grid was when the user left it. Plain mutable memory rather than store state: nothing
 * renders from it, and it changes on every scroll event.
 */
export const dexMemory = {
  /** `viewKeyOf` of the list the scroll position belongs to. */
  viewKey: '',
  scrollTop: 0,
  /** Key of the tile that was opened; focus goes back to it once, on return. */
  focusKey: null as string | null
}

export function rememberScroll(viewKey: string, scrollTop: number): void {
  dexMemory.viewKey = viewKey
  dexMemory.scrollTop = scrollTop
}

/** Returns the tile to give focus back to, and forgets it. */
export function takeFocusKey(): string | null {
  const key = dexMemory.focusKey
  dexMemory.focusKey = null
  return key
}
