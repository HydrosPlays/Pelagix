/**
 * The debut generation of every form, and the Living Dex laid out by it ("origin dex" order):
 * slots by the generation their form was introduced in, then in National order. Pure functions of
 * the datasets; the slot lists they return are cached and registered, so the box and generation
 * helpers of the Living Dex page (features/living/model.ts) can tell such a list from a National one.
 */

import type { FormSummary, SpeciesSummary } from '@shared/dex-types'
import type { Dex } from '@renderer/lib/data'
import type { Collection, LivingSlot } from './slots'

/** How the Living Dex and the HOME Dex lay out their slots outside a game view. */
export type DexOrder = 'national' | 'debut'

/** Gigantamax arrived with Sword and Shield. */
export const GMAX_GENERATION = 8

/**
 * The generation a form debuted in.
 * - The base form (form 0): the species' own generation.
 * - Any other form: the lowest generation among the games that have it (`present`, `obtain`,
 *   `event`). Pokémon GO and HOME (generation 0) do not count. A form no game lists falls back to
 *   the species' generation.
 * - Never earlier than the species' own generation.
 */
export function formDebutGeneration(dex: Pick<Dex, 'gameAt'>, species: SpeciesSummary, form: FormSummary): number {
  if (species.forms[0] === form || form.f === 0) return species.gen
  let lowest = Infinity
  for (const list of [form.present, form.obtain, form.event]) {
    for (const idx of list) {
      const gen = dex.gameAt(idx)?.generation ?? 0
      if (gen > 0 && gen < lowest) lowest = gen
    }
  }
  return Number.isFinite(lowest) ? Math.max(species.gen, lowest) : species.gen
}

/**
 * The debut generation of a slot: that of the form it belongs to (a ♀ half or an Alcremie sweet
 * follows its form), and Generation VIII for a Gigantamax slot. 0 when the species is unknown.
 */
export function slotDebutGeneration(dex: Pick<Dex, 'species' | 'form' | 'gameAt'>, slot: Pick<LivingSlot, 'key' | 'species' | 'gmax'>): number {
  const species = dex.species(slot.species)
  if (!species) return 0
  if (slot.gmax) return Math.max(species.gen, GMAX_GENERATION)
  // The key names the form the slot belongs to: "52", "52-1", "52-1:f", "869-3:v2".
  const own = slot.key.split(':')[0] ?? ''
  const dash = own.indexOf('-')
  const form = dash < 0 ? species.forms[0] : dex.form(species.id, Number(own.slice(dash + 1)))
  return form ? formDebutGeneration(dex, species, form) : species.gen
}

// ---------------------------------------------------------------- the order

/** Debut generation of every slot of a list in debut order, by slot index. */
const debutRegistry = new WeakMap<readonly LivingSlot[], Uint8Array>()
const orderCache = new WeakMap<readonly LivingSlot[], { dex: Dex; slots: LivingSlot[] }>()

/** The debut generations of a list `debutOrder` made, by slot index; undefined for any other list. */
export function debutGenerationsOf(slots: readonly LivingSlot[]): Uint8Array | undefined {
  return debutRegistry.get(slots)
}

/**
 * The slots by debut generation, then in the order they came in (National order: number, form,
 * then the gender and sweet halves). Slots of an unknown species go last. Cached per Dex and list.
 */
export function debutOrder(dex: Dex, slots: readonly LivingSlot[]): LivingSlot[] {
  const hit = orderCache.get(slots)
  if (hit && hit.dex === dex) return hit.slots
  const gens = slots.map((slot) => slotDebutGeneration(dex, slot))
  const rank = (i: number): number => (gens[i] || Number.MAX_SAFE_INTEGER)
  const order = slots.map((_, i) => i).sort((a, b) => rank(a) - rank(b) || (slots[a]?.species ?? 0) - (slots[b]?.species ?? 0) || a - b)
  const ordered = order.map((i) => slots[i] as LivingSlot)
  debutRegistry.set(ordered, Uint8Array.from(order, (i) => gens[i] ?? 0))
  orderCache.set(slots, { dex, slots: ordered })
  return ordered
}

const collectionCache = new WeakMap<Collection, { dex: Dex; value: Collection }>()

/** The collection with its slots in debut order; everything else (what is caught, the totals) is the same. Cached. */
export function inDebutOrder(dex: Dex, collection: Collection): Collection {
  const hit = collectionCache.get(collection)
  if (hit && hit.dex === dex) return hit.value
  const value: Collection = { ...collection, slots: debutOrder(dex, collection.slots) }
  collectionCache.set(collection, { dex, value })
  return value
}

/** The collection a page shows in an order. A game view keeps the game's own Pokédex order. */
export function orderedCollection(dex: Dex, collection: Collection, order: DexOrder, gameView: boolean): Collection {
  return order === 'debut' && !gameView ? inDebutOrder(dex, collection) : collection
}
