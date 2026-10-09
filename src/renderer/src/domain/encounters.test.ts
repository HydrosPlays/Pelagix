import { describe, expect, it } from 'vitest'
import type { EncounterRow } from '@shared/dex-types'
import { Dex } from '@renderer/lib/data'
import { fixtureDetails, fixtureDex as dex, fixtureIndex, ID } from '@renderer/lib/test-fixture'
import { checkEntry } from '@renderer/lib/storage'
import { formDetail, presetFromBreed, presetFromEvolve, presetFromRow, rowGender, rowLocation, sourcesByGame } from './encounters'

const detail = (id: number) => fixtureDetails.get(id)!
const form = (id: number, f = 0) => dex.form(id, f)!
const sources = (id: number, f = 0) => sourcesByGame(dex, detail(id), form(id, f))
const inGame = (id: number, f: number, game: string) => {
  const found = sources(id, f).find((s) => s.game.id === game)
  if (!found) throw new Error(`${id}-${f} has no sources in ${game}`)
  return found
}
const row = (id: number, f: number, game: string, kind: EncounterRow['k']): EncounterRow => {
  const found = inGame(id, f, game).rows.find((r) => r.k === kind)
  if (!found) throw new Error(`no ${kind} row`)
  return found
}

describe('formDetail / rowLocation / rowGender', () => {
  it('finds the detail of a form and tolerates a missing one', () => {
    expect(formDetail(detail(ID.pikachu), 0).rows.length).toBeGreaterThan(20)
    expect(formDetail(detail(ID.pikachu), form(ID.pikachu, 8)).rows).toHaveLength(1)
    expect(formDetail(detail(ID.pikachu), 42)).toEqual({ rows: [], evolve: [], breed: [] })
  })

  it('resolves location names through the string table', () => {
    const wild = row(ID.pikachu, 0, 'red', 'wild')
    expect(rowLocation(detail(ID.pikachu), wild)).toBe('Viridian Forest')
    const event = row(ID.mewtwo, 0, 'black', 'event')
    expect(rowLocation(detail(ID.mewtwo), event)).toBeUndefined()
  })

  it('maps fixed genders', () => {
    expect(rowGender({ g: [0], k: 'wild', lv: [1, 1], d: 0 })).toBe('m')
    expect(rowGender({ g: [0], k: 'wild', lv: [1, 1], d: 1 })).toBe('f')
    expect(rowGender({ g: [0], k: 'wild', lv: [1, 1], d: 2 })).toBe('n')
    expect(rowGender({ g: [0], k: 'wild', lv: [1, 1] })).toBeUndefined()
  })
})

describe('sourcesByGame', () => {
  it('lists every game with a source, in canonical order', () => {
    expect(sources(ID.mewtwo).map((s) => s.game.id)).toEqual([
      'red', 'green', 'blue', 'yellow', 'firered', 'leafgreen', 'heartgold', 'soulsilver', 'black', 'white', 'x', 'y', 'ultrasun', 'ultramoon',
      'letsgopikachu', 'letsgoeevee', 'sword', 'shield', 'brilliantdiamond', 'shiningpearl', 'scarlet', 'violet', 'legendsza', 'go'
    ])
  })

  it('gives each game only its own rows', () => {
    const red = inGame(ID.pikachu, 0, 'red')
    expect(red.rows.map((r) => [r.k, rowLocation(detail(ID.pikachu), r)])).toEqual([['wild', 'Viridian Forest'], ['wild', 'Power Plant']])
    expect(inGame(ID.pikachu, 0, 'yellow').rows.map((r) => r.k)).toEqual(['gift'])
    expect(inGame(ID.pikachu, 0, 'heartgold').rows.map((r) => r.k)).toEqual(['wild', 'walker'])
    expect(red).toMatchObject({ eventOnly: false, breed: false, evolve: [] })
  })

  it('flags event-only games', () => {
    const black = inGame(ID.mewtwo, 0, 'black')
    expect(black.eventOnly).toBe(true)
    expect(black.rows).toHaveLength(1)
    expect(black.rows[0]?.x).toMatchObject({ ot: 'PLASMA' })
    expect(inGame(ID.mewtwo, 0, 'red').eventOnly).toBe(false)
    expect(sources(ID.pikachu, 1).every((s) => s.eventOnly)).toBe(true) // cap Pikachu
  })

  it('includes games reachable only by evolving or breeding', () => {
    const gold = inGame(ID.pikachu, 0, 'gold')
    expect(gold.rows.map((r) => r.k)).toEqual(['wild'])
    expect(gold.evolve.map((e) => e.how)).toEqual(['Level up with high friendship'])

    const ruby = inGame(ID.bulbasaur, 0, 'ruby') // no rows there, but it can be bred
    expect(ruby).toMatchObject({ rows: [], evolve: [], breed: true, eventOnly: false })

    const sun = inGame(ID.raichu, 1, 'sun')
    expect(sun.rows).toEqual([])
    expect(sun.evolve).toEqual([{ from: [25, 0], how: 'Use Thunder Stone in Alola', g: expect.any(Array) }])
  })

  it('leaves out games where the form is merely present', () => {
    const games = sources(ID.mewtwo).map((s) => s.game.id)
    expect(dex.isPresent(form(ID.mewtwo), 'gold')).toBe(true)
    expect(games).not.toContain('gold')
    expect(sources(ID.pikachu).map((s) => s.game.id)).toContain('home') // HOME gift
    // Pikachu has no encounter in Black, but a Pichu can be evolved there.
    expect(inGame(ID.pikachu, 0, 'black')).toMatchObject({ rows: [], breed: false, eventOnly: false })
    expect(inGame(ID.pikachu, 0, 'black').evolve).toHaveLength(1)
  })

  it('returns an empty list for forms that cannot be obtained anywhere', () => {
    expect(sources(ID.koraidon, 2)).toEqual([])
    expect(sources(ID.arceus, 18)).toEqual([])
  })

  it('lists Pokémon GO for a form that only carries the go flag', () => {
    // A dataset whose obtain lists never mention GO.
    const go = fixtureIndex.games.indexOf('go')
    const stripped = new Dex({
      ...fixtureIndex,
      species: fixtureIndex.species.map((s) => ({ ...s, forms: s.forms.map((f) => ({ ...f, obtain: f.obtain.filter((g) => g !== go) })) }))
    })
    const d = { ...detail(ID.sprigatito), forms: { 0: { ...formDetail(detail(ID.sprigatito), 0), rows: formDetail(detail(ID.sprigatito), 0).rows.filter((r) => !r.g.includes(go)) } } }
    const list = sourcesByGame(stripped, d, stripped.form(ID.sprigatito, 0)!)
    expect(list.map((s) => s.game.id)).toEqual(['scarlet', 'violet', 'go'])
    expect(list[2]).toMatchObject({ rows: [], evolve: [], breed: false, eventOnly: false })
  })

  it('covers every obtainable and event game of every fixture form', () => {
    for (const species of dex.speciesList) {
      for (const f of species.forms) {
        const games = new Set(sourcesByGame(dex, detail(species.id), f).map((s) => s.game.id))
        for (const g of [...dex.obtainableGames(f), ...dex.eventGames(f)]) expect(games.has(g.id), `${species.name} form ${f.f} in ${g.id}`).toBe(true)
      }
    }
  })
})

describe('presets', () => {
  const valid = (preset: object) => checkEntry({ shiny: false, ...preset, id: 'x', createdAt: '2026-01-01T00:00:00.000Z' }, '2026-01-01T00:00:00.000Z')

  it('turns a wild row into entry values', () => {
    const preset = presetFromRow(ID.pikachu, form(ID.pikachu), { id: 'red' }, detail(ID.pikachu), row(ID.pikachu, 0, 'red', 'wild'))
    expect(preset).toEqual({ species: 25, form: 0, game: 'red', kind: 'wild', method: 'Tall grass', location: 'Viridian Forest' })
    expect(valid(preset)).toMatchObject({ repaired: false, entry: { species: 25, game: 'red', location: 'Viridian Forest' } })
  })

  it('carries fixed level, ball, gender, shiny state and trainer name', () => {
    const gift = presetFromRow(ID.pikachu, form(ID.pikachu), { id: 'yellow' }, detail(ID.pikachu), row(ID.pikachu, 0, 'yellow', 'gift'))
    expect(gift).toMatchObject({ kind: 'gift', method: 'Starter Pokémon', location: 'Pallet Town', level: 5 })
    expect('shiny' in gift).toBe(false)

    const cap = presetFromRow(ID.pikachu, form(ID.pikachu, 1), { id: 'sun' }, detail(ID.pikachu), row(ID.pikachu, 1, 'sun', 'event'))
    expect(cap).toEqual({ species: 25, form: 1, game: 'sun', kind: 'event', method: 'Serial code', ball: 4, gender: 'm', shiny: false, level: 1, ot: 'Ash' })

    const zacian = presetFromRow(ID.zacian, form(ID.zacian), { id: 'shield' }, detail(ID.zacian), row(ID.zacian, 0, 'shield', 'event'))
    expect(zacian).toMatchObject({ shiny: true, ball: 16, level: 100, ot: 'Lancer' })
    expect(valid(zacian).repaired).toBe(false)
  })

  it('marks alpha encounters and leaves a level range open', () => {
    const alpha = inGame(ID.pikachu, 0, 'legendsarceus').rows.find((r) => r.c?.includes('Alpha'))!
    const preset = presetFromRow(ID.pikachu, form(ID.pikachu), { id: 'legendsarceus' }, detail(ID.pikachu), alpha)
    expect(preset.alpha).toBe(true)
    expect('level' in preset).toBe(false)
    expect(preset.location).toBe('Coronet Highlands · Sacred Plaza')
  })

  it('falls back to the gender the form implies', () => {
    const spiky = presetFromRow(ID.pichu, form(ID.pichu, 1), { id: 'heartgold' }, detail(ID.pichu), row(ID.pichu, 1, 'heartgold', 'event'))
    expect(spiky).toMatchObject({ gender: 'f', shiny: false, level: 30, location: 'Ilex Forest' })
    const meowstic = presetFromRow(ID.meowstic, form(ID.meowstic, 1), { id: 'sword' }, detail(ID.meowstic), row(ID.meowstic, 1, 'sword', 'wild'))
    expect(meowstic.gender).toBe('f')
  })

  it('describes evolving and breeding', () => {
    const source = inGame(ID.raichu, 1, 'sun').evolve[0]!
    const evolved = presetFromEvolve(ID.raichu, form(ID.raichu, 1), { id: 'sun' }, source)
    expect(evolved).toEqual({ species: 26, form: 1, game: 'sun', kind: 'evolved', method: 'Use Thunder Stone in Alola', origin: [25, 0] })
    expect(evolved.origin).not.toBe(source.from)
    expect(valid(evolved).repaired).toBe(false)

    expect(presetFromEvolve(ID.meowstic, form(ID.meowstic, 1), { id: 'x' }, inGame(ID.meowstic, 1, 'x').evolve[0]!)).toMatchObject({ gender: 'f', origin: [677, 0] })

    const bred = presetFromBreed(ID.eevee, form(ID.eevee), { id: 'crystal' })
    expect(bred).toEqual({ species: 133, form: 0, game: 'crystal', kind: 'bred', method: 'Hatched from an Egg' })
    expect(valid(bred).repaired).toBe(false)
  })

  it('produces a valid entry from every row of the fixture', () => {
    let checked = 0
    for (const species of dex.speciesList) {
      for (const f of species.forms) {
        for (const src of sourcesByGame(dex, detail(species.id), f)) {
          for (const r of src.rows) {
            const result = valid(presetFromRow(species.id, f, src.game, detail(species.id), r))
            expect(result.entry, `${species.name} ${src.game.id} ${r.k}`).not.toBeNull()
            expect(result.repaired, `${species.name} ${src.game.id} ${r.k}`).toBe(false)
            checked++
          }
          for (const e of src.evolve) expect(valid(presetFromEvolve(species.id, f, src.game, e)).repaired).toBe(false)
        }
      }
    }
    expect(checked).toBeGreaterThan(800) // 448 rows, many of them spanning several games
  })
})
