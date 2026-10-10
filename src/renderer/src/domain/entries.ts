/**
 * Looking at logged catches: resolving everything an entry refers to (species, form, game, system,
 * ball, render) in one place, and ordering entry lists. Pure functions.
 */

import { BALL_BY_ID, type BallDef } from '@shared/balls'
import type { FormSummary, FormVariant, SpeciesSummary } from '@shared/dex-types'
import { GAME_BY_ID, SYSTEM_BY_ID, type GameDef, type SystemDef } from '@shared/games'
import type { CatchEntry } from '@shared/save-types'
import { t } from '@renderer/i18n/runtime'
import { formFullName, speciesName, variantName } from '@renderer/i18n/terms'
import type { Dex } from '@renderer/lib/data'
import { resolveEntrySprite, type ResolvedSprite } from '@renderer/lib/sprites'
import { entryDay } from './progress'

/** An entry with every reference resolved. Anything the app does not know is undefined, never a throw. */
export interface EntryView {
  entry: CatchEntry
  species: SpeciesSummary | undefined
  /** The entry's form; the species' base form when the form index is unknown. */
  form: FormSummary | undefined
  variant: FormVariant | undefined
  /** Full display name of what was caught: "Alolan Raichu", "Alcremie (Ruby Cream) · Star Sweet", "Gigantamax Pikachu". */
  name: string
  /** The nickname when there is one, else `name`. */
  title: string
  game: GameDef | undefined
  /** The game's primary system. */
  system: SystemDef | undefined
  ball: BallDef | undefined
  /** HOME render path with the entry's shiny, gender, variant and Gigantamax state applied. */
  sprite: ResolvedSprite
  /** The day it counts for (`date`, else the day it was logged), `yyyy-mm-dd`. */
  day: string
}

/** Resolves an entry against the dataset and the static game / ball tables. */
export function describeEntry(dex: Dex, entry: CatchEntry): EntryView {
  const species = dex.species(entry.species)
  const form = dex.form(entry.species, entry.form) ?? species?.forms[0]
  const variant = entry.variant === undefined ? undefined : form?.variants?.find((v) => v.id === entry.variant)
  const game = GAME_BY_ID.get(entry.game)

  let name = species && form ? formFullName(species, form) : species ? speciesName(species) : t('domain.entry.unknownSpecies', { number: String(entry.species) })
  if (species && form && variant) name = t('domain.slot.variant', { name, variant: variantName(species, form, variant.id) ?? variant.name })
  if (entry.gmax && form?.gmax) name = t('domain.slot.gmax', { name })

  return {
    entry,
    species,
    form,
    variant,
    name,
    title: entry.nickname ?? name,
    game,
    system: game ? SYSTEM_BY_ID.get(game.system) : undefined,
    ball: entry.ball === undefined ? undefined : BALL_BY_ID.get(entry.ball),
    sprite: resolveEntrySprite(dex, entry),
    day: entryDay(entry)
  }
}

/**
 * - `newest` / `oldest`: by when the entry was logged.
 * - `caught-newest` / `caught-oldest`: by the day it was caught (`date`, else the day logged).
 * - `dex`: national dex number, then form, then oldest first.
 */
export type EntryOrder = 'newest' | 'oldest' | 'caught-newest' | 'caught-oldest' | 'dex'

const text = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

const COMPARATORS: Readonly<Record<EntryOrder, (a: CatchEntry, b: CatchEntry) => number>> = {
  newest: (a, b) => text(b.createdAt, a.createdAt),
  oldest: (a, b) => text(a.createdAt, b.createdAt),
  'caught-newest': (a, b) => text(entryDay(b), entryDay(a)) || text(b.createdAt, a.createdAt),
  'caught-oldest': (a, b) => text(entryDay(a), entryDay(b)) || text(a.createdAt, b.createdAt),
  dex: (a, b) => a.species - b.species || a.form - b.form || text(a.createdAt, b.createdAt)
}

/** A sorted copy of the entries; the input is left untouched. Ties keep their original order. */
export function sortEntries(entries: readonly CatchEntry[], order: EntryOrder): CatchEntry[] {
  return [...entries].sort(COMPARATORS[order])
}
