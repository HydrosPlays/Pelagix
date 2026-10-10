import { afterEach, describe, expect, it } from 'vitest'
import { activeLanguage, fillPlaceholders, installLanguage, languageVersion, loadLanguage, messageText, setActiveLanguage, subscribeLanguage, t, translate, type MessageKey } from './runtime'

// Keys that do not exist in the real tables, for the mechanics only.
const key = (name: string): MessageKey => `shell.${name}` as MessageKey

afterEach(() => setActiveLanguage('en'))

describe('text table', () => {
  it('starts in English and reads English text', () => {
    expect(activeLanguage()).toBe('en')
    expect(t('shell.route.homedex')).toBe('HOME Dex')
    expect(t('shell.nav.progress.count', { caught: 1234, total: 5678 })).toBe('1,234 of 5,678 caught')
  })

  it('returns the key itself for a key nobody has', () => {
    expect(t(key('no.such.key'))).toBe('shell.no.such.key')
  })

  it('fills placeholders, groups numbers for the language and leaves strings alone', () => {
    expect(fillPlaceholders('{a} and {b}', { a: 'x', b: 12345 }, 'en')).toBe('x and 12,345')
    expect(fillPlaceholders('{a} and {b}', { a: '2026', b: 12345 }, 'de')).toBe('2026 and 12.345')
    expect(fillPlaceholders('{a} {missing}', { a: 'x' })).toBe('x {missing}')
  })

  it('falls back to English key by key, and picks plural forms by the rules of the language', () => {
    installLanguage('fr', { shell: { 'route.home': 'Accueil', 'test.plural': { one: '{count} prise', other: '{count} prises' } } })
    installLanguage('ja', { shell: { 'test.plural': { other: '{count}匹' } } })
    expect(translate('fr', 'shell.route.home')).toBe('Accueil')
    expect(translate('fr', 'shell.route.journal')).toBe('Journal')
    expect(translate('fr', key('test.plural'), { count: 0 })).toBe('0 prise')
    expect(translate('fr', key('test.plural'), { count: 2 })).toBe('2 prises')
    expect(translate('ja', key('test.plural'), { count: 1 })).toBe('1匹')
    expect(messageText('fr', key('test.plural'))).toBe('{count} prises')
  })

  it('switches the active language and tells its listeners', () => {
    installLanguage('fr', { shell: { 'route.home': 'Accueil' } })
    let calls = 0
    const stop = subscribeLanguage(() => calls++)
    const before = languageVersion()
    setActiveLanguage('fr')
    expect(t('shell.route.home')).toBe('Accueil')
    expect(calls).toBe(1)
    expect(languageVersion()).toBeGreaterThan(before)
    setActiveLanguage('fr')
    expect(calls).toBe(1)
    stop()
    setActiveLanguage('en')
    expect(calls).toBe(1)
    expect(t('shell.route.home')).toBe('Home')
  })

  it('loads a language from its files', async () => {
    await loadLanguage('ko')
    expect(translate('ko', 'shell.route.home')).toBe('홈')
  })

  it('reads a message Latin American Spanish lacks from Spanish before English', async () => {
    await loadLanguage('es-419')
    expect(translate('es-419', 'shell.route.settings')).toBe(translate('es', 'shell.route.settings'))
    expect(translate('es', 'shell.route.settings')).not.toBe(translate('en', 'shell.route.settings'))
  })
})
