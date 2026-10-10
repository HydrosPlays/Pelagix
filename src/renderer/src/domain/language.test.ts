import { afterEach, describe, expect, it } from 'vitest'
import { POKEDEX_NAMES } from '@shared/pokedexes'
import pokedexMessages from '@renderer/i18n/en/pokedex'
import { installLanguage, setActiveLanguage } from '@renderer/i18n/runtime'
import { registerTerms } from '@renderer/i18n/terms'
import { buildBoxes, boxName } from '@renderer/features/living/model'
import { fixtureDex as dex } from '@renderer/lib/test-fixture'
import { gameSlots, parsePokedexes, planSections, pokedexName, pokedexShortName } from './gamedex'
import { generationName } from './generation'
import { HOME_FILTERS } from './home'
import { buildSlots, collectionFor, RULE_INFO, RULE_PRESETS } from './slots'

const realFiles = import.meta.glob<unknown>('../../public/data/pokedexes.json', { eager: true, import: 'default' })
const real = parsePokedexes(Object.values(realFiles)[0])

afterEach(() => setActiveLanguage('en'))

describe('names of the regional Pokédexes', () => {
  const messages: Record<string, unknown> = pokedexMessages

  it('has a message for every Pokédex of the shared table, reading as the table does', () => {
    for (const [id, name] of Object.entries(POKEDEX_NAMES)) {
      expect(messages[`dex.${id}`], id).toBe(name)
      expect(messages[`dexShort.${id}`], id).toBe(name.replace(' Pokédex', ''))
      expect(pokedexName(id)).toBe(name)
      expect(pokedexShortName(id)).toBe(name.replace(' Pokédex', ''))
    }
  })

  it('falls back to the id for a Pokédex nobody named', () => {
    expect(pokedexName('brand-new')).toBe('brand-new')
    expect(pokedexShortName('brand-new')).toBe('brand-new')
  })
})

describe('text of the model in another language', () => {
  it('follows the language on objects that were built and cached before the switch', () => {
    const rules = RULE_PRESETS.completionist.rules
    const gmax = buildSlots(dex, rules).find((slot) => slot.key === '25:gmax')!
    const plan = planSections('sword', real)!
    const base = collectionFor(dex, [], rules)
    const sword = gameSlots(dex, real, base, 'sword')
    const box = buildBoxes(sword.slots)[0]!
    expect(gmax.label).toBe('Gigantamax Pikachu')
    expect(plan.sections[0]!.title).toBe('Galar Pokédex')
    expect(sword.sections[0]!.title).toBe('Galar Pokédex')
    expect(boxName(box)).toBe('Box 1 of the Galar Pokédex')

    installLanguage('it', {
      pokedex: { 'dex.galar': 'Pokédex di Galar' },
      domain: { 'slot.gmax': '{name} Gigamax', 'generation.1': 'Prima generazione', 'rule.gmax.label': 'Gigamax', 'home.filter.home': 'In HOME (it)' },
      living: { 'box.nameOfDex': 'Box {number} del {dex}' }
    })
    registerTerms('it', { species: { 25: 'Pikachu-it' }, formFull: { '25-0': 'Pikachu-it' } })
    setActiveLanguage('it')

    expect(gmax.label).toBe('Pikachu-it Gigamax')
    expect(plan.sections[0]!.title).toBe('Pokédex di Galar')
    expect(sword.sections[0]!.title).toBe('Pokédex di Galar')
    expect(box.sectionTitle).toBe('Pokédex di Galar')
    expect(boxName(box)).toBe('Box 1 del Pokédex di Galar')
    expect(generationName(1)).toBe('Prima generazione')
    expect(RULE_INFO.gmax.label).toBe('Gigamax')
    expect(HOME_FILTERS.map((f) => f.label)).toEqual(['All', 'In HOME (it)', 'Not sent yet', 'Not caught'])
    // What is not translated reads in English.
    expect(generationName(2)).toBe('Generation II')
    expect(RULE_INFO.gmax.description).toBe('An extra slot for every form that can Gigantamax.')
    expect(RULE_PRESETS.forms.label).toBe('Forms')

    setActiveLanguage('en')
    expect(gmax.label).toBe('Gigantamax Pikachu')
    expect(boxName(box)).toBe('Box 1 of the Galar Pokédex')
  })
})
