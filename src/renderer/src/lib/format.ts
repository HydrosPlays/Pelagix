/**
 * Small, pure text formatters shared by every feature.
 *
 * Numbers and dates are written for the active language (`activeLanguage()`, see i18n). English
 * keeps its own hand-written forms, which never depend on the system locale; every other
 * language goes through `Intl` with that language's tag.
 */

import { languageTag } from '@shared/languages'
import type { EntryGender, EntryKind } from '@shared/save-types'
import { activeLanguage, formatNumber, t, translate, type MessageKey } from '@renderer/i18n/runtime'
import { abilityName, methodLabel } from '@renderer/i18n/terms'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const pad2 = (n: number): string => String(n).padStart(2, '0')

/** The `Intl` tag to format with, or null for English, which has its own forms below. */
function intlTag(): string | null {
  const language = activeLanguage()
  return language === 'en' ? null : languageTag(language)
}

const dateFormats = new Map<string, Intl.DateTimeFormat>()

function dateFormat(tag: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${tag}|${JSON.stringify(options)}`
  let format = dateFormats.get(key)
  if (!format) dateFormats.set(key, (format = new Intl.DateTimeFormat(tag, options)))
  return format
}

// ---------------------------------------------------------------- numbers

/** National dex number as shown everywhere: `dexNo(25)` -> "#0025". */
export function dexNo(id: number): string {
  return `#${String(Math.max(0, Math.trunc(id))).padStart(4, '0')}`
}

/** Whole number with the language's digit grouping: 1234 -> "1,234" in English, "1.234" in German. */
export function formatCount(n: number): string {
  if (intlTag() !== null) return formatNumber(Math.round(n))
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** Fraction 0..1 of `part / total`; 0 when `total` is 0. */
export function ratio(part: number, total: number): number {
  return total > 0 ? Math.min(1, Math.max(0, part / total)) : 0
}

/**
 * `percent(3, 8)` -> "37.5%", `percent(8, 8)` -> "100%". Never rounds up to 100% or down to 0% unless
 * that is exact, so an almost-complete dex does not read as complete.
 */
export function percent(part: number, total: number, digits = 1): string {
  const r = ratio(part, total)
  if (r === 0) return '0%'
  if (r === 1) return '100%'
  const step = 10 ** -digits
  const value = Math.min(100 - step, Math.max(step, r * 100))
  const tag = intlTag()
  if (tag !== null) return new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: digits }).format(Number(value.toFixed(digits)) / 100)
  return `${Number(value.toFixed(digits))}%`
}

// ---------------------------------------------------------------- plurals

/**
 * English only: text for display takes a plural message instead (`t('…', { count })`, see i18n/README.md).
 * The right noun for a count: `pluralWord(1, 'entry', 'entries')` -> "entry". `many` defaults to `one + "s"`.
 */
export function pluralWord(n: number, one: string, many: string = `${one}s`): string {
  return n === 1 ? one : many
}

/** English only, like `pluralWord`. Count plus noun: `plural(2, 'entry', 'entries')` -> "2 entries", `plural(1, 'game')` -> "1 game". */
export function plural(n: number, one: string, many?: string): string {
  return `${formatCount(n)} ${pluralWord(n, one, many)}`
}

/** "A", "A and B", "A, B and C": a list the way the language joins one. */
export function listText(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  const tag = intlTag()
  if (tag !== null) return new Intl.ListFormat(tag, { style: 'long', type: 'conjunction' }).format(items)
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

// ---------------------------------------------------------------- dates

/** Local calendar day of a Date as ISO `yyyy-mm-dd`. */
export function toIsoDate(d: Date): string {
  return `${String(d.getFullYear()).padStart(4, '0')}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Today's local calendar day, `yyyy-mm-dd`. */
export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now)
}

/** True for a real calendar day written `yyyy-mm-dd` (rejects 2023-02-30). */
export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && parseIsoDate(value) !== null
}

/** Parses `yyyy-mm-dd` to local midnight; null when it is not a real calendar day. */
export function parseIsoDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const date = new Date(y, mo - 1, d)
  date.setFullYear(y) // years 0-99 would otherwise land in 1900-1999
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null
}

/** True for a string `Date` can parse that looks like an ISO timestamp (what `toISOString()` writes). */
export function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !Number.isNaN(Date.parse(value))
}

/** Accepts `yyyy-mm-dd` (local day) or a full ISO timestamp. */
function toDate(value: string | Date): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const day = parseIsoDate(value)
  if (day) return day
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : new Date(t)
}

export type DateStyle = 'short' | 'medium' | 'long'

/**
 * Unambiguous day-month-year text: "9 Oct 2026" (medium, default), "9 October 2026" (long),
 * "9 Oct" (short). Accepts a `yyyy-mm-dd` day or an ISO timestamp (shown in local time).
 * Returns "" for a missing or unparseable value. Other languages get the same three lengths in
 * their own order and month names ("2026年10月9日").
 */
export function formatDate(value: string | Date | null | undefined, style: DateStyle = 'medium'): string {
  if (value == null) return ''
  const d = toDate(value)
  if (!d) return ''
  const tag = intlTag()
  if (tag !== null) return dateFormat(tag, { day: 'numeric', month: style === 'long' ? 'long' : 'short', ...(style !== 'short' && { year: 'numeric' }) }).format(d)
  const month = MONTHS[d.getMonth()]!
  if (style === 'long') return `${d.getDate()} ${month} ${d.getFullYear()}`
  if (style === 'short') return `${d.getDate()} ${month.slice(0, 3)}`
  return `${d.getDate()} ${month.slice(0, 3)} ${d.getFullYear()}`
}

/** "9 Oct 2026, 14:05" for an ISO timestamp, in local time. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (value == null) return ''
  const d = toDate(value)
  if (!d) return ''
  const tag = intlTag()
  if (tag !== null) return dateFormat(tag, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
  return `${formatDate(d)}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** `yyyy-mm` -> "Oct 2026" (or "October 2026" with `long`). */
export function formatMonth(month: string, long = false): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  const name = m ? MONTHS[Number(m[2]) - 1] : undefined
  if (!m || !name) return ''
  const tag = intlTag()
  if (tag !== null) return dateFormat(tag, { month: long ? 'long' : 'short', year: 'numeric' }).format(new Date(Number(m[1]), Number(m[2]) - 1, 1))
  return `${long ? name : name.slice(0, 3)} ${Number(m[1])}`
}

/**
 * Relative time for activity feeds: "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago",
 * then the medium date. Future timestamps read as "just now".
 */
export function timeAgo(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (value == null) return ''
  const d = toDate(value)
  if (!d) return ''
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (seconds < 60) return t('lib.format.justNow')
  if (seconds < 3600) return t('lib.format.minutesAgo', { count: Math.floor(seconds / 60) })
  const days = dayDiff(toIsoDate(d), toIsoDate(now))
  if (days === 0 || seconds < 6 * 3600) return t('lib.format.hoursAgo', { count: Math.floor(seconds / 3600) })
  if (days === 1) return t('lib.format.yesterday')
  if (days < 30) return t('lib.format.daysAgo', { count: days })
  return formatDate(d)
}

/** Whole calendar days from `from` to `to` (both `yyyy-mm-dd`); NaN when either is invalid. */
export function dayDiff(from: string, to: string): number {
  const a = parseIsoDate(from)
  const b = parseIsoDate(to)
  if (!a || !b) return Number.NaN
  // UTC arithmetic so daylight-saving shifts never produce 0.96 or 1.04 days.
  const utc = (d: Date): number => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((utc(b) - utc(a)) / 86_400_000)
}

/** The calendar day `days` after `day` (negative for before), `yyyy-mm-dd`. */
export function addDays(day: string, days: number): string {
  const d = parseIsoDate(day)
  if (!d) return day
  d.setDate(d.getDate() + days)
  return toIsoDate(d)
}

// ---------------------------------------------------------------- encounter text

/** Level range of an encounter row: [5, 5] -> "Lv. 5", [3, 7] -> "Lv. 3–7", [0, 0] (unknown) -> "". */
export function levelRange(lv: readonly [number, number] | null | undefined): string {
  if (!lv) return ''
  const [min, max] = lv
  if (max <= 0 && min <= 0) return ''
  if (min <= 0) return t('lib.format.level', { level: String(max) })
  if (max <= min) return t('lib.format.level', { level: String(min) })
  return t('lib.format.levelRange', { min: String(min), max: String(max) })
}

/** Every `EntryKind`, in the order pickers should list them. */
export const ENTRY_KINDS: readonly EntryKind[] = ['wild', 'static', 'gift', 'egg', 'trade', 'raid', 'tera', 'outbreak', 'shadow', 'walker', 'dream', 'event', 'evolved', 'bred', 'transfer', 'other']

/** Display label of a way a Pokémon can be obtained or logged, in the active language. */
export function kindLabel(kind: EntryKind): string {
  return t(ENTRY_KINDS.includes(kind) ? (`lib.kind.${kind}` as MessageKey) : 'lib.kind.other')
}

/**
 * The English label of a kind, whatever the active language: what is written into an entry's
 * `method`, which the save keeps in English (show it with `methodLabel()`).
 */
export function englishKindLabel(kind: EntryKind): string {
  return translate('en', ENTRY_KINDS.includes(kind) ? (`lib.kind.${kind}` as MessageKey) : 'lib.kind.other')
}

let kindByEnglishLabel: Map<string, EntryKind> | null = null

/**
 * A stored method (`CatchEntry.method`, always English) in the active language. Most are the
 * datasets' labels, which `methodLabel()` knows; an imported entry that has since evolved carries
 * the English label of a kind instead ("Wild", "Gift"), which is worded like the kind. Anything
 * the user typed comes back as it is.
 */
export function shownMethod(english: string): string {
  kindByEnglishLabel ??= new Map(ENTRY_KINDS.map((kind) => [englishKindLabel(kind), kind]))
  const translated = methodLabel(english)
  if (translated !== english) return translated
  const kind = kindByEnglishLabel.get(english)
  return kind ? kindLabel(kind) : english
}

/** `kindLabel` as a table: every label is read when it is asked for, so it follows the language. */
export const KIND_LABELS: Readonly<Record<EntryKind, string>> = labelTable(ENTRY_KINDS, kindLabel)

/** "♂", "♀" or "" (genderless / unknown). */
export function genderSymbol(gender: EntryGender | null | undefined): string {
  return gender === 'm' ? '♂' : gender === 'f' ? '♀' : ''
}

/** "Male", "Female", "Genderless" or "" when unknown. */
export function genderLabel(gender: EntryGender | null | undefined): string {
  return gender === 'm' ? t('common.male') : gender === 'f' ? t('common.female') : gender === 'n' ? t('common.genderless') : ''
}

// ---------------------------------------------------------------- errors

const IPC_PREFIX = /^Error invoking remote method '[^']*': (?:[A-Za-z]*Error: )?/

/**
 * A message fit to show a user, from anything that was thrown. Strips the
 * "Error invoking remote method 'pelagix:…': Error: " wrapper Electron puts on IPC rejections.
 */
export function errorMessage(err: unknown, fallback = t('lib.error.generic')): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  const text = raw.replace(IPC_PREFIX, '').trim()
  return text === '' ? fallback : text
}

export interface EntryValueLine {
  /** Which line this is, whatever the language. */
  id: 'ability' | 'pid' | 'ivs' | 'evs'
  label: string
  text: string
  /** A short mark after the text ("Hidden"). */
  mark?: string
  /** What the line holds, spelled out. */
  title: string
}

/** An entry's ability, PID, IVs and EVs as short lines ("31 / 31 / 31 / 31 / 31 / 31"); only the ones it has. */
export function entryValues(entry: { ability?: number; abilityHidden?: boolean; pid?: string; ivs?: readonly number[]; evs?: readonly number[] }): EntryValueLine[] {
  const lines: EntryValueLine[] = []
  const ability = abilityName(entry.ability)
  if (ability !== undefined) {
    const hidden = entry.abilityHidden === true
    lines.push({
      id: 'ability',
      label: t('lib.values.ability'),
      text: ability,
      title: t(hidden ? 'lib.values.hiddenAbilityTitle' : 'lib.values.abilityTitle', { ability }),
      ...(hidden && { mark: t('lib.values.hidden') })
    })
  }
  if (entry.pid !== undefined) lines.push({ id: 'pid', label: t('lib.values.pid'), text: entry.pid, title: t('lib.values.pidTitle', { pid: entry.pid }) })
  if (entry.ivs !== undefined) lines.push({ id: 'ivs', label: t('lib.values.ivs'), text: entry.ivs.join(' / '), title: t('lib.values.ivsTitle') })
  if (entry.evs !== undefined) lines.push({ id: 'evs', label: t('lib.values.evs'), text: entry.evs.join(' / '), title: t('lib.values.evsTitle') })
  return lines
}

/**
 * A table of labels that words each one when it is read, so a top-level table follows the
 * language: `labelTable(['a', 'b'], (key) => t(...))`. `Object.keys` lists the keys in order.
 */
export function labelTable<K extends string>(keys: readonly K[], label: (key: K) => string): Readonly<Record<K, string>> {
  return Object.defineProperties({} as Record<K, string>, Object.fromEntries(keys.map((key) => [key, { enumerable: true, get: () => label(key) }])))
}
