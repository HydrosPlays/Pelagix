/**
 * The text table: which language is active, the messages of each language, and `t()`.
 *
 * No React in here, so pure functions, stores and model files can use it. English is bundled
 * and always there; the nine other languages are loaded on demand, may be partial, and fall
 * back to English key by key. Nothing in the app sets a language in tests, so tests see English.
 */

import { DEFAULT_LANGUAGE, isLanguageId, languageTag, type LanguageId } from '@shared/languages'
import { NAMESPACES, type MessageKey } from './en'
import type { Message, MessageParams, Messages } from './types'

export type { MessageKey, Namespace, Translation } from './en'
export type { Message, MessageParams, Messages, PluralForms } from './types'

type Table = Readonly<Record<string, Message>>

function flatten(namespaces: Readonly<Record<string, Messages>>): Table {
  const table: Record<string, Message> = {}
  for (const [namespace, messages] of Object.entries(namespaces)) {
    for (const [key, message] of Object.entries(messages)) table[`${namespace}.${key}`] = message
  }
  return table
}

const ENGLISH: Table = flatten(NAMESPACES)
const tables: Partial<Record<LanguageId, Table>> = { en: ENGLISH }

// i18n/<language>/<namespace>.ts, each its own chunk: a translator adds a language by adding files.
const FILES = import.meta.glob<{ default: Messages }>(['./*/*.ts', '!./en/*.ts'])
const FILE_PATH = /^\.\/([^/]+)\/([^/.]+)\.ts$/

// ---------------------------------------------------------------- active language

let active: LanguageId = DEFAULT_LANGUAGE
let version = 0
const listeners = new Set<() => void>()

/** The language `t()` and the formatters use right now. English until the app says otherwise. */
export function activeLanguage(): LanguageId {
  return active
}

/** Changes on every language switch and whenever more text of a language arrives. For `useSyncExternalStore`. */
export function languageVersion(): number {
  return version
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Tells everything that shows text to render again: more text (or more Pokémon terms) of a language has arrived. */
export function languageChanged(): void {
  version++
  for (const listener of [...listeners]) listener()
}

/**
 * Makes a language the active one, at once. Text that is not loaded yet shows in English until
 * `loadLanguage` is done; the app calls `applyLanguage` (shell/language.ts), which does both.
 */
export function setActiveLanguage(language: LanguageId): void {
  if (language === active) return
  active = language
  languageChanged()
}

// ---------------------------------------------------------------- loading

const loading = new Map<LanguageId, Promise<void>>()

/**
 * A language that is written as the differences from another one: a message it lacks reads in
 * that language before it reads in English. Latin American Spanish only holds what differs from
 * the Spanish of Spain.
 */
export const LANGUAGE_BASE: Readonly<Partial<Record<LanguageId, LanguageId>>> = { 'es-419': 'es' }

/** Loads the text of a language. Resolves once it is usable; never rejects (what cannot be loaded stays English). */
export function loadLanguage(language: LanguageId): Promise<void> {
  const base = LANGUAGE_BASE[language]
  if (!base) return loadOwn(language)
  return Promise.all([loadOwn(language), loadOwn(base)]).then(() => undefined)
}

function loadOwn(language: LanguageId): Promise<void> {
  if (tables[language]) return Promise.resolve()
  let pending = loading.get(language)
  if (!pending) {
    pending = (async () => {
      const namespaces: Record<string, Messages> = {}
      await Promise.all(
        Object.entries(FILES).map(async ([path, load]) => {
          const match = FILE_PATH.exec(path)
          if (!match || match[1] !== language || !Object.hasOwn(NAMESPACES, match[2]!)) return
          try {
            namespaces[match[2]!] = (await load()).default
          } catch {
            // That namespace stays English.
          }
        })
      )
      tables[language] = flatten(namespaces)
      loading.delete(language)
      languageChanged()
    })()
    loading.set(language, pending)
  }
  return pending
}

/** Puts a table in place without loading it. For tests. */
export function installLanguage(language: LanguageId, namespaces: Readonly<Record<string, Messages>>): void {
  tables[language] = flatten(namespaces)
  languageChanged()
}

// ---------------------------------------------------------------- formatting

const pluralRules = new Map<LanguageId, Intl.PluralRules>()
const numberFormats = new Map<LanguageId, Intl.NumberFormat>()

function pluralCategory(language: LanguageId, count: number): Intl.LDMLPluralRule {
  let rules = pluralRules.get(language)
  if (!rules) pluralRules.set(language, (rules = new Intl.PluralRules(languageTag(language))))
  return rules.select(count)
}

/** A number the way the language writes it: 1234 -> "1,234" in English, "1.234" in German. */
export function formatNumber(value: number, language: LanguageId = active): string {
  let format = numberFormats.get(language)
  if (!format) numberFormats.set(language, (format = new Intl.NumberFormat(languageTag(language))))
  return format.format(value)
}

const PLACEHOLDER = /\{(\w+)\}/g

/** Fills the `{name}` placeholders of a text. A placeholder without a value stays as written. */
export function fillPlaceholders(text: string, params: MessageParams | undefined, language: LanguageId = active): string {
  if (!params) return text
  return text.replace(PLACEHOLDER, (whole, name: string) => {
    const value = params[name]
    return value === undefined ? whole : typeof value === 'number' ? formatNumber(value, language) : value
  })
}

/**
 * The text of a key in a language before its placeholders are filled: the language's own
 * message, else the one of the language it is based on (LANGUAGE_BASE), else the English one, with the plural form for `count` chosen by the rules of the
 * language the message is written in.
 */
export function messageText(language: LanguageId, key: MessageKey, count?: number): string {
  let source = language
  let message = tables[language]?.[key]
  const base = LANGUAGE_BASE[language]
  if ((message === undefined || message === '') && base) {
    source = base
    message = tables[base]?.[key]
  }
  if (message === undefined || message === '') {
    source = DEFAULT_LANGUAGE
    message = ENGLISH[key]
  }
  if (message === undefined) return key
  if (typeof message === 'string') return message
  const form = typeof count === 'number' ? message[pluralCategory(source, count)] : undefined
  return form ?? message.other
}

/** `t()` in a given language instead of the active one (the language pop-up previews a language this way). */
export function translate(language: LanguageId, key: MessageKey, params?: MessageParams): string {
  const count = params?.['count']
  return fillPlaceholders(messageText(language, key, typeof count === 'number' ? count : undefined), params, language)
}

/**
 * The text of a key in the active language: `t('shell.nav.home')`, `t('home.caught', { count: 3 })`.
 * Call it when the text is needed (in a render, in a function), never at module top level.
 */
export function t(key: MessageKey, params?: MessageParams): string {
  return translate(active, key, params)
}

/** Every key a loaded language has, for the parity test and for tools. */
export function loadedKeys(language: LanguageId): readonly string[] {
  return Object.keys(tables[language] ?? {})
}

export { isLanguageId }
