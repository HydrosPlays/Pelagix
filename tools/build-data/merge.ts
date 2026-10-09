/**
 * Turns row drafts into the final rows of each form: applies the Scarlet / Violet exclusives,
 * settles crossover locations, collapses time / weather / star conditions per location, merges
 * level ranges and then games.
 */
import type { EventInfo, SourceVia, EncounterKind } from '../../src/shared/dex-types.ts'
import { GAMES } from '../../src/shared/games.ts'
import { starRange, TIME_ORDER, WEATHER_ORDER, weatherLabel } from './methods.ts'
import type { RowDraft } from './rows.ts'
import { SCARLET_IDX, svExclusive, VIOLET_IDX } from './sv-exclusives.ts'
import { groupBy, sf, uniqSorted } from './util.ts'

/** A finished row before its location is replaced by a string-table index. */
export interface FinalRow {
  g: number[]
  k: EncounterKind
  m?: string
  loc?: string
  lv: [number, number]
  c?: string[]
  s?: 'locked' | 'forced'
  b?: number
  d?: 0 | 1 | 2
  n?: string
  via?: SourceVia
  rf?: 1
  x?: EventInfo
  /** Shown here on behalf of a hidden form; availability.ts does not treat it as a source. Not written out. */
  copy?: boolean
}

export interface MergeStats {
  drafts: number
  svDropped: number
  crossKept: number
  crossDropped: number
  weatherListed: number
  weatherDropped: number
  timeListed: number
  timeDropped: number
  afterLevelMerge: number
  rows: number
}

function applySvExclusives(drafts: RowDraft[], stats: MergeStats): RowDraft[] {
  return drafts.filter((d) => {
    if (!d.svShared) return true
    const only = svExclusive(d.s, d.f)
    const keep = only === undefined || (only === 'scarlet' ? d.game === SCARLET_IDX : d.game === VIOLET_IDX)
    if (!keep) stats.svDropped++
    return keep
  })
}

/** A crossover location is kept only when the form has no ordinary row there in that game. */
function settleCrossovers(drafts: RowDraft[], stats: MergeStats): RowDraft[] {
  const primary = new Set<string>()
  for (const d of drafts) if (!d.cross && d.loc !== undefined) primary.add(`${d.s}|${d.f}|${d.game}|${d.loc}`)
  const out: RowDraft[] = []
  for (const d of drafts) {
    if (!d.cross) {
      out.push(d)
      continue
    }
    if (primary.has(`${d.s}|${d.f}|${d.game}|${d.loc}`)) {
      stats.crossDropped++
      continue
    }
    stats.crossKept++
    // The weather and time of the area it came from say nothing about where it is met.
    const copy: RowDraft = { ...d }
    delete copy.weather
    delete copy.time
    out.push(copy)
  }
  return out
}

const collapseKey = (d: RowDraft): string =>
  JSON.stringify([d.s, d.f, d.game, d.k, d.m ?? '', d.loc ?? '', d.c, d.sh ?? '', d.b ?? '', d.d ?? '', d.notes, d.via ?? '', d.rf ?? '', d.x ?? '', d.cross ?? false])

function unionOrAny(sets: (string[] | undefined)[]): Set<string> | undefined {
  const out = new Set<string>()
  for (const set of sets) {
    if (set === undefined) return undefined
    for (const v of set) out.add(v)
  }
  return out
}

interface Collapsed {
  d: RowDraft
  lv: [number, number]
  c: string[]
  /** Every draft behind it is a copy from a hidden form. */
  copy: boolean
}

export function finalizeRows(input: RowDraft[]): { rows: Map<number, FinalRow[]>; stats: MergeStats } {
  const stats: MergeStats = {
    drafts: input.length, svDropped: 0, crossKept: 0, crossDropped: 0, weatherListed: 0, weatherDropped: 0,
    timeListed: 0, timeDropped: 0, afterLevelMerge: 0, rows: 0
  }
  const drafts = settleCrossovers(applySvExclusives(input, stats), stats)

  // Weathers each location can have, as seen over every Pokémon found there.
  const weatherAt = new Map<string, Set<string>>()
  for (const d of drafts) {
    if (!d.weather || d.loc === undefined) continue
    const key = `${d.game}|${d.loc}`
    let set = weatherAt.get(key)
    if (!set) weatherAt.set(key, (set = new Set()))
    for (const w of d.weather) set.add(w)
  }

  const collapsed: Collapsed[] = []
  for (const group of groupBy(drafts, collapseKey).values()) {
    const d = group[0]
    const lv: [number, number] = [Math.min(...group.map((x) => x.lv[0])), Math.max(...group.map((x) => x.lv[1]))]
    const c: string[] = []

    const time = unionOrAny(group.map((x) => x.time))
    if (time) {
      const periods = GAMES[d.game].generation === 2 ? 3 : 4
      if (time.size >= periods) stats.timeDropped++
      else {
        stats.timeListed++
        c.push(...TIME_ORDER.filter((t) => time.has(t)))
      }
    }

    const weather = unionOrAny(group.map((x) => x.weather))
    if (weather) {
      const possible = d.loc === undefined ? undefined : weatherAt.get(`${d.game}|${d.loc}`)
      const most = possible ? possible.size <= 1 || weather.size * 2 > possible.size : weather.size > 4
      if (most) stats.weatherDropped++
      else {
        stats.weatherListed++
        c.push(...WEATHER_ORDER.filter((w) => weather.has(w)).map(weatherLabel))
      }
    }

    c.push(...d.c)
    const starred = group.filter((x) => x.stars)
    if (starred.length > 0) c.push(starRange(Math.min(...starred.map((x) => x.stars![0])), Math.max(...starred.map((x) => x.stars![1]))))
    collapsed.push({ d, lv, c, copy: group.every((x) => x.copy === true) })
  }
  stats.afterLevelMerge = collapsed.length

  // Rows identical except for the game merge their game lists.
  const rows = new Map<number, FinalRow[]>()
  const gameKey = (x: Collapsed): string => {
    const d = x.d
    return JSON.stringify([d.s, d.f, d.k, d.m ?? '', d.loc ?? '', x.lv, x.c, d.sh ?? '', d.b ?? '', d.d ?? '', d.notes, d.via ?? '', d.rf ?? '', d.x ?? '', x.copy])
  }
  for (const group of groupBy(collapsed, gameKey).values()) {
    const { d, lv, c } = group[0]
    const row: FinalRow = { g: uniqSorted(group.map((x) => x.d.game)), k: d.k, lv }
    if (d.m !== undefined) row.m = d.m
    if (d.loc !== undefined) row.loc = d.loc
    if (c.length > 0) row.c = c
    if (d.sh) row.s = d.sh
    if (d.b !== undefined) row.b = d.b
    if (d.d !== undefined) row.d = d.d
    if (d.notes.length > 0) row.n = d.notes.join(' · ')
    if (d.via) row.via = d.via
    if (d.rf) row.rf = 1
    if (d.x) row.x = d.x
    if (group[0].copy) row.copy = true
    const key = sf(d.s, d.f)
    const list = rows.get(key)
    if (list) list.push(row)
    else rows.set(key, [row])
    stats.rows++
  }
  return { rows, stats }
}
