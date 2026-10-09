import { describe, expect, it } from 'vitest'
import type { FamilyNode } from '@shared/dex-types'
import { GAMES } from '@shared/games'
import { sourcesByGame } from '@renderer/domain/encounters'
import { checkEntry } from '@renderer/lib/storage'
import { fixtureDetails, fixtureDex as dex, ID } from '@renderer/lib/test-fixture'
import {
  breedParents,
  breedPreset,
  buildFamilyTree,
  buildSourceView,
  changeText,
  defaultGameId,
  evolvePreset,
  familyHasEvolutions,
  filterBlocks,
  formatHeight,
  formatWeight,
  gameOverview,
  gameState,
  genderSplit,
  initialBlockCount,
  isBattleOnly,
  manualPreset,
  overviewSummary,
  regionalNumbers,
  rowPreset,
  SECTION_ORDER,
  type SourceBlock
} from './sources'

const detail = (id: number) => fixtureDetails.get(id)!
const species = (id: number) => dex.species(id)!
const form = (id: number, f = 0) => dex.form(id, f)!
const inGame = (id: number, f: number, game: string) => {
  const found = sourcesByGame(dex, detail(id), form(id, f)).find((s) => s.game.id === game)
  if (!found) throw new Error(`${id}-${f} has no sources in ${game}`)
  return found
}
const NOW = '2026-10-09T00:00:00.000Z'

describe('gameState / gameOverview', () => {
  it('agrees with the Dex for every game of a form', () => {
    const pikachu = form(ID.pikachu)
    for (const game of GAMES) {
      const state = gameState(dex, pikachu, game.id)
      expect(state === 'obtainable').toBe(dex.isObtainable(pikachu, game.id))
      if (state === 'event') expect(dex.isEventOnly(pikachu, game.id)).toBe(true)
      if (state === 'absent') expect(dex.isPresent(pikachu, game.id)).toBe(false)
    }
  })

  it('lists every game once, in canonical order, grouped by generation', () => {
    const overview = gameOverview(dex, form(ID.pikachu))
    const flat = overview.groups.flatMap((g) => g.games.map((x) => x.game.id))
    expect(flat).toEqual(GAMES.map((g) => g.id))
    expect(overview.groups[0]!.label).toBe('Generation I')
    expect(overview.groups[overview.groups.length - 1]!.label).toBe('Other')
    const total = Object.values(overview.counts).reduce((a, b) => a + b, 0)
    expect(total).toBe(GAMES.length)
  })

  it('summarises the counts in one line', () => {
    expect(overviewSummary({ obtainable: 23, event: 0, transfer: 0, absent: 5 })).toBe('Obtainable in 23 games')
    expect(overviewSummary({ obtainable: 1, event: 2, transfer: 3, absent: 0 })).toBe('Obtainable in 1 game · event only in 2 · transfer only in 3')
    expect(overviewSummary({ obtainable: 0, event: 4, transfer: 0, absent: 0 })).toBe('Event only in 4')
    expect(overviewSummary({ obtainable: 0, event: 0, transfer: 0, absent: 9 })).toBe('Not obtainable in any game')
    expect(overviewSummary({ obtainable: 0, event: 0, transfer: 11, absent: 9 }, true)).toBe('Seen in battle in 11 games')
  })

  it('knows battle-only categories', () => {
    expect(isBattleOnly({ cat: 'mega' })).toBe(true)
    expect(isBattleOnly({ cat: 'battle' })).toBe(true)
    expect(isBattleOnly({ cat: 'regional' })).toBe(false)
  })
})

describe('defaultGameId', () => {
  const pikachu = form(ID.pikachu)
  const firstObtainable = dex.obtainableGames(pikachu)[0]!.id
  // A game the form cannot be obtained in (the fixture has it present everywhere, so: transfer only).
  const notHere = GAMES.find((g) => !dex.isObtainable(pikachu, g.id) && !dex.isEventOnly(pikachu, g.id))!.id

  it('starts with the first obtainable game', () => {
    expect(defaultGameId(dex, pikachu, null, [])).toBe(firstObtainable)
  })

  it('keeps the game picked earlier when the form can be had there', () => {
    const later = dex.obtainableGames(pikachu)[3]!.id
    expect(defaultGameId(dex, pikachu, later, [])).toBe(later)
    expect(defaultGameId(dex, pikachu, notHere, [])).toBe(firstObtainable)
    expect(defaultGameId(dex, pikachu, 'no-such-game', [])).toBe(firstObtainable)
  })

  it('prefers the obtainable game the user logged in most recently', () => {
    const games = dex.obtainableGames(pikachu)
    const a = games[2]!.id
    const b = games[5]!.id
    const entries = [
      { game: a, createdAt: '2026-01-02T00:00:00.000Z' },
      { game: b, createdAt: '2026-03-02T00:00:00.000Z' },
      { game: notHere, createdAt: '2026-09-02T00:00:00.000Z' }
    ]
    expect(defaultGameId(dex, pikachu, null, entries)).toBe(b)
  })

  it('falls back to an event game, then to a game the form merely exists in', () => {
    const eventOnly = dex.speciesList.flatMap((s) => s.forms).find((f) => dex.obtainableGames(f).length === 0 && dex.eventGames(f).length > 0)
    if (eventOnly) expect(defaultGameId(dex, eventOnly, null, [])).toBe(dex.eventGames(eventOnly)[0]!.id)
    const nowhere = dex.speciesList.flatMap((s) => s.forms).find((f) => dex.obtainableGames(f).length === 0 && dex.eventGames(f).length === 0 && dex.presentGames(f).length > 0)
    if (nowhere) expect(defaultGameId(dex, nowhere, null, [])).toBe(dex.presentGames(nowhere)[0]!.id)
  })
})

describe('buildSourceView', () => {
  it('sorts every row of every game into a section, grouped by place in dataset order', () => {
    for (const id of fixtureDetails.keys()) {
      const s = species(id)
      for (const f of s.forms) {
        for (const sources of sourcesByGame(dex, detail(id), f)) {
          const view = buildSourceView(detail(id), sources, id)
          const rows = view.sections.flatMap((section) => section.blocks.flatMap((b) => b.rows))
          expect(rows).toHaveLength(sources.rows.length)
          expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length)
          expect(view.evolve.length + view.change.length).toBe(sources.evolve.length)
          expect(view.total).toBe(sources.rows.length + sources.evolve.length + (sources.breed ? 1 : 0))
          for (const section of view.sections) {
            expect(section.count).toBe(section.blocks.reduce((n, b) => n + b.rows.length, 0))
            for (const block of section.blocks) for (const row of block.rows) expect(row.location).toBe(block.location)
            const places = section.blocks.filter((b) => b.location !== undefined).map((b) => b.location)
            expect(new Set(places).size).toBe(places.length)
          }
          const order = view.present.map((x) => SECTION_ORDER.indexOf(x))
          expect([...order].sort((a, b) => a - b)).toEqual(order)
        }
      }
    }
  })

  it('separates evolutions from form changes', () => {
    const raichu = inGame(ID.raichu, 0, 'red')
    const view = buildSourceView(detail(ID.raichu), raichu, ID.raichu)
    expect(view.evolve.map((e) => e.from[0])).toContain(ID.pikachu)
    expect(view.change).toHaveLength(0)
    expect(view.present).toContain('evolve')

    const withChange = [...fixtureDetails.keys()]
      .flatMap((id) => species(id).forms.flatMap((f) => sourcesByGame(dex, detail(id), f).map((sources) => ({ id, sources }))))
      .find(({ id, sources }) => sources.evolve.some((e) => e.from[0] === id))
    expect(withChange).toBeDefined()
    const changed = buildSourceView(detail(withChange!.id), withChange!.sources, withChange!.id)
    expect(changed.change.length).toBeGreaterThan(0)
    expect(changed.present).toContain('change')
  })

  it('titles an event by its distribution name and keeps "Alpha" out of the conditions', () => {
    const view = buildSourceView(
      { ...detail(ID.pikachu), strings: ['Somewhere'] },
      {
        rows: [
          { g: [0], k: 'event', lv: [5, 5], m: 'Mystery Gift', n: 'Birthday Pikachu', x: { ot: 'Pkmn' } },
          { g: [0], k: 'wild', lv: [10, 20], l: 0, c: ['Alpha', 'Night'] },
          { g: [0], k: 'trade', lv: [5, 5], m: 'In-game trade', l: 0, n: 'For a Rattata' }
        ],
        evolve: [],
        breed: false
      },
      ID.pikachu
    )
    const event = view.sections.find((s) => s.id === 'event')!.blocks[0]!.rows[0]!
    expect(event.title).toBe('Birthday Pikachu')
    expect(event.detail).toBe('Mystery Gift')
    const wild = view.sections.find((s) => s.id === 'wild')!.blocks[0]!.rows[0]!
    expect(wild.title).toBe('Wild')
    expect(wild.alpha).toBe(true)
    expect(wild.conditions).toEqual(['Night'])
    const trade = view.sections.find((s) => s.id === 'trade')!.blocks[0]!.rows[0]!
    expect(trade.title).toBe('In-game trade')
    expect(trade.detail).toBe('For a Rattata')
    expect(view.present).toEqual(['wild', 'trade', 'event'])
  })
})

describe('filterBlocks / initialBlockCount', () => {
  const view = buildSourceView(
    { ...detail(ID.pikachu), strings: ['Route 10', 'Route 11', 'Viridian Forest'] },
    {
      rows: [
        { g: [0], k: 'wild', lv: [3, 5], m: 'Tall grass', l: 0 },
        { g: [0], k: 'wild', lv: [15, 15], m: 'Super Rod', l: 0 },
        { g: [0], k: 'wild', lv: [3, 5], m: 'Tall grass', l: 1 },
        { g: [0], k: 'wild', lv: [4, 6], m: 'Tall grass', l: 2, c: ['Morning'] },
        { g: [0], k: 'wild', lv: [1, 50], m: 'Pokémon GO' }
      ],
      evolve: [],
      breed: false
    },
    ID.pikachu
  )
  const blocks: SourceBlock[] = view.sections[0]!.blocks

  it('groups rows that share a place and leaves place-less rows alone', () => {
    expect(blocks.map((b) => [b.location, b.rows.length])).toEqual([
      ['Route 10', 2],
      ['Route 11', 1],
      ['Viridian Forest', 1],
      [undefined, 1]
    ])
  })

  it('keeps a whole block when its place matches, else only the matching rows', () => {
    expect(filterBlocks(blocks, '')).toBe(blocks)
    expect(filterBlocks(blocks, 'route 1').map((b) => b.location)).toEqual(['Route 10', 'Route 11'])
    expect(filterBlocks(blocks, 'Route 10')[0]!.rows).toHaveLength(2)
    const rods = filterBlocks(blocks, 'super rod')
    expect(rods).toHaveLength(1)
    expect(rods[0]!.rows.map((r) => r.title)).toEqual(['Super Rod'])
    expect(filterBlocks(blocks, 'morning').map((b) => b.location)).toEqual(['Viridian Forest'])
    expect(filterBlocks(blocks, 'pokemon go')).toHaveLength(1)
    expect(filterBlocks(blocks, 'zzz')).toHaveLength(0)
  })

  it('shows whole blocks up to a row budget', () => {
    expect(initialBlockCount(blocks, 1)).toBe(1)
    expect(initialBlockCount(blocks, 3)).toBe(2)
    expect(initialBlockCount(blocks, 4)).toBe(3)
    expect(initialBlockCount(blocks, 100)).toBe(4)
    expect(initialBlockCount([], 10)).toBe(0)
  })
})

describe('presets', () => {
  const pikachu = { species: species(ID.pikachu), form: form(ID.pikachu) }

  it('builds a storable entry from every source of every fixture form', () => {
    for (const id of fixtureDetails.keys()) {
      const s = species(id)
      for (const f of s.forms) {
        for (const sources of sourcesByGame(dex, detail(id), f)) {
          const target = { species: s, form: f, view: { female: true, gmax: true, variant: f.variants?.[0]?.id } }
          const presets = [...sources.rows.map((row) => rowPreset(target, sources.game, detail(id), row)), ...sources.evolve.map((e) => evolvePreset(target, sources.game, e)), ...(sources.breed ? [breedPreset(target, sources.game)] : [])]
          for (const preset of presets) {
            const { entry, repaired } = checkEntry({ shiny: false, ...preset, id: 'x', createdAt: NOW, updatedAt: NOW }, NOW)
            expect(entry).not.toBeNull()
            expect(repaired).toBe(false)
            if (preset.gmax) expect(['sword', 'shield']).toContain(preset.game)
            if (preset.variant !== undefined) expect(f.variants?.some((v) => v.id === preset.variant)).toBe(true)
          }
        }
      }
    }
  })

  it('carries what the hero shows, but never against the source', () => {
    const sources = inGame(ID.pikachu, 0, 'sword')
    const free = sources.rows.find((r) => r.d === undefined)!
    const view = { female: true, gmax: true }
    const preset = rowPreset({ ...pikachu, view }, sources.game, detail(ID.pikachu), free)
    expect(preset.gender).toBe('f')
    expect(preset.gmax).toBe(true)
    const red = inGame(ID.pikachu, 0, 'red')
    expect(rowPreset({ ...pikachu, view }, red.game, detail(ID.pikachu), red.rows[0]!).gmax).toBeUndefined()
    const maleOnly = { ...free, d: 0 as const }
    expect(rowPreset({ ...pikachu, view }, sources.game, detail(ID.pikachu), maleOnly).gender).toBe('m')
    // A genderless species never gets a gender from the view.
    const mewtwo = { species: species(ID.mewtwo), form: form(ID.mewtwo), view: { female: true } }
    expect(manualPreset(mewtwo, null, null).gender).toBeUndefined()
  })

  it('records the earlier stage as the origin when logging from its sources', () => {
    const red = inGame(ID.pikachu, 0, 'red')
    const wild = red.rows.find((r) => r.k === 'wild')!
    const raichu = { species: species(ID.raichu), form: form(ID.raichu), origin: [ID.pikachu, 0] as [number, number] }
    const preset = rowPreset(raichu, red.game, detail(ID.pikachu), wild)
    expect(preset).toMatchObject({ species: ID.raichu, form: 0, game: 'red', kind: 'wild', origin: [ID.pikachu, 0], location: 'Viridian Forest' })
    expect(preset.level).toBeUndefined()
    expect(breedPreset(raichu, red.game)).toMatchObject({ kind: 'bred', origin: [ID.pikachu, 0] })
  })

  it('logs by hand with the game only when the form exists there', () => {
    expect(manualPreset(pikachu, { id: 'red' }, 'obtainable')).toEqual({ species: ID.pikachu, form: 0, game: 'red' })
    expect(manualPreset(pikachu, { id: 'gold' }, 'transfer').game).toBe('gold')
    expect(manualPreset(pikachu, { id: 'home' }, 'absent').game).toBeUndefined()
    expect(manualPreset(pikachu, null, null)).toEqual({ species: ID.pikachu, form: 0 })
    const female = { species: species(ID.meowstic), form: species(ID.meowstic).forms.find((f) => f.gender === 'f')! }
    expect(manualPreset(female, null, null).gender).toBe('f')
  })
})

describe('breedParents', () => {
  it('offers the form itself and what it evolves into, never a baby', () => {
    const family = detail(ID.pichu).family
    const game = dex.gamesAt(detail(ID.pichu).forms['0']!.breed)[0]!
    const parents = breedParents(dex, family, ID.pichu, 0, game.id)
    const ids = parents.map((p) => p.s)
    expect(ids).not.toContain(ID.pichu)
    expect(ids).toContain(ID.pikachu)
    for (const p of parents) expect(dex.isPresent(form(p.s, p.f), game.id)).toBe(true)
  })

  it('includes the Pokémon itself when it can breed', () => {
    const family = detail(ID.bulbasaur).family
    const parents = breedParents(dex, family, ID.bulbasaur, 0, 'firered')
    expect(parents[0]).toEqual({ s: ID.bulbasaur, f: 0 })
    expect(parents.map((p) => p.s)).toEqual([ID.bulbasaur, ID.ivysaur, ID.venusaur])
    expect(breedParents(dex, family, ID.ivysaur, 0, 'firered').map((p) => p.s)).toEqual([ID.ivysaur, ID.venusaur])
  })
})

describe('buildFamilyTree', () => {
  it('builds a simple line', () => {
    const tree = buildFamilyTree(detail(ID.bulbasaur).family)
    expect(tree).toHaveLength(1)
    expect(tree[0]!.node.s).toBe(ID.bulbasaur)
    expect(tree[0]!.children[0]!.node.s).toBe(ID.ivysaur)
    expect(tree[0]!.children[0]!.children[0]!.node.s).toBe(ID.venusaur)
    expect(familyHasEvolutions(tree)).toBe(true)
  })

  it('folds sibling forms that evolve the same way and shows the preferred one', () => {
    const family: FamilyNode[] = [{ s: ID.milcery, f: 0 }, ...[0, 1, 2, 3, 4].map((f): FamilyNode => ({ s: ID.alcremie, f, from: [ID.milcery, 0], how: 'Spin while it holds a Sweet' }))]
    const tree = buildFamilyTree(family, { species: ID.alcremie, form: 3 })
    expect(tree).toHaveLength(1)
    expect(tree[0]!.children).toHaveLength(1)
    const alcremie = tree[0]!.children[0]!
    expect(alcremie.node).toMatchObject({ s: ID.alcremie, f: 3 })
    expect(alcremie.alsoForms).toHaveLength(family.filter((n) => n.s === ID.alcremie).length - 1)
    expect(buildFamilyTree(family)[0]!.children[0]!.node.f).toBe(0)
  })

  it('keeps branches with different methods apart and regional lines as separate roots', () => {
    const family: FamilyNode[] = [
      { s: 133, f: 0 },
      { s: 134, f: 0, from: [133, 0], how: 'Use a Water Stone' },
      { s: 135, f: 0, from: [133, 0], how: 'Use a Thunder Stone' },
      { s: 52, f: 1 },
      { s: 53, f: 1, from: [52, 1], how: 'Evolve with high friendship' }
    ]
    const tree = buildFamilyTree(family)
    expect(tree.map((b) => b.node.s)).toEqual([133, 52])
    expect(tree[0]!.children.map((c) => c.node.s)).toEqual([134, 135])
    expect(tree[1]!.children[0]!.node).toMatchObject({ s: 53, f: 1 })
  })

  it('survives a family that points at itself or at a missing node', () => {
    const looped: FamilyNode[] = [
      { s: 1, f: 0, from: [2, 0], how: 'a' },
      { s: 2, f: 0, from: [1, 0], how: 'b' }
    ]
    expect(() => buildFamilyTree(looped)).not.toThrow()
    const orphan: FamilyNode[] = [{ s: 5, f: 0, from: [4, 0], how: 'Level 16' }]
    expect(buildFamilyTree(orphan)).toEqual([{ node: orphan[0], alsoForms: [], children: [] }])
    expect(familyHasEvolutions(buildFamilyTree([{ s: 150, f: 0 }]))).toBe(false)
  })
})

describe('about helpers', () => {
  it('orders regional numbers by release and drops repeats and island lists', () => {
    const numbers = regionalNumbers({ paldea: 134, kanto: 129, 'original-johto': 76, 'updated-johto': 76, hoenn: 52, 'updated-hoenn': 53, 'original-melemele': 91, 'brand-new': 7 })
    expect(numbers.map((n) => `${n.label} ${n.number}`)).toEqual(['Kanto 129', 'Johto 76', 'Hoenn 52', 'Hoenn (ORAS) 53', 'Paldea 134', 'Brand New 7'])
    expect(regionalNumbers({})).toEqual([])
  })

  it('formats height, weight and the gender split', () => {
    expect(formatHeight(0.9)).toBe('0.9 m · 2′11″')
    expect(formatHeight(1.8)).toBe('1.8 m · 5′11″')
    expect(formatWeight(10)).toBe('10.0 kg · 22.0 lb')
    expect(genderSplit(-1)).toBeNull()
    expect(genderSplit(4)).toEqual({ male: 50, female: 50 })
    expect(genderSplit(1)).toEqual({ male: 87.5, female: 12.5 })
    expect(genderSplit(8)).toEqual({ male: 0, female: 100 })
  })

  it('tidies form-change texts', () => {
    expect(changeText('Change form: examine a meteorite')).toBe('Examine a meteorite')
    expect(changeText('Fuse with Reshiram using the DNA Splicers')).toBe('Fuse with Reshiram using the DNA Splicers')
  })
})
