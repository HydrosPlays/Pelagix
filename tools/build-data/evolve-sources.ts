/**
 * FormDetail.evolve: the ways to get a form out of another one, per game. Two kinds share the
 * list: evolutions (from another species) and in-game form changes (from another form of the same
 * species, form-changes.ts).
 *
 * - An evolution is listed for every game where it works and both ends exist.
 * - A curated form change is listed where its mechanism exists and, for a fusion, the partner can
 *   be had in that game. The opposite direction ("take the Griseous Orb away") is only listed
 *   where it is the reason the form is available: Legends: Arceus hands out Origin Giratina, so
 *   Altered Giratina is reached from it there.
 * - A source never points at a hidden form the player cannot tell apart: a Polar-pattern Spewpa is
 *   shown as Spewpa. Such sources only list the games where that hidden form can really be had,
 *   since "Spewpa" is obtainable in more games than any one pattern is.
 */
import type { EvolveSource } from '../../src/shared/dex-types.ts'
import { GAMES } from '../../src/shared/games.ts'
import type { Availability } from './availability.ts'
import type { TextEdge } from './evolutions.ts'
import type { ChangeEdge } from './form-changes.ts'
import type { FinalRow } from './merge.ts'
import { isTimeLimited } from './row-order.ts'
import { VISIBLE_FORM } from './taxonomy.ts'
import { cmpNum, cmpStr, fail, sfForm, sfSpecies, uniqSorted } from './util.ts'

export interface EvolveSourceInput {
  /** Evolution edges with their text, one per game. */
  evolutions: readonly TextEdge[]
  /** Form-change edges per game index. */
  changes: ChangeEdge[][]
  availability: Availability
  rows: Map<number, FinalRow[]>
  describe: (key: number) => string
}

const VISIBLE_TARGETS: ReadonlySet<number> = new Set(VISIBLE_FORM.values())

export function buildEvolveSources(input: EvolveSourceInput): Map<number, EvolveSource[]> {
  const { evolutions, changes, availability, rows, describe } = input
  /** target -> `${from}|${how}` -> games */
  const collected = new Map<number, Map<string, { from: number; how: string; games: Set<number> }>>()
  const list = (target: number, from: number, how: string, game: number): void => {
    if (from === target) return
    let sources = collected.get(target)
    if (!sources) collected.set(target, (sources = new Map()))
    const key = `${from}|${how}`
    const entry = sources.get(key)
    if (entry) entry.games.add(game)
    else sources.set(key, { from, how, games: new Set([game]) })
  }

  for (const e of evolutions) {
    // A source that is a hidden form, or a form hidden ones are shown as, only counts where it can really be had.
    const vague = VISIBLE_FORM.has(e.from) || VISIBLE_TARGETS.has(e.from)
    if (vague && !availability.reached[e.game].has(e.from)) continue
    const from = VISIBLE_FORM.get(e.from) ?? e.from
    list(e.to, from, e.how, e.game)
    const shownAs = VISIBLE_FORM.get(e.to)
    if (shownAs !== undefined) list(shownAs, from, e.how, e.game)
  }

  for (const [game, edges] of changes.entries()) {
    for (const e of edges) {
      if (!e.forward) continue
      if (e.partner !== undefined && !availability.available[game].has(e.partner)) continue
      list(e.to, e.from, e.how, game)
    }
  }

  // Reverse form changes, where nothing else explains why a form is available in a game.
  const permanent = new Set<string>()
  const limited = new Set<string>()
  for (const [key, formRows] of rows) {
    for (const row of formRows) for (const g of row.g) (isTimeLimited(row) ? limited : permanent).add(`${key}|${g}`)
  }
  for (const [game, edges] of changes.entries()) {
    const got = availability.obtainable[game]
    const any = availability.available[game]
    const bred = (key: number): boolean => (availability.breed.get(key) ?? []).includes(game)
    const sourced = (key: number, pool: Set<number>): boolean =>
      [...(collected.get(key)?.values() ?? [])].some((s) => s.games.has(game) && pool.has(s.from))
    const targets = new Set(edges.filter((e) => !e.forward).map((e) => e.to))
    for (const target of targets) {
      const isGot = got.has(target)
      if (!isGot && !any.has(target)) continue
      const explained = isGot
        ? permanent.has(`${target}|${game}`) || bred(target) || sourced(target, got)
        : limited.has(`${target}|${game}`) || bred(target) || sourced(target, any)
      if (explained) continue
      const pool = isGot ? got : any
      const reasons = edges.filter((e) => !e.forward && e.to === target && pool.has(e.from) && (isGot ? !e.eventOnly : true))
      if (reasons.length === 0) fail(`${describe(target)} is ${isGot ? 'obtainable' : 'event-only'} in ${GAMES[game].id}, but no source explains it`)
      for (const e of reasons) list(target, e.from, e.how, game)
    }
  }

  const out = new Map<number, EvolveSource[]>()
  for (const [target, sources] of collected) {
    const entries: EvolveSource[] = [...sources.values()].map((s) => ({ from: [sfSpecies(s.from), sfForm(s.from)], how: s.how, g: uniqSorted(s.games) }))
    entries.sort((a, b) => cmpNum(a.from[0], b.from[0]) || cmpNum(a.from[1], b.from[1]) || cmpNum(a.g[0], b.g[0]) || cmpStr(a.how, b.how))
    out.set(target, entries)
  }
  return out
}
