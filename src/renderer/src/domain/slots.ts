/**
 * The Living Dex model: which boxes ("slots") exist under the user's rules, and which slot each
 * logged catch fills. Everything except `useCollection` is a pure function of its arguments.
 *
 * Slot keys
 *   "25"          base form of species 25
 *   "26-1"        form 1 of species 26 (its category is switched on)
 *   "25:m" "25:f" the slot split by gender (rule `genderDiffs`)
 *   "869-3:v2"    one sub-variant of a form (rule `alcremieSweets`)
 *   "25:gmax"     the Gigantamax slot of a form (rule `gmax`)
 */

import { useMemo } from 'react'
import type { FormCategory, FormSummary, SpeciesSummary } from '@shared/dex-types'
import { DEFAULT_RULES, type CatchEntry, type DexRules, type SaveFile } from '@shared/save-types'
import { useDex, type Dex } from '@renderer/lib/data'
import { resolveFormSprite, speciesSpritePath } from '@renderer/lib/sprites'
import { useEntries, useRules } from '@renderer/store/save'

// ---------------------------------------------------------------- types

export interface LivingSlot {
  /** Stable id of the slot under any rule set (see the key table above). */
  key: string
  /** National dex number. */
  species: number
  /** PKHeX form index of the form the slot shows. */
  form: number
  /** `FormVariant.id`, on per-variant slots. */
  variant?: number
  /** The gender this slot is for: one half of a gender split, or the gender the form itself implies. */
  gender?: 'm' | 'f'
  /** This is the Gigantamax slot of the form. */
  gmax?: boolean
  /** Full display name including any gender, variant or Gigantamax marker. */
  label: string
  cat: FormCategory
  /** HOME render path for the slot (see lib/sprites); falls back to the normal render when no shiny one exists. */
  spritePath(shiny: boolean): string
}

/** What an entry needs to carry to land in a slot; handy as an entry-editor preset. */
export interface SlotTarget {
  species: number
  form: number
  variant?: number
  gender?: 'm' | 'f'
  gmax?: boolean
}

export interface CollectionTotals {
  /** Slots in the Living Dex under the current rules. */
  slots: number
  /** Slots with at least one entry. */
  caught: number
  /** Slots with at least one shiny entry. */
  shiny: number
  /** Species in the dataset. */
  species: number
  /** Species with at least one entry of any form. */
  speciesCaught: number
}

export interface Collection {
  rules: DexRules
  /** National dex order, then form order. */
  slots: LivingSlot[]
  /** Entries per slot key, oldest first. Only caught slots have a key. */
  bySlot: Map<string, CatchEntry[]>
  caught: Set<string>
  caughtShiny: Set<string>
  speciesCaught: Set<number>
  speciesShiny: Set<number>
  totals: CollectionTotals
  /** Slot lookup by key. */
  slotByKey: Map<string, LivingSlot>
  /** Slots of each species, in form order. */
  slotsBySpecies: Map<number, LivingSlot[]>
  /** Slot key of every placed entry, by entry id. */
  slotOfEntry: Map<string, string>
  /** Entries whose species the dataset does not know. They fill no slot. */
  unplaced: CatchEntry[]
}

// ---------------------------------------------------------------- rules

export const RULE_KEYS = Object.keys(DEFAULT_RULES) as ReadonlyArray<keyof DexRules>

/** Label and one-line explanation of each rule, for the settings screen. */
export const RULE_INFO: Readonly<Record<keyof DexRules, { label: string; description: string }>> = {
  regional: { label: 'Regional forms', description: 'Alolan, Galarian, Hisuian and Paldean forms get their own slot.' },
  genderForms: { label: 'Gender forms', description: 'Meowstic, Indeedee, Basculegion and Oinkologne ♂ / ♀ are separate slots.' },
  genderDiffs: { label: 'Gender differences', description: 'Separate ♂ and ♀ slots for species whose genders look different.' },
  cosmetic: { label: 'Cosmetic forms', description: 'Unown letters, Vivillon patterns, Alcremie creams and other permanent looks.' },
  changeable: { label: 'Changeable forms', description: 'Forms you can switch freely: Rotom appliances, Arceus plates, Deoxys, Oricorio and more.' },
  fusion: { label: 'Fusions', description: 'Kyurem, Necrozma and Calyrex fusions.' },
  event: { label: 'Event forms', description: 'Distribution-only forms such as cap Pikachu or Poké Ball Vivillon.' },
  partner: { label: 'Partner forms', description: "Let's Go partner Pikachu and Eevee, which never leave their game." },
  alcremieSweets: { label: 'Alcremie sweets', description: 'All 63 cream and sweet combinations instead of the 9 creams.' },
  mega: { label: 'Mega Evolutions', description: 'Mega Evolutions and Primal Reversions (they cannot sit in a box).' },
  battle: { label: 'Battle forms', description: 'Other battle-only states and totems (they cannot sit in a box).' },
  gmax: { label: 'Gigantamax', description: 'An extra slot for every form that can Gigantamax.' }
}

const allRules = (on: boolean): DexRules => Object.fromEntries(RULE_KEYS.map((k) => [k, on])) as unknown as DexRules

export type RulePresetId = 'species' | 'forms' | 'completionist'

export interface RulePreset {
  id: RulePresetId
  label: string
  description: string
  rules: DexRules
}

export const RULE_PRESETS: Readonly<Record<RulePresetId, RulePreset>> = {
  species: {
    id: 'species',
    label: 'Species',
    description: 'One slot per species. Any form of a Pokémon fills it.',
    rules: allRules(false)
  },
  forms: {
    id: 'forms',
    label: 'Forms',
    description: 'Every form you can keep in a box: regional, gender, cosmetic and changeable forms.',
    rules: { ...DEFAULT_RULES }
  },
  completionist: {
    id: 'completionist',
    label: 'Completionist',
    description: 'Everything: event and partner forms, fusions, Mega Evolutions, battle forms, Gigantamax and all 63 Alcremie.',
    rules: allRules(true)
  }
}

/** The preset whose rules equal `rules`, or null for a custom mix. */
export function matchRulePreset(rules: DexRules): RulePresetId | null {
  for (const preset of Object.values(RULE_PRESETS)) {
    if (RULE_KEYS.every((k) => preset.rules[k] === rules[k])) return preset.id
  }
  return null
}

/** The rule that switches a form category on; `true` = always slotted, `false` = never. */
const CATEGORY_RULE: Readonly<Record<FormCategory, keyof DexRules | boolean>> = {
  base: true,
  regional: 'regional',
  gender: 'genderForms',
  cosmetic: 'cosmetic',
  changeable: 'changeable',
  fusion: 'fusion',
  event: 'event',
  partner: 'partner',
  mega: 'mega',
  battle: 'battle',
  hidden: false
}

// ---------------------------------------------------------------- slot layout

const isBase = (species: SpeciesSummary, form: FormSummary): boolean => species.forms[0] === form

/** Whether a form has slots of its own under the rules. The base form always does. */
export function isFormSlotted(species: SpeciesSummary, form: FormSummary, rules: DexRules): boolean {
  if (isBase(species, form)) return true
  if (form.present.length === 0) return false
  const rule = CATEGORY_RULE[form.cat]
  return typeof rule === 'boolean' ? rule : rules[rule]
}

const formKey = (species: SpeciesSummary, form: FormSummary): string => (isBase(species, form) ? String(species.id) : `${species.id}-${form.f}`)

/** The form's slot becomes one slot per variant. */
const splitsByVariant = (form: FormSummary, rules: DexRules): boolean => rules.alcremieSweets && form.variants !== undefined && form.variants.length > 0

/**
 * The form's slot becomes a ♂ and a ♀ slot. Not for species whose genders are already separate
 * forms with their own slots (Meowstic with `genderForms` on): the female would be counted twice.
 */
function splitsByGender(species: SpeciesSummary, form: FormSummary, rules: DexRules): boolean {
  if (!rules.genderDiffs || !species.genderDiff || !form.female || form.cat === 'gender') return false
  if (splitsByVariant(form, rules)) return false
  return !(rules.genderForms && species.forms.some((f) => f.cat === 'gender'))
}

function speciesSlots(species: SpeciesSummary, rules: DexRules): LivingSlot[] {
  const slotted = species.forms.filter((form) => isFormSlotted(species, form, rules))
  // A base slot that stands for the whole species is named and drawn as the species, not as form 0
  // (which for Vivillon would be "Vivillon (Icy Snow)" with the Icy Snow render).
  const lone = slotted.length === 1
  const out: LivingSlot[] = []

  for (const form of slotted) {
    const key = formKey(species, form)
    const generic = lone && isBase(species, form)
    const name = generic ? species.name : form.full
    const make = (suffix: string, label: string, extra: { variant?: number; gender?: 'm' | 'f'; gmax?: boolean; shown?: FormSummary }): void => {
      const shown = extra.shown ?? form
      const gender = extra.gender ?? (generic ? undefined : form.gender)
      const useSpeciesRender = generic && form.sprite !== String(species.id) && extra.variant === undefined && extra.gender === undefined && !extra.gmax
      out.push({
        key: key + suffix,
        species: species.id,
        form: shown.f,
        ...(extra.variant !== undefined && { variant: extra.variant }),
        ...(gender !== undefined && { gender }),
        ...(extra.gmax && { gmax: true }),
        label,
        cat: form.cat,
        spritePath: (shiny) =>
          useSpeciesRender
            ? speciesSpritePath(species, shiny)
            : resolveFormSprite(species, shown, { shiny, female: extra.gender === 'f', variant: extra.variant, gmax: extra.gmax }).path
      })
    }

    if (splitsByVariant(form, rules)) {
      for (const v of form.variants ?? []) make(`:v${v.id}`, `${name} · ${v.name}`, { variant: v.id })
    } else if (splitsByGender(species, form, rules)) {
      for (const gender of ['m', 'f'] as const) {
        // Where the genders are separate forms (Meowstic), each half is the form bound to that gender,
        // whose own name already says which one it is.
        const shown = species.forms.find((f) => f.gender === gender && (f === form || f.cat === 'gender'))
        const label = shown && !generic ? shown.full : `${name} ${gender === 'm' ? '♂' : '♀'}`
        make(`:${gender}`, label, { gender, shown })
      }
    } else {
      make('', name, {})
    }
    if (rules.gmax && form.gmax) make(':gmax', `Gigantamax ${name}`, { gmax: true })
  }
  return out
}

const rulesKey = (rules: DexRules): string => RULE_KEYS.map((k) => (rules[k] ? '1' : '0')).join('')
const slotCache = new WeakMap<Dex, Map<string, LivingSlot[]>>()

/**
 * Every slot of the Living Dex under `rules`, in national dex order and then form order.
 * Memoised per Dex and rule combination: the same array comes back for equal rules.
 */
export function buildSlots(dex: Dex, rules: DexRules): LivingSlot[] {
  let perDex = slotCache.get(dex)
  if (!perDex) slotCache.set(dex, (perDex = new Map()))
  const cacheKey = rulesKey(rules)
  let slots = perDex.get(cacheKey)
  if (!slots) {
    slots = dex.speciesList.flatMap((species) => speciesSlots(species, rules))
    perDex.set(cacheKey, slots)
  }
  return slots
}

/**
 * Key of the most specific slot an entry fills, or null when its species is not in the dataset.
 *
 * - A form without slots of its own under the rules counts toward the species' base form.
 * - A Gigantamax entry fills the form's G-Max slot when there is one, else its normal slot.
 * - On per-variant slots an unknown variant counts as the first one.
 * - On a gender split, the gender the entry's own form implies wins, then the entry's gender;
 *   unknown or genderless goes to ♂.
 */
export function slotKeyFor(entry: Pick<CatchEntry, 'species' | 'form' | 'variant' | 'gender' | 'gmax'>, dex: Dex, rules: DexRules): string | null {
  const species = dex.species(entry.species)
  const base = species?.forms[0]
  if (!species || !base) return null
  const own = dex.form(entry.species, entry.form)
  const form = own && isFormSlotted(species, own, rules) ? own : base
  const key = formKey(species, form)

  if (entry.gmax && rules.gmax && form.gmax) return `${key}:gmax`
  if (splitsByVariant(form, rules)) {
    const variants = form.variants ?? []
    const variant = variants.find((v) => v.id === entry.variant) ?? variants[0]
    if (variant) return `${key}:v${variant.id}`
  }
  if (splitsByGender(species, form, rules)) {
    const gender = own?.gender ?? (entry.gender === 'f' ? 'f' : 'm')
    return `${key}:${gender}`
  }
  return key
}

/** The species, form, variant, gender and Gigantamax state an entry needs to fill `slot`. */
export function slotTarget(slot: LivingSlot): SlotTarget {
  return {
    species: slot.species,
    form: slot.form,
    ...(slot.variant !== undefined && { variant: slot.variant }),
    ...(slot.gender !== undefined && { gender: slot.gender }),
    ...(slot.gmax && { gmax: true })
  }
}

// ---------------------------------------------------------------- collection

interface SlotIndex {
  slotByKey: Map<string, LivingSlot>
  slotsBySpecies: Map<number, LivingSlot[]>
}
const slotIndexes = new WeakMap<LivingSlot[], SlotIndex>()

function indexSlots(slots: LivingSlot[]): SlotIndex {
  let index = slotIndexes.get(slots)
  if (!index) {
    index = { slotByKey: new Map(), slotsBySpecies: new Map() }
    for (const slot of slots) {
      index.slotByKey.set(slot.key, slot)
      const list = index.slotsBySpecies.get(slot.species)
      if (list) list.push(slot)
      else index.slotsBySpecies.set(slot.species, [slot])
    }
    slotIndexes.set(slots, index)
  }
  return index
}

function collect(dex: Dex, entries: readonly CatchEntry[], rules: DexRules): Collection {
  const slots = buildSlots(dex, rules)
  const { slotByKey, slotsBySpecies } = indexSlots(slots)
  const bySlot = new Map<string, CatchEntry[]>()
  const caughtShiny = new Set<string>()
  const speciesCaught = new Set<number>()
  const speciesShiny = new Set<number>()
  const slotOfEntry = new Map<string, string>()
  const unplaced: CatchEntry[] = []

  for (const entry of entries) {
    const key = slotKeyFor(entry, dex, rules)
    if (key === null || !slotByKey.has(key)) {
      unplaced.push(entry)
      continue
    }
    const list = bySlot.get(key)
    if (list) list.push(entry)
    else bySlot.set(key, [entry])
    slotOfEntry.set(entry.id, key)
    speciesCaught.add(entry.species)
    if (entry.shiny) {
      caughtShiny.add(key)
      speciesShiny.add(entry.species)
    }
  }

  const caught = new Set(bySlot.keys())
  return {
    rules,
    slots,
    bySlot,
    caught,
    caughtShiny,
    speciesCaught,
    speciesShiny,
    totals: { slots: slots.length, caught: caught.size, shiny: caughtShiny.size, species: dex.speciesList.length, speciesCaught: speciesCaught.size },
    slotByKey,
    slotsBySpecies,
    slotOfEntry,
    unplaced
  }
}

let lastCollection: { dex: Dex; entries: readonly CatchEntry[]; rules: DexRules; value: Collection } | null = null

/**
 * The collection for a Dex, entry list and rule set. The latest result is cached by argument
 * identity, so every component asking for the current collection shares one computation.
 * Treat the result as read-only.
 */
export function collectionFor(dex: Dex, entries: readonly CatchEntry[], rules: DexRules): Collection {
  const hit = lastCollection
  if (hit && hit.dex === dex && hit.entries === entries && hit.rules === rules) return hit.value
  const value = collect(dex, entries, rules)
  lastCollection = { dex, entries, rules, value }
  return value
}

/**
 * Maps every entry of a save onto the Living Dex defined by the save's rules. A slot is caught
 * when at least one entry maps to it, and shiny-caught when one of those entries is shiny.
 */
export function computeCollection(dex: Dex, save: Pick<SaveFile, 'entries' | 'settings'>): Collection {
  return collectionFor(dex, save.entries, save.settings.rules)
}

/** The current collection. Recomputes only when the entries or the rules change. Needs the Dex to be ready (see `useDex`). */
export function useCollection(): Collection {
  const dex = useDex()
  const entries = useEntries()
  const rules = useRules()
  return useMemo(() => collectionFor(dex, entries, rules), [dex, entries, rules])
}
