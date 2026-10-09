/**
 * Double-checks every hand-written list in groups.ts against the real dataset, name by name, and
 * the sets facts.ts derives from the data. Skipped when the dataset has not been built.
 */

import { describe, expect, it } from 'vitest'
import type { DexIndex } from '@shared/dex-types'
import { Dex, validateDexIndex } from '@renderer/lib/data'
import { dexFacts } from './facts'
import * as groups from './groups'

const indexModules = import.meta.glob<DexIndex>('../../../public/data/dex.json', { eager: true, import: 'default' })
const raw = Object.values(indexModules)[0]

/** Every species list of groups.ts with the names it is meant to hold, in order. */
const EXPECTED_NAMES: ReadonlyArray<[string, readonly number[], string[]]> = [
  ['LEGENDARY_BIRDS', groups.LEGENDARY_BIRDS, ['Articuno', 'Zapdos', 'Moltres']],
  ['LEGENDARY_BEASTS', groups.LEGENDARY_BEASTS, ['Raikou', 'Entei', 'Suicune']],
  ['TOWER_DUO', groups.TOWER_DUO, ['Lugia', 'Ho-Oh']],
  ['LEGENDARY_TITANS', groups.LEGENDARY_TITANS, ['Regirock', 'Regice', 'Registeel', 'Regigigas', 'Regieleki', 'Regidrago']],
  ['EON_DUO', groups.EON_DUO, ['Latias', 'Latios']],
  ['WEATHER_TRIO', groups.WEATHER_TRIO, ['Kyogre', 'Groudon', 'Rayquaza']],
  ['LAKE_GUARDIANS', groups.LAKE_GUARDIANS, ['Uxie', 'Mesprit', 'Azelf']],
  ['CREATION_TRIO', groups.CREATION_TRIO, ['Dialga', 'Palkia', 'Giratina']],
  ['SWORDS_OF_JUSTICE', groups.SWORDS_OF_JUSTICE, ['Cobalion', 'Terrakion', 'Virizion', 'Keldeo']],
  ['FORCES_OF_NATURE', groups.FORCES_OF_NATURE, ['Tornadus', 'Thundurus', 'Landorus', 'Enamorus']],
  ['TAO_TRIO', groups.TAO_TRIO, ['Reshiram', 'Zekrom', 'Kyurem']],
  ['AURA_TRIO', groups.AURA_TRIO, ['Xerneas', 'Yveltal', 'Zygarde']],
  ['GUARDIAN_DEITIES', groups.GUARDIAN_DEITIES, ['Tapu Koko', 'Tapu Lele', 'Tapu Bulu', 'Tapu Fini']],
  ['LIGHT_TRIO', groups.LIGHT_TRIO, ['Solgaleo', 'Lunala', 'Necrozma']],
  ['HERO_DUO', groups.HERO_DUO, ['Zacian', 'Zamazenta']],
  ['TREASURES_OF_RUIN', groups.TREASURES_OF_RUIN, ['Wo-Chien', 'Chien-Pao', 'Ting-Lu', 'Chi-Yu']],
  ['LOYAL_THREE', groups.LOYAL_THREE, ['Okidogi', 'Munkidori', 'Fezandipiti']],
  [
    'BOX_LEGENDARIES',
    groups.BOX_LEGENDARIES,
    ['Lugia', 'Ho-Oh', 'Kyogre', 'Groudon', 'Rayquaza', 'Dialga', 'Palkia', 'Giratina', 'Reshiram', 'Zekrom', 'Kyurem', 'Xerneas', 'Yveltal', 'Solgaleo', 'Lunala', 'Necrozma', 'Zacian', 'Zamazenta', 'Koraidon', 'Miraidon']
  ],
  ['PARADOX_ANCIENT', groups.PARADOX_ANCIENT, ['Great Tusk', 'Scream Tail', 'Brute Bonnet', 'Flutter Mane', 'Slither Wing', 'Sandy Shocks', 'Roaring Moon', 'Walking Wake', 'Gouging Fire', 'Raging Bolt']],
  ['PARADOX_FUTURE', groups.PARADOX_FUTURE, ['Iron Treads', 'Iron Bundle', 'Iron Hands', 'Iron Jugulis', 'Iron Moth', 'Iron Thorns', 'Iron Valiant', 'Iron Leaves', 'Iron Boulder', 'Iron Crown']],
  ['CLEFAIRY_LINE', groups.CLEFAIRY_LINE, ['Cleffa', 'Clefairy', 'Clefable']],
  ['SNORLAX_LINE', groups.SNORLAX_LINE, ['Munchlax', 'Snorlax']],
  ['SAFARI_ZONE_RARITIES', groups.SAFARI_ZONE_RARITIES, ['Chansey', 'Kangaskhan', 'Scyther', 'Pinsir', 'Tauros', 'Dratini']],
  [
    'EARLY_ROUTE_COMMONS',
    groups.EARLY_ROUTE_COMMONS,
    [
      'Caterpie', 'Weedle', 'Pidgey', 'Rattata', 'Spearow', 'Zubat', 'Magikarp', 'Sentret', 'Hoothoot', 'Ledyba', 'Spinarak', 'Poochyena', 'Zigzagoon', 'Wurmple', 'Starly', 'Bidoof',
      'Kricketot', 'Patrat', 'Lillipup', 'Pidove', 'Bunnelby', 'Fletchling', 'Scatterbug', 'Pikipek', 'Yungoos', 'Grubbin', 'Skwovet', 'Rookidee', 'Blipbug', 'Lechonk', 'Tarountula'
    ]
  ],
  ['EEVEE', [groups.EEVEE], ['Eevee']],
  ['PIKACHU', [groups.PIKACHU], ['Pikachu']],
  ['MAGIKARP', [groups.MAGIKARP], ['Magikarp']],
  ['MEW', [groups.MEW], ['Mew']],
  ['ALCREMIE', [groups.ALCREMIE], ['Alcremie']]
]

/** How many forms each form set must hold, and one name every member's full name contains (when there is one). */
const EXPECTED_FORM_SETS: Readonly<Record<string, { size: number; names?: string[] }>> = {
  unown: { size: 28, names: ['Unown'] },
  vivillon: { size: 18, names: ['Vivillon'] },
  'alcremie-creams': { size: 9, names: ['Alcremie'] },
  arceus: { size: 18, names: ['Arceus'] },
  silvally: { size: 18, names: ['Silvally'] },
  rotom: { size: 5, names: ['Rotom'] },
  deoxys: { size: 4, names: ['Deoxys'] },
  furfrou: { size: 9, names: ['Furfrou'] },
  flabebe: { size: 15, names: ['Flabébé', 'Floette', 'Florges'] },
  minior: { size: 7, names: ['Core Minior'] },
  oricorio: { size: 4, names: ['Oricorio'] },
  seasons: { size: 8, names: ['Deerling', 'Sawsbuck'] },
  cloaks: { size: 6, names: ['Burmy', 'Wormadam'] },
  sizes: { size: 8, names: ['Pumpkaboo', 'Gourgeist'] },
  seas: { size: 4, names: ['Shellos', 'Gastrodon'] },
  lycanroc: { size: 3, names: ['Lycanroc'] },
  squawkabilly: { size: 4, names: ['Squawkabilly'] },
  tatsugiri: { size: 3, names: ['Tatsugiri'] },
  ogerpon: { size: 4, names: ['Ogerpon'] },
  genesect: { size: 4, names: ['Genesect'] },
  therian: { size: 4, names: ['Therian'] },
  'pikachu-caps': { size: 8, names: ['Cap Pikachu'] },
  fusions: { size: 6, names: ['Kyurem', 'Necrozma', 'Calyrex'] }
}

describe('achievement groups (static)', () => {
  it('has no duplicates inside a list and unique keys', () => {
    for (const [name, ids] of EXPECTED_NAMES) expect(new Set(ids).size, name).toBe(ids.length)
    const keys = groups.FORM_SETS.map((set) => set.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(Object.keys(EXPECTED_FORM_SETS).sort()).toEqual([...keys].sort())
  })

  it('splits the Paradox Pokémon into two disjoint halves', () => {
    expect(groups.PARADOX_ANCIENT.filter((id) => groups.PARADOX_FUTURE.includes(id))).toEqual([])
  })

  it('names a region for generations 1 to 9 with unique keys', () => {
    expect(Object.keys(groups.GENERATION_REGIONS).map(Number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    const keys = Object.values(groups.GENERATION_REGIONS).map((region) => region.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe.skipIf(!raw)('achievement groups against the real dataset', () => {
  const dex = raw ? new Dex(validateDexIndex(raw)) : (undefined as never)
  const facts = raw ? dexFacts(dex) : (undefined as never)
  const tagIds = (tag: Parameters<typeof facts.byTag.get>[0]): number[] => (facts.byTag.get(tag) ?? []).map((item) => item.species)

  it('holds exactly the Pokémon each list says it holds', () => {
    for (const [name, ids, names] of EXPECTED_NAMES) {
      expect(ids.map((id) => dex.species(id)?.name), name).toEqual(names)
    }
  })

  it('keeps the legendary groups inside the Legendary tag and the lone species outside it', () => {
    const legendary = new Set(tagIds('legendary'))
    const legendLists = [
      groups.LEGENDARY_BIRDS, groups.LEGENDARY_BEASTS, groups.TOWER_DUO, groups.LEGENDARY_TITANS, groups.EON_DUO, groups.WEATHER_TRIO, groups.LAKE_GUARDIANS, groups.CREATION_TRIO,
      groups.FORCES_OF_NATURE, groups.TAO_TRIO, groups.AURA_TRIO, groups.GUARDIAN_DEITIES, groups.LIGHT_TRIO, groups.HERO_DUO, groups.TREASURES_OF_RUIN, groups.LOYAL_THREE, groups.BOX_LEGENDARIES
    ]
    for (const list of legendLists) for (const id of list) expect(legendary.has(id), dex.species(id)?.name).toBe(true)
    // Keldeo is Mythical; the other three Swords of Justice are Legendary.
    expect(groups.SWORDS_OF_JUSTICE.filter((id) => !legendary.has(id)).map((id) => dex.species(id)?.name)).toEqual(['Keldeo'])
    expect(tagIds('mythical')).toContain(groups.MEW)
    for (const id of groups.EARLY_ROUTE_COMMONS) expect(dex.species(id)?.tags, dex.species(id)?.name).toEqual([])
  })

  it('covers the Paradox tag exactly with the ancient and future lists', () => {
    expect([...groups.PARADOX_ANCIENT, ...groups.PARADOX_FUTURE].sort((a, b) => a - b)).toEqual(tagIds('paradox'))
    expect(groups.PARADOX_ANCIENT).toHaveLength(10)
    expect(groups.PARADOX_FUTURE).toHaveLength(10)
  })

  it('builds every form set at its known size from forms that exist', () => {
    for (const set of groups.FORM_SETS) {
      const items = facts.formSets.get(set.key) ?? []
      const expected = EXPECTED_FORM_SETS[set.key]!
      expect(items.length, set.key).toBe(expected.size)
      for (const item of items) {
        const form = dex.form(item.species, item.form ?? -1)
        expect(form, `${set.key}: ${item.label}`).toBeDefined()
        expect(['hidden', 'mega', 'battle'], `${set.key}: ${item.label}`).not.toContain(form?.cat)
        expect(item.label).toBe(form?.full)
        if (expected.names) expect(expected.names.some((name) => item.label.includes(name)), `${set.key}: ${item.label}`).toBe(true)
      }
      expect(new Set(items.map((item) => `${item.species}-${item.form}`)).size, set.key).toBe(items.length)
    }
  })

  it('derives the tag groups at their known sizes', () => {
    expect(tagIds('legendary').length).toBeGreaterThanOrEqual(71)
    expect(tagIds('mythical').length).toBeGreaterThanOrEqual(23)
    expect(tagIds('pseudo-legendary')).toEqual([149, 248, 373, 376, 445, 635, 706, 784, 887, 998])
    expect(tagIds('ultra-beast')).toHaveLength(11)
    expect(tagIds('fossil')).toHaveLength(25)
    expect(tagIds('baby')).toHaveLength(19)
    expect(tagIds('starter').length % 9).toBe(0)
  })

  it('finds three first partner Pokémon per generation, each the first stage of its line', () => {
    expect([...facts.startersByGeneration.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    for (const [gen, items] of facts.startersByGeneration) expect(items, `generation ${gen}`).toHaveLength(3)
    expect(facts.startersByGeneration.get(1)?.map((item) => item.label)).toEqual(['Bulbasaur', 'Charmander', 'Squirtle'])
    expect(facts.startersByGeneration.get(9)?.map((item) => item.label)).toEqual(['Sprigatito', 'Fuecoco', 'Quaxly'])
    expect(facts.starters).toHaveLength(27)
  })

  it('derives Eeveelutions, regional forms, Alcremie, gender pairs, Gigantamax and Mega sets', () => {
    expect(facts.eeveelutions.map((item) => item.label)).toEqual(['Eevee', 'Vaporeon', 'Jolteon', 'Flareon', 'Espeon', 'Umbreon', 'Leafeon', 'Glaceon', 'Sylveon'])
    expect(facts.regional.get('alola')).toHaveLength(18)
    expect(facts.regional.get('galar')).toHaveLength(19)
    expect(facts.regional.get('hisui')).toHaveLength(16)
    expect(facts.regional.get('paldea')).toHaveLength(4)
    for (const [region, word] of [['alola', 'Alolan'], ['galar', 'Galarian'], ['hisui', 'Hisuian'], ['paldea', 'Paldean']] as const) {
      for (const item of facts.regional.get(region) ?? []) expect(item.label).toContain(word)
    }

    expect(facts.alcremie).toHaveLength(63)
    expect(new Set(facts.alcremie.map((item) => `${item.form}:${item.variant}`)).size).toBe(63)
    expect(facts.alcremie[0]?.label).toBe('Vanilla Cream Alcremie · Strawberry Sweet')
    expect(facts.alcremie[62]?.label).toBe('Rainbow Swirl Alcremie · Ribbon Sweet')

    const paired = facts.genderPairs.map((item) => dex.species(item.species)!)
    expect(paired.filter((s) => !s.genderDiff).map((s) => s.name)).toEqual(['Meowstic', 'Indeedee', 'Basculegion', 'Oinkologne'])
    for (const species of paired) expect(species.genderRate > 0 && species.genderRate < 8, species.name).toBe(true)

    expect(facts.gmax).toHaveLength(34)
    expect(facts.gmax.find((item) => item.species === groups.ALCREMIE)?.label).toBe('Gigantamax Alcremie')
    expect(facts.megas.length).toBeGreaterThanOrEqual(48)
    for (const item of facts.megas) expect(/^(Mega|Primal) /.test(item.label), item.label).toBe(true)
  })

  it('lists only evolution families with two or more members', () => {
    for (const members of facts.families.values()) expect(members.length).toBeGreaterThan(1)
    expect(facts.families.size).toBeGreaterThan(300)
    expect(facts.speciesByName.get('pikachu')).toBe(25)
  })
})
