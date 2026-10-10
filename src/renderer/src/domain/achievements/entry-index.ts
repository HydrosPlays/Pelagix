/** One pass over the entries that produces every lookup the achievements need. */

import { BALL_BY_ID } from '@shared/balls'
import { GAME_BY_ID, type SystemId } from '@shared/games'
import type { CatchEntry, EntryKind } from '@shared/save-types'
import { activeLanguage } from '@renderer/i18n/runtime'
import { speciesName } from '@renderer/i18n/terms'
import type { Dex } from '@renderer/lib/data'
import { entryDay } from '../progress'
import type { DexFacts } from './facts'
import type { EntryIndex } from './types'

export const formKey = (species: number, form: number): string => `${species}-${form}`
export const variantKey = (species: number, form: number, variant: number): string => `${species}-${form}:${variant}`

function bump<K>(map: Map<K, number>, key: K): number {
  const next = (map.get(key) ?? 0) + 1
  map.set(key, next)
  return next
}

function append<K>(map: Map<K, CatchEntry[]>, key: K, entry: CatchEntry): void {
  const list = map.get(key)
  if (list) list.push(entry)
  else map.set(key, [entry])
}

let localNames: { dex: Dex; language: string; names: ReadonlyMap<string, number> } | null = null

/**
 * Lower-cased species name -> national dex number in the active language, or null in English
 * (`facts.speciesByName` has those). A nickname counts as another Pokémon's name in either.
 */
function namesInActiveLanguage(dex: Dex): ReadonlyMap<string, number> | null {
  const language = activeLanguage()
  if (language === 'en') return null
  if (localNames?.dex === dex && localNames.language === language) return localNames.names
  const names = new Map<string, number>()
  for (const species of dex.speciesList) names.set(speciesName(species).trim().toLowerCase(), species.id)
  localNames = { dex, language, names }
  return names
}

export function buildEntryIndex(dex: Dex, facts: DexFacts, entries: readonly CatchEntry[]): EntryIndex {
  const localised = namesInActiveLanguage(dex)
  const species = new Set<number>()
  const shinySpecies = new Set<number>()
  const forms = new Set<string>()
  const variants = new Set<string>()
  const gmax = new Set<string>()
  const males = new Set<number>()
  const females = new Set<number>()
  const bySpecies = new Map<number, CatchEntry[]>()
  const byForm = new Map<string, CatchEntry[]>()
  const byGame = new Map<string, number>()
  const byBall = new Map<number, number>()
  const byKind = new Map<EntryKind, number>()
  const byDay = new Map<string, number>()
  const gamesBySpecies = new Map<number, Set<string>>()
  const shinyGames = new Set<string>()
  const mainGames = new Set<string>()
  const mainSystems = new Set<SystemId>()
  const mainGenerations = new Set<number>()
  let maxPerGame = 0
  let maxPerDay = 0
  let maxGamesPerSpecies = 0
  let alpha = 0
  let nicknamed = 0
  let level100 = 0
  let misnamed = 0
  let shinyAlpha = 0

  for (const entry of entries) {
    const summary = dex.species(entry.species)
    const game = GAME_BY_ID.get(entry.game)

    if (summary) {
      species.add(entry.species)
      if (entry.shiny) shinySpecies.add(entry.species)
      append(bySpecies, entry.species, entry)

      const form = dex.form(entry.species, entry.form)
      if (form) {
        const key = formKey(entry.species, entry.form)
        forms.add(key)
        append(byForm, key, entry)
        if (entry.variant !== undefined && form.variants?.some((v) => v.id === entry.variant)) variants.add(variantKey(entry.species, entry.form, entry.variant))
        if (entry.gmax && form.gmax !== undefined) gmax.add(form.gmax)
      }
      const gender = form?.gender ?? entry.gender
      if (gender === 'm') males.add(entry.species)
      else if (gender === 'f') females.add(entry.species)

      if (game) {
        let games = gamesBySpecies.get(entry.species)
        if (!games) gamesBySpecies.set(entry.species, (games = new Set()))
        games.add(game.id)
        if (games.size > maxGamesPerSpecies) maxGamesPerSpecies = games.size
      }

      if (entry.nickname) {
        const nickname = entry.nickname.trim().toLowerCase()
        const named = facts.speciesByName.get(nickname) ?? localised?.get(nickname)
        if (named !== undefined && named !== entry.species) misnamed++
      }
    }

    if (game) {
      const count = bump(byGame, game.id)
      if (count > maxPerGame) maxPerGame = count
      if (entry.shiny) shinyGames.add(game.id)
      if (game.kind === 'main') {
        mainGames.add(game.id)
        mainSystems.add(game.system)
        mainGenerations.add(game.generation)
      }
    }

    if (entry.ball !== undefined && BALL_BY_ID.has(entry.ball)) bump(byBall, entry.ball)
    bump(byKind, entry.kind)
    const perDay = bump(byDay, entryDay(entry))
    if (perDay > maxPerDay) maxPerDay = perDay

    if (entry.alpha) alpha++
    if (entry.alpha && entry.shiny) shinyAlpha++
    if (entry.nickname) nicknamed++
    if (entry.level === 100) level100++
  }

  let completeFamilies = 0
  let shinyFamilies = 0
  for (const members of facts.families.values()) {
    if (members.every((id) => species.has(id))) {
      completeFamilies++
      if (members.every((id) => shinySpecies.has(id))) shinyFamilies++
    }
  }

  return {
    total: entries.length,
    species,
    shinySpecies,
    forms,
    variants,
    gmax,
    males,
    females,
    bySpecies,
    byForm,
    byGame,
    byBall,
    byKind,
    byDay,
    gamesBySpecies,
    shinyGames,
    mainGames,
    mainSystems,
    mainGenerations,
    maxPerGame,
    maxPerDay,
    maxGamesPerSpecies,
    completeFamilies,
    shinyFamilies,
    alpha,
    nicknamed,
    level100,
    misnamed,
    shinyAlpha
  }
}
