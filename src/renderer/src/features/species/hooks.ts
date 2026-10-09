/** Small hooks shared by the species page and the entry editor. */

import { useCallback, useEffect, useState, type KeyboardEvent } from 'react'
import type { SpeciesDetail } from '@shared/dex-types'
import { loadSpeciesDetail, peekSpeciesDetail } from '@renderer/lib/data'

export interface DetailState {
  data: SpeciesDetail | null
  error: Error | null
  loading: boolean
  /** Asks for the file again after a failure. */
  retry: () => void
}

/**
 * The detail file of a species, like `useSpeciesDetail`, plus a way to try again when the load
 * failed. A cached file is there on the first render; another species' data is never shown.
 */
export function useSpeciesDetailRetry(id: number | null | undefined): DetailState {
  const wanted = id ?? null
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ id: number | null; attempt: number; data: SpeciesDetail | null; error: Error | null }>(() => ({
    id: wanted,
    attempt: 0,
    data: wanted === null ? null : (peekSpeciesDetail(wanted) ?? null),
    error: null
  }))

  useEffect(() => {
    if (wanted === null) return
    let live = true
    loadSpeciesDetail(wanted).then(
      (data) => {
        if (live) setState({ id: wanted, attempt, data, error: null })
      },
      (err: unknown) => {
        if (live) setState({ id: wanted, attempt, data: null, error: err instanceof Error ? err : new Error(String(err)) })
      }
    )
    return () => {
      live = false
    }
  }, [wanted, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  if (wanted === null) return { data: null, error: null, loading: false, retry }
  if (state.id !== wanted || state.attempt !== attempt) {
    // The effect for this id / attempt has not reported yet.
    const cached = peekSpeciesDetail(wanted) ?? null
    return { data: cached, error: null, loading: cached === null, retry }
  }
  return { data: state.data, error: state.error, loading: state.data === null && state.error === null, retry }
}

const ROVING_KEYS: ReadonlySet<string> = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'])

/**
 * Arrow-key handling for a `role="radiogroup"` whose radios are laid out in a row, a column or a
 * wrapping grid: Left / Right step through them in order, Up / Down go to the nearest radio in
 * the row above / below, Home / End jump to the ends. The radio that receives focus is activated,
 * as radios are. Give the checked radio `tabIndex={0}` and the others `-1`.
 */
export function rovingRadioKeyDown(event: KeyboardEvent<HTMLElement>): void {
  if (!ROVING_KEYS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([disabled]):not([aria-disabled="true"])'))
  const current = items.indexOf(document.activeElement as HTMLElement)
  if (current < 0) return

  let next = -1
  if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = items.length - 1
  else if (event.key === 'ArrowLeft') next = current - 1
  else if (event.key === 'ArrowRight') next = current + 1
  else {
    const direction = event.key === 'ArrowDown' ? 1 : -1
    const from = items[current]!.getBoundingClientRect()
    const centre = from.left + from.width / 2
    let bestRow = Infinity
    let bestOffset = Infinity
    items.forEach((item, index) => {
      if (index === current) return
      const rect = item.getBoundingClientRect()
      const rowDistance = (rect.top - from.top) * direction
      if (rowDistance < 4) return
      const offset = Math.abs(rect.left + rect.width / 2 - centre)
      if (rowDistance < bestRow - 4 || (Math.abs(rowDistance - bestRow) <= 4 && offset < bestOffset)) {
        next = index
        bestRow = rowDistance
        bestOffset = offset
      }
    })
  }

  // The key is always consumed inside the group, so the page's own arrow shortcuts stay out of it.
  event.preventDefault()
  event.stopPropagation()
  const target = items[next]
  if (!target || next === current) return
  target.focus()
  target.click()
}
