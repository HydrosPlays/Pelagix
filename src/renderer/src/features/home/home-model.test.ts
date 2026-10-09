import { describe, expect, it } from 'vitest'
import { BALLS } from '@shared/balls'
import { GAMES, SYSTEMS } from '@shared/games'
import { computeProgress, type GenerationProgress, type Progress, type TimelinePoint } from '@renderer/domain/progress'
import { computeCollection } from '@renderer/domain/slots'
import { fixtureDex, ID, makeEntry, makeSave } from '@renderer/lib/test-fixture'
import {
  closestGeneration,
  coveredTypes,
  daysText,
  greeting,
  monthRangeText,
  nextStep,
  recentMonths,
  regionOfGeneration,
  roman,
  tickerPercent,
  timelineSummary,
  usedBalls,
  usedGames,
  usedSystems
} from './home-model'

const gen = (n: number, caught: number, slots: number): GenerationProgress => ({ gen: n, name: `Generation ${n}`, slots, caught, shiny: 0, species: slots, speciesCaught: caught })
const point = (period: string, entries: number, extra: Partial<TimelinePoint> = {}): TimelinePoint => ({ period, entries, shiny: 0, newSlots: entries, totalEntries: 0, totalSlots: 0, ...extra })
const at = (hour: number): Date => new Date(2026, 9, 9, hour, 30)

function progressOf(entries: ReturnType<typeof makeEntry>[], now = new Date(2026, 9, 9, 12)): Progress {
  const save = makeSave(entries)
  return computeProgress(fixtureDex, save, computeCollection(fixtureDex, save), { now })
}

describe('generations', () => {
  it('names the region of each generation and falls back for unknown ones', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(regionOfGeneration)).toEqual(['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova', 'Kalos', 'Alola', 'Galar', 'Paldea'])
    expect(regionOfGeneration(10)).toBe('Generation 10')
  })

  it('writes roman numerals', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 19, 40, 49].map(roman)).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XIV', 'XIX', 'XL', 'XLIX'])
    expect(roman(0)).toBe('0')
    expect(roman(2.5)).toBe('2.5')
    expect(roman(50)).toBe('50')
  })

  it('picks the started generation with the fewest slots left', () => {
    expect(closestGeneration([gen(1, 100, 151), gen(2, 95, 100), gen(3, 0, 135), gen(4, 107, 107)])?.gen).toBe(2)
    // A tie goes to the earlier generation.
    expect(closestGeneration([gen(1, 90, 100), gen(2, 40, 50)])?.gen).toBe(1)
    expect(closestGeneration([gen(1, 0, 151), gen(2, 100, 100)])).toBeNull()
    expect(closestGeneration([])).toBeNull()
  })
})

describe('greeting', () => {
  it('follows the time of day', () => {
    expect(greeting('Hydro', at(4))).toBe('Good evening, Hydro')
    expect(greeting('Hydro', at(5))).toBe('Good morning, Hydro')
    expect(greeting('Hydro', at(11))).toBe('Good morning, Hydro')
    expect(greeting('Hydro', at(12))).toBe('Good afternoon, Hydro')
    expect(greeting('Hydro', at(17))).toBe('Good afternoon, Hydro')
    expect(greeting('Hydro', at(18))).toBe('Good evening, Hydro')
    expect(greeting('Hydro', at(23))).toBe('Good evening, Hydro')
  })

  it('calls a nameless user Trainer and ignores stray spaces', () => {
    expect(greeting('', at(9))).toBe('Good morning, Trainer')
    expect(greeting('   ', at(9))).toBe('Good morning, Trainer')
    expect(greeting('  Ash ', at(9))).toBe('Good morning, Ash')
  })
})

describe('nextStep', () => {
  const totals = (caught: number, slots: number): Progress['totals'] => ({ slots, caught, shiny: 0, species: slots, speciesCaught: caught, entries: caught, completion: caught / slots, shinyCompletion: 0 })
  const streaks = (current: number, caughtToday: boolean): Progress['streaks'] => ({ current, longest: current, longestEnd: null, activeDays: current, firstDay: null, lastDay: null, caughtToday })

  it('celebrates a complete Living Dex', () => {
    expect(nextStep({ totals: totals(10, 10), byGeneration: [gen(1, 10, 10)], streaks: streaks(0, false) })).toMatch(/complete/)
  })

  it('reminds about a streak that needs a catch today', () => {
    expect(nextStep({ totals: totals(5, 10), byGeneration: [gen(1, 5, 10)], streaks: streaks(3, false) })).toBe('You are on a 3-day streak. Log a catch today to keep it going.')
  })

  it('otherwise says how many are left and which region is closest', () => {
    const text = nextStep({ totals: totals(1200, 2255), byGeneration: [gen(1, 100, 151), gen(2, 97, 100)], streaks: streaks(3, true) })
    expect(text).toBe('1,055 still to catch. Johto is closest: 3 more to finish it.')
    expect(nextStep({ totals: totals(0, 151), byGeneration: [gen(1, 0, 151)], streaks: streaks(0, false) })).toBe('151 still to catch.')
  })

  it('leaves the region out until at least half of it is caught', () => {
    const args = (caught: number): Parameters<typeof nextStep>[0] => ({ totals: totals(caught, 400), byGeneration: [gen(1, caught, 200), gen(2, 0, 200)], streaks: streaks(0, false) })
    expect(nextStep(args(99))).toBe('301 still to catch.')
    expect(nextStep(args(100))).toBe('300 still to catch. Kanto is closest: 100 more to finish it.')
  })

  it('works on real progress', () => {
    const progress = progressOf([makeEntry(ID.pikachu, 0, { date: '2026-10-09' })])
    expect(nextStep(progress)).toMatch(/^\d+ still to catch\.$/)
  })
})

describe('tickerPercent', () => {
  it('shows a plain figure while counting and the canonical text at the end', () => {
    expect(tickerPercent(0, 433, 1365)).toBe('0.0%')
    expect(tickerPercent(12.34, 433, 1365)).toBe('12.3%')
    expect(tickerPercent((433 / 1365) * 100, 433, 1365)).toBe('31.7%')
  })

  it('never ends on a false 0% or 100%', () => {
    expect(tickerPercent((1 / 5000) * 100, 1, 5000)).toBe('0.1%')
    expect(tickerPercent((4999 / 5000) * 100, 4999, 5000)).toBe('99.9%')
    expect(tickerPercent(100, 5000, 5000)).toBe('100%')
    expect(tickerPercent(0, 0, 5000)).toBe('0%')
    expect(tickerPercent(0, 0, 0)).toBe('0%')
    // Mid-count overshoot never prints 100.
    expect(tickerPercent(99.99, 10, 5000)).toBe('99.9%')
  })
})

describe('usage lists', () => {
  it('keeps used games only, most used first, ties in canonical order', () => {
    const [red, blue, gold] = [GAMES[0]!, GAMES[2]!, GAMES[5]!]
    const list = usedGames([
      { game: red, entries: 2, shiny: 0, species: 2, slots: 2 },
      { game: blue, entries: 0, shiny: 0, species: 0, slots: 0 },
      { game: gold, entries: 2, shiny: 1, species: 1, slots: 1 },
      { game: GAMES[9]!, entries: 7, shiny: 0, species: 7, slots: 7 }
    ])
    expect(list.map((g) => g.game.id)).toEqual([GAMES[9]!.id, red.id, gold.id])
  })

  it('does the same for systems and balls without touching the input', () => {
    const systems = SYSTEMS.map((system, i) => ({ system, entries: i === 2 ? 5 : i === 7 ? 9 : 0, shiny: 0, games: 1 }))
    expect(usedSystems(systems).map((s) => s.system.id)).toEqual([SYSTEMS[7]!.id, SYSTEMS[2]!.id])
    expect(systems[0]!.entries).toBe(0)

    const balls = BALLS.map((ball, i) => ({ ball, entries: i < 3 ? 3 - i : 0, shiny: 0 }))
    expect(usedBalls(balls).map((b) => b.ball.id)).toEqual([BALLS[0]!.id, BALLS[1]!.id, BALLS[2]!.id])
    expect(usedBalls(BALLS.map((ball) => ({ ball, entries: 0, shiny: 0 })))).toEqual([])
  })

  it('lists only types that have slots', () => {
    const progress = progressOf([])
    const types = coveredTypes(progress.byType)
    expect(types.length).toBeGreaterThan(0)
    expect(types.every((t) => t.slots > 0)).toBe(true)
    expect(coveredTypes([{ type: 'fire', slots: 0, caught: 0, shiny: 0 }])).toEqual([])
  })
})

describe('recentMonths', () => {
  it('ends with the current month and fills gaps with zero bars', () => {
    const months = recentMonths([point('2026-08', 4), point('2026-09', 0), point('2026-10', 2, { shiny: 1, newSlots: 1 })], '2026-10-09')
    expect(months).toHaveLength(12)
    expect(months[0]!.period).toBe('2025-11')
    expect(months[11]).toMatchObject({ period: '2026-10', label: 'Oct', title: 'October 2026', entries: 2, shiny: 1, newSlots: 1, current: true })
    expect(months.filter((m) => m.current)).toHaveLength(1)
    expect(months.map((m) => m.entries)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 2])
  })

  it('pads up to today when the last catch was a few months ago', () => {
    const months = recentMonths([point('2026-03', 5)], '2026-10-09')
    expect(months[11]!.period).toBe('2026-10')
    expect(months.find((m) => m.period === '2026-03')?.entries).toBe(5)
  })

  it('moves the window to the last catch when everything is older than a year', () => {
    const months = recentMonths([point('2019-11', 3), point('2019-12', 9)], '2026-10-09')
    expect(months[0]!.period).toBe('2019-01')
    expect(months[11]).toMatchObject({ period: '2019-12', entries: 9, current: false })
    expect(months.some((m) => m.current)).toBe(false)
  })

  it('follows catches dated after today', () => {
    const months = recentMonths([point('2026-12', 1)], '2026-10-09')
    expect(months[11]!.period).toBe('2026-12')
    expect(months.find((m) => m.current)?.period).toBe('2026-10')
  })

  it('crosses year boundaries and honours the count', () => {
    expect(recentMonths([], '2026-02-01', 4).map((m) => m.period)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(recentMonths([], '2026-02-01', 0)).toHaveLength(1)
  })

  it('reads the months of real progress', () => {
    const progress = progressOf([makeEntry(ID.pikachu, 0, { date: '2026-07-04' }), makeEntry(ID.eevee, 0, { date: '2026-10-09', shiny: true })])
    const months = recentMonths(progress.byMonth, '2026-10-09')
    expect(months.find((m) => m.period === '2026-07')).toMatchObject({ entries: 1, newSlots: 1 })
    expect(months[11]).toMatchObject({ entries: 1, shiny: 1, current: true })
  })
})

describe('timeline wording', () => {
  it('describes the range', () => {
    expect(monthRangeText(recentMonths([], '2026-10-09'))).toBe('Nov 2025 – Oct 2026')
    expect(monthRangeText(recentMonths([], '2026-10-09', 1))).toBe('Oct 2026')
    expect(monthRangeText([])).toBe('')
  })

  it('summarises the bars', () => {
    expect(timelineSummary(recentMonths([], '2026-10-09'))).toBe('No catches in these months.')
    expect(timelineSummary(recentMonths([point('2026-10', 1)], '2026-10-09'))).toBe('1 catch, all in October 2026.')
    expect(timelineSummary(recentMonths([point('2026-08', 1200), point('2026-09', 0), point('2026-10', 34)], '2026-10-09'))).toBe('1,234 catches. Busiest month: August 2026 (1,200).')
  })

  it('counts days', () => {
    expect([0, 1, 21, 1500].map(daysText)).toEqual(['0 days', '1 day', '21 days', '1,500 days'])
  })
})
