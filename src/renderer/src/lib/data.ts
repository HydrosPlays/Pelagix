/**
 * Dataset access: loads dex.json once, wraps it in a `Dex` with fast lookups, and fetches the
 * per-species detail files on demand.
 *
 *   ./data/dex.json            DexIndex
 *   ./data/species/<id>.json   SpeciesDetail
 *
 * URLs are relative so they resolve under file:// (packaged app) as well as the dev server. In
 * development only, a missing ./data/ falls back to the hand-made ./data-fixture/.
 */

import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { BALLS, type BallDef } from '@shared/balls'
import type { DexIndex, DexMeta, FormSummary, GameIdx, SpeciesDetail, SpeciesSummary } from '@shared/dex-types'
import { GAME_BY_ID, GAMES, type GameDef } from '@shared/games'
import { t } from '@renderer/i18n/runtime'
import { isDev } from './env'

// ---------------------------------------------------------------- Dex

/** Where the loaded dataset came from: the real build or the development fixture. */
export type DexSource = 'data' | 'fixture'

const CANONICAL_RANK: ReadonlyMap<string, number> = new Map(GAMES.map((g, i) => [g.id, i]))
const GO = 'go'
const NO_GAMES: readonly GameDef[] = Object.freeze([])
const NO_BALLS: readonly BallDef[] = Object.freeze([])
const NO_SPECIES: readonly SpeciesSummary[] = Object.freeze([])

interface FormGames {
  obtain: readonly GameDef[]
  event: readonly GameDef[]
  present: readonly GameDef[]
}

/**
 * Read-only view of the dataset index. Everything is looked up by national dex number, never by
 * array position, so it also works for a sparse index (the fixture holds 24 species).
 */
export class Dex {
  readonly index: DexIndex
  readonly meta: DexMeta
  readonly source: DexSource
  /** Every species, in national dex order. */
  readonly speciesList: readonly SpeciesSummary[]
  /** The dataset's games that the app knows (`GAMES`), in canonical order. */
  readonly games: readonly GameDef[]
  /** Ids in `index.games` that are not in `GAMES`; they are ignored everywhere. */
  readonly unknownGameIds: readonly string[]

  private readonly speciesById = new Map<number, SpeciesSummary>()
  private readonly idxByGame = new Map<string, GameIdx>()
  private readonly gameByIdx: Array<GameDef | undefined>
  private readonly ballsByGame = new Map<string, readonly BallDef[]>()
  private readonly families = new Map<number, SpeciesSummary[]>()
  private readonly formGames = new WeakMap<FormSummary, FormGames>()

  constructor(index: DexIndex, source: DexSource = 'data') {
    this.index = index
    this.meta = index.meta
    this.source = source

    const list = [...index.species].sort((a, b) => a.id - b.id)
    this.speciesList = list
    for (const s of list) {
      this.speciesById.set(s.id, s)
      const family = this.families.get(s.family)
      if (family) family.push(s)
      else this.families.set(s.family, [s])
    }

    const unknown: string[] = []
    this.gameByIdx = index.games.map((id, idx) => {
      const def = GAME_BY_ID.get(id)
      if (def) this.idxByGame.set(id, idx)
      else unknown.push(id)
      return def
    })
    this.unknownGameIds = unknown
    this.games = this.sortGames(this.gameByIdx.filter((g): g is GameDef => g !== undefined))
  }

  /** True when the app is running on the development fixture rather than the real dataset. */
  get isFixture(): boolean {
    return this.source === 'fixture'
  }

  /** Species by national dex number. */
  species(id: number): SpeciesSummary | undefined {
    return this.speciesById.get(id)
  }

  /** Form by national dex number and PKHeX form index. */
  form(id: number, f: number): FormSummary | undefined {
    const forms = this.speciesById.get(id)?.forms
    if (!forms) return undefined
    const direct = forms[f]
    return direct !== undefined && direct.f === f ? direct : forms.find((x) => x.f === f)
  }

  /** `GameIdx` the datasets use for a game id; -1 when the dataset does not know the game. */
  gameIdx(gameId: string): GameIdx {
    return this.idxByGame.get(gameId) ?? -1
  }

  /** Game behind a dataset `GameIdx`; undefined for an out-of-range index or an id the app does not know. */
  gameAt(idx: GameIdx): GameDef | undefined {
    return this.gameByIdx[idx]
  }

  /** `GameIdx[]` (as found in forms and encounter rows) -> known games in canonical order. */
  gamesAt(indices: readonly GameIdx[]): GameDef[] {
    const out: GameDef[] = []
    for (const idx of indices) {
      const def = this.gameByIdx[idx]
      if (def) out.push(def)
    }
    return this.sortGames(out)
  }

  /**
   * Balls usable for an ordinary capture in a game, in the display order of `BALLS`. Empty for
   * games without wild captures (Stadium, Box, HOME) and for unknown games.
   */
  ballsFor(gameId: string): readonly BallDef[] {
    const cached = this.ballsByGame.get(gameId)
    if (cached) return cached
    const idx = this.gameIdx(gameId)
    const ids = idx < 0 ? undefined : this.index.gameBalls[idx]
    const balls = ids && ids.length > 0 ? BALLS.filter((b) => ids.includes(b.id)) : NO_BALLS
    this.ballsByGame.set(gameId, balls)
    return balls
  }

  /**
   * The form can be obtained in the game without an event (caught, gifted, traded in-game, raided,
   * evolved or bred). Pokémon GO also counts when the form carries the `go` flag.
   */
  isObtainable(form: FormSummary, gameId: string): boolean {
    const idx = this.gameIdx(gameId)
    if (idx >= 0 && form.obtain.includes(idx)) return true
    return gameId === GO && form.go !== undefined && !(idx >= 0 && form.event.includes(idx))
  }

  /** The game's only sources of the form are event distributions. */
  isEventOnly(form: FormSummary, gameId: string): boolean {
    const idx = this.gameIdx(gameId)
    return idx >= 0 && form.event.includes(idx)
  }

  /** The form exists in the game's data (it can be there, if only by transfer). */
  isPresent(form: FormSummary, gameId: string): boolean {
    const idx = this.gameIdx(gameId)
    if (idx >= 0 && form.present.includes(idx)) return true
    return gameId === GO && form.go !== undefined
  }

  /** Games where the form can be obtained without an event, in canonical order. */
  obtainableGames(form: FormSummary): readonly GameDef[] {
    return this.gamesOf(form).obtain
  }

  /** Games where the form is event-only, in canonical order. */
  eventGames(form: FormSummary): readonly GameDef[] {
    return this.gamesOf(form).event
  }

  /** Games whose data contains the form, in canonical order. */
  presentGames(form: FormSummary): readonly GameDef[] {
    return this.gamesOf(form).present
  }

  /** Every species of an evolution family (`SpeciesSummary.family`), in national dex order. */
  familyMembers(familyId: number): readonly SpeciesSummary[] {
    return this.families.get(familyId) ?? NO_SPECIES
  }

  private gamesOf(form: FormSummary): FormGames {
    let games = this.formGames.get(form)
    if (!games) {
      const go = GAME_BY_ID.get(GO)
      const withGo = (list: GameDef[], add: boolean): readonly GameDef[] => {
        if (add && go && !list.includes(go)) return this.sortGames([...list, go])
        return list.length === 0 ? NO_GAMES : list
      }
      const event = this.gamesAt(form.event)
      const inGo = form.go !== undefined
      games = {
        obtain: withGo(this.gamesAt(form.obtain), inGo && !event.some((g) => g.id === GO)),
        event: withGo(event, false),
        present: withGo(this.gamesAt(form.present), inGo)
      }
      this.formGames.set(form, games)
    }
    return games
  }

  private sortGames(list: GameDef[]): GameDef[] {
    return list.sort((a, b) => (CANONICAL_RANK.get(a.id) ?? 0) - (CANONICAL_RANK.get(b.id) ?? 0))
  }
}

// ---------------------------------------------------------------- validation

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isPositiveInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0

/** Cheap structural check of dex.json; throws a descriptive error for anything the app could not use. */
export function validateDexIndex(raw: unknown): DexIndex {
  const fail = (what: string): never => {
    throw new Error(`Invalid dex.json: ${what}.`)
  }
  if (!isObject(raw)) return fail('the top level is not an object')
  const { meta, games, gameBalls, species } = raw
  if (!isObject(meta) || !isObject(meta.counts)) return fail('"meta" is missing or malformed')
  if (!Array.isArray(games) || games.some((g) => typeof g !== 'string')) return fail('"games" is not a list of game ids')
  if (!Array.isArray(gameBalls) || gameBalls.length !== games.length || gameBalls.some((b) => !Array.isArray(b))) {
    return fail('"gameBalls" does not have one ball list per game')
  }
  if (!Array.isArray(species) || species.length === 0) return fail('"species" is empty or missing')

  const seen = new Set<number>()
  for (let i = 0; i < species.length; i++) {
    const s: unknown = species[i]
    if (!isObject(s) || !isPositiveInt(s.id) || typeof s.name !== 'string') return fail(`species[${i}] has no id or name`)
    if (seen.has(s.id)) return fail(`species ${s.id} is listed twice`)
    seen.add(s.id)
    if (!Array.isArray(s.forms) || s.forms.length === 0) return fail(`species ${s.id} (${s.name}) has no forms`)
    for (const f of s.forms as unknown[]) {
      if (
        !isObject(f) || typeof f.f !== 'number' || typeof f.sprite !== 'string' || typeof f.full !== 'string' || typeof f.cat !== 'string' ||
        !Array.isArray(f.types) || !Array.isArray(f.present) || !Array.isArray(f.obtain) || !Array.isArray(f.event)
      ) {
        return fail(`species ${s.id} (${s.name}) has a malformed form`)
      }
    }
  }
  return raw as unknown as DexIndex
}

/** Structural check of a species/<id>.json file. */
export function validateSpeciesDetail(raw: unknown, id: number): SpeciesDetail {
  if (!isObject(raw) || raw.id !== id || !isObject(raw.forms) || !Array.isArray(raw.strings) || !Array.isArray(raw.family)) {
    throw new Error(`Invalid species/${id}.json: not a species detail file for #${id}.`)
  }
  return raw as unknown as SpeciesDetail
}

// ---------------------------------------------------------------- loading

type JsonResult = { ok: true; value: unknown } | { ok: false; missing: boolean; reason: string }

async function fetchJson(fetchFn: typeof fetch, url: string): Promise<JsonResult> {
  let text: string
  try {
    const res = await fetchFn(url)
    if (!res.ok) return { ok: false, missing: res.status === 404, reason: `HTTP ${res.status}` }
    text = await res.text()
  } catch (err) {
    // file:// reports a missing file as a failed fetch, exactly like a network error.
    return { ok: false, missing: true, reason: err instanceof Error ? err.message : 'request failed' }
  }
  // The Vite dev server answers unknown paths with index.html and status 200.
  if (text.trimStart().startsWith('<')) return { ok: false, missing: true, reason: 'not found' }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false, missing: false, reason: 'the file is not valid JSON' }
  }
}

export interface DataLoaderOptions {
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch
  /** Allow the fixture fallback. Defaults to `import.meta.env.DEV`. */
  dev?: boolean
  /** How many species detail files stay cached. Default 60. */
  detailCacheSize?: number
  /** Folder URLs, with trailing slash. Default `./data/` and `./data-fixture/`. */
  dataBase?: string
  fixtureBase?: string
}

export interface DataLoader {
  /** Loads and validates dex.json. Concurrent and repeated calls share one request; a failure can be retried. */
  loadDex(): Promise<Dex>
  /** Loads one species detail file, from the same folder the dex came from. Cached (LRU) and de-duplicated in flight. */
  loadSpeciesDetail(id: number): Promise<SpeciesDetail>
  /** The detail file if it is already loaded and still cached; never triggers a request. */
  peekSpeciesDetail(id: number): SpeciesDetail | undefined
  /** Forgets everything loaded so far. */
  reset(): void
}

interface DetailSlot {
  promise: Promise<SpeciesDetail>
  value?: SpeciesDetail
}

export function createDataLoader(options: DataLoaderOptions = {}): DataLoader {
  const dev = options.dev ?? isDev
  const cacheSize = Math.max(1, options.detailCacheSize ?? 60)
  const dataBase = options.dataBase ?? './data/'
  const fixtureBase = options.fixtureBase ?? './data-fixture/'
  const doFetch: typeof fetch = (input, init) => (options.fetch ?? globalThis.fetch)(input, init)

  let dexPromise: Promise<{ dex: Dex; base: string }> | null = null
  // Insertion order is recency order: a hit re-inserts its slot, the first key is the eviction victim.
  const details = new Map<number, DetailSlot>()

  async function fetchDex(): Promise<{ dex: Dex; base: string }> {
    const primary = await fetchJson(doFetch, `${dataBase}dex.json`)
    if (primary.ok) return { dex: new Dex(validateDexIndex(primary.value), 'data'), base: dataBase }

    if (dev && primary.missing) {
      const fixture = await fetchJson(doFetch, `${fixtureBase}dex.json`)
      if (fixture.ok) return { dex: new Dex(validateDexIndex(fixture.value), 'fixture'), base: fixtureBase }
      throw new Error(
        t('data.load.datasetMissing', {
          dataset: `${dataBase}dex.json`, reason: primary.reason, fixture: `${fixtureBase}dex.json`, fixtureReason: fixture.reason
        })
      )
    }
    throw new Error(t('data.load.datasetFailed', { dataset: `${dataBase}dex.json`, reason: primary.reason }))
  }

  function loadDexWithBase(): Promise<{ dex: Dex; base: string }> {
    if (!dexPromise) {
      const attempt = fetchDex()
      dexPromise = attempt
      attempt.catch(() => {
        if (dexPromise === attempt) dexPromise = null
      })
    }
    return dexPromise
  }

  async function fetchDetail(id: number): Promise<SpeciesDetail> {
    const { base } = await loadDexWithBase()
    const url = `${base}species/${id}.json`
    const result = await fetchJson(doFetch, url)
    if (!result.ok) throw new Error(t('data.load.fileFailed', { file: url, reason: result.reason }))
    return validateSpeciesDetail(result.value, id)
  }

  return {
    loadDex: () => loadDexWithBase().then((r) => r.dex),

    loadSpeciesDetail(id) {
      if (!isPositiveInt(id)) return Promise.reject(new Error(`Invalid species id: ${String(id)}.`))
      const hit = details.get(id)
      if (hit) {
        details.delete(id)
        details.set(id, hit)
        return hit.promise
      }
      const slot: DetailSlot = { promise: fetchDetail(id) }
      details.set(id, slot)
      slot.promise.then(
        (value) => {
          slot.value = value
        },
        () => {
          if (details.get(id) === slot) details.delete(id)
        }
      )
      while (details.size > cacheSize) {
        const oldest = details.keys().next().value
        if (oldest === undefined) break
        details.delete(oldest)
      }
      return slot.promise
    },

    peekSpeciesDetail: (id) => details.get(id)?.value,

    reset() {
      dexPromise = null
      details.clear()
    }
  }
}

const loader = createDataLoader()

/** Loads dex.json (once) and returns the `Dex`. See `DataLoader.loadDex`. */
export const loadDex = (): Promise<Dex> => loader.loadDex()
/** Loads species/<id>.json through the shared LRU cache. See `DataLoader.loadSpeciesDetail`. */
export const loadSpeciesDetail = (id: number): Promise<SpeciesDetail> => loader.loadSpeciesDetail(id)
/** Synchronous cache peek; undefined until the file has finished loading. */
export const peekSpeciesDetail = (id: number): SpeciesDetail | undefined => loader.peekSpeciesDetail(id)

// ---------------------------------------------------------------- store + hooks

export type DexStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface DexState {
  status: DexStatus
  /** Set once `status` is "ready". */
  dex: Dex | null
  /** Set while `status` is "error". */
  error: Error | null
  /** Starts loading if needed and resolves with the Dex. Safe to call repeatedly; after an error it retries. */
  ensure(): Promise<Dex>
}

let ensuring: Promise<Dex> | null = null

export const useDexStore = create<DexState>()((set, get) => ({
  status: 'idle',
  dex: null,
  error: null,
  ensure() {
    const { dex } = get()
    if (dex) return Promise.resolve(dex)
    if (ensuring) return ensuring
    set({ status: 'loading', error: null })
    const attempt = loadDex().then(
      (loaded) => {
        set({ status: 'ready', dex: loaded, error: null })
        return loaded
      },
      (err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err))
        set({ status: 'error', error })
        throw error
      }
    )
    ensuring = attempt
    const clear = (): void => {
      if (ensuring === attempt) ensuring = null
    }
    attempt.then(clear, clear)
    return attempt
  }
}))

/**
 * The loaded Dex, for components rendered below the app's loading gate.
 *
 * Never returns null: it throws when the Dex is not ready. A load failure is rethrown as-is so an
 * error boundary can show it; calling this while still loading is a programming error. Components
 * that can render before the data is there use `useDexMaybe()` or `useDexStore` instead.
 */
export function useDex(): Dex {
  const dex = useDexStore((s) => s.dex)
  const error = useDexStore((s) => s.error)
  if (dex) return dex
  if (error) throw error
  throw new Error('useDex() was called before the Pokédex data finished loading; render it below the loading gate or use useDexMaybe().')
}

/** The Dex, or null until it is ready (also null after a load error). Starts the load on mount. Never throws. */
export function useDexMaybe(): Dex | null {
  const dex = useDexStore((s) => s.dex)
  useEffect(() => {
    const state = useDexStore.getState()
    if (state.status === 'idle') void state.ensure().catch(() => {})
  }, [])
  return dex
}

export interface SpeciesDetailState {
  data: SpeciesDetail | null
  error: Error | null
  loading: boolean
}

const NO_DETAIL: SpeciesDetailState = Object.freeze({ data: null, error: null, loading: false })

/**
 * Detail file of one species. Pass null / undefined for "no species selected". A cached file is
 * returned on the first render with no loading flash; switching ids never shows the previous
 * species' data.
 */
export function useSpeciesDetail(id: number | null | undefined): SpeciesDetailState {
  const [state, setState] = useState<{ id: number | null; data: SpeciesDetail | null; error: Error | null }>(() => ({
    id: id ?? null,
    data: id == null ? null : (peekSpeciesDetail(id) ?? null),
    error: null
  }))

  useEffect(() => {
    if (id == null) return
    let live = true
    loadSpeciesDetail(id).then(
      (data) => {
        if (live) setState({ id, data, error: null })
      },
      (err: unknown) => {
        if (live) setState({ id, data: null, error: err instanceof Error ? err : new Error(String(err)) })
      }
    )
    return () => {
      live = false
    }
  }, [id])

  if (id == null) return NO_DETAIL
  if (state.id !== id) {
    // The effect for the new id has not reported yet.
    const cached = peekSpeciesDetail(id) ?? null
    return { data: cached, error: null, loading: cached === null }
  }
  return { data: state.data, error: state.error, loading: state.data === null && state.error === null }
}
