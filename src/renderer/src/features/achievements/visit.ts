/**
 * Remembers when the Achievements page was last opened (per device), so the page can pick out
 * what was unlocked since. A convenience only: a blocked or full storage just means nothing shimmers.
 */

export const VISIT_STORAGE_KEY = 'pelagix.achievements.seen.v1'

/** ISO timestamp of the previous visit, or null when there was none. */
export function readLastVisit(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const value = localStorage.getItem(VISIT_STORAGE_KEY)
    return value !== null && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null
  } catch {
    return null
  }
}

export function writeLastVisit(now: Date = new Date()): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(VISIT_STORAGE_KEY, now.toISOString())
  } catch {
    // Not worth an error.
  }
}
