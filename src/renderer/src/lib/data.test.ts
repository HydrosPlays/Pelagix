import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DexIndex, FormSummary, SpeciesSummary } from '@shared/dex-types'
import { GAMES } from '@shared/games'
import { createDataLoader, Dex, useDexStore, validateDexIndex, validateSpeciesDetail } from './data'
import { fixtureDetails, fixtureDex as dex, fixtureIndex, ID } from './test-fixture'

const form = (f: number, extra: Partial<FormSummary> = {}): FormSummary => ({
  f, name: '', full: 'Testmon', cat: f === 0 ? 'base' : 'cosmetic', types: ['normal'], sprite: '1', shiny: true, female: false, present: [], obtain: [], event: [], ...extra
})
const species = (id: number, forms: FormSummary[], family = id): SpeciesSummary => ({
  id, slug: `s${id}`, name: `Species ${id}`, genus: 'Test Pokémon', gen: 1, tags: [], genderRate: 4, genderDiff: false, family, forms
})
const index = (games: string[], list: SpeciesSummary[], gameBalls: number[][] = games.map(() => [])): DexIndex => ({
  meta: { builtAt: '2026-01-01T00:00:00.000Z', pkhexVersion: 'test', pokeapiCommit: 'x', spritesCommit: 'y', counts: { species: list.length, forms: 0, rows: 0 } },
  games, gameBalls, species: list
})

describe('Dex lookups (fixture)', () => {
  it('finds species by national dex number in a sparse index', () => {
    expect(dex.species(ID.pikachu)?.name).toBe('Pikachu')
    expect(dex.species(ID.koraidon)?.name).toBe('Koraidon')
    expect(dex.species(4)).toBeUndefined() // not in the fixture
    expect(dex.species(0)).toBeUndefined()
    expect(dex.speciesList).toHaveLength(24)
    expect(dex.speciesList.map((s) => s.id)).toEqual([...dex.speciesList.map((s) => s.id)].sort((a, b) => a - b))
  })

  it('finds forms by PKHeX form index', () => {
    expect(dex.form(ID.pikachu, 0)?.full).toBe('Pikachu')
    expect(dex.form(ID.pikachu, 8)?.full).toBe('Partner Pikachu')
    expect(dex.form(ID.raichu, 1)).toMatchObject({ full: 'Alolan Raichu', cat: 'regional', region: 'alola', sprite: '10100' })
    expect(dex.form(ID.vivillon, 6)?.sprite).toBe('666')
    expect(dex.form(ID.pikachu, 10)).toBeUndefined()
    expect(dex.form(4, 0)).toBeUndefined()
  })

  it('exposes metadata and the source', () => {
    expect(dex.meta.counts).toEqual({ species: 24, forms: 166, rows: 448 })
    expect(dex.source).toBe('fixture')
    expect(dex.isFixture).toBe(true)
    expect(new Dex(fixtureIndex).isFixture).toBe(false)
  })

  it('resolves games in canonical order', () => {
    expect(dex.games).toEqual(GAMES)
    expect(dex.unknownGameIds).toEqual([])
    expect(dex.gameIdx('red')).toBe(0)
    expect(dex.gameAt(dex.gameIdx('legendsza'))?.name).toBe('Pokémon Legends: Z-A')
    expect(dex.gameIdx('nope')).toBe(-1)
    expect(dex.gameAt(-1)).toBeUndefined()
    expect(dex.gameAt(999)).toBeUndefined()
  })

  it('lists the balls of a game in display order', () => {
    expect(dex.ballsFor('red').map((b) => b.slug)).toEqual(['poke', 'great', 'ultra', 'master'])
    expect(dex.ballsFor('legendsarceus').every((b) => b.family === 'hisui')).toBe(true)
    expect(dex.ballsFor('legendsarceus')).toHaveLength(9)
    expect(dex.ballsFor('home')).toEqual([])
    expect(dex.ballsFor('nope')).toEqual([])
    expect(dex.ballsFor('gold')).toBe(dex.ballsFor('gold'))
  })

  it('tells obtainable, event-only and merely present apart', () => {
    const pikachu = dex.form(ID.pikachu, 0)!
    expect(dex.isObtainable(pikachu, 'red')).toBe(true)
    expect(dex.isObtainable(pikachu, 'black')).toBe(true) // no encounter there, but Pichu evolves

    const mewtwo = dex.form(ID.mewtwo, 0)!
    expect(dex.isPresent(mewtwo, 'gold')).toBe(true)
    expect(dex.isObtainable(mewtwo, 'gold')).toBe(false) // transfer only
    expect(dex.isEventOnly(mewtwo, 'gold')).toBe(false)
    expect(dex.isEventOnly(mewtwo, 'black')).toBe(true)
    expect(dex.isObtainable(mewtwo, 'black')).toBe(false)
    expect(dex.isPresent(mewtwo, 'black')).toBe(true)
    expect(dex.isPresent(mewtwo, 'legendsarceus')).toBe(false)

    expect(dex.isObtainable(pikachu, 'nope')).toBe(false)
    expect(dex.isEventOnly(pikachu, 'nope')).toBe(false)
    expect(dex.isPresent(pikachu, 'nope')).toBe(false)
  })

  it('lists the games of a form in canonical order', () => {
    const alolan = dex.form(ID.raichu, 1)!
    expect(dex.obtainableGames(alolan).map((g) => g.id)).toEqual(['sun', 'moon', 'ultrasun', 'ultramoon', 'letsgopikachu', 'letsgoeevee', 'sword', 'shield', 'go'])
    expect(dex.eventGames(dex.form(ID.mewtwo, 0)!).map((g) => g.id)).toEqual(['black', 'white'])
    expect(dex.presentGames(dex.form(ID.koraidon, 0)!).map((g) => g.id)).toEqual(['scarlet', 'violet', 'home'])
    expect(dex.eventGames(alolan)).toEqual([])
    expect(dex.obtainableGames(alolan)).toBe(dex.obtainableGames(alolan))
  })

  it('lists evolution family members in dex order', () => {
    expect(dex.familyMembers(dex.species(ID.pikachu)!.family).map((s) => s.name)).toEqual(['Pikachu', 'Raichu', 'Pichu'])
    expect(dex.familyMembers(dex.species(ID.mewtwo)!.family).map((s) => s.id)).toEqual([150])
    expect(dex.familyMembers(-1)).toEqual([])
  })
})

describe('Dex with an unusual index', () => {
  const a = species(3, [form(0, { present: [0, 1, 2], obtain: [0, 2], event: [1] }), form(2, { present: [2] })], 9)
  const b = species(1, [form(0)], 9)
  const odd = new Dex(index(['violet', 'mystery-game', 'red'], [a, b], [[4, 1], [4], [3]]))

  it('sorts species by number whatever order the file uses', () => {
    expect(odd.speciesList.map((s) => s.id)).toEqual([1, 3])
    expect(odd.familyMembers(9).map((s) => s.id)).toEqual([1, 3])
  })

  it('maps game indexes through the dataset order, not the canonical one', () => {
    expect(odd.gameIdx('violet')).toBe(0)
    expect(odd.gameIdx('red')).toBe(2)
    expect(odd.gameAt(0)?.id).toBe('violet')
    expect(odd.gamesAt([0, 2]).map((g) => g.id)).toEqual(['red', 'violet'])
    expect(odd.games.map((g) => g.id)).toEqual(['red', 'violet'])
  })

  it('tolerates game ids the app does not know', () => {
    expect(odd.unknownGameIds).toEqual(['mystery-game'])
    expect(odd.gameAt(1)).toBeUndefined()
    expect(odd.gameIdx('mystery-game')).toBe(-1)
    expect(odd.obtainableGames(a.forms[0]!).map((g) => g.id)).toEqual(['red', 'violet'])
    expect(odd.eventGames(a.forms[0]!)).toEqual([]) // its only event game is the unknown one
    expect(odd.presentGames(a.forms[0]!).map((g) => g.id)).toEqual(['red', 'violet'])
    expect(odd.ballsFor('mystery-game')).toEqual([])
    expect(odd.ballsFor('violet').map((x) => x.slug)).toEqual(['poke', 'master'])
  })

  it('finds forms whose index is not their array position', () => {
    expect(odd.form(3, 2)?.present).toEqual([2])
    expect(odd.form(3, 1)).toBeUndefined()
  })

  it('counts the go flag as obtainable in Pokémon GO even when the lists omit it', () => {
    const flagged = species(5, [form(0, { go: 2, present: [0], obtain: [0] })])
    const eventOnly = species(6, [form(0, { go: 1, present: [0, 1], event: [1] })])
    const d = new Dex(index(['red', 'go'], [flagged, eventOnly]))
    expect(d.isObtainable(flagged.forms[0]!, 'go')).toBe(true)
    expect(d.isPresent(flagged.forms[0]!, 'go')).toBe(true)
    expect(d.obtainableGames(flagged.forms[0]!).map((g) => g.id)).toEqual(['red', 'go'])
    expect(d.presentGames(flagged.forms[0]!).map((g) => g.id)).toEqual(['red', 'go'])
    // ... unless the data says GO only has it through events.
    expect(d.isObtainable(eventOnly.forms[0]!, 'go')).toBe(false)
    expect(d.isEventOnly(eventOnly.forms[0]!, 'go')).toBe(true)
    expect(d.obtainableGames(eventOnly.forms[0]!)).toEqual([])
  })
})

describe('validateDexIndex', () => {
  const good = index(['red'], [species(1, [form(0)])], [[4]])

  it('accepts a well-formed index and the fixture', () => {
    expect(validateDexIndex(good)).toBe(good)
    expect(validateDexIndex(fixtureIndex)).toBe(fixtureIndex)
  })

  it.each<[string, unknown, RegExp]>([
    ['null', null, /top level is not an object/],
    ['an array', [], /top level is not an object/],
    ['a string', '<!doctype html>', /top level is not an object/],
    ['no meta', { ...good, meta: undefined }, /"meta"/],
    ['games of the wrong type', { ...good, games: [1] }, /"games"/],
    ['a gameBalls length mismatch', { ...good, gameBalls: [] }, /"gameBalls"/],
    ['no species', { ...good, species: [] }, /"species" is empty/],
    ['a species without id', { ...good, species: [{ name: 'x', forms: [form(0)] }] }, /species\[0\] has no id or name/],
    ['a duplicated species', { ...good, species: [species(1, [form(0)]), species(1, [form(0)])] }, /species 1 is listed twice/],
    ['a species without forms', { ...good, species: [species(1, [])] }, /has no forms/],
    ['a malformed form', { ...good, species: [species(1, [{ f: 0 } as FormSummary])] }, /malformed form/]
  ])('rejects %s', (_label, raw, message) => {
    expect(() => validateDexIndex(raw)).toThrow(message)
    expect(() => validateDexIndex(raw)).toThrow(/^Invalid dex\.json/)
  })
})

describe('validateSpeciesDetail', () => {
  it('accepts the fixture files and rejects a file for another species', () => {
    const detail = fixtureDetails.get(ID.pikachu)!
    expect(validateSpeciesDetail(detail, ID.pikachu)).toBe(detail)
    expect(() => validateSpeciesDetail(detail, ID.raichu)).toThrow('Invalid species/26.json')
    expect(() => validateSpeciesDetail({ id: 25 }, 25)).toThrow('Invalid species/25.json')
    expect(() => validateSpeciesDetail(null, 25)).toThrow()
  })
})

// ---------------------------------------------------------------- loader

type Route = unknown | (() => Response | Promise<Response>)

/** A fetch stand-in serving JSON from a route table; anything else is a 404. Records every requested URL. */
function fakeFetch(routes: Record<string, Route>) {
  const calls: string[] = []
  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    if (!(url in routes)) return new Response('Not found', { status: 404 })
    const route = routes[url]
    if (typeof route === 'function') return (route as () => Response | Promise<Response>)()
    return new Response(JSON.stringify(route), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  return { fetchFn, calls }
}

const html = (): Response => new Response('<!doctype html><html></html>', { status: 200, headers: { 'content-type': 'text/html' } })
const detail = (id: number) => fixtureDetails.get(id)!
const mainIndex = index(['red'], [species(1, [form(0)]), species(2, [form(0)]), species(3, [form(0)])], [[4]])
const miniDetail = (id: number) => ({ id, flavor: '', height: 1, weight: 1, dex: {}, strings: [], family: [], forms: { 0: { rows: [], evolve: [], breed: [] } } })

describe('loadDex', () => {
  it('loads ./data/dex.json when it exists', async () => {
    const { fetchFn, calls } = fakeFetch({ './data/dex.json': mainIndex, './data-fixture/dex.json': fixtureIndex })
    const loaded = await createDataLoader({ fetch: fetchFn, dev: true }).loadDex()
    expect(loaded.source).toBe('data')
    expect(loaded.speciesList).toHaveLength(3)
    expect(calls).toEqual(['./data/dex.json'])
  })

  it('falls back to the fixture in development when the dataset is a 404', async () => {
    const { fetchFn, calls } = fakeFetch({ './data-fixture/dex.json': fixtureIndex })
    const loaded = await createDataLoader({ fetch: fetchFn, dev: true }).loadDex()
    expect(loaded.source).toBe('fixture')
    expect(loaded.speciesList).toHaveLength(24)
    expect(calls).toEqual(['./data/dex.json', './data-fixture/dex.json'])
  })

  it('treats the dev server answering with index.html as missing', async () => {
    const { fetchFn } = fakeFetch({ './data/dex.json': html, './data-fixture/dex.json': fixtureIndex })
    expect((await createDataLoader({ fetch: fetchFn, dev: true }).loadDex()).source).toBe('fixture')
  })

  it('treats a failed request (file://) as missing', async () => {
    const { fetchFn } = fakeFetch({
      './data/dex.json': () => {
        throw new TypeError('Failed to fetch')
      },
      './data-fixture/dex.json': fixtureIndex
    })
    expect((await createDataLoader({ fetch: fetchFn, dev: true }).loadDex()).source).toBe('fixture')
  })

  it('never falls back outside development', async () => {
    const { fetchFn, calls } = fakeFetch({ './data-fixture/dex.json': fixtureIndex })
    await expect(createDataLoader({ fetch: fetchFn, dev: false }).loadDex()).rejects.toThrow('Could not load the Pokédex dataset ./data/dex.json: HTTP 404.')
    expect(calls).toEqual(['./data/dex.json'])
  })

  it('does not hide a broken real dataset behind the fixture', async () => {
    const broken = fakeFetch({ './data/dex.json': () => new Response('{"meta": ', { status: 200 }), './data-fixture/dex.json': fixtureIndex })
    await expect(createDataLoader({ fetch: broken.fetchFn, dev: true }).loadDex()).rejects.toThrow('not valid JSON')
    const wrongShape = fakeFetch({ './data/dex.json': { hello: 'world' }, './data-fixture/dex.json': fixtureIndex })
    await expect(createDataLoader({ fetch: wrongShape.fetchFn, dev: true }).loadDex()).rejects.toThrow('Invalid dex.json')
    const serverError = fakeFetch({ './data/dex.json': () => new Response('oops', { status: 500 }), './data-fixture/dex.json': fixtureIndex })
    await expect(createDataLoader({ fetch: serverError.fetchFn, dev: true }).loadDex()).rejects.toThrow('HTTP 500')
  })

  it('explains how to build the data when neither exists', async () => {
    const { fetchFn } = fakeFetch({})
    await expect(createDataLoader({ fetch: fetchFn, dev: true }).loadDex()).rejects.toThrow(/dataset is missing.*npm run data/)
  })

  it('shares one request between callers and retries after a failure', async () => {
    const routes: Record<string, Route> = {}
    const { fetchFn, calls } = fakeFetch(routes)
    const loader = createDataLoader({ fetch: fetchFn, dev: false })
    await expect(loader.loadDex()).rejects.toThrow()
    routes['./data/dex.json'] = mainIndex
    const [a, b] = await Promise.all([loader.loadDex(), loader.loadDex()])
    expect(a).toBe(b)
    expect(await loader.loadDex()).toBe(a)
    expect(calls).toEqual(['./data/dex.json', './data/dex.json'])
  })

  it('honours custom base folders', async () => {
    const { fetchFn, calls } = fakeFetch({ 'https://example.test/d/dex.json': mainIndex, 'https://example.test/d/species/2.json': miniDetail(2) })
    const loader = createDataLoader({ fetch: fetchFn, dev: false, dataBase: 'https://example.test/d/' })
    await loader.loadDex()
    await loader.loadSpeciesDetail(2)
    expect(calls).toEqual(['https://example.test/d/dex.json', 'https://example.test/d/species/2.json'])
  })
})

describe('loadSpeciesDetail', () => {
  const routes = (): Record<string, Route> => ({
    './data/dex.json': mainIndex,
    './data/species/1.json': miniDetail(1),
    './data/species/2.json': miniDetail(2),
    './data/species/3.json': miniDetail(3)
  })

  it('loads from the folder the dex came from', async () => {
    const real = fakeFetch(routes())
    await createDataLoader({ fetch: real.fetchFn, dev: true }).loadSpeciesDetail(2)
    expect(real.calls).toEqual(['./data/dex.json', './data/species/2.json'])

    const fixture = fakeFetch({ './data-fixture/dex.json': fixtureIndex, './data-fixture/species/25.json': detail(25) })
    const loaded = await createDataLoader({ fetch: fixture.fetchFn, dev: true }).loadSpeciesDetail(25)
    expect(loaded.forms['0']?.rows.length).toBeGreaterThan(10)
    expect(fixture.calls).toEqual(['./data/dex.json', './data-fixture/dex.json', './data-fixture/species/25.json'])
  })

  it('de-duplicates in flight and caches afterwards', async () => {
    const { fetchFn, calls } = fakeFetch(routes())
    const loader = createDataLoader({ fetch: fetchFn, dev: false })
    const first = loader.loadSpeciesDetail(1)
    const second = loader.loadSpeciesDetail(1)
    expect(second).toBe(first)
    expect(loader.peekSpeciesDetail(1)).toBeUndefined()
    const value = await first
    expect(loader.peekSpeciesDetail(1)).toBe(value)
    expect(await loader.loadSpeciesDetail(1)).toBe(value)
    expect(calls.filter((u) => u.includes('species/1.json'))).toHaveLength(1)
  })

  it('evicts the least recently used file beyond the cache size', async () => {
    const { fetchFn, calls } = fakeFetch(routes())
    const loader = createDataLoader({ fetch: fetchFn, dev: false, detailCacheSize: 2 })
    await loader.loadSpeciesDetail(1)
    await loader.loadSpeciesDetail(2)
    await loader.loadSpeciesDetail(1) // refreshes 1, so 2 is now the oldest
    await loader.loadSpeciesDetail(3) // evicts 2
    expect(loader.peekSpeciesDetail(1)).toBeDefined()
    expect(loader.peekSpeciesDetail(2)).toBeUndefined()
    expect(loader.peekSpeciesDetail(3)).toBeDefined()
    await loader.loadSpeciesDetail(1)
    await loader.loadSpeciesDetail(2)
    const count = (id: number) => calls.filter((u) => u.endsWith(`species/${id}.json`)).length
    expect([count(1), count(2), count(3)]).toEqual([1, 2, 1])
  })

  it('does not cache failures', async () => {
    const table = routes()
    delete table['./data/species/3.json']
    const { fetchFn } = fakeFetch(table)
    const loader = createDataLoader({ fetch: fetchFn, dev: false })
    await expect(loader.loadSpeciesDetail(3)).rejects.toThrow('Could not load ./data/species/3.json: HTTP 404.')
    table['./data/species/3.json'] = miniDetail(3)
    expect((await loader.loadSpeciesDetail(3)).id).toBe(3)
  })

  it('rejects a file that belongs to another species and invalid ids', async () => {
    const table = routes()
    table['./data/species/2.json'] = miniDetail(1)
    const { fetchFn, calls } = fakeFetch(table)
    const loader = createDataLoader({ fetch: fetchFn, dev: false })
    await expect(loader.loadSpeciesDetail(2)).rejects.toThrow('Invalid species/2.json')
    await expect(loader.loadSpeciesDetail(0)).rejects.toThrow('Invalid species id')
    await expect(loader.loadSpeciesDetail(1.5)).rejects.toThrow('Invalid species id')
    await expect(loader.loadSpeciesDetail(Number.NaN)).rejects.toThrow('Invalid species id')
    expect(calls.some((u) => u.includes('NaN') || u.includes('1.5'))).toBe(false)
  })

  it('fails when the dex itself cannot be loaded, and recovers', async () => {
    const table: Record<string, Route> = {}
    const { fetchFn } = fakeFetch(table)
    const loader = createDataLoader({ fetch: fetchFn, dev: false })
    await expect(loader.loadSpeciesDetail(1)).rejects.toThrow('Could not load the Pokédex dataset')
    Object.assign(table, routes())
    expect((await loader.loadSpeciesDetail(1)).id).toBe(1)
  })

  it('reset() forgets everything', async () => {
    const { fetchFn, calls } = fakeFetch(routes())
    const loader = createDataLoader({ fetch: fetchFn, dev: false })
    await loader.loadSpeciesDetail(1)
    loader.reset()
    expect(loader.peekSpeciesDetail(1)).toBeUndefined()
    await loader.loadSpeciesDetail(1)
    expect(calls).toHaveLength(4)
  })
})

describe('useDexStore', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('goes idle -> loading -> error, then loading -> ready on retry, sharing concurrent calls', async () => {
    const routes: Record<string, Route> = {}
    const { fetchFn, calls } = fakeFetch(routes)
    vi.stubGlobal('fetch', fetchFn)

    expect(useDexStore.getState()).toMatchObject({ status: 'idle', dex: null, error: null })
    const failed = useDexStore.getState().ensure()
    expect(useDexStore.getState().status).toBe('loading')
    await expect(failed).rejects.toThrow('dataset is missing')
    expect(useDexStore.getState().status).toBe('error')
    expect(useDexStore.getState().error?.message).toContain('npm run data')

    routes['./data-fixture/dex.json'] = fixtureIndex // vitest runs in dev mode, so the fixture is allowed
    const a = useDexStore.getState().ensure()
    const b = useDexStore.getState().ensure()
    expect(b).toBe(a)
    expect(useDexStore.getState()).toMatchObject({ status: 'loading', error: null })
    const loaded = await a
    expect(useDexStore.getState()).toMatchObject({ status: 'ready', dex: loaded, error: null })
    expect(loaded.isFixture).toBe(true)

    const before = calls.length
    expect(await useDexStore.getState().ensure()).toBe(loaded)
    expect(calls).toHaveLength(before)
  })
})
