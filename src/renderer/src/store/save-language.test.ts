import { afterEach, describe, expect, it } from 'vitest'
import { createEmptySave, DEFAULT_SETTINGS, type SaveFile } from '@shared/save-types'
import { registerTerms, speciesName, typeName, abilityName, ballName, gameName, gameShortName, gameGroupName, locationName, methodLabel, formLabel, formFullName, variantName, flavorText } from '@renderer/i18n/terms'
import { installLanguage, setActiveLanguage } from '@renderer/i18n/runtime'
import { formatCount, formatDate, formatMonth, listText, percent } from '@renderer/lib/format'
import { createMemoryBackend, parseSave, sanitizeSettings } from '@renderer/lib/storage'
import { createSaveStore } from './save'

const NOW = '2026-10-10T08:00:00.000Z'

async function readyStore(initial: unknown | null = null) {
  const store = createSaveStore({ backend: createMemoryBackend(initial), now: () => NOW, flushOnUnload: false })
  await store.getState().hydrate()
  return store
}

const saveWith = (language?: string): SaveFile => ({ ...createEmptySave(NOW), settings: { ...DEFAULT_SETTINGS, ...(language !== undefined && { language }) } as SaveFile['settings'] })

afterEach(() => setActiveLanguage('en'))

describe('the language setting', () => {
  it('is absent until chosen, and an unknown value is dropped', () => {
    expect('language' in createEmptySave(NOW).settings).toBe(false)
    expect('language' in sanitizeSettings({ language: 'pt' })).toBe(false)
    expect('language' in sanitizeSettings({ language: 5 })).toBe(false)
    expect(sanitizeSettings({ language: 'zh-Hant' }).language).toBe('zh-Hant')
    expect(parseSave(saveWith('ko'), NOW).settings.language).toBe('ko')
    expect(parseSave(saveWith('xx'), NOW).settings).toEqual(DEFAULT_SETTINGS)
  })

  it('is set through the store and survives other setting changes', async () => {
    const store = await readyStore()
    expect(store.getState().save.settings.language).toBeUndefined()
    store.getState().setLanguage('fr')
    expect(store.getState().save.settings.language).toBe('fr')
    store.getState().setSettings({ theme: 'light' })
    expect(store.getState().save.settings).toMatchObject({ theme: 'light', language: 'fr' })
    // An invalid value leaves the old one alone.
    store.getState().setSettings({ language: 'pt' as never })
    expect(store.getState().save.settings.language).toBe('fr')
  })

  it('stays the one chosen on this computer when a save is imported', async () => {
    const store = await readyStore(saveWith('fr'))
    store.getState().replaceSave(saveWith('ja'))
    expect(store.getState().save.settings.language).toBe('fr')
    store.getState().replaceSave(saveWith())
    expect(store.getState().save.settings.language).toBe('fr')
  })

  it('is taken from an imported save only when none is chosen yet', async () => {
    const store = await readyStore()
    store.getState().replaceSave(saveWith())
    expect('language' in store.getState().save.settings).toBe(false)
    store.getState().replaceSave(saveWith('ja'))
    expect(store.getState().save.settings.language).toBe('ja')
  })

  it('survives a reset, with or without the other settings', async () => {
    const store = await readyStore(saveWith('de'))
    store.getState().setSettings({ theme: 'light' })
    store.getState().resetAll({ keepSettings: true })
    expect(store.getState().save.settings).toMatchObject({ theme: 'light', language: 'de' })
    store.getState().resetAll()
    expect(store.getState().save.settings).toEqual({ ...DEFAULT_SETTINGS, language: 'de' })
  })
})

describe('Pokémon term accessors', () => {
  const form = { f: 1, name: 'Alolan Form', full: 'Alolan Raichu', variants: [{ id: 2, name: 'Berry Sweet' }] }

  it('return the English text when the language has no data', () => {
    expect(speciesName({ id: 26, name: 'Raichu' })).toBe('Raichu')
    expect(speciesName(26)).toBe('') // the datasets are not loaded in this test
    expect(formLabel(26, form)).toBe('Alolan Form')
    expect(formFullName({ id: 26 }, form)).toBe('Alolan Raichu')
    expect(variantName(26, form, 2)).toBe('Berry Sweet')
    expect(variantName(26, form, 9)).toBeUndefined()
    expect(typeName('fire')).toBe('Fire')
    expect(abilityName(65)).toBe('Overgrow')
    expect(abilityName(undefined)).toBeUndefined()
    expect(ballName(4)).toBe('Poké Ball')
    expect(ballName(-1)).toBeUndefined()
    expect(gameName('scarlet')).toBe('Pokémon Scarlet')
    expect(gameShortName('scarlet')).toBe('Scarlet')
    expect(gameGroupName('sv')).toBe('Scarlet & Violet')
    expect(gameName('nope')).toBe('nope')
    expect(flavorText(26, 'English entry.')).toBe('English entry.')
    expect(locationName('Route 1')).toBe('Route 1')
    expect(methodLabel('Tall grass')).toBe('Tall grass')
  })

  it('use registered terms of the active language, and pass anything else through untouched', () => {
    registerTerms('fr', { species: { 26: 'Raichu-fr' }, types: { fire: 'Feu' }, locations: { 'Route 1': 'Route 1 (fr)' } })
    registerTerms('fr', { species: { 25: 'Pikachu-fr' }, forms: { '26-1': 'Forme d’Alola' } })
    expect(speciesName(26)).toBe('') // still English, still not loaded
    setActiveLanguage('fr')
    expect(speciesName(26)).toBe('Raichu-fr')
    expect(speciesName({ id: 25, name: 'Pikachu' })).toBe('Pikachu-fr')
    expect(speciesName({ id: 1, name: 'Bulbasaur' })).toBe('Bulbasaur')
    expect(formLabel(26, form)).toBe('Forme d’Alola')
    expect(formFullName(26, form)).toBe('Alolan Raichu')
    expect(typeName('fire')).toBe('Feu')
    expect(typeName('water')).toBe('Water')
    expect(locationName('Route 1')).toBe('Route 1 (fr)')
    expect(locationName('my secret spot')).toBe('my secret spot')
  })
})

describe('formatters follow the active language', () => {
  it('keep their English forms in English', () => {
    expect(formatCount(1234567)).toBe('1,234,567')
    expect(percent(3, 8)).toBe('37.5%')
    expect(listText(['A', 'B', 'C'])).toBe('A, B and C')
    expect(formatDate('2026-10-09')).toBe('9 Oct 2026')
    expect(formatMonth('2026-10', true)).toBe('October 2026')
  })

  it('use Intl for the others', () => {
    installLanguage('de', {})
    setActiveLanguage('de')
    expect(formatCount(1234567)).toBe('1.234.567')
    expect(percent(3, 8)).toMatch(/^37,5\s%$/)
    expect(listText(['A', 'B', 'C'])).toBe('A, B und C')
    expect(formatDate('2026-10-09', 'long')).toBe('9. Oktober 2026')
    expect(formatMonth('2026-10', true)).toBe('Oktober 2026')
    installLanguage('ja', {})
    setActiveLanguage('ja')
    expect(formatDate('2026-10-09')).toBe('2026年10月9日')
  })
})
