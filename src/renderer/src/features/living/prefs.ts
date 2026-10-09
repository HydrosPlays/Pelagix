/**
 * What the Living Dex page remembers on this device: the view the user left it in, and the size
 * of the Living Dex when they last looked, so the page can say when the rules changed it.
 */

import { useCallback, useState } from 'react'
import type { LivingView } from './model'

export const LIVING_STORAGE_KEY = 'pelagix.living.v1'

export interface LivingPrefs {
  view: LivingView
  missingOnly: boolean
  /** Rule set and slot count the page last showed; null before the first visit. */
  seen: { rules: string; slots: number } | null
}

export const DEFAULT_LIVING_PREFS: LivingPrefs = { view: 'boxes', missingOnly: false, seen: null }

/** Reads the stored preferences; anything missing or malformed falls back to the default. Never throws. */
export function parseLivingPrefs(raw: unknown): LivingPrefs {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_LIVING_PREFS
  const data = raw as { view?: unknown; missingOnly?: unknown; seen?: unknown }
  const seen = data.seen as { rules?: unknown; slots?: unknown } | null | undefined
  return {
    view: data.view === 'list' || data.view === 'boxes' ? data.view : DEFAULT_LIVING_PREFS.view,
    missingOnly: data.missingOnly === true,
    seen: seen && typeof seen.rules === 'string' && typeof seen.slots === 'number' && Number.isFinite(seen.slots) ? { rules: seen.rules, slots: seen.slots } : null
  }
}

function read(): LivingPrefs {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_LIVING_PREFS
    return parseLivingPrefs(JSON.parse(localStorage.getItem(LIVING_STORAGE_KEY) ?? 'null'))
  } catch {
    return DEFAULT_LIVING_PREFS
  }
}

function write(prefs: LivingPrefs): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LIVING_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // A convenience only: a full or blocked storage is not worth an error.
  }
}

/** The page's remembered preferences, with a setter that also stores them. */
export function useLivingPrefs(): [LivingPrefs, (patch: Partial<LivingPrefs>) => void] {
  const [prefs, setPrefs] = useState(read)
  const update = useCallback((patch: Partial<LivingPrefs>) => {
    setPrefs((old) => {
      const next = { ...old, ...patch }
      write(next)
      return next
    })
  }, [])
  return [prefs, update]
}
