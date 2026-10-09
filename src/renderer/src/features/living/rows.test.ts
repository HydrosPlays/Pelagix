import { describe, expect, it } from 'vitest'
import { computeWindow, EMPTY_WINDOW, offsetsOf, rowAt, scrollTargetFor, type ScrollGeometry } from './rows'

describe('offsetsOf', () => {
  it('lists the top of every row and ends with the total height', () => {
    expect(offsetsOf([100, 50, 100])).toEqual([0, 100, 150, 250])
  })

  it('puts the gap between rows, not after the last one', () => {
    expect(offsetsOf([100, 50, 100], 10)).toEqual([0, 110, 170, 270])
    expect(offsetsOf([40], 10)).toEqual([0, 40])
  })

  it('is a single zero without rows', () => {
    expect(offsetsOf([], 10)).toEqual([0])
  })
})

describe('rowAt', () => {
  const offsets = offsetsOf([100, 50, 100], 10)

  it('finds the row containing a position; a row owns the gap below it', () => {
    expect(rowAt(offsets, 0)).toBe(0)
    expect(rowAt(offsets, 99)).toBe(0)
    expect(rowAt(offsets, 105)).toBe(0)
    expect(rowAt(offsets, 110)).toBe(1)
    expect(rowAt(offsets, 169)).toBe(1)
    expect(rowAt(offsets, 170)).toBe(2)
  })

  it('clamps to the first and last row', () => {
    expect(rowAt(offsets, -500)).toBe(0)
    expect(rowAt(offsets, 99999)).toBe(2)
  })

  it('returns -1 without rows', () => {
    expect(rowAt([0], 10)).toBe(-1)
  })

  it('agrees with a linear scan on a long list', () => {
    const heights = Array.from({ length: 500 }, (_, i) => (i % 7 === 0 ? 40 : 56))
    const long = offsetsOf(heights, 4)
    for (const y of [0, 39, 44, 45, 1000, 5555, 12345, (long[500] ?? 0) - 1]) {
      let expected = 0
      while (expected + 1 < 500 && (long[expected + 1] ?? 0) <= y) expected++
      expect(rowAt(long, y)).toBe(expected)
    }
  })
})

describe('computeWindow', () => {
  // Ten rows of 100 px, no gap.
  const offsets = offsetsOf(new Array<number>(10).fill(100))

  it('mounts the rows in view plus the overscan', () => {
    expect(computeWindow(offsets, 250, 300, 0, 0)).toEqual({ start: 2, end: 6, top: 2, bottom: 5 })
    expect(computeWindow(offsets, 250, 300, 0, 100)).toEqual({ start: 1, end: 7, top: 2, bottom: 5 })
  })

  it('counts what a sticky bar covers as not visible', () => {
    const win = computeWindow(offsets, 250, 300, 120, 0)
    expect(win.top).toBe(3)
    expect(win.start).toBe(3)
    expect(win.bottom).toBe(5)
  })

  it('does not count a row as on screen when only the gap under it is', () => {
    const gapped = offsetsOf(new Array<number>(10).fill(100), 20) // rows at 0, 120, 240 ...
    // The sticky line (viewTop + inset) sits at 105: inside the gap under row 0.
    expect(computeWindow(gapped, 5, 400, 100, 0, 20)).toMatchObject({ top: 1, start: 0 })
    // Without the gap hint the row still owns it.
    expect(computeWindow(gapped, 5, 400, 100, 0)).toMatchObject({ top: 0 })
    // One pixel of the row itself is enough.
    expect(computeWindow(gapped, -1, 400, 100, 0, 20)).toMatchObject({ top: 0 })
  })

  it('still mounts the first row while the list starts further down the page', () => {
    expect(computeWindow(offsets, -400, 300, 0, 0)).toEqual({ start: 0, end: 1, top: 0, bottom: 0 })
    // The list has just entered the viewport from below.
    expect(computeWindow(offsets, -200, 300, 0, 0)).toEqual({ start: 0, end: 1, top: 0, bottom: 0 })
    expect(computeWindow(offsets, -200, 350, 0, 0)).toEqual({ start: 0, end: 2, top: 0, bottom: 1 })
  })

  it('keeps the last row once scrolled past the end', () => {
    expect(computeWindow(offsets, 2000, 300, 0, 0)).toEqual({ start: 9, end: 10, top: 9, bottom: 9 })
  })

  it('is empty without rows', () => {
    expect(computeWindow([0], 0, 300)).toBe(EMPTY_WINDOW)
  })

  it('never leaves the row range, whatever the overscan', () => {
    const win = computeWindow(offsets, 0, 300, 0, 5000)
    expect(win.start).toBe(0)
    expect(win.end).toBe(10)
  })
})

describe('scrollTargetFor', () => {
  const g: ScrollGeometry = { listTop: 500, scrollTop: 1000, viewHeight: 600, inset: 100, margin: 10 }

  it('leaves a span that is already in view alone', () => {
    // Visible list span: 1000 + 100 - 500 = 600 .. 1100.
    expect(scrollTargetFor(700, 100, 'nearest', g)).toBeNull()
  })

  it('brings a span above the fold to the top, under the sticky bar', () => {
    expect(scrollTargetFor(300, 100, 'nearest', g)).toBe(500 + 300 - 100 - 10)
  })

  it('brings a span below the fold in by its bottom edge', () => {
    expect(scrollTargetFor(1200, 100, 'nearest', g)).toBe(500 + 1200 + 100 - 600 + 10)
  })

  it('shows the top of a span that is taller than the room', () => {
    expect(scrollTargetFor(1200, 900, 'nearest', g)).toBe(500 + 1200 - 100 - 10)
    expect(scrollTargetFor(1200, 900, 'center', g)).toBe(500 + 1200 - 100 - 10)
  })

  it('centres a span in the room below the sticky bar', () => {
    // Room is 500 px tall and starts 100 px down: centre line at scrollTop + 350.
    expect(scrollTargetFor(2000, 100, 'center', g)).toBe(500 + 2000 + 50 - 350)
  })

  it('aligns to the start on request, and never scrolls above zero', () => {
    expect(scrollTargetFor(700, 100, 'start', g)).toBe(500 + 700 - 110)
    expect(scrollTargetFor(0, 100, 'start', { ...g, listTop: 50 })).toBe(0)
  })
})
