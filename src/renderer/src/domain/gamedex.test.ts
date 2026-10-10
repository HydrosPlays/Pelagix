import { describe, expect, it } from 'vitest'
import { GAME_BY_ID } from '@shared/games'
import { GAME_POKEDEXES, POKEDEX_NAMES, pokedexesOfGame } from '@shared/pokedexes'
import { DEFAULT_RULES, type DexRules } from '@shared/save-types'
import { boxIndexAt, boxMetrics, boxName, boxRange, buildBoxes, computeStats, filledIn, layoutBoxes, layoutList, listMetrics, generationSpans } from '@renderer/features/living/model'
import { fixtureDex as dex, ID, makeEntry } from '@renderer/lib/test-fixture'
import { arrange, fetchPokedexes, gameCollection, gameSlots, NO_POKEDEXES, OTHER_SECTION, parseGameChoice, parsePokedexes, planSections, sectionsOf, type Pokedexes } from './gamedex'
import { boxMarkTargets, computeHomeDex } from './home'
import { collectionFor, RULE_KEYS } from './slots'

const NONE = Object.fromEntries(RULE_KEYS.map((key) => [key, false])) as unknown as DexRules

// The real dataset file, as the app loads it.
const realFiles = import.meta.glob<unknown>('../../public/data/pokedexes.json', { eager: true, import: 'default' })
const real = parsePokedexes(Object.values(realFiles)[0])

/** Sword in the fixture: Venusaur and Pikachu are in two of its Pokédexes, Zacian is a Sword exclusive. */
const POKEDEXES: Pokedexes = new Map<string, number[]>([
  ['galar', [ID.milcery, ID.alcremie, ID.zacian, ID.pikachu, ID.venusaur]],
  ['isle-of-armor', [ID.bulbasaur, ID.ivysaur, ID.venusaur, ID.pikachu]],
  ['crown-tundra', [ID.mewtwo, ID.sprigatito]],
  ['paldea', [ID.sprigatito, ID.floragato, ID.meowscarada, ID.vivillon, ID.alcremie, ID.rotom]]
])

const species = (slots: readonly { species: number }[]): number[] => slots.map((slot) => slot.species)

describe('the game table', () => {
  it('names only known games, and Pokédexes that the data file and the display names have', () => {
    for (const [game, names] of Object.entries(GAME_POKEDEXES)) {
      expect(GAME_BY_ID.has(game), game).toBe(true)
      expect(names.length, game).toBeGreaterThan(0)
      for (const name of names) {
        expect(real.has(name), `${game}: ${name}`).toBe(true)
        expect(POKEDEX_NAMES[name], name).toBeTruthy()
      }
    }
  })

  it('splits the games with several Pokédexes, in order', () => {
    expect(pokedexesOfGame('legendsza')).toEqual(['lumiose-city', 'hyperspace'])
    expect(pokedexesOfGame('sword')).toEqual(['galar', 'isle-of-armor', 'crown-tundra'])
    expect(pokedexesOfGame('shield')).toEqual(pokedexesOfGame('sword'))
    expect(pokedexesOfGame('scarlet')).toEqual(['paldea', 'kitakami', 'blueberry'])
    expect(pokedexesOfGame('x')).toEqual(['kalos-central', 'kalos-coastal', 'kalos-mountain'])
    expect(pokedexesOfGame('platinum')).toEqual(['extended-sinnoh'])
  })

  it('gives the games without a Pokédex none', () => {
    for (const game of ['colosseum', 'xd', 'stadium', 'stadium2', 'boxrubysapphire', 'go', 'home', 'constructor', 'no-such-game']) expect(pokedexesOfGame(game)).toEqual([])
  })
})

describe('pokedexes.json', () => {
  it('holds the 32 regional Pokédexes in regional order', () => {
    expect(real.size).toBe(32)
    expect(real.get('lumiose-city')).toHaveLength(232)
    expect(real.get('hyperspace')).toHaveLength(132)
    expect(real.get('kanto')?.slice(0, 3)).toEqual([1, 2, 3])
    expect(real.get('galar')?.slice(0, 3)).toEqual([810, 811, 812])
    // Victini is No. 000 of the Unova Pokédex.
    expect(real.get('original-unova')?.[0]).toBe(494)
  })

  it('rejects anything that is not the file', () => {
    expect(() => parsePokedexes(null)).toThrow(/pokedexes/)
    expect(() => parsePokedexes({ pokedexes: [] })).toThrow(/pokedexes/)
    expect(() => parsePokedexes({ pokedexes: { galar: [1, 'x'] } })).toThrow(/galar/)
    expect(parsePokedexes({ v: 1, pokedexes: { galar: [810, 811] } }).get('galar')).toEqual([810, 811])
  })

  it('loads through fetch, and falls back to no Pokédexes when the file is missing or broken', async () => {
    const ok = (async () => ({ ok: true, json: async () => ({ v: 1, pokedexes: { hisui: [722] } }) })) as unknown as typeof fetch
    expect((await fetchPokedexes(ok)).get('hisui')).toEqual([722])
    const missing = (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch
    expect(await fetchPokedexes(missing)).toBe(NO_POKEDEXES)
    const broken = (async () => ({ ok: true, json: async () => ({ pokedexes: 3 }) })) as unknown as typeof fetch
    expect(await fetchPokedexes(broken)).toBe(NO_POKEDEXES)
    const failing = (async () => Promise.reject(new Error('offline'))) as unknown as typeof fetch
    expect(await fetchPokedexes(failing)).toBe(NO_POKEDEXES)
  })
})

describe('sections of a game', () => {
  it('puts a species listed in two Pokédexes of one game in the first only', () => {
    const plan = planSections('sword', POKEDEXES)
    expect(plan?.sections.map((s) => s.id)).toEqual(['galar', 'isle-of-armor', 'crown-tundra', OTHER_SECTION])
    expect(plan?.placeOf.get(ID.venusaur)).toEqual({ section: 0, rank: 4 })
    expect(plan?.placeOf.get(ID.pikachu)).toEqual({ section: 0, rank: 3 })
    expect(plan?.placeOf.get(ID.bulbasaur)).toEqual({ section: 1, rank: 0 })
  })

  it('has no plan for a game without a Pokédex, or without the data', () => {
    expect(planSections('go', POKEDEXES)).toBeNull()
    expect(planSections('sword', NO_POKEDEXES)).toBeNull()
  })

  it('orders each Pokédex section regionally, the rest nationally, and drops empty sections', () => {
    const plan = planSections('sword', POKEDEXES)
    if (!plan) throw new Error('no plan')
    const { items, sections } = arrange([1, 2, 3, 25, 26, 133, 868, 869, 888], (n) => n, plan)
    expect(items).toEqual([868, 869, 888, 25, 3, 1, 2, 26, 133])
    expect(sections).toEqual([
      { id: 'galar', title: 'Galar Pokédex', start: 0, count: 5 },
      { id: 'isle-of-armor', title: 'Isle of Armor Pokédex', start: 5, count: 2 },
      { id: OTHER_SECTION, title: 'Other Pokémon obtainable in Sword', start: 7, count: 2 }
    ])
  })
})

describe('the slots of a game', () => {
  const base = collectionFor(dex, [], NONE)

  it('shows only what is obtainable in the game, in its Pokédex order', () => {
    const sword = gameSlots(dex, POKEDEXES, base, 'sword')
    expect(species(sword.slots)).toEqual([868, 869, 888, 25, 3, 1, 2, 150, 26, 133, 172, 479, 646, 677, 678])
    expect(sword.sections.map((s) => [s.id, s.start, s.count])).toEqual([
      ['galar', 0, 5],
      ['isle-of-armor', 5, 2],
      ['crown-tundra', 7, 1],
      [OTHER_SECTION, 8, 7]
    ])
    expect(sectionsOf(sword.slots)).toBe(sword.sections)
    // Sprigatito is in the Crown Tundra list here but cannot be obtained in Sword.
    expect(species(sword.slots)).not.toContain(ID.sprigatito)
  })

  it('leaves the other version’s exclusives out although the Pokédex lists them', () => {
    expect(species(gameSlots(dex, POKEDEXES, base, 'shield').slots)).not.toContain(ID.zacian)
    expect(species(gameSlots(dex, POKEDEXES, base, 'sword').slots)).toContain(ID.zacian)
  })

  it('keeps a game without a Pokédex in National order, without sections', () => {
    const go = gameSlots(dex, POKEDEXES, base, 'go')
    expect(go.sections).toEqual([])
    expect(sectionsOf(go.slots)).toEqual([])
    expect(species(go.slots)).toEqual([...species(go.slots)].sort((a, b) => a - b))
    expect(species(go.slots)).toContain(ID.unown)
    expect(species(go.slots)).not.toContain(ID.rotom)
  })

  it('follows the rules: forms get their slots, and only the forms the game has', () => {
    const forms = collectionFor(dex, [], DEFAULT_RULES)
    const sword = gameSlots(dex, POKEDEXES, forms, 'sword').slots.map((slot) => slot.key)
    const scarlet = gameSlots(dex, POKEDEXES, forms, 'scarlet').slots.map((slot) => slot.key)
    // Alolan Raichu can be had in Sword, not in Scarlet.
    expect(sword).toContain('26-1')
    expect(scarlet.some((key) => key === '26' || key.startsWith('26:'))).toBe(true)
    expect(scarlet).not.toContain('26-1')
    expect(gameSlots(dex, POKEDEXES, forms, 'sword').slots.length).toBeGreaterThan(gameSlots(dex, POKEDEXES, base, 'sword').slots.length)
  })

  it('returns the same list for the same arguments', () => {
    expect(gameSlots(dex, POKEDEXES, base, 'sword')).toBe(gameSlots(dex, POKEDEXES, base, 'sword'))
    expect(gameSlots(dex, POKEDEXES, base, 'sword').slots).not.toBe(gameSlots(dex, NO_POKEDEXES, base, 'sword').slots)
  })
})

describe('the collection of a game', () => {
  const entries = [
    makeEntry(ID.bulbasaur, 0, { game: 'sword', inHome: true }),
    makeEntry(ID.bulbasaur, 0, { game: 'scarlet' }),
    makeEntry(ID.ivysaur, 0, { game: 'sword' }),
    makeEntry(ID.venusaur, 0, { game: 'scarlet', inHome: true }),
    makeEntry(ID.pikachu, 0, { game: 'sword', shiny: true }),
    makeEntry(ID.pikachu, 0, { game: 'sword' }),
    makeEntry(ID.sprigatito, 0, { game: 'scarlet' })
  ]
  const base = collectionFor(dex, entries, NONE)
  const sword = gameCollection(dex, POKEDEXES, base, 'sword').collection

  it('counts a slot as caught only when an entry obtained in that game fills it', () => {
    expect([...sword.caught].sort()).toEqual(['1', '2', '25'])
    // Venusaur was caught, but in Scarlet.
    expect(base.caught.has('3')).toBe(true)
    expect(sword.caught.has('3')).toBe(false)
    expect(sword.bySlot.get('1')?.map((entry) => entry.game)).toEqual(['sword'])
    expect(sword.slotOfEntry.size).toBe(4)
  })

  it('totals the shown set', () => {
    expect(sword.totals).toEqual({ slots: 15, caught: 3, shiny: 1, species: 15, speciesCaught: 3 })
    const stats = computeStats(dex, sword.slots, filledIn(sword, 'normal'))
    expect(stats).toMatchObject({ slots: 15, filled: 3 })
    expect(stats.sections).toEqual([
      { slots: 5, filled: 1 },
      { slots: 2, filled: 2 },
      { slots: 1, filled: 0 },
      { slots: 7, filled: 0 }
    ])
  })

  it('applies shiny mode inside the game', () => {
    expect([...filledIn(sword, 'shiny')]).toEqual(['25'])
    const scarlet = gameCollection(dex, POKEDEXES, base, 'scarlet').collection
    expect(filledIn(scarlet, 'shiny').size).toBe(0)
    expect(computeStats(dex, sword.slots, filledIn(sword, 'shiny')).sections[0]).toEqual({ slots: 5, filled: 1 })
  })

  it('gives the HOME Dex its states from entries of that game only', () => {
    const home = computeHomeDex(sword, false)
    expect(home.states.get('1')).toBe('home')
    expect(home.states.get('2')).toBe('pending')
    // In HOME, but obtained in Scarlet: not caught as far as Sword goes.
    expect(home.states.get('3')).toBe('missing')
    expect(home.states.get('25')).toBe('pending')
    expect(home.totals).toEqual({ slots: 15, inHome: 1, pending: 2, missing: 12 })
    expect(computeHomeDex(sword, true).totals).toEqual({ slots: 15, inHome: 0, pending: 1, missing: 14 })
  })

  it('offers "Mark box" only entries obtained in the game', () => {
    const boxes = buildBoxes(sword.slots)
    const targets = boxes.flatMap((box) => boxMarkTargets(sword, box.slots, false))
    expect(targets.map((entry) => [entry.species, entry.game])).toEqual([
      [ID.pikachu, 'sword'],
      [ID.ivysaur, 'sword']
    ])
    // The Scarlet Bulbasaur shares a slot with the Sword one and is never offered.
    const all = boxes.flatMap((box) => boxMarkTargets(base, box.slots, false))
    expect(all.some((entry) => entry.game === 'scarlet')).toBe(false)
    expect(boxMarkTargets(sword, sword.slots, true).map((entry) => entry.shiny)).toEqual([true])
  })

  it('has nothing caught in a game without entries, and nothing to show in a game without Pokémon', () => {
    const go = gameCollection(dex, POKEDEXES, base, 'go').collection
    expect(go.slots.length).toBeGreaterThan(0)
    expect(go.caught.size).toBe(0)
    expect(computeHomeDex(go, false).totals).toMatchObject({ inHome: 0, pending: 0 })
    expect(gameCollection(dex, POKEDEXES, base, 'stadium').collection.slots).toEqual([])
  })
})

describe('boxes of a game view', () => {
  const forms = collectionFor(dex, [], DEFAULT_RULES)
  const scarlet = gameSlots(dex, POKEDEXES, forms, 'scarlet')
  const boxes = buildBoxes(scarlet.slots)

  it('starts a new box with every section and numbers the boxes from 1 in each', () => {
    const paldea = scarlet.sections[0]
    if (!paldea) throw new Error('no section')
    expect(paldea.count).toBeGreaterThan(30)
    const own = boxes.filter((box) => box.section === 0)
    expect(own.map((box) => box.no)).toEqual(own.map((_, i) => i + 1))
    expect(own.reduce((n, box) => n + box.slots.length, 0)).toBe(paldea.count)
    expect(own[0]?.positions).toEqual([1, 30])
    expect(boxRange(own[1] ?? { firstDex: 0, lastDex: 0 })).toBe(`31 – ${Math.min(60, paldea.count)}`)
    const next = boxes.find((box) => box.section === 1)
    expect(next).toMatchObject({ no: 1, start: paldea.count, sectionTitle: 'Other Pokémon obtainable in Scarlet' })
    expect(boxName(own[1] ?? { no: 0 })).toBe('Box 2 of the Paldea Pokédex')
    expect(boxName(next ?? { no: 0 })).toBe('Box 1 of the other Pokémon obtainable in Scarlet')
    expect(boxIndexAt(boxes, paldea.count)).toBe(next?.index)
    expect(boxIndexAt(boxes, -1)).toBe(-1)
    expect(boxIndexAt(boxes, scarlet.slots.length)).toBe(-1)
  })

  it('keeps the plain numbering without sections', () => {
    const plain = buildBoxes(forms.slots)
    expect(plain.map((box) => box.no)).toEqual(plain.map((_, i) => i + 1))
    expect(plain.every((box) => box.section === -1 && box.sectionTitle === undefined && box.start === box.index * 30)).toBe(true)
    expect(boxName(plain[2] ?? { no: 0 })).toBe('Box 3')
  })

  it('lays the sections out under their headings, in both views', () => {
    const layout = layoutBoxes(scarlet.slots, boxMetrics(1200))
    expect(layout.rows.filter((row) => row.kind === 'section').map((row) => row.key)).toEqual(['section-paldea', 'section-other'])
    expect(layout.rows[0]?.kind).toBe('section')
    // No row of boxes mixes two sections.
    for (const row of layout.rows) if (row.kind === 'boxes') expect(new Set(row.boxes.map((box) => box.section)).size).toBe(1)
    expect(layout.order).toHaveLength(scarlet.slots.length)

    const list = layoutList(scarlet.slots, generationSpans(dex, scarlet.slots), listMetrics(800))
    expect(list.rows.filter((row) => row.kind !== 'slots').map((row) => row.kind)).toEqual(['section', 'section'])
    expect(list.order).toEqual(scarlet.slots.map((_, i) => i))
  })
})

describe('the stored game choice', () => {
  it('accepts a known game and nothing else', () => {
    expect(parseGameChoice({ game: 'sword' })).toBe('sword')
    expect(parseGameChoice({ game: 'no-such-game' })).toBeNull()
    expect(parseGameChoice({ game: null })).toBeNull()
    expect(parseGameChoice('sword')).toBeNull()
    expect(parseGameChoice(null)).toBeNull()
  })
})
