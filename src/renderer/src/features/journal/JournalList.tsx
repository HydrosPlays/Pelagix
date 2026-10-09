import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type Ref } from 'react'
import type { CatchEntry } from '@shared/save-types'
import { ENTRY_CARD_METRICS, EntryCard, GameBadge, ShinyMark } from '@renderer/components/pokemon'
import { Checkbox, Icon, cx } from '@renderer/components/ui'
import { offsetsOf, rowAt, useRowWindow, type ScrollToRowOptions } from '@renderer/features/living/windowing'
import { UNKNOWN_GAME, type JournalGroup, type JournalItem, type JournalListing } from './model'

export const HEADER_HEIGHT = 40
export const ROW_GAP = 4

export interface JournalListHandle {
  /** Scrolls the entry's row into view. False when it is not listed or nothing had to move. */
  scrollToEntry(id: string, options?: ScrollToRowOptions): boolean
  /** Brings the first row up under the filter bar. */
  scrollToTop(): void
  /** Scrolls to the entry and puts keyboard focus on its row. False when it is not listed. */
  focusEntry(id: string): boolean
}

export interface JournalListProps {
  listing: JournalListing
  scroller: HTMLElement | null
  /** Height of the sticky filter bar the rows scroll under, px. */
  inset: number
  /** Selection mode: rows show a checkbox and activating one toggles it. */
  selecting: boolean
  selected: ReadonlySet<string>
  /** Entry to ring as just added, or null. */
  highlightId: string | null
  onOpen: (entry: CatchEntry) => void
  /** `range`: the user held Shift, so everything up to the last toggled row follows. */
  onToggle: (id: string, range: boolean) => void
  onDuplicated: (copy: CatchEntry) => void
  ref?: Ref<JournalListHandle>
}

// ---------------------------------------------------------------- rows

function GroupHeader({ group }: { group: JournalGroup }) {
  return (
    <div className="journal-group">
      {group.gameKey !== undefined && group.gameKey !== UNKNOWN_GAME ? (
        <GameBadge game={group.gameKey} size="sm" short={false} />
      ) : (
        <span className="journal-group__label">
          {group.gameKey === UNKNOWN_GAME && <Icon name="help" size={15} />}
          {group.label}
        </span>
      )}
      <span className="journal-group__count">
        {group.count.toLocaleString('en-US')} {group.count === 1 ? 'entry' : 'entries'}
      </span>
      {group.shiny > 0 && (
        <span className="journal-group__shiny">
          <ShinyMark size={12} label="" />
          {group.shiny.toLocaleString('en-US')} shiny
        </span>
      )}
    </div>
  )
}

interface EntryRowProps {
  item: JournalItem
  selecting: boolean
  selected: boolean
  highlight: boolean
  onOpen: (entry: CatchEntry) => void
  onToggle: (id: string, range: boolean) => void
  onDuplicated: (copy: CatchEntry) => void
  onDeleted: (entry: CatchEntry) => void
}

const EntryRow = memo(function EntryRow({ item, selecting, selected, highlight, onOpen, onToggle, onDuplicated, onDeleted }: EntryRowProps) {
  const { entry } = item
  // Whether Shift was down for the click that is about to toggle the row.
  const shift = useRef(false)
  const menu = useMemo(() => ({ onDuplicated, onDeleted }), [onDuplicated, onDeleted])
  return (
    <div
      className="journal-entry"
      onClickCapture={(event) => {
        shift.current = event.shiftKey
      }}
    >
      {selecting && (
        <span className="journal-entry__check">
          <Checkbox checked={selected} ariaLabel={`Select ${item.name}`} onChange={() => onToggle(entry.id, shift.current)} />
        </span>
      )}
      <EntryCard
        entry={entry}
        variant="row"
        actions={!selecting}
        menu={menu}
        highlight={highlight}
        className={cx('journal-entry__card', selected && 'is-selected')}
        onOpen={selecting ? () => onToggle(entry.id, shift.current) : onOpen}
        openLabel={selecting ? `${selected ? 'Deselect' : 'Select'} ${item.name}` : undefined}
      />
    </div>
  )
})

// ---------------------------------------------------------------- the list

/** The control of an entry row that owns its keyboard focus: the row's own button, or its checkbox. */
function rowControl(row: Element | null | undefined, checkbox: boolean): HTMLElement | null {
  if (!row) return null
  return checkbox ? row.querySelector<HTMLElement>('input[type="checkbox"]') : row.querySelector<HTMLElement>('article > button')
}

/**
 * Every listed entry, windowed by row, under the header of its group. The header of the group at
 * the top of the screen stays put under the filter bar. Up / Down move between rows.
 */
export function JournalList({ listing, scroller, inset, selecting, selected, highlightId, onOpen, onToggle, onDuplicated, ref }: JournalListProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const floatRef = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<{ row: number; checkbox: boolean } | null>(null)
  const [focusRow, setFocusRow] = useState(-1)
  const [floating, setFloating] = useState<JournalGroup | null>(null)
  const { rows, rowOf } = listing
  const selectingNow = useRef(selecting)
  selectingNow.current = selecting

  const offsets = useMemo(() => offsetsOf(rows.map((row) => (row.kind === 'header' ? HEADER_HEIGHT : ENTRY_CARD_METRICS.rowHeight)), ROW_GAP), [rows])
  /** Per row: the row index of the next group header (or the row count), to push the floating header out. */
  const nextHeader = useMemo(() => {
    const next = new Int32Array(rows.length)
    let upcoming = rows.length
    for (let i = rows.length - 1; i >= 0; i--) {
      next[i] = upcoming
      if (rows[i]?.kind === 'header') upcoming = i
    }
    return next
  }, [rows])

  const frame = useRef({ rows, offsets, nextHeader, inset })
  frame.current = { rows, offsets, nextHeader, inset }

  // Keeps the floating header in step with the scroll: which group it names, and the push from the next one.
  const onFrame = useCallback((viewTop: number) => {
    const { rows: r, offsets: o, nextHeader: n, inset: i } = frame.current
    const float = floatRef.current
    const line = viewTop + i
    const total = o[r.length] ?? 0
    if (!float || r.length === 0 || line <= 0 || line >= total) {
      float?.removeAttribute('data-on')
      setFloating(null)
      return
    }
    const at = rowAt(o, line)
    const upcoming = n[at] ?? r.length
    const room = (o[upcoming] ?? total) - line
    float.setAttribute('data-on', '')
    float.style.transform = room < HEADER_HEIGHT ? `translateY(${Math.round(room - HEADER_HEIGHT)}px)` : ''
    const group = r[at]?.group ?? null
    setFloating((old) => (old === group ? old : group))
  }, [])

  const { window: win, scrollToRow, refresh } = useRowWindow({ scroller, listRef, offsets, inset, overscan: 360, gap: ROW_GAP, onFrame })

  // Rows changed under the same scroll position: the floating header may name a group that is gone.
  useEffect(refresh, [refresh, rows])

  useImperativeHandle(
    ref,
    () => ({
      scrollToEntry(id, options) {
        const row = rowOf.get(id)
        return row !== undefined && scrollToRow(row, options)
      },
      scrollToTop() {
        scrollToRow(0, { align: 'start' })
      },
      focusEntry(id) {
        const row = rowOf.get(id)
        if (row === undefined) return false
        setFocusRow(row)
        scrollToRow(row, { align: 'nearest' })
        const checkbox = selectingNow.current
        const control = rowControl(listRef.current?.querySelector(`[data-row="${row}"]`), checkbox)
        if (control) control.focus({ preventScroll: true })
        else pendingFocus.current = { row, checkbox }
        return true
      }
    }),
    [rowOf, scrollToRow]
  )

  // A row deleted from its own menu takes the keyboard focus with it. The row that moves into its
  // place gets it (or the last one, at the end of the list), so the arrow keys carry on from there.
  const rowOfNow = useRef(rowOf)
  rowOfNow.current = rowOf
  const deletedRow = useRef<number | null>(null)
  const onDeleted = useCallback((entry: CatchEntry) => {
    deletedRow.current = rowOfNow.current.get(entry.id) ?? null
  }, [])
  useEffect(() => {
    const at = deletedRow.current
    if (at === null) return
    deletedRow.current = null
    const active = document.activeElement
    if (active !== null && active !== document.body && active.isConnected) return
    let next = at
    while (next < rows.length && rows[next]?.kind !== 'entry') next++
    if (next >= rows.length) {
      next = Math.min(at, rows.length) - 1
      while (next >= 0 && rows[next]?.kind !== 'entry') next--
    }
    if (next < 0) return
    setFocusRow(next)
    pendingFocus.current = { row: next, checkbox: selectingNow.current }
  })

  // After any render, hand focus to the row a key press asked for, once it is mounted.
  useEffect(() => {
    const wanted = pendingFocus.current
    if (!wanted) return
    const control = rowControl(listRef.current?.querySelector(`[data-row="${wanted.row}"]`), wanted.checkbox)
    if (control) {
      pendingFocus.current = null
      control.focus({ preventScroll: true })
    }
  })

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const { key } = event
    if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Home' && key !== 'End') return
    if (event.altKey || event.metaKey || event.shiftKey) return
    const target = event.target as HTMLElement
    const rowElement = target.closest<HTMLElement>('[data-row]')
    if (!rowElement) return
    const checkbox = target instanceof HTMLInputElement
    if (rowControl(rowElement, checkbox) !== target) return
    const from = Number(rowElement.dataset.row)
    const step = key === 'ArrowDown' || key === 'Home' ? 1 : -1
    let next = key === 'Home' ? 0 : key === 'End' ? rows.length - 1 : from + step
    while (next >= 0 && next < rows.length && rows[next]?.kind !== 'entry') next += key === 'End' ? -1 : step
    if (next < 0 || next >= rows.length) return
    event.preventDefault()
    if (next === from) return
    setFocusRow(next)
    scrollToRow(next, { align: 'nearest' })
    const control = rowControl(listRef.current?.querySelector(`[data-row="${next}"]`), checkbox)
    if (control) control.focus({ preventScroll: true })
    else pendingFocus.current = { row: next, checkbox }
  }

  const onFocus = (event: FocusEvent<HTMLDivElement>): void => {
    const rowElement = (event.target as HTMLElement).closest<HTMLElement>('[data-row]')
    if (rowElement) setFocusRow(Number(rowElement.dataset.row))
  }

  // The row holding keyboard focus stays mounted while it scrolls out of view.
  const mounted: number[] = []
  for (let i = win.start; i < win.end && i < rows.length; i++) mounted.push(i)
  if (focusRow >= 0 && focusRow < rows.length && (focusRow < win.start || focusRow >= win.end)) mounted.push(focusRow)

  return (
    <div ref={listRef} className={cx('journal-list', selecting && 'is-selecting')} style={{ height: offsets[rows.length] ?? 0 }} onKeyDown={onKeyDown} onFocus={onFocus}>
      {/* A copy of the current group's header that sticks under the filter bar. The real headers stay in the list. */}
      <div className="journal-float" style={{ top: inset }} aria-hidden="true">
        <div ref={floatRef} className="journal-float__inner">
          {floating && <GroupHeader group={floating} />}
        </div>
      </div>
      {mounted.map((i) => {
        const row = rows[i]
        if (!row) return null
        const style: CSSProperties = { height: row.kind === 'header' ? HEADER_HEIGHT : ENTRY_CARD_METRICS.rowHeight, transform: `translateY(${offsets[i] ?? 0}px)` }
        if (row.kind === 'header') {
          return (
            <div key={row.key} className="journal-row journal-row--header" data-row={i} style={style} role="heading" aria-level={2}>
              <GroupHeader group={row.group} />
            </div>
          )
        }
        const id = row.item.entry.id
        return (
          <div key={row.key} className="journal-row" data-row={i} style={style}>
            <EntryRow item={row.item} selecting={selecting} selected={selected.has(id)} highlight={highlightId === id} onOpen={onOpen} onToggle={onToggle} onDuplicated={onDuplicated} onDeleted={onDeleted} />
          </div>
        )
      })}
    </div>
  )
}
