/**
 * Save file validation and persistence.
 *
 * - `parseSave` / `parseSaveReport` turn anything (a file from disk, an import, localStorage) into
 *   a valid `SaveFile`, never throwing: bad entries are dropped, bad optional fields discarded,
 *   missing settings filled with defaults, old versions migrated.
 * - `saveBackend` reads and writes the save through `window.api` in Electron and through
 *   localStorage in a browser.
 * - `exportSaveToFile` / `importSaveFromFile` wrap the native dialogs or their browser stand-ins.
 */

import { ABILITY_BY_ID } from '@shared/abilities'
import type { ExportResult, PelagixApi } from '@shared/api'
import { BALL_BY_ID } from '@shared/balls'
import {
  createEmptySave, DEFAULT_RULES, DEFAULT_SETTINGS, MAX_EV, MAX_IV, PID_PATTERN, SAVE_VERSION,
  type AppSettings, type CatchEntry, type DexRules, type EntryGender, type EntryKind, type SaveFile, type StatSpread
} from '@shared/save-types'
import { isIsoDate, isIsoTimestamp, toIsoDate } from './format'
import { newId } from './id'

// ---------------------------------------------------------------- limits

const MAX_SPECIES_ID = 20_000
const MAX_FORM = 255
const MAX_LEVEL = 100
const TEXT_LIMITS = { method: 120, location: 160, nickname: 40, ot: 40, notes: 4000 } as const
const TRAINER_NAME_LIMIT = 40
const ID_LIMIT = 80
const FINGERPRINT_LIMIT = 160
const GAME_ID = /^[a-z0-9][a-z0-9-]{0,39}$/

const ENTRY_KIND_SET: ReadonlySet<string> = new Set<EntryKind>([
  'wild', 'static', 'gift', 'egg', 'trade', 'raid', 'tera', 'outbreak', 'shadow', 'walker', 'dream', 'event',
  'evolved', 'bred', 'transfer', 'other'
])
const RULE_KEYS = Object.keys(DEFAULT_RULES) as Array<keyof DexRules>

type Dict = Record<string, unknown>
/**
 * A valid ISO timestamp in canonical UTC form (what `toISOString()` writes), else null. Stored
 * timestamps are always canonical, so they can be ordered by plain string comparison.
 */
const timestamp = (v: unknown): string | null => (isIsoTimestamp(v) ? new Date(v).toISOString() : null)
const isObject = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v)
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

// ---------------------------------------------------------------- entries

export interface EntryCheck {
  /** The cleaned entry, or null when a required field (species, form, game) is unusable. */
  entry: CatchEntry | null
  /** An optional field was invalid and has been discarded, shortened or replaced by a default. */
  repaired: boolean
  /** Why the entry was rejected. */
  reason?: string
}

/**
 * Validates one entry field by field and returns a clean copy holding only known, valid fields.
 * `now` is the ISO timestamp used when `createdAt` is missing or invalid.
 */
export function checkEntry(raw: unknown, now: string): EntryCheck {
  const reject = (reason: string): EntryCheck => ({ entry: null, repaired: false, reason })
  if (!isObject(raw)) return reject('not an object')
  const { species, game } = raw
  if (!isInt(species, 1, MAX_SPECIES_ID)) return reject('invalid species')
  if (raw.form !== undefined && !isInt(raw.form, 0, MAX_FORM)) return reject('invalid form')
  if (typeof game !== 'string' || !GAME_ID.test(game)) return reject('invalid game')

  let repaired = false
  /** Reads an optional field: absent stays absent, an invalid value is discarded and counted as a repair. */
  const optional = <T>(key: string, accept: (v: unknown) => T | undefined): T | undefined => {
    const v = raw[key]
    if (v === undefined || v === null) return undefined
    const out = accept(v)
    if (out === undefined) repaired = true
    return out
  }
  /** Trimmed text; blank counts as absent, over-long text is cut. */
  const text = (key: keyof typeof TEXT_LIMITS): string | undefined => {
    const v = raw[key]
    if (v === undefined || v === null) return undefined
    if (typeof v !== 'string') {
      repaired = true
      return undefined
    }
    const trimmed = v.trim()
    if (trimmed.length > TEXT_LIMITS[key]) repaired = true
    return trimmed === '' ? undefined : trimmed.slice(0, TEXT_LIMITS[key])
  }
  const flag = (key: string): boolean => {
    const v = raw[key]
    if (v !== undefined && v !== null && typeof v !== 'boolean') repaired = true
    return v === true
  }

  let id = typeof raw.id === 'string' ? raw.id.trim() : ''
  if (id === '' || id.length > ID_LIMIT) {
    id = newId()
    repaired = true
  }

  const form = isInt(raw.form, 0, MAX_FORM) ? raw.form : 0
  if (raw.form === undefined) repaired = true

  let kind: EntryKind = 'other'
  if (typeof raw.kind === 'string' && ENTRY_KIND_SET.has(raw.kind)) kind = raw.kind as EntryKind
  else repaired = true

  const created = timestamp(raw.createdAt)
  if (created === null) repaired = true
  const createdAt = created ?? now
  const updatedAt = timestamp(raw.updatedAt) ?? createdAt

  const variant = optional('variant', (v) => (isInt(v, 0, MAX_FORM) ? v : undefined))
  const gender = optional('gender', (v) => (v === 'm' || v === 'f' || v === 'n' ? (v as EntryGender) : undefined))
  const shiny = flag('shiny')
  const gmax = flag('gmax')
  const alpha = flag('alpha')
  const method = text('method')
  const location = text('location')
  const origin = optional('origin', (v): [number, number] | undefined =>
    Array.isArray(v) && v.length === 2 && isInt(v[0], 1, MAX_SPECIES_ID) && isInt(v[1], 0, MAX_FORM) ? [v[0], v[1]] : undefined
  )
  const ball = optional('ball', (v) => (typeof v === 'number' && BALL_BY_ID.has(v) ? v : undefined))
  const level = optional('level', (v) => (isInt(v, 1, MAX_LEVEL) ? v : undefined))
  const date = optional('date', (v) => {
    if (isIsoDate(v)) return v
    // A full timestamp where a day was expected: keep the local day it falls on.
    return isIsoTimestamp(v) ? toIsoDate(new Date(v)) : undefined
  })
  const nickname = text('nickname')
  const ot = text('ot')
  const notes = text('notes')
  const ability = optional('ability', (v) => (typeof v === 'number' && ABILITY_BY_ID.has(v) ? v : undefined))
  // Says something about the ability, so it goes when there is none.
  const abilityHidden = optional('abilityHidden', (v) => (v === true && ability !== undefined ? true : undefined))
  const pid = optional('pid', (v) => (typeof v === 'string' && PID_PATTERN.test(v) ? v : undefined))
  const spread = (key: 'ivs' | 'evs', max: number): StatSpread | undefined =>
    optional(key, (v) => (Array.isArray(v) && v.length === 6 && v.every((n) => isInt(n, 0, max)) ? (v.slice() as StatSpread) : undefined))
  const ivs = spread('ivs', MAX_IV)
  const evs = spread('evs', MAX_EV)
  // Compared, never shown: kept exactly as written or not at all.
  const fingerprint = optional('fingerprint', (v) => (typeof v === 'string' && v !== '' && v.length <= FINGERPRINT_LIMIT ? v : undefined))

  const inHome = flag('inHome')

  // Keys in the order of the interface so saved files diff cleanly; absent fields are omitted, not undefined.
  const entry: CatchEntry = {
    id,
    species,
    form,
    ...(variant !== undefined && { variant }),
    ...(gender !== undefined && { gender }),
    shiny,
    ...(gmax && { gmax }),
    ...(alpha && { alpha }),
    game,
    kind,
    ...(method !== undefined && { method }),
    ...(location !== undefined && { location }),
    ...(origin !== undefined && { origin }),
    ...(ball !== undefined && { ball }),
    ...(level !== undefined && { level }),
    ...(date !== undefined && { date }),
    ...(nickname !== undefined && { nickname }),
    ...(ot !== undefined && { ot }),
    ...(notes !== undefined && { notes }),
    ...(ability !== undefined && { ability }),
    ...(abilityHidden !== undefined && { abilityHidden }),
    ...(pid !== undefined && { pid }),
    ...(ivs !== undefined && { ivs }),
    ...(evs !== undefined && { evs }),
    ...(fingerprint !== undefined && { fingerprint }),
    ...(inHome && { inHome: true as const }),
    createdAt,
    updatedAt
  }
  return { entry, repaired }
}

/** `checkEntry` without the bookkeeping: the cleaned entry, or null when it cannot be used. */
export function sanitizeEntry(raw: unknown, now: string = new Date().toISOString()): CatchEntry | null {
  return checkEntry(raw, now).entry
}

// ---------------------------------------------------------------- settings

/**
 * Rules with every missing or non-boolean flag replaced by its default. `heldItem` was split off
 * `changeable` after the first saves were written: where it is missing it takes the value the save
 * has for `changeable`, so a Living Dex keeps its size when such a save is read.
 */
export function sanitizeRules(raw: unknown): DexRules {
  const rules: DexRules = { ...DEFAULT_RULES }
  if (isObject(raw)) {
    for (const key of RULE_KEYS) {
      const v = raw[key]
      if (typeof v === 'boolean') rules[key] = v
    }
    if (typeof raw.heldItem !== 'boolean') rules.heldItem = rules.changeable
  }
  return rules
}

/** Settings with every missing or invalid value replaced by its default. */
export function sanitizeSettings(raw: unknown): AppSettings {
  const src = isObject(raw) ? raw : {}
  return {
    rules: sanitizeRules(src.rules),
    theme: src.theme === 'light' || src.theme === 'dark' ? src.theme : DEFAULT_SETTINGS.theme,
    reduceMotion: typeof src.reduceMotion === 'boolean' ? src.reduceMotion : DEFAULT_SETTINGS.reduceMotion,
    trainerName: typeof src.trainerName === 'string' ? src.trainerName.trim().slice(0, TRAINER_NAME_LIMIT) : DEFAULT_SETTINGS.trainerName
  }
}

// ---------------------------------------------------------------- migrations

/**
 * MIGRATIONS[n] upgrades the raw JSON of a version-n save to version n + 1. They run in sequence
 * until `SAVE_VERSION`, before validation, so they may assume nothing about field validity.
 *
 * Version 0 is "no version field": hand-written or pre-release files. It may keep `rules` at the
 * top level and list achievements as a plain array of ids.
 */
const MIGRATIONS: Readonly<Record<number, (raw: Dict, now: string) => Dict>> = {
  0: (raw, now) => {
    const out: Dict = { ...raw }
    if (isObject(raw.rules)) {
      const settings = isObject(raw.settings) ? raw.settings : {}
      if (!isObject(settings.rules)) out.settings = { ...settings, rules: raw.rules }
      delete out.rules
    }
    if (Array.isArray(raw.achievements)) {
      const stamp = timestamp(raw.updatedAt) ?? now
      out.achievements = Object.fromEntries(raw.achievements.filter((id): id is string => typeof id === 'string').map((id) => [id, stamp]))
    }
    return out
  }
}

// ---------------------------------------------------------------- parse

export interface SaveParseReport {
  /** Always a valid save. A fresh empty one when the input was not recognised. */
  save: SaveFile
  /**
   * The input looked like a Pelagix save (an object with an `entries` list or Pelagix settings, or
   * a bare list of entries). False for null, garbage and unrelated JSON.
   */
  recognized: boolean
  /** Entries found in the input. */
  total: number
  /** Entries left out: a required field was missing or invalid, or the id repeated an earlier entry. */
  dropped: number
  /** Entries kept after discarding or defaulting an invalid optional field. */
  repaired: number
  /** `version` of the input; null when it had none. */
  fromVersion: number | null
  /** Written by a newer Pelagix than this one: data this version does not know has been discarded. */
  newer: boolean
  /** Human-readable notes about everything that was dropped, repaired or migrated. */
  warnings: string[]
}

/** Validates and repairs anything into a `SaveFile` and reports what had to be done. Never throws. */
export function parseSaveReport(raw: unknown, now: string = new Date().toISOString()): SaveParseReport {
  const warnings: string[] = []
  let source: Dict | null = null
  if (Array.isArray(raw)) {
    if (raw.some((e) => isObject(e) && 'species' in e)) source = { entries: raw }
  } else if (isObject(raw)) {
    const settings = raw.settings
    if (Array.isArray(raw.entries) || (isObject(settings) && (isObject(settings.rules) || 'theme' in settings))) source = raw
  }
  if (!source) {
    return { save: createEmptySave(now), recognized: false, total: 0, dropped: 0, repaired: 0, fromVersion: null, newer: false, warnings }
  }

  const fromVersion = isInt(source.version, 0, Number.MAX_SAFE_INTEGER) ? source.version : null
  const newer = fromVersion !== null && fromVersion > SAVE_VERSION
  if (newer) {
    warnings.push(`This save was written by a newer version of Pelagix (format ${fromVersion}); anything this version does not understand was left out.`)
  } else {
    for (let v = fromVersion ?? 0; v < SAVE_VERSION; v++) {
      const migrate = MIGRATIONS[v]
      if (migrate) source = migrate(source, now)
    }
    if ((fromVersion ?? 0) < SAVE_VERSION) warnings.push(`Save upgraded from format ${fromVersion ?? 0} to ${SAVE_VERSION}.`)
  }

  const createdAt = timestamp(source.createdAt) ?? now
  const updatedAt = timestamp(source.updatedAt) ?? createdAt

  const rawEntries: unknown[] = Array.isArray(source.entries) ? source.entries : []
  const entries: CatchEntry[] = []
  const ids = new Set<string>()
  let dropped = 0
  let repaired = 0
  for (const item of rawEntries) {
    const check = checkEntry(item, createdAt)
    if (!check.entry || ids.has(check.entry.id)) {
      dropped++
      continue
    }
    ids.add(check.entry.id)
    entries.push(check.entry)
    if (check.repaired) repaired++
  }
  if (dropped > 0) warnings.push(`${dropped} invalid or duplicate ${dropped === 1 ? 'entry was' : 'entries were'} skipped.`)
  if (repaired > 0) warnings.push(`${repaired} ${repaired === 1 ? 'entry' : 'entries'} had invalid details removed.`)

  const achievements: Record<string, string> = {}
  if (isObject(source.achievements)) {
    for (const [id, when] of Object.entries(source.achievements)) {
      if (id === '' || id.length > ID_LIMIT) continue
      achievements[id] = timestamp(when) ?? updatedAt
    }
  }

  const save: SaveFile = { version: SAVE_VERSION, entries, settings: sanitizeSettings(source.settings), achievements, createdAt, updatedAt }
  return { save, recognized: true, total: rawEntries.length, dropped, repaired, fromVersion, newer, warnings }
}

/**
 * Tolerant parse: always returns a valid `SaveFile` (an empty one for null or garbage). Use
 * `parseSaveReport` when it matters whether the input was a save at all or how much was dropped.
 */
export function parseSave(raw: unknown, now?: string): SaveFile {
  return parseSaveReport(raw, now).save
}

// ---------------------------------------------------------------- backends

export const SAVE_STORAGE_KEY = 'pelagix.save.v1'

export interface SaveBackend {
  readonly kind: 'electron' | 'browser' | 'memory'
  /** Raw stored JSON (to be passed through `parseSave`), or null when nothing is stored yet. */
  load(): Promise<unknown | null>
  /**
   * Persists the save. The write is *started* synchronously, so calling it from `beforeunload` /
   * `pagehide` still gets the data out; the promise reports the outcome.
   */
  write(save: SaveFile): Promise<void>
}

/** Electron: the main process owns save.json (atomic writes, backups, corrupt-file recovery). */
export function createApiBackend(api: Pick<PelagixApi, 'loadSave' | 'writeSave'>): SaveBackend {
  return { kind: 'electron', load: () => api.loadSave(), write: (save) => api.writeSave(save) }
}

/** Browser: one localStorage item. An unreadable item is moved to `<key>.corrupt` rather than overwritten. */
export function createStorageBackend(storage: Pick<Storage, 'getItem' | 'setItem'>, key: string = SAVE_STORAGE_KEY): SaveBackend {
  return {
    kind: 'browser',
    load() {
      try {
        const text = storage.getItem(key)
        if (text === null) return Promise.resolve(null)
        try {
          return Promise.resolve(JSON.parse(text) as unknown)
        } catch {
          storage.setItem(`${key}.corrupt`, text)
          console.warn(`[save] ${key} is not valid JSON; kept a copy under ${key}.corrupt and starting fresh.`)
          return Promise.resolve(null)
        }
      } catch (err) {
        return Promise.reject(new Error(`Could not read the save from browser storage: ${err instanceof Error ? err.message : String(err)}`))
      }
    },
    write(save) {
      try {
        storage.setItem(key, JSON.stringify(save))
        return Promise.resolve()
      } catch (err) {
        const quota = err instanceof Error && /quota/i.test(`${err.name} ${err.message}`)
        return Promise.reject(new Error(quota ? 'Browser storage is full; the save could not be written.' : `Could not write the save to browser storage: ${err instanceof Error ? err.message : String(err)}`))
      }
    }
  }
}

/** Keeps the save in memory only. For tests and for environments with neither Electron nor localStorage. */
export function createMemoryBackend(initial: unknown | null = null): SaveBackend & { current(): unknown | null } {
  let stored = initial
  return {
    kind: 'memory',
    load: () => Promise.resolve(stored === null ? null : structuredClone(stored)),
    write(save) {
      stored = structuredClone(save)
      return Promise.resolve()
    },
    current: () => stored
  }
}

function resolveBackend(): SaveBackend {
  if (typeof window !== 'undefined' && window.api) return createApiBackend(window.api)
  try {
    if (typeof localStorage !== 'undefined') return createStorageBackend(localStorage)
  } catch {
    // Storage blocked by the browser: fall through to memory.
  }
  return createMemoryBackend()
}

let resolved: SaveBackend | null = null
const backend = (): SaveBackend => (resolved ??= resolveBackend())

/** The backend for this environment: `window.api` in Electron, else localStorage (`pelagix.save.v1`). Resolved on first use. */
export const saveBackend: SaveBackend = {
  get kind() {
    return backend().kind
  },
  load: () => backend().load(),
  write: (save) => backend().write(save)
}

// ---------------------------------------------------------------- export / import

const MAX_IMPORT_BYTES = 50 * 1024 * 1024

/** Default export file name, matching the main process: pelagix-save-YYYY-MM-DD.json. */
export function exportFileName(now: Date = new Date()): string {
  return `pelagix-save-${toIsoDate(now)}.json`
}

/**
 * Lets the user save a copy of their save: the native Save dialog in Electron, a file download in
 * a browser (which cannot report cancellation, so `canceled` is always false there).
 */
export async function exportSaveToFile(save: SaveFile): Promise<ExportResult> {
  if (typeof window !== 'undefined' && window.api) return window.api.exportSave(save)

  const name = exportFileName()
  const url = URL.createObjectURL(new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return { canceled: false, path: name }
}

function pickJsonFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.style.display = 'none'
    const done = (file: File | null): void => {
      input.remove()
      resolve(file)
    }
    input.addEventListener('change', () => done(input.files?.[0] ?? null), { once: true })
    input.addEventListener('cancel', () => done(null), { once: true })
    document.body.appendChild(input)
    input.click()
  })
}

/**
 * Lets the user pick a save file and validates it. Resolves null when the dialog is cancelled.
 * Rejects with a user-presentable message when the file is unreadable, too large, not JSON or not
 * a Pelagix save. Nothing is applied: pass `report.save` to `replaceSave` or `mergeEntries`.
 */
export async function importSaveFromFile(): Promise<SaveParseReport | null> {
  let raw: unknown
  if (typeof window !== 'undefined' && window.api) {
    raw = await window.api.importSave()
    if (raw === null) return null
  } else {
    const file = await pickJsonFile()
    if (!file) return null
    if (file.size > MAX_IMPORT_BYTES) throw new Error('That file is too large to be a Pelagix save.')
    try {
      raw = JSON.parse((await file.text()).replace(/^﻿/, ''))
    } catch {
      throw new Error('That file is not valid JSON.')
    }
  }
  const report = parseSaveReport(raw)
  if (!report.recognized) throw new Error('That file is not a Pelagix save.')
  return report
}
