/**
 * Evaluates the achievements against a save. Pure: (dex, entries, rules) in, states out.
 *
 * `done` here means "the condition holds right now". Whether an achievement is *unlocked* is a
 * fact of the save file (`save.achievements`): once unlocked it stays unlocked, whatever the user
 * deletes or changes later. `summarize` combines the two.
 */

import type { CatchEntry, DexRules } from '@shared/save-types'
import type { Dex } from '@renderer/lib/data'
import { progressFor } from '../progress'
import { collectionFor } from '../slots'
import { ACHIEVEMENT_BY_ID, ACHIEVEMENT_CATEGORIES, ACHIEVEMENTS } from './definitions'
import { buildEntryIndex } from './entry-index'
import { dexFacts } from './facts'
import {
  TIER_ORDER, type AchievementCategory, type AchievementContext, type AchievementDef, type AchievementRank, type AchievementState, type AchievementSummary,
  type NearAchievement, type UnlockedAchievement
} from './types'

// ---------------------------------------------------------------- evaluation

/** Gathers everything an evaluation needs; the indexes are built here, once. */
export function buildContext(dex: Dex, entries: readonly CatchEntry[], rules: DexRules, now: Date = new Date()): AchievementContext {
  const collection = collectionFor(dex, entries, rules)
  const progress = progressFor(dex, entries, collection, now)
  const facts = dexFacts(dex)
  return { dex, entries, rules, collection, progress, facts, index: buildEntryIndex(dex, facts, entries) }
}

function stateOf(def: AchievementDef, ctx: AchievementContext): AchievementState {
  let current = 0
  let target = 0
  try {
    const result = def.evaluate(ctx)
    current = Number.isFinite(result.current) ? Math.max(0, result.current) : 0
    target = Number.isFinite(result.target) ? Math.max(0, result.target) : 0
  } catch {
    // One broken rule must never take the page (or the other achievements) down with it.
  }
  const available = target > 0
  return { id: def.id, current, target, done: available && current >= target, ratio: available ? Math.min(1, current / target) : 0, available }
}

/** The state of every achievement, in `defs` order. */
export function evaluateAll(ctx: AchievementContext, defs: readonly AchievementDef[] = ACHIEVEMENTS): AchievementState[] {
  return defs.map((def) => stateOf(def, ctx))
}

export interface AchievementEvaluation {
  context: AchievementContext
  /** In `ACHIEVEMENTS` order. */
  states: readonly AchievementState[]
  byId: ReadonlyMap<string, AchievementState>
}

let lastEvaluation: { dex: Dex; entries: readonly CatchEntry[]; rules: DexRules; value: AchievementEvaluation } | null = null

/**
 * Evaluates everything for a Dex, entry list and rule set. The latest result is cached by argument
 * identity, so the page, the summary card and the watcher share one evaluation per change.
 */
export function evaluateFor(dex: Dex, entries: readonly CatchEntry[], rules: DexRules): AchievementEvaluation {
  const hit = lastEvaluation
  if (hit && hit.dex === dex && hit.entries === entries && hit.rules === rules) return hit.value
  const context = buildContext(dex, entries, rules)
  const states = evaluateAll(context)
  const value: AchievementEvaluation = { context, states, byId: new Map(states.map((state) => [state.id, state])) }
  lastEvaluation = { dex, entries, rules, value }
  return value
}

/** Ids whose condition holds but which the save has not recorded as unlocked yet. */
export function newlyDone(states: readonly AchievementState[], unlocked: Readonly<Record<string, string>>): string[] {
  return states.filter((state) => state.done && !Object.hasOwn(unlocked, state.id)).map((state) => state.id)
}

// ---------------------------------------------------------------- ranks

/** The ladder, lowest first: name and the points at which the rank starts. */
export const RANKS: ReadonlyArray<{ name: string; at: number }> = [
  { name: 'Novice Collector', at: 0 },
  { name: 'Route Rookie', at: 100 },
  { name: 'Field Researcher', at: 300 },
  { name: 'Seasoned Collector', at: 700 },
  { name: 'Ace Curator', at: 1400 },
  { name: 'Dex Veteran', at: 2500 },
  { name: 'Champion Archivist', at: 4000 },
  { name: 'Living Dex Master', at: 6000 }
]

export function rankFor(points: number): AchievementRank {
  let index = 0
  for (let i = 0; i < RANKS.length; i++) if (points >= RANKS[i]!.at) index = i
  const rank = RANKS[index]!
  const next = RANKS[index + 1]
  return { name: rank.name, index, at: rank.at, nextAt: next?.at ?? null, nextName: next?.name ?? null }
}

/** 0..1 progress from the start of the current rank to the next one; 1 at the top. */
export function rankProgress(rank: AchievementRank, points: number): number {
  if (rank.nextAt === null) return 1
  const span = rank.nextAt - rank.at
  return span > 0 ? Math.min(1, Math.max(0, (points - rank.at) / span)) : 0
}

// ---------------------------------------------------------------- summary

const tierRank = (def: AchievementDef): number => TIER_ORDER.indexOf(def.tier)

export interface SummaryOptions {
  /** Length of `recent`. Default 5. */
  recent?: number
  /** Length of `nearest`. Default 4. */
  nearest?: number
}

/** Whether the save counts an achievement as unlocked, and since when. */
export function unlockDate(unlocked: Readonly<Record<string, string>>, id: string): string | null {
  return Object.hasOwn(unlocked, id) ? (unlocked[id] ?? null) : null
}

/**
 * The locked achievements that are closest to done. Secret ones never appear. Among achievements
 * with no progress yet the list is spread over categories, so an empty save gets varied first goals.
 */
export function nearestLocked(states: readonly AchievementState[], unlocked: Readonly<Record<string, string>>, limit: number): NearAchievement[] {
  const order = new Map(ACHIEVEMENTS.map((def, i) => [def.id, i]))
  const candidates: NearAchievement[] = []
  for (const state of states) {
    const def = ACHIEVEMENT_BY_ID.get(state.id)
    if (!def || !state.available || state.done || def.secret || Object.hasOwn(unlocked, state.id)) continue
    candidates.push({ def, state })
  }
  // Closest first. Untouched achievements are offered easiest tier first, in their written order.
  candidates.sort(
    (a, b) =>
      b.state.ratio - a.state.ratio ||
      (a.state.ratio === 0 ? tierRank(a.def) - tierRank(b.def) : a.state.target - a.state.current - (b.state.target - b.state.current)) ||
      (order.get(a.def.id) ?? 0) - (order.get(b.def.id) ?? 0)
  )
  const out: NearAchievement[] = []
  const untouchedCategories = new Set<string>()
  for (const candidate of candidates) {
    if (out.length >= limit) break
    if (candidate.state.ratio === 0) {
      if (untouchedCategories.has(candidate.def.category)) continue
      untouchedCategories.add(candidate.def.category)
    }
    out.push(candidate)
  }
  return out
}

/** Totals, rank, latest unlocks and nearest goals. `unlocked` is `save.achievements`. */
export function summarize(states: readonly AchievementState[], unlocked: Readonly<Record<string, string>>, options: SummaryOptions = {}): AchievementSummary {
  const order = new Map(ACHIEVEMENTS.map((def, i) => [def.id, i]))
  let total = 0
  let maxPoints = 0
  let points = 0
  const mine: UnlockedAchievement[] = []

  for (const state of states) {
    const def = ACHIEVEMENT_BY_ID.get(state.id)
    if (!def || !state.available) continue
    total++
    maxPoints += def.points
    const date = unlockDate(unlocked, def.id)
    if (date !== null) {
      points += def.points
      mine.push({ def, date })
    }
  }

  mine.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || tierRank(b.def) - tierRank(a.def) || (order.get(a.def.id) ?? 0) - (order.get(b.def.id) ?? 0))

  return {
    unlocked: mine.length,
    total,
    points,
    maxPoints,
    rank: rankFor(points),
    recent: mine.slice(0, options.recent ?? 5),
    nearest: nearestLocked(states, unlocked, options.nearest ?? 4)
  }
}

export interface CategoryStats {
  category: AchievementCategory
  /** Achievements of the category the dataset supports. */
  total: number
  unlocked: number
  points: number
  maxPoints: number
}

/** Completion per category, in `ACHIEVEMENT_CATEGORIES` order; categories with nothing available are left out. */
export function categoryStats(states: readonly AchievementState[], unlocked: Readonly<Record<string, string>>): CategoryStats[] {
  const stats = new Map<string, CategoryStats>(ACHIEVEMENT_CATEGORIES.map((category) => [category.id, { category, total: 0, unlocked: 0, points: 0, maxPoints: 0 }]))
  for (const state of states) {
    const def = ACHIEVEMENT_BY_ID.get(state.id)
    const entry = def && stats.get(def.category)
    if (!def || !entry || !state.available) continue
    entry.total++
    entry.maxPoints += def.points
    if (Object.hasOwn(unlocked, def.id)) {
      entry.unlocked++
      entry.points += def.points
    }
  }
  return [...stats.values()].filter((entry) => entry.total > 0)
}
