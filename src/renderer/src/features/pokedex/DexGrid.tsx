import { memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { VirtualGrid, type VirtualGridHandle } from '@renderer/components/ui'
import { enterStagger } from '@renderer/lib/anim'
import type { DexDensity } from '@renderer/store/ui'
import { dexMemory, rememberScroll } from './dex-store'
import type { DexDisplay, DexTile } from './dex-query'
import { DexTileView, TILE_METRICS, tileHeight } from './DexTile'

/** How long after a result change newly mounted tiles still count as part of that change. */
const ENTER_WINDOW_MS = 600

export interface DexGridHandle {
  /** Moves keyboard focus onto a tile, scrolling it into view first. */
  focusTile(index: number): void
}

export interface DexGridProps {
  tiles: readonly DexTile[]
  /** `viewKeyOf(tiles)`: changes exactly when the ordered result does. */
  viewKey: string
  display: DexDisplay
  density: DexDensity
  shinyView: boolean
  /** Accessible name of the grid. */
  label: string
  handleRef: RefObject<DexGridHandle | null>
  onOpen: (tile: DexTile) => void
  /** Shown instead of the grid when there are no tiles. */
  empty: ReactNode
}

interface EntranceState {
  armed: boolean
  /** Keys of the tiles the last entrance played on. */
  shown: string
  timer: ReturnType<typeof setTimeout> | null
  observer: MutationObserver | null
}

/**
 * The scrolling tile grid. Besides drawing the tiles it owns three behaviours:
 * - the scroll position is remembered, and restored when the user comes back to the same list;
 * - focus returns to the tile that was opened;
 * - the tiles in view play a staggered entrance on first paint and whenever the result changes.
 */
export const DexGrid = memo(function DexGrid({ tiles, viewKey, display, density, shinyView, label, handleRef, onOpen, empty }: DexGridProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<VirtualGridHandle>(null)
  const viewKeyRef = useRef(viewKey)
  viewKeyRef.current = viewKey
  const tilesRef = useRef(tiles)
  tilesRef.current = tiles
  const metrics = TILE_METRICS[density]
  const hasTiles = tiles.length > 0

  const scroller = useCallback((): HTMLElement | null => hostRef.current?.querySelector<HTMLElement>('.ui-vgrid') ?? null, [])

  // `VirtualGrid.focusIndex` only takes effect when it changes the grid's own focus index, so a
  // tile that is already rendered is focused directly.
  const focusTile = useCallback((index: number) => {
    const cell = hostRef.current?.querySelector<HTMLElement>(`[data-vg-index="${index}"]`)
    if (!cell) {
      gridRef.current?.focusIndex(index)
      return
    }
    gridRef.current?.scrollToIndex(index)
    cell.focus({ preventScroll: true })
  }, [])
  useImperativeHandle(handleRef, () => ({ focusTile }), [focusTile])

  // ---- scroll memory
  useLayoutEffect(() => {
    const el = scroller()
    if (!el) return
    const onScroll = (): void => rememberScroll(viewKeyRef.current, el.scrollTop)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scroller, hasTiles])

  // Scroll events arrive with the next frame, so a tile opened right after a wheel flick could
  // leave a stale position behind: the exact one is noted at the moment of opening.
  const onActivate = useCallback(
    (tile: DexTile) => {
      const el = scroller()
      if (el) rememberScroll(viewKeyRef.current, el.scrollTop)
      onOpen(tile)
    },
    [scroller, onOpen]
  )

  // Coming back to the list the user left: same scroll position, focus on the tile they opened.
  useLayoutEffect(() => {
    const el = scroller()
    const target = dexMemory.viewKey === viewKeyRef.current ? dexMemory.scrollTop : 0
    const focusKey = dexMemory.focusKey
    if (!el || (target <= 0 && focusKey === null)) return
    let frame = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let tries = 0
    let live = true
    // The grid has its full height once it has measured itself; a few frames make sure the position
    // sticks. Each step also has a timer behind it, because a hidden window produces no frames.
    const settle = (): void => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      if (!live) return
      const off = target > 0 && Math.abs(el.scrollTop - target) > 1
      if (off) el.scrollTop = target
      if (++tries < 5 && (off || tries < 3)) {
        frame = requestAnimationFrame(settle)
        timer = setTimeout(settle, 60)
        return
      }
      if (focusKey === null) return
      dexMemory.focusKey = null
      const index = tilesRef.current.findIndex((tile) => tile.key === focusKey)
      if (index >= 0) focusTile(index)
    }
    queueMicrotask(settle)
    return () => {
      live = false
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
    // Once, when the page mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- entrance
  const entrance = useRef<EntranceState>({ armed: false, shown: '', timer: null, observer: null })

  const disarm = useCallback(() => {
    const state = entrance.current
    state.armed = false
    state.observer?.disconnect()
    state.observer = null
    if (state.timer !== null) clearTimeout(state.timer)
    state.timer = null
  }, [])

  /** Plays the entrance on the tiles in view, as soon as there are any. */
  const playEntrance = useCallback(() => {
    const state = entrance.current
    const host = hostRef.current
    if (!state.armed || !host) return
    const bounds = host.getBoundingClientRect()
    const inView = Array.from(host.querySelectorAll<HTMLElement>('.dex-tile'))
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.bottom > bounds.top && rect.top < bounds.bottom)
    // Nothing laid out yet (the grid is still measuring, or has not caught up with a scroll change): wait for tiles to mount.
    if (inView.length === 0) return
    disarm()
    const shown = inView.map(({ el }) => el.dataset.key).join(' ')
    if (shown === state.shown) return
    state.shown = shown
    // A diagonal sweep from the top-left corner.
    inView.sort((a, b) => a.rect.top + a.rect.left * 0.45 - (b.rect.top + b.rect.left * 0.45))
    const step = Math.min(24, Math.max(5, 380 / inView.length))
    enterStagger(
      inView.map(({ el }) => el),
      { step, y: 10, duration: 320, limit: inView.length }
    )
  }, [disarm])

  const lastKey = useRef<string | null>(null)
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    // A different list starts at the top. (On mount there is no previous list: the position is being restored.)
    if (lastKey.current !== null && lastKey.current !== viewKey) {
      const el = scroller()
      if (el && el.scrollTop !== 0) el.scrollTop = 0
    }
    lastKey.current = viewKey

    disarm()
    const state = entrance.current
    state.armed = true
    state.observer = new MutationObserver(playEntrance)
    state.observer.observe(host, { childList: true, subtree: true })
    state.timer = setTimeout(disarm, ENTER_WINDOW_MS)
    playEntrance()
  }, [viewKey, disarm, playEntrance, scroller])

  useEffect(() => disarm, [disarm])

  const renderItem = useCallback((tile: DexTile) => <DexTileView tile={tile} display={display} density={density} shinyView={shinyView} />, [display, density, shinyView])
  const itemKey = useCallback((tile: DexTile) => tile.key, [])

  return (
    <div ref={hostRef} className="dex-grid">
      {hasTiles ? (
        <VirtualGrid
          ref={gridRef}
          scroll="self"
          label={label}
          items={tiles}
          itemKey={itemKey}
          renderItem={renderItem}
          minColumnWidth={metrics.minWidth}
          itemHeight={tileHeight(density, display)}
          gap={metrics.gap}
          overscan={2}
          cellClassName="dex-cell"
          className="dex-grid__scroll"
          onActivate={onActivate}
        />
      ) : (
        <div className="dex-grid__empty">{empty}</div>
      )}
    </div>
  )
})
