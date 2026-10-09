/**
 * The short list of Pokémon the user opened most recently, for the command palette's empty state.
 * Kept per device in localStorage; losing it costs nothing, so every failure is swallowed.
 */

export const RECENT_STORAGE_KEY = 'pelagix.recent.v1'
export const MAX_RECENT = 6

export interface RecentRef {
  /** National dex number. */
  species: number
  /** Form the page was opened on (0 = base). */
  form: number
}

const isIndex = (value: unknown, min: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value < 100_000

/** Whatever was stored, as a clean list: valid entries only, one per species, newest first, capped. */
export function parseRecent(raw: unknown): RecentRef[] {
  if (!Array.isArray(raw)) return []
  const out: RecentRef[] = []
  for (const item of raw as unknown[]) {
    if (typeof item !== 'object' || item === null) continue
    const { species, form } = item as { species?: unknown; form?: unknown }
    if (!isIndex(species, 1) || out.some((r) => r.species === species)) continue
    out.push({ species, form: isIndex(form, 0) ? form : 0 })
    if (out.length >= MAX_RECENT) break
  }
  return out
}

/** The list with `ref` moved (or added) to the front. A species appears once, with the form seen last. */
export function pushRecent(list: readonly RecentRef[], ref: RecentRef): RecentRef[] {
  return [ref, ...list.filter((r) => r.species !== ref.species)].slice(0, MAX_RECENT)
}

/**
 * The Pokémon a location shows, or null when it is not a species page:
 * `("/dex/26", "form=1")` -> `{ species: 26, form: 1 }`.
 */
export function recentFromLocation(path: string, search: string): RecentRef | null {
  const match = /^\/dex\/(\d{1,5})\/?$/.exec(path)
  if (!match) return null
  const species = Number(match[1])
  if (!isIndex(species, 1)) return null
  const form = Number(new URLSearchParams(search).get('form') ?? 0)
  return { species, form: isIndex(form, 0) ? form : 0 }
}

export function readRecent(): RecentRef[] {
  try {
    if (typeof localStorage === 'undefined') return []
    return parseRecent(JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) ?? 'null'))
  } catch {
    return []
  }
}

/** Puts a Pokémon at the front of the stored list. */
export function recordRecent(ref: RecentRef): void {
  try {
    if (typeof localStorage === 'undefined') return
    const current = readRecent()
    if (current[0]?.species === ref.species && current[0].form === ref.form) return
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(pushRecent(current, ref)))
  } catch {
    // Storage full or blocked: the palette simply shows no recent Pokémon.
  }
}
