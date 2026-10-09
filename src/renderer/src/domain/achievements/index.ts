/** The achievement system: definitions, the pure engine and its React hooks. */

export * from './types'
export { ACHIEVEMENTS, ACHIEVEMENT_BY_ID, ACHIEVEMENT_CATEGORIES, CATEGORY_BY_ID, missingItems, ownsItem } from './definitions'
export {
  buildContext, categoryStats, evaluateAll, evaluateFor, nearestLocked, newlyDone, rankFor, rankProgress, RANKS, summarize, unlockDate,
  type AchievementEvaluation, type CategoryStats, type SummaryOptions
} from './engine'
export { dexFacts, type DexFacts } from './facts'
export { buildEntryIndex } from './entry-index'
export { useAchievementEvaluation, useAchievementStates, useAchievementSummary, useCategoryStats } from './hooks'
