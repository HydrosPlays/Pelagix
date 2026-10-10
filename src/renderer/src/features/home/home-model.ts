/**
 * Pure helpers behind the Home dashboard: wording, ordering and the windows the charts show.
 * No React and no DOM, so everything here is unit-tested.
 */

import type { BallProgress, GameProgress, GenerationProgress, Progress, SystemProgress, TimelinePoint, TypeProgress } from '@renderer/domain/progress'
import { activeLanguage, t, type MessageKey } from '@renderer/i18n/runtime'
import { formatMonth, percent } from '@renderer/lib/format'
import { languageTag } from '@shared/languages'

// ---------------------------------------------------------------- generations

/** The region each generation introduced. Generation VIII is Galar (Hisui's new species count there too). */
const GENERATION_REGIONS: Readonly<Record<number, MessageKey>> = {
  1: 'home.region.1',
  2: 'home.region.2',
  3: 'home.region.3',
  4: 'home.region.4',
  5: 'home.region.5',
  6: 'home.region.6',
  7: 'home.region.7',
  8: 'home.region.8',
  9: 'home.region.9'
}

/** "Kanto" for 1; a generation the app has no region name for reads "Generation 10". */
export function regionOfGeneration(gen: number): string {
  const key = GENERATION_REGIONS[gen]
  return key ? t(key) : t('home.region.unknown', { gen: String(gen) })
}

const ROMAN: ReadonlyArray<readonly [number, string]> = [
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I']
]

/** Roman numeral of a small positive integer (generation numbers); anything else comes back as digits. */
export function roman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 49) return String(n)
  let rest = n
  let out = ''
  for (const [value, glyph] of ROMAN) {
    while (rest >= value) {
      out += glyph
      rest -= value
    }
  }
  return out
}

/**
 * The generation that is nearest to done: started, not finished, fewest slots left. Ties go to
 * the earlier generation. Null when nothing is in progress.
 */
export function closestGeneration(generations: readonly GenerationProgress[]): GenerationProgress | null {
  let best: GenerationProgress | null = null
  for (const g of generations) {
    if (g.caught <= 0 || g.caught >= g.slots) continue
    if (!best || g.slots - g.caught < best.slots - best.caught) best = g
  }
  return best
}

// ---------------------------------------------------------------- hero wording

/** "Good morning, Hydro" by the local hour; without a name the trainer is simply "Trainer". */
export function greeting(trainerName: string, now: Date = new Date()): string {
  const hour = now.getHours()
  const key: MessageKey = hour >= 5 && hour < 12 ? 'home.greeting.morning' : hour >= 12 && hour < 18 ? 'home.greeting.afternoon' : 'home.greeting.evening'
  const name = trainerName.trim()
  return t(key, { name: name === '' ? t('home.greeting.trainer') : name })
}

/** One or two short sentences under the greeting: where the user stands and what would move them on. */
export function nextStep(progress: Pick<Progress, 'totals' | 'byGeneration' | 'streaks'>): string {
  const { caught, slots } = progress.totals
  const left = Math.max(0, slots - caught)
  if (slots > 0 && left === 0) return t('home.next.complete')

  const { current, caughtToday } = progress.streaks
  if (current >= 2 && !caughtToday) return t('home.next.streak', { count: current })

  const close = closestGeneration(progress.byGeneration)
  // Pointing at a region only helps once it is within reach: at least half of it caught.
  if (!close || close.caught * 2 < close.slots) return t('home.next.left', { left })
  const missing = close.slots - close.caught
  return t('home.next.leftClosest', { left, region: regionOfGeneration(close.gen), missing })
}

/**
 * Text of a counting percentage. While the number is still running it is a plain one-decimal
 * figure; once it reaches the real value it is the app-wide `percent()` wording, which never
 * rounds to a false 0% or 100%.
 */
export function tickerPercent(running: number, part: number, total: number): string {
  const target = total > 0 ? (part / total) * 100 : 0
  if (Math.abs(running - target) < 0.05) return percent(part, total)
  return `${Math.min(99.9, Math.max(0, running)).toFixed(1)}%`
}

// ---------------------------------------------------------------- usage lists

/** Games with at least one entry, most used first; ties keep the canonical (release) order. */
export function usedGames(byGame: readonly GameProgress[]): GameProgress[] {
  return byGame.filter((g) => g.entries > 0).sort((a, b) => b.entries - a.entries)
}

/** Systems with at least one entry, most used first; ties keep the `SYSTEMS` order. */
export function usedSystems(bySystem: readonly SystemProgress[]): SystemProgress[] {
  return bySystem.filter((s) => s.entries > 0).sort((a, b) => b.entries - a.entries)
}

/** Balls with at least one entry, most used first; ties keep the `BALLS` order. */
export function usedBalls(byBall: readonly BallProgress[]): BallProgress[] {
  return byBall.filter((b) => b.entries > 0).sort((a, b) => b.entries - a.entries)
}

/** Types that have slots under the current rules, in game order. */
export function coveredTypes(byType: readonly TypeProgress[]): TypeProgress[] {
  return byType.filter((t) => t.slots > 0)
}

// ---------------------------------------------------------------- timeline

export interface MonthBar {
  /** `yyyy-mm`. */
  period: string
  /** "Oct". */
  label: string
  /** "October 2026". */
  title: string
  entries: number
  shiny: number
  /** Slots caught for the first time that month. */
  newSlots: number
  /** This is the month `today` falls in. */
  current: boolean
}

/** "Oct": the month alone, short. Other languages have their own short form, which is not always three letters. */
function monthLabel(period: string): string {
  const language = activeLanguage()
  if (language === 'en') return formatMonth(period).slice(0, 3)
  return new Intl.DateTimeFormat(languageTag(language), { month: 'short' }).format(new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)) - 1, 1))
}

const monthIndex = (period: string): number => Number(period.slice(0, 4)) * 12 + (Number(period.slice(5, 7)) - 1)
const monthOf = (index: number): string => `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`

/**
 * The months the activity chart shows: `count` consecutive months, gaps as zero bars.
 *
 * The window normally ends with the current month. When every catch is older than that window
 * (someone logging a collection from years ago), or dated later than today, it ends with the last
 * month that has a catch instead, so the chart is never a row of empty bars.
 */
export function recentMonths(byMonth: readonly TimelinePoint[], today: string, count = 12): MonthBar[] {
  const size = Math.max(1, Math.floor(count))
  const now = monthIndex(today)
  const lastPeriod = byMonth[byMonth.length - 1]?.period
  const last = lastPeriod === undefined ? now : monthIndex(lastPeriod)
  const end = last > now || now - last >= size ? last : now
  const points = new Map(byMonth.map((p) => [p.period, p]))

  const out: MonthBar[] = []
  for (let index = end - size + 1; index <= end; index++) {
    const period = monthOf(index)
    const point = points.get(period)
    out.push({
      period,
      label: monthLabel(period),
      title: formatMonth(period, true),
      entries: point?.entries ?? 0,
      shiny: point?.shiny ?? 0,
      newSlots: point?.newSlots ?? 0,
      current: index === now
    })
  }
  return out
}

/** "Nov 2025 – Oct 2026", or just "Oct 2026" for a single month. Empty for no months. */
export function monthRangeText(months: readonly MonthBar[]): string {
  const first = months[0]
  const last = months[months.length - 1]
  if (!first || !last) return ''
  return first.period === last.period ? formatMonth(first.period) : t('home.activity.range', { from: formatMonth(first.period), to: formatMonth(last.period) })
}

/** One sentence that says what the chart shows, for screen readers and the caption under it. */
export function timelineSummary(months: readonly MonthBar[]): string {
  const total = months.reduce((n, m) => n + m.entries, 0)
  if (total === 0) return t('home.activity.summary.none')
  const busiest = months.reduce((best, m) => (m.entries > best.entries ? m : best))
  return months.filter((m) => m.entries > 0).length > 1 ? t('home.activity.summary.busiest', { count: total, month: busiest.title, entries: busiest.entries }) : t('home.activity.summary.single', { count: total, month: busiest.title })
}

/** "3 days", "1 day". */
export function daysText(days: number): string {
  return t('home.activity.days', { count: days })
}
