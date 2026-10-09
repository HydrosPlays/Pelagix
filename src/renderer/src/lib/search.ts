/**
 * Species / form search for the command palette and the dex filter box.
 *
 * Accent-, case- and punctuation-insensitive ("flabebe" finds Flabébé, "mr mime" finds Mr. Mime,
 * "hooh" finds Ho-Oh). Results are ranked: exact dex number, exact name, name prefix, word prefix
 * (every query word starts a word of the name, in any order), substring, and - only when nothing
 * else matched - a light typo-tolerant match.
 */

import type { FormSummary, SpeciesSummary } from '@shared/dex-types'
import type { Dex } from './data'

export type SearchRank = 'number' | 'exact' | 'prefix' | 'word' | 'substring' | 'fuzzy'

const RANK_ORDER: Readonly<Record<SearchRank, number>> = { number: 0, exact: 1, prefix: 2, word: 3, substring: 4, fuzzy: 5 }

export interface SearchHit {
  species: SpeciesSummary
  /** The form that matched; the species' base form when the species itself matched. */
  form: FormSummary
  /** True when the form's own name matched ("Alolan Raichu"), false when the species name or number did. */
  viaForm: boolean
  rank: SearchRank
}

export interface SearchOptions {
  /** Maximum number of hits. Default 50. */
  limit?: number
  /** Include hits on form names. Default true; pass false to search species only. */
  forms?: boolean
}

/**
 * Lowercases, strips accents and punctuation, and collapses whitespace:
 * "Flabébé" -> "flabebe", "Farfetch’d" -> "farfetchd", "Mr. Mime" -> "mr mime", "Nidoran♀" -> "nidoran f".
 * "!" and "?" are spelled out so the two punctuation Unown stay searchable ("unown ?").
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/♀/g, ' f ')
    .replace(/♂/g, ' m ')
    .replace(/!/g, ' exclamation ')
    .replace(/\?/g, ' question ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

interface Target {
  species: SpeciesSummary
  form: FormSummary
  viaForm: boolean
  /** Normalised name without spaces. */
  compact: string
  words: string[]
  /** `compact` from the start of each word after the first, for typo matching inside multi-word names. */
  tails: string[]
}

interface Scored {
  hit: SearchHit
  rank: number
  /** Tie-break inside a rank: match position, edit distance or dex number. */
  detail: number
}

function makeTarget(species: SpeciesSummary, form: FormSummary, viaForm: boolean, name: string): Target {
  const words = normalizeText(name).split(' ').filter(Boolean)
  const tails: string[] = []
  for (let i = 1; i < words.length; i++) tails.push(words.slice(i).join(''))
  return { species, form, viaForm, compact: words.join(''), words, tails }
}

/**
 * Optimal-string-alignment distance between `q` and the closest *prefix* of `t`, capped at
 * `max + 1`. Insertions, deletions, substitutions and adjacent swaps each cost 1.
 */
function prefixDistance(q: string, t: string, max: number): number {
  const n = q.length
  const m = Math.min(t.length, n + max)
  let prev2 = new Array<number>(m + 1).fill(0)
  let prev = Array.from({ length: m + 1 }, (_, j) => j)
  let cur = new Array<number>(m + 1).fill(0)
  for (let i = 1; i <= n; i++) {
    cur[0] = i
    let rowMin = i
    for (let j = 1; j <= m; j++) {
      const cost = q.charCodeAt(i - 1) === t.charCodeAt(j - 1) ? 0 : 1
      let d = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost)
      if (i > 1 && j > 1 && q.charCodeAt(i - 1) === t.charCodeAt(j - 2) && q.charCodeAt(i - 2) === t.charCodeAt(j - 1)) {
        d = Math.min(d, prev2[j - 2]! + 1)
      }
      cur[j] = d
      if (d < rowMin) rowMin = d
    }
    if (rowMin > max) return max + 1
    const spare = prev2
    prev2 = prev
    prev = cur
    cur = spare
  }
  let best = max + 1
  for (let j = 0; j <= m; j++) if (prev[j]! < best) best = prev[j]!
  return best
}

/** Search index over a list of species. Build once per dataset (see `getDexSearch`). */
export class DexSearch {
  private readonly speciesTargets: Target[] = []
  private readonly formTargets: Target[] = []

  constructor(species: readonly SpeciesSummary[]) {
    for (const s of species) {
      const base = s.forms[0]
      if (!base) continue
      const own = makeTarget(s, base, false, s.name)
      this.speciesTargets.push(own)
      for (const form of s.forms) {
        if (form.cat === 'hidden') continue
        const target = makeTarget(s, form, true, form.full)
        // A form called exactly like its species adds nothing the species target does not cover.
        if (target.compact !== '' && target.compact !== own.compact) this.formTargets.push(target)
      }
    }
  }

  /** Ranked hits, best first. One hit per species + form pair. An empty query returns no hits. */
  search(query: string, options: SearchOptions = {}): SearchHit[] {
    const limit = options.limit ?? 50
    const spaced = normalizeText(query)
    if (spaced === '' || limit <= 0) return []
    const tokens = spaced.split(' ')
    const compact = tokens.join('')
    const targets = options.forms === false ? this.speciesTargets : [...this.speciesTargets, ...this.formTargets]

    const best = new Map<string, Scored>()
    const offer = (t: Target, rank: SearchRank, detail: number): void => {
      const key = `${t.species.id}:${t.form.f}`
      const scored: Scored = { hit: { species: t.species, form: t.form, viaForm: t.viaForm, rank }, rank: RANK_ORDER[rank], detail }
      const old = best.get(key)
      if (!old || compare(scored, old) < 0) best.set(key, scored)
    }

    // Dex number: "25", "#25", "0025". An exact number outranks everything; numbers that merely start with the digits follow.
    const digits = /^#?\s*0*(\d{1,5})$/.exec(query.trim())?.[1]
    if (digits !== undefined) {
      const wanted = Number(digits)
      for (const t of this.speciesTargets) {
        if (t.species.id === wanted) offer(t, 'number', -1)
        else if (wanted > 0 && String(t.species.id).startsWith(digits)) offer(t, 'number', t.species.id)
      }
    }

    for (const t of targets) {
      if (t.compact === compact) offer(t, 'exact', 0)
      else if (t.compact.startsWith(compact)) offer(t, 'prefix', 0)
      else if (tokens.every((token) => t.words.some((w) => w.startsWith(token)))) offer(t, 'word', 0)
      else {
        const at = t.compact.indexOf(compact)
        if (at >= 0) offer(t, 'substring', at)
      }
    }

    // Typos only matter when the query found nothing as typed; otherwise near-misses are just noise.
    if (best.size === 0 && compact.length >= 4) {
      const max = compact.length >= 8 ? 2 : 1
      const first = compact.charCodeAt(0)
      for (const t of targets) {
        let d = max + 1
        if (t.compact.charCodeAt(0) === first) d = prefixDistance(compact, t.compact, max)
        for (const tail of t.tails) {
          if (d <= 1) break
          if (tail.charCodeAt(0) === first) d = Math.min(d, prefixDistance(compact, tail, max))
        }
        if (d <= max) offer(t, 'fuzzy', d)
      }
    }

    return [...best.values()].sort(compare).slice(0, limit).map((s) => s.hit)
  }

  /**
   * National dex numbers of every species matching the query by its own name, number or any of
   * its forms' names, best match first. For filtering a species grid.
   */
  speciesIds(query: string): number[] {
    const seen = new Set<number>()
    for (const hit of this.search(query, { limit: Number.MAX_SAFE_INTEGER })) seen.add(hit.species.id)
    return [...seen]
  }
}

function compare(a: Scored, b: Scored): number {
  return (
    a.rank - b.rank ||
    Number(a.hit.viaForm) - Number(b.hit.viaForm) ||
    a.detail - b.detail ||
    a.hit.species.id - b.hit.species.id ||
    a.hit.form.f - b.hit.form.f
  )
}

const indexes = new WeakMap<Dex, DexSearch>()

/** The search index of a Dex, built on first use and reused afterwards. */
export function getDexSearch(dex: Dex): DexSearch {
  let index = indexes.get(dex)
  if (!index) {
    index = new DexSearch(dex.speciesList)
    indexes.set(dex, index)
  }
  return index
}

/** Shorthand for `getDexSearch(dex).search(query, options)`. */
export function searchDex(dex: Dex, query: string, options?: SearchOptions): SearchHit[] {
  return getDexSearch(dex).search(query, options)
}
