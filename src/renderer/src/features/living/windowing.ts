/**
 * Row windowing for the two long pages that cannot use `VirtualGrid`: the Living Dex (rows of
 * boxes with thirty buttons each) and the Journal (entry rows with their own menus, under group
 * headers). Both scroll with the page inside the shell's main region, under a sticky toolbar.
 *
 * Every row height is known up front, so a window is a pure function of the scroll position: no
 * measuring pass, no estimates. The arithmetic lives in rows.ts (unit tested); `useRowWindow`
 * wires it to a scroller.
 */

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { motionOK } from '@renderer/lib/anim'
import { computeWindow, EMPTY_WINDOW, scrollTargetFor, type RowAlign, type RowWindow } from './rows'

export { offsetsOf, rowAt, type RowAlign, type RowWindow } from './rows'

export interface ScrollToRowOptions {
  align?: RowAlign
  /** Animate the scroll. Ignored (instant) while motion is reduced. */
  smooth?: boolean
  /** Narrow the target to a part of the row: its offset inside the row and its height. */
  within?: { top: number; height: number }
}

export interface RowWindowOptions {
  /** The scrolling element (the shell's main region for a routed page). */
  scroller: HTMLElement | null
  /** The element the rows are positioned in; row 0 starts at its top edge. */
  listRef: RefObject<HTMLElement | null>
  offsets: readonly number[]
  /** Height of whatever sticks over the top of the scroller, px. */
  inset?: number
  /** Extra px mounted above and below the viewport. Default 400. */
  overscan?: number
  /** Space between rows, px: a row is not reported as on screen once only that gap is. */
  gap?: number
  /** Called on every scroll and resize with the scroller's top edge in list coordinates, for imperative touches (sticky headers). */
  onFrame?: (viewTop: number, scroller: HTMLElement) => void
}

export interface RowWindowApi {
  window: RowWindow
  /** Scrolls so that the row is visible. Returns false when nothing had to move. */
  scrollToRow(index: number, options?: ScrollToRowOptions): boolean
  /** Recomputes the window now (after a layout change the observers cannot see). */
  refresh(): void
}

/** How long a smooth scroll gets before it is completed by a jump, ms. */
export const SMOOTH_SETTLE_MS = 650
/** Input that means the user is scrolling by hand, so a pending jump must not fight them. */
const TAKEOVER_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

const sameWindow = (a: RowWindow, b: RowWindow): boolean => a.start === b.start && a.end === b.end && a.top === b.top && a.bottom === b.bottom

/**
 * Tracks which rows of a list are on screen while the page scrolls. The window is recomputed
 * synchronously in the scroll handler (cheap: two rectangles and a binary search) and only
 * re-renders when a row boundary is crossed.
 */
export function useRowWindow({ scroller, listRef, offsets, inset = 0, overscan = 400, gap = 0, onFrame }: RowWindowOptions): RowWindowApi {
  const [win, setWin] = useState<RowWindow>(EMPTY_WINDOW)
  /** Cancels the pending "make sure the smooth scroll arrived" check. */
  const settle = useRef<(() => void) | null>(null)
  const live = useRef({ offsets, inset, overscan, gap, onFrame })
  live.current = { offsets, inset, overscan, gap, onFrame }

  const measure = useCallback(() => {
    const list = listRef.current
    if (!scroller || !list) return
    const { offsets: o, inset: i, overscan: over, gap: g, onFrame: frame } = live.current
    const viewTop = scroller.getBoundingClientRect().top - list.getBoundingClientRect().top
    frame?.(viewTop, scroller)
    const next = computeWindow(o, viewTop, scroller.clientHeight, i, over, g)
    setWin((old) => (sameWindow(old, next) ? old : next))
  }, [scroller, listRef])

  useLayoutEffect(() => {
    const list = listRef.current
    if (!scroller || !list) return
    measure()
    scroller.addEventListener('scroll', measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(scroller)
    observer.observe(list)
    // Content above the list growing or shrinking moves the list without a scroll event.
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild)
    return () => {
      scroller.removeEventListener('scroll', measure)
      observer.disconnect()
    }
  }, [scroller, listRef, measure])

  // New rows or a new inset: the old window may point at rows that no longer exist.
  useLayoutEffect(measure, [measure, offsets, inset, overscan, gap])

  const scrollToRow = useCallback<RowWindowApi['scrollToRow']>(
    (index, options = {}) => {
      const list = listRef.current
      const { offsets: o, inset: i } = live.current
      const count = o.length - 1
      if (!scroller || !list || index < 0 || index >= count) return false
      const rowTop = o[index] ?? 0
      const rowHeight = (o[index + 1] ?? rowTop) - rowTop
      const top = rowTop + (options.within?.top ?? 0)
      const height = options.within?.height ?? rowHeight
      const listTop = list.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
      const target = scrollTargetFor(top, height, options.align ?? 'nearest', { listTop, scrollTop: scroller.scrollTop, viewHeight: scroller.clientHeight, inset: i, margin: 12 })
      if (target === null || Math.abs(target - scroller.scrollTop) < 1) return false
      settle.current?.()
      if (!(options.smooth && motionOK())) {
        scroller.scrollTo({ top: target, behavior: 'auto' })
        return true
      }
      scroller.scrollTo({ top: target, behavior: 'smooth' })
      // A window that is not painting never finishes a smooth scroll: land there anyway, unless the user took over.
      const cancel = (): void => {
        clearTimeout(timer)
        for (const type of TAKEOVER_EVENTS) scroller.removeEventListener(type, cancel)
        if (settle.current === cancel) settle.current = null
      }
      const timer = setTimeout(() => {
        cancel()
        if (Math.abs(scroller.scrollTop - target) > 2) scroller.scrollTo({ top: target, behavior: 'auto' })
      }, SMOOTH_SETTLE_MS)
      for (const type of TAKEOVER_EVENTS) scroller.addEventListener(type, cancel, { passive: true })
      settle.current = cancel
      return true
    },
    [scroller, listRef]
  )

  useLayoutEffect(() => () => settle.current?.(), [])

  return { window: win, scrollToRow, refresh: measure }
}

/**
 * Width of an element's content box, kept current. 0 until measured. `present`: the element is
 * rendered right now (pass it when the element comes and goes, so the hook re-attaches).
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>, present = true): number {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || !present) return
    const measure = (): void => setWidth(element.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, present])
  return width
}

/** Height of an element's border box, kept current (the sticky toolbar a list scrolls under). 0 until measured. */
export function useElementHeight(ref: RefObject<HTMLElement | null>, present = true): number {
  const [height, setHeight] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || !present) return
    const measure = (): void => setHeight(Math.round(element.getBoundingClientRect().height))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, present])
  return height
}

/**
 * Marks a sticky bar with `data-stuck` while it is pinned to the top of the scroller, so it can
 * drop its top corners and lift off the content. `present`: the bar is rendered right now.
 */
export function useStuckFlag(scroller: HTMLElement | null, ref: RefObject<HTMLElement | null>, present = true): void {
  useLayoutEffect(() => {
    const bar = ref.current
    if (!scroller || !bar || !present) return
    const update = (): void => {
      const stuck = scroller.scrollTop > 0 && bar.getBoundingClientRect().top <= scroller.getBoundingClientRect().top + 0.5
      if (bar.hasAttribute('data-stuck') !== stuck) bar.toggleAttribute('data-stuck', stuck)
    }
    update()
    scroller.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(scroller)
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild)
    return () => {
      scroller.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [scroller, ref, present])
}
