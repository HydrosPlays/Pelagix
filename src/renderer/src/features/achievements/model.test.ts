import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, RANKS, rankFor, type AchievementState } from '@renderer/domain/achievements'
import { buildRows, FILTER_OPTIONS, nextRankText, progressText, rankTier, selectRows, SORT_OPTIONS } from './model'

/** States for every achievement: locked with no progress unless overridden. */
function statesWith(overrides: Record<string, Partial<AchievementState>> = {}): AchievementState[] {
  return ACHIEVEMENTS.map((def) => ({ id: def.id, current: 0, target: 10, done: false, ratio: 0, available: true, ...overrides[def.id] }))
}

const ids = (rows: ReadonlyArray<{ def: { id: string } }>): string[] => rows.map((row) => row.def.id)

describe('buildRows', () => {
  it('makes one row per available achievement, in default order', () => {
    const rows = buildRows(statesWith({ 'species-10': { available: false } }), {}, null)
    expect(rows).toHaveLength(ACHIEVEMENTS.length - 1)
    expect(ids(rows)).toEqual(ACHIEVEMENTS.filter((def) => def.id !== 'species-10').map((def) => def.id))
    expect(rows.map((row) => row.order)).toEqual(rows.map((_, i) => i))
    expect(rows.every((row) => row.unlockedAt === null && !row.fresh)).toBe(true)
  })

  it('takes unlocks from the save and marks the ones since the last visit as fresh', () => {
    const unlocked = { 'species-1': '2026-10-01T10:00:00.000Z', 'shiny-1': '2026-10-08T10:00:00.000Z', 'gone-id': '2026-10-08T10:00:00.000Z' }
    const rows = buildRows(statesWith(), unlocked, '2026-10-05T00:00:00.000Z')
    const row = (id: string) => rows.find((r) => r.def.id === id)!
    expect(row('species-1')).toMatchObject({ unlockedAt: '2026-10-01T10:00:00.000Z', fresh: false })
    expect(row('shiny-1')).toMatchObject({ unlockedAt: '2026-10-08T10:00:00.000Z', fresh: true })
    expect(row('species-10')).toMatchObject({ unlockedAt: null, fresh: false })
    // A first visit: everything already unlocked is new to the user.
    expect(buildRows(statesWith(), unlocked, null).filter((r) => r.fresh).map((r) => r.def.id)).toEqual(['species-1', 'shiny-1'])
  })

  it('conceals a secret until it is unlocked', () => {
    const locked = buildRows(statesWith(), {}, null).find((r) => r.def.id === 'secret-golden-magikarp')!
    const open = buildRows(statesWith(), { 'secret-golden-magikarp': '2026-10-08T10:00:00.000Z' }, null).find((r) => r.def.id === 'secret-golden-magikarp')!
    expect(locked.concealed).toBe(true)
    expect(open.concealed).toBe(false)
    expect(buildRows(statesWith(), {}, null).find((r) => r.def.id === 'species-1')!.concealed).toBe(false)
  })
})

describe('selectRows', () => {
  const unlocked = { 'species-1': '2026-10-01T10:00:00.000Z', 'species-all': '2026-10-03T10:00:00.000Z', 'shiny-1': '2026-10-02T10:00:00.000Z' }
  const rows = buildRows(
    statesWith({ 'species-10': { current: 9, ratio: 0.9 }, 'species-50': { current: 20, target: 50, ratio: 0.4 }, 'secret-pikachu-ten-games': { current: 9, ratio: 0.9 } }),
    unlocked,
    null
  )

  it('filters by category and by unlocked / locked', () => {
    const milestones = ACHIEVEMENTS.filter((def) => def.category === 'milestones').length
    expect(selectRows(rows, { category: 'milestones', filter: 'all', sort: 'default' })).toHaveLength(milestones)
    expect(ids(selectRows(rows, { category: 'milestones', filter: 'unlocked', sort: 'default' }))).toEqual(['species-1', 'species-all'])
    expect(selectRows(rows, { category: 'milestones', filter: 'locked', sort: 'default' })).toHaveLength(milestones - 2)
    expect(ids(selectRows(rows, { category: 'all', filter: 'unlocked', sort: 'default' }))).toEqual(['species-1', 'species-all', 'shiny-1'])
    expect(selectRows(rows, { category: 'types', filter: 'unlocked', sort: 'default' })).toEqual([])
  })

  it('sorts nearest: locked by progress, then unlocked newest first', () => {
    const sorted = ids(selectRows(rows, { category: 'milestones', filter: 'all', sort: 'nearest' }))
    expect(sorted.slice(0, 2)).toEqual(['species-10', 'species-50'])
    expect(sorted.slice(-2)).toEqual(['species-all', 'species-1'])
  })

  it('does not let a concealed secret give its progress away when sorting', () => {
    const sorted = ids(selectRows(rows, { category: 'secrets', filter: 'all', sort: 'nearest' }))
    expect(sorted).toEqual(ACHIEVEMENTS.filter((def) => def.category === 'secrets').map((def) => def.id))
  })

  it('sorts newest unlocked first, then locked in default order', () => {
    const sorted = ids(selectRows(rows, { category: 'all', filter: 'all', sort: 'newest' }))
    expect(sorted.slice(0, 4)).toEqual(['species-all', 'shiny-1', 'species-1', 'species-10'])
  })

  it('sorts by tier, highest first, keeping default order inside a tier', () => {
    const sorted = selectRows(rows, { category: 'milestones', filter: 'all', sort: 'tier' })
    expect(sorted[0]?.def.tier).toBe('platinum')
    expect(sorted[sorted.length - 1]?.def.tier).toBe('bronze')
    expect(ids(sorted.filter((row) => row.def.tier === 'bronze'))).toEqual(['species-1', 'species-10', 'species-50', 'entries-100'])
  })

  it('never mutates the rows it was given', () => {
    const before = ids(rows)
    selectRows(rows, { category: 'all', filter: 'all', sort: 'tier' })
    expect(ids(rows)).toEqual(before)
  })
})

describe('wording', () => {
  it('draws the rank ladder through all four metals', () => {
    expect(RANKS.map((_, i) => rankTier(i))).toEqual(['bronze', 'bronze', 'silver', 'silver', 'gold', 'gold', 'platinum', 'platinum'])
    expect(rankTier(0, 1)).toBe('bronze')
    expect(rankTier(99)).toBe('platinum')
  })

  it('says how far the next rank is', () => {
    expect(nextRankText(rankFor(0), 0)).toBe(`${RANKS[1]!.at} more points to ${RANKS[1]!.name}`)
    expect(nextRankText(rankFor(RANKS[1]!.at - 1), RANKS[1]!.at - 1)).toBe(`1 more point to ${RANKS[1]!.name}`)
    expect(nextRankText(rankFor(1_000_000), 1_000_000)).toBe('You have reached the top rank.')
  })

  it('prints progress with separators and never past the target', () => {
    const state = { id: 'x', done: false, ratio: 0, available: true }
    expect(progressText({ ...state, current: 76, target: 151 })).toBe('76 / 151')
    expect(progressText({ ...state, current: 1200, target: 1025 })).toBe('1,025 / 1,025')
    expect(progressText({ ...state, current: 999, target: 2500 })).toBe('999 / 2,500')
  })

  it('offers every filter and sort exactly once', () => {
    expect(FILTER_OPTIONS.map((o) => o.value)).toEqual(['all', 'unlocked', 'locked'])
    expect(SORT_OPTIONS.map((o) => o.value)).toEqual(['default', 'nearest', 'newest', 'tier'])
  })
})
