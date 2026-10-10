import { describe, expect, it } from 'vitest'
import { BALL_BY_ID } from '@shared/balls'
import type { GameSaveContents } from '@shared/game-save-types'
import { DEFAULT_RULES, type CatchEntry } from '@shared/save-types'
import type { ShinyDexHistory, ShinyDexKnown, ShinyDexRow } from '@shared/shinydex-types'
import { checkEntry } from '@renderer/lib/storage'
import { fixtureDex as dex, ID } from '@renderer/lib/test-fixture'
import { buildPreview, countChosen, entriesToComplete, entriesToImport, gameSaveSource, selectAllNew, selectFilling } from './model'
import { ballOfSlug, buildShinyDexPreview, entryFromRow, fingerprintsOf, gameOfSlug, kindOfMethod, kindOfRow, resolvePokemon, shinyDexFailureText, shinyDexSource, SHINYDEX_FAILURE_TEXT } from './shinydex'

const TODAY = '2026-06-01'
const NOW = '2026-06-01T10:00:00.000Z'

const hunt = (name: string, extra: Partial<ShinyDexRow> = {}): ShinyDexRow => ({ index: 0, name, pokemon: name.toLowerCase(), game: 'za', method: 'Random Encounters', date: '2026-01-08', ball: 'quickBall', ...extra })
/** The same hunt as an entry of an export: the Pokémon by number, no ball. */
const exported = (species: number, form = 0, extra: Partial<ShinyDexRow> = {}, known: Partial<ShinyDexKnown> = {}): ShinyDexRow => ({ index: 0, name: '', pokemon: '', game: 'za', method: 'Random Encounters', date: '2026-01-08', ball: '', ...extra, known: { species, form, shiny: true, kind: 'wild', ...known } })
const history = (rows: ShinyDexRow[]): ShinyDexHistory => ({ fileName: 'History _ ShinyDex.html', source: rows.some((r) => r.known) ? 'export' : 'page', rows: rows.map((r, index) => ({ ...r, index })), dropped: 0, unusable: 0 })
const preview = (rows: ShinyDexRow[], existing: CatchEntry[] = []) => buildShinyDexPreview(dex, history(rows), existing, DEFAULT_RULES, { today: TODAY })
let serial = 0
const importAll = (rows: ShinyDexRow[], existing: CatchEntry[] = []): CatchEntry[] => {
  const p = preview(rows, existing)
  return entriesToImport(p.rows, selectAllNew(p.rows), existing, NOW, () => `id-${++serial}`)
}

describe('games', () => {
  it('maps ShinyDex game slugs to the games of the app', () => {
    const ids = (slugs: string[]) => slugs.map((s) => gameOfSlug(s)?.id)
    const same = ['firered', 'violet', 'sword', 'scarlet', 'emerald', 'soulsilver', 'white', 'pearl', 'sapphire', 'shield', 'brilliantdiamond', 'y', 'heartgold', 'black2', 'omegaruby', 'ultramoon', 'shiningpearl', 'legendsarceus', 'letsgoeevee', 'xd', 'go']
    expect(ids(same)).toEqual(same)
    expect(ids(['za', 'ZA', 'pla'])).toEqual(['legendsza', 'legendsza', 'legendsarceus'])
  })

  it('knows no game for anything else', () => {
    for (const slug of ['', 'home', 'stadium', 'mystery', 'constructor', '__proto__', 'za2']) expect(gameOfSlug(slug)).toBeUndefined()
  })
})

describe('methods', () => {
  it('gives the kind a method clearly implies', () => {
    for (const m of ['Random Encounters', 'Horde Encounter', 'Safari Encounters', 'Poké Radar', 'Chain Fishing', 'Zone Resets', 'Bench Resets', 'Hyperspace encounter', 'Run Away', ' random  encounters ']) expect(kindOfMethod(m)).toBe('wild')
    expect(kindOfMethod('Masuda Method')).toBe('bred')
    expect(kindOfMethod('Dynamax Adventures')).toBe('raid')
    expect(kindOfMethod('Tera Raids')).toBe('tera')
    expect(kindOfMethod('Mass Outbreaks')).toBe('outbreak')
  })

  it('says "other" for the unclear and the unknown', () => {
    for (const m of ['Soft Resets', 'Game Corner', 'Something New', '', 'constructor']) expect(kindOfMethod(m)).toBe('other')
  })
})

describe('the kind of a row', () => {
  const kind = (method: string, own?: string) => kindOfRow({ method, ...(own !== undefined && { known: { species: 1, form: 0, shiny: true, kind: own } }) })

  it("lets a method of ShinyDex decide, also against the file's own kind", () => {
    expect(kind('Masuda Method', 'wild')).toBe('bred')
    expect(kind('Dynamax Adventures', 'wild')).toBe('raid')
    expect(kind('Random Encounters', 'gift')).toBe('wild')
    expect(kind('Masuda Method')).toBe('bred')
  })

  it("takes the file's own kind for any other method, when it is a kind", () => {
    expect(kind('Starter', 'gift')).toBe('gift')
    expect(kind('Level up', ' Evolved ')).toBe('evolved')
    expect(kind('Soft Resets', 'wild')).toBe('wild')
    expect(kind('', 'transfer')).toBe('transfer')
  })

  it('says "other" for everything else', () => {
    for (const own of ['', 'shiny', 'constructor', '__proto__', 'toString']) expect(kind('Soft Resets', own)).toBe('other')
    expect(kind('Soft Resets')).toBe('other')
  })
})

describe('balls', () => {
  it('finds a ball by its name', () => {
    const names = (slugs: string[]) => slugs.map((s) => BALL_BY_ID.get(ballOfSlug(s) ?? -1)?.name)
    expect(names(['pokeBall', 'quickBall', 'ultraBall', 'masterBall', 'dreamBall', 'safariBall', 'fastBall', 'premierBall'])).toEqual(['Poké Ball', 'Quick Ball', 'Ultra Ball', 'Master Ball', 'Dream Ball', 'Safari Ball', 'Fast Ball', 'Premier Ball'])
  })

  it('has no ball for an unknown slug', () => {
    for (const slug of ['', 'ball', 'shinyBall', 'constructor']) expect(ballOfSlug(slug)).toBeNull()
  })
})

describe('resolvePokemon', () => {
  const at = (name: string, pokemon: string) => resolvePokemon(dex, { name, pokemon })

  it('finds species and forms by the name shown', () => {
    expect(at('Pichu', 'pichu')).toEqual([ID.pichu, 0])
    expect(at('Alolan Raichu', 'raichu-alolan')).toEqual([ID.raichu, 1])
    expect(at('Raichu', 'raichu')).toEqual([ID.raichu, 0])
    expect(at('Heat Rotom', 'rotom-heat')).toEqual([ID.rotom, 1])
  })

  it('falls back on the slug of the picture, and on the name when the picture is missing', () => {
    expect(at('Pichu (DE)', 'pichu')).toEqual([ID.pichu, 0])
    expect(at('Alola-Raichu', 'raichu-alolan')).toEqual([ID.raichu, 1])
    expect(at('Raichu', 'raichu-alolan')).toEqual([ID.raichu, 1])
    expect(at('Eevee', '')).toEqual([ID.eevee, 0])
  })

  it('takes the female form where the species has one, and nothing more from "-f"', () => {
    expect(at('Meowstic', 'meowstic-f')).toEqual([ID.meowstic, 1])
    expect(at('Meowstic', 'meowstic')).toEqual([ID.meowstic, 0])
    expect(at('Eevee', 'eevee-f')).toEqual([ID.eevee, 0])
  })

  it('takes the numbers of an export when the datasets have that form', () => {
    expect(resolvePokemon(dex, exported(ID.raichu, 1))).toEqual([ID.raichu, 1])
    expect(resolvePokemon(dex, exported(ID.pichu))).toEqual([ID.pichu, 0])
    expect(resolvePokemon(dex, exported(ID.pichu, 7))).toBeNull()
    expect(resolvePokemon(dex, exported(99999))).toBeNull()
    expect(resolvePokemon(dex, { ...exported(99999), name: 'Pichu', pokemon: 'pichu' })).toBeNull()
  })

  it('does not guess', () => {
    expect(at('Missingno', 'missingno')).toBeNull()
    expect(at('Galarian Pichu', 'pichu-galarian')).toBeNull()
    expect(at('', '')).toBeNull()
  })
})

describe('entries', () => {
  it('fills in the Pokémon, game, kind, method, date and ball, and nothing else', () => {
    const [entry] = importAll([hunt('Pichu', { method: 'Masuda Method', game: 'soulsilver', ball: 'luxuryBall', date: '2025-02-14' })])
    expect(entry).toEqual({ id: expect.any(String), createdAt: NOW, updatedAt: NOW, species: ID.pichu, form: 0, shiny: true, game: 'soulsilver', kind: 'bred', method: 'Masuda Method', ball: ballOfSlug('luxuryBall'), date: '2025-02-14', fingerprint: expect.stringMatching(/^shinydex:/) })
    expect(checkEntry(entry, NOW)).toMatchObject({ repaired: false, entry: { fingerprint: entry!.fingerprint } })
  })

  it('leaves out an unknown ball and a date in the future', () => {
    const entry = entryFromRow(dex, hunt('Pichu', { ball: 'shinyBall', date: '2030-01-01', method: 'Soft Resets' }), [ID.pichu, 0], 'sword', 'shinydex:x', TODAY)
    expect(entry).toEqual({ species: ID.pichu, form: 0, shiny: true, game: 'sword', kind: 'other', method: 'Soft Resets', fingerprint: 'shinydex:x' })
  })
})

describe('entries of an export', () => {
  it('keeps the details the file has, when they are valid', () => {
    const [entry] = importAll([exported(ID.raichu, 0, { method: 'Thunder Stone', game: 'firered', date: '2025-02-14' }, { kind: 'evolved', location: ' Route 1 ', ball: 4, level: 22, ot: 'Red', nickname: 'Sparky', origin: [ID.pichu, 0] })])
    expect(entry).toEqual({ id: expect.any(String), createdAt: NOW, updatedAt: NOW, species: ID.raichu, form: 0, shiny: true, game: 'firered', kind: 'evolved', method: 'Thunder Stone', location: 'Route 1', origin: [ID.pichu, 0], ball: 4, level: 22, ot: 'Red', nickname: 'Sparky', date: '2025-02-14', fingerprint: expect.stringMatching(/^shinydex:/) })
    expect(checkEntry(entry, NOW)).toMatchObject({ repaired: false })
  })

  it('leaves out what is absent or not valid', () => {
    const [plain] = importAll([exported(ID.pichu)])
    expect(plain).toEqual({ id: expect.any(String), createdAt: NOW, updatedAt: NOW, species: ID.pichu, form: 0, shiny: true, game: 'legendsza', kind: 'wild', method: 'Random Encounters', date: '2026-01-08', fingerprint: expect.stringMatching(/^shinydex:/) })
    const [odd] = importAll([exported(ID.pichu, 0, { method: '' }, { kind: 'gift', ball: 9999, level: 500, origin: [99999, 0], ot: 'x'.repeat(200), shiny: false })])
    expect(odd).toMatchObject({ kind: 'gift', shiny: false, ot: 'x'.repeat(40) })
    for (const key of ['ball', 'level', 'origin', 'method', 'location', 'nickname'] as const) expect(odd).not.toHaveProperty(key)
    // Where it evolved from is only kept for an evolved Pokémon.
    expect(importAll([exported(ID.raichu, 0, {}, { origin: [ID.pichu, 0] })])[0]).not.toHaveProperty('origin')
  })

  it('says why an entry cannot be imported', () => {
    const p = preview([exported(99999), exported(ID.pichu, 9), exported(ID.eevee, 0, { game: 'mystery' }), exported(ID.raichu, 1, { date: null })])
    expect(p.rows.map((r) => [r.name, r.status, r.reason])).toEqual([
      ['Unknown Pokémon', 'unsupported', 'Pelagix does not know this Pokémon.'],
      ['Pichu', 'unsupported', 'Pelagix does not know this Pokémon.'],
      ['Eevee', 'unsupported', 'Game not recognised (mystery).'],
      ['Alolan Raichu', 'unsupported', 'Its date could not be read.']
    ])
  })
})

describe('the export and the saved page of one history', () => {
  // The same five hunts as each file tells them: the page by name, picture and ball, the export by number.
  const onPage = [hunt('Pichu'), hunt('Pichu', { ball: 'pokeBall' }), hunt('Alolan Raichu', { pokemon: 'raichu-alolan', game: 'sword', method: 'Masuda Method', ball: 'luxuryBall' }), hunt('Eevee', { pokemon: '', method: 'Soft Resets', date: '2025-03-01' }), hunt('Meowstic', { pokemon: 'meowstic-f' })]
  const inExport = [exported(ID.pichu), exported(ID.pichu), exported(ID.raichu, 1, { game: 'sword', method: 'masuda  method' }), exported(ID.eevee, 0, { method: 'Soft Resets', date: '2025-03-01' }), exported(ID.meowstic, 1, { game: 'legendsza' })]

  it('gives both the same fingerprints', () => {
    expect(fingerprintsOf(dex, inExport)).toEqual(fingerprintsOf(dex, onPage))
    expect(fingerprintsOf(dex, onPage)[0]).toBe(`shinydex:${ID.pichu}.0|legendsza|randomencounters|2026-01-08#0`)
  })

  it('adds nothing twice: page then export', () => {
    const first = importAll(onPage)
    expect(first).toHaveLength(5)
    expect(preview(inExport, first).counts).toMatchObject({ new: 0, imported: 5, unsupported: 0 })
    expect(importAll(inExport, first)).toEqual([])
  })

  it('adds nothing twice: export then page', () => {
    const first = importAll(inExport)
    expect(first).toHaveLength(5)
    expect(preview(onPage, first).counts).toMatchObject({ new: 0, imported: 5, unsupported: 0 })
    expect(importAll(onPage, first)).toEqual([])
  })

  it('adds nothing twice: the same export again', () => {
    const first = importAll(inExport)
    expect(preview(inExport, first).counts).toMatchObject({ new: 0, imported: 5 })
    expect(importAll(inExport, first)).toEqual([])
  })

  it('adds only what the other file has more of', () => {
    const first = importAll(onPage)
    const more = [exported(ID.pichu), ...inExport, exported(ID.rotom, 1, { date: '2026-02-02' }), exported(ID.eevee, 0, { method: 'Soft Resets', date: '2025-03-02' })]
    const added = importAll(more, first)
    expect(added.map((e) => [e.species, e.form, e.date])).toEqual([[ID.pichu, 0, '2026-01-08'], [ID.rotom, 1, '2026-02-02'], [ID.eevee, 0, '2025-03-02']])
    expect(added[0]!.fingerprint).toMatch(/#2$/)
  })

  it('touches no rules, settings or achievements: only entries come out', () => {
    const rules = structuredClone(DEFAULT_RULES)
    const before = JSON.stringify(rules)
    const source = shinyDexSource({ ...history(inExport), settings: { rules: { shiny: false } }, achievements: { first: '2026-01-01' } } as ShinyDexHistory)
    const p = source.preview(dex, [], rules, { today: TODAY })
    const added = entriesToImport(p.rows, selectAllNew(p.rows), [], NOW, () => `id-${++serial}`)
    expect(JSON.stringify(rules)).toBe(before)
    expect(Object.keys(p).sort()).toEqual(['askGames', 'counts', 'rows'])
    expect(added).toHaveLength(5)
    expect(JSON.stringify([p, added])).not.toMatch(/settings|achievements|rules/)
    for (const e of added) expect(checkEntry(e, NOW)).toMatchObject({ repaired: false })
  })
})

describe('fingerprints', () => {
  const rows = [hunt('Pichu'), hunt('Pichu'), hunt('Eevee'), hunt('Pichu', { ball: 'pokeBall' })]

  it('numbers rows that agree in everything, whatever the ball', () => {
    const prints = fingerprintsOf(dex, rows)
    expect(new Set(prints).size).toBe(4)
    expect(prints[0]).toMatch(/#0$/)
    expect(prints[1]).toBe(prints[0]!.replace(/#0$/, '#1'))
    expect(prints[3]).toBe(prints[0]!.replace(/#0$/, '#2'))
    expect(prints.join()).not.toMatch(/ball/i)
    expect(fingerprintsOf(dex, [hunt('Pichu', { game: 'legendsza' })])).toEqual([prints[0]])
    expect(prints.every((p) => p!.startsWith('shinydex:') && p!.length <= 160)).toBe(true)
  })

  it('does not depend on how the page was saved', () => {
    const resaved = rows.map((r) => ({ ...r, pokemon: '', method: ` ${r.method.toUpperCase()} `, game: r.game.toUpperCase() }))
    expect(fingerprintsOf(dex, resaved)).toEqual(fingerprintsOf(dex, rows))
  })

  it('has none for a row that cannot be imported', () => {
    expect(fingerprintsOf(dex, [hunt('Missingno'), hunt('Pichu', { date: null }), hunt('Pichu', { game: 'mystery' })])).toEqual([null, null, null])
  })

  it('adds nothing when the same page is imported twice', () => {
    const first = importAll(rows)
    expect(first).toHaveLength(4)
    expect(preview(rows, first).counts).toMatchObject({ new: 0, imported: 4, unsupported: 0 })
    expect(importAll(rows, first)).toEqual([])
  })

  it('adds only the new hunts of a later page, even one identical to an earlier hunt', () => {
    const first = importAll(rows)
    const later = [hunt('Pichu'), hunt('Raichu', { date: '2026-02-01' }), ...rows]
    expect(preview(later, first).counts).toMatchObject({ new: 2, imported: 4 })
    const added = importAll(later, first)
    expect(added.map((e) => e.species).sort()).toEqual([ID.raichu, ID.pichu].sort())
    // Three Pichu agree already (the ball does not tell them apart), so the new one is the fourth.
    expect(added.find((e) => e.species === ID.pichu)!.fingerprint).toMatch(/#3$/)
    expect(preview(later, [...first, ...added]).counts).toMatchObject({ new: 0, imported: 6 })
  })
})

describe('buildShinyDexPreview', () => {
  it('sorts rows into new, already imported and cannot be imported, with the reason', () => {
    const p = preview([hunt('Pichu'), hunt('Missingno'), hunt('Eevee', { game: 'mystery' }), hunt('Raichu', { date: null }), hunt('Alolan Raichu', { pokemon: 'raichu-alolan' })])
    expect(p.rows.map((r) => [r.name, r.status, r.reason])).toEqual([
      ['Pichu', 'new', undefined],
      ['Missingno', 'unsupported', 'Pelagix does not know this Pokémon.'],
      ['Eevee', 'unsupported', 'Game not recognised (mystery).'],
      ['Raichu', 'unsupported', 'Its date could not be read.'],
      ['Alolan Raichu', 'new', undefined]
    ])
    expect(p.counts).toEqual({ new: 2, imported: 0, egg: 0, unsupported: 3, fills: 2, completes: 0 })
    expect(p.askGames).toEqual([])
    expect(p.rows[4]!.pokemon).toMatchObject({ species: ID.raichu, form: 1, shiny: true })
    expect(p.rows[0]!.game?.id).toBe('legendsza')
  })

  it('marks only the first of two hunts as filling a slot, and works with the quick choices', () => {
    const p = preview([hunt('Pichu'), hunt('Pichu'), hunt('Eevee')])
    expect(p.rows.map((r) => r.fills)).toEqual([true, false, true])
    expect(countChosen(p.rows, selectFilling(p.rows))).toBe(2)
    expect(countChosen(p.rows, selectAllNew(p.rows))).toBe(3)
    expect(entriesToComplete(p.rows, [])).toEqual([])
  })

  it('never throws on a malformed answer', () => {
    const bad = { fileName: 'x', dropped: 0, rows: [null, 3, {}, { name: 'Pichu' }, hunt('Pichu')] } as unknown as ShinyDexHistory
    const p = buildShinyDexPreview(dex, bad, [], DEFAULT_RULES, { today: TODAY })
    expect(p.rows.map((r) => r.status)).toEqual(['unsupported', 'unsupported', 'unsupported', 'unsupported', 'new'])
    expect(buildShinyDexPreview(dex, null as unknown as ShinyDexHistory, [], DEFAULT_RULES, { today: TODAY }).rows).toEqual([])
  })
})

describe('wording', () => {
  it('has one sentence per failure', () => {
    for (const reason of ['not-shinydex', 'too-large', 'unreadable'] as const) expect(shinyDexFailureText(reason)).toBe(SHINYDEX_FAILURE_TEXT[reason])
    expect(shinyDexFailureText('constructor')).toBe('Something went wrong while reading that file.')
    expect(shinyDexFailureText(undefined)).toBe('Something went wrong while reading that file.')
    expect(SHINYDEX_FAILURE_TEXT['not-shinydex']).toMatch(/neither a ShinyDex export nor a saved ShinyDex History page/)
  })

  it('describes a history as what it is', () => {
    const source = shinyDexSource(history([hunt('Pichu'), hunt('Eevee')]))
    expect(source.description).toContain('History _ ShinyDex.html is a saved ShinyDex history with 2 shiny Pokémon.')
    expect(source.description).not.toMatch(/trainer|save file/)
    expect(source.note).toBeUndefined()
    expect(shinyDexSource({ ...history([hunt('Pichu')]), dropped: 5 }).note).toContain('5')
    expect(source.preview(dex, [], DEFAULT_RULES, { today: TODAY }).counts.new).toBe(2)
  })

  it('describes an export as what it is', () => {
    const source = shinyDexSource({ ...history([exported(ID.pichu)]), fileName: 'shinydex.json', unusable: 2 })
    expect(source.description).toContain('shinydex.json is a ShinyDex export with 1 shiny Pokémon.')
    expect(source.description).toContain('Your rules, settings and achievements stay as they are.')
    expect(source.description).not.toMatch(/saved|page|ball/)
    expect(source.note).toBe('2 entries in this file could not be read and are left out.')
    expect(shinyDexSource({ ...history([exported(ID.pichu)]), dropped: 5, unusable: 1 }).note).toMatch(/The last 5 are left out\. 1 entry in this file could not be read and is left out\.$/)
  })
})

describe('a game save through the same window', () => {
  const contents: GameSaveContents = {
    fileName: 'main',
    save: { type: 'SAV8SWSH', version: { id: 44, name: 'SW' }, generation: 8, trainer: 'Red', boxes: 32, boxSlots: 30 },
    pokemon: [
      {
        place: 'box', box: 0, boxName: 'Box 1', slot: 0, species: ID.pichu, form: 0, formArgument: null, gender: 'm', shiny: false, gmax: false, alpha: false, egg: false, ball: 4,
        version: { id: 44, name: 'SW' }, metLocation: { id: 1, name: 'Route 1' }, eggLocation: null, metLevel: 5, metDate: '2024-03-02', level: 30, nickname: null, ot: 'Red', fateful: false, legal: true,
        encounter: null, ability: null, abilityHidden: false, pid: null, ivs: null, evs: null, fingerprint: '44:00001:abcd'
      }
    ],
    dropped: 0
  }

  it('says what it said before and previews exactly what buildPreview does', () => {
    const source = gameSaveSource(contents)
    expect(source.description).toBe('main is a save of Pokémon Sword, trainer Red. Nothing has changed yet, and the save file is only read.')
    expect(source).toMatchObject({ fileName: 'main', icon: 'gamepad', empty: 'There are no Pokémon in this save.', listLabel: 'Pokémon in this save', columns: 'met' })
    expect(source.note).toBeUndefined()
    expect(gameSaveSource({ ...contents, dropped: 1 }).note).toBe('1 Pokémon in this save could not be read and is left out.')
    expect(gameSaveSource({ ...contents, save: { ...contents.save, trainer: '' } }).description).toBe('main is a save of Pokémon Sword. Nothing has changed yet, and the save file is only read.')
    const options = { today: TODAY, game: null }
    expect(source.preview(dex, [], DEFAULT_RULES, options)).toEqual(buildPreview(dex, contents, [], DEFAULT_RULES, options))
  })

  it('keeps its own fingerprints apart from those of ShinyDex', () => {
    const fromSave = buildPreview(dex, contents, [], DEFAULT_RULES, { today: TODAY })
    const saved = entriesToImport(fromSave.rows, selectAllNew(fromSave.rows), [], NOW, () => 'a')
    expect(saved).toHaveLength(1)
    expect(preview([hunt('Pichu')], saved).counts).toMatchObject({ new: 1, imported: 0 })
    const hunted = importAll([hunt('Pichu')])
    expect(buildPreview(dex, contents, hunted, DEFAULT_RULES, { today: TODAY }).counts).toMatchObject({ new: 1, imported: 0 })
  })
})
