import { describe, expect, it } from 'vitest'
import type { GameSaveContents, GameSaveEncounter, GameSavePokemon, PkhexVersion } from '@shared/game-save-types'
import { DEFAULT_RULES } from '@shared/save-types'
import { checkEntry } from '@renderer/lib/storage'
import { fixtureDex as dex, ID, makeEntry } from '@renderer/lib/test-fixture'
import { buildPreview, countChosen, entriesToImport, entryFromPokemon, failureText, gamesOfVersion, originGames, saveGameName, selectAllNew, selectFilling } from './model'

const TODAY = '2026-06-01'
const NOW = '2026-06-01T10:00:00.000Z'
const v = (name: string): PkhexVersion => ({ id: 1, name })

let serial = 0
function mon(species: number, extra: Partial<GameSavePokemon> = {}): GameSavePokemon {
  serial++
  return {
    place: 'box', box: 0, boxName: 'Box 1', slot: serial, species, form: 0, formArgument: null,
    gender: 'm', shiny: false, gmax: false, alpha: false, egg: false, ball: 4, version: v('SW'),
    metLocation: { id: 1, name: 'Route 1' }, eggLocation: null, metLevel: 5, metDate: '2024-03-02', level: 30,
    nickname: null, ot: 'Red', fateful: false, legal: true,
    encounter: { kind: 'wild', type: 'slot', species, form: 0, version: v('SW'), location: { id: 1, name: 'Route 1' }, levelMin: 3, levelMax: 5 },
    fingerprint: `44:0000${serial}:abcd`,
    ...extra
  }
}
const met = (species: number, extra: Partial<GameSaveEncounter> = {}): GameSaveEncounter => ({ kind: 'wild', type: 'slot', species, form: 0, version: v('SW'), location: null, levelMin: 1, levelMax: 1, ...extra })
const save = (pokemon: GameSavePokemon[], version = 'SW'): GameSaveContents => ({ fileName: 'main', save: { type: 'SAV8SWSH', version: v(version), generation: 8, trainer: 'Red', boxes: 32, boxSlots: 30 }, pokemon, dropped: 0 })
const preview = (pokemon: GameSavePokemon[], existing = [] as ReturnType<typeof makeEntry>[], game?: string, version = 'SW') => buildPreview(dex, save(pokemon, version), existing, DEFAULT_RULES, { today: TODAY, game })

describe('games of a save', () => {
  it('maps a PKHeX version to one game, a pair, or nothing', () => {
    expect(gamesOfVersion(v('SW')).map((g) => g.id)).toEqual(['sword'])
    expect(gamesOfVersion(v('GS')).map((g) => g.id)).toEqual(['gold', 'silver'])
    expect(gamesOfVersion(v('BATREV'))).toEqual([])
    expect(gamesOfVersion(null)).toEqual([])
    expect(gamesOfVersion(v('constructor'))).toEqual([])
  })

  it('takes the game a Pokémon originates from, not the save it sits in', () => {
    expect(originGames({ version: v('US'), encounter: met(1) }, v('SW')).map((g) => g.id)).toEqual(['ultrasun'])
  })

  it('narrows a group through the encounter, then through the save', () => {
    expect(originGames({ version: v('CXD'), encounter: met(1, { version: v('XD') }) }, v('FR')).map((g) => g.id)).toEqual(['xd'])
    expect(originGames({ version: v('GSC'), encounter: met(1, { version: v('GSC') }) }, v('C')).map((g) => g.id)).toEqual(['crystal'])
    expect(originGames({ version: v('RBY'), encounter: met(1, { version: v('RB') }) }, v('RB')).map((g) => g.id)).toEqual(['red', 'green', 'blue'])
    expect(originGames({ version: v('GSC'), encounter: met(1, { version: v('RBY') }) }, v('C')).map((g) => g.id)).toEqual(['red', 'green', 'blue', 'yellow'])
    expect(originGames({ version: v('GSC'), encounter: null }, v('C')).map((g) => g.id)).toEqual(['crystal'])
    expect(originGames({ version: v('BATREV'), encounter: null }, v('BATREV'))).toEqual([])
  })

  it('names the game of the save', () => {
    expect(saveGameName(save([]))).toBe('Pokémon Sword')
    expect(saveGameName(save([], 'RB'))).toBe('Pokémon Red / Green / Blue')
    expect(saveGameName(save([], 'BATREV'))).toBe('a Generation 8 game')
  })

  it('has a sentence for every failure, also an unknown one', () => {
    expect(failureText('not-a-save')).toMatch(/not a save/)
    expect(failureText('toString')).toBe(failureText('reader-failed'))
    expect(failureText(undefined)).toBe(failureText('reader-failed'))
  })
})

describe('entryFromPokemon', () => {
  it('records what the reader knows the way the editor would', () => {
    const entry = entryFromPokemon(dex, mon(ID.pikachu, { nickname: ' Sparky ', gender: 'f', shiny: true }), 'sword', TODAY)
    expect(entry).toEqual({
      species: ID.pikachu, form: 0, gender: 'f', shiny: true, game: 'sword', kind: 'wild', location: 'Route 1',
      ball: 4, level: 5, date: '2024-03-02', nickname: 'Sparky', ot: 'Red', fingerprint: expect.any(String)
    })
    expect(checkEntry({ ...entry, id: 'x', createdAt: NOW, updatedAt: NOW }, NOW)).toMatchObject({ repaired: false, entry: { fingerprint: entry.fingerprint } })
  })

  it('invents nothing the reader left open', () => {
    const entry = entryFromPokemon(dex, mon(ID.mewtwo, { ball: 0, metLevel: 0, metDate: null, metLocation: null, ot: '', encounter: null, gender: 'n' }), 'red', TODAY)
    expect(entry).toEqual({ species: ID.mewtwo, form: 0, gender: 'n', shiny: false, game: 'red', kind: 'other', fingerprint: expect.any(String) })
  })

  it('records an evolved Pokémon as evolved from what it was obtained as', () => {
    const entry = entryFromPokemon(dex, mon(ID.raichu, { encounter: met(ID.pichu, { kind: 'gift', location: { id: 9, name: 'Route 34' } }) }), 'sword', TODAY)
    expect(entry).toMatchObject({ species: ID.raichu, kind: 'evolved', origin: [ID.pichu, 0], method: 'Gift', location: 'Route 34' })
  })

  it('keeps the kind of a Pokémon that only changed form', () => {
    const entry = entryFromPokemon(dex, mon(ID.rotom, { form: 1, gender: 'n', encounter: met(ID.rotom, { kind: 'static' }) }), 'sword', TODAY)
    expect(entry).toMatchObject({ species: ID.rotom, form: 1, kind: 'static' })
    expect(entry.origin).toBeUndefined()
  })

  it('records a hatched Pokémon as bred, at the place it hatched', () => {
    const entry = entryFromPokemon(dex, mon(ID.eevee, { encounter: met(ID.eevee, { kind: 'bred', location: { id: 0, name: '' } }), eggLocation: { id: 60002, name: 'a Nursery Worker' }, metLocation: { id: 3, name: 'Route 5' }, metLevel: 1 }), 'sword', TODAY)
    expect(entry).toMatchObject({ kind: 'bred', method: 'Hatched from an Egg', location: 'Route 5', level: 1 })
  })

  it('drops placeholders, a future date, an unknown ball and flags the game does not have', () => {
    const entry = entryFromPokemon(dex, mon(ID.pikachu, { metLocation: { id: 0, name: "(Can't Tell)" }, encounter: null, metDate: '2031-01-01', ball: 999, gmax: true, alpha: true }), 'crystal', TODAY)
    expect(entry).toEqual({ species: ID.pikachu, form: 0, gender: 'm', shiny: false, game: 'crystal', kind: 'other', level: 5, ot: 'Red', fingerprint: expect.any(String) })
  })

  it('writes a Colosseum / XD place the way the datasets do', () => {
    const at = (name: string, game: string) => entryFromPokemon(dex, mon(ID.pikachu, { encounter: met(ID.pikachu, { kind: 'shadow', location: { id: 74, name } }) }), game, TODAY).location
    expect(at('Mt. Battle (C) / Citadark Isle (XD) [074]', 'xd')).toBe('Citadark Isle')
    expect(at('Mt. Battle (C) / Citadark Isle (XD) [074]', 'colosseum')).toBe('Mt. Battle')
    expect(at('Outskirt Stand (C) [005]', 'colosseum')).toBe('Outskirt Stand')
    expect(at('Route 116', 'ruby')).toBe('Route 116')
  })

  it('carries the Alcremie sweet as the variant', () => {
    const cream = dex.species(ID.alcremie)!.forms.find((f) => (f.variants?.length ?? 0) > 1)!
    const sweet = cream.variants![1]!
    expect(entryFromPokemon(dex, mon(ID.alcremie, { form: cream.f, formArgument: sweet.id, gender: 'f' }), 'sword', TODAY).variant).toBe(sweet.id)
  })
})

describe('buildPreview', () => {
  it('gives every Pokémon one status', () => {
    const seen = mon(ID.eevee)
    const p = preview(
      [mon(ID.pikachu), seen, mon(ID.pichu, { egg: true, nickname: null }), mon(19_999), mon(ID.pikachu, { form: 200 }), mon(ID.mewtwo, { version: v('BATREV'), encounter: null })],
      [makeEntry(ID.eevee, 0, { fingerprint: seen.fingerprint })],
      undefined,
      'BATREV'
    )
    expect(p.rows.map((r) => r.status)).toEqual(['new', 'imported', 'egg', 'unsupported', 'unsupported', 'unsupported'])
    expect(p.rows.map((r) => r.reason)).toEqual([undefined, undefined, undefined, 'Pelagix does not know this Pokémon.', 'Pelagix does not know this form.', 'It comes from a game that Pelagix does not track.'])
    expect(p.counts).toEqual({ new: 1, imported: 1, egg: 1, unsupported: 3, fills: 1 })
    expect(p.rows[2]?.name).toBe('Pichu Egg')
    expect(p.rows[2]?.entry).toBeUndefined()
    expect(p.askGames).toEqual([])
  })

  it('never imports an egg, whatever is selected', () => {
    const p = preview([mon(ID.pichu, { egg: true })])
    expect(selectAllNew(p.rows).size).toBe(0)
    expect(entriesToImport(p.rows, new Set([0]), [], NOW, () => 'id')).toEqual([])
  })

  it('marks only the first Pokémon of a slot, and none for a slot that is already caught', () => {
    const p = preview([mon(ID.pikachu), mon(ID.pikachu, { shiny: true }), mon(ID.raichu), mon(ID.eevee)], [makeEntry(ID.eevee)])
    expect(p.rows.map((r) => r.fills)).toEqual([true, false, true, false])
    expect([...selectAllNew(p.rows)]).toEqual([0, 1, 2, 3])
    expect([...selectFilling(p.rows)]).toEqual([0, 2])
  })

  it('follows the rules for slots', () => {
    const pair = [mon(ID.meowstic, { gender: 'm' }), mon(ID.meowstic, { form: 1, gender: 'f' })]
    expect(buildPreview(dex, save(pair), [], DEFAULT_RULES, { today: TODAY }).rows.map((r) => r.fills)).toEqual([true, true])
    expect(buildPreview(dex, save(pair), [], { ...DEFAULT_RULES, genderForms: false, genderDiffs: false }, { today: TODAY }).rows.map((r) => r.fills)).toEqual([true, false])
  })

  it('asks for the game when the save only knows a pair, and uses the answer where it fits', () => {
    const gb = { version: v('RBY'), ball: 0, metLocation: null, metLevel: 0, metDate: null }
    const pokemon = [mon(ID.pikachu, { ...gb, encounter: met(ID.pikachu, { version: v('RB') }) }), mon(ID.eevee, { ...gb, encounter: met(ID.eevee, { version: v('YW') }) })]
    const open = preview(pokemon, [], undefined, 'RB')
    expect(open.askGames.map((g) => g.id)).toEqual(['red', 'green', 'blue'])
    expect(open.rows.map((r) => [r.status, r.game?.id])).toEqual([['unsupported', undefined], ['new', 'yellow']])
    const answered = preview(pokemon, [], 'blue', 'RB')
    expect(answered.rows.map((r) => [r.status, r.entry?.game])).toEqual([['new', 'blue'], ['new', 'yellow']])
    expect(preview(pokemon, [], 'sword', 'RB').rows[0]).toMatchObject({ status: 'unsupported', reason: 'It cannot be from the game you chose.' })
  })

  it('survives a hostile reader result', () => {
    const hostile = [null, 7, 'x', {}, { fingerprint: 'a', species: 'NaN', egg: 'yes' }, { ...mon(ID.pikachu), version: null, encounter: 5 }, { ...mon(ID.pikachu), ot: null }] as unknown as GameSavePokemon[]
    const p = preview(hostile)
    expect(p.rows).toHaveLength(hostile.length)
    expect(p.rows.every((r) => r.status === 'unsupported' || r.status === 'new')).toBe(true)
    for (const e of entriesToImport(p.rows, selectAllNew(p.rows), [], NOW, () => 'id')) expect(checkEntry(e, NOW).entry).not.toBeNull()
    expect(buildPreview(dex, { pokemon: 'no' } as unknown as GameSaveContents, [], DEFAULT_RULES, { today: TODAY }).rows).toEqual([])
  })
})

describe('entriesToImport', () => {
  it('turns the chosen new rows into entries with ids and timestamps', () => {
    const p = preview([mon(ID.pikachu), mon(ID.raichu), mon(ID.eevee)])
    let n = 0
    const entries = entriesToImport(p.rows, new Set([0, 2]), [], NOW, () => `id${++n}`)
    expect(entries.map((e) => [e.id, e.species, e.createdAt, e.updatedAt])).toEqual([['id1', ID.pikachu, NOW, NOW], ['id2', ID.eevee, NOW, NOW]])
    expect(countChosen(p.rows, new Set([0, 2, 99]))).toBe(2)
  })

  it('adds nothing twice when the preview has gone stale', () => {
    const p = preview([mon(ID.pikachu), mon(ID.raichu)])
    const first = entriesToImport(p.rows, selectAllNew(p.rows), [], NOW, () => 'a')
    expect(first).toHaveLength(2)
    expect(entriesToImport(p.rows, selectAllNew(p.rows), first, NOW, () => 'b')).toEqual([])
  })

  it('shows the same Pokémon as already imported when it turns up in another save', () => {
    const traded = mon(ID.pikachu)
    const first = entriesToImport(preview([traded]).rows, new Set([0]), [], NOW, () => 'a')
    const later = buildPreview(dex, save([{ ...traded, species: ID.raichu, level: 60, nickname: 'Volt', box: 3, slot: 9 }], 'SH'), first, DEFAULT_RULES, { today: TODAY })
    expect(later.rows[0]?.status).toBe('imported')
    expect(selectAllNew(later.rows).size).toBe(0)
  })
})
