import { describe, expect, it } from 'vitest'
import type { EncounterRow, SpeciesDetail } from '@shared/dex-types'
import { sourcesByGame } from '@renderer/domain/encounters'
import { checkEntry } from '@renderer/lib/storage'
import { fixtureDetails, fixtureDex as dex, ID, makeEntry } from '@renderer/lib/test-fixture'
import {
  abilityOptions,
  applySuggestion,
  buildSuggestions,
  canAlpha,
  canGmax,
  chooseLocation,
  chooseMethod,
  defaultKind,
  draftForAnotherGame,
  draftFromEntry,
  draftFromPreset,
  draftToInput,
  draftToPatch,
  draftToPreview,
  genderChoices,
  hasErrors,
  hasValues,
  levelHint,
  levelOutside,
  locationOptions,
  matchSuggestion,
  methodOptions,
  parsePid,
  parseSpread,
  pickForm,
  sameDraft,
  settleDraft,
  validateDraft,
  visibleForms,
  type Draft
} from './draft'

const DEFAULTS = { trainerName: 'Hydro', today: '2026-10-09' }
const CONTEXT = { trainerName: 'Hydro' }
const NOW = '2026-10-09T12:00:00.000Z'
const detail = (id: number) => fixtureDetails.get(id)!
const species = (id: number) => dex.species(id)!
const form = (id: number, f = 0) => dex.form(id, f)!
const blank = (extra: Partial<Draft> = {}): Draft => ({ ...draftFromPreset(dex, { species: ID.pikachu, form: 0 }, DEFAULTS), ...extra })

/** A hand-made game: one place with two methods, a second place, a gift with everything fixed, an evolution and breeding. */
const STRINGS = ['Route 10', 'Route 11', 'Lab']
const ROWS: EncounterRow[] = [
  { g: [0], k: 'wild', lv: [3, 5], m: 'Tall grass', l: 0, c: ['Morning'] },
  { g: [0], k: 'wild', lv: [4, 8], m: 'Tall grass', l: 0, c: ['Night'] },
  { g: [0], k: 'wild', lv: [15, 15], m: 'Super Rod', l: 0 },
  { g: [0], k: 'wild', lv: [6, 9], m: 'Tall grass', l: 1 },
  { g: [0], k: 'gift', lv: [5, 5], m: 'Starter', l: 2, b: 4, d: 0, s: 'locked' },
  { g: [0], k: 'event', lv: [50, 50], m: 'Mystery Gift', s: 'forced', b: 16, x: { ot: 'Ash' } },
  { g: [0], k: 'static', lv: [0, 0], l: 1, c: ['Alpha'] }
]
const DETAIL: SpeciesDetail = { ...detail(ID.pikachu), strings: STRINGS }
const SUGGESTIONS = buildSuggestions(DETAIL, { rows: ROWS, evolve: [{ from: [ID.pichu, 0], how: 'Evolve with high friendship', g: [0] }], breed: true })
const find = (key: string) => {
  const hit = SUGGESTIONS.find((s) => s.key === key)
  if (!hit) throw new Error(`no suggestion ${key}`)
  return hit
}

describe('what a species, form and game allow', () => {
  it('offers only non-hidden forms', () => {
    const scatterbug = species(ID.scatterbug)
    expect(visibleForms(scatterbug).every((f) => f.cat !== 'hidden')).toBe(true)
    expect(visibleForms(scatterbug).length).toBeLessThan(scatterbug.forms.length)
    expect(pickForm(species(ID.pikachu), 99)!.f).toBe(0)
    expect(pickForm(species(ID.raichu), 1)!.f).toBe(1)
  })

  it('knows which genders a Pokémon can be', () => {
    expect(genderChoices(species(ID.pikachu), form(ID.pikachu))).toEqual(['m', 'f'])
    expect(genderChoices(species(ID.mewtwo), form(ID.mewtwo))).toEqual(['n'])
    const female = species(ID.meowstic).forms.find((f) => f.gender === 'f')!
    expect(genderChoices(species(ID.meowstic), female)).toEqual(['f'])
    expect(genderChoices({ ...species(ID.pikachu), genderRate: 0 }, form(ID.pikachu))).toEqual(['m'])
    expect(genderChoices({ ...species(ID.pikachu), genderRate: 8 }, form(ID.pikachu))).toEqual(['f'])
    expect(genderChoices(undefined, undefined)).toEqual(['m', 'f', 'n'])
  })

  it('limits Gigantamax and Alpha to the games that have them', () => {
    expect(canGmax(form(ID.pikachu), 'sword')).toBe(true)
    expect(canGmax(form(ID.pikachu), 'scarlet')).toBe(false)
    expect(canGmax(form(ID.mewtwo), 'shield')).toBe(false)
    expect(canGmax(undefined, 'sword')).toBe(false)
    expect(canAlpha('legendsarceus')).toBe(true)
    expect(canAlpha('legendsza')).toBe(true)
    expect(canAlpha('scarlet')).toBe(false)
  })
})

describe('draftFromPreset', () => {
  it('fills the defaults from as little as a species and a form', () => {
    const draft = draftFromPreset(dex, { species: ID.pikachu, form: 0 }, DEFAULTS)
    expect(draft).toMatchObject({ species: ID.pikachu, form: 0, game: '', kind: 'other', method: '', location: '', ball: null, gender: null, shiny: false, level: null, date: '2026-10-09', ot: 'Hydro', nickname: '', notes: '', variant: null, origin: null })
  })

  it('takes over a full preset', () => {
    const draft = draftFromPreset(dex, { species: ID.raichu, form: 1, game: 'ultrasun', kind: 'evolved', method: 'Use a Thunder Stone', origin: [ID.pikachu, 0], gender: 'f', shiny: true, ball: 26, level: 30, ot: 'Lillie', date: '2020-02-02' }, DEFAULTS)
    expect(draft).toMatchObject({ species: ID.raichu, form: 1, game: 'ultrasun', kind: 'evolved', origin: [ID.pikachu, 0], gender: 'f', shiny: true, ball: 26, level: 30, ot: 'Lillie', date: '2020-02-02' })
  })

  it('repairs what the Pokémon or the game cannot be', () => {
    expect(draftFromPreset(dex, { species: ID.mewtwo, form: 0, gender: 'f' }, DEFAULTS).gender).toBe('n')
    expect(draftFromPreset(dex, { species: ID.pikachu, form: 77 }, DEFAULTS).form).toBe(0)
    expect(draftFromPreset(dex, { species: ID.pikachu, form: 0, game: 'scarlet', gmax: true, alpha: true }, DEFAULTS)).toMatchObject({ gmax: false, alpha: false })
    expect(draftFromPreset(dex, { species: ID.pikachu, form: 0, game: 'sword', gmax: true }, DEFAULTS).gmax).toBe(true)
    expect(draftFromPreset(dex, { species: ID.pikachu, form: 0, date: 'tomorrow' }, DEFAULTS).date).toBe('2026-10-09')
    const sweet = draftFromPreset(dex, { species: ID.alcremie, form: 1 }, DEFAULTS)
    expect(sweet.variant).toBe(form(ID.alcremie, 1).variants![0]!.id)
    expect(draftFromPreset(dex, { species: ID.alcremie, form: 1, variant: 3 }, DEFAULTS).variant).toBe(3)
    expect(draftFromPreset(dex, { species: ID.pikachu, form: 0, variant: 3 }, DEFAULTS).variant).toBeNull()
  })

  it('does not choke on a Pokémon the data does not know', () => {
    const draft = draftFromPreset(dex, { species: 1400, form: 2 }, DEFAULTS)
    expect(draft).toMatchObject({ species: 1400, form: 2 })
    expect(validateDraft(dex, draft, { today: DEFAULTS.today }).species).toBeDefined()
  })
})

describe('settleDraft', () => {
  it('keeps what was typed and drops only what became impossible', () => {
    const typed = blank({ game: 'sword', gmax: true, gender: 'f', method: 'My own words', location: 'Somewhere', nickname: 'Sparky', ball: 15 })
    const moved = settleDraft(dex, { ...typed, game: 'scarlet' })
    expect(moved).toMatchObject({ gmax: false, gender: 'f', method: 'My own words', location: 'Somewhere', nickname: 'Sparky', ball: 15 })
    const mewtwo = settleDraft(dex, { ...typed, species: ID.mewtwo, form: 0 })
    expect(mewtwo.gender).toBe('n')
    const alpha = settleDraft(dex, blank({ game: 'legendsarceus', alpha: true }))
    expect(alpha.alpha).toBe(true)
    expect(settleDraft(dex, { ...alpha, game: 'red' }).alpha).toBe(false)
    const unknown = blank({ species: 1400 })
    expect(settleDraft(dex, unknown)).toBe(unknown)
  })
})

describe('to and from the save', () => {
  it('round-trips an entry through the draft unchanged', () => {
    const entry = makeEntry(ID.raichu, 1, { game: 'ultrasun', kind: 'evolved', method: 'Use a Thunder Stone', origin: [ID.pikachu, 0], gender: 'm', shiny: true, ball: 26, level: 37, date: '2022-03-14', nickname: 'Surf', ot: 'Hydro', notes: 'Line one.\nLine two.', location: "Hau'oli City" })
    const draft = draftFromEntry(entry)
    const { id: _id, createdAt: _c, updatedAt: _u, ...fields } = entry
    expect(draftToInput(draft)).toEqual(fields)
    expect(sameDraft(draft, draftFromEntry({ ...entry }))).toBe(true)
    expect(sameDraft(draft, { ...draft, notes: 'x' })).toBe(false)
  })

  it('leaves unset fields out of a new entry and clears them in a patch', () => {
    const draft = blank({ game: 'red', kind: 'wild', method: '  ', location: '', nickname: ' Bolt ' })
    const input = draftToInput(draft)
    expect(Object.keys(input).sort()).toEqual(['date', 'form', 'game', 'kind', 'nickname', 'ot', 'shiny', 'species'])
    expect(input.nickname).toBe('Bolt')
    const patch = draftToPatch(draft)
    expect('method' in patch && patch.method === undefined).toBe(true)
    expect('ball' in patch && patch.ball === undefined).toBe(true)
    expect('gmax' in patch && patch.gmax === undefined).toBe(true)
  })

  it('produces entries the save accepts without repairs', () => {
    const draft = blank({ game: 'sword', kind: 'raid', method: 'Max Raid Den', location: 'Lake of Outrage', ball: 2, gender: 'f', shiny: true, gmax: true, level: 60, nickname: 'Big', ot: 'Hydro', notes: 'n' })
    const { entry, repaired } = checkEntry({ ...draftToInput(draft), id: 'a', createdAt: NOW, updatedAt: NOW }, NOW)
    expect(repaired).toBe(false)
    expect(entry).toMatchObject({ species: ID.pikachu, game: 'sword', gmax: true, level: 60 })
    expect(draftToPreview(draft, NOW)).toMatchObject({ id: 'entry-preview', createdAt: NOW, game: 'sword' })
    // The preview of a half-filled draft is still a well-formed object for the card.
    expect(draftToPreview(blank(), NOW)).toMatchObject({ species: ID.pikachu, game: '', kind: 'other', shiny: false })
  })

  it('resets everything that belongs to one catch for the next game', () => {
    const draft = blank({ game: 'red', kind: 'wild', method: 'Tall grass', location: 'Viridian Forest', ball: 4, gender: 'f', shiny: true, level: 5, nickname: 'Sparky', ot: 'Other', notes: 'x', date: '2020-01-01', origin: [ID.pichu, 0] })
    const next = draftForAnotherGame(dex, draft, DEFAULTS)
    expect(next).toMatchObject({ species: ID.pikachu, form: 0, game: '', kind: 'other', method: '', location: '', ball: null, gender: null, shiny: false, level: null, nickname: '', ot: 'Hydro', notes: '', date: '2026-10-09', origin: null })
    const mewtwo = draftForAnotherGame(dex, blank({ species: ID.mewtwo, gender: 'n', game: 'red' }), DEFAULTS)
    expect(mewtwo.gender).toBe('n')
  })
})

describe('validateDraft', () => {
  const options = { today: '2026-10-09' }

  it('requires a Pokémon, a form and a game, and nothing else', () => {
    expect(validateDraft(dex, blank(), options)).toEqual({ game: 'Choose the game you got it in.' })
    expect(hasErrors(validateDraft(dex, blank({ game: 'red' }), options))).toBe(false)
    expect(validateDraft(dex, blank({ game: 'red', species: 1400 }), options).species).toBeDefined()
    expect(validateDraft(dex, blank({ game: 'red', form: 99 }), options).form).toBeDefined()
    expect(validateDraft(dex, blank({ game: 'Not A Game!' }), options).game).toBeDefined()
  })

  it('checks a level or a date only when it is filled in', () => {
    expect(validateDraft(dex, blank({ game: 'red', level: 0 }), options).level).toBeDefined()
    expect(validateDraft(dex, blank({ game: 'red', level: 101 }), options).level).toBeDefined()
    expect(validateDraft(dex, blank({ game: 'red', level: 12.5 }), options).level).toBeDefined()
    expect(validateDraft(dex, blank({ game: 'red', level: 100 }), options).level).toBeUndefined()
    expect(validateDraft(dex, blank({ game: 'red', date: '' }), options).date).toBeUndefined()
    expect(validateDraft(dex, blank({ game: 'red', date: '2026-10-09' }), options).date).toBeUndefined()
    expect(validateDraft(dex, blank({ game: 'red', date: '2026-10-10' }), options).date).toBe('The date cannot be in the future.')
    expect(validateDraft(dex, blank({ game: 'red', date: '2026-02-31' }), options).date).toBe('Enter a real date.')
  })

  it('does not second-guess what a saved entry already had', () => {
    const original = { species: 1400, form: 3, game: 'Old_Game' }
    const draft = blank({ ...original, nickname: 'edited' })
    expect(hasErrors(validateDraft(dex, draft, { ...options, original }))).toBe(false)
    expect(validateDraft(dex, { ...draft, game: '' }, { ...options, original }).game).toBeDefined()
  })
})

describe('suggestions', () => {
  it('merges rows that differ only in conditions or level', () => {
    expect(SUGGESTIONS.map((s) => s.key)).toEqual([
      'wild|Tall grass|Route 10',
      'wild|Super Rod|Route 10',
      'wild|Tall grass|Route 11',
      'gift|Starter|Lab',
      'event|Mystery Gift|',
      'static||Route 11',
      `evolved|Evolve with high friendship||${ID.pichu}-0`,
      'bred|Hatched from an Egg|'
    ])
    expect(find('wild|Tall grass|Route 10').levels).toEqual([3, 8])
    expect(find('wild|Super Rod|Route 10').levels).toEqual([15, 15])
    expect(find('static||Route 11')).toMatchObject({ levels: null, alpha: true })
    expect(find('gift|Starter|Lab')).toMatchObject({ ball: 4, gender: 'm', shiny: 'locked' })
    expect(find('event|Mystery Gift|')).toMatchObject({ ball: 16, shiny: 'forced', ot: 'Ash' })
    expect(buildSuggestions(DETAIL, undefined)).toEqual([])
  })

  it('keeps a fixed property only when every merged row has it', () => {
    const merged = buildSuggestions(DETAIL, {
      rows: [
        { g: [0], k: 'wild', lv: [1, 2], l: 0, b: 4, d: 1, s: 'locked', c: ['Alpha'] },
        { g: [0], k: 'wild', lv: [5, 9], l: 0, b: 5 }
      ],
      evolve: [],
      breed: false
    })
    expect(merged).toHaveLength(1)
    expect(merged[0]).toEqual({ key: 'wild||Route 10', kind: 'wild', method: '', location: 'Route 10', levels: [1, 9], alpha: false })
  })

  it('builds from every game of every fixture form without duplicates', () => {
    for (const id of fixtureDetails.keys()) {
      for (const f of species(id).forms) {
        for (const sources of sourcesByGame(dex, detail(id), f)) {
          const list = buildSuggestions(detail(id), sources)
          expect(new Set(list.map((s) => s.key)).size).toBe(list.length)
          for (const s of list) expect(matchSuggestion(list, { kind: s.kind, method: s.method, location: s.location, origin: s.origin ?? null })).toBe(s)
        }
      }
    }
  })

  it('lists methods and places, the fitting ones first', () => {
    expect(methodOptions(SUGGESTIONS, '').map((m) => m.label)).toEqual(['Tall grass', 'Super Rod', 'Starter', 'Mystery Gift', 'Static encounter', 'Evolve with high friendship', 'Hatched from an Egg'])
    const tallGrass = methodOptions(SUGGESTIONS, '')[0]!
    expect(tallGrass).toMatchObject({ places: ['Route 10', 'Route 11'], levels: [3, 9], here: false })
    const atRoute11 = methodOptions(SUGGESTIONS, 'Route 11')
    expect(atRoute11.filter((m) => m.here).map((m) => m.label)).toEqual(['Tall grass', 'Static encounter'])
    expect(atRoute11[0]!.label).toBe('Tall grass')
    expect(atRoute11[1]!.label).toBe('Static encounter')

    const places = locationOptions(SUGGESTIONS, 'wild', 'Super Rod')
    expect(places.map((p) => [p.location, p.fits])).toEqual([
      ['Route 10', true],
      ['Route 11', false],
      ['Lab', false]
    ])
    expect(places[0]!.methods).toEqual(['Tall grass', 'Super Rod'])
  })
})

describe('choosing a suggestion', () => {
  it('applies the whole source when a method pins it down', () => {
    const draft = chooseMethod(blank({ game: 'red' }), SUGGESTIONS, { kind: 'gift', method: 'Starter' }, CONTEXT)
    expect(draft).toMatchObject({ kind: 'gift', method: 'Starter', location: 'Lab', ball: 4, gender: 'm', level: 5, shiny: false })
    expect(matchSuggestion(SUGGESTIONS, draft)).toBe(find('gift|Starter|Lab'))
  })

  it('sets only kind and method when the place is still open', () => {
    const draft = chooseMethod(blank({ game: 'red', nickname: 'kept' }), SUGGESTIONS, { kind: 'wild', method: 'Tall grass' }, CONTEXT)
    expect(draft).toMatchObject({ kind: 'wild', method: 'Tall grass', location: '', level: null, nickname: 'kept' })
    expect(matchSuggestion(SUGGESTIONS, draft)).toBeNull()
    const placed = chooseLocation(draft, SUGGESTIONS, 'Route 11', CONTEXT)
    expect(placed).toMatchObject({ kind: 'wild', method: 'Tall grass', location: 'Route 11' })
    expect(levelHint(matchSuggestion(SUGGESTIONS, placed))).toBe('Lv. 6–9')
  })

  it('uses the place already typed to pick the source, and a typed place of its own is kept', () => {
    const atRoute10 = chooseMethod(blank({ location: 'Route 10' }), SUGGESTIONS, { kind: 'wild', method: 'Super Rod' }, CONTEXT)
    expect(atRoute10).toMatchObject({ method: 'Super Rod', location: 'Route 10', level: 15 })
    const own = chooseMethod(blank({ location: 'My secret spot' }), SUGGESTIONS, { kind: 'wild', method: 'Tall grass' }, CONTEXT)
    expect(own.location).toBe('My secret spot')
    const stale = chooseMethod(blank({ location: 'Lab' }), SUGGESTIONS, { kind: 'wild', method: 'Tall grass' }, CONTEXT)
    expect(stale.location).toBe('')
  })

  it('picks the source at a place when the method there is unambiguous or already chosen', () => {
    expect(chooseLocation(blank(), SUGGESTIONS, 'Lab', CONTEXT)).toMatchObject({ kind: 'gift', method: 'Starter', location: 'Lab', ball: 4 })
    const open = chooseLocation(blank(), SUGGESTIONS, 'Route 10', CONTEXT)
    expect(open).toMatchObject({ kind: 'other', method: '', location: 'Route 10' })
    const rod = chooseLocation(blank({ kind: 'wild', method: 'Super Rod' }), SUGGESTIONS, 'Route 10', CONTEXT)
    expect(rod).toMatchObject({ kind: 'wild', method: 'Super Rod', location: 'Route 10', level: 15 })
  })

  it('takes back what the previous source forced, and nothing the user set', () => {
    const gift = applySuggestion(blank({ game: 'red', nickname: 'Mine' }), find('gift|Starter|Lab'), null, CONTEXT)
    expect(gift).toMatchObject({ ball: 4, gender: 'm', level: 5 })
    const event = chooseMethod(gift, SUGGESTIONS, { kind: 'event', method: 'Mystery Gift' }, CONTEXT)
    expect(event).toMatchObject({ kind: 'event', method: 'Mystery Gift', location: '', ball: 16, gender: null, shiny: true, level: 50, ot: 'Ash', nickname: 'Mine' })
    const wild = chooseMethod(event, SUGGESTIONS, { kind: 'wild', method: 'Super Rod' }, CONTEXT)
    expect(wild).toMatchObject({ kind: 'wild', method: 'Super Rod', location: 'Route 10', ball: null, shiny: false, level: 15, ot: 'Hydro' })

    const ownBall = { ...gift, ball: 2 }
    expect(chooseMethod(ownBall, SUGGESTIONS, { kind: 'wild', method: 'Super Rod' }, CONTEXT).ball).toBe(2)
  })

  it('records what it evolved from, and forgets it when another source is chosen', () => {
    const evolved = chooseMethod(blank(), SUGGESTIONS, { kind: 'evolved', method: 'Evolve with high friendship' }, CONTEXT)
    expect(evolved).toMatchObject({ kind: 'evolved', origin: [ID.pichu, 0] })
    expect(chooseMethod(evolved, SUGGESTIONS, { kind: 'bred', method: 'Hatched from an Egg' }, CONTEXT)).toMatchObject({ kind: 'bred', origin: null, level: 1 })
  })

  it('marks an Alpha only in a game that has them, and never mutates its input', () => {
    const before = blank({ game: 'legendsarceus' })
    const snapshot = JSON.stringify(before)
    const alpha = applySuggestion(before, find('static||Route 11'), null, CONTEXT)
    expect(alpha.alpha).toBe(true)
    expect(JSON.stringify(before)).toBe(snapshot)
    expect(applySuggestion(blank({ game: 'red' }), find('static||Route 11'), null, CONTEXT).alpha).toBe(false)
  })
})

describe('hints', () => {
  it('starts a manual entry with the way the game usually offers the Pokémon', () => {
    expect(defaultKind('obtainable', SUGGESTIONS)).toBe('wild')
    expect(defaultKind('event', [find('event|Mystery Gift|')])).toBe('event')
    expect(defaultKind('transfer', SUGGESTIONS)).toBe('transfer')
    expect(defaultKind('absent', SUGGESTIONS)).toBe('other')
    expect(defaultKind(null, SUGGESTIONS)).toBe('other')
    expect(defaultKind('obtainable', [])).toBe('other')
  })

  it('only questions a level below what the source gives', () => {
    const rod = find('wild|Super Rod|Route 10')
    expect(levelHint(rod)).toBe('Lv. 15')
    expect(levelHint(null)).toBe('')
    expect(levelOutside(rod, 14)).toBe(true)
    expect(levelOutside(rod, 15)).toBe(false)
    expect(levelOutside(rod, 60)).toBe(false)
    expect(levelOutside(rod, null)).toBe(false)
    expect(levelOutside(find('static||Route 11'), 1)).toBe(false)
  })
})

describe('PID, IVs and EVs in the editor', () => {
  const options = { today: '2026-10-09' }
  const NONE = [null, null, null, null, null, null]
  const base = (): Draft => ({ ...draftFromPreset(dex, { species: ID.pikachu, form: 0 }, DEFAULTS), game: 'red' })

  it('stores a PID padded to 8 digits, upper case', () => {
    expect(parsePid('')).toBeUndefined()
    expect(parsePid('   ')).toBeUndefined()
    expect(parsePid('beef')).toBe('0000BEEF')
    expect(parsePid(' 1a2B3c4D ')).toBe('1A2B3C4D')
    expect(parsePid('0')).toBe('00000000')
    for (const bad of ['123456789', 'xyz', '0x1F', '12 34', '-1']) expect(parsePid(bad)).toBeNull()
  })

  it('takes six values or none', () => {
    expect(parseSpread(NONE, 31)).toBeUndefined()
    expect(parseSpread([31, 0, 31, 0, 31, 0], 31)).toEqual([31, 0, 31, 0, 31, 0])
    expect(parseSpread([31, null, 31, 0, 31, 0], 31)).toBeNull()
    expect(parseSpread([31, 32, 31, 0, 31, 0], 31)).toBeNull()
    expect(parseSpread([31, 1.5, 31, 0, 31, 0], 31)).toBeNull()
    expect(parseSpread([31, -1, 31, 0, 31, 0], 31)).toBeNull()
    expect(parseSpread([255, 0, 0, 0, 0, 0], 255)).toEqual([255, 0, 0, 0, 0, 0])
    expect(parseSpread([], 31)).toBeUndefined()
  })

  it('starts empty, and reads an entry back exactly', () => {
    const fresh = base()
    expect(fresh).toMatchObject({ pid: '', ivs: NONE, evs: NONE })
    expect(hasValues(fresh)).toBe(false)
    expect(hasErrors(validateDraft(dex, fresh, options))).toBe(false)
    const input = draftToInput(fresh)
    for (const key of ['pid', 'ivs', 'evs']) expect(input).not.toHaveProperty(key)

    const entry = makeEntry(ID.pikachu, 0, { game: 'red', pid: '0000BEEF', ivs: [31, 31, 31, 31, 31, 0], evs: [0, 0, 0, 0, 0, 0] })
    const draft = draftFromEntry(entry)
    expect(hasValues(draft)).toBe(true)
    expect(draftToPatch(draft)).toMatchObject({ pid: '0000BEEF', ivs: [31, 31, 31, 31, 31, 0], evs: [0, 0, 0, 0, 0, 0] })
    expect(sameDraft(draft, draftFromEntry(entry))).toBe(true)
  })

  it('says plainly what is wrong', () => {
    expect(validateDraft(dex, { ...base(), pid: 'nope' }, options)).toEqual({ pid: 'Use 1 to 8 hex digits (0–9, A–F).' })
    expect(validateDraft(dex, { ...base(), ivs: [31, null, null, null, null, null] }, options)).toEqual({ ivs: 'Fill in all six IVs, or leave all six empty.' })
    expect(validateDraft(dex, { ...base(), evs: [0, 0, 0, 0, 0, 300] }, options)).toEqual({ evs: 'Use whole numbers from 0 to 255 for the EVs.' })
    expect(validateDraft(dex, { ...base(), pid: 'a', ivs: [0, 0, 0, 0, 0, 0], evs: [255, 255, 255, 255, 255, 255] }, options)).toEqual({})
  })

  it('clears a value with a patch, and does not carry any to another game', () => {
    const draft = { ...base(), pid: 'beef', ivs: [1, 2, 3, 4, 5, 6] }
    expect(draftToInput(draft)).toMatchObject({ pid: '0000BEEF', ivs: [1, 2, 3, 4, 5, 6] })
    const cleared = draftToPatch({ ...draft, pid: '', ivs: NONE })
    expect('pid' in cleared && cleared.pid === undefined && 'ivs' in cleared && cleared.ivs === undefined).toBe(true)
    expect(draftForAnotherGame(dex, draft, DEFAULTS)).toMatchObject({ pid: '', ivs: NONE, evs: NONE })
  })
})

describe('the ability in the editor', () => {
  const base = (): Draft => ({ ...draftFromPreset(dex, { species: ID.pikachu, form: 0 }, DEFAULTS), game: 'red' })

  it('starts empty, and reads an entry back exactly', () => {
    expect(base()).toMatchObject({ ability: null, abilityHidden: false })
    expect(draftToInput(base())).not.toHaveProperty('ability')
    expect(draftToInput(base())).not.toHaveProperty('abilityHidden')
    const entry = makeEntry(ID.pikachu, 0, { game: 'red', ability: 31, abilityHidden: true })
    const draft = draftFromEntry(entry)
    expect(draft).toMatchObject({ ability: 31, abilityHidden: true })
    expect(draftToPatch(draft)).toMatchObject({ ability: 31, abilityHidden: true })
    expect(checkEntry(draftToPreview(draft, NOW), NOW).repaired).toBe(false)
  })

  it('stores Hidden only when ticked, and never without an ability', () => {
    expect(draftToInput({ ...base(), ability: 9 })).toMatchObject({ ability: 9 })
    expect(draftToInput({ ...base(), ability: 9 })).not.toHaveProperty('abilityHidden')
    const cleared = draftToPatch({ ...base(), ability: null, abilityHidden: true })
    expect('ability' in cleared && cleared.ability === undefined && 'abilityHidden' in cleared && cleared.abilityHidden === undefined).toBe(true)
    expect(draftToInput({ ...base(), ability: 9999, abilityHidden: true })).not.toHaveProperty('ability')
    expect(draftFromEntry(makeEntry(ID.pikachu, 0, { game: 'red', abilityHidden: true }))).toMatchObject({ ability: null, abilityHidden: false })
  })

  it('belongs to one catch', () => {
    expect(draftForAnotherGame(dex, { ...base(), ability: 31, abilityHidden: true }, DEFAULTS)).toMatchObject({ ability: null, abilityHidden: false })
  })

  it('offers every ability name once, in alphabetical order', () => {
    const options = abilityOptions(null)
    const labels = options.map((o) => o.label)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'en')))
    expect(options.find((o) => o.label === 'As One')?.value).toBe(266)
    expect(options.find((o) => o.label === 'Static')?.value).toBe(9)
    // An entry that holds the second "As One" keeps its own id selectable.
    expect(abilityOptions(267).find((o) => o.label === 'As One')?.value).toBe(267)
    expect(abilityOptions(267)).toHaveLength(options.length)
  })
})
