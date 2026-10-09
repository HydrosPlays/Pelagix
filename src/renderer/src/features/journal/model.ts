/**
 * The Journal as data: every entry with what it can be searched and filtered by, the filters
 * themselves, and the sorted, grouped rows the list draws. Pure functions.
 */

import { BALL_BY_ID, BALLS } from '@shared/balls'
import { GAMES, GENERATION_NAMES, SYSTEMS, type GameDef, type SystemId } from '@shared/games'
import type { CatchEntry, EntryKind } from '@shared/save-types'
import { describeEntry } from '@renderer/domain/entries'
import { entryDay } from '@renderer/domain/progress'
import type { Dex } from '@renderer/lib/data'
import { ENTRY_KINDS, formatDate, formatMonth, isIsoDate, kindLabel, plural, toIsoDate } from '@renderer/lib/format'
import { normalizeText } from '@renderer/lib/search'

// ---------------------------------------------------------------- index

/** Stands in for every game id this build does not know, as a filter value and a group. */
export const UNKNOWN_GAME = '?'

export interface JournalItem {
  entry: CatchEntry
  /** Display name of what was caught ("Alolan Raichu"). */
  name: string
  /** Normalised text the search box matches against. */
  hay: string
  /** Day it counts for (catch date, else the day it was logged), `yyyy-mm-dd`. */
  day: string
  /** Local day it was logged, `yyyy-mm-dd`. */
  loggedDay: string
  game: GameDef | undefined
  /** `GameDef.id`, or `UNKNOWN_GAME`. */
  gameKey: string
  /** Generation of the game (0 for Pokémon GO / HOME); -1 for an unknown game. */
  gameGen: number
  system: SystemId | undefined
  /** Debut generation of the Pokémon; 0 when the dataset does not know it. */
  speciesGen: number
}

const GAME_RANK: ReadonlyMap<string, number> = new Map(GAMES.map((g, i) => [g.id, i]))

function loggedDayOf(entry: CatchEntry): string {
  const logged = new Date(entry.createdAt)
  return Number.isNaN(logged.getTime()) ? entryDay(entry) : toIsoDate(logged)
}

/** Resolves every entry once, so filtering and sorting thousands of them stays cheap. */
export function indexEntries(dex: Dex, entries: readonly CatchEntry[]): JournalItem[] {
  return entries.map((entry) => {
    const view = describeEntry(dex, entry)
    const game = view.game
    const text = [view.name, view.species?.name, entry.nickname, entry.location, entry.method, entry.notes, entry.ot, game?.name, view.ball?.name, kindLabel(entry.kind), String(entry.species)]
    return {
      entry,
      name: view.name,
      hay: normalizeText(text.filter((t): t is string => t !== undefined && t !== '').join(' \n ')),
      day: view.day,
      loggedDay: loggedDayOf(entry),
      game,
      gameKey: game ? game.id : UNKNOWN_GAME,
      gameGen: game ? game.generation : -1,
      system: game?.system,
      speciesGen: view.species?.gen ?? 0
    }
  })
}

// ---------------------------------------------------------------- filters

export interface JournalFilters {
  text: string
  /** `GameDef.id` values, or `UNKNOWN_GAME`. */
  games: readonly string[]
  /** Generations of the game (0 = Pokémon GO / HOME). */
  gens: readonly number[]
  systems: readonly SystemId[]
  /** PKHeX ball ids. */
  balls: readonly number[]
  kinds: readonly EntryKind[]
  shinyOnly: boolean
  /** Catch-day range, `yyyy-mm-dd`; "" for open. */
  from: string
  to: string
}

export const NO_FILTERS: JournalFilters = Object.freeze({ text: '', games: [], gens: [], systems: [], balls: [], kinds: [], shinyOnly: false, from: '', to: '' })

/** How many separate filters are switched on (each list counts once, the date range once). */
export function activeFilterCount(f: JournalFilters): number {
  return (
    Number(f.text.trim() !== '') + Number(f.games.length > 0) + Number(f.gens.length > 0) + Number(f.systems.length > 0) + Number(f.balls.length > 0) + Number(f.kinds.length > 0) + Number(f.shinyOnly) + Number(f.from !== '' || f.to !== '')
  )
}

/** The items that pass every active filter, in their original order. */
export function filterItems(items: readonly JournalItem[], f: JournalFilters): JournalItem[] {
  const tokens = normalizeText(f.text).split(' ').filter(Boolean)
  const games = f.games.length > 0 ? new Set(f.games) : null
  const gens = f.gens.length > 0 ? new Set(f.gens) : null
  const systems = f.systems.length > 0 ? new Set<string>(f.systems) : null
  const balls = f.balls.length > 0 ? new Set(f.balls) : null
  const kinds = f.kinds.length > 0 ? new Set<string>(f.kinds) : null
  const from = isIsoDate(f.from) ? f.from : ''
  const to = isIsoDate(f.to) ? f.to : ''
  // A range typed backwards still means the days between the two.
  const [low, high] = from !== '' && to !== '' && from > to ? [to, from] : [from, to]

  return items.filter((item) => {
    const { entry } = item
    if (f.shinyOnly && !entry.shiny) return false
    if (games && !games.has(item.gameKey)) return false
    if (gens && !gens.has(item.gameGen)) return false
    if (systems && (item.system === undefined || !systems.has(item.system))) return false
    if (balls && (entry.ball === undefined || !balls.has(entry.ball))) return false
    if (kinds && !kinds.has(entry.kind)) return false
    if (low !== '' && item.day < low) return false
    if (high !== '' && item.day > high) return false
    for (const token of tokens) if (!item.hay.includes(token)) return false
    return true
  })
}

// ---------------------------------------------------------------- facets (what the filter menus offer)

export interface Facet<T> {
  value: T
  label: string
  count: number
}

export interface JournalFacets {
  games: Array<Facet<string> & { game: GameDef | undefined }>
  gens: Array<Facet<number>>
  systems: Array<Facet<SystemId>>
  balls: Array<Facet<number>>
  kinds: Array<Facet<EntryKind>>
}

/** "Generation IV", or the services' own label for generation 0. */
export function gameGenLabel(gen: number): string {
  return gen === 0 ? 'Pokémon GO & HOME' : (GENERATION_NAMES[gen] ?? `Generation ${gen}`)
}

function tally<K>(keys: Iterable<K | undefined>): Map<K, number> {
  const counts = new Map<K, number>()
  for (const key of keys) if (key !== undefined) counts.set(key, (counts.get(key) ?? 0) + 1)
  return counts
}

/** Every value that occurs in the Journal, with how many entries carry it, in the app's canonical orders. */
export function computeFacets(items: readonly JournalItem[]): JournalFacets {
  const games = tally(items.map((i) => i.gameKey))
  const gens = tally(items.map((i) => (i.gameGen >= 0 ? i.gameGen : undefined)))
  const systems = tally(items.map((i) => i.system))
  const balls = tally(items.map((i) => i.entry.ball))
  const kinds = tally(items.map((i) => i.entry.kind))
  const knownBalls = BALLS.filter((b) => balls.has(b.id)).map((b) => ({ value: b.id, label: b.name, count: balls.get(b.id) ?? 0 }))
  const otherBalls = [...balls.keys()].filter((id) => !BALL_BY_ID.has(id)).map((id) => ({ value: id, label: 'Unknown ball', count: balls.get(id) ?? 0 }))
  return {
    games: [
      ...GAMES.filter((g) => games.has(g.id)).map((g) => ({ value: g.id, label: g.name, count: games.get(g.id) ?? 0, game: g })),
      ...(games.has(UNKNOWN_GAME) ? [{ value: UNKNOWN_GAME, label: 'Unknown game', count: games.get(UNKNOWN_GAME) ?? 0, game: undefined }] : [])
    ],
    gens: [...gens.keys()].sort((a, b) => (a === 0 ? 99 : a) - (b === 0 ? 99 : b)).map((gen) => ({ value: gen, label: gameGenLabel(gen), count: gens.get(gen) ?? 0 })),
    systems: SYSTEMS.filter((s) => systems.has(s.id)).map((s) => ({ value: s.id, label: s.name, count: systems.get(s.id) ?? 0 })),
    balls: [...knownBalls, ...otherBalls],
    kinds: ENTRY_KINDS.filter((k) => kinds.has(k)).map((k) => ({ value: k, label: kindLabel(k), count: kinds.get(k) ?? 0 }))
  }
}

// ---------------------------------------------------------------- summary

export interface JournalSummary {
  entries: number
  /** Distinct species. */
  pokemon: number
  shiny: number
  /** Known games with entries, canonical order. */
  games: Array<{ game: GameDef; count: number }>
  /** Entries whose game this build does not know. */
  unknownGames: number
  /** Systems with entries (a game counts for its primary system), in release order of the table. */
  systems: Array<{ system: SystemId; name: string; count: number }>
}

export function summarize(items: readonly JournalItem[]): JournalSummary {
  const species = new Set<number>()
  let shiny = 0
  for (const item of items) {
    species.add(item.entry.species)
    if (item.entry.shiny) shiny++
  }
  const games = tally(items.map((i) => i.gameKey))
  const systems = tally(items.map((i) => i.system))
  return {
    entries: items.length,
    pokemon: species.size,
    shiny,
    games: GAMES.filter((g) => games.has(g.id)).map((g) => ({ game: g, count: games.get(g.id) ?? 0 })),
    unknownGames: games.get(UNKNOWN_GAME) ?? 0,
    systems: SYSTEMS.filter((s) => systems.has(s.id)).map((s) => ({ system: s.id, name: s.name, count: systems.get(s.id) ?? 0 }))
  }
}

/**
 * "128 entries · 9 shiny · 14 games" for whatever is listed. Games are counted the way the
 * summary strip counts them: entries from a game this version does not know add none.
 */
export function countsLine(items: readonly JournalItem[]): string {
  let shiny = 0
  const games = new Set<string>()
  for (const item of items) {
    if (item.entry.shiny) shiny++
    if (item.gameKey !== UNKNOWN_GAME) games.add(item.gameKey)
  }
  const head = `${plural(items.length, 'entry', 'entries')} · ${shiny.toLocaleString('en-US')} shiny`
  return games.size > 0 ? `${head} · ${plural(games.size, 'game')}` : head
}

// ---------------------------------------------------------------- sorting and grouping

export type JournalSort = 'caught' | 'logged' | 'dex' | 'game'
export type SortDirection = 'asc' | 'desc'

export const SORT_LABELS: Readonly<Record<JournalSort, string>> = { caught: 'Date caught', logged: 'Date logged', dex: 'Pokédex number', game: 'Game' }
export const JOURNAL_SORTS = Object.keys(SORT_LABELS) as readonly JournalSort[]
/** The direction each sort starts in: newest first for dates, ascending for the rest. */
export const DEFAULT_DIRECTION: Readonly<Record<JournalSort, SortDirection>> = { caught: 'desc', logged: 'desc', dex: 'asc', game: 'asc' }

export interface JournalGroup {
  /** Unique among the groups of one listing. */
  key: string
  label: string
  /** Set on the groups of the "game" sort; `UNKNOWN_GAME` for the unknown ones. */
  gameKey?: string
  count: number
  shiny: number
}

export type JournalRow = { kind: 'header'; key: string; group: JournalGroup } | { kind: 'entry'; key: string; item: JournalItem; group: JournalGroup }

export interface JournalListing {
  rows: JournalRow[]
  groups: JournalGroup[]
  /** Row index of every entry, by entry id. */
  rowOf: Map<string, number>
  /** Entry ids in list order (what shift-click ranges and "select all" walk). */
  order: string[]
}

const text = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
const gameRank = (item: JournalItem): number => GAME_RANK.get(item.gameKey) ?? Number.MAX_SAFE_INTEGER

const COMPARE: Readonly<Record<JournalSort, (a: JournalItem, b: JournalItem) => number>> = {
  caught: (a, b) => text(a.day, b.day) || text(a.entry.createdAt, b.entry.createdAt),
  logged: (a, b) => text(a.entry.createdAt, b.entry.createdAt),
  dex: (a, b) => a.entry.species - b.entry.species || a.entry.form - b.entry.form || text(a.entry.createdAt, b.entry.createdAt),
  // Inside a game the newest catch leads, whichever way the games themselves run.
  game: (a, b) => gameRank(a) - gameRank(b)
}

function groupOf(item: JournalItem, sort: JournalSort): { key: string; label: string; gameKey?: string } {
  switch (sort) {
    case 'caught':
    case 'logged': {
      const month = (sort === 'caught' ? item.day : item.loggedDay).slice(0, 7)
      return { key: month, label: formatMonth(month, true) || 'Undated' }
    }
    case 'dex':
      return { key: `gen-${item.speciesGen}`, label: item.speciesGen > 0 ? (GENERATION_NAMES[item.speciesGen] ?? `Generation ${item.speciesGen}`) : 'Unknown Pokémon' }
    case 'game':
      return { key: `game-${item.gameKey}`, label: item.game?.name ?? 'Unknown game', gameKey: item.gameKey }
  }
}

/** Sorts the items and cuts them into groups, each led by a header row. */
export function buildListing(items: readonly JournalItem[], sort: JournalSort, direction: SortDirection): JournalListing {
  const sign = direction === 'desc' ? -1 : 1
  const compare = COMPARE[sort]
  const sorted = [...items].sort((a, b) => sign * compare(a, b) || (sort === 'game' ? text(b.day, a.day) || text(b.entry.createdAt, a.entry.createdAt) : 0))

  const rows: JournalRow[] = []
  const groups: JournalGroup[] = []
  const rowOf = new Map<string, number>()
  const order: string[] = []
  let current: JournalGroup | null = null
  for (const item of sorted) {
    const g = groupOf(item, sort)
    if (!current || current.key !== g.key) {
      current = { ...g, count: 0, shiny: 0 }
      groups.push(current)
      rows.push({ kind: 'header', key: `h:${g.key}`, group: current })
    }
    current.count++
    if (item.entry.shiny) current.shiny++
    rowOf.set(item.entry.id, rows.length)
    order.push(item.entry.id)
    rows.push({ kind: 'entry', key: item.entry.id, item, group: current })
  }
  return { rows, groups, rowOf, order }
}

// ---------------------------------------------------------------- date range wording

/** "1 Mar 2025 – 9 Oct 2026", "From 1 Mar 2025", "Until 9 Oct 2026"; "" without a range. */
export function rangeLabel(from: string, to: string): string {
  const a = isIsoDate(from) ? from : ''
  const b = isIsoDate(to) ? to : ''
  if (a === '' && b === '') return ''
  if (a !== '' && b !== '') {
    const [low, high] = a > b ? [b, a] : [a, b]
    return low === high ? formatDate(low) : `${formatDate(low)} – ${formatDate(high)}`
  }
  return a !== '' ? `From ${formatDate(a)}` : `Until ${formatDate(b)}`
}

/** The ids between two entries of a listing, both included, in list order (a shift-click range). */
export function idRange(order: readonly string[], a: string, b: string): string[] {
  const i = order.indexOf(a)
  const j = order.indexOf(b)
  if (i < 0 || j < 0) return j >= 0 ? [b] : []
  return order.slice(Math.min(i, j), Math.max(i, j) + 1)
}
