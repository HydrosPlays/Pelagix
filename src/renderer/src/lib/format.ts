/** Small, pure text formatters shared by every feature. English UI, locale-independent output. */

import { abilityName } from '@shared/abilities'
import type { EntryGender, EntryKind } from '@shared/save-types'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const pad2 = (n: number): string => String(n).padStart(2, '0')

// ---------------------------------------------------------------- numbers

/** National dex number as shown everywhere: `dexNo(25)` -> "#0025". */
export function dexNo(id: number): string {
  return `#${String(Math.max(0, Math.trunc(id))).padStart(4, '0')}`
}

/** Thousands-separated integer: 1234 -> "1,234". */
export function formatCount(n: number): string {
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
  return `${Number(value.toFixed(digits))}%`
}

// ---------------------------------------------------------------- plurals

/** The right noun for a count: `pluralWord(1, 'entry', 'entries')` -> "entry". `many` defaults to `one + "s"`. */
export function pluralWord(n: number, one: string, many: string = `${one}s`): string {
  return n === 1 ? one : many
}

/** Count plus noun: `plural(2, 'entry', 'entries')` -> "2 entries", `plural(1, 'game')` -> "1 game". */
export function plural(n: number, one: string, many?: string): string {
  return `${formatCount(n)} ${pluralWord(n, one, many)}`
}

/** "A", "A and B", "A, B and C". */
export function listText(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
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
 * Returns "" for a missing or unparseable value.
 */
export function formatDate(value: string | Date | null | undefined, style: DateStyle = 'medium'): string {
  if (value == null) return ''
  const d = toDate(value)
  if (!d) return ''
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
  return `${formatDate(d)}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** `yyyy-mm` -> "Oct 2026" (or "October 2026" with `long`). */
export function formatMonth(month: string, long = false): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  const name = m ? MONTHS[Number(m[2]) - 1] : undefined
  if (!m || !name) return ''
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
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  const days = dayDiff(toIsoDate(d), toIsoDate(now))
  if (days === 0 || seconds < 6 * 3600) return `${Math.floor(seconds / 3600)} h ago`
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
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
  if (min <= 0) return `Lv. ${max}`
  if (max <= min) return `Lv. ${min}`
  return `Lv. ${min}–${max}`
}

/** Display label of each way a Pokémon can be obtained or logged. */
export const KIND_LABELS: Readonly<Record<EntryKind, string>> = {
  wild: 'Wild',
  static: 'Static encounter',
  gift: 'Gift',
  egg: 'Gift Egg',
  trade: 'In-game trade',
  raid: 'Max Raid',
  tera: 'Tera Raid',
  outbreak: 'Mass Outbreak',
  shadow: 'Shadow Pokémon',
  walker: 'Pokéwalker',
  dream: 'Dream World',
  event: 'Event',
  evolved: 'Evolved',
  bred: 'Bred',
  transfer: 'Transferred',
  other: 'Other'
}

/** Every `EntryKind`, in the order pickers should list them. */
export const ENTRY_KINDS = Object.keys(KIND_LABELS) as readonly EntryKind[]

export function kindLabel(kind: EntryKind): string {
  return KIND_LABELS[kind] ?? KIND_LABELS.other
}

/** "♂", "♀" or "" (genderless / unknown). */
export function genderSymbol(gender: EntryGender | null | undefined): string {
  return gender === 'm' ? '♂' : gender === 'f' ? '♀' : ''
}

/** "Male", "Female", "Genderless" or "" when unknown. */
export function genderLabel(gender: EntryGender | null | undefined): string {
  return gender === 'm' ? 'Male' : gender === 'f' ? 'Female' : gender === 'n' ? 'Genderless' : ''
}

// ---------------------------------------------------------------- errors

const IPC_PREFIX = /^Error invoking remote method '[^']*': (?:[A-Za-z]*Error: )?/

/**
 * A message fit to show a user, from anything that was thrown. Strips the
 * "Error invoking remote method 'pelagix:…': Error: " wrapper Electron puts on IPC rejections.
 */
export function errorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  const text = raw.replace(IPC_PREFIX, '').trim()
  return text === '' ? fallback : text
}

export interface EntryValueLine {
  label: 'Ability' | 'PID' | 'IVs' | 'EVs'
  text: string
  /** A short mark after the text ("Hidden"). */
  mark?: string
  /** What the line holds, spelled out. */
  title: string
}

const STAT_ORDER = 'HP / Attack / Defense / Sp. Atk / Sp. Def / Speed'

/** An entry's ability, PID, IVs and EVs as short lines ("31 / 31 / 31 / 31 / 31 / 31"); only the ones it has. */
export function entryValues(entry: { ability?: number; abilityHidden?: boolean; pid?: string; ivs?: readonly number[]; evs?: readonly number[] }): EntryValueLine[] {
  const lines: EntryValueLine[] = []
  const ability = abilityName(entry.ability)
  if (ability !== undefined) {
    const hidden = entry.abilityHidden === true
    lines.push({ label: 'Ability', text: ability, title: hidden ? `Hidden Ability: ${ability}` : `Ability: ${ability}`, ...(hidden && { mark: 'Hidden' }) })
  }
  if (entry.pid !== undefined) lines.push({ label: 'PID', text: entry.pid, title: `PID ${entry.pid}` })
  if (entry.ivs !== undefined) lines.push({ label: 'IVs', text: entry.ivs.join(' / '), title: `IVs: ${STAT_ORDER}` })
  if (entry.evs !== undefined) lines.push({ label: 'EVs', text: entry.evs.join(' / '), title: `EVs: ${STAT_ORDER}` })
  return lines
}
