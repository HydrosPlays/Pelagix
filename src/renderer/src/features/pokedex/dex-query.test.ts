import { describe, expect, it } from 'vitest'
import type { TypeId } from '@shared/dex-types'
import { DEFAULT_RULES, type CatchEntry, type DexRules } from '@shared/save-types'
import { collectionFor, RULE_PRESETS } from '@renderer/domain/slots'
import { fixtureDex as dex, ID, makeEntry } from '@renderer/lib/test-fixture'
import {
  activeChips, availableIn, buildTiles, facetCounts, filterTiles, hasActiveFilters, NO_FILTERS, obtainGames, parseDexLink, romanNumeral, sortTiles, textMatcher, toggled, viewKeyOf,
  type DexDisplay, type DexFilters, type DexTile
} from './dex-query'

const TYPES: readonly TypeId[] = ['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy']
const SPECIES_ONLY = RULE_PRESETS.species.rules
const typeName = (type: TypeId): string => type.toUpperCase()

function setup(entries: CatchEntry[] = [], rules: DexRules = DEFAULT_RULES, display: DexDisplay = 'species') {
  const collection = collectionFor(dex, entries, rules)
  const tiles = buildTiles(dex, collection, display)
  const run = (filters: Partial<DexFilters> = {}, text = ''): DexTile[] => filterTiles(tiles, { dex, collection, display, text, filters: { ...NO_FILTERS, ...filters } })
  const ids = (list: readonly DexTile[]): number[] => list.map((tile) => tile.species.id)
  const keys = (list: readonly DexTile[]): string[] => list.map((tile) => tile.key)
  const tile = (key: string | number): DexTile => {
    const found = tiles.find((t) => t.key === String(key))
    if (!found) throw new Error(`no tile ${key}`)
    return found
  }
  return { collection, tiles, run, ids, keys, tile }
}

describe('buildTiles', () => {
  it('lists one tile per species in national dex order', () => {
    const { tiles } = setup()
    expect(tiles).toHaveLength(dex.speciesList.length)
    expect(tiles.map((t) => t.species.id)).toEqual(dex.speciesList.map((s) => s.id))
    expect(tiles.map((t) => t.order)).toEqual(tiles.map((_, i) => i))
    expect(new Set(tiles.map((t) => t.key)).size).toBe(tiles.length)
  })

  it('shows a species with its name, base types and default render', () => {
    const { tile } = setup()
    const pikachu = tile(ID.pikachu)
    expect(pikachu.label).toBe('Pikachu')
    expect(pikachu.types).toEqual(['electric'])
    expect(pikachu.sprite(false)).toBe('25.png')
    expect(pikachu.sprite(true)).toBe('shiny/25.png')
    expect(pikachu.slot).toBeUndefined()
    // Vivillon's base form is a pattern; the species tile still shows the species render.
    expect(tile(ID.vivillon).sprite(false)).toBe('666.png')
  })

  it('summarises the whole species: entries, games, shiny, newest entry and slot progress', () => {
    const entries = [
      makeEntry(ID.raichu, 0, { game: 'red', gender: 'm' }),
      makeEntry(ID.raichu, 1, { game: 'sun', shiny: true }),
      makeEntry(ID.raichu, 1, { game: 'sun' })
    ]
    const { tile, collection } = setup(entries)
    const raichu = tile(ID.raichu)
    expect(raichu.caught).toBe(true)
    expect(raichu.entries).toBe(3)
    expect(raichu.shiny).toBe(true)
    expect(raichu.games).toBe(2)
    expect(raichu.latest).toBe(entries[2]!.createdAt)
    expect(raichu.speciesSlots).toBe(collection.slotsBySpecies.get(ID.raichu)!.length)
    expect(raichu.speciesSlots).toBeGreaterThan(1)
    expect(raichu.slotsCaught).toBe(2)

    const pichu = tile(ID.pichu)
    expect(pichu).toMatchObject({ caught: false, entries: 0, shiny: false, games: 0, latest: '', slotsCaught: 0 })
  })

  it('lists one tile per Living Dex slot in forms display, with the slot label and render', () => {
    const { tiles, collection, tile } = setup([makeEntry(ID.raichu, 1)], DEFAULT_RULES, 'forms')
    expect(tiles.map((t) => t.key)).toEqual(collection.slots.map((s) => s.key))
    const alolan = tile('26-1')
    expect(alolan.label).toBe('Alolan Raichu')
    expect(alolan.form.f).toBe(1)
    expect(alolan.slot?.key).toBe('26-1')
    expect(alolan.types).toEqual(dex.form(ID.raichu, 1)!.types)
    expect(alolan.sprite(false)).toBe(collection.slotByKey.get('26-1')!.spritePath(false))
    expect(alolan).toMatchObject({ caught: true, entries: 1, slotsCaught: 1 })
    // The catch belongs to the Alolan slot only.
    expect(tiles.filter((t) => t.species.id === ID.raichu && t.caught).map((t) => t.key)).toEqual(['26-1'])
  })

  it('follows the rules: species-only rules give one slot per species', () => {
    const { tiles, tile } = setup([], SPECIES_ONLY, 'forms')
    expect(tiles).toHaveLength(dex.speciesList.length)
    expect(tile(ID.raichu).speciesSlots).toBe(1)
  })

  it('counts an entry the rules do not slot toward the base tile', () => {
    const { tile } = setup([makeEntry(ID.raichu, 1)], SPECIES_ONLY, 'forms')
    expect(tile(ID.raichu)).toMatchObject({ caught: true, entries: 1 })
  })

  it('ignores entries of unknown species and games it has never heard of', () => {
    const { tiles, tile } = setup([makeEntry(99999), makeEntry(ID.eevee, 0, { game: 'not-a-game' })])
    expect(tiles).toHaveLength(dex.speciesList.length)
    expect(tile(ID.eevee)).toMatchObject({ caught: true, entries: 1, games: 1 })
  })
})

describe('filterTiles', () => {
  it('returns everything, as a copy, when nothing narrows the list', () => {
    const { tiles, run } = setup()
    const all = run()
    expect(all).toEqual(tiles)
    expect(all).not.toBe(tiles)
    expect(hasActiveFilters(NO_FILTERS)).toBe(false)
  })

  it('filters by generation', () => {
    const { run, ids } = setup()
    const gen1 = ids(run({ gens: [1] }))
    expect(gen1).toEqual(dex.speciesList.filter((s) => s.gen === 1).map((s) => s.id))
    expect(ids(run({ gens: [1, 4] })).length).toBe(dex.speciesList.filter((s) => s.gen === 1 || s.gen === 4).length)
  })

  it('filters by type: any of them, or all of them on one form', () => {
    const { run, ids } = setup()
    expect(ids(run({ types: ['grass'] }))).toEqual(expect.arrayContaining([ID.bulbasaur, ID.ivysaur, ID.venusaur, ID.sprigatito]))
    expect(ids(run({ types: ['grass'] }))).not.toContain(ID.pikachu)
    const any = ids(run({ types: ['grass', 'electric'] }))
    expect(any).toEqual(expect.arrayContaining([ID.bulbasaur, ID.pikachu]))
    const both = ids(run({ types: ['grass', 'poison'], typeMatch: 'all' }))
    expect(both).toEqual(expect.arrayContaining([ID.bulbasaur, ID.venusaur]))
    expect(both).not.toContain(ID.sprigatito)
    expect(run({ types: ['grass', 'electric'], typeMatch: 'all' })).toEqual([])
  })

  it('lets a species tile answer for its regional forms, without mixing types across forms', () => {
    const { run, ids, tile } = setup()
    // Alolan Raichu is Electric / Psychic.
    expect(tile(ID.raichu).types).toEqual(['electric'])
    expect(ids(run({ types: ['psychic'] }))).toContain(ID.raichu)
    expect(ids(run({ types: ['electric', 'psychic'], typeMatch: 'all' }))).toContain(ID.raichu)
    // Arceus can be any type by plate, but a changeable form is not the species' type.
    expect(ids(run({ types: ['fire'] }))).not.toContain(ID.arceus)
  })

  it('matches the type of each slot in forms display', () => {
    const { run, keys } = setup([], DEFAULT_RULES, 'forms')
    const psychic = keys(run({ types: ['psychic'] }))
    expect(psychic).toContain('26-1')
    expect(psychic).not.toContain('26')
  })

  it('filters by status', () => {
    const entries = [
      makeEntry(ID.pikachu, 0, { game: 'red' }),
      makeEntry(ID.pikachu, 0, { game: 'scarlet', shiny: true }),
      makeEntry(ID.eevee, 0, { game: 'sword' }),
      makeEntry(ID.eevee, 0, { game: 'sword' })
    ]
    const { run, ids, tiles } = setup(entries)
    expect(ids(run({ status: 'caught' }))).toEqual([ID.pikachu, ID.eevee])
    expect(run({ status: 'missing' })).toHaveLength(tiles.length - 2)
    expect(ids(run({ status: 'shiny' }))).toEqual([ID.pikachu])
    expect(ids(run({ status: 'shiny-missing' }))).toContain(ID.eevee)
    expect(ids(run({ status: 'shiny-missing' }))).not.toContain(ID.pikachu)
    // Two entries from the same game are not "in 2+ games".
    expect(ids(run({ status: 'multi-game' }))).toEqual([ID.pikachu])
  })

  it('filters by category tag, any of the chosen ones', () => {
    const { run, ids } = setup()
    const tagged = (tag: string): number[] => dex.speciesList.filter((s) => (s.tags as string[]).includes(tag)).map((s) => s.id)
    expect(ids(run({ tags: ['legendary'] }))).toEqual(tagged('legendary'))
    expect(ids(run({ tags: ['legendary', 'mythical'] })).length).toBe(new Set([...tagged('legendary'), ...tagged('mythical')]).size)
  })

  it('keeps only species with more than one slot for "alternate forms"', () => {
    const { run, tiles } = setup()
    const multi = run({ altForms: true })
    expect(multi.length).toBeGreaterThan(0)
    expect(multi.every((t) => t.speciesSlots > 1)).toBe(true)
    expect(multi.length).toBe(tiles.filter((t) => t.speciesSlots > 1).length)
    expect(setup([], SPECIES_ONLY).run({ altForms: true })).toEqual([])
  })

  it('filters by what can be obtained in a game', () => {
    const { run, tiles } = setup()
    const game = 'scarlet'
    const inGame = run({ game })
    expect(inGame.length).toBeGreaterThan(0)
    expect(inGame.length).toBeLessThan(tiles.length)
    for (const tile of inGame) expect(tile.targets.some((t) => dex.isObtainable(t.form, game))).toBe(true)
    for (const tile of tiles.filter((t) => !inGame.includes(t))) expect(tile.targets.some((t) => dex.isObtainable(t.form, game))).toBe(false)
    // Event-only sources join when asked for, and never remove anything.
    const withEvents = run({ game, gameEvents: true })
    expect(withEvents.length).toBeGreaterThanOrEqual(inGame.length)
    for (const tile of inGame) expect(withEvents).toContain(tile)
  })

  it('narrows a game to what is still missing, slot by slot', () => {
    const game = 'scarlet'
    const base = setup()
    const target = base.run({ game }).find((t) => t.targets.length === 1)!
    expect(target).toBeDefined()
    const one = setup([makeEntry(target.species.id, target.form.f, { game })])
    expect(one.ids(one.run({ game }))).toContain(target.species.id)
    expect(one.ids(one.run({ game, gameMissing: true }))).not.toContain(target.species.id)
    expect(one.run({ game, gameMissing: true })).toHaveLength(base.run({ game }).length - 1)

    // A species with several slots stays until every slot that the game offers is caught.
    const multi = base.run({ game }).find((t) => t.targets.filter((x) => availableIn(dex, x.form, game, false)).length > 1)
    if (multi) {
      const first = multi.targets.find((x) => availableIn(dex, x.form, game, false))!
      const slot = base.collection.slotByKey.get(first.key)!
      const partly = setup([makeEntry(slot.species, slot.form, { game, gender: slot.gender, variant: slot.variant })])
      expect(partly.collection.caught.has(first.key)).toBe(true)
      expect(partly.ids(partly.run({ game, gameMissing: true }))).toContain(multi.species.id)
    }
  })

  it('returns nothing for a game the dataset does not know', () => {
    expect(setup().run({ game: 'not-a-game' })).toEqual([])
  })

  it('combines filters', () => {
    const { run, ids } = setup([makeEntry(ID.bulbasaur)])
    expect(ids(run({ gens: [1], types: ['grass'], status: 'caught' }))).toEqual([ID.bulbasaur])
    expect(ids(run({ gens: [1], types: ['grass'], status: 'missing' }))).toEqual([ID.ivysaur, ID.venusaur])
    expect(run({ gens: [2], types: ['grass'], status: 'caught' })).toEqual([])
  })
})

describe('text search', () => {
  it('finds species by name, accent-insensitively, and by number', () => {
    const { run, ids } = setup()
    expect(ids(run({}, 'pika'))).toEqual([ID.pikachu])
    expect(ids(run({}, 'PIKACHU'))).toEqual([ID.pikachu])
    expect(ids(run({}, '25'))).toContain(ID.pikachu)
    expect(ids(run({}, '#0025'))).toEqual([ID.pikachu])
    expect(run({}, 'zzzzzz')).toEqual([])
  })

  it('finds a species through the name of one of its forms', () => {
    const { run, ids } = setup()
    expect(ids(run({}, 'alolan'))).toContain(ID.raichu)
  })

  it('ignores blank text', () => {
    const { run, tiles, collection } = setup()
    expect(run({}, '   ')).toHaveLength(tiles.length)
    expect(textMatcher(dex, collection, 'species', '  ')).toBeNull()
  })

  it('keeps national dex order whatever the match quality', () => {
    const { run, ids } = setup()
    const found = ids(run({}, 'a'))
    expect(found).toEqual([...found].sort((a, b) => a - b))
  })

  it('matches individual forms in forms display', () => {
    const { run, keys } = setup([], DEFAULT_RULES, 'forms')
    const alolan = keys(run({}, 'alolan raichu'))
    expect(alolan).toEqual(['26-1'])
    // The species name brings every slot of the species.
    const all = keys(run({}, 'raichu'))
    expect(all).toContain('26-1')
    expect(all.filter((k) => k.startsWith('26')).length).toBeGreaterThan(1)
  })

  it('puts a hit on a form without its own slot on the base slot', () => {
    const { run, keys } = setup([], SPECIES_ONLY, 'forms')
    expect(keys(run({}, 'alolan raichu'))).toEqual(['26'])
  })

  it('matches words that only the slot label carries', () => {
    const rules: DexRules = { ...DEFAULT_RULES, gmax: true }
    const { run, tiles } = setup([], rules, 'forms')
    const gmax = tiles.filter((t) => t.slot?.gmax)
    expect(gmax.length).toBeGreaterThan(0)
    expect(run({}, 'gigantamax').map((t) => t.key)).toEqual(gmax.map((t) => t.key))
  })

  it('combines with filters', () => {
    const { run, ids } = setup()
    expect(ids(run({ types: ['grass'] }, 'saur'))).toEqual([ID.bulbasaur, ID.ivysaur, ID.venusaur])
    expect(run({ types: ['fire'] }, 'saur')).toEqual([])
  })
})

describe('sortTiles', () => {
  const entries = [
    makeEntry(ID.venusaur),
    makeEntry(ID.pikachu),
    makeEntry(ID.pikachu),
    makeEntry(ID.pikachu),
    makeEntry(ID.bulbasaur),
    makeEntry(ID.bulbasaur)
  ]

  it('sorts by dex number without touching the input', () => {
    const { tiles } = setup(entries)
    const shuffled = [...tiles].reverse()
    expect(sortTiles(shuffled, 'number')).toEqual(tiles)
    expect(shuffled[0]).toBe(tiles[tiles.length - 1])
  })

  it('sorts by name', () => {
    const { tiles } = setup()
    const names = sortTiles(tiles, 'name').map((t) => t.label)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })))
    expect(names[0]).toBe('Alcremie')
  })

  it('sorts by most entries, then dex number', () => {
    const { tiles } = setup(entries)
    const sorted = sortTiles(tiles, 'entries')
    expect(sorted.slice(0, 3).map((t) => t.species.id)).toEqual([ID.pikachu, ID.bulbasaur, ID.venusaur])
    const rest = sorted.slice(3).map((t) => t.order)
    expect(rest).toEqual([...rest].sort((a, b) => a - b))
  })

  it('sorts by most recently logged, with never-logged Pokémon last in dex order', () => {
    const { tiles } = setup(entries)
    const sorted = sortTiles(tiles, 'recent')
    expect(sorted.slice(0, 3).map((t) => t.species.id)).toEqual([ID.bulbasaur, ID.pikachu, ID.venusaur])
    const rest = sorted.slice(3).map((t) => t.order)
    expect(rest).toEqual([...rest].sort((a, b) => a - b))
  })
})

describe('viewKeyOf', () => {
  it('changes exactly when the ordered result does', () => {
    const { tiles } = setup()
    expect(viewKeyOf(tiles)).toBe(viewKeyOf([...tiles]))
    expect(viewKeyOf(tiles)).not.toBe(viewKeyOf([...tiles].reverse()))
    expect(viewKeyOf(tiles)).not.toBe(viewKeyOf(tiles.slice(1)))
    expect(viewKeyOf([])).toBe('')
    // The same list with different collection state is the same view.
    expect(viewKeyOf(setup([makeEntry(ID.pikachu)]).tiles)).toBe(viewKeyOf(tiles))
  })
})

describe('pickers', () => {
  it('offers only games that have a source of something', () => {
    const games = obtainGames(dex)
    expect(games.length).toBeGreaterThan(0)
    for (const game of games) {
      const some = dex.speciesList.some((s) => s.forms.some((f) => availableIn(dex, f, game.id, true)))
      expect(some).toBe(true)
    }
    expect(games.map((g) => g.id)).toEqual(dex.games.filter((g) => games.includes(g)).map((g) => g.id))
  })

  it('counts species per generation, base type and tag', () => {
    const counts = facetCounts(dex)
    expect([...counts.gens.values()].reduce((a, b) => a + b, 0)).toBe(dex.speciesList.length)
    expect(counts.gens.get(1)).toBe(dex.speciesList.filter((s) => s.gen === 1).length)
    expect(counts.types.get('grass')).toBe(dex.speciesList.filter((s) => s.forms[0]!.types.includes('grass')).length)
    expect(facetCounts(dex)).toBe(counts)
  })

  it('toggles list values and keeps the given order', () => {
    expect(toggled([1, 3], 2, [1, 2, 3])).toEqual([1, 2, 3])
    expect(toggled([1, 2, 3], 2, [1, 2, 3])).toEqual([1, 3])
    expect(toggled(['b'], 'a')).toEqual(['b', 'a'])
  })

  it('writes roman numerals', () => {
    expect([1, 4, 9].map(romanNumeral)).toEqual(['I', 'IV', 'IX'])
    expect(romanNumeral(40)).toBe('40')
  })
})

describe('activeChips', () => {
  const full: DexFilters = { gens: [1, 3], types: ['fire', 'flying'], typeMatch: 'all', status: 'shiny', game: 'scarlet', gameEvents: true, gameMissing: true, tags: ['legendary'], altForms: true }

  it('is empty when nothing is active', () => {
    expect(activeChips('  ', NO_FILTERS, typeName)).toEqual([])
  })

  it('lists one chip per condition, in toolbar order', () => {
    const chips = activeChips(' char ', full, typeName)
    expect(chips.map((c) => c.id)).toEqual(['text', 'gen-1', 'gen-3', 'type-fire', 'type-flying', 'type-match', 'status', 'game', 'game-missing', 'game-events', 'tag-legendary', 'alt-forms'])
    expect(chips.map((c) => c.label)).toEqual(['“char”', 'Generation I', 'Generation III', 'FIRE', 'FLYING', 'Has every type', 'Shiny caught', 'In Scarlet', 'Not yet caught', 'Events included', 'Legendary', 'Alternate forms'])
    expect(new Set(chips.map((c) => c.id)).size).toBe(chips.length)
  })

  it('only mentions "every type" when it changes the result', () => {
    expect(activeChips('', { ...NO_FILTERS, types: ['fire'], typeMatch: 'all' }, typeName).map((c) => c.id)).toEqual(['type-fire'])
  })

  it('removes exactly its own condition', () => {
    const state = { text: 'char', filters: full }
    const by = (id: string) => activeChips(state.text, state.filters, typeName).find((c) => c.id === id)!.remove(state)
    expect(by('text')).toEqual({ text: '', filters: full })
    expect(by('gen-1').filters).toEqual({ ...full, gens: [3] })
    expect(by('type-fire').filters).toEqual({ ...full, types: ['flying'] })
    expect(by('type-match').filters).toEqual({ ...full, typeMatch: 'any' })
    expect(by('status').filters).toEqual({ ...full, status: 'all' })
    expect(by('game-events').filters).toEqual({ ...full, gameEvents: false })
    expect(by('game-missing').filters).toEqual({ ...full, gameMissing: false })
    // Removing the game takes its options with it.
    expect(by('game').filters).toEqual({ ...full, game: null, gameEvents: false, gameMissing: false })
    expect(by('tag-legendary').filters).toEqual({ ...full, tags: [] })
    expect(by('alt-forms').filters).toEqual({ ...full, altForms: false })
    expect(by('gen-1').text).toBe('char')
  })

  it('names an unknown game without showing its id', () => {
    const [chip] = activeChips('', { ...NO_FILTERS, game: 'not-a-game' }, typeName)
    expect(chip!.label).toBe('In an unknown game')
  })
})

describe('parseDexLink', () => {
  it('returns null when the query sets nothing', () => {
    expect(parseDexLink('', TYPES)).toBeNull()
    expect(parseDexLink('foo=bar&gen=0&type=plastic&status=nope&game=not-a-game&view=list&sort=size', TYPES)).toBeNull()
  })

  it('reads every supported key', () => {
    expect(parseDexLink('q=%20char%20&gen=3,1,1,12&type=fire,flying,nope&match=all&status=missing&tag=legendary,starter&game=scarlet&events=1&missing=1&forms=1&view=forms&sort=name', TYPES)).toEqual({
      text: 'char',
      filters: { gens: [1, 3], types: ['fire', 'flying'], typeMatch: 'all', status: 'missing', tags: ['legendary', 'starter'], game: 'scarlet', gameEvents: true, gameMissing: true, altForms: true },
      display: 'forms',
      sort: 'name'
    })
  })

  it('leaves the game options off unless asked for', () => {
    expect(parseDexLink('game=scarlet', TYPES)).toEqual({ filters: { game: 'scarlet', gameEvents: false, gameMissing: false } })
    expect(parseDexLink('missing=1', TYPES)).toBeNull()
  })

  it('accepts a view or sort on its own', () => {
    expect(parseDexLink('view=species', TYPES)).toEqual({ display: 'species' })
    expect(parseDexLink('sort=recent', TYPES)).toEqual({ sort: 'recent' })
  })
})
