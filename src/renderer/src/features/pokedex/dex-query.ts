/**
 * The Pokédex browser's model: what a tile is, and how the list is searched, filtered and sorted.
 * Pure functions of (dex, collection, view state); the page memoises them.
 *
 * Two displays share one tile shape:
 *   species  one tile per species, showing the species' default render and its whole collection state
 *   forms    one tile per Living Dex slot under the current rules, showing that slot's own render
 */

import type { FormSummary, SpeciesSummary, SpeciesTag, TypeId } from '@shared/dex-types'
import { GAME_BY_ID, GENERATION_NAMES, type GameDef } from '@shared/games'
import type { CatchEntry } from '@shared/save-types'
import type { Dex } from '@renderer/lib/data'
import { getDexSearch, normalizeText } from '@renderer/lib/search'
import { speciesSpritePath } from '@renderer/lib/sprites'
import { isFormSlotted, type Collection, type LivingSlot } from '@renderer/domain/slots'

// ---------------------------------------------------------------- view state

export type DexDisplay = 'species' | 'forms'
export type DexSort = 'number' | 'name' | 'recent' | 'entries'
export type DexStatus = 'all' | 'caught' | 'missing' | 'shiny' | 'shiny-missing' | 'multi-game'
export type TypeMatch = 'any' | 'all'

export interface DexFilters {
  /** Generations the species debuted in; empty = every generation. */
  gens: readonly number[]
  types: readonly TypeId[]
  /** With several types: one of them is enough, or the Pokémon needs all of them. */
  typeMatch: TypeMatch
  status: DexStatus
  /** `GameDef.id` the Pokémon must be obtainable in; null = no game filter. */
  game: string | null
  /** With a game: also count Pokémon whose only sources there are time-limited. */
  gameEvents: boolean
  /** With a game: only what is still missing from the Living Dex. */
  gameMissing: boolean
  tags: readonly SpeciesTag[]
  /** Only species with more than one Living Dex slot under the current rules. */
  altForms: boolean
}

export const NO_FILTERS: DexFilters = Object.freeze({
  gens: Object.freeze([]) as readonly number[],
  types: Object.freeze([]) as readonly TypeId[],
  typeMatch: 'any',
  status: 'all',
  game: null,
  gameEvents: false,
  gameMissing: false,
  tags: Object.freeze([]) as readonly SpeciesTag[],
  altForms: false
})

export const DEX_DISPLAYS: readonly DexDisplay[] = ['species', 'forms']
export const DEX_SORTS: readonly DexSort[] = ['number', 'name', 'recent', 'entries']
export const DEX_STATUSES: readonly DexStatus[] = ['all', 'caught', 'missing', 'shiny', 'shiny-missing', 'multi-game']

export const SORT_LABELS: Readonly<Record<DexSort, string>> = {
  number: 'Dex number',
  name: 'Name',
  recent: 'Recently logged',
  entries: 'Most entries'
}

export const STATUS_INFO: Readonly<Record<DexStatus, { label: string; description: string }>> = {
  all: { label: 'Any status', description: 'Caught or not.' },
  caught: { label: 'Caught', description: 'At least one logged.' },
  missing: { label: 'Missing', description: 'Nothing logged yet.' },
  shiny: { label: 'Shiny caught', description: 'A shiny one is logged.' },
  'shiny-missing': { label: 'Shiny missing', description: 'No shiny logged yet.' },
  'multi-game': { label: 'In 2+ games', description: 'Logged from more than one game.' }
}

export const SPECIES_TAGS: readonly SpeciesTag[] = ['legendary', 'mythical', 'baby', 'starter', 'fossil', 'pseudo-legendary', 'ultra-beast', 'paradox']

export const TAG_LABELS: Readonly<Record<SpeciesTag, string>> = {
  legendary: 'Legendary',
  mythical: 'Mythical',
  baby: 'Baby',
  starter: 'Starter',
  fossil: 'Fossil',
  'pseudo-legendary': 'Pseudo-legendary',
  'ultra-beast': 'Ultra Beast',
  paradox: 'Paradox'
}

/** Home region of each generation, for the generation picker. */
export const GENERATION_REGIONS: Readonly<Record<number, string>> = {
  1: 'Kanto', 2: 'Johto', 3: 'Hoenn', 4: 'Sinnoh', 5: 'Unova', 6: 'Kalos', 7: 'Alola', 8: 'Galar', 9: 'Paldea'
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

/** "IV" for 4; falls back to the digits for anything out of range. */
export function romanNumeral(n: number): string {
  return ROMAN[n] ?? String(n)
}

export function generationLabel(gen: number): string {
  return GENERATION_NAMES[gen] ?? `Generation ${romanNumeral(gen)}`
}

/** True when any filter (not counting the search text) narrows the list. */
export function hasActiveFilters(filters: DexFilters): boolean {
  return (
    filters.gens.length > 0 ||
    filters.types.length > 0 ||
    filters.status !== 'all' ||
    filters.game !== null ||
    filters.tags.length > 0 ||
    filters.altForms
  )
}

/** Adds the value when it is absent, removes it when present; keeps `order` when one is given. */
export function toggled<T>(list: readonly T[], value: T, order?: readonly T[]): T[] {
  const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  return order ? next.sort((a, b) => order.indexOf(a) - order.indexOf(b)) : next
}

// ---------------------------------------------------------------- tiles

/** One Living Dex slot a tile stands for, with the form whose availability decides the game filter. */
export interface TileTarget {
  key: string
  form: FormSummary
}

export interface DexTile {
  /** Stable id: the national dex number for a species tile, the slot key for a form tile. */
  key: string
  species: SpeciesSummary
  /** The form shown; also the form the species page opens on. */
  form: FormSummary
  /** The slot behind a form tile; undefined on a species tile. */
  slot?: LivingSlot
  label: string
  /** Position in the unfiltered list: national dex order, then form order. */
  order: number
  /** Types printed on the tile. */
  types: readonly TypeId[]
  /** Type combinations the type filter may match (a species tile also answers for its regional forms). */
  typeSets: ReadonlyArray<readonly TypeId[]>
  /** HOME render path; the shiny one when asked for and it exists. */
  sprite(shiny: boolean): string
  /** The slots this tile covers. */
  targets: readonly TileTarget[]
  /** Living Dex slots of the whole species under the current rules. */
  speciesSlots: number

  // ---- collection state
  caught: boolean
  /** Logged entries behind this tile. */
  entries: number
  /** One of them is shiny. */
  shiny: boolean
  /** Distinct games among them. */
  games: number
  /** `createdAt` of the newest one; "" when there is none. */
  latest: string
  /** Of `targets`, how many have an entry. */
  slotsCaught: number
}

interface EntryStats {
  entries: number
  shiny: boolean
  games: number
  latest: string
}

function statsOf(lists: ReadonlyArray<readonly CatchEntry[] | undefined>): EntryStats {
  let entries = 0
  let shiny = false
  let latest = ''
  const games = new Set<string>()
  for (const list of lists) {
    if (!list) continue
    for (const entry of list) {
      entries++
      if (entry.shiny) shiny = true
      if (entry.createdAt > latest) latest = entry.createdAt
      games.add(entry.game)
    }
  }
  return { entries, shiny, games: games.size, latest }
}

/** Every tile of a display, unfiltered, in national dex order. Rebuilt when the collection changes. */
export function buildTiles(dex: Dex, collection: Collection, display: DexDisplay): DexTile[] {
  const tiles: DexTile[] = []
  const targetOf = (species: SpeciesSummary, base: FormSummary, slot: LivingSlot): TileTarget => ({ key: slot.key, form: dex.form(species.id, slot.form) ?? base })

  for (const species of dex.speciesList) {
    const base = species.forms[0]
    if (!base) continue
    const slots = collection.slotsBySpecies.get(species.id) ?? []

    if (display === 'species') {
      const targets = slots.map((slot) => targetOf(species, base, slot))
      const stats = statsOf(slots.map((slot) => collection.bySlot.get(slot.key)))
      const regional = species.forms.filter((form) => form !== base && form.cat === 'regional').map((form) => form.types)
      tiles.push({
        key: String(species.id),
        species,
        form: base,
        label: species.name,
        order: tiles.length,
        types: base.types,
        typeSets: [base.types, ...regional],
        sprite: (shiny) => speciesSpritePath(species, shiny),
        targets,
        speciesSlots: slots.length,
        caught: stats.entries > 0,
        ...stats,
        slotsCaught: slots.reduce((n, slot) => n + (collection.caught.has(slot.key) ? 1 : 0), 0)
      })
      continue
    }

    for (const slot of slots) {
      const target = targetOf(species, base, slot)
      const stats = statsOf([collection.bySlot.get(slot.key)])
      tiles.push({
        key: slot.key,
        species,
        form: target.form,
        slot,
        label: slot.label,
        order: tiles.length,
        types: target.form.types,
        typeSets: [target.form.types],
        sprite: (shiny) => slot.spritePath(shiny),
        targets: [target],
        speciesSlots: slots.length,
        caught: stats.entries > 0,
        ...stats,
        slotsCaught: stats.entries > 0 ? 1 : 0
      })
    }
  }
  return tiles
}

// ---------------------------------------------------------------- search

const labelWords = new WeakMap<LivingSlot, string[]>()

function wordsOf(slot: LivingSlot): string[] {
  let words = labelWords.get(slot)
  if (!words) {
    words = normalizeText(slot.label).split(' ').filter(Boolean)
    labelWords.set(slot, words)
  }
  return words
}

/**
 * Turns the search text into a tile test, or null when there is nothing to search for.
 *
 * Species tiles match on the species' name or number and on any of its forms' names. Form tiles
 * match when their species matched as a whole, when their own form matched ("alolan"), or when
 * their label does ("gigantamax", "star sweet"). A hit on a form that has no slot of its own under
 * the rules lands on the species' base slot, where such a catch would be counted.
 */
export function textMatcher(dex: Dex, collection: Collection, display: DexDisplay, text: string): ((tile: DexTile) => boolean) | null {
  if (normalizeText(text) === '') return null
  const search = getDexSearch(dex)

  if (display === 'species') {
    const ids = new Set(search.speciesIds(text))
    return (tile) => ids.has(tile.species.id)
  }

  const whole = new Set<number>()
  const forms = new Set<string>()
  for (const hit of search.search(text, { limit: Number.MAX_SAFE_INTEGER })) {
    if (!hit.viaForm) whole.add(hit.species.id)
    else if (isFormSlotted(hit.species, hit.form, collection.rules)) forms.add(`${hit.species.id}:${hit.form.f}`)
    else forms.add(`${hit.species.id}:${hit.species.forms[0]?.f ?? 0}`)
  }
  // Slot labels carry words the form names do not: "Gigantamax", a sweet, a gender sign.
  const tokens = normalizeText(text).split(' ').filter((token) => token.length >= 2)
  const byLabel = (slot: LivingSlot): boolean => {
    if (tokens.length === 0) return false
    const words = wordsOf(slot)
    return tokens.every((token) => words.some((word) => word.startsWith(token)))
  }
  return (tile) => whole.has(tile.species.id) || forms.has(`${tile.species.id}:${tile.form.f}`) || (tile.slot !== undefined && byLabel(tile.slot))
}

// ---------------------------------------------------------------- filtering

function typesMatch(sets: ReadonlyArray<readonly TypeId[]>, wanted: readonly TypeId[], match: TypeMatch): boolean {
  if (wanted.length === 0) return true
  // One form has to satisfy the whole condition; types are never mixed across forms.
  return sets.some((types) => (match === 'all' ? wanted.every((t) => types.includes(t)) : wanted.some((t) => types.includes(t))))
}

function statusMatch(tile: DexTile, status: DexStatus): boolean {
  switch (status) {
    case 'caught':
      return tile.caught
    case 'missing':
      return !tile.caught
    case 'shiny':
      return tile.shiny
    case 'shiny-missing':
      return !tile.shiny
    case 'multi-game':
      return tile.games >= 2
    default:
      return true
  }
}

/** The form can be had in the game: without an event, or also through one when `events` is on. */
export function availableIn(dex: Dex, form: FormSummary, gameId: string, events: boolean): boolean {
  return dex.isObtainable(form, gameId) || (events && dex.isEventOnly(form, gameId))
}

export interface FilterInput {
  dex: Dex
  collection: Collection
  display: DexDisplay
  text: string
  filters: DexFilters
}

/** The tiles that pass the search text and every filter, in their incoming order. */
export function filterTiles(tiles: readonly DexTile[], { dex, collection, display, text, filters }: FilterInput): DexTile[] {
  const matchesText = textMatcher(dex, collection, display, text)
  const { gens, types, typeMatch, status, game, gameEvents, gameMissing, tags, altForms } = filters
  const plain = matchesText === null && !hasActiveFilters(filters)
  if (plain) return tiles.slice()

  return tiles.filter((tile) => {
    const { species } = tile
    if (gens.length > 0 && !gens.includes(species.gen)) return false
    if (tags.length > 0 && !tags.some((tag) => species.tags.includes(tag))) return false
    if (altForms && tile.speciesSlots < 2) return false
    if (!typesMatch(tile.typeSets, types, typeMatch)) return false
    if (!statusMatch(tile, status)) return false
    if (game !== null && !tile.targets.some((t) => availableIn(dex, t.form, game, gameEvents) && !(gameMissing && collection.caught.has(t.key)))) return false
    return matchesText === null || matchesText(tile)
  })
}

// ---------------------------------------------------------------- sorting

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

/** A sorted copy. Ties, and tiles a sort has nothing to say about, stay in national dex order. */
export function sortTiles(tiles: readonly DexTile[], sort: DexSort): DexTile[] {
  const out = tiles.slice()
  if (sort === 'name') out.sort((a, b) => collator.compare(a.label, b.label) || a.order - b.order)
  else if (sort === 'entries') out.sort((a, b) => b.entries - a.entries || a.order - b.order)
  else if (sort === 'recent') out.sort((a, b) => (a.latest === b.latest ? a.order - b.order : a.latest > b.latest ? -1 : 1))
  else out.sort((a, b) => a.order - b.order)
  return out
}

/** Identity of an ordered result: equal exactly when the same tiles are listed in the same order. */
export function viewKeyOf(tiles: readonly DexTile[]): string {
  return tiles.map((tile) => tile.key).join(' ')
}

// ---------------------------------------------------------------- filter pickers

/** Games worth offering in "Obtainable in": the dataset's games with at least one source of anything. */
export function obtainGames(dex: Dex): GameDef[] {
  const used = new Set<number>()
  let go = false
  for (const species of dex.speciesList) {
    for (const form of species.forms) {
      for (const idx of form.obtain) used.add(idx)
      for (const idx of form.event) used.add(idx)
      if (form.go !== undefined) go = true
    }
  }
  return dex.games.filter((game) => used.has(dex.gameIdx(game.id)) || (go && game.id === 'go'))
}

export interface FacetCounts {
  gens: ReadonlyMap<number, number>
  types: ReadonlyMap<TypeId, number>
  tags: ReadonlyMap<SpeciesTag, number>
}

const facetCache = new WeakMap<Dex, FacetCounts>()

/** How many species each generation, type (of the base form) and category holds. */
export function facetCounts(dex: Dex): FacetCounts {
  let counts = facetCache.get(dex)
  if (!counts) {
    const gens = new Map<number, number>()
    const types = new Map<TypeId, number>()
    const tags = new Map<SpeciesTag, number>()
    const bump = <K>(map: Map<K, number>, key: K): void => void map.set(key, (map.get(key) ?? 0) + 1)
    for (const species of dex.speciesList) {
      bump(gens, species.gen)
      for (const type of species.forms[0]?.types ?? []) bump(types, type)
      for (const tag of species.tags) bump(tags, tag)
    }
    counts = { gens, types, tags }
    facetCache.set(dex, counts)
  }
  return counts
}

// ---------------------------------------------------------------- active filter chips

export type FilterChipKind = 'text' | 'gen' | 'type' | 'type-match' | 'status' | 'game' | 'game-events' | 'game-missing' | 'tag' | 'alt-forms'

export interface FilterChip {
  id: string
  kind: FilterChipKind
  label: string
  /** The raw value behind the chip (a type id, a game id ...), for icons and colours. */
  value?: string | number
  /** The view state with this one condition removed. */
  remove(state: { text: string; filters: DexFilters }): { text: string; filters: DexFilters }
}

/** One removable chip per active condition, in toolbar order. */
export function activeChips(text: string, filters: DexFilters, typeName: (type: TypeId) => string): FilterChip[] {
  const chips: FilterChip[] = []
  const patch =
    (change: (f: DexFilters) => Partial<DexFilters>): FilterChip['remove'] =>
    (state) => ({ text: state.text, filters: { ...state.filters, ...change(state.filters) } })

  const query = text.trim()
  if (query !== '') chips.push({ id: 'text', kind: 'text', label: `“${query}”`, remove: (state) => ({ text: '', filters: state.filters }) })

  for (const gen of filters.gens) {
    chips.push({ id: `gen-${gen}`, kind: 'gen', value: gen, label: generationLabel(gen), remove: patch((f) => ({ gens: f.gens.filter((g) => g !== gen) })) })
  }
  for (const type of filters.types) {
    chips.push({ id: `type-${type}`, kind: 'type', value: type, label: typeName(type), remove: patch((f) => ({ types: f.types.filter((t) => t !== type) })) })
  }
  if (filters.types.length > 1 && filters.typeMatch === 'all') {
    chips.push({ id: 'type-match', kind: 'type-match', label: 'Has every type', remove: patch(() => ({ typeMatch: 'any' })) })
  }
  if (filters.status !== 'all') {
    chips.push({ id: 'status', kind: 'status', value: filters.status, label: STATUS_INFO[filters.status].label, remove: patch(() => ({ status: 'all' })) })
  }
  if (filters.game !== null) {
    const game = GAME_BY_ID.get(filters.game)
    chips.push({
      id: 'game',
      kind: 'game',
      value: filters.game,
      label: `In ${game?.short ?? 'an unknown game'}`,
      remove: patch(() => ({ game: null, gameEvents: false, gameMissing: false }))
    })
    if (filters.gameMissing) chips.push({ id: 'game-missing', kind: 'game-missing', label: 'Not yet caught', remove: patch(() => ({ gameMissing: false })) })
    if (filters.gameEvents) chips.push({ id: 'game-events', kind: 'game-events', label: 'Events included', remove: patch(() => ({ gameEvents: false })) })
  }
  for (const tag of filters.tags) {
    chips.push({ id: `tag-${tag}`, kind: 'tag', value: tag, label: TAG_LABELS[tag], remove: patch((f) => ({ tags: f.tags.filter((t) => t !== tag) })) })
  }
  if (filters.altForms) chips.push({ id: 'alt-forms', kind: 'alt-forms', label: 'Alternate forms', remove: patch(() => ({ altForms: false })) })
  return chips
}

// ---------------------------------------------------------------- links into the browser

export interface DexLinkState {
  text?: string
  filters?: Partial<DexFilters>
  display?: DexDisplay
  sort?: DexSort
}

const isOneOf = <T extends string>(list: readonly T[], value: string | null): value is T => value !== null && (list as readonly string[]).includes(value)
const csv = (value: string | null): string[] => (value ?? '').split(',').map((part) => part.trim()).filter(Boolean)

/**
 * Reads a view out of the query of a link to the Pokédex, so other pages can open it pre-filtered:
 * `/dex?game=scarlet&missing=1`, `/dex?gen=1,2&type=fire&status=caught&view=forms`.
 * Unknown keys and values are ignored; returns null when the query sets nothing.
 *
 *   q        search text            gen     generations, comma separated
 *   type     type ids               match   any | all
 *   status   a `DexStatus`          tag     category tags
 *   game     a game id              events  1 = include event-only     missing  1 = not yet caught
 *   forms    1 = has alternate forms
 *   view     species | forms        sort    a `DexSort`
 */
export function parseDexLink(search: string, knownTypes: readonly TypeId[]): DexLinkState | null {
  const params = new URLSearchParams(search)
  const filters: { -readonly [K in keyof DexFilters]?: DexFilters[K] } = {}
  const out: DexLinkState = {}

  const text = params.get('q')
  if (text !== null && text.trim() !== '') out.text = text.trim().slice(0, 80)

  const gens = [...new Set(csv(params.get('gen')).map(Number))].filter((n) => Number.isInteger(n) && n >= 1 && n <= 9).sort((a, b) => a - b)
  if (gens.length > 0) filters.gens = gens
  const types = csv(params.get('type')).filter((t): t is TypeId => (knownTypes as readonly string[]).includes(t))
  if (types.length > 0) filters.types = [...new Set(types)]
  const match = params.get('match')
  if (match === 'any' || match === 'all') filters.typeMatch = match
  const status = params.get('status')
  if (isOneOf(DEX_STATUSES, status)) filters.status = status
  const tags = csv(params.get('tag')).filter((t): t is SpeciesTag => (SPECIES_TAGS as readonly string[]).includes(t))
  if (tags.length > 0) filters.tags = [...new Set(tags)]
  const game = params.get('game')
  if (game !== null && GAME_BY_ID.has(game)) {
    filters.game = game
    filters.gameEvents = params.get('events') === '1'
    filters.gameMissing = params.get('missing') === '1'
  }
  if (params.get('forms') === '1') filters.altForms = true

  if (Object.keys(filters).length > 0) out.filters = filters
  const view = params.get('view')
  if (isOneOf(DEX_DISPLAYS, view)) out.display = view
  const sort = params.get('sort')
  if (isOneOf(DEX_SORTS, sort)) out.sort = sort

  return Object.keys(out).length > 0 ? out : null
}
