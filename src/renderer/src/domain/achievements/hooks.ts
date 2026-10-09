/** React access to the achievement engine. Everything below needs the Dex to be ready (see `useDex`). */

import { useMemo } from 'react'
import { useDex } from '@renderer/lib/data'
import { useAchievements, useEntries, useRules } from '@renderer/store/save'
import { categoryStats, evaluateFor, summarize, type AchievementEvaluation, type CategoryStats } from './engine'
import type { AchievementState, AchievementSummary } from './types'

/**
 * The current evaluation (context, states, lookup by id). Re-evaluates only when the entries or
 * the rules change; every component asking shares the same result.
 */
export function useAchievementEvaluation(): AchievementEvaluation {
  const dex = useDex()
  const entries = useEntries()
  const rules = useRules()
  return useMemo(() => evaluateFor(dex, entries, rules), [dex, entries, rules])
}

/** The state of every achievement, in `ACHIEVEMENTS` order. */
export function useAchievementStates(): readonly AchievementState[] {
  return useAchievementEvaluation().states
}

/** Totals, points, rank, the latest unlocks (with dates) and the locked achievements closest to done. */
export function useAchievementSummary(recent = 5, nearest = 4): AchievementSummary {
  const { states } = useAchievementEvaluation()
  const unlocked = useAchievements()
  return useMemo(() => summarize(states, unlocked, { recent, nearest }), [states, unlocked, recent, nearest])
}

/** Completion per category. */
export function useCategoryStats(): CategoryStats[] {
  const { states } = useAchievementEvaluation()
  const unlocked = useAchievements()
  return useMemo(() => categoryStats(states, unlocked), [states, unlocked])
}
