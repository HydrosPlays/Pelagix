import { describe, expect, it } from 'vitest'
import { BALLS } from '@shared/balls'
import { GAMES, SYSTEMS } from '@shared/games'
import type { CatchEntry } from '@shared/save-types'
import { Dex } from '@renderer/lib/data'
import { fixtureDex as dex, fixtureIndex, ID, makeEntry, makeSave } from '@renderer/lib/test-fixture'
import { computeProgress, computeStreaks, entryDay, progressFor } from './progress'
import { buildSlots, computeCollection, RULE_PRESETS, slotTarget } from './slots'

const TODAY = new Date(2026, 0, 10, 15, 0)

// Ten entries under the default rules; the comments say which slot each one fills.
const e1 = makeEntry(ID.bulbasaur, 0, { game: 'red', kind: 'gift', ball: 4, date: '2026-01-01', gender: 'm', level: 5 }) // 1
const e2 = makeEntry(ID.bulbasaur, 0, { game: 'firered', kind: 'gift', ball: 4, date: '2026-01-02', shiny: true, nickname: 'Bulby' }) // 1 (duplicate, shiny)
const e3 = makeEntry(ID.pikachu, 0, { game: 'yellow', kind: 'gift', ball: 4, date: '2026-01-02', gender: 'f' }) // 25:f
const e4 = makeEntry(ID.pikachu, 0, { game: 'sword', kind: 'raid', ball: 2, date: '2026-01-03', gender: 'm', shiny: true, gmax: true, level: 100 }) // 25:m
const e5 = makeEntry(ID.raichu, 1, { game: 'sun', kind: 'evolved', ball: 12, date: '2026-01-03', notes: 'Evolved on Melemele' }) // 26-1
const e6 = makeEntry(ID.mewtwo, 0, { game: 'red', kind: 'static', ball: 1, date: '2026-01-09', gender: 'n' }) // 150
const e7 = makeEntry(ID.unown, 1, { game: 'legendsarceus', kind: 'static', ball: 28, date: '2026-01-10', alpha: true }) // 201-1
const e8 = makeEntry(ID.sprigatito, 0, { game: 'scarlet', kind: 'gift', date: '2025-12-31' }) // 906
const e9 = makeEntry(9999, 0, { game: 'red', kind: 'wild', date: '2026-01-10' }) // species unknown to the dataset: no slot
const loggedAt = new Date(2026, 0, 9, 8, 0).toISOString()
const e10 = makeEntry(ID.eevee, 0, { game: 'future-game', kind: 'transfer', ball: 4, createdAt: loggedAt, updatedAt: loggedAt }) // 133:m, no date
const entries = [e1, e2, e3, e4, e5, e6, e7, e8, e9, e10]

const save = makeSave(entries)
const collection = computeCollection(dex, save)
const p = computeProgress(dex, save, collection, { now: TODAY })
const pick = <T, K extends keyof T>(list: T[], key: K, value: T[K]): T => {
  const found = list.find((x) => x[key] === value)
  if (!found) throw new Error(`no row with ${String(key)} = ${String(value)}`)
  return found
}

describe('computeProgress', () => {
  it('summarises totals and completion', () => {
    expect(p.totals).toEqual({ slots: 104, caught: 8, shiny: 2, species: 24, speciesCaught: 7, entries: 10, completion: 8 / 104, shinyCompletion: 2 / 104 })
    expect(p.shiny).toEqual({ entries: 2, slots: 2, species: 2 })
  })

  it('counts entry attributes', () => {
    expect(p.counts).toEqual({
      entries: 10, shiny: 2, alpha: 1, gmax: 1, male: 2, female: 1, genderless: 1, nicknamed: 1, withNotes: 1, level100: 1,
      duplicates: 1, unknownGame: 1, noBall: 2
    })
  })

  it('breaks slots and species down by generation', () => {
    expect(p.byGeneration.map((g) => g.gen)).toEqual([1, 2, 4, 5, 6, 8, 9])
    expect(p.byGeneration.map((g) => g.slots)).toEqual([12, 29, 24, 1, 23, 11, 4])
    expect(p.byGeneration.reduce((n, g) => n + g.slots, 0)).toBe(104)
    expect(pick(p.byGeneration, 'gen', 1)).toEqual({ gen: 1, name: 'Generation I', slots: 12, caught: 6, shiny: 2, species: 7, speciesCaught: 5 })
    expect(pick(p.byGeneration, 'gen', 2)).toEqual({ gen: 2, name: 'Generation II', slots: 29, caught: 1, shiny: 0, species: 2, speciesCaught: 1 })
    expect(pick(p.byGeneration, 'gen', 9)).toMatchObject({ name: 'Generation IX', slots: 4, caught: 1, species: 4, speciesCaught: 1 })
    expect(pick(p.byGeneration, 'gen', 6)).toMatchObject({ slots: 23, caught: 0, species: 5, speciesCaught: 0 })
  })

  it('breaks slots down by type, counting dual types twice', () => {
    expect(p.byType).toHaveLength(18)
    expect(p.byType[0]?.type).toBe('normal')
    expect(pick(p.byType, 'type', 'electric')).toEqual({ type: 'electric', slots: 13, caught: 3, shiny: 1 })
    expect(pick(p.byType, 'type', 'psychic')).toEqual({ type: 'psychic', slots: 34, caught: 3, shiny: 0 })
    expect(pick(p.byType, 'type', 'grass')).toEqual({ type: 'grass', slots: 9, caught: 2, shiny: 1 })
    expect(pick(p.byType, 'type', 'normal')).toEqual({ type: 'normal', slots: 3, caught: 1, shiny: 0 })
    expect(pick(p.byType, 'type', 'steel')).toEqual({ type: 'steel', slots: 1, caught: 0, shiny: 0 }) // Arceus (Steel); Crowned Zacian is off
  })

  it('breaks slots down by form category', () => {
    expect(p.byCategory).toEqual([
      { cat: 'base', slots: 28, caught: 6, shiny: 2 },
      { cat: 'regional', slots: 1, caught: 1, shiny: 0 },
      { cat: 'gender', slots: 1, caught: 0, shiny: 0 },
      { cat: 'cosmetic', slots: 52, caught: 1, shiny: 0 },
      { cat: 'changeable', slots: 22, caught: 0, shiny: 0 }
    ])
  })

  it('tracks species tags', () => {
    expect(p.byTag).toEqual([
      { tag: 'starter', species: 6, speciesCaught: 2 },
      { tag: 'baby', species: 1, speciesCaught: 0 },
      { tag: 'legendary', species: 4, speciesCaught: 1 },
      { tag: 'mythical', species: 1, speciesCaught: 0 },
      { tag: 'paradox', species: 1, speciesCaught: 0 }
    ])
  })

  it('lists every game of the dataset with its usage', () => {
    expect(p.byGame.map((g) => g.game.id)).toEqual(GAMES.map((g) => g.id))
    expect(pick(p.byGame, 'game', GAMES[0]!)).toEqual({ game: GAMES[0], entries: 3, shiny: 0, species: 3, slots: 2 }) // red: e1, e6 and the unplaced e9
    const by = (id: string) => p.byGame.find((g) => g.game.id === id)!
    expect(by('firered')).toMatchObject({ entries: 1, shiny: 1, species: 1, slots: 1 })
    expect(by('sword')).toMatchObject({ entries: 1, shiny: 1 })
    expect(by('blue')).toMatchObject({ entries: 0, shiny: 0, species: 0, slots: 0 })
    expect(p.byGame.reduce((n, g) => n + g.entries, 0)).toBe(9) // the unknown game is left out
  })

  it('rolls games up into systems', () => {
    expect(p.bySystem.map((s) => s.system.id)).toEqual(SYSTEMS.map((s) => s.id))
    const by = (id: string) => p.bySystem.find((s) => s.system.id === id)!
    expect(by('gb')).toMatchObject({ entries: 4, shiny: 0, games: 2 })
    expect(by('gba')).toMatchObject({ entries: 1, shiny: 1, games: 1 })
    expect(by('3ds')).toMatchObject({ entries: 1, shiny: 0, games: 1 })
    expect(by('switch')).toMatchObject({ entries: 3, shiny: 1, games: 3 })
    expect(by('nds')).toMatchObject({ entries: 0, shiny: 0, games: 0 })
  })

  it('counts balls and kinds, unused ones included', () => {
    expect(p.byBall.map((b) => b.ball.id)).toEqual(BALLS.map((b) => b.id))
    const ball = (id: number) => p.byBall.find((b) => b.ball.id === id)!
    expect(ball(4)).toMatchObject({ entries: 4, shiny: 1 })
    expect(ball(2)).toMatchObject({ entries: 1, shiny: 1 })
    expect(ball(28)).toMatchObject({ entries: 1, shiny: 0 })
    expect(ball(16)).toMatchObject({ entries: 0, shiny: 0 })
    expect(p.byBall.reduce((n, b) => n + b.entries, 0) + p.counts.noBall).toBe(10)

    expect(p.byKind).toHaveLength(16)
    expect(Object.fromEntries(p.byKind.filter((k) => k.entries > 0).map((k) => [k.kind, k.entries]))).toEqual({ wild: 1, static: 2, gift: 4, raid: 1, evolved: 1, transfer: 1 })
  })

  it('lists what the entries cover, in canonical order', () => {
    expect(p.distinct).toEqual({
      games: ['red', 'yellow', 'firered', 'sun', 'sword', 'legendsarceus', 'scarlet'],
      systems: ['gb', 'gba', '3ds', 'switch'],
      balls: [4, 2, 1, 12, 28],
      kinds: ['wild', 'static', 'gift', 'raid', 'evolved', 'transfer'],
      generations: [1, 3, 7, 8, 9]
    })
  })

  it('builds a gapless monthly and yearly timeline with first-time slots', () => {
    expect(p.byMonth).toEqual([
      { period: '2025-12', entries: 1, shiny: 0, newSlots: 1, totalEntries: 1, totalSlots: 1 },
      { period: '2026-01', entries: 9, shiny: 2, newSlots: 7, totalEntries: 10, totalSlots: 8 }
    ])
    expect(p.byYear).toEqual([
      { period: '2025', entries: 1, shiny: 0, newSlots: 1, totalEntries: 1, totalSlots: 1 },
      { period: '2026', entries: 9, shiny: 2, newSlots: 7, totalEntries: 10, totalSlots: 8 }
    ])
  })

  it('fills months without entries', () => {
    const old = makeEntry(ID.mewtwo, 0, { date: '2025-10-15' })
    const recent = makeEntry(ID.mewtwo, 0, { date: '2026-02-01' })
    const s = makeSave([recent, old])
    const result = computeProgress(dex, s, computeCollection(dex, s), { now: TODAY })
    expect(result.byMonth.map((m) => [m.period, m.entries, m.newSlots, m.totalSlots])).toEqual([
      ['2025-10', 1, 1, 1], ['2025-11', 0, 0, 1], ['2025-12', 0, 0, 1], ['2026-01', 0, 0, 1], ['2026-02', 1, 0, 1]
    ])
    expect(result.byYear.map((y) => [y.period, y.entries, y.newSlots])).toEqual([['2025', 1, 1], ['2026', 1, 0]])
  })

  it('computes streaks from entry days', () => {
    expect(p.streaks).toEqual({ current: 2, longest: 4, longestEnd: '2026-01-03', activeDays: 6, firstDay: '2025-12-31', lastDay: '2026-01-10', caughtToday: true })
  })

  it('counts complete evolution families', () => {
    expect(p.families).toEqual({ total: 14, complete: 3 }) // Eevee, Mewtwo and Unown stand alone in the fixture
  })

  it('ranks the most-logged species', () => {
    expect(p.topSpecies).toEqual([
      { species: 1, entries: 2 }, { species: 25, entries: 2 }, { species: 26, entries: 1 }, { species: 133, entries: 1 }, { species: 150, entries: 1 }
    ])
    expect(computeProgress(dex, save, collection, { now: TODAY, top: 1 }).topSpecies).toEqual([{ species: 1, entries: 2 }])
  })

  it('lists the most recently logged entries first', () => {
    expect(p.recent).toHaveLength(10)
    expect(p.recent.slice(0, 3)).toEqual([e10, e9, e8])
    expect(p.recent[9]).toBe(e1)
    expect(computeProgress(dex, save, collection, { now: TODAY, recent: 2 }).recent).toEqual([e10, e9])
    expect(computeProgress(dex, save, collection, { now: TODAY, recent: 0 }).recent).toEqual([])
    expect(save.entries).toEqual(entries) // not reordered in place
  })

  it('suggests the next uncaught slots in dex order', () => {
    expect(p.nextUncaught.map((s) => s.key)).toEqual(['2', '3:m', '3:f', '26:m', '26:f', '133:f', '172', '201', '201-2', '201-3', '201-4', '201-5'])
    expect(computeProgress(dex, save, collection, { now: TODAY, suggestions: 3 }).nextUncaught.map((s) => s.label)).toEqual(['Ivysaur', 'Venusaur ♂', 'Venusaur ♀'])
    expect(computeProgress(dex, save, collection, { now: TODAY, suggestions: 0 }).nextUncaught).toEqual([])
  })

  it('handles an empty save', () => {
    const empty = makeSave()
    const result = computeProgress(dex, empty, computeCollection(dex, empty), { now: TODAY })
    expect(result.totals).toMatchObject({ entries: 0, caught: 0, completion: 0, shinyCompletion: 0 })
    expect(result.byMonth).toEqual([])
    expect(result.byYear).toEqual([])
    expect(result.recent).toEqual([])
    expect(result.topSpecies).toEqual([])
    expect(result.streaks).toEqual({ current: 0, longest: 0, longestEnd: null, activeDays: 0, firstDay: null, lastDay: null, caughtToday: false })
    expect(result.distinct).toEqual({ games: [], systems: [], balls: [], kinds: [], generations: [] })
    expect(result.families).toEqual({ total: 14, complete: 0 })
    expect(result.nextUncaught).toHaveLength(12)
    expect(result.byGame).toHaveLength(46)
    expect(result.counts.duplicates).toBe(0)
  })

  it('follows the rules: a species-only dex has one base slot per species', () => {
    const s = makeSave(entries, RULE_PRESETS.species.rules)
    const result = computeProgress(dex, s, computeCollection(dex, s), { now: TODAY })
    expect(result.totals).toMatchObject({ slots: 24, caught: 7, shiny: 2 })
    expect(result.byCategory).toEqual([{ cat: 'base', slots: 24, caught: 7, shiny: 2 }])
    expect(result.counts.duplicates).toBe(2) // both Bulbasaur and both Pikachu share a slot now
  })

  it('reaches 100% when every slot of the completionist dex has an entry', () => {
    const rules = RULE_PRESETS.completionist.rules
    const all = buildSlots(dex, rules).map((slot) => makeEntry(slot.species, slot.form, { ...slotTarget(slot), shiny: true, date: '2026-01-10' }))
    const s = makeSave(all, rules)
    const result = computeProgress(dex, s, computeCollection(dex, s), { now: TODAY })
    expect(result.totals).toMatchObject({ slots: 193, caught: 193, shiny: 193, completion: 1, shinyCompletion: 1, speciesCaught: 24 })
    expect(result.nextUncaught).toEqual([])
    expect(result.families.complete).toBe(14)
    expect(result.byGeneration.every((g) => g.caught === g.slots && g.speciesCaught === g.species)).toBe(true)
    expect(result.byCategory.map((c) => c.cat)).toEqual(['base', 'regional', 'gender', 'cosmetic', 'changeable', 'fusion', 'event', 'partner', 'mega', 'battle'])
    expect(result.counts.duplicates).toBe(0)
  })

  it('counts a known game that the dataset does not list', () => {
    // A dataset built without Colosseum must not hide a Colosseum catch from the stats.
    const trimmed = new Dex({ ...fixtureIndex, games: fixtureIndex.games.map((id) => (id === 'colosseum' ? 'not-a-game' : id)) })
    expect(trimmed.games.some((g) => g.id === 'colosseum')).toBe(false)
    const s = makeSave([makeEntry(ID.eevee, 0, { game: 'colosseum' })])
    const result = computeProgress(trimmed, s, computeCollection(trimmed, s), { now: TODAY })
    expect(result.byGame.map((g) => g.game.id)).toEqual(GAMES.map((g) => g.id)) // back in its canonical place
    expect(result.distinct.games).toEqual(['colosseum'])
    expect(result.distinct.systems).toEqual(['gcn'])
    const without = computeProgress(trimmed, makeSave(), computeCollection(trimmed, makeSave()), { now: TODAY })
    expect(without.byGame).toHaveLength(45)
  })
})

describe('entryDay', () => {
  it('prefers the catch date', () => {
    expect(entryDay({ date: '2020-05-17', createdAt: '2026-01-01T12:00:00.000Z' })).toBe('2020-05-17')
  })

  it('falls back to the local day the entry was logged', () => {
    expect(entryDay({ createdAt: new Date(2026, 2, 5, 23, 59).toISOString() })).toBe('2026-03-05')
    expect(entryDay({ createdAt: new Date(2026, 2, 5, 0, 1).toISOString() })).toBe('2026-03-05')
    expect(entryDay({ date: 'someday', createdAt: new Date(2026, 2, 5, 12).toISOString() })).toBe('2026-03-05')
    expect(entryDay(e10)).toBe('2026-01-09')
  })

  it('never throws on a broken timestamp', () => {
    expect(entryDay({ createdAt: 'garbage' })).toBe('1970-01-01')
  })
})

describe('computeStreaks', () => {
  const streak = (days: string[], today: string) => computeStreaks(days, today)

  it('is all zeros without days', () => {
    expect(streak([], '2026-01-10')).toEqual({ current: 0, longest: 0, longestEnd: null, activeDays: 0, firstDay: null, lastDay: null, caughtToday: false })
  })

  it('counts a run ending today', () => {
    expect(streak(['2026-01-08', '2026-01-09', '2026-01-10'], '2026-01-10')).toMatchObject({ current: 3, longest: 3, longestEnd: '2026-01-10', caughtToday: true })
  })

  it('keeps a run alive until a full day is missed', () => {
    const days = ['2026-01-07', '2026-01-08', '2026-01-09']
    expect(streak(days, '2026-01-10')).toMatchObject({ current: 3, caughtToday: false })
    expect(streak(days, '2026-01-11')).toMatchObject({ current: 0, longest: 3, longestEnd: '2026-01-09' })
  })

  it('finds the longest run anywhere and the first of equal runs', () => {
    const days = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-10']
    expect(streak(days, '2026-01-10')).toMatchObject({ current: 1, longest: 3, longestEnd: '2026-01-03', activeDays: 7 })
  })

  it('ignores duplicates, order and invalid days', () => {
    const days = ['2026-01-10', '2026-01-09', '2026-01-10', 'nope', '2026-02-30', '2026-01-09']
    expect(streak(days, '2026-01-10')).toEqual({ current: 2, longest: 2, longestEnd: '2026-01-10', activeDays: 2, firstDay: '2026-01-09', lastDay: '2026-01-10', caughtToday: true })
  })

  it('crosses month, year and leap-day boundaries', () => {
    expect(streak(['2025-12-30', '2025-12-31', '2026-01-01'], '2026-01-01').current).toBe(3)
    expect(streak(['2024-02-28', '2024-02-29', '2024-03-01'], '2024-03-02').current).toBe(3)
    expect(streak(['2026-03-28', '2026-03-29', '2026-03-30'], '2026-03-30').current).toBe(3) // DST change in Europe
  })

  it('does not count days in the future toward the current streak', () => {
    expect(streak(['2026-01-12', '2026-01-13'], '2026-01-10')).toMatchObject({ current: 0, longest: 2 })
  })
})

describe('progressFor', () => {
  it('reuses the latest result for identical inputs on the same day', () => {
    const list: readonly CatchEntry[] = save.entries
    const a = progressFor(dex, list, collection, TODAY)
    expect(progressFor(dex, list, collection, new Date(2026, 0, 10, 23, 59))).toBe(a)
    expect(a.streaks.current).toBe(2)
  })

  it('recomputes on a new day so streaks roll over', () => {
    const a = progressFor(dex, save.entries, collection, TODAY)
    const b = progressFor(dex, save.entries, collection, new Date(2026, 0, 12, 9, 0))
    expect(b).not.toBe(a)
    expect(b.streaks.current).toBe(0)
    expect(b.streaks.longest).toBe(4)
  })

  it('recomputes for new entries', () => {
    const a = progressFor(dex, save.entries, collection, TODAY)
    const more = makeSave([...entries, makeEntry(ID.ivysaur, 0, { date: '2026-01-10' })])
    const b = progressFor(dex, more.entries, computeCollection(dex, more), TODAY)
    expect(b.totals.caught).toBe(a.totals.caught + 1)
  })
})
