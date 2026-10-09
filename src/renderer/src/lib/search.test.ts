import { describe, expect, it } from 'vitest'
import type { FormSummary, SpeciesSummary } from '@shared/dex-types'
import { DexSearch, getDexSearch, normalizeText, searchDex, type SearchHit } from './search'
import { fixtureDex as dex, ID } from './test-fixture'

const search = (query: string, options?: Parameters<DexSearch['search']>[1]): SearchHit[] => searchDex(dex, query, options)
/** "Name" for a species hit, "Full form name*" for a form hit. */
const names = (hits: SearchHit[]): string[] => hits.map((h) => (h.viaForm ? `${h.form.full}*` : h.species.name))
const first = (query: string): SearchHit => {
  const hit = search(query)[0]
  if (!hit) throw new Error(`no hit for "${query}"`)
  return hit
}

describe('normalizeText', () => {
  it.each([
    ['Flabébé', 'flabebe'],
    ['Farfetch’d', 'farfetchd'],
    ["Farfetch'd", 'farfetchd'],
    ['Mr. Mime', 'mr mime'],
    ['Ho-Oh', 'ho oh'],
    ['Type: Null', 'type null'],
    ['Nidoran♀', 'nidoran f'],
    ['Nidoran♂', 'nidoran m'],
    ['Porygon-Z', 'porygon z'],
    ['  PIKACHU  ', 'pikachu'],
    ['Vivillon (Poké Ball)', 'vivillon poke ball'],
    ['Ｐｉｋａ', 'pika'], // full-width letters
    ['Unown !', 'unown exclamation'],
    ['Unown ?', 'unown question'],
    ['...', '']
  ])('%s -> %s', (input, expected) => {
    expect(normalizeText(input)).toBe(expected)
  })
})

describe('ranking', () => {
  it('puts an exact dex number first', () => {
    expect(first('25')).toMatchObject({ species: { id: 25 }, rank: 'number', viaForm: false })
    expect(first('#25').species.id).toBe(25)
    expect(first('0025').species.id).toBe(25)
    expect(first(' #0025 ').species.id).toBe(25)
    expect(first('1007').species.name).toBe('Koraidon')
  })

  it('follows an exact number with numbers that start with the digits', () => {
    expect(search('2').map((h) => h.species.id)).toEqual([2, 25, 26, 201])
    expect(search('66').map((h) => h.species.id)).toEqual([664, 665, 666])
    expect(search('9999')).toEqual([])
  })

  it('ranks exact name, then prefix, then word prefix, then substring', () => {
    // exact species, then forms whose name contains the word
    expect(names(search('raichu'))).toEqual(['Raichu', 'Alolan Raichu*', 'Mega Raichu X*', 'Mega Raichu Y*'])
    expect(search('raichu').map((h) => h.rank)).toEqual(['exact', 'word', 'word', 'word'])

    // prefix
    expect(names(search('pi')).slice(0, 2)).toEqual(['Pikachu', 'Pichu'])
    expect(search('pi').slice(0, 2).every((h) => h.rank === 'prefix')).toBe(true)

    // substring only
    // substring only: earliest match position first
    expect(search('chu', { forms: false }).map((h) => [h.species.name, h.rank])).toEqual([['Pichu', 'substring'], ['Raichu', 'substring'], ['Pikachu', 'substring']])
  })

  it('lists species before forms within a rank, in dex order', () => {
    const hits = search('me')
    expect(names(hits).slice(0, 3)).toEqual(['Mewtwo', 'Meowstic', 'Meowscarada'])
    expect(hits.slice(0, 3).every((h) => h.rank === 'prefix' && !h.viaForm)).toBe(true)
    expect(names(hits)).toContain('Mega Venusaur*')
    expect(names(hits).indexOf('Mega Venusaur*')).toBeGreaterThan(2)
  })

  it('prefers the species over its identically named base form', () => {
    const hits = search('unown')
    expect(hits[0]).toMatchObject({ species: { id: 201 }, viaForm: false, rank: 'exact' })
    expect(hits.filter((h) => h.species.id === 201 && h.form.f === 0)).toHaveLength(1)
    expect(names(hits).slice(1, 4)).toEqual(['Unown B*', 'Unown C*', 'Unown D*'])
  })
})

describe('forms', () => {
  it('returns the matched form', () => {
    expect(first('alolan raichu')).toMatchObject({ species: { id: 26 }, form: { f: 1 }, viaForm: true, rank: 'exact' })
    expect(first('alolan')).toMatchObject({ species: { id: 26 }, form: { f: 1 }, viaForm: true, rank: 'prefix' })
    expect(first('unown b')).toMatchObject({ species: { id: 201 }, form: { f: 1 }, rank: 'exact' })
    expect(first('heat rotom')).toMatchObject({ species: { id: 479 }, form: { f: 1 } })
    expect(first('crowned')).toMatchObject({ species: { id: 888 }, form: { f: 1 }, rank: 'word' })
  })

  it('matches query words in any order against word starts', () => {
    expect(first('raichu alola')).toMatchObject({ form: { full: 'Alolan Raichu' }, rank: 'word' })
    expect(first('mewtwo mega y')).toMatchObject({ form: { full: 'Mega Mewtwo Y' }, rank: 'word' })
    expect(names(search('mega x'))).toEqual(['Mega Raichu X*', 'Mega Mewtwo X*'])
    expect(first('cap hoenn').form.full).toBe('Hoenn Cap Pikachu')
  })

  it('is accent- and punctuation-insensitive', () => {
    expect(first('poke ball').form.full).toBe('Vivillon (Poké Ball)')
    expect(first('POKÉ BALL').form.full).toBe('Vivillon (Poké Ball)')
    expect(first('vivillon icy-snow').form.full).toBe('Vivillon (Icy Snow)')
    expect(first('spiky eared').form.full).toBe('Spiky-eared Pichu')
    expect(first('spikyeared').form.full).toBe('Spiky-eared Pichu')
  })

  it('does not index hidden forms', () => {
    expect(search('limited build')).toEqual([])
    expect(search('legend').every((h) => h.species.id !== ID.arceus)).toBe(true)
    // Scatterbug's hidden pattern forms share its name and add no hits.
    expect(search('scatterbug')).toHaveLength(1)
  })

  it('can be limited to species', () => {
    expect(search('alolan', { forms: false })).toEqual([])
    expect(names(search('raichu', { forms: false }))).toEqual(['Raichu'])
  })
})

describe('typo tolerance', () => {
  it('finds near misses when nothing matches as typed', () => {
    expect(first('pikachuu')).toMatchObject({ species: { id: 25 }, rank: 'fuzzy' })
    expect(first('bulbasuar').species.name).toBe('Bulbasaur') // swapped letters
    expect(first('meowstik').species.name).toBe('Meowstic')
    expect(first('sprigatto').species.name).toBe('Sprigatito') // missing letter
    expect(first('vivilon').species.name).toBe('Vivillon')
    expect(first('alolan raichoo').form.full).toBe('Alolan Raichu') // two edits allowed from 8 letters
  })

  it('also matches a mistyped later word of a name', () => {
    expect(first('raichuu').species.name).toBe('Raichu')
    expect(names(search('raichuu'))).toEqual(['Raichu', 'Alolan Raichu*', 'Mega Raichu X*', 'Mega Raichu Y*'])
    expect(search('raichoo')).toEqual([]) // two edits are too many for seven letters
  })

  it('stays out of the way when the query matches as typed', () => {
    expect(names(search('pich', { forms: false }))).toEqual(['Pichu'])
    expect(search('pika').every((h) => h.rank !== 'fuzzy')).toBe(true)
  })

  it('does not guess for short or hopeless queries', () => {
    expect(search('pkc')).toEqual([])
    expect(search('zzzz')).toEqual([])
    expect(search('xikachu')).toEqual([]) // first letter must match
    expect(search('pikaxxxx')).toEqual([])
  })
})

describe('options and helpers', () => {
  it('returns nothing for an empty or symbol-only query', () => {
    expect(search('')).toEqual([])
    expect(search('   ')).toEqual([])
    expect(search('...')).toEqual([])
    expect(search('?!')).toEqual([])
  })

  it('finds the punctuation Unown', () => {
    expect(first('unown ?')).toMatchObject({ form: { full: 'Unown ?', f: 27 }, rank: 'exact' })
    expect(first('unown!').form.full).toBe('Unown !')
    expect(first('?').form.full).toBe('Unown ?')
  })

  it('honours the limit', () => {
    expect(search('a', { limit: 5 })).toHaveLength(5)
    expect(search('a', { limit: 0 })).toEqual([])
    expect(search('unown').length).toBe(28)
    expect(search('a').length).toBe(50) // default
  })

  it('speciesIds lists each matching species once, best first', () => {
    const index = getDexSearch(dex)
    expect(index.speciesIds('mega')).toEqual([3, 26, 150, 678])
    expect(index.speciesIds('raichu')).toEqual([26])
    expect(index.speciesIds('cap')).toEqual([25])
    expect(index.speciesIds('chu')).toEqual([172, 26, 25])
    expect(index.speciesIds('')).toEqual([])
  })

  it('caches one index per Dex', () => {
    expect(getDexSearch(dex)).toBe(getDexSearch(dex))
  })

  it('works on tricky real names', () => {
    const form = (full: string): FormSummary => ({ f: 0, name: '', full, cat: 'base', types: ['normal'], sprite: '1', shiny: true, female: false, present: [0], obtain: [], event: [] })
    const species = (id: number, name: string): SpeciesSummary => ({ id, slug: '', name, genus: '', gen: 1, tags: [], genderRate: 4, genderDiff: false, family: id, forms: [form(name)] })
    const index = new DexSearch([
      species(29, 'Nidoran♀'), species(32, 'Nidoran♂'), species(83, 'Farfetch’d'), species(122, 'Mr. Mime'), species(250, 'Ho-Oh'),
      species(474, 'Porygon-Z'), species(669, 'Flabébé'), species(772, 'Type: Null'), species(137, 'Porygon'), species(233, 'Porygon2')
    ])
    const top = (q: string) => index.search(q)[0]?.species.name
    expect(top('flabebe')).toBe('Flabébé')
    expect(top('farfetchd')).toBe('Farfetch’d')
    expect(top("farfetch'd")).toBe('Farfetch’d')
    expect(top('mr mime')).toBe('Mr. Mime')
    expect(top('mime')).toBe('Mr. Mime')
    expect(top('hooh')).toBe('Ho-Oh')
    expect(top('ho-oh')).toBe('Ho-Oh')
    expect(top('type null')).toBe('Type: Null')
    expect(top('null')).toBe('Type: Null')
    expect(top('nidoran f')).toBe('Nidoran♀')
    expect(top('nidoran♂')).toBe('Nidoran♂')
    expect(index.search('porygon').map((h) => h.species.name)).toEqual(['Porygon', 'Porygon2', 'Porygon-Z'])
    expect(top('porygon z')).toBe('Porygon-Z')
    expect(top('porygon2')).toBe('Porygon2')
    // Numbers starting with the digits; Porygon2 also matches by name but is listed once.
    expect(index.search('2').map((h) => h.species.id)).toEqual([29, 233, 250])
  })
})
