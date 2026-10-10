import { describe, expect, it } from 'vitest'
import { DEFAULT_LANGUAGE, isLanguageId, LANGUAGES, languageTag, matchLanguage } from './languages'

describe('languages', () => {
  it('lists the ten languages in the order of the games’ language menu', () => {
    expect(LANGUAGES.map((l) => l.id)).toEqual(['ja', 'en', 'fr', 'it', 'de', 'es', 'es-419', 'ko', 'zh-Hans', 'zh-Hant'])
    expect(LANGUAGES.map((l) => l.autonym)).toEqual(['日本語', 'English', 'Français', 'Italiano', 'Deutsch', 'Español (España)', 'Español (Latinoamérica)', '한국어', '简体中文', '繁體中文'])
    expect(DEFAULT_LANGUAGE).toBe('en')
  })

  it('gives every language a tag Intl accepts', () => {
    for (const { id, tag } of LANGUAGES) {
      expect(Intl.getCanonicalLocales(tag)).toEqual([tag])
      expect(languageTag(id)).toBe(tag)
    }
  })

  it('recognises its ids and nothing else', () => {
    for (const { id } of LANGUAGES) expect(isLanguageId(id)).toBe(true)
    for (const value of ['EN', 'zh', 'es-MX', 'pt', '', null, undefined, 1, {}]) expect(isLanguageId(value)).toBe(false)
  })

  it('maps the system languages to one of the ten', () => {
    expect(matchLanguage(['fr-CA', 'en-US'])).toBe('fr')
    expect(matchLanguage(['en-GB'])).toBe('en')
    expect(matchLanguage(['ja-JP'])).toBe('ja')
    expect(matchLanguage(['ko-KR'])).toBe('ko')
    expect(matchLanguage(['de-AT'])).toBe('de')
    expect(matchLanguage(['it'])).toBe('it')
  })

  it('tells the two Spanish and the two Chinese apart', () => {
    expect(matchLanguage(['es'])).toBe('es')
    expect(matchLanguage(['es-ES'])).toBe('es')
    expect(matchLanguage(['es-MX'])).toBe('es-419')
    expect(matchLanguage(['es-419'])).toBe('es-419')
    expect(matchLanguage(['es-US'])).toBe('es-419')
    expect(matchLanguage(['zh-TW'])).toBe('zh-Hant')
    expect(matchLanguage(['zh-HK'])).toBe('zh-Hant')
    expect(matchLanguage(['zh-MO'])).toBe('zh-Hant')
    expect(matchLanguage(['zh-Hant-CN'])).toBe('zh-Hant')
    expect(matchLanguage(['zh'])).toBe('zh-Hans')
    expect(matchLanguage(['zh-CN'])).toBe('zh-Hans')
    expect(matchLanguage(['zh-SG'])).toBe('zh-Hans')
    expect(matchLanguage(['zh-Hans-HK'])).toBe('zh-Hans')
  })

  it('takes the first language it has, and English when it has none', () => {
    expect(matchLanguage(['pt-BR', 'nl', 'ko'])).toBe('ko')
    expect(matchLanguage(['pt-BR'])).toBe('en')
    expect(matchLanguage([])).toBe('en')
    expect(matchLanguage(['ZH_tw'])).toBe('zh-Hant')
  })
})
