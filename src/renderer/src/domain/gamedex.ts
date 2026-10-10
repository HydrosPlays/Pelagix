/**
 * The collection seen through one game: only what is obtainable in that game, in the order of the
 * game's own Pokédexes, and caught only by entries obtained in that game. A game with several
 * Pokédexes (Sword: Galar, Isle of Armor, Crown Tundra) splits into one section per Pokédex.
 *
 * The result is an ordinary `Collection`, so the Living Dex and the HOME Dex draw it with the code
 * they already have. Everything except the hooks at the end is a pure function.
 */

import { useEffect, useMemo, useState } from 'react'
import { GAME_BY_ID } from '@shared/games'
import { POKEDEX_NAMES, pokedexesOfGame } from '@shared/pokedexes'
import type { CatchEntry } from '@shared/save-types'
import { t, type MessageKey } from '@renderer/i18n/runtime'
import { gameShortName } from '@renderer/i18n/terms'
import type { Dex } from '@renderer/lib/data'
import { isFormSlotted, useCollection, type Collection, type LivingSlot } from './slots'

// ---------------------------------------------------------------- the data file

/** Species of each regional Pokédex in regional order, by PokeAPI identifier (pokedexes.json). */
export type Pokedexes = ReadonlyMap<string, readonly number[]>

export const NO_POKEDEXES: Pokedexes = new Map()

/** Checks pokedexes.json and returns its lists; throws a descriptive error for anything the app could not use. */
export function parsePokedexes(raw: unknown): Pokedexes {
  const lists = typeof raw === 'object' && raw !== null ? (raw as { pokedexes?: unknown }).pokedexes : undefined
  if (typeof lists !== 'object' || lists === null || Array.isArray(lists)) throw new Error('Invalid pokedexes.json: no "pokedexes" map.')
  const out = new Map<string, readonly number[]>()
  for (const [name, list] of Object.entries(lists)) {
    if (!Array.isArray(list) || !list.every((s) => Number.isInteger(s) && s > 0)) throw new Error(`Invalid pokedexes.json: "${name}" is not a list of species numbers.`)
    out.set(name, list as number[])
  }
  return out
}

/** Loads pokedexes.json. Without the file the game views still work, in National order and without sections. */
export async function fetchPokedexes(fetchFn: typeof fetch = fetch, url = './data/pokedexes.json'): Promise<Pokedexes> {
  try {
    const res = await fetchFn(url)
    if (!res.ok) return NO_POKEDEXES
    return parsePokedexes(await res.json())
  } catch {
    return NO_POKEDEXES
  }
}

// ---------------------------------------------------------------- sections

export interface DexSection {
  /** PokeAPI identifier of the Pokédex, or `other` for what the game has outside its Pokédexes. */
  id: string
  /** In the active language; read on each use (sections are cached and outlive a language switch). */
  readonly title: string
  /** Index of the section's first item, and how many items follow it. */
  start: number
  count: number
}

export const OTHER_SECTION = 'other'

export interface SectionPlan {
  /** The game's Pokédexes in order, then the `other` section. */
  sections: ReadonlyArray<{ readonly id: string; readonly title: string }>
  /** Per species: index into `sections` and its place there. Species in no Pokédex are absent. */
  placeOf: ReadonlyMap<number, { section: number; rank: number }>
}

const sectionGames = new WeakMap<object, string>()

/** The game (`GameDef.id`) whose view a section was made for; undefined for an object that is not one of those sections. */
export function gameOfSection(section: object): string | undefined {
  return sectionGames.get(section)
}

/** "Other Pokémon obtainable in Sword". */
export function otherTitle(gameId: string): string {
  return GAME_BY_ID.has(gameId) ? t('domain.dex.other', { game: gameShortName(gameId) }) : t('domain.dex.otherUnknownGame')
}

/**
 * Name of a regional Pokédex ("Galar Pokédex") in the active language, by its PokeAPI identifier:
 * the message `pokedex.dex.<id>`, else the English name of the shared table, else the id.
 */
export function pokedexName(id: string): string {
  const key = `pokedex.dex.${id}`
  const text = t(key as MessageKey)
  return text === key ? (POKEDEX_NAMES[id] ?? id) : text
}

/** The same without the word "Pokédex" ("Galar"), for a tab: the message `pokedex.dexShort.<id>`. */
export function pokedexShortName(id: string): string {
  const key = `pokedex.dexShort.${id}`
  const text = t(key as MessageKey)
  return text === key ? (POKEDEX_NAMES[id] ?? id).replace(' Pokédex', '') : text
}

/** Heading of a section by its id. */
export function sectionTitle(sectionId: string, gameId: string): string {
  return sectionId === OTHER_SECTION ? otherTitle(gameId) : pokedexName(sectionId)
}

/**
 * How a game's Pokémon are sectioned: one section per Pokédex in the table's order, a species in
 * the first one that lists it. Null for a game without a Pokédex (or without data for it).
 */
export function planSections(gameId: string, pokedexes: Pokedexes): SectionPlan | null {
  const names = pokedexesOfGame(gameId).filter((name) => pokedexes.has(name))
  if (names.length === 0) return null
  const placeOf = new Map<number, { section: number; rank: number }>()
  names.forEach((name, section) => {
    const list = pokedexes.get(name) ?? []
    list.forEach((species, rank) => {
      if (!placeOf.has(species)) placeOf.set(species, { section, rank })
    })
  })
  const sections = [...names, OTHER_SECTION].map((id) => ({
    id,
    get title(): string {
      return sectionTitle(id, gameId)
    }
  }))
  for (const section of sections) sectionGames.set(section, gameId)
  return { sections, placeOf }
}

/**
 * Puts items (in National order) into the plan's sections: Pokédex sections in regional order,
 * the `other` section left in National order. Items of one species stay together in their
 * incoming order; empty sections are dropped.
 */
export function arrange<T>(items: readonly T[], speciesOf: (item: T) => number, plan: SectionPlan): { items: T[]; sections: DexSection[] } {
  const last = plan.sections.length - 1
  const buckets: { item: T; rank: number }[][] = plan.sections.map(() => [])
  items.forEach((item, i) => {
    const place = plan.placeOf.get(speciesOf(item))
    buckets[place?.section ?? last]?.push({ item, rank: place ? place.rank : i })
  })
  const out: T[] = []
  const sections: DexSection[] = []
  buckets.forEach((bucket, i) => {
    const def = plan.sections[i]
    if (bucket.length === 0 || !def) return
    // Array.prototype.sort is stable: forms of one species keep their order.
    bucket.sort((a, b) => a.rank - b.rank)
    const section: DexSection = {
      id: def.id,
      get title(): string {
        return def.title
      },
      start: out.length,
      count: bucket.length
    }
    const game = sectionGames.get(def)
    if (game !== undefined) sectionGames.set(section, game)
    sections.push(section)
    for (const each of bucket) out.push(each.item)
  })
  return { items: out, sections }
}

const NO_SECTIONS: readonly DexSection[] = Object.freeze([])
const sectionRegistry = new WeakMap<readonly LivingSlot[], readonly DexSection[]>()

/** The sections a slot list was built with; empty for the plain Living Dex and for a game without a Pokédex. */
export function sectionsOf(slots: readonly LivingSlot[]): readonly DexSection[] {
  return sectionRegistry.get(slots) ?? NO_SECTIONS
}

// ---------------------------------------------------------------- slots of a game

/**
 * The slots a game shows: those a form obtainable in the game (without an event) lands in. A form
 * without slots of its own under the rules counts toward the base slot, as an entry of it would.
 */
export function slotsObtainableIn(dex: Dex, slots: readonly LivingSlot[], rules: Collection['rules'], gameId: string): LivingSlot[] {
  const keys = new Set<string>()
  for (const species of dex.speciesList) {
    for (const form of species.forms) {
      if (!dex.isObtainable(form, gameId)) continue
      keys.add(form !== species.forms[0] && isFormSlotted(species, form, rules) ? `${species.id}-${form.f}` : String(species.id))
    }
  }
  return slots.filter((slot) => keys.has(slot.key.split(':')[0] ?? ''))
}

interface GameSlots {
  dex: Dex
  pokedexes: Pokedexes
  slots: LivingSlot[]
  sections: readonly DexSection[]
}
const gameSlotCache = new WeakMap<readonly LivingSlot[], Map<string, GameSlots>>()

/** The shown slots of a game in its Pokédex order, with their sections. Cached: equal arguments give the same array back. */
export function gameSlots(dex: Dex, pokedexes: Pokedexes, base: Pick<Collection, 'slots' | 'rules'>, gameId: string): { slots: LivingSlot[]; sections: readonly DexSection[] } {
  let perGame = gameSlotCache.get(base.slots)
  if (!perGame) gameSlotCache.set(base.slots, (perGame = new Map()))
  const hit = perGame.get(gameId)
  if (hit && hit.dex === dex && hit.pokedexes === pokedexes) return hit
  const obtainable = slotsObtainableIn(dex, base.slots, base.rules, gameId)
  const plan = planSections(gameId, pokedexes)
  const arranged = plan ? arrange(obtainable, (slot) => slot.species, plan) : { items: obtainable, sections: NO_SECTIONS }
  const value: GameSlots = { dex, pokedexes, slots: arranged.items, sections: arranged.sections }
  if (value.sections.length > 0) sectionRegistry.set(value.slots, value.sections)
  perGame.set(gameId, value)
  return value
}

// ---------------------------------------------------------------- the collection of a game

export interface GameCollection {
  gameId: string
  /** The shown slots, filled only by entries obtained in the game. */
  collection: Collection
  sections: readonly DexSection[]
}

/** The collection as one game sees it. Entries obtained elsewhere fill nothing here. */
export function gameCollection(dex: Dex, pokedexes: Pokedexes, base: Collection, gameId: string): GameCollection {
  const { slots, sections } = gameSlots(dex, pokedexes, base, gameId)
  const slotByKey = new Map<string, LivingSlot>()
  const slotsBySpecies = new Map<number, LivingSlot[]>()
  for (const slot of slots) {
    slotByKey.set(slot.key, slot)
    const list = slotsBySpecies.get(slot.species)
    if (list) list.push(slot)
    else slotsBySpecies.set(slot.species, [slot])
  }
  const bySlot = new Map<string, CatchEntry[]>()
  const caughtShiny = new Set<string>()
  const speciesCaught = new Set<number>()
  const speciesShiny = new Set<number>()
  const slotOfEntry = new Map<string, string>()
  for (const [key, entries] of base.bySlot) {
    if (!slotByKey.has(key)) continue
    const own = entries.filter((entry) => entry.game === gameId)
    if (own.length === 0) continue
    bySlot.set(key, own)
    for (const entry of own) {
      slotOfEntry.set(entry.id, key)
      speciesCaught.add(entry.species)
      if (entry.shiny) {
        caughtShiny.add(key)
        speciesShiny.add(entry.species)
      }
    }
  }
  const caught = new Set(bySlot.keys())
  const collection: Collection = {
    rules: base.rules,
    slots,
    bySlot,
    caught,
    caughtShiny,
    speciesCaught,
    speciesShiny,
    totals: { slots: slots.length, caught: caught.size, shiny: caughtShiny.size, species: slotsBySpecies.size, speciesCaught: speciesCaught.size },
    slotByKey,
    slotsBySpecies,
    slotOfEntry,
    unplaced: base.unplaced
  }
  return { gameId, collection, sections }
}

// ---------------------------------------------------------------- hooks

let loaded: Pokedexes | null = null
let loading: Promise<Pokedexes> | null = null

/** pokedexes.json, loaded once on first use; `NO_POKEDEXES` until it is there. */
export function usePokedexes(): Pokedexes {
  const [value, setValue] = useState<Pokedexes>(loaded ?? NO_POKEDEXES)
  useEffect(() => {
    if (loaded) return setValue(loaded)
    let live = true
    loading ??= fetchPokedexes()
    void loading.then((result) => {
      loaded = result
      if (live) setValue(result)
    })
    return () => {
      live = false
    }
  }, [])
  return value
}

export const GAMEDEX_STORAGE_KEY = 'pelagix.gamedex.v1'

/** Reads the stored game choice; anything that is not a known game is "no game". Never throws. */
export function parseGameChoice(raw: unknown): string | null {
  const game = typeof raw === 'object' && raw !== null ? (raw as { game?: unknown }).game : undefined
  return typeof game === 'string' && GAME_BY_ID.has(game) ? game : null
}

function readChoice(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return parseGameChoice(JSON.parse(localStorage.getItem(GAMEDEX_STORAGE_KEY) ?? 'null'))
  } catch {
    return null
  }
}

/** The game the Living Dex and the HOME Dex are narrowed to on this device (one choice for both), with a setter that also stores it. */
export function useGameChoice(): [string | null, (game: string | null) => void] {
  const [game, setGame] = useState(readChoice)
  const update = (next: string | null): void => {
    setGame(next)
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(GAMEDEX_STORAGE_KEY, JSON.stringify({ game: next }))
    } catch {
      // A convenience only: a full or blocked storage is not worth an error.
    }
  }
  return [game, update]
}

export interface GameView {
  /** The full collection, whatever the game choice. */
  base: Collection
  /** The collection the page shows: `base`, or the chosen game's. */
  collection: Collection
  game: string | null
  setGame: (game: string | null) => void
}

/** The current collection, narrowed to the chosen game when there is one. */
export function useGameView(dex: Dex): GameView {
  const base = useCollection()
  const pokedexes = usePokedexes()
  const [game, setGame] = useGameChoice()
  const collection = useMemo(() => (game === null ? base : gameCollection(dex, pokedexes, base, game).collection), [dex, pokedexes, base, game])
  return { base, collection, game, setGame }
}
