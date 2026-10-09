/**
 * FormSummary.obtain / event: per game, the forms that can be obtained without an event, and the
 * ones that can only be had through one.
 *
 * A form is obtainable in a game when it has a row there that is not time-limited (see
 * isTimeLimited), when it evolves there from an obtainable form, when it is reached by an in-game
 * form change from an obtainable form (form-changes.ts; a fusion also needs its partner), or when
 * it hatches from an egg there and one of its possible parents is obtainable. Computed as a fixed
 * point per game.
 *
 * The same closure, started from the obtainable forms plus everything that has a time-limited
 * source, and also allowed to use form changes whose item was itself a distribution, gives what
 * can be had at all; whatever is not obtainable in it is listed under FormSummary.event.
 *
 * Hidden forms that look like another form (taxonomy.ts VISIBLE_FORM) then lend that form their
 * status. The rows copied onto the visible form for display do not seed the closure themselves:
 * a Garden-pattern Spewpa shown as "Spewpa" must not make an Icy Snow Vivillon obtainable.
 */
import { GAMES } from '../../src/shared/games.ts'
import type { ChangeEdge } from './form-changes.ts'
import { GO_IDX } from './game-map.ts'
import { isTimeLimited } from './row-order.ts'
import type { FinalRow } from './merge.ts'
import type { PkEvolution } from './pkhex-types.ts'
import { GENDER_FORM_SPECIES, VISIBLE_FORM } from './taxonomy.ts'
import { cmpNum, sf, sfSpecies } from './util.ts'

/** Egg species whose parents are not their own evolutions: Phione hatches from Manaphy's eggs. */
const EXTRA_PARENTS: ReadonlyMap<number, number[]> = new Map([[sf(489, 0), [sf(490, 0)]]])

export interface Availability {
  /** Per form key: game indices, ascending. */
  obtain: Map<number, number[]>
  event: Map<number, number[]>
  breed: Map<number, number[]>
  /** Per game index: forms obtainable without an event. */
  obtainable: Set<number>[]
  /** Per game index: forms that can be had at all (obtainable or event-only). */
  available: Set<number>[]
  /** Like `available`, before hidden forms lent their status to the form they look like. */
  reached: Set<number>[]
}

export interface AvailabilityInput {
  rows: Map<number, FinalRow[]>
  /** Evolution edges per game index. */
  evolutions: PkEvolution[][]
  /** Form-change edges per game index. */
  changes: ChangeEdge[][]
  /** Forms that hatch from an egg, per game index. */
  eggs: Set<number>[]
  goForms: Set<number>
}

export function computeAvailability(input: AvailabilityInput): Availability {
  const { rows, evolutions, changes, eggs, goForms } = input
  const obtain = new Map<number, number[]>()
  const event = new Map<number, number[]>()
  const breed = new Map<number, number[]>()
  const obtainable: Set<number>[] = []
  const available: Set<number>[] = []
  const reached: Set<number>[] = []
  const add = (map: Map<number, number[]>, key: number, game: number): void => {
    const list = map.get(key)
    if (list) {
      if (!list.includes(game)) list.push(game)
    } else map.set(key, [game])
  }

  for (const game of GAMES.keys()) {
    const direct = new Set<number>()
    const limited = new Set<number>()
    for (const [key, list] of rows) {
      for (const row of list) {
        if (row.copy || !row.g.includes(game)) continue
        if (isTimeLimited(row)) limited.add(key)
        else direct.add(key)
      }
    }
    if (game === GO_IDX) for (const key of goForms) direct.add(key)

    const forward = new Map<number, number[]>()
    for (const e of evolutions[game]) {
      const from = sf(e.from[0], e.from[1])
      const list = forward.get(from)
      if (list) list.push(sf(e.to[0], e.to[1]))
      else forward.set(from, [sf(e.to[0], e.to[1])])
    }
    /** Every form an egg's species line contains: any of them can be the parent. */
    const parentsOf = new Map<number, number[]>()
    for (const egg of eggs[game]) {
      const line = new Set<number>([egg])
      const queue = [egg]
      while (queue.length > 0) {
        for (const to of forward.get(queue.pop()!) ?? []) {
          if (!line.has(to)) {
            line.add(to)
            queue.push(to)
          }
        }
      }
      // A gender-form species lays eggs of either form whichever parent is at hand.
      if (GENDER_FORM_SPECIES.has(sfSpecies(egg))) for (const f of [0, 1]) line.add(sf(sfSpecies(egg), f))
      parentsOf.set(egg, [...line, ...(EXTRA_PARENTS.get(egg) ?? [])])
    }

    const close = (set: Set<number>, withEventItems: boolean): void => {
      for (let changed = true; changed; ) {
        changed = false
        const queue = [...set]
        while (queue.length > 0) {
          for (const to of forward.get(queue.pop()!) ?? []) {
            if (!set.has(to)) {
              set.add(to)
              queue.push(to)
              changed = true
            }
          }
        }
        for (const e of changes[game]) {
          if (set.has(e.to) || !set.has(e.from)) continue
          if (e.eventOnly && !withEventItems) continue
          if (e.partner !== undefined && !set.has(e.partner)) continue
          set.add(e.to)
          changed = true
        }
        for (const [egg, parents] of parentsOf) {
          if (!set.has(egg) && parents.some((p) => set.has(p))) {
            set.add(egg)
            changed = true
          }
        }
      }
    }

    const got = new Set(direct)
    close(got, false)
    const any = new Set([...got, ...limited])
    close(any, true)
    reached.push(new Set(any))

    for (const egg of eggs[game]) add(breed, egg, game)
    for (const [hidden, visible] of VISIBLE_FORM) {
      if (got.has(hidden)) got.add(visible)
      if (any.has(hidden)) any.add(visible)
      if (eggs[game].has(hidden)) add(breed, visible, game)
    }
    obtainable.push(got)
    available.push(any)
    for (const key of got) add(obtain, key, game)
    for (const key of any) if (!got.has(key)) add(event, key, game)
  }
  for (const map of [obtain, event, breed]) for (const list of map.values()) list.sort(cmpNum)
  return { obtain, event, breed, obtainable, available, reached }
}
