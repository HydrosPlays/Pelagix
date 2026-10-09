/** View model of the Achievements page: rows, filters, sorting and small wording helpers. Pure. */

import {
  ACHIEVEMENT_BY_ID, RANKS, TIER_ORDER, unlockDate, type AchievementCategoryId, type AchievementDef, type AchievementRank, type AchievementState,
  type AchievementTier
} from '@renderer/domain/achievements'
import { formatCount, plural } from '@renderer/lib/format'

export type AchievementFilter = 'all' | 'unlocked' | 'locked'
export type AchievementSort = 'default' | 'nearest' | 'newest' | 'tier'
export type CategoryChoice = 'all' | AchievementCategoryId

export interface AchievementRow {
  def: AchievementDef
  state: AchievementState
  /** ISO timestamp of the unlock; null while locked. */
  unlockedAt: string | null
  /** Unlocked since the page was last opened. */
  fresh: boolean
  /** A secret that is still locked: its title and description stay hidden. */
  concealed: boolean
  /** Position in the default order. */
  order: number
}

/**
 * One row per achievement the dataset supports, in default order. `since` is when the page was
 * last opened (null: never), which decides what counts as freshly unlocked.
 */
export function buildRows(states: readonly AchievementState[], unlocked: Readonly<Record<string, string>>, since: string | null): AchievementRow[] {
  const rows: AchievementRow[] = []
  for (const state of states) {
    const def = ACHIEVEMENT_BY_ID.get(state.id)
    if (!def || !state.available) continue
    const unlockedAt = unlockDate(unlocked, def.id)
    rows.push({
      def,
      state,
      unlockedAt,
      fresh: unlockedAt !== null && (since === null || unlockedAt > since),
      concealed: def.secret === true && unlockedAt === null,
      order: rows.length
    })
  }
  return rows
}

const tierRank = (row: AchievementRow): number => TIER_ORDER.indexOf(row.def.tier)
const byOrder = (a: AchievementRow, b: AchievementRow): number => a.order - b.order
const newestFirst = (a: AchievementRow, b: AchievementRow): number => ((a.unlockedAt ?? '') < (b.unlockedAt ?? '') ? 1 : (a.unlockedAt ?? '') > (b.unlockedAt ?? '') ? -1 : 0)
/** A concealed secret gives no progress away, so it sorts as untouched. */
const shownRatio = (row: AchievementRow): number => (row.concealed ? 0 : row.state.ratio)

const SORTERS: Readonly<Record<AchievementSort, (a: AchievementRow, b: AchievementRow) => number>> = {
  default: byOrder,
  // Locked first, closest to done first; unlocked ones follow, newest first.
  nearest: (a, b) => Number(a.unlockedAt !== null) - Number(b.unlockedAt !== null) || (a.unlockedAt === null ? shownRatio(b) - shownRatio(a) : newestFirst(a, b)) || byOrder(a, b),
  // Unlocked first, newest first; locked ones follow in default order.
  newest: (a, b) => Number(a.unlockedAt === null) - Number(b.unlockedAt === null) || newestFirst(a, b) || byOrder(a, b),
  tier: (a, b) => tierRank(b) - tierRank(a) || byOrder(a, b)
}

export interface RowQuery {
  category: CategoryChoice
  filter: AchievementFilter
  sort: AchievementSort
}

export function selectRows(rows: readonly AchievementRow[], query: RowQuery): AchievementRow[] {
  const picked = rows.filter(
    (row) =>
      (query.category === 'all' || row.def.category === query.category) &&
      (query.filter === 'all' || (query.filter === 'unlocked') === (row.unlockedAt !== null))
  )
  return picked.sort(SORTERS[query.sort])
}

/** The metal a rank is drawn in: the ladder climbs through the four tiers. */
export function rankTier(index: number, ranks: number = RANKS.length): AchievementTier {
  const position = ranks <= 1 ? 0 : Math.min(1, Math.max(0, index / (ranks - 1)))
  return TIER_ORDER[Math.min(TIER_ORDER.length - 1, Math.floor(position * TIER_ORDER.length))] ?? 'bronze'
}

/** "260 more points to Seasoned Collector", or the line for the top of the ladder. */
export function nextRankText(rank: AchievementRank, points: number): string {
  if (rank.nextAt === null || rank.nextName === null) return 'You have reached the top rank.'
  return `${plural(Math.max(0, rank.nextAt - points), 'more point')} to ${rank.nextName}`
}

/** "76 / 151": progress as shown on a card, never past the target. */
export function progressText(state: AchievementState): string {
  return `${formatCount(Math.min(state.current, state.target))} / ${formatCount(state.target)}`
}

export const FILTER_OPTIONS: ReadonlyArray<{ value: AchievementFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'unlocked', label: 'Unlocked' },
  { value: 'locked', label: 'Locked' }
]

export const SORT_OPTIONS: ReadonlyArray<{ value: AchievementSort; label: string }> = [
  { value: 'default', label: 'Default order' },
  { value: 'nearest', label: 'Nearest to done' },
  { value: 'newest', label: 'Newest unlocked' },
  { value: 'tier', label: 'Highest tier' }
]
