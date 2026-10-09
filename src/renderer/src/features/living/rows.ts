/**
 * The arithmetic behind row windowing (see windowing.ts): every row height is known up front, so
 * which rows are on screen is a pure function of the scroll position. No DOM, no React.
 */

/** Top of every row plus the total height: `offsets[i]` is where row `i` starts, `offsets[n]` the end of the last row. */
export function offsetsOf(heights: readonly number[], gap = 0): number[] {
  const offsets = new Array<number>(heights.length + 1)
  let y = 0
  for (let i = 0; i < heights.length; i++) {
    offsets[i] = y
    y += (heights[i] ?? 0) + gap
  }
  offsets[heights.length] = heights.length > 0 ? y - gap : 0
  return offsets
}

/** Index of the row that contains `y` (rows own the gap below them), clamped to the first / last row. -1 without rows. */
export function rowAt(offsets: readonly number[], y: number): number {
  const count = offsets.length - 1
  if (count <= 0) return -1
  let lo = 0
  let hi = count - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if ((offsets[mid] ?? 0) <= y) lo = mid
    else hi = mid - 1
  }
  return lo
}

export interface RowWindow {
  /** Rows to mount: `start` inclusive, `end` exclusive. */
  start: number
  end: number
  /** First and last row that are actually on screen (below the sticky inset). -1 without rows. */
  top: number
  bottom: number
}

export const EMPTY_WINDOW: RowWindow = { start: 0, end: 0, top: -1, bottom: -1 }

/**
 * The rows to mount for a viewport. `viewTop` is the scroller's top edge in list coordinates
 * (negative while the list starts further down the page), `inset` what a sticky bar covers of it,
 * `gap` the space between rows (a row whose gap is all that is left on screen is not "on screen").
 */
export function computeWindow(offsets: readonly number[], viewTop: number, viewHeight: number, inset = 0, overscan = 0, gap = 0): RowWindow {
  const count = offsets.length - 1
  if (count <= 0) return EMPTY_WINDOW
  const first = viewTop + Math.min(inset, viewHeight)
  // The last pixel row on screen (the bottom edge itself is outside).
  const last = Math.max(first, viewTop + viewHeight - 1)
  const total = offsets[count] ?? 0
  // Nothing of the list is on screen: keep one row mounted so there is always a tab stop.
  if (last < 0) return { start: 0, end: 1, top: 0, bottom: 0 }
  if (first > total) return { start: count - 1, end: count, top: count - 1, bottom: count - 1 }
  let top = rowAt(offsets, first)
  const bottom = rowAt(offsets, last)
  if (gap > 0 && top < bottom && first >= (offsets[top + 1] ?? total) - gap) top++
  return { start: rowAt(offsets, first - overscan), end: rowAt(offsets, last + overscan) + 1, top, bottom }
}

export type RowAlign = 'start' | 'center' | 'nearest'

export interface ScrollGeometry {
  /** Where the list starts inside the scroller's content, px. */
  listTop: number
  scrollTop: number
  viewHeight: number
  inset: number
  /** Breathing room kept around the target, px. */
  margin: number
}

/** The scrollTop that brings the span `[top, top + height)` of the list into view, or null when it already is. */
export function scrollTargetFor(top: number, height: number, align: RowAlign, g: ScrollGeometry): number | null {
  const absolute = g.listTop + top
  const visibleTop = g.scrollTop + g.inset
  const visibleBottom = g.scrollTop + g.viewHeight
  const room = g.viewHeight - g.inset
  const toStart = absolute - g.inset - g.margin
  if (align === 'start') return Math.max(0, toStart)
  if (align === 'center') return Math.max(0, height >= room ? toStart : absolute + height / 2 - g.inset - room / 2)
  if (absolute >= visibleTop + g.margin - 0.5 && absolute + height <= visibleBottom - g.margin + 0.5) return null
  // Too tall to fit, or above the fold: show its top. Otherwise bring its bottom edge in.
  if (absolute < visibleTop + g.margin || height + 2 * g.margin > room) return Math.max(0, toStart)
  return Math.max(0, absolute + height - g.viewHeight + g.margin)
}
