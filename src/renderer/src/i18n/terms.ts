/**
 * Pokémon terms in the active language: the names the games themselves use for species, forms,
 * types, abilities, balls, games, places and methods.
 *
 * Screens call these instead of reading the English names straight off the datasets. Each one
 * falls back to the English text, so a language with no data (or a term with no translation)
 * reads exactly as before. The save keeps storing the English labels and the user's own text:
 * translation happens here, when something is shown, and nowhere else.
 *
 * Like `t()`, call them when the text is needed, never at module top level.
 */

import { abilityName as englishAbilityName } from '@shared/abilities'
import { BALL_BY_ID } from '@shared/balls'
import type { TypeId } from '@shared/dex-types'
import { GAME_BY_ID, GAMES } from '@shared/games'
import { DEFAULT_LANGUAGE, type LanguageId } from '@shared/languages'
import { useDexStore } from '@renderer/lib/data'
import dataMessages from './en/data'
import { activeLanguage, fillPlaceholders, languageChanged, messageText, t, type MessageKey } from './runtime'

// ================================================================ localised data plugs in here

/**
 * The terms of one language. Every part is optional and may be partial: what is missing reads
 * in English. Species, abilities and balls are keyed by their PKHeX id, games by `GameDef.id`.
 */
export interface TermData {
  /** National dex number -> species name. */
  species?: Readonly<Record<number, string>>
  /** National dex number -> genus ("Seed Pokémon"). */
  genus?: Readonly<Record<number, string>>
  /** `formKey(species, form)` -> `FormSummary.name` ("Alolan Form"). */
  forms?: Readonly<Record<string, string>>
  /** `formKey(species, form)` -> `FormSummary.full` ("Alolan Raichu"). */
  formFull?: Readonly<Record<string, string>>
  /** `variantKey(species, form, variantId)` -> `FormVariant.name`. */
  variants?: Readonly<Record<string, string>>
  types?: Readonly<Partial<Record<TypeId, string>>>
  /** PKHeX ability id -> name. */
  abilities?: Readonly<Record<number, string>>
  /** PKHeX ball id -> name. */
  balls?: Readonly<Record<number, string>>
  /** `GameDef.id` -> `GameDef.name`. */
  games?: Readonly<Record<string, string>>
  /** `GameDef.id` -> `GameDef.short`. */
  gameShort?: Readonly<Record<string, string>>
  /** `GameDef.group` -> `GameDef.groupName`. */
  gameGroups?: Readonly<Record<string, string>>
  /** National dex number -> Pokédex entry text. */
  flavor?: Readonly<Record<number, string>>
  /** The four below: the English text the datasets carry -> the same in this language. */
  locations?: Readonly<Record<string, string>>
  methods?: Readonly<Record<string, string>>
  conditions?: Readonly<Record<string, string>>
  evolutions?: Readonly<Record<string, string>>
  /**
   * English name -> name, for the items, moves and species the evolution texts mention. A name
   * that reads the same in this language is listed too: `evolutionText` only fills in names it
   * finds here.
   */
  names?: Readonly<Record<string, string>>
}

export const formKey = (species: number, form: number): string => `${species}-${form}`
export const variantKey = (species: number, form: number, variant: number): string => `${species}-${form}-${variant}`

const registered: Partial<Record<LanguageId, TermData>> = {}

/**
 * Adds terms of a language. May be called any number of times (a part at a time, or one species
 * at a time for the Pokédex texts): each part is merged into what is already there, and
 * everything on screen renders again.
 */
export function registerTerms(language: LanguageId, data: TermData): void {
  const merged: Record<string, object> = { ...registered[language] }
  for (const [part, values] of Object.entries(data) as Array<[string, object | undefined]>) {
    if (values) merged[part] = { ...merged[part], ...values }
  }
  registered[language] = merged as TermData
  languageChanged()
}

/** The parts of a terms file (`data/terms/<language>.json`, written by tools/build-data/terms.ts). */
const FILE_PARTS = [
  'species', 'genus', 'forms', 'formFull', 'variants', 'types', 'abilities', 'balls', 'games', 'gameShort', 'gameGroups', 'flavor',
  'locations', 'methods', 'conditions', 'evolutions', 'names'
] as const satisfies ReadonlyArray<keyof TermData>

/**
 * Reads a terms file. Anything that is not a table of texts is dropped, so a damaged or
 * half-written file costs the names it lacks and nothing else. Undefined when it is no terms file.
 */
export function termsFromFile(raw: unknown): TermData | undefined {
  if (typeof raw !== 'object' || raw === null || (raw as { v?: unknown }).v !== 1) return undefined
  const out: Record<string, Record<string, string>> = {}
  for (const part of FILE_PARTS) {
    const table = (raw as Record<string, unknown>)[part]
    if (typeof table !== 'object' || table === null || Array.isArray(table)) continue
    const texts: Record<string, string> = {}
    for (const [key, text] of Object.entries(table)) if (typeof text === 'string' && text !== '') texts[key] = text
    out[part] = texts
  }
  return out as TermData
}

const loading = new Map<LanguageId, Promise<void>>()

/**
 * Loads the terms of a language before it becomes the active one: one file per language,
 * fetched once. `applyLanguage` (shell/language.ts) awaits it next to the interface text.
 * English needs nothing: it is what the datasets carry. Never rejects: a file that cannot be
 * loaded leaves the language reading in English, and the next switch tries again.
 */
export function loadTerms(language: LanguageId): Promise<void> {
  if (language === DEFAULT_LANGUAGE) return Promise.resolve()
  let pending = loading.get(language)
  if (!pending) {
    pending = (async () => {
      const response = await fetch(`./data/terms/${language}.json`)
      const data = response.ok ? termsFromFile(await response.json()) : undefined
      if (data) registerTerms(language, data)
      else loading.delete(language)
    })().catch(() => {
      loading.delete(language)
    })
    loading.set(language, pending)
  }
  return pending
}

function terms(): TermData {
  return registered[activeLanguage()] ?? NO_TERMS
}

const NO_TERMS: TermData = {}

// ================================================================ species and forms

type SpeciesRef = number | { readonly id: number; readonly name: string }
interface FormRef {
  readonly f: number
  readonly name: string
  readonly full: string
  readonly variants?: ReadonlyArray<{ readonly id: number; readonly name: string }>
}

const speciesId = (species: number | { readonly id: number }): number => (typeof species === 'number' ? species : species.id)

function dexSpecies(id: number): { name: string; genus: string } | undefined {
  return useDexStore.getState().dex?.species(id)
}

/**
 * Name of a species, by national dex number or from the `SpeciesSummary` in hand (which also
 * works before the datasets are loaded). "" for a number the datasets do not have.
 */
export function speciesName(species: SpeciesRef): string {
  const id = speciesId(species)
  return terms().species?.[id] ?? (typeof species === 'number' ? dexSpecies(id)?.name : species.name) ?? ''
}

/** Genus of a species ("Seed Pokémon"). "" for a number the datasets do not have. */
export function speciesGenus(species: number | { readonly id: number; readonly genus: string }): string {
  const id = speciesId(species)
  return terms().genus?.[id] ?? (typeof species === 'number' ? dexSpecies(id)?.genus : species.genus) ?? ''
}

/** `FormSummary.name`: the form on its own ("Alolan Form"; "" for a plain base form). */
export function formLabel(species: number | { readonly id: number }, form: FormRef): string {
  return terms().forms?.[formKey(speciesId(species), form.f)] ?? form.name
}

/** `FormSummary.full`: species and form in one name ("Alolan Raichu"). */
export function formFullName(species: number | { readonly id: number }, form: FormRef): string {
  return terms().formFull?.[formKey(speciesId(species), form.f)] ?? form.full
}

/** Name of a sub-variant of a form (`FormVariant.name`, an Alcremie sweet); undefined when the form has no such variant. */
export function variantName(species: number | { readonly id: number }, form: FormRef, variantId: number | null | undefined): string | undefined {
  if (variantId == null) return undefined
  const english = form.variants?.find((v) => v.id === variantId)?.name
  if (english === undefined) return undefined
  return terms().variants?.[variantKey(speciesId(species), form.f, variantId)] ?? english
}

/** Pokédex entry text of a species; `english` is `SpeciesDetail.flavor`. */
export function flavorText(species: number, english: string): string {
  return terms().flavor?.[species] ?? english
}

// ================================================================ types, abilities, balls

const TYPE_NAMES: Readonly<Record<TypeId, string>> = {
  normal: 'Normal', fighting: 'Fighting', flying: 'Flying', poison: 'Poison', ground: 'Ground', rock: 'Rock',
  bug: 'Bug', ghost: 'Ghost', steel: 'Steel', fire: 'Fire', water: 'Water', grass: 'Grass', electric: 'Electric',
  psychic: 'Psychic', ice: 'Ice', dragon: 'Dragon', dark: 'Dark', fairy: 'Fairy', stellar: 'Stellar'
}

export function typeName(type: TypeId): string {
  return terms().types?.[type] ?? TYPE_NAMES[type] ?? type
}

/** Name of an ability by PKHeX id; undefined for none or an unknown id. */
export function abilityName(id: number | null | undefined): string | undefined {
  const english = englishAbilityName(id)
  if (english === undefined || id == null) return undefined
  return terms().abilities?.[id] ?? english
}

/** Name of a ball by PKHeX id; undefined for none or an unknown id. */
export function ballName(id: number | null | undefined): string | undefined {
  if (id == null) return undefined
  const english = BALL_BY_ID.get(id)?.name
  if (english === undefined) return undefined
  return terms().balls?.[id] ?? english
}

// ================================================================ games

/** `GameDef.name` ("Pokémon Scarlet"). An id the app does not know is returned as it is. */
export function gameName(id: string): string {
  return terms().games?.[id] ?? GAME_BY_ID.get(id)?.name ?? id
}

/** `GameDef.short`. An id the app does not know is returned as it is. */
export function gameShortName(id: string): string {
  return terms().gameShort?.[id] ?? GAME_BY_ID.get(id)?.short ?? id
}

let groupNames: Map<string, string> | null = null

/** `GameDef.groupName` of a paired-version group ("Scarlet & Violet"), by `GameDef.group`. */
export function gameGroupName(group: string): string {
  groupNames ??= new Map(GAMES.map((game) => [game.group, game.groupName]))
  return terms().gameGroups?.[group] ?? groupNames.get(group) ?? group
}

// ================================================================ stored English text, translated for display

/**
 * The four below take the English text the datasets carry (and the save stores) and return it
 * in the active language. Text without a translation comes back untouched, which is also what
 * happens to anything the user typed themselves.
 */

/** A location name: `SpeciesDetail.strings[row.l]`, or `CatchEntry.location`. */
export function locationName(english: string): string {
  return terms().locations?.[english] ?? english
}

/** English text -> message key, for the messages of one group of `en/data.ts` ("method.", "condition."). */
function messageKeys(prefix: string): ReadonlyMap<string, MessageKey> {
  const keys = new Map<string, MessageKey>()
  for (const [key, text] of Object.entries(dataMessages)) {
    if (key.startsWith(prefix) && typeof text === 'string') keys.set(text, `data.${key}` as MessageKey)
  }
  return keys
}

let methodKeys: ReadonlyMap<string, MessageKey> | null = null
let conditionKeys: ReadonlyMap<string, MessageKey> | null = null

/**
 * A method label: `EncounterRow.m`, or `CatchEntry.method`. The labels of the datasets are
 * messages of the "data" namespace, found by their English text; anything else (a method the
 * user typed) comes back as it is.
 */
export function methodLabel(english: string): string {
  const own = terms().methods?.[english]
  if (own !== undefined) return own
  const key = (methodKeys ??= messageKeys('method.')).get(english)
  return key ? t(key) : english
}

/** One condition of an encounter row: an item of `EncounterRow.c`. Looked up like a method label. */
export function conditionLabel(english: string): string {
  const own = terms().conditions?.[english]
  if (own !== undefined) return own
  const key = (conditionKeys ??= messageKeys('condition.')).get(english)
  return key ? t(key) : english
}

/**
 * The sentences `evolutionText` can rebuild in another language: the pattern of the English
 * sentence, the message that says the same, and what each captured group is. A group other than
 * `level` is a name and must be one the language's terms list.
 */
const EVOLUTION_PATTERNS: ReadonlyArray<readonly [pattern: RegExp, key: MessageKey, ...groups: string[]]> = [
  [/^Level (\d+)$/, 'data.evolution.level', 'level'],
  [/^Level (\d+) \(female\)$/, 'data.evolution.levelFemale', 'level'],
  [/^Level (\d+) \(male\)$/, 'data.evolution.levelMale', 'level'],
  [/^Level (\d+) at night$/, 'data.evolution.levelNight', 'level'],
  [/^Level (\d+) during the day$/, 'data.evolution.levelDay', 'level'],
  [/^Use an? (.+) at night$/, 'data.evolution.useItemNight', 'item'],
  [/^Use an? (.+) during the day$/, 'data.evolution.useItemDay', 'item'],
  [/^Use an? (.+)$/, 'data.evolution.useItem', 'item'],
  [/^Trade$/, 'data.evolution.trade'],
  [/^Trade holding an? (.+)$/, 'data.evolution.tradeHolding', 'item'],
  [/^Trade for an? (.+)$/, 'data.evolution.tradeFor', 'species'],
  [/^Level up knowing (.+)$/, 'data.evolution.levelUpKnowing', 'move'],
  [/^Evolve knowing (.+)$/, 'data.evolution.evolveKnowing', 'move'],
  [/^Level up holding an? (.+) at night$/, 'data.evolution.levelUpHoldingNight', 'item'],
  [/^Level up holding an? (.+) during the day$/, 'data.evolution.levelUpHoldingDay', 'item'],
  [/^Level up with high friendship$/, 'data.evolution.levelUpFriendship'],
  [/^Level up with high friendship at night$/, 'data.evolution.levelUpFriendshipNight'],
  [/^Level up with high friendship during the day$/, 'data.evolution.levelUpFriendshipDay'],
  [/^Evolve with high friendship$/, 'data.evolution.evolveFriendship'],
  [/^Evolve with high friendship at night$/, 'data.evolution.evolveFriendshipNight'],
  [/^Evolve with high friendship during the day$/, 'data.evolution.evolveFriendshipDay'],
  [/^Change form: give it the (.+) to hold$/, 'data.evolution.formGiveToHold', 'item'],
  [/^Change form: give it the (.+)$/, 'data.evolution.formGive', 'item'],
  [/^Change form: take the (.+) away$/, 'data.evolution.formTakeAway', 'item'],
  [/^Change form: use the (.+)$/, 'data.evolution.formUse', 'item'],
  [/^Fuse with (.+) using the (.+)$/, 'data.evolution.fuse', 'species', 'item']
]

/**
 * How a Pokémon evolves or changes form: `FamilyNode.how` / `EvolveSource.how`. English shows the
 * sentence of the datasets as it is. Another language gets the common sentences rebuilt from a
 * message of the "data" namespace, with the games' own names for the item, move or species in
 * it; a sentence that is not recognised, whose message is not translated yet or that names
 * something the terms do not list stays the English sentence, whole.
 */
export function evolutionText(english: string): string {
  const data = terms()
  const own = data.evolutions?.[english]
  if (own !== undefined) return own
  const language = activeLanguage()
  if (language === DEFAULT_LANGUAGE) return english
  for (const [pattern, key, ...groups] of EVOLUTION_PATTERNS) {
    const match = pattern.exec(english)
    if (!match) continue
    const message = messageText(language, key)
    if (message === messageText(DEFAULT_LANGUAGE, key)) continue
    const params: Record<string, string> = {}
    let known = true
    groups.forEach((group, i) => {
      const text = match[i + 1] ?? ''
      const value = group === 'level' ? text : data.names?.[text]
      if (value === undefined) known = false
      else params[group] = value
    })
    if (known) return fillPlaceholders(message, params, language)
  }
  return english
}
