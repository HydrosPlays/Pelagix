/**
 * Shapes of the achievement system. An achievement is a pure function of the user's entries, the
 * Living Dex rules and the dataset; nothing here knows about React or the save store.
 */

import type { CatchEntry, DexRules, EntryKind } from '@shared/save-types'
import type { SystemId } from '@shared/games'
import type { Dex } from '@renderer/lib/data'
import type { Progress } from '../progress'
import type { Collection } from '../slots'
import type { DexFacts } from './facts'

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum'

/** Lowest first. */
export const TIER_ORDER: readonly AchievementTier[] = ['bronze', 'silver', 'gold', 'platinum']
export const TIER_LABELS: Readonly<Record<AchievementTier, string>> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' }
/** What an achievement of each tier is worth. */
export const TIER_POINTS: Readonly<Record<AchievementTier, number>> = { bronze: 10, silver: 25, gold: 50, platinum: 100 }

export type AchievementCategoryId =
  | 'milestones' | 'regions' | 'types' | 'shiny' | 'games' | 'balls' | 'forms' | 'legends' | 'journey' | 'dedication' | 'secrets'

/** Which artwork a medal carries. Drawn in features/achievements/Medal.tsx. */
export type AchievementGlyph =
  | 'pokeball' | 'boxes' | 'journal' | 'compass' | 'gem' | 'sparkle' | 'cartridge' | 'console' | 'balls' | 'shapes'
  | 'gender' | 'gmax' | 'mega' | 'sprout' | 'crown' | 'star' | 'fossil' | 'egg' | 'portal' | 'hourglass'
  | 'grass' | 'evolve' | 'swap' | 'gift' | 'duel' | 'den' | 'crystal' | 'swarm' | 'moon' | 'steps'
  | 'cloud' | 'ticket' | 'transfer' | 'alpha' | 'tag' | 'peak' | 'paths' | 'stack' | 'tree' | 'flame'
  | 'bolt' | 'calendar' | 'question' | 'trophy'

export interface AchievementCategory {
  id: AchievementCategoryId
  name: string
  description: string
  glyph: AchievementGlyph
}

/** One Pokémon an achievement asks for: a species, or one particular form / variant / state of it. */
export interface SetItem {
  species: number
  /** PKHeX form index; absent when any form of the species counts. */
  form?: number
  /** `FormVariant.id` (Alcremie sweet). */
  variant?: number
  gmax?: boolean
  /** The item is "both a male and a female of this species". */
  genders?: boolean
  /** Name to show for it. */
  label: string
}

/** How a `SetItem` is checked against the entries. */
export type SetTest = 'species' | 'shiny' | 'form' | 'variant' | 'gmax' | 'genders'

/** Everything computed once from the entries, so each achievement is a handful of lookups. */
export interface EntryIndex {
  /** All entries, including ones whose species or game the app does not know. */
  total: number
  /** Species (known to the dataset) with at least one entry of any form. */
  species: ReadonlySet<number>
  /** Species with at least one shiny entry. */
  shinySpecies: ReadonlySet<number>
  /** `${species}-${form}` of every logged form the dataset knows. */
  forms: ReadonlySet<string>
  /** `${species}-${form}:${variant}` of every logged sub-variant. */
  variants: ReadonlySet<string>
  /** Gigantamax render keys of the logged Gigantamax Pokémon. */
  gmax: ReadonlySet<string>
  /** Species logged as a male / as a female (from the entry's gender, or the gender its form implies). */
  males: ReadonlySet<number>
  females: ReadonlySet<number>
  /** Entries per national dex number, oldest first. */
  bySpecies: ReadonlyMap<number, readonly CatchEntry[]>
  /** `${species}-${form}` -> entries. */
  byForm: ReadonlyMap<string, readonly CatchEntry[]>
  /** Entries per known game id. */
  byGame: ReadonlyMap<string, number>
  /** Entries per known ball id. */
  byBall: ReadonlyMap<number, number>
  byKind: ReadonlyMap<EntryKind, number>
  /** Entries per day (`yyyy-mm-dd`, see `entryDay`). */
  byDay: ReadonlyMap<string, number>
  /** Known games each species was logged from. */
  gamesBySpecies: ReadonlyMap<number, ReadonlySet<string>>
  /** Known games with at least one shiny entry. */
  shinyGames: ReadonlySet<string>
  /** Main-series games, their primary systems and their generations, as covered by the entries. */
  mainGames: ReadonlySet<string>
  mainSystems: ReadonlySet<SystemId>
  mainGenerations: ReadonlySet<number>
  /** The most entries any one game / day has, and the most games any one species was logged from. */
  maxPerGame: number
  maxPerDay: number
  maxGamesPerSpecies: number
  /** Evolution families (two or more members) with every member logged / logged as a shiny. */
  completeFamilies: number
  shinyFamilies: number
  alpha: number
  nicknamed: number
  level100: number
  /** Entries nicknamed after a different species. */
  misnamed: number
  /** Entries that are both shiny and alpha. */
  shinyAlpha: number
}

export interface AchievementContext {
  dex: Dex
  entries: readonly CatchEntry[]
  rules: DexRules
  collection: Collection
  progress: Progress
  /** Static sets derived from the dataset (cached per Dex). */
  facts: DexFacts
  /** Lookups derived from the entries (built once per evaluation). */
  index: EntryIndex
}

export interface AchievementProgress {
  current: number
  target: number
}

export interface AchievementDef {
  /** Stable id; saved in the user's file. Never rename. */
  id: string
  title: string
  description: string
  category: AchievementCategoryId
  tier: AchievementTier
  /** Follows the tier (`TIER_POINTS`). */
  points: number
  glyph: AchievementGlyph
  /** CSS colour of the medal's accent ring (a type or game colour). */
  accent?: string
  /** Hidden until unlocked: the page shows "???" and `hint`. */
  secret?: boolean
  /** What a locked secret achievement says instead of its description. */
  hint?: string
  /** Progress toward the achievement; it is done when `current >= target`. A target of 0 means "not available with this dataset". */
  evaluate(ctx: AchievementContext): AchievementProgress
  /** The Pokémon this achievement draws from, when it is about a fixed set. */
  pool?(facts: DexFacts): readonly SetItem[]
  /** How `pool` items are checked. */
  test?: SetTest
  /** The target is the whole pool (rather than a number of its members). */
  whole?: boolean
}

export interface AchievementState {
  id: string
  current: number
  target: number
  /** `current >= target`, for an achievement the dataset supports. */
  done: boolean
  /** 0..1. */
  ratio: number
  /** False when the loaded dataset cannot support the achievement (target 0); such achievements are not shown. */
  available: boolean
}

export interface AchievementRank {
  name: string
  /** 0-based position on the ladder. */
  index: number
  /** Points at which this rank starts. */
  at: number
  /** Points needed for the next rank; null at the top. */
  nextAt: number | null
  /** Name of the next rank; null at the top. */
  nextName: string | null
}

export interface UnlockedAchievement {
  def: AchievementDef
  /** ISO timestamp it was unlocked. */
  date: string
}

export interface NearAchievement {
  def: AchievementDef
  state: AchievementState
}

export interface AchievementSummary {
  /** Unlocked achievements (from the save; an unlock is permanent). */
  unlocked: number
  /** Achievements the dataset supports. */
  total: number
  points: number
  maxPoints: number
  rank: AchievementRank
  /** Latest unlocks, newest first. */
  recent: UnlockedAchievement[]
  /** Locked achievements closest to completion (secret ones never appear here). */
  nearest: NearAchievement[]
}
