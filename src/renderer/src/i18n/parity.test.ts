/**
 * Guards the translations. For every language other than English, every message must belong to
 * a key English has, keep English's placeholders and tags exactly, carry the plural forms the
 * language needs, and never be empty. The same goes for the main-process table (main-text.ts).
 *
 * A language may be partial: what it lacks reads in English, and is only listed here (run with
 * `PELAGIX_I18N_REPORT=1 npx vitest run src/renderer/src/i18n/parity.test.ts` to see the list).
 * Once a language is in COMPLETE, a missing key fails the test.
 */

import { describe, expect, it } from 'vitest'
import { LANGUAGES, languageTag, type LanguageId } from '@shared/languages'
import { MAIN_TEXT, type MainTextKey } from '@shared/main-text'
import { NAMESPACES } from './en'
import { LANGUAGE_BASE } from './runtime'
import type { Message, Messages } from './types'

/** Languages whose translation is finished: these may not miss a single key. */
const COMPLETE: readonly LanguageId[] = ['ja', 'fr', 'it', 'de', 'es', 'es-419', 'ko', 'zh-Hans', 'zh-Hant']

const FILES = import.meta.glob<{ default: Messages }>(['./*/*.ts', '!./en/*.ts'], { eager: true })
const REPORT = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.['PELAGIX_I18N_REPORT'] === '1'
const OTHERS = LANGUAGES.map((l) => l.id).filter((id) => id !== 'en')
const NAMESPACE_IDS = Object.keys(NAMESPACES)
const ENGLISH = NAMESPACES as Readonly<Record<string, Messages>>

function tables(language: LanguageId): Record<string, Messages> {
  const out: Record<string, Messages> = {}
  for (const [path, module] of Object.entries(FILES)) {
    const match = /^\.\/([^/]+)\/([^/.]+)\.ts$/.exec(path)
    if (match && match[1] === language) out[match[2]!] = module.default
  }
  return out
}

const sorted = (found: Iterable<string>): string[] => [...new Set(found)].sort()
const placeholders = (text: string): string[] => sorted([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))
const tags = (text: string): string[] => sorted([...text.matchAll(/<\/?(\w+)\/?>/g)].map((m) => m[1]!))
const forms = (message: Message): string[] => (typeof message === 'string' ? [message] : Object.values(message))
const pluralCategories = (language: LanguageId): string[] => new Intl.PluralRules(languageTag(language)).resolvedOptions().pluralCategories

/** Everything wrong with one message, as sentences. */
function problems(language: LanguageId, key: string, english: Message | undefined, message: Message): string[] {
  if (english === undefined) return [`${key}: English has no such key`]
  const found: string[] = []
  if (typeof english === 'string' && typeof message !== 'string') found.push(`${key}: has plural forms, but the English message has none`)
  if (typeof english !== 'string' && typeof message === 'string') found.push(`${key}: the English message has plural forms, this one is a single text`)
  if (typeof message !== 'string') {
    const given = Object.keys(message)
    const needed = pluralCategories(language)
    if (!given.includes('other')) found.push(`${key}: no "other" form`)
    for (const form of given) if (!needed.includes(form)) found.push(`${key}: "${form}" is not a plural form of ${language} (${needed.join(', ')})`)
    // "many" (French, Italian, Spanish: millions) and "zero" may be left to "other".
    for (const form of needed) if (!given.includes(form) && form !== 'many' && form !== 'zero') found.push(`${key}: plural form "${form}" is missing`)
  }
  const wantPlaceholders = sorted(forms(english).flatMap(placeholders))
  const wantTags = sorted(forms(english).flatMap(tags))
  for (const text of forms(message)) {
    if (text.trim() === '') found.push(`${key}: empty text`)
    // A plural form may leave {count} out ("one item"), nothing else.
    const have = placeholders(text)
    const lacking = wantPlaceholders.filter((name) => !have.includes(name) && !(typeof message !== 'string' && name === 'count'))
    const extra = have.filter((name) => !wantPlaceholders.includes(name))
    if (lacking.length > 0 || extra.length > 0) found.push(`${key}: placeholders {${have.join('}, {')}} do not match the English {${wantPlaceholders.join('}, {')}}`)
    if (tags(text).join() !== wantTags.join()) found.push(`${key}: tags <${tags(text).join('>, <')}> do not match the English <${wantTags.join('>, <')}>`)
  }
  return found
}

function missingKeys(language: LanguageId): string[] {
  const mine = tables(language)
  // A language written as the differences from another one is covered by that one's messages.
  const base = LANGUAGE_BASE[language] ? tables(LANGUAGE_BASE[language]) : {}
  const missing: string[] = []
  for (const namespace of NAMESPACE_IDS) {
    for (const key of Object.keys(ENGLISH[namespace]!)) {
      if (mine[namespace]?.[key] === undefined && base[namespace]?.[key] === undefined) missing.push(`${namespace}.${key}`)
    }
  }
  for (const key of Object.keys(MAIN_TEXT.en) as MainTextKey[]) if (MAIN_TEXT[language][key] === undefined) missing.push(`main-text.ts ${key}`)
  return missing
}

describe('English text table', () => {
  it('has no empty message and gives every plural message its two English forms', () => {
    const found: string[] = []
    for (const namespace of NAMESPACE_IDS) {
      for (const [key, message] of Object.entries(ENGLISH[namespace]!)) {
        if (forms(message).some((text) => text.trim() === '')) found.push(`${namespace}.${key}: empty text`)
        if (typeof message !== 'string' && Object.keys(message).sort().join() !== 'one,other') found.push(`${namespace}.${key}: English needs exactly "one" and "other"`)
      }
    }
    expect(found).toEqual([])
  })
})

describe.each(OTHERS)('translation: %s', (language) => {
  it('has a file for every namespace, and only for those', () => {
    expect(Object.keys(tables(language)).sort()).toEqual([...NAMESPACE_IDS].sort())
  })

  it('matches English key by key: placeholders, tags, plural forms, nothing empty', () => {
    const found: string[] = []
    for (const [namespace, messages] of Object.entries(tables(language))) {
      for (const [key, message] of Object.entries(messages)) found.push(...problems(language, `${namespace}.${key}`, ENGLISH[namespace]?.[key], message))
    }
    for (const [key, text] of Object.entries(MAIN_TEXT[language])) {
      found.push(...problems(language, `main-text.ts ${key}`, MAIN_TEXT.en[key as MainTextKey], text))
    }
    expect(found).toEqual([])
  })

  it('is complete once it is marked complete', () => {
    const missing = missingKeys(language)
    if (REPORT && missing.length > 0) {
      console.info(`[i18n] ${language}: ${missing.length} keys still read in English\n  ${missing.join('\n  ')}`)
    }
    if (COMPLETE.includes(language)) expect(missing).toEqual([])
  })
})

describe('the parity check itself', () => {
  const plural = { one: '{count} catch', other: '{count} catches' }

  it('reports what a bad translation gets wrong', () => {
    expect(problems('fr', 'a.b', undefined, 'x')).toEqual(['a.b: English has no such key'])
    expect(problems('fr', 'a.b', 'Hello {name}', 'Bonjour')).toHaveLength(1)
    expect(problems('fr', 'a.b', 'Hello {name}', 'Bonjour {name}')).toEqual([])
    expect(problems('fr', 'a.b', 'Run <code>x</code>', 'Lancez x')).toHaveLength(1)
    expect(problems('fr', 'a.b', 'Hello', ' ')).toEqual(['a.b: empty text'])
    expect(problems('ja', 'a.b', plural, { other: '{count}匹' })).toEqual([])
    expect(problems('ja', 'a.b', plural, { one: '1匹', other: '{count}匹' })).toHaveLength(1)
    expect(problems('de', 'a.b', plural, { other: '{count} Fänge' })).toEqual(['a.b: plural form "one" is missing'])
    expect(problems('de', 'a.b', plural, { one: 'Ein Fang', other: '{count} Fänge' })).toEqual([])
    expect(problems('de', 'a.b', plural, '{count} Fänge')).toHaveLength(1)
  })
})
