/** Canonical order and merge identity of EncounterRow, shared by the builder and the validator. */
import type { EncounterRow } from '../../src/shared/dex-types.ts'
import { KIND_ORDER } from './methods.ts'
import { cmpNum, cmpStr } from './util.ts'

const kindRank = new Map(KIND_ORDER.map((k, i) => [k, i]))

/** Method labels of raids and outbreaks that were distributed for a limited time. */
export const EVENT_MAX_RAID = 'Event Max Raid'
export const EVENT_TERA_RAID = 'Event Tera Raid'
export const MIGHTIEST_TERA_RAID = '7★ Tera Raid'
export const EVENT_OUTBREAK = 'Event Mass Outbreak'
/** Watchtower Ruins dens that only open with a Dynamax Crystal, an item handed out by serial code. */
export const CRYSTAL_MAX_RAID = 'Dynamax Crystal den'
/** Dream World Pokémon that were only offered through a Global Link campaign or password. */
export const GLOBAL_LINK_PROMOTION = 'Global Link promotion'

/** Method label of a Pokéwalker course. */
export const pokewalkerMethod = (course: string): string => `Pokéwalker - ${course}`
/**
 * Pokéwalker courses that were themselves distributed (Wi-Fi or local events), or that only open
 * with an event Pokémon: course name -> what unlocked it.
 */
export const POKEWALKER_EVENT_COURSES: Readonly<Record<string, string>> = {
  'Yellow Forest': 'Course distributed over Wi-Fi',
  "Winner's Path": 'Course distributed over Wi-Fi',
  Rally: 'Course distributed at events',
  Sightseeing: 'Course distributed at events in Japan',
  'Amity Meadow': 'Course distributed at events in Japan',
  "Night Sky's Edge": 'Course unlocked by a distributed Jirachi'
}

const TIME_LIMITED_METHODS: ReadonlySet<string> = new Set([
  EVENT_MAX_RAID, EVENT_TERA_RAID, MIGHTIEST_TERA_RAID, EVENT_OUTBREAK, CRYSTAL_MAX_RAID, GLOBAL_LINK_PROMOTION,
  ...Object.keys(POKEWALKER_EVENT_COURSES).map(pokewalkerMethod)
])

/**
 * A source that only existed for a limited time: a distribution (kind "event"), or a den / Tera
 * raid / mass outbreak / Dream World campaign / Pokéwalker course that was itself distributed.
 * Such rows do not make a form "obtainable" (FormSummary.obtain); a game whose only sources are
 * of this sort is listed under FormSummary.event instead.
 */
export function isTimeLimited(row: { k: EncounterRow['k']; m?: string }): boolean {
  return row.k === 'event' || (row.m !== undefined && TIME_LIMITED_METHODS.has(row.m))
}

/** Everything that identifies a row except its games and its level range. */
export function rowIdentity(row: EncounterRow, strings: readonly string[]): string {
  return JSON.stringify([
    row.k, row.m ?? '', row.l === undefined ? '' : strings[row.l], row.c ?? [], row.s ?? '', row.b ?? '', row.d ?? '',
    row.n ?? '', row.via ?? '', row.rf ?? '', row.x ?? ''
  ])
}

/**
 * Sort order of a form's rows: earliest game, kind, location name, level, then every remaining
 * field so the order is total and the output deterministic.
 */
export function compareRows(a: EncounterRow, b: EncounterRow, strings: readonly string[]): number {
  return (
    cmpNum(a.g[0], b.g[0]) ||
    cmpNum(kindRank.get(a.k)!, kindRank.get(b.k)!) ||
    cmpStr(a.l === undefined ? '' : strings[a.l], b.l === undefined ? '' : strings[b.l]) ||
    cmpNum(a.lv[0], b.lv[0]) ||
    cmpNum(a.lv[1], b.lv[1]) ||
    cmpStr(a.m ?? '', b.m ?? '') ||
    cmpStr((a.c ?? []).join('|'), (b.c ?? []).join('|')) ||
    cmpStr(a.n ?? '', b.n ?? '') ||
    cmpStr(JSON.stringify(a.x ?? null), JSON.stringify(b.x ?? null)) ||
    cmpStr(a.s ?? '', b.s ?? '') ||
    cmpNum(a.b ?? -1, b.b ?? -1) ||
    cmpNum(a.d ?? -1, b.d ?? -1) ||
    cmpStr(a.via ?? '', b.via ?? '') ||
    cmpNum(a.rf ?? 0, b.rf ?? 0) ||
    cmpStr(a.g.join(','), b.g.join(','))
  )
}
