import { describe, expect, it } from 'vitest'
import type { CatchEntry } from '@shared/save-types'
import { fixtureDex as dex, ID, makeEntry } from '@renderer/lib/test-fixture'
import {
  NO_FILTERS, UNKNOWN_GAME, activeFilterCount, buildListing, computeFacets, countsLine, filterItems, gameGenLabel, idRange, indexEntries, rangeLabel, summarize,
  type JournalFilters, type JournalItem
} from './model'

const at = (iso: string): Pick<CatchEntry, 'createdAt' | 'updatedAt'> => ({ createdAt: iso, updatedAt: iso })

const entries: CatchEntry[] = [
  makeEntry(ID.pikachu, 0, { id: 'pika', game: 'yellow', ball: 4, date: '2025-03-10', nickname: 'Sparky', location: 'Viridian Forest', ot: 'Ethan', ...at('2025-03-11T10:00:00.000Z') }),
  makeEntry(ID.raichu, 1, { id: 'raichu', game: 'sun', ball: 2, date: '2025-03-02', kind: 'evolved', shiny: true, ...at('2025-04-01T10:00:00.000Z') }),
  makeEntry(ID.mewtwo, 0, { id: 'mewtwo', game: 'scarlet', ball: 1, date: '2026-01-20', kind: 'tera', notes: 'Seven star raid with friends', ...at('2026-01-20T10:00:00.000Z') }),
  makeEntry(ID.bulbasaur, 0, { id: 'bulba', game: 'go', kind: 'transfer', ...at('2026-02-03T10:00:00.000Z') }),
  makeEntry(ID.sprigatito, 0, { id: 'sprig', game: 'violet', ball: 4, date: '2026-01-05', kind: 'gift', shiny: true, ...at('2026-01-06T10:00:00.000Z') }),
  makeEntry(ID.eevee, 0, { id: 'odd', game: 'crystal-clear', ball: 999, date: '2024-12-31', ...at('2025-01-01T10:00:00.000Z') }),
  makeEntry(1400, 0, { id: 'ghost', game: 'scarlet', date: '2026-01-21', ...at('2026-01-22T10:00:00.000Z') })
]

const items = indexEntries(dex, entries)
const ids = (list: readonly JournalItem[]): string[] => list.map((i) => i.entry.id)
const filter = (patch: Partial<JournalFilters>): string[] => ids(filterItems(items, { ...NO_FILTERS, ...patch }))

describe('indexEntries', () => {
  it('resolves the game, its generation and system, and the Pokémon', () => {
    const pika = items[0]!
    expect(pika).toMatchObject({ name: 'Pikachu', day: '2025-03-10', gameKey: 'yellow', gameGen: 1, system: 'gb', speciesGen: 1 })
    expect(items[1]!.name).toBe('Alolan Raichu')
  })

  it('tolerates an unknown game, ball and Pokémon', () => {
    const odd = items.find((i) => i.entry.id === 'odd')!
    expect(odd).toMatchObject({ game: undefined, gameKey: UNKNOWN_GAME, gameGen: -1, system: undefined })
    const ghost = items.find((i) => i.entry.id === 'ghost')!
    expect(ghost).toMatchObject({ name: 'Pokémon #1400', speciesGen: 0 })
  })

  it('falls back to the day it was logged when there is no catch date', () => {
    const bulba = items.find((i) => i.entry.id === 'bulba')!
    expect(bulba.day).toBe(bulba.loggedDay)
    expect(bulba.day).toMatch(/^2026-02-0[34]$/)
  })
})

describe('filterItems', () => {
  it('passes everything without filters', () => {
    expect(filter({})).toHaveLength(entries.length)
    expect(activeFilterCount(NO_FILTERS)).toBe(0)
  })

  it('searches name, nickname, place, notes, OT and game, ignoring case and accents', () => {
    expect(filter({ text: 'sparky' })).toEqual(['pika'])
    expect(filter({ text: 'VIRIDIAN' })).toEqual(['pika'])
    expect(filter({ text: 'seven star' })).toEqual(['mewtwo'])
    expect(filter({ text: 'ethan' })).toEqual(['pika'])
    // Words match anywhere: "red" also finds "Transferred".
    expect(filter({ text: 'red' })).toEqual(['bulba'])
    expect(filter({ text: 'alolan' })).toEqual(['raichu'])
    expect(filter({ text: 'pokemon sun' })).toEqual(['raichu'])
    expect(filter({ text: 'raichu star' })).toEqual([])
    expect(filter({ text: '   ' })).toHaveLength(entries.length)
  })

  it('filters by game, including the unknown ones', () => {
    expect(filter({ games: ['scarlet', 'violet'] })).toEqual(['mewtwo', 'sprig', 'ghost'])
    expect(filter({ games: [UNKNOWN_GAME] })).toEqual(['odd'])
  })

  it('filters by the generation and the system of the game', () => {
    expect(filter({ gens: [9] })).toEqual(['mewtwo', 'sprig', 'ghost'])
    expect(filter({ gens: [0] })).toEqual(['bulba'])
    expect(filter({ gens: [1, 7] })).toEqual(['pika', 'raichu'])
    expect(filter({ systems: ['switch'] })).toEqual(['mewtwo', 'sprig', 'ghost'])
    expect(filter({ systems: ['mobile', 'gb'] })).toEqual(['pika', 'bulba'])
  })

  it('filters by ball, how it was obtained, and shiny', () => {
    expect(filter({ balls: [4] })).toEqual(['pika', 'sprig'])
    expect(filter({ balls: [999] })).toEqual(['odd'])
    expect(filter({ kinds: ['tera', 'gift'] })).toEqual(['mewtwo', 'sprig'])
    expect(filter({ shinyOnly: true })).toEqual(['raichu', 'sprig'])
  })

  it('filters by the day caught, both ends included, even when typed backwards', () => {
    expect(filter({ from: '2026-01-05', to: '2026-01-20' })).toEqual(['mewtwo', 'sprig'])
    expect(filter({ from: '2026-01-20', to: '2026-01-05' })).toEqual(['mewtwo', 'sprig'])
    expect(filter({ to: '2024-12-31' })).toEqual(['odd'])
    expect(filter({ from: '2026-01-21' })).toEqual(['bulba', 'ghost'])
    expect(filter({ from: 'yesterday' })).toHaveLength(entries.length)
  })

  it('combines filters', () => {
    expect(filter({ gens: [9], shinyOnly: true })).toEqual(['sprig'])
    expect(filter({ gens: [9], shinyOnly: true, text: 'mewtwo' })).toEqual([])
    expect(activeFilterCount({ ...NO_FILTERS, gens: [9, 8], shinyOnly: true, text: 'x', from: '2026-01-01', to: '2026-02-01' })).toBe(4)
  })
})

describe('facets and summary', () => {
  it('offers only what occurs, with counts, in canonical order', () => {
    const facets = computeFacets(items)
    expect(facets.games.map((g) => [g.value, g.count])).toEqual([['yellow', 1], ['sun', 1], ['scarlet', 2], ['violet', 1], ['go', 1], [UNKNOWN_GAME, 1]])
    expect(facets.gens.map((g) => g.value)).toEqual([1, 7, 9, 0])
    expect(facets.systems.map((s) => s.value)).toEqual(['gb', '3ds', 'switch', 'mobile'])
    expect(facets.balls.map((b) => b.label)).toEqual(['Poké Ball', 'Ultra Ball', 'Master Ball', 'Unknown ball'])
    expect(facets.kinds.map((k) => k.value)).toEqual(['wild', 'gift', 'tera', 'evolved', 'transfer'])
    expect(gameGenLabel(0)).toBe('Pokémon GO & HOME')
    expect(gameGenLabel(4)).toBe('Generation IV')
  })

  it('sums the Journal up', () => {
    const summary = summarize(items)
    expect(summary).toMatchObject({ entries: 7, pokemon: 7, shiny: 2, unknownGames: 1 })
    expect(summary.games.map((g) => g.game.id)).toEqual(['yellow', 'sun', 'scarlet', 'violet', 'go'])
    expect(summary.systems.map((s) => [s.system, s.count])).toEqual([['gb', 1], ['3ds', 1], ['switch', 3], ['mobile', 1]])
    expect(summarize([])).toMatchObject({ entries: 0, pokemon: 0, shiny: 0, games: [], systems: [] })
  })

  it('writes the live counts', () => {
    expect(countsLine(items)).toBe('7 entries · 2 shiny · 5 games')
    expect(countsLine(items.slice(0, 1))).toBe('1 entry · 0 shiny · 1 game')
    // An unknown game is not counted, as in the summary strip.
    expect(countsLine(items.filter((item) => item.gameKey === UNKNOWN_GAME))).toBe('1 entry · 0 shiny')
  })
})

describe('buildListing', () => {
  const entryIds = (listing: ReturnType<typeof buildListing>): string[] => listing.order
  const headers = (listing: ReturnType<typeof buildListing>): string[] => listing.groups.map((g) => g.label)

  it('groups by the month caught, newest first', () => {
    const listing = buildListing(items, 'caught', 'desc')
    expect(headers(listing)).toEqual(['February 2026', 'January 2026', 'March 2025', 'December 2024'])
    expect(entryIds(listing)).toEqual(['bulba', 'ghost', 'mewtwo', 'sprig', 'pika', 'raichu', 'odd'])
    expect(listing.rows[0]).toMatchObject({ kind: 'header' })
    expect(listing.groups[1]).toMatchObject({ count: 3, shiny: 1 })
    expect(listing.rows).toHaveLength(7 + 4)
  })

  it('reverses with the direction', () => {
    const listing = buildListing(items, 'caught', 'asc')
    expect(headers(listing)).toEqual(['December 2024', 'March 2025', 'January 2026', 'February 2026'])
    expect(entryIds(listing)).toEqual(['odd', 'raichu', 'pika', 'sprig', 'mewtwo', 'ghost', 'bulba'])
  })

  it('groups by the month logged', () => {
    const listing = buildListing(items, 'logged', 'desc')
    expect(entryIds(listing)).toEqual(['bulba', 'ghost', 'mewtwo', 'sprig', 'raichu', 'pika', 'odd'])
    expect(headers(listing)).toEqual(['February 2026', 'January 2026', 'April 2025', 'March 2025', 'January 2025'])
  })

  it('groups by generation in Pokédex order, unknown Pokémon in a group of their own', () => {
    const listing = buildListing(items, 'dex', 'asc')
    expect(entryIds(listing)).toEqual(['bulba', 'pika', 'raichu', 'odd', 'mewtwo', 'sprig', 'ghost'])
    expect(headers(listing)).toEqual(['Generation I', 'Generation IX', 'Unknown Pokémon'])
  })

  it('groups by game in release order, newest catch first inside each, unknown games last', () => {
    const listing = buildListing(items, 'game', 'asc')
    expect(headers(listing)).toEqual(['Pokémon Yellow', 'Pokémon Sun', 'Pokémon Scarlet', 'Pokémon Violet', 'Pokémon GO', 'Unknown game'])
    expect(entryIds(listing)).toEqual(['pika', 'raichu', 'ghost', 'mewtwo', 'sprig', 'bulba', 'odd'])
    expect(listing.groups.map((g) => g.gameKey)).toEqual(['yellow', 'sun', 'scarlet', 'violet', 'go', UNKNOWN_GAME])
    const reversed = buildListing(items, 'game', 'desc')
    expect(headers(reversed)[0]).toBe('Unknown game')
    expect(entryIds(reversed).slice(-1)).toEqual(['pika'])
  })

  it('knows the row of every entry', () => {
    const listing = buildListing(items, 'caught', 'desc')
    for (const id of listing.order) {
      const row = listing.rows[listing.rowOf.get(id) ?? -1]
      expect(row).toMatchObject({ kind: 'entry', key: id })
    }
    expect(buildListing([], 'caught', 'desc')).toMatchObject({ rows: [], groups: [], order: [] })
  })
})

describe('wording helpers', () => {
  it('describes a date range', () => {
    expect(rangeLabel('', '')).toBe('')
    expect(rangeLabel('2025-03-01', '')).toBe('From 1 Mar 2025')
    expect(rangeLabel('', '2026-10-09')).toBe('Until 9 Oct 2026')
    expect(rangeLabel('2025-03-01', '2026-10-09')).toBe('1 Mar 2025 – 9 Oct 2026')
    expect(rangeLabel('2026-10-09', '2025-03-01')).toBe('1 Mar 2025 – 9 Oct 2026')
    expect(rangeLabel('2026-10-09', '2026-10-09')).toBe('9 Oct 2026')
  })

  it('selects a range between two rows', () => {
    const order = ['a', 'b', 'c', 'd', 'e']
    expect(idRange(order, 'b', 'd')).toEqual(['b', 'c', 'd'])
    expect(idRange(order, 'd', 'b')).toEqual(['b', 'c', 'd'])
    expect(idRange(order, 'c', 'c')).toEqual(['c'])
    expect(idRange(order, 'gone', 'd')).toEqual(['d'])
    expect(idRange(order, 'b', 'gone')).toEqual([])
  })
})
