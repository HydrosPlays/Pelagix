/**
 * Sets of Pokémon derived from the dataset: by generation, type and tag, form collections, gender
 * pairs, Gigantamax and Mega forms. Built once per `Dex` and shared by every evaluation.
 */

import type { FormCategory, FormSummary, RegionalVariant, SpeciesSummary, SpeciesTag, TypeId } from '@shared/dex-types'
import { t } from '@renderer/i18n/runtime'
import { formFullName, formLabel, speciesName, variantName } from '@renderer/i18n/terms'
import type { Dex } from '@renderer/lib/data'
import { ALCREMIE, EEVEE, FORM_SETS } from './groups'
import type { SetItem } from './types'

export interface DexFacts {
  /** Every species, in national dex order. */
  all: readonly SetItem[]
  byGeneration: ReadonlyMap<number, readonly SetItem[]>
  /** By the types of the species' base form. */
  byType: ReadonlyMap<TypeId, readonly SetItem[]>
  byTag: ReadonlyMap<SpeciesTag, readonly SetItem[]>
  /** The three first partner Pokémon of each generation (the first stage of every starter line). */
  startersByGeneration: ReadonlyMap<number, readonly SetItem[]>
  /** All first partner Pokémon, first stages only. */
  starters: readonly SetItem[]
  /** Eevee and its evolutions. */
  eeveelutions: readonly SetItem[]
  /** Regional forms per region. */
  regional: ReadonlyMap<RegionalVariant, readonly SetItem[]>
  /** Form collections of groups.ts, by key. */
  formSets: ReadonlyMap<string, readonly SetItem[]>
  /** Every cream and sweet combination of Alcremie. */
  alcremie: readonly SetItem[]
  /** Species whose males and females look different, including those where the gender is a form. */
  genderPairs: readonly SetItem[]
  /** One item per distinct Gigantamax look. */
  gmax: readonly SetItem[]
  /** Mega Evolutions and Primal Reversions. */
  megas: readonly SetItem[]
  /** Evolution families with at least two members: family id -> national dex numbers. */
  families: ReadonlyMap<number, readonly number[]>
  /** Lower-cased species name -> national dex number. */
  speciesByName: ReadonlyMap<string, number>
  /** Looks up a species list by national dex numbers, skipping numbers the dataset does not have. */
  pick(ids: readonly number[]): readonly SetItem[]
}

const cache = new WeakMap<Dex, DexFacts>()

// Labels are getters: the facts are kept for as long as the Dex is, and the language can change meanwhile.
const speciesItem = (s: SpeciesSummary): SetItem => ({
  species: s.id,
  get label() {
    return speciesName(s)
  }
})
const formItem = (s: SpeciesSummary, f: FormSummary): SetItem => ({
  species: s.id,
  form: f.f,
  get label() {
    return formFullName(s, f)
  }
})

function push<K>(map: Map<K, SetItem[]>, key: K, item: SetItem): void {
  const list = map.get(key)
  if (list) list.push(item)
  else map.set(key, [item])
}

/** Forms of a species that exist somewhere and belong to one of the categories. */
function formsOf(species: SpeciesSummary, cats: readonly FormCategory[]): FormSummary[] {
  return species.forms.filter((f) => cats.includes(f.cat) && (f === species.forms[0] || f.present.length > 0))
}

export function dexFacts(dex: Dex): DexFacts {
  const hit = cache.get(dex)
  if (hit) return hit

  const all: SetItem[] = []
  const byGeneration = new Map<number, SetItem[]>()
  const byType = new Map<TypeId, SetItem[]>()
  const byTag = new Map<SpeciesTag, SetItem[]>()
  const regional = new Map<RegionalVariant, SetItem[]>()
  const genderPairs: SetItem[] = []
  const gmax: SetItem[] = []
  const megas: SetItem[] = []
  const families = new Map<number, number[]>()
  const speciesByName = new Map<string, number>()
  const seenGmax = new Set<string>()
  const itemById = new Map<number, SetItem>()

  for (const species of dex.speciesList) {
    const item = speciesItem(species)
    itemById.set(species.id, item)
    all.push(item)
    push(byGeneration, species.gen, item)
    for (const type of species.forms[0]?.types ?? []) push(byType, type, item)
    for (const tag of species.tags) push(byTag, tag, item)
    speciesByName.set(species.name.trim().toLowerCase(), species.id)

    const family = families.get(species.family)
    if (family) family.push(species.id)
    else families.set(species.family, [species.id])

    if (species.genderDiff || species.forms.some((f) => f.cat === 'gender')) {
      genderPairs.push({
        species: species.id,
        genders: true,
        get label() {
          return t('achievements.item.genders', { name: speciesName(species) })
        }
      })
    }

    for (const form of species.forms) {
      if (form.cat === 'regional' && form.region !== undefined && form.present.length > 0) push(regional, form.region, formItem(species, form))
      if (form.cat === 'mega' && form.present.length > 0) megas.push(formItem(species, form))
      if (form.gmax !== undefined && form.cat !== 'hidden' && !seenGmax.has(form.gmax)) {
        seenGmax.add(form.gmax)
        // Alcremie's creams share one Gigantamax look, so it is named after the species.
        const shared = species.forms.filter((f) => f.gmax === form.gmax).length > 1
        gmax.push({
          species: species.id,
          form: form.f,
          gmax: true,
          get label() {
            return t('achievements.item.gmax', { name: shared ? speciesName(species) : formFullName(species, form) })
          }
        })
      }
    }
  }

  for (const [id, members] of [...families]) if (members.length < 2) families.delete(id)

  const pick = (ids: readonly number[]): SetItem[] => ids.map((id) => itemById.get(id)).filter((item): item is SetItem => item !== undefined)

  // The first stage of a starter line is the lowest-numbered tagged member of its family.
  const startersByGeneration = new Map<number, SetItem[]>()
  const starters: SetItem[] = []
  const starterFamilies = new Set<number>()
  for (const species of dex.speciesList) {
    if (!species.tags.includes('starter') || starterFamilies.has(species.family)) continue
    starterFamilies.add(species.family)
    const item = itemById.get(species.id)
    if (!item) continue
    starters.push(item)
    push(startersByGeneration, species.gen, item)
  }

  const eevee = dex.species(EEVEE)
  const eeveelutions = eevee ? dex.familyMembers(eevee.family).map((s) => itemById.get(s.id)).filter((item): item is SetItem => item !== undefined) : []

  const formSets = new Map<string, SetItem[]>()
  for (const spec of FORM_SETS) {
    const items: SetItem[] = []
    for (const id of spec.species) {
      const species = dex.species(id)
      if (species) for (const form of formsOf(species, spec.cats)) items.push(formItem(species, form))
    }
    formSets.set(spec.key, items)
  }

  const alcremie: SetItem[] = []
  const alcremieSpecies = dex.species(ALCREMIE)
  if (alcremieSpecies) {
    for (const form of formsOf(alcremieSpecies, ['base', 'cosmetic'])) {
      for (const variant of form.variants ?? []) {
        // The base form's own name is just "Alcremie"; its cream is only in the form label.
        const base = form === alcremieSpecies.forms[0] && form.name !== ''
        alcremie.push({
          species: alcremieSpecies.id,
          form: form.f,
          variant: variant.id,
          get label() {
            const cream = base ? t('achievements.item.cream', { cream: formLabel(alcremieSpecies, form), species: speciesName(alcremieSpecies) }) : formFullName(alcremieSpecies, form)
            return t('achievements.item.sweet', { form: cream, sweet: variantName(alcremieSpecies, form, variant.id) ?? variant.name })
          }
        })
      }
    }
  }

  const facts: DexFacts = {
    all,
    byGeneration,
    byType,
    byTag,
    startersByGeneration,
    starters,
    eeveelutions,
    regional,
    formSets,
    alcremie,
    genderPairs,
    gmax,
    megas,
    families,
    speciesByName,
    pick
  }
  cache.set(dex, facts)
  return facts
}
