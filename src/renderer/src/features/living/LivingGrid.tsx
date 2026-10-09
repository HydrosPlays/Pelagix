import { memo, useCallback, useEffect, useId, useImperativeHandle, useRef, type CSSProperties, type FocusEvent, type KeyboardEvent, type MouseEvent, type Ref } from 'react'
import { GENERATION_NAMES } from '@shared/games'
import { BallIcon, Sprite } from '@renderer/components/pokemon'
import { Icon, cx } from '@renderer/components/ui'
import type { Collection, LivingSlot } from '@renderer/domain/slots'
import { dexNo, formatCount, ratio } from '@renderer/lib/format'
import { FloatingTip, useHoverTarget } from './HoverTip'
import {
  BOX_GAP, LIST_GAP, MOVE_KEYS, boxRange, moveFocus, slotInfo, slotMarker, slotStatus, slotTitle,
  type BoxModel, type GenStat, type LivingLayout, type LivingMode, type LivingRow, type LivingStats, type MoveKey, type SlotMarker
} from './model'
import { useRowWindow, type ScrollToRowOptions } from './windowing'

export interface LivingGridHandle {
  /** Scrolls the slot's row into view. False when the slot is not shown or nothing had to move. */
  scrollToSlot(index: number, options?: ScrollToRowOptions): boolean
  /** Moves keyboard focus onto the slot, scrolling it into view first unless `scroll` is false. */
  focusSlot(index: number, scroll?: boolean): void
  /** The slot's button, while its row is mounted. */
  slotElement(index: number): HTMLElement | null
  /** The panel of a box, while its row is mounted. */
  boxElement(boxIndex: number): HTMLElement | null
  /** The element all rows are positioned in. */
  listElement(): HTMLElement | null
}

export interface LivingGridProps {
  collection: Collection
  mode: LivingMode
  layout: LivingLayout
  /** Side of one slot cell, px. */
  cell: number
  /** Boxes side by side (box view) or tiles per line (list view). */
  columns: number
  stats: LivingStats
  /** Under "Missing only" in the box view a caught slot keeps its place as a quiet tick. */
  quietFilled: boolean
  /** The divider of each generation counts what is missing instead of what is caught. */
  countMissing: boolean
  scroller: HTMLElement | null
  /** Height of the sticky toolbar the rows scroll under, px. */
  inset: number
  /** Slot index holding the grid's tab stop. */
  focusIndex: number
  /** Slot index to ring as "found", or -1. */
  foundIndex: number
  onFocusIndex: (index: number) => void
  onOpen: (index: number) => void
  /** First and last slot index on screen, whenever that changes. */
  onVisible: (first: number, last: number) => void
  ref?: Ref<LivingGridHandle>
}

// ---------------------------------------------------------------- one slot

const MARKER_LABEL: Readonly<Record<SlotMarker, string>> = { male: '♂', female: '♀', gmax: 'G', variant: '' }

interface SlotCellProps {
  slot: LivingSlot
  index: number
  shiny: boolean
  filled: boolean
  count: number
  ball: number | undefined
  /** In normal mode: the slot also holds a shiny. */
  sparkle: boolean
  /** Accessible status ("Caught · 2 entries"). */
  status: string
  tabbable: boolean
  found: boolean
  quiet: boolean
  /** Print the dex number under the render (list view). */
  caption: boolean
  resolution: number
}

const SlotCell = memo(function SlotCell({ slot, index, shiny, filled, count, ball, sparkle, status, tabbable, found, quiet, caption, resolution }: SlotCellProps) {
  const marker = slotMarker(slot)
  return (
    <button
      type="button"
      className={cx('living-slot', filled ? 'is-filled' : 'is-missing', shiny && 'is-shiny', found && 'is-found', quiet && 'is-quiet', caption && 'has-caption')}
      data-slot={index}
      data-key={slot.key}
      tabIndex={tabbable ? 0 : -1}
      aria-haspopup="dialog"
      aria-label={`${slotTitle(slot)}, ${status}`}
    >
      <span className="living-slot__art">
        {quiet ? (
          <span className="living-slot__tick">
            <Icon name="check" size={14} strokeWidth={2.4} />
          </span>
        ) : (
          <Sprite path={slot.spritePath(shiny)} size="fill" resolution={resolution} silhouette={!filled} />
        )}
        {marker !== null && (
          <span className={cx('living-slot__marker', `living-slot__marker--${marker}`)}>{marker === 'variant' ? <Icon name="layers" size={9} strokeWidth={2.4} /> : MARKER_LABEL[marker]}</span>
        )}
        {!quiet && filled && count > 1 && <span className="living-slot__count">{count > 99 ? '99+' : count}</span>}
        {!quiet && filled && ball !== undefined && <BallIcon ball={ball} size={resolution >= 60 ? 16 : 14} label="" className="living-slot__ball" />}
        {!quiet && sparkle && (
          <span className="living-slot__sparkle">
            <Icon name="sparkle" size={11} />
          </span>
        )}
      </span>
      {caption && <span className="living-slot__no">{dexNo(slot.species)}</span>}
    </button>
  )
})

interface SlotBinding {
  collection: Collection
  mode: LivingMode
  /** Global index of the slot holding the tab stop, or -1 when it is elsewhere. */
  tabStop: number
  found: number
  resolution: number
}

function renderSlot(slot: LivingSlot, index: number, bind: SlotBinding, extra: { quietFilled: boolean; caption: boolean }) {
  const info = slotInfo(bind.collection, slot.key, bind.mode)
  return (
    <SlotCell
      key={slot.key}
      slot={slot}
      index={index}
      shiny={bind.mode === 'shiny'}
      filled={info.filled}
      count={info.count}
      ball={info.ball}
      sparkle={bind.mode === 'normal' && info.hasShiny}
      status={slotStatus(info, bind.mode)}
      tabbable={index === bind.tabStop}
      found={index === bind.found}
      quiet={extra.quietFilled && info.filled}
      caption={extra.caption}
      resolution={bind.resolution}
    />
  )
}

// ---------------------------------------------------------------- rows

interface BoxPanelProps extends SlotBinding {
  box: BoxModel
  filled: number
  quietFilled: boolean
}

const BoxPanel = memo(function BoxPanel({ box, filled, quietFilled, ...bind }: BoxPanelProps) {
  const titleId = useId()
  const size = box.slots.length
  const complete = size > 0 && filled === size
  return (
    <section className={cx('living-box', complete && 'is-complete', bind.mode === 'shiny' && 'is-shiny')} data-box={box.index} aria-labelledby={titleId}>
      <header className="living-box__head">
        <h2 id={titleId} className="living-box__title">
          Box {box.index + 1}
        </h2>
        <span className="living-box__range">{boxRange(box)}</span>
        <span className="living-box__status">
          {complete ? (
            <>
              <Icon name="check" size={13} strokeWidth={2.6} />
              Complete
            </>
          ) : (
            <>
              <b>{filled}</b> / {size}
            </>
          )}
        </span>
        <span className="living-box__bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${ratio(filled, size)})` }} />
        </span>
      </header>
      <div className="living-box__grid">{box.slots.map((slot, k) => renderSlot(slot, box.start + k, bind, { quietFilled, caption: false }))}</div>
    </section>
  )
})

interface SlotsRowProps extends SlotBinding {
  indices: readonly number[]
}

const SlotsRow = memo(function SlotsRow({ indices, ...bind }: SlotsRowProps) {
  const { slots } = bind.collection
  return (
    <>
      {indices.map((index) => {
        const slot = slots[index]
        return slot ? renderSlot(slot, index, bind, { quietFilled: false, caption: true }) : null
      })}
    </>
  )
})

function Divider({ gen, stat, countMissing }: { gen: number; stat: GenStat | undefined; countMissing: boolean }) {
  const name = GENERATION_NAMES[gen] ?? (gen > 0 ? `Generation ${gen}` : 'Other Pokémon')
  const missing = stat ? stat.slots - stat.filled : 0
  return (
    <div className="living-divider">
      <h2 className="living-divider__title">{name}</h2>
      {stat && (
        <span className="living-divider__count">
          {countMissing ? (
            `${formatCount(missing)} missing`
          ) : (
            <>
              <b>{formatCount(stat.filled)}</b> / {formatCount(stat.slots)}
            </>
          )}
        </span>
      )}
      <span className="living-divider__line" aria-hidden="true" />
    </div>
  )
}

/** First and last slot index a row draws; null for a divider. */
function rowSpan(row: LivingRow | undefined): [number, number] | null {
  if (!row) return null
  if (row.kind === 'boxes') {
    const first = row.boxes[0]
    const last = row.boxes[row.boxes.length - 1]
    return first && last ? [first.start, last.start + last.slots.length - 1] : null
  }
  if (row.kind === 'slots') {
    const first = row.indices[0]
    const last = row.indices[row.indices.length - 1]
    return first !== undefined && last !== undefined ? [first, last] : null
  }
  return null
}

// ---------------------------------------------------------------- the grid

/**
 * The slots of the Living Dex, windowed by row: a row of boxes in the box view, a line of tiles
 * or a generation divider in the list view. One tab stop for the whole grid; the arrow keys walk
 * the slots the way they sit on screen, Enter or a click opens one.
 */
export function LivingGrid({ collection, mode, layout, cell, columns, stats, quietFilled, countMissing, scroller, inset, focusIndex, foundIndex, onFocusIndex, onOpen, onVisible, ref }: LivingGridProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const hintId = useId()
  const pendingFocus = useRef<number | null>(null)
  const { rows, offsets } = layout
  const { window: win, scrollToRow } = useRowWindow({ scroller, listRef, offsets, inset, overscan: 320, gap: layout.view === 'boxes' ? BOX_GAP : LIST_GAP })
  const tip = useHoverTarget('[data-slot]')

  const slotElement = useCallback((index: number): HTMLElement | null => listRef.current?.querySelector<HTMLElement>(`[data-slot="${index}"]`) ?? null, [])

  const scrollToSlot = useCallback<LivingGridHandle['scrollToSlot']>(
    (index, options) => {
      const row = layout.rowOf[index] ?? -1
      return row >= 0 && scrollToRow(row, options)
    },
    [layout, scrollToRow]
  )

  const focusSlot = useCallback(
    (index: number, scroll = true) => {
      if ((layout.rowOf[index] ?? -1) < 0) return
      onFocusIndex(index)
      if (scroll) scrollToSlot(index, { align: 'nearest' })
      const element = slotElement(index)
      if (element) element.focus({ preventScroll: true })
      else pendingFocus.current = index
    },
    [layout, onFocusIndex, scrollToSlot, slotElement]
  )

  useImperativeHandle(
    ref,
    () => ({
      scrollToSlot,
      focusSlot,
      slotElement,
      boxElement: (boxIndex) => listRef.current?.querySelector<HTMLElement>(`[data-box="${boxIndex}"]`) ?? null,
      listElement: () => listRef.current
    }),
    [scrollToSlot, focusSlot, slotElement]
  )

  // After any render, hand focus to the slot a key press asked for, once its row is mounted.
  useEffect(() => {
    const wanted = pendingFocus.current
    if (wanted === null) return
    const element = slotElement(wanted)
    if (element) {
      pendingFocus.current = null
      element.focus({ preventScroll: true })
    }
  })

  // Tell the page which slots are on screen (box index, generation tabs).
  const firstVisible = rowSpan(rows[win.top]) ?? rowSpan(rows[win.top + 1])
  const lastVisible = rowSpan(rows[win.bottom]) ?? rowSpan(rows[win.bottom - 1])
  const visibleFrom = firstVisible?.[0] ?? -1
  const visibleTo = lastVisible?.[1] ?? -1
  useEffect(() => {
    onVisible(visibleFrom, visibleTo)
  }, [onVisible, visibleFrom, visibleTo])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!MOVE_KEYS.has(event.key) || event.altKey || event.metaKey || event.shiftKey) return
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-slot]')
    if (!element) return
    event.preventDefault()
    const from = Number(element.dataset.slot)
    const next = moveFocus(layout, from, event.key as MoveKey, event.ctrlKey)
    if (next >= 0 && next !== from) focusSlot(next)
  }

  const onClick = (event: MouseEvent<HTMLDivElement>): void => {
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-slot]')
    if (!element) return
    tip.hide()
    onOpen(Number(element.dataset.slot))
  }

  const onFocus = (event: FocusEvent<HTMLDivElement>): void => {
    tip.handlers.onFocus(event)
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-slot]')
    if (!element) return
    const index = Number(element.dataset.slot)
    if (index !== focusIndex) onFocusIndex(index)
  }

  // The row holding the tab stop stays mounted, so Tab can always get back into the grid.
  const mounted: number[] = []
  for (let i = win.start; i < win.end && i < rows.length; i++) mounted.push(i)
  const keep = layout.rowOf[focusIndex] ?? -1
  if (keep >= 0 && keep < rows.length && (keep < win.start || keep >= win.end)) mounted.push(keep)

  const resolution = cell
  const genStats = new Map(stats.gens.map((g) => [g.gen, g]))
  const total = offsets[rows.length] ?? 0
  const tipIndex = tip.target ? Number(tip.target.dataset.slot) : -1
  const tipSlot = tipIndex >= 0 ? collection.slots[tipIndex] : undefined
  const tipInfo = tipSlot ? slotInfo(collection, tipSlot.key, mode) : null

  return (
    <div
      ref={listRef}
      role="group"
      aria-label={mode === 'shiny' ? 'Shiny Living Dex slots' : 'Living Dex slots'}
      aria-describedby={hintId}
      className={cx('living-grid', `living-grid--${layout.view}`, mode === 'shiny' && 'is-shiny')}
      style={{ height: total, '--living-cell': `${cell}px`, '--living-columns': columns, '--living-box-gap': `${BOX_GAP}px`, '--living-list-gap': `${LIST_GAP}px` } as CSSProperties}
      onKeyDown={onKeyDown}
      onClick={onClick}
      onFocus={onFocus}
      onBlur={tip.handlers.onBlur}
      onPointerOver={tip.handlers.onPointerOver}
      onPointerOut={tip.handlers.onPointerOut}
      onPointerDown={tip.handlers.onPointerDown}
    >
      <span id={hintId} className="u-sr-only">
        Use the arrow keys to move between slots and Enter to open one.
      </span>
      {mounted.map((i) => {
        const row = rows[i]
        if (!row) return null
        const style: CSSProperties = { height: row.height, transform: `translateY(${offsets[i] ?? 0}px)` }
        const span = rowSpan(row)
        const holds = (index: number): number => (span && index >= span[0] && index <= span[1] ? index : -1)
        if (row.kind === 'boxes') {
          return (
            <div key={row.key} className="living-row living-row--boxes" style={style}>
              {row.boxes.map((box) => {
                const inBox = (index: number): number => (index >= box.start && index < box.start + box.slots.length ? index : -1)
                return (
                  <BoxPanel
                    key={box.index}
                    box={box}
                    filled={stats.boxFilled[box.index] ?? 0}
                    quietFilled={quietFilled}
                    collection={collection}
                    mode={mode}
                    tabStop={inBox(focusIndex)}
                    found={inBox(foundIndex)}
                    resolution={resolution}
                  />
                )
              })}
            </div>
          )
        }
        if (row.kind === 'divider') {
          return (
            <div key={row.key} className="living-row living-row--divider" style={style}>
              <Divider gen={row.gen} stat={genStats.get(row.gen)} countMissing={countMissing} />
            </div>
          )
        }
        return (
          <div key={row.key} className="living-row living-row--slots" style={style}>
            <SlotsRow indices={row.indices} collection={collection} mode={mode} tabStop={holds(focusIndex)} found={holds(foundIndex)} resolution={resolution} />
          </div>
        )
      })}
      {tip.target && tipSlot && tipInfo && (
        <FloatingTip key={tipIndex} target={tip.target}>
          <span className="living-tip__title">{slotTitle(tipSlot)}</span>
          <span className={cx('living-tip__status', tipInfo.filled && 'is-filled', mode === 'shiny' && 'is-shiny')}>{slotStatus(tipInfo, mode)}</span>
        </FloatingTip>
      )}
    </div>
  )
}
