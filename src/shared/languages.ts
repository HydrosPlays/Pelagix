/**
 * The languages Pelagix can be shown in: the ones the Pokémon games ship in, in the order of the
 * games' own language menu. One setting (`AppSettings.language`) drives both the interface text
 * and the Pokémon terms.
 *
 * Keep this file dependency-free and free of non-erasable TypeScript syntax (see games.ts).
 */

/** The ids match the suffixes of the PKHeX text files (text_Species_<id>.txt). Saved in the user's save: never rename. */
export type LanguageId = 'ja' | 'en' | 'fr' | 'it' | 'de' | 'es' | 'es-419' | 'ko' | 'zh-Hans' | 'zh-Hant'

export interface LanguageDef {
  id: LanguageId
  /** The language's name in the language itself, as the games' language menu writes it. */
  autonym: string
  /** BCP 47 tag for `<html lang>` and `Intl`. */
  tag: string
}

export const LANGUAGES: readonly LanguageDef[] = [
  { id: 'ja', autonym: '日本語', tag: 'ja' },
  { id: 'en', autonym: 'English', tag: 'en' },
  { id: 'fr', autonym: 'Français', tag: 'fr' },
  { id: 'it', autonym: 'Italiano', tag: 'it' },
  { id: 'de', autonym: 'Deutsch', tag: 'de' },
  { id: 'es', autonym: 'Español (España)', tag: 'es-ES' },
  { id: 'es-419', autonym: 'Español (Latinoamérica)', tag: 'es-419' },
  { id: 'ko', autonym: '한국어', tag: 'ko' },
  { id: 'zh-Hans', autonym: '简体中文', tag: 'zh-Hans' },
  { id: 'zh-Hant', autonym: '繁體中文', tag: 'zh-Hant' }
]

export const DEFAULT_LANGUAGE: LanguageId = 'en'

export const LANGUAGE_BY_ID: ReadonlyMap<LanguageId, LanguageDef> = new Map(LANGUAGES.map((d) => [d.id, d]))

export function isLanguageId(value: unknown): value is LanguageId {
  return typeof value === 'string' && LANGUAGE_BY_ID.has(value as LanguageId)
}

/** BCP 47 tag of a language, for `<html lang>` and `Intl`. */
export function languageTag(id: LanguageId): string {
  return LANGUAGE_BY_ID.get(id)?.tag ?? DEFAULT_LANGUAGE
}

const TRADITIONAL_REGIONS = new Set(['tw', 'hk', 'mo'])

function matchOne(raw: string): LanguageId | null {
  const parts = raw.trim().toLowerCase().split(/[-_]/)
  const base = parts[0]
  const rest = parts.slice(1)
  switch (base) {
    case 'ja':
    case 'en':
    case 'fr':
    case 'it':
    case 'de':
    case 'ko':
      return base
    case 'es':
      return rest.length === 0 || rest.includes('es') ? 'es' : 'es-419'
    case 'zh':
      if (rest.includes('hant')) return 'zh-Hant'
      if (rest.includes('hans')) return 'zh-Hans'
      return rest.some((part) => TRADITIONAL_REGIONS.has(part)) ? 'zh-Hant' : 'zh-Hans'
    default:
      return null
  }
}

/**
 * The first of the user's preferred languages (`navigator.languages`) that Pelagix has, as one of
 * the ten. Chinese of Taiwan, Hong Kong and Macao is Traditional, any other Chinese Simplified;
 * Spanish of Spain (and plain "es") is `es`, any other Spanish `es-419`. English when none matches.
 */
export function matchLanguage(preferred: readonly string[]): LanguageId {
  for (const raw of preferred) {
    const match = typeof raw === 'string' ? matchOne(raw) : null
    if (match) return match
  }
  return DEFAULT_LANGUAGE
}
