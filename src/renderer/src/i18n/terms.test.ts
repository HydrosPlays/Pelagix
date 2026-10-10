import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { SpeciesDetail } from '@shared/dex-types'
import type { LanguageId } from '@shared/languages'
import dataMessages from './en/data'
import { installLanguage, setActiveLanguage } from './runtime'
import {
  abilityName, ballName, conditionLabel, evolutionText, flavorText, formFullName, formLabel, gameGroupName, gameName, gameShortName,
  loadTerms, locationName, methodLabel, registerTerms, speciesGenus, speciesName, termsFromFile, typeName, variantName
} from './terms'

/** The datasets as built by `npm run data` (the same files the app ships). */
const termFiles = import.meta.glob<unknown>('../../public/data/terms/*.json', { import: 'default' })
const detailFiles = import.meta.glob<SpeciesDetail>('../../public/data/species/*.json', { import: 'default' })

function readTerms(language: string): Promise<unknown> {
  const load = termFiles[`../../public/data/terms/${language}.json`]
  if (!load) throw new Error(`public/data/terms/${language}.json is missing: run "npm run data:build"`)
  return load()
}

function use(language: LanguageId): void {
  setActiveLanguage(language)
}

const bulbasaur = { id: 1, name: 'Bulbasaur', genus: 'Seed Pokémon' }
const pikachu = { id: 25, name: 'Pikachu', genus: 'Mouse Pokémon' }
const alolanRaichu = { f: 1, name: 'Alolan Form', full: 'Alolan Raichu' }
const megaCharizardX = { f: 1, name: 'Mega X', full: 'Mega Charizard X' }
const lordArcanine = { f: 2, name: 'Lord', full: 'Hisuian Arcanine (Lord)' }
const alcremie = { f: 0, name: 'Vanilla Cream', full: 'Alcremie', variants: [{ id: 0, name: 'Strawberry Sweet' }] }

beforeAll(async () => {
  for (const language of ['fr', 'ja', 'de'] as const) {
    const data = termsFromFile(await readTerms(language))
    if (!data) throw new Error(`terms/${language}.json is not a terms file`)
    registerTerms(language, data)
  }
})

afterEach(() => {
  setActiveLanguage('en')
  vi.unstubAllGlobals()
})

describe('terms of a loaded language', () => {
  it('names species', () => {
    use('fr')
    expect(speciesName(bulbasaur)).toBe('Bulbizarre')
    expect(speciesGenus(bulbasaur)).toBe('Pokémon Graine')
    // The same name as in English is not repeated in the file: it falls back.
    expect(speciesName(pikachu)).toBe('Pikachu')
    use('ja')
    expect(speciesName(pikachu)).toBe('ピカチュウ')
    expect(speciesGenus(pikachu)).toBe('ねずみポケモン')
    use('en')
    expect(speciesName(bulbasaur)).toBe('Bulbasaur')
  })

  it('names forms, a regional one from PokeAPI and one PokeAPI lacks from the qualifier', () => {
    use('fr')
    expect(formLabel(26, alolanRaichu)).toBe('Forme d’Alola')
    expect(formFullName(26, alolanRaichu)).toBe('Raichu d’Alola')
    expect(formFullName(6, megaCharizardX)).toBe('Méga-Dracaufeu X')
    expect(formFullName(1, { f: 0, name: '', full: 'Bulbasaur' })).toBe('Bulbizarre')
    use('ja')
    expect(formLabel(26, alolanRaichu)).toBe('アローラのすがた')
    expect(formFullName(26, alolanRaichu)).toBe('ライチュウ (アローラのすがた)')
    // A hand-written English name with no official text stays English.
    expect(formFullName(59, lordArcanine)).toBe('Hisuian Arcanine (Lord)')
  })

  it('names a variant', () => {
    use('fr')
    expect(variantName(869, alcremie, 0)).toBe('Fraise en Sucre')
    expect(variantName(869, alcremie, 5)).toBeUndefined()
    expect(variantName(869, alcremie, null)).toBeUndefined()
  })

  it('names types, abilities and balls', () => {
    use('fr')
    expect(typeName('fire')).toBe('Feu')
    expect(abilityName(65)).toBe('Engrais')
    expect(ballName(2)).toBe('Hyper Ball')
    // The French Poké Ball is called as in English.
    expect(ballName(4)).toBe('Poké Ball')
    use('de')
    expect(typeName('fire')).toBe('Feuer')
    expect(ballName(4)).toBe('Pokéball')
    expect(abilityName(null)).toBeUndefined()
  })

  it('names games', () => {
    use('fr')
    expect(gameName('scarlet')).toBe('Pokémon Écarlate')
    expect(gameShortName('scarlet')).toBe('Écarlate')
    expect(gameGroupName('sv')).toBe('Écarlate & Violet')
    expect(gameShortName('green')).toBe('Vert')
    // No text of the games names these: English.
    expect(gameName('home')).toBe('Pokémon HOME')
    expect(gameName('stadium')).toBe('Pokémon Stadium')
    use('ja')
    expect(gameShortName('scarlet')).toBe('スカーレット')
  })

  it('names places, and leaves what it does not know', () => {
    use('fr')
    expect(locationName('Pallet Town')).toBe('Bourg Palette')
    expect(locationName('Bridge Field (Wild Area)')).toBe('Prairie Entre-Ponts (Terres Sauvages)')
    expect(locationName('My garden')).toBe('My garden')
    use('ja')
    expect(locationName('Pallet Town')).toBe('マサラタウン')
  })

  it('gives the Pokédex entry of the language, or the English one', () => {
    use('fr')
    expect(flavorText(25, 'English entry.')).toMatch(/^Les Pikachu /)
    // PokeAPI has the entries of the newest species in English only.
    expect(flavorText(1000, 'English entry.')).toBe('English entry.')
  })
})

describe('methods and conditions', () => {
  it('passes a method without a message through unchanged, in every language', () => {
    for (const language of ['en', 'fr', 'ja'] as const) {
      use(language)
      expect(methodLabel('Caught it behind the shed')).toBe('Caught it behind the shed')
      expect(conditionLabel('Only on my birthday')).toBe('Only on my birthday')
    }
  })

  it('shows the English label until the message is translated, then the translation', () => {
    use('fr')
    expect(methodLabel('Tall grass')).toBe('Tall grass')
    expect(conditionLabel('Night')).toBe('Night')
    installLanguage('fr', { data: { 'method.tallGrass': 'Hautes herbes', 'condition.night': 'Nuit' } })
    expect(methodLabel('Tall grass')).toBe('Hautes herbes')
    expect(conditionLabel('Night')).toBe('Nuit')
    use('en')
    expect(methodLabel('Tall grass')).toBe('Tall grass')
    installLanguage('fr', {})
  })

  it('has a message for every method and condition of the built datasets', async () => {
    const methods = new Set<string>()
    const conditions = new Set<string>()
    const details = await Promise.all(Object.values(detailFiles).map((load) => load()))
    expect(details.length).toBeGreaterThan(1000)
    for (const detail of details) {
      for (const form of Object.values(detail.forms)) {
        for (const row of form.rows) {
          if (row.m !== undefined) methods.add(row.m)
          for (const condition of row.c ?? []) conditions.add(condition)
        }
      }
    }
    const messages = Object.entries(dataMessages) as Array<[string, string]>
    const texts = (prefix: string): string[] => messages.filter(([key]) => key.startsWith(prefix)).map(([, text]) => text)
    const methodTexts = texts('method.')
    const conditionTexts = texts('condition.')
    expect(methods.size).toBeGreaterThan(100)
    expect([...methods].filter((m) => !methodTexts.includes(m))).toEqual([])
    expect([...conditions].filter((c) => !conditionTexts.includes(c))).toEqual([])
    // Looked up by their English text: two keys must never carry the same text.
    expect(new Set(methodTexts).size).toBe(methodTexts.length)
    expect(new Set(conditionTexts).size).toBe(conditionTexts.length)
  })
})

describe('evolutionText', () => {
  const sentences = ['Level 16', 'Use a Thunder Stone', 'Use an Ice Stone', 'Trade holding a Metal Coat', 'Level up knowing Dragon Cheer', 'Change form: give it the Wellspring Mask to hold']

  it('returns the English sentence unchanged in English', () => {
    for (const sentence of sentences) expect(evolutionText(sentence)).toBe(sentence)
  })

  it('keeps the English sentence whole while the message is not translated', () => {
    use('fr')
    for (const sentence of sentences) expect(evolutionText(sentence)).toBe(sentence)
  })

  it('rebuilds the common sentences from a translated message and the official names', () => {
    installLanguage('fr', {
      data: {
        'evolution.level': 'Niveau {level}',
        'evolution.useItem': 'Utiliser : {item}',
        'evolution.tradeHolding': 'Échange en tenant : {item}',
        'evolution.levelUpKnowing': 'Gagner un niveau en connaissant {move}',
        'evolution.tradeFor': 'Échange contre {species}',
        'evolution.fuse': 'Fusion avec {species} ({item})'
      }
    })
    use('fr')
    expect(evolutionText('Level 16')).toBe('Niveau 16')
    expect(evolutionText('Use a Thunder Stone')).toBe('Utiliser : Pierre Foudre')
    expect(evolutionText('Use an Ice Stone')).toBe('Utiliser : Pierre Glace')
    expect(evolutionText('Trade holding a Metal Coat')).toBe('Échange en tenant : Peau Métal')
    expect(evolutionText('Level up knowing Dragon Cheer')).toBe('Gagner un niveau en connaissant Cri Draconique')
    expect(evolutionText('Trade for a Karrablast')).toBe('Échange contre Carabing')
    expect(evolutionText('Fuse with Zekrom using the DNA Splicers')).toBe('Fusion avec Zekrom (Pointeau ADN)')
    // Not one of the patterns, or not a name of the games: the English sentence, whole.
    expect(evolutionText('Use a Dawn Stone on a female')).toBe('Use a Dawn Stone on a female')
    expect(evolutionText('Use a Peat Block under a full moon')).toBe('Use a Peat Block under a full moon')
    expect(evolutionText('Level 30 while holding the console upside down')).toBe('Level 30 while holding the console upside down')
    // A message that is not translated yet.
    expect(evolutionText('Evolve with high friendship')).toBe('Evolve with high friendship')
    installLanguage('fr', {})
  })
})

describe('loadTerms', () => {
  it('never rejects, and leaves the language in English when its file cannot be loaded', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
    await expect(loadTerms('it')).resolves.toBeUndefined()
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: false, status: 404 }))
    await expect(loadTerms('it')).resolves.toBeUndefined()
    use('it')
    expect(typeName('fire')).toBe('Fire')
  })

  it('fetches the file of the language once and registers it', async () => {
    const fetchFn = vi.fn((_url: string) => Promise.resolve({ ok: true, json: () => readTerms('it') }))
    vi.stubGlobal('fetch', fetchFn)
    await loadTerms('it')
    await loadTerms('it')
    await loadTerms('en')
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(fetchFn).toHaveBeenCalledWith('./data/terms/it.json')
    use('it')
    expect(typeName('fire')).toBe('Fuoco')
  })

  it('drops what is not a table of texts', () => {
    expect(termsFromFile(null)).toBeUndefined()
    expect(termsFromFile({ v: 2, species: { 1: 'x' } })).toBeUndefined()
    expect(termsFromFile({ v: 1, species: { 1: 'x', 2: 5, 3: '' }, types: 'no' })).toEqual({ species: { 1: 'x' } })
  })
})
