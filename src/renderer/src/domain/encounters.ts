/**
 * Reading a species detail file: which games offer a form and how, and turning one of those
 * sources into the starting values of a catch entry. Pure functions.
 */

import type { EncounterRow, EvolveSource, FormDetail, FormSummary, SpeciesDetail } from '@shared/dex-types'
import { GAMES, type GameDef } from '@shared/games'
import type { CatchEntry, EntryGender } from '@shared/save-types'
import type { Dex } from '@renderer/lib/data'

const EMPTY_DETAIL: FormDetail = Object.freeze({ rows: [], evolve: [], breed: [] }) as FormDetail
const CANONICAL_RANK: ReadonlyMap<string, number> = new Map(GAMES.map((g, i) => [g.id, i]))

/** Everything one game offers for a form. */
export interface GameSources {
  game: GameDef
  /** Direct sources in this game (wild, gift, raid, event ...), in dataset order. */
  rows: EncounterRow[]
  /** Evolutions and form changes that work in this game. */
  evolve: EvolveSource[]
  /** The form hatches from an egg in this game. */
  breed: boolean
  /** Every way to get it in this game is an event distribution. */
  eventOnly: boolean
}

/** Starting values for a catch entry; the same shape as `EntryPreset` in store/ui. */
export type SourcePreset = Partial<CatchEntry> & { species: number; form: number }

/** The detail record of a form; an empty one when the file has none. */
export function formDetail(detail: SpeciesDetail, form: Pick<FormSummary, 'f'> | number): FormDetail {
  return detail.forms[String(typeof form === 'number' ? form : form.f)] ?? EMPTY_DETAIL
}

/** Location name of an encounter row, when it has one. */
export function rowLocation(detail: SpeciesDetail, row: EncounterRow): string | undefined {
  return row.l === undefined ? undefined : detail.strings[row.l]
}

/** Fixed gender of an encounter row as an entry gender. */
export function rowGender(row: EncounterRow): EntryGender | undefined {
  return row.d === 0 ? 'm' : row.d === 1 ? 'f' : row.d === 2 ? 'n' : undefined
}

/**
 * Every game that has a way to obtain the form - a direct source, an evolution, breeding or an
 * event - in canonical game order, each with its sources. Games the app does not know are skipped.
 */
export function sourcesByGame(dex: Dex, detail: SpeciesDetail, form: FormSummary): GameSources[] {
  const fd = formDetail(detail, form)
  const games = new Set<GameDef>([...dex.obtainableGames(form), ...dex.eventGames(form)])
  for (const row of fd.rows) for (const g of dex.gamesAt(row.g)) games.add(g)
  for (const e of fd.evolve) for (const g of dex.gamesAt(e.g)) games.add(g)
  for (const g of dex.gamesAt(fd.breed)) games.add(g)

  return [...games]
    .sort((x, y) => (CANONICAL_RANK.get(x.id) ?? 0) - (CANONICAL_RANK.get(y.id) ?? 0))
    .map((game) => {
      // -1 for Pokémon GO when it is only known through the form's `go` flag: no rows then.
      const idx = dex.gameIdx(game.id)
      return {
        game,
        rows: fd.rows.filter((r) => r.g.includes(idx)),
        evolve: fd.evolve.filter((e) => e.g.includes(idx)),
        breed: fd.breed.includes(idx),
        eventOnly: dex.isEventOnly(form, game.id)
      }
    })
}

/** Entry values for "I got it from this encounter row in this game". */
export function presetFromRow(speciesId: number, form: FormSummary, game: Pick<GameDef, 'id'>, detail: SpeciesDetail, row: EncounterRow): SourcePreset {
  const location = rowLocation(detail, row)
  const gender = rowGender(row) ?? form.gender
  const [min, max] = row.lv
  return {
    species: speciesId,
    form: form.f,
    game: game.id,
    kind: row.k,
    ...(row.m !== undefined && { method: row.m }),
    ...(location !== undefined && { location }),
    ...(row.b !== undefined && { ball: row.b }),
    ...(gender !== undefined && { gender }),
    ...(row.s !== undefined && { shiny: row.s === 'forced' }),
    ...(min === max && min > 0 && { level: min }),
    ...(row.c?.includes('Alpha') && { alpha: true }),
    ...(row.x?.ot !== undefined && { ot: row.x.ot })
  }
}

/** Entry values for "I evolved (or changed) it into this form in this game". */
export function presetFromEvolve(speciesId: number, form: FormSummary, game: Pick<GameDef, 'id'>, source: EvolveSource): SourcePreset {
  return {
    species: speciesId,
    form: form.f,
    game: game.id,
    kind: 'evolved',
    method: source.how,
    origin: [source.from[0], source.from[1]],
    ...(form.gender !== undefined && { gender: form.gender })
  }
}

/** Entry values for "I hatched it in this game". */
export function presetFromBreed(speciesId: number, form: FormSummary, game: Pick<GameDef, 'id'>): SourcePreset {
  return { species: speciesId, form: form.f, game: game.id, kind: 'bred', method: 'Hatched from an Egg', ...(form.gender !== undefined && { gender: form.gender }) }
}
