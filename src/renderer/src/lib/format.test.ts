import { describe, expect, it, vi } from 'vitest'
import {
  addDays, dayDiff, dexNo, ENTRY_KINDS, errorMessage, formatCount, formatDate, formatDateTime, formatMonth, genderLabel, genderSymbol, isIsoDate,
  isIsoTimestamp, KIND_LABELS, kindLabel, levelRange, listText, parseIsoDate, percent, plural, pluralWord, ratio, timeAgo, todayIso, toIsoDate
} from './format'
import { newId } from './id'

describe('numbers', () => {
  it('dexNo pads to four digits', () => {
    expect(dexNo(25)).toBe('#0025')
    expect(dexNo(1)).toBe('#0001')
    expect(dexNo(1025)).toBe('#1025')
    expect(dexNo(10001)).toBe('#10001')
    expect(dexNo(0)).toBe('#0000')
    expect(dexNo(-3)).toBe('#0000')
  })

  it('formatCount groups thousands', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(999)).toBe('999')
    expect(formatCount(1234)).toBe('1,234')
    expect(formatCount(1234567)).toBe('1,234,567')
  })

  it('ratio is safe for an empty total', () => {
    expect(ratio(3, 4)).toBe(0.75)
    expect(ratio(0, 0)).toBe(0)
    expect(ratio(5, 4)).toBe(1)
  })

  it('percent never rounds to a false 0% or 100%', () => {
    expect(percent(0, 10)).toBe('0%')
    expect(percent(10, 10)).toBe('100%')
    expect(percent(3, 8)).toBe('37.5%')
    expect(percent(1, 3)).toBe('33.3%')
    expect(percent(1, 2)).toBe('50%')
    expect(percent(1024, 1025)).toBe('99.9%')
    expect(percent(1, 100000)).toBe('0.1%')
    expect(percent(1, 3, 0)).toBe('33%')
    expect(percent(199, 200, 0)).toBe('99%')
    expect(percent(0, 0)).toBe('0%')
  })
})

describe('plurals and lists', () => {
  it('picks the right noun', () => {
    expect(pluralWord(1, 'entry', 'entries')).toBe('entry')
    expect(pluralWord(0, 'entry', 'entries')).toBe('entries')
    expect(pluralWord(2, 'game')).toBe('games')
    expect(plural(1, 'game')).toBe('1 game')
    expect(plural(2, 'entry', 'entries')).toBe('2 entries')
    expect(plural(0, 'slot')).toBe('0 slots')
    expect(plural(1500, 'Pokémon', 'Pokémon')).toBe('1,500 Pokémon')
  })

  it('joins lists in prose', () => {
    expect(listText([])).toBe('')
    expect(listText(['Red'])).toBe('Red')
    expect(listText(['Red', 'Blue'])).toBe('Red and Blue')
    expect(listText(['Red', 'Blue', 'Yellow'])).toBe('Red, Blue and Yellow')
  })
})

describe('dates', () => {
  it('converts between Date and local ISO day', () => {
    expect(toIsoDate(new Date(2026, 9, 9, 23, 59))).toBe('2026-10-09')
    expect(toIsoDate(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01')
    expect(todayIso(new Date(1999, 10, 21))).toBe('1999-11-21')
    const parsed = parseIsoDate('2026-10-09')!
    expect([parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), parsed.getHours()]).toEqual([2026, 9, 9, 0])
  })

  it('accepts only real calendar days', () => {
    expect(isIsoDate('2024-02-29')).toBe(true)
    expect(isIsoDate('2023-02-29')).toBe(false)
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('2026-00-10')).toBe(false)
    expect(isIsoDate('2026-1-5')).toBe(false)
    expect(isIsoDate('2026-10-09T00:00:00Z')).toBe(false)
    expect(isIsoDate(20261009)).toBe(false)
    expect(isIsoDate(null)).toBe(false)
    expect(parseIsoDate('nope')).toBeNull()
  })

  it('recognises ISO timestamps', () => {
    expect(isIsoTimestamp('2026-10-09T12:00:00.000Z')).toBe(true)
    expect(isIsoTimestamp(new Date().toISOString())).toBe(true)
    expect(isIsoTimestamp('2026-10-09T12:00:00+02:00')).toBe(true)
    expect(isIsoTimestamp('2026-10-09')).toBe(false)
    expect(isIsoTimestamp('2026-13-45T99:99:99Z')).toBe(false)
    expect(isIsoTimestamp('yesterday')).toBe(false)
    expect(isIsoTimestamp(1700000000000)).toBe(false)
  })

  it('formats days without locale ambiguity', () => {
    expect(formatDate('2026-10-09')).toBe('9 Oct 2026')
    expect(formatDate('2026-10-09', 'long')).toBe('9 October 2026')
    expect(formatDate('2026-10-09', 'short')).toBe('9 Oct')
    expect(formatDate('1996-02-27')).toBe('27 Feb 1996')
    expect(formatDate(new Date(2026, 4, 1))).toBe('1 May 2026')
    expect(formatDate(new Date(2026, 4, 1, 15, 30).toISOString())).toBe('1 May 2026')
  })

  it('returns an empty string for missing or invalid dates', () => {
    expect(formatDate(undefined)).toBe('')
    expect(formatDate(null)).toBe('')
    expect(formatDate('')).toBe('')
    expect(formatDate('soon')).toBe('')
    expect(formatDate(new Date(Number.NaN))).toBe('')
    expect(formatDateTime('nope')).toBe('')
    expect(formatMonth('2026-13')).toBe('')
    expect(timeAgo(undefined)).toBe('')
  })

  it('formats timestamps and months', () => {
    expect(formatDateTime(new Date(2026, 9, 9, 14, 5))).toBe('9 Oct 2026, 14:05')
    expect(formatDateTime(new Date(2026, 0, 3, 9, 0).toISOString())).toBe('3 Jan 2026, 09:00')
    expect(formatMonth('2026-10')).toBe('Oct 2026')
    expect(formatMonth('2026-01', true)).toBe('January 2026')
  })

  it('does calendar-day arithmetic across month, year and DST boundaries', () => {
    expect(dayDiff('2026-01-01', '2026-01-02')).toBe(1)
    expect(dayDiff('2026-01-02', '2026-01-01')).toBe(-1)
    expect(dayDiff('2025-12-31', '2026-01-01')).toBe(1)
    expect(dayDiff('2026-03-28', '2026-03-30')).toBe(2) // European DST change
    expect(dayDiff('2026-10-24', '2026-10-26')).toBe(2)
    expect(dayDiff('2024-02-28', '2024-03-01')).toBe(2)
    expect(dayDiff('2026-01-01', '2026-01-01')).toBe(0)
    expect(Number.isNaN(dayDiff('x', '2026-01-01'))).toBe(true)
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2024-02-28', 2)).toBe('2024-03-01')
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('bad', 1)).toBe('bad')
  })

  it('describes how long ago something happened', () => {
    const now = new Date(2026, 9, 9, 15, 0, 0)
    const ago = (ms: number) => new Date(now.getTime() - ms)
    const MIN = 60_000
    const HOUR = 60 * MIN
    expect(timeAgo(ago(5_000), now)).toBe('just now')
    expect(timeAgo(ago(-60_000), now)).toBe('just now') // clock skew
    expect(timeAgo(ago(5 * MIN), now)).toBe('5 min ago')
    expect(timeAgo(ago(59 * MIN), now)).toBe('59 min ago')
    expect(timeAgo(ago(3 * HOUR), now)).toBe('3 h ago')
    expect(timeAgo(ago(14 * HOUR), now)).toBe('14 h ago') // 01:00 the same day
    expect(timeAgo(ago(17 * HOUR), now)).toBe('yesterday') // 22:00 the day before
    expect(timeAgo(new Date(2026, 9, 9, 1, 0), new Date(2026, 9, 9, 3, 0))).toBe('2 h ago')
    expect(timeAgo(new Date(2026, 9, 8, 23, 0), new Date(2026, 9, 9, 1, 0))).toBe('2 h ago') // across midnight, still recent
    expect(timeAgo(ago(4 * 24 * HOUR), now)).toBe('4 days ago')
    expect(timeAgo(ago(29 * 24 * HOUR), now)).toBe('29 days ago')
    expect(timeAgo(ago(40 * 24 * HOUR), now)).toBe('30 Aug 2026')
    expect(timeAgo('2026-10-08', now)).toBe('yesterday')
    expect(timeAgo(ago(3 * HOUR).toISOString(), now)).toBe('3 h ago')
  })
})

describe('encounter text', () => {
  it('formats level ranges', () => {
    expect(levelRange([5, 5])).toBe('Lv. 5')
    expect(levelRange([3, 7])).toBe('Lv. 3–7')
    expect(levelRange([0, 0])).toBe('')
    expect(levelRange([0, 12])).toBe('Lv. 12')
    expect(levelRange([70, 0])).toBe('Lv. 70')
    expect(levelRange(undefined)).toBe('')
    expect(levelRange(null)).toBe('')
  })

  it('labels every entry kind', () => {
    expect(ENTRY_KINDS).toHaveLength(16)
    expect(new Set(ENTRY_KINDS).size).toBe(16)
    for (const kind of ENTRY_KINDS) expect(KIND_LABELS[kind]).toMatch(/\S/)
    expect(kindLabel('wild')).toBe('Wild')
    expect(kindLabel('tera')).toBe('Tera Raid')
    expect(kindLabel('transfer')).toBe('Transferred')
    expect(kindLabel('bogus' as never)).toBe('Other')
  })

  it('shows gender as a symbol or a word', () => {
    expect([genderSymbol('m'), genderSymbol('f'), genderSymbol('n'), genderSymbol(undefined)]).toEqual(['♂', '♀', '', ''])
    expect([genderLabel('m'), genderLabel('f'), genderLabel('n'), genderLabel(null)]).toEqual(['Male', 'Female', 'Genderless', ''])
  })
})

describe('errorMessage', () => {
  it('strips the Electron IPC wrapper', () => {
    expect(errorMessage(new Error("Error invoking remote method 'pelagix:save-import': Error: The file is larger than 50 MB."))).toBe('The file is larger than 50 MB.')
    expect(errorMessage(new Error("Error invoking remote method 'pelagix:save-write': TypeError: bad save"))).toBe('bad save')
    expect(errorMessage(new Error("Error invoking remote method 'pelagix:save-load': EACCES"))).toBe('EACCES')
  })

  it('handles anything that can be thrown', () => {
    expect(errorMessage(new Error('plain'))).toBe('plain')
    expect(errorMessage('a string')).toBe('a string')
    expect(errorMessage(undefined)).toBe('Something went wrong.')
    expect(errorMessage({ code: 1 })).toBe('Something went wrong.')
    expect(errorMessage(new Error(''), 'fallback')).toBe('fallback')
  })
})

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  it('returns distinct version 4 UUIDs', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newId()))
    expect(ids.size).toBe(500)
    for (const id of ids) expect(id).toMatch(UUID_V4)
  })

  it('still works where crypto.randomUUID is unavailable', () => {
    const real = globalThis.crypto
    try {
      vi.stubGlobal('crypto', { getRandomValues: <T extends Uint8Array<ArrayBuffer>>(b: T): T => real.getRandomValues(b) })
      const a = newId()
      expect(a).toMatch(UUID_V4)
      expect(newId()).not.toBe(a)
      vi.stubGlobal('crypto', undefined)
      expect(newId()).toMatch(UUID_V4)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
