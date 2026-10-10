/**
 * The HOME Dex: which Living Dex slots the user has sent to Pokémon HOME. A slot follows the
 * Living Dex exactly (same rules, same slots, same shiny mode); what is added is one flag per
 * entry, `CatchEntry.inHome`. Pure functions.
 *
 * There is no "cannot be stored in HOME" state: the datasets list the games a form is present in
 * (`FormSummary.present`), and that list never includes Pokémon HOME, so nothing here could say
 * it reliably.
 */

import type { CatchEntry } from '@shared/save-types'
import type { Collection, LivingSlot } from './slots'

/** `home`: an entry that fills the slot is in HOME. `pending`: caught, none sent yet. `missing`: not caught. */
export type HomeState = 'home' | 'pending' | 'missing'

export type HomeFilter = 'all' | HomeState

export interface HomeTotals {
  /** Slots of the Living Dex under the current rules. */
  slots: number
  inHome: number
  /** Caught, not sent yet. */
  pending: number
  missing: number
}

export interface HomeDex {
  /** Only shiny entries count, as in the Shiny Living Dex. */
  shiny: boolean
  /** State of every slot, by slot key. */
  states: ReadonlyMap<string, HomeState>
  /** Keys of the slots in HOME (what the boxes count). */
  inHome: ReadonlySet<string>
  totals: HomeTotals
}

type Slots = Pick<Collection, 'bySlot'>

const NONE: readonly CatchEntry[] = Object.freeze([])

/** The entries that fill a slot, oldest first: all of them, or only the shiny ones in shiny mode. */
export function fillingEntries(collection: Slots, key: string, shiny: boolean): readonly CatchEntry[] {
  const entries = collection.bySlot.get(key) ?? NONE
  return shiny ? entries.filter((entry) => entry.shiny) : entries
}

export function homeState(collection: Slots, key: string, shiny: boolean): HomeState {
  const entries = fillingEntries(collection, key, shiny)
  if (entries.length === 0) return 'missing'
  return entries.some((entry) => entry.inHome === true) ? 'home' : 'pending'
}

/** The state of every slot and the totals, for the current rules and entries. */
export function computeHomeDex(collection: Pick<Collection, 'slots' | 'bySlot'>, shiny: boolean): HomeDex {
  const states = new Map<string, HomeState>()
  const inHome = new Set<string>()
  const totals: HomeTotals = { slots: collection.slots.length, inHome: 0, pending: 0, missing: 0 }
  for (const slot of collection.slots) {
    const state = homeState(collection, slot.key, shiny)
    states.set(slot.key, state)
    if (state === 'home') {
      inHome.add(slot.key)
      totals.inHome++
    } else if (state === 'pending') totals.pending++
    else totals.missing++
  }
  return { shiny, states, inHome, totals }
}

/**
 * The entry the Living Dex shows for a slot (its ball sits on the tile): the newest of the entries
 * that fill it, the later one in the save on a tie. Undefined for a slot that is not caught.
 */
export function shownEntry(collection: Slots, key: string, shiny: boolean): CatchEntry | undefined {
  let newest: CatchEntry | undefined
  for (const entry of fillingEntries(collection, key, shiny)) if (!newest || entry.createdAt >= newest.createdAt) newest = entry
  return newest
}

export type SlotPress =
  /** Exactly one entry fills the slot: a press switches its flag to `on`. */
  | { kind: 'toggle'; entry: CatchEntry; on: boolean }
  /** Not caught, or several entries: the drawer decides. */
  | { kind: 'open' }

/** What a click (or Enter / Space) on a slot of the HOME Dex does. */
export function slotPress(collection: Slots, key: string, shiny: boolean): SlotPress {
  const entries = fillingEntries(collection, key, shiny)
  const only = entries[0]
  if (entries.length !== 1 || !only) return { kind: 'open' }
  return { kind: 'toggle', entry: only, on: only.inHome !== true }
}

/**
 * "Mark box as in HOME": for every caught slot of the box that is not in HOME yet, the entry the
 * Living Dex shows for it. One entry per slot, in slot order; slots already in HOME and slots not
 * caught are left alone.
 */
export function boxMarkTargets(collection: Slots, slots: readonly Pick<LivingSlot, 'key'>[], shiny: boolean): CatchEntry[] {
  const targets: CatchEntry[] = []
  for (const slot of slots) {
    if (homeState(collection, slot.key, shiny) !== 'pending') continue
    const entry = shownEntry(collection, slot.key, shiny)
    if (entry) targets.push(entry)
  }
  return targets
}

/** One line on where a slot stands, as it is announced and shown in the tooltip. */
export function homeStatus(state: HomeState, shiny: boolean): string {
  if (state === 'home') return shiny ? 'Shiny in Pokémon HOME' : 'In Pokémon HOME'
  if (state === 'pending') return shiny ? 'Shiny caught · not sent to HOME yet' : 'Caught · not sent to HOME yet'
  return shiny ? 'No shiny yet' : 'Not caught yet'
}

export const HOME_FILTERS: ReadonlyArray<{ id: HomeFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'home', label: 'In HOME' },
  { id: 'pending', label: 'Not sent yet' },
  { id: 'missing', label: 'Not caught' }
]

/** How many slots a filter shows. */
export function filterCount(totals: HomeTotals, filter: HomeFilter): number {
  return filter === 'all' ? totals.slots : filter === 'home' ? totals.inHome : totals[filter]
}
