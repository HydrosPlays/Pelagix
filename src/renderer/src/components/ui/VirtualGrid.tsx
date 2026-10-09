import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type Ref } from 'react'
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
  /** Class for every cell wrapper. */
  cellClassName?: string
  className?: string
  style?: CSSProperties
  ref?: Ref<VirtualGridHandle>
}

/**
 * Windowed, responsive grid for long lists (the Pokédex, the Living Dex). Only the visible rows
 * are in the DOM. Keyboard: one tab stop; arrows, Home / End (row), Ctrl+Home / Ctrl+End (grid),
 * PageUp / PageDown move between cells; Enter / Space activates.
 */
export function VirtualGrid<T>({ items, renderItem, itemKey, minColumnWidth, itemHeight, gap = 12, maxColumns, overscan = 3, scroll = 'page', label, onActivate, cellClassName, className, style, ref }: VirtualGridProps<T>) {
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
  const rowCount = columns > 0 ? Math.ceil(count / columns) : 0
  const safeFocus = count === 0 ? -1 : Math.min(focusIndex, count - 1)
  const focusRow = columns > 0 && safeFocus >= 0 ? Math.floor(safeFocus / columns) : -1

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
    estimateSize: () => rowHeight + gap,
    overscan,
    scrollMargin,
    rangeExtractor
  })

  // Row height or column count changed: cached positions are stale.
  useLayoutEffect(() => {
    virtualizer.measure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowHeight, gap, columns])

  const columnsRef = useRef(columns)
  columnsRef.current = columns

  const scrollToIndex = useCallback<VirtualGridHandle['scrollToIndex']>(
    (index, options) => {
      const cols = columnsRef.current
      if (cols <= 0) return
      virtualizer.scrollToIndex(Math.floor(index / cols), { align: options?.align ?? 'auto', behavior: options?.behavior })
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
    if (key === 'ArrowRight') next = index + 1
    else if (key === 'ArrowLeft') next = index - 1
    else if (key === 'ArrowDown') next = index + columns >= count ? (Math.floor(index / columns) < rowCount - 1 ? count - 1 : index) : index + columns
    else if (key === 'ArrowUp') next = index - columns < 0 ? index : index - columns
    else if (key === 'Home') next = event.ctrlKey ? 0 : index - (index % columns)
    else if (key === 'End') next = event.ctrlKey ? count - 1 : Math.min(count - 1, index - (index % columns) + columns - 1)
    else if (key === 'PageDown' || key === 'PageUp') {
      const scroller = getScrollElement()
      const pageRows = Math.max(1, Math.floor((scroller?.clientHeight ?? rowHeight * 3) / (rowHeight + gap)) - 1)
      next = index + (key === 'PageDown' ? 1 : -1) * pageRows * columns
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
          const first = row.index * columns
          const last = Math.min(count, first + columns)
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
