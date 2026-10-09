/**
 * Statistics derived from the collection: completion per generation / type / category, usage per
 * game / system / ball / kind, a timeline, streaks and suggestions. Pure functions of
 * (dex, entries, collection, now); the dashboard and the achievements engine both read the result.
 *
 * An entry's "day" is its `date` (when the user says it was caught) or, without one, the local
 * calendar day it was logged.
 */

import { useMemo } from 'react'
import { BALLS, type BallDef } from '@shared/balls'
import type { FormCategory, SpeciesTag, TypeId } from '@shared/dex-types'
import { GAME_BY_ID, GAMES, GENERATION_NAMES, SYSTEMS, type GameDef, type SystemDef, type SystemId } from '@shared/games'
import type { CatchEntry, EntryKind } from '@shared/save-types'
import { useDex, type Dex } from '@renderer/lib/data'
import { addDays, dayDiff, ENTRY_KINDS, isIsoDate, ratio, toIsoDate, todayIso } from '@renderer/lib/format'
import { useEntries } from '@renderer/store/save'
import { useCollection, type Collection, type CollectionTotals, type LivingSlot } from './slots'

// ---------------------------------------------------------------- types

export interface SlotTally {
  /** Slots in this bucket. */
  slots: number
  /** Of those, slots with at least one entry. */
  caught: number
  /** Of those, slots with at least one shiny entry. */
  shiny: number
}

export interface GenerationProgress extends SlotTally {
  gen: number
  /** "Generation I". */
  name: string
  species: number
  speciesCaught: number
}

export interface TypeProgress extends SlotTally {
  type: TypeId
}

export interface CategoryProgress extends SlotTally {
  cat: FormCategory
}

export interface TagProgress {
  tag: SpeciesTag
  species: number
  speciesCaught: number
}

export interface GameProgress {
  game: GameDef
  entries: number
  shiny: number
  /** Distinct species logged from this game. */
  species: number
  /** Distinct slots that have an entry from this game. */
  slots: number
}

export interface SystemProgress {
  system: SystemDef
  entries: number
  shiny: number
  /** Distinct games of this system with at least one entry. */
  games: number
}

export interface BallProgress {
  ball: BallDef
  entries: number
  shiny: number
}

export interface KindProgress {
  kind: EntryKind
  entries: number
}

export interface TimelinePoint {
  /** `yyyy-mm` in `byMonth`, `yyyy` in `byYear`. */
  period: string
  /** Entries whose day falls in the period. */
  entries: number
  shiny: number
  /** Slots caught for the first time in the period. */
  newSlots: number
  /** Running totals at the end of the period. */
  totalEntries: number
  totalSlots: number
}

export interface Streaks {
  /** Consecutive days with a catch, ending today or yesterday (a streak survives until a full day is missed). */
  current: number
  longest: number
  /** Last day of the longest streak, `yyyy-mm-dd`. */
  longestEnd: string | null
  /** Distinct days with at least one catch. */
  activeDays: number
  firstDay: string | null
  lastDay: string | null
  /** There is a catch dated today. */
  caughtToday: boolean
}

export interface EntryCounts {
  entries: number
  shiny: number
  alpha: number
  gmax: number
  male: number
  female: number
  genderless: number
  nicknamed: number
  withNotes: number
  level100: number
  /** Entries beyond the first in their slot. */
  duplicates: number
  /** Entries whose game id the app does not know. */
  unknownGame: number
  /** Entries without a ball. */
  noBall: number
}

export interface Progress {
  totals: CollectionTotals & {
    entries: number
    /** caught / slots, 0..1. */
    completion: number
    /** shiny slots / slots, 0..1. */
    shinyCompletion: number
  }
  counts: EntryCounts
  /** Generations that have species in the dataset, ascending. */
  byGeneration: GenerationProgress[]
  /** The 18 types in game order (plus any other type the slots use). A dual-type slot counts in both. */
  byType: TypeProgress[]
  /** Form categories that have at least one slot under the current rules. */
  byCategory: CategoryProgress[]
  /** Species tags (legendary, mythical, starter ...) present in the dataset. */
  byTag: TagProgress[]
  /** Every game of the dataset (plus any other known game with entries) in canonical order, unused ones included. */
  byGame: GameProgress[]
  /** Every system in `SYSTEMS` order, including those without entries. An entry counts for its game's primary system. */
  bySystem: SystemProgress[]
  /** Every ball in `BALLS` order, including unused ones. */
  byBall: BallProgress[]
  /** Every entry kind, including unused ones. */
  byKind: KindProgress[]
  /** One point per month from the first catch to the last, gaps included. Empty without entries. */
  byMonth: TimelinePoint[]
  byYear: TimelinePoint[]
  shiny: { entries: number; slots: number; species: number }
  /** What the entries cover, each list in canonical order. */
  distinct: { games: string[]; systems: SystemId[]; balls: number[]; kinds: EntryKind[]; generations: number[] }
  /** Evolution families: how many exist and how many have every member species caught. */
  families: { total: number; complete: number }
  /** The species with the most entries, most first. */
  topSpecies: Array<{ species: number; entries: number }>
  /** Most recently logged entries, newest first. */
  recent: CatchEntry[]
  streaks: Streaks
  /** The first uncaught slots in dex order. */
  nextUncaught: LivingSlot[]
}

export interface ProgressOptions {
  /** "Today" for streaks. Default: now. */
  now?: Date
  /** Length of `recent`. Default 10. */
  recent?: number
  /** Length of `nextUncaught`. Default 12. */
  suggestions?: number
  /** Length of `topSpecies`. Default 5. */
  top?: number
}

// ---------------------------------------------------------------- helpers

const TYPE_ORDER: readonly TypeId[] = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'
]
const CATEGORY_ORDER: readonly FormCategory[] = ['base', 'regional', 'gender', 'cosmetic', 'changeable', 'fusion', 'event', 'partner', 'mega', 'battle', 'hidden']
const TAG_ORDER: readonly SpeciesTag[] = ['starter', 'baby', 'fossil', 'pseudo-legendary', 'legendary', 'mythical', 'ultra-beast', 'paradox']

/** The day an entry counts for: its catch date, else the local day it was logged. */
export function entryDay(entry: Pick<CatchEntry, 'date' | 'createdAt'>): string {
  if (entry.date !== undefined && isIsoDate(entry.date)) return entry.date
  const logged = new Date(entry.createdAt)
  return Number.isNaN(logged.getTime()) ? '1970-01-01' : toIsoDate(logged)
}

const tally = (): SlotTally => ({ slots: 0, caught: 0, shiny: 0 })

function bump<K>(map: Map<K, SlotTally>, key: K, caught: boolean, shiny: boolean): void {
  let t = map.get(key)
  if (!t) map.set(key, (t = tally()))
  t.slots++
  if (caught) t.caught++
  if (shiny) t.shiny++
}

/** Streaks over a set of `yyyy-mm-dd` days, relative to `today`. */
export function computeStreaks(days: Iterable<string>, today: string): Streaks {
  const sorted = [...new Set(days)].filter(isIsoDate).sort()
  const empty: Streaks = { current: 0, longest: 0, longestEnd: null, activeDays: 0, firstDay: null, lastDay: null, caughtToday: false }
  if (sorted.length === 0) return empty

  let longest = 0
  let longestEnd: string | null = null
  let run = 0
  let previous: string | null = null
  /** Length of the run each day ends, for the "current" lookup below. */
  const runAt = new Map<string, number>()
  for (const day of sorted) {
    run = previous !== null && dayDiff(previous, day) === 1 ? run + 1 : 1
    runAt.set(day, run)
    if (run > longest) {
      longest = run
      longestEnd = day
    }
    previous = day
  }

  const caughtToday = runAt.has(today)
  const current = runAt.get(today) ?? runAt.get(addDays(today, -1)) ?? 0
  return { current, longest, longestEnd, activeDays: sorted.length, firstDay: sorted[0] ?? null, lastDay: sorted[sorted.length - 1] ?? null, caughtToday }
}

function timeline(points: Map<string, { entries: number; shiny: number; newSlots: number }>, periods: string[]): TimelinePoint[] {
  let totalEntries = 0
  let totalSlots = 0
  return periods.map((period) => {
    const p = points.get(period) ?? { entries: 0, shiny: 0, newSlots: 0 }
    totalEntries += p.entries
    totalSlots += p.newSlots
    return { period, ...p, totalEntries, totalSlots }
  })
}

function monthsBetween(first: string, last: string): string[] {
  const out: string[] = []
  let year = Number(first.slice(0, 4))
  let month = Number(first.slice(5, 7))
  const endYear = Number(last.slice(0, 4))
  const endMonth = Number(last.slice(5, 7))
  while (year < endYear || (year === endYear && month <= endMonth)) {
    out.push(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`)
    if (++month > 12) {
      month = 1
      year++
    }
  }
  return out
}

// ---------------------------------------------------------------- computeProgress

/** Derives every statistic from the collection. `collection` must have been computed from the same dex and entries. */
export function computeProgress(dex: Dex, save: { readonly entries: readonly CatchEntry[] }, collection: Collection, options: ProgressOptions = {}): Progress {
  const entries = save.entries
  const today = todayIso(options.now ?? new Date())
  const { caught, caughtShiny, speciesCaught, slotOfEntry } = collection

  // ---- slots: generation, type, category
  const genSlots = new Map<number, SlotTally>()
  const typeSlots = new Map<TypeId, SlotTally>()
  const catSlots = new Map<FormCategory, SlotTally>()
  for (const type of TYPE_ORDER) typeSlots.set(type, tally())
  for (const slot of collection.slots) {
    const isCaught = caught.has(slot.key)
    const isShiny = caughtShiny.has(slot.key)
    const species = dex.species(slot.species)
    if (species) bump(genSlots, species.gen, isCaught, isShiny)
    bump(catSlots, slot.cat, isCaught, isShiny)
    for (const type of dex.form(slot.species, slot.form)?.types ?? []) bump(typeSlots, type, isCaught, isShiny)
  }

  // ---- species: generation, tags, families
  const genSpecies = new Map<number, { species: number; speciesCaught: number }>()
  const tagSpecies = new Map<SpeciesTag, { species: number; speciesCaught: number }>()
  const families = new Map<number, boolean>()
  for (const species of dex.speciesList) {
    const has = speciesCaught.has(species.id)
    const g = genSpecies.get(species.gen) ?? { species: 0, speciesCaught: 0 }
    g.species++
    if (has) g.speciesCaught++
    genSpecies.set(species.gen, g)
    for (const tag of species.tags) {
      const t = tagSpecies.get(tag) ?? { species: 0, speciesCaught: 0 }
      t.species++
      if (has) t.speciesCaught++
      tagSpecies.set(tag, t)
    }
    families.set(species.family, (families.get(species.family) ?? true) && has)
  }

  // ---- entries: games, systems, balls, kinds, counts, days
  const gameStats = new Map<string, { entries: number; shiny: number; species: Set<number>; slots: Set<string> }>()
  const ballStats = new Map<number, { entries: number; shiny: number }>()
  const kindStats = new Map<EntryKind, number>()
  const perSpecies = new Map<number, number>()
  const counts: EntryCounts = {
    entries: entries.length, shiny: 0, alpha: 0, gmax: 0, male: 0, female: 0, genderless: 0, nicknamed: 0, withNotes: 0, level100: 0,
    duplicates: slotOfEntry.size - caught.size, unknownGame: 0, noBall: 0
  }
  const days: string[] = []
  const dated: Array<{ entry: CatchEntry; day: string }> = []

  for (const entry of entries) {
    if (entry.shiny) counts.shiny++
    if (entry.alpha) counts.alpha++
    if (entry.gmax) counts.gmax++
    if (entry.gender === 'm') counts.male++
    else if (entry.gender === 'f') counts.female++
    else if (entry.gender === 'n') counts.genderless++
    if (entry.nickname) counts.nicknamed++
    if (entry.notes) counts.withNotes++
    if (entry.level === 100) counts.level100++

    if (GAME_BY_ID.has(entry.game)) {
      let g = gameStats.get(entry.game)
      if (!g) gameStats.set(entry.game, (g = { entries: 0, shiny: 0, species: new Set(), slots: new Set() }))
      g.entries++
      if (entry.shiny) g.shiny++
      g.species.add(entry.species)
      const key = slotOfEntry.get(entry.id)
      if (key !== undefined) g.slots.add(key)
    } else {
      counts.unknownGame++
    }

    if (entry.ball === undefined) counts.noBall++
    else {
      const b = ballStats.get(entry.ball) ?? { entries: 0, shiny: 0 }
      b.entries++
      if (entry.shiny) b.shiny++
      ballStats.set(entry.ball, b)
    }

    kindStats.set(entry.kind, (kindStats.get(entry.kind) ?? 0) + 1)
    perSpecies.set(entry.species, (perSpecies.get(entry.species) ?? 0) + 1)

    const day = entryDay(entry)
    days.push(day)
    dated.push({ entry, day })
  }

  // The dataset's games plus any other known game the user logged, in canonical order.
  const datasetGames = new Set(dex.games)
  const byGame: GameProgress[] = GAMES.filter((game) => datasetGames.has(game) || gameStats.has(game.id)).map((game) => {
    const g = gameStats.get(game.id)
    return { game, entries: g?.entries ?? 0, shiny: g?.shiny ?? 0, species: g?.species.size ?? 0, slots: g?.slots.size ?? 0 }
  })

  const bySystem: SystemProgress[] = SYSTEMS.map((system) => {
    const games = byGame.filter((g) => g.game.system === system.id && g.entries > 0)
    return { system, entries: games.reduce((n, g) => n + g.entries, 0), shiny: games.reduce((n, g) => n + g.shiny, 0), games: games.length }
  })

  const byBall: BallProgress[] = BALLS.map((ball) => ({ ball, entries: ballStats.get(ball.id)?.entries ?? 0, shiny: ballStats.get(ball.id)?.shiny ?? 0 }))
  const byKind: KindProgress[] = ENTRY_KINDS.map((kind) => ({ kind, entries: kindStats.get(kind) ?? 0 }))

  // ---- timeline: walk entries in day order so "new slot" means the first catch of that slot
  dated.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.entry.createdAt < b.entry.createdAt ? -1 : a.entry.createdAt > b.entry.createdAt ? 1 : 0))
  const months = new Map<string, { entries: number; shiny: number; newSlots: number }>()
  const years = new Map<string, { entries: number; shiny: number; newSlots: number }>()
  const seenSlots = new Set<string>()
  for (const { entry, day } of dated) {
    const key = slotOfEntry.get(entry.id)
    const isNew = key !== undefined && !seenSlots.has(key)
    if (isNew) seenSlots.add(key)
    for (const [map, period] of [[months, day.slice(0, 7)], [years, day.slice(0, 4)]] as const) {
      const p = map.get(period) ?? { entries: 0, shiny: 0, newSlots: 0 }
      p.entries++
      if (entry.shiny) p.shiny++
      if (isNew) p.newSlots++
      map.set(period, p)
    }
  }
  const firstDay = dated[0]?.day
  const lastDay = dated[dated.length - 1]?.day
  const byMonth = firstDay && lastDay ? timeline(months, monthsBetween(firstDay, lastDay)) : []
  const byYear: TimelinePoint[] = []
  if (firstDay && lastDay) {
    const periods: string[] = []
    for (let y = Number(firstDay.slice(0, 4)); y <= Number(lastDay.slice(0, 4)); y++) periods.push(String(y).padStart(4, '0'))
    byYear.push(...timeline(years, periods))
  }

  // ---- assemble
  const gens = [...new Set([...genSpecies.keys(), ...genSlots.keys()])].sort((a, b) => a - b)
  const byGeneration: GenerationProgress[] = gens.map((gen) => ({
    gen,
    name: GENERATION_NAMES[gen] ?? `Generation ${gen}`,
    ...(genSlots.get(gen) ?? tally()),
    species: genSpecies.get(gen)?.species ?? 0,
    speciesCaught: genSpecies.get(gen)?.speciesCaught ?? 0
  }))

  const typeOrder = [...TYPE_ORDER, ...[...typeSlots.keys()].filter((t) => !TYPE_ORDER.includes(t))]
  const byType: TypeProgress[] = typeOrder.map((type) => ({ type, ...(typeSlots.get(type) ?? tally()) }))
  const byCategory: CategoryProgress[] = CATEGORY_ORDER.filter((cat) => catSlots.has(cat)).map((cat) => ({ cat, ...(catSlots.get(cat) ?? tally()) }))
  const byTag: TagProgress[] = TAG_ORDER.filter((tag) => tagSpecies.has(tag)).map((tag) => ({ tag, ...(tagSpecies.get(tag) ?? { species: 0, speciesCaught: 0 }) }))

  const usedGames = byGame.filter((g) => g.entries > 0)
  const recentCount = options.recent ?? 10
  const recent = recentCount <= 0 ? [] : [...entries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)).slice(0, recentCount)

  const nextUncaught: LivingSlot[] = []
  const wanted = options.suggestions ?? 12
  for (const slot of collection.slots) {
    if (nextUncaught.length >= wanted) break
    if (!caught.has(slot.key)) nextUncaught.push(slot)
  }

  const topSpecies = [...perSpecies.entries()]
    .map(([species, n]) => ({ species, entries: n }))
    .sort((a, b) => b.entries - a.entries || a.species - b.species)
    .slice(0, options.top ?? 5)

  return {
    totals: {
      ...collection.totals,
      entries: entries.length,
      completion: ratio(collection.totals.caught, collection.totals.slots),
      shinyCompletion: ratio(collection.totals.shiny, collection.totals.slots)
    },
    counts,
    byGeneration,
    byType,
    byCategory,
    byTag,
    byGame,
    bySystem,
    byBall,
    byKind,
    byMonth,
    byYear,
    shiny: { entries: counts.shiny, slots: collection.totals.shiny, species: collection.speciesShiny.size },
    distinct: {
      games: usedGames.map((g) => g.game.id),
      systems: bySystem.filter((s) => s.entries > 0).map((s) => s.system.id),
      balls: byBall.filter((b) => b.entries > 0).map((b) => b.ball.id),
      kinds: byKind.filter((k) => k.entries > 0).map((k) => k.kind),
      generations: [...new Set(usedGames.map((g) => g.game.generation))].filter((g) => g > 0).sort((a, b) => a - b)
    },
    families: { total: families.size, complete: [...families.values()].filter(Boolean).length },
    topSpecies,
    recent,
    streaks: computeStreaks(days, today),
    nextUncaught
  }
}

// ---------------------------------------------------------------- memo + hook

let lastProgress: { dex: Dex; entries: readonly CatchEntry[]; collection: Collection; day: string; value: Progress } | null = null

/**
 * `computeProgress` with default options, cached for the latest (dex, entries, collection, day),
 * so the dashboard and the achievements engine share one computation per change.
 */
export function progressFor(dex: Dex, entries: readonly CatchEntry[], collection: Collection, now: Date = new Date()): Progress {
  const day = todayIso(now)
  const hit = lastProgress
  if (hit && hit.dex === dex && hit.entries === entries && hit.collection === collection && hit.day === day) return hit.value
  const value = computeProgress(dex, { entries }, collection, { now })
  lastProgress = { dex, entries, collection, day, value }
  return value
}

/** Current progress statistics. Recomputes when the entries or rules change, and on the first render of a new day. */
export function useProgress(): Progress {
  const dex = useDex()
  const entries = useEntries()
  const collection = useCollection()
  const day = todayIso()
  // `day` is a dependency so streaks roll over at midnight.
  return useMemo(() => progressFor(dex, entries, collection), [dex, entries, collection, day])
}
