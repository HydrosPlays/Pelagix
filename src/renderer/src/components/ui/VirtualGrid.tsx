import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type Ref } from 'react'
import { defaultRangeExtractor, useVirtualizer, type Range } from '@tanstack/react-virtual'
import { cx } from './cx'
import { useScrollParent } from './ScrollArea'
import './VirtualGrid.css'

export interface VirtualGridHandle {
  /** Scrolls so that the item is visible. */
  scrollToIndex(index: number, options?: { align?: 'start' | 'center' | 'end' | 'auto'; behavior?: 'auto' | 'smooth' }): void
  /** Scrolls to the item and moves keyboard focus onto its cell. */
  focusIndex(index: number): void
  /** Current number of columns (0 until measured). */
  getColumnCount(): number
}

export interface VirtualGridProps<T> {
  items: readonly T[]
  /** Cell content. The cell wrapper is the focus target, so render non-focusable content here. */
  renderItem: (item: T, index: number) => ReactNode
  itemKey?: (item: T, index: number) => string | number
  /** Columns are as many as fit at this minimum width (px); they then share the row equally. */
  minColumnWidth: number
  /** Row height in px, or a function of the resulting column width (e.g. for square tiles). */
  itemHeight: number | ((columnWidth: number) => number)
  /** Gap between cells, px. Default 12. */
  gap?: number
  maxColumns?: number
  /** Extra rows rendered above and below the viewport. Default 3. */
  overscan?: number
  /**
   * "page" (default): virtualises against the nearest ScrollArea, i.e. the app's main region, so
   * the grid scrolls with the rest of the page. "self": the grid is its own scroll container and
   * needs a parent with a definite height.
   */
  scroll?: 'page' | 'self'
  /** Accessible name of the grid. */
  label: string
  /** Click, Enter or Space on a cell. */
  onActivate?: (item: T, index: number) => void
  /**
   * Splits the items into consecutive sections, each under a full-width heading: `start` is the
   * index of a section's first item, `count` how many follow. A section starts a new row.
   */
  sections?: ReadonlyArray<{ start: number; count: number }>
  /** The heading of section `index`. */
  renderSection?: (index: number) => ReactNode
  /** Height of a section heading, px. Default 44. */
  sectionHeight?: number
  /** Class for every cell wrapper. */
  cellClassName?: string
  className?: string
  style?: CSSProperties
  ref?: Ref<VirtualGridHandle>
}

/** A row of the grid: the heading of section `head` (-1 otherwise), or the items `first` (inclusive) to `last` (exclusive). */
interface GridRow {
  head: number
  first: number
  last: number
}

/**
 * Windowed, responsive grid for long lists (the Pokédex, the Living Dex). Only the visible rows
 * are in the DOM. Keyboard: one tab stop; arrows, Home / End (row), Ctrl+Home / Ctrl+End (grid),
 * PageUp / PageDown move between cells; Enter / Space activates.
 */
export function VirtualGrid<T>({ items, renderItem, itemKey, minColumnWidth, itemHeight, gap = 12, maxColumns, overscan = 3, scroll = 'page', label, onActivate, sections, renderSection, sectionHeight = 44, cellClassName, className, style, ref }: VirtualGridProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const scrollParent = useScrollParent()
  const [width, setWidth] = useState(0)
  const [scrollMargin, setScrollMargin] = useState(0)
  const [focusIndex, setFocusIndex] = useState(0)
  const pendingFocus = useRef<number | null>(null)

  const getScrollElement = useCallback((): HTMLElement | null => (scroll === 'self' ? rootRef.current : scrollParent), [scroll, scrollParent])

  // Measure the available width and, in page mode, where the grid starts inside the scroller.
  useLayoutEffect(() => {
    const inner = innerRef.current
    if (!inner) return
    const measure = (): void => {
      setWidth(inner.clientWidth)
      const scroller = scroll === 'page' ? scrollParent : null
      if (scroller) {
        const margin = inner.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
        setScrollMargin((old) => (Math.abs(old - margin) < 0.5 ? old : margin))
      } else {
        setScrollMargin(0)
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(inner)
    const content = scroll === 'page' ? scrollParent?.firstElementChild : null
    if (content) observer.observe(content)
    return () => observer.disconnect()
  }, [scroll, scrollParent])

  const count = items.length
  const columns = width <= 0 ? 0 : Math.max(1, Math.min(maxColumns ?? Infinity, Math.floor((width + gap) / (minColumnWidth + gap))))
  const columnWidth = columns > 0 ? (width - gap * (columns - 1)) / columns : 0
  const rowHeight = Math.max(1, Math.round(typeof itemHeight === 'function' ? itemHeight(columnWidth) : itemHeight))
  // The rows: lines of `columns` items, and with sections a heading row ahead of each section's lines.
  const { gridRows, rowOf } = useMemo(() => {
    const gridRows: GridRow[] = []
    const rowOf = new Int32Array(count).fill(-1)
    if (columns <= 0) return { gridRows, rowOf }
    const sectioned = sections !== undefined && sections.length > 0
    for (const [s, span] of (sectioned ? sections : [{ start: 0, count }]).entries()) {
      const end = Math.min(count, span.start + span.count)
      if (sectioned && end > span.start) gridRows.push({ head: s, first: -1, last: -1 })
      for (let first = span.start; first < end; first += columns) {
        const last = Math.min(end, first + columns)
        for (let i = first; i < last; i++) rowOf[i] = gridRows.length
        gridRows.push({ head: -1, first, last })
      }
    }
    return { gridRows, rowOf }
  }, [count, columns, sections])
  const rowCount = gridRows.length
  const safeFocus = count === 0 ? -1 : Math.min(focusIndex, count - 1)
  const focusRow = safeFocus >= 0 ? (rowOf[safeFocus] ?? -1) : -1

  // The row holding the roving tab stop stays mounted, so Tab can always get back into the grid.
  const rangeExtractor = useCallback(
    (range: Range): number[] => {
      const rows = defaultRangeExtractor(range)
      if (focusRow < 0 || focusRow >= range.count || rows.includes(focusRow)) return rows
      return [...rows, focusRow].sort((a, b) => a - b)
    },
    [focusRow]
  )

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement,
    estimateSize: (row) => ((gridRows[row]?.head ?? -1) >= 0 ? sectionHeight : rowHeight) + gap,
    overscan,
    scrollMargin,
    rangeExtractor
  })

  // Row height or column count changed: cached positions are stale.
  useLayoutEffect(() => {
    virtualizer.measure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowHeight, gap, columns, gridRows, sectionHeight])

  const columnsRef = useRef(columns)
  columnsRef.current = columns
  const rowOfRef = useRef(rowOf)
  rowOfRef.current = rowOf

  const scrollToIndex = useCallback<VirtualGridHandle['scrollToIndex']>(
    (index, options) => {
      const row = rowOfRef.current[index] ?? -1
      if (row < 0) return
      virtualizer.scrollToIndex(row, { align: options?.align ?? 'auto', behavior: options?.behavior })
    },
    [virtualizer]
  )

  const moveFocus = useCallback(
    (index: number) => {
      if (count === 0) return
      const next = Math.min(count - 1, Math.max(0, index))
      pendingFocus.current = next
      setFocusIndex(next)
      scrollToIndex(next)
    },
    [count, scrollToIndex]
  )

  useImperativeHandle(ref, () => ({ scrollToIndex, focusIndex: moveFocus, getColumnCount: () => columnsRef.current }), [scrollToIndex, moveFocus])

  // After any render, hand focus to the cell a key press asked for, once it exists.
  useEffect(() => {
    const wanted = pendingFocus.current
    if (wanted === null) return
    const cell = innerRef.current?.querySelector<HTMLElement>(`[data-vg-index="${wanted}"]`)
    if (cell) {
      pendingFocus.current = null
      cell.focus({ preventScroll: true })
    }
  })

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-vg-index]')
    if (!cell || cell !== event.target || columns <= 0) return
    const index = Number(cell.dataset.vgIndex)
    const { key } = event
    let next: number | null = null
    const own = gridRows[rowOf[index] ?? -1]
    if (!own) return
    // The cell `lines` lines of items below (or above) this one, in the same column; section headings are stepped over.
    const vertical = (lines: number): number => {
      const step = lines > 0 ? 1 : -1
      let at = index
      let left = Math.abs(lines)
      for (let r = (rowOf[index] ?? -1) + step; left > 0 && r >= 0 && r < gridRows.length; r += step) {
        const row = gridRows[r]
        if (!row || row.head >= 0) continue
        at = Math.min(row.last - 1, row.first + (index - own.first))
        left--
      }
      return at
    }
    if (key === 'ArrowRight') next = index + 1
    else if (key === 'ArrowLeft') next = index - 1
    else if (key === 'ArrowDown') next = vertical(1)
    else if (key === 'ArrowUp') next = vertical(-1)
    else if (key === 'Home') next = event.ctrlKey ? 0 : own.first
    else if (key === 'End') next = event.ctrlKey ? count - 1 : own.last - 1
    else if (key === 'PageDown' || key === 'PageUp') {
      const scroller = getScrollElement()
      const pageRows = Math.max(1, Math.floor((scroller?.clientHeight ?? rowHeight * 3) / (rowHeight + gap)) - 1)
      next = vertical(key === 'PageDown' ? pageRows : -pageRows)
    } else if ((key === 'Enter' || key === ' ') && onActivate) {
      event.preventDefault()
      const item = items[index]
      if (item !== undefined) onActivate(item, index)
      return
    }
    if (next === null) return
    event.preventDefault()
    moveFocus(next)
  }

  const totalHeight = Math.max(0, virtualizer.getTotalSize() - (rowCount > 0 ? gap : 0))
  const rows = columns > 0 ? virtualizer.getVirtualItems() : []

  return (
    <div ref={rootRef} className={cx('ui-vgrid', scroll === 'self' && 'ui-vgrid--self', className)} style={style}>
      <div ref={innerRef} role="grid" aria-label={label} aria-rowcount={rowCount} aria-colcount={columns || undefined} className="ui-vgrid__inner" style={{ height: totalHeight }} onKeyDown={onKeyDown}>
        {rows.map((row) => {
          const own = gridRows[row.index]
          if (!own) return null
          if (own.head >= 0) {
            return (
              <div key={row.key} role="presentation" className="ui-vgrid__row ui-vgrid__row--section" style={{ height: sectionHeight, transform: `translateY(${row.start - scrollMargin}px)` }}>
                {renderSection?.(own.head)}
              </div>
            )
          }
          const { first, last } = own
          const cells: ReactNode[] = []
          for (let i = first; i < last; i++) {
            const item = items[i] as T
            cells.push(
              <div
                key={itemKey ? itemKey(item, i) : i}
                role="gridcell"
                aria-colindex={i - first + 1}
                tabIndex={i === safeFocus ? 0 : -1}
                data-vg-index={i}
                className={cx('ui-vgrid__cell', cellClassName)}
                onFocus={() => i !== focusIndex && setFocusIndex(i)}
                onClick={onActivate ? () => onActivate(item, i) : undefined}
              >
                {renderItem(item, i)}
              </div>
            )
          }
          return (
            <div
              key={row.key}
              role="row"
              aria-rowindex={row.index + 1}
              className="ui-vgrid__row"
              style={{ height: rowHeight, transform: `translateY(${row.start - scrollMargin}px)`, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, columnGap: gap }}
            >
              {cells}
            </div>
          )
        })}
      </div>
    </div>
  )
}
