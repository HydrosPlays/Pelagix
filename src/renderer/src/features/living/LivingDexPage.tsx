import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'wouter'
import { Sprite } from '@renderer/components/pokemon'
import { Button, EmptyState, Icon, IconButton, useScrollParent, type SelectOption } from '@renderer/components/ui'
import { slotTarget, useCollection, type LivingSlot } from '@renderer/domain/slots'
import { burst, flipIn, pulse } from '@renderer/lib/anim'
import { useDex } from '@renderer/lib/data'
import { dexNo, formatCount, plural } from '@renderer/lib/format'
import { navigate, paths } from '@renderer/shell/router'
import { useEntries } from '@renderer/store/save'
import { toast, useUiStore } from '@renderer/store/ui'
import { focusIsLost, whenPageReleased } from './focus'
import { LivingGrid, type LivingGridHandle } from './LivingGrid'
import { LivingHero } from './LivingHero'
import { LivingToolbar } from './LivingToolbar'
import {
  BOX_SIZE, boxMetrics, buildBoxes, computeStats, filledIn, generationSpans, layoutBoxes, layoutList, listMetrics, neighbour, rulesKey, slotGenerations, slotIndexByKey, slotInfo,
  type LivingLayout, type LivingMode, type LivingView
} from './model'
import { useLivingPrefs } from './prefs'
import { SlotDrawer } from './SlotDrawer'
import { useElementHeight, useElementWidth, useStuckFlag } from './windowing'
import './LivingDexPage.css'

const NO_LAYOUT: LivingLayout = layoutList([], [], listMetrics(0))

const BURST_REGULAR = ['var(--accent-2)', 'var(--accent-3)', 'var(--ball-white)', 'var(--catch)'] as const
const BURST_GOLD = ['var(--gold)', 'var(--gold-text)', 'var(--ball-white)'] as const

interface SizeNotice {
  was: number
  now: number
  rulesChanged: boolean
}

/**
 * The Living Dex: every slot the user's rules ask for, thirty to a box like Pokémon HOME, in a
 * regular and a shiny edition. Slots open a drawer to log a catch into exactly that slot.
 */
export default function LivingDexPage() {
  const dex = useDex()
  const collection = useCollection()
  const entryCount = useEntries().length
  const scroller = useScrollParent()
  const shinyView = useUiStore((s) => s.dexView.shinyView)
  const setDexView = useUiStore((s) => s.setDexView)
  const lastCapture = useUiStore((s) => s.lastCapture)
  const mode: LivingMode = shinyView ? 'shiny' : 'normal'
  const [prefs, setPrefs] = useLivingPrefs()
  const { view, missingOnly } = prefs

  const frameRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<LivingGridHandle>(null)
  const hasSlots = collection.slots.length > 0
  const width = useElementWidth(frameRef, hasSlots)
  const toolbarHeight = useElementHeight(toolbarRef, hasSlots)

  const [focusIndex, setFocusIndex] = useState(0)
  const [foundKey, setFoundKey] = useState<string | null>(null)
  const [flashIndex, setFlashIndex] = useState(-1)
  const [drawerKey, setDrawerKey] = useState<string | null>(null)
  const [visible, setVisible] = useState<readonly [number, number]>([-1, -1])
  const [notice, setNotice] = useState<SizeNotice | null>(null)

  const { slots } = collection
  const filled = filledIn(collection, mode)
  const boxes = buildBoxes(slots)
  const indexOf = slotIndexByKey(slots)
  const gens = slotGenerations(dex, slots)
  const stats = useMemo(() => computeStats(dex, slots, filled), [dex, slots, filled])
  const complete = stats.slots > 0 && stats.filled === stats.slots

  const layout = useMemo<LivingLayout>(() => {
    if (width <= 0) return NO_LAYOUT
    if (view === 'boxes') return layoutBoxes(slots, boxMetrics(width), missingOnly ? (box) => (stats.boxFilled[box.index] ?? 0) < box.slots.length : undefined)
    return layoutList(slots, generationSpans(dex, slots), listMetrics(width), missingOnly ? (index) => !filled.has(slots[index]?.key ?? '') : undefined)
  }, [width, view, missingOnly, slots, dex, stats, filled])
  const metrics = view === 'boxes' ? boxMetrics(width) : listMetrics(width)
  const columns = 'perRow' in metrics ? metrics.perRow : metrics.cols

  const shown = useCallback((index: number): boolean => (layout.rowOf[index] ?? -1) >= 0, [layout])
  const focus = shown(focusIndex) ? focusIndex : (layout.order[0] ?? -1)
  const foundIndex = foundKey !== null ? (indexOf.get(foundKey) ?? -1) : -1
  const drawerIndex = drawerKey !== null ? (indexOf.get(drawerKey) ?? -1) : -1
  const drawerSlot = drawerIndex >= 0 ? (slots[drawerIndex] ?? null) : null

  // Everything the delayed callbacks below need, as it is now.
  const live = useRef({ layout, mode, stats, boxes, slots })
  live.current = { layout, mode, stats, boxes, slots }
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const later = useCallback((ms: number, run: () => void) => {
    setTimeout(() => {
      if (alive.current) run()
    }, ms)
  }, [])

  /** Runs `run` on the slot's button once its row is mounted (it may still be scrolling in). */
  const whenMounted = useCallback(
    (index: number, run: (element: HTMLElement) => void) => {
      const started = Date.now()
      const attempt = (): void => {
        const element = gridRef.current?.slotElement(index)
        if (element) run(element)
        else if (Date.now() - started < 1600) later(60, attempt)
      }
      attempt()
    },
    [later]
  )

  const burstAt = useCallback((element: Element, options: { count: number; distance: number; gold: boolean }) => {
    const list = gridRef.current?.listElement()
    if (!list) return
    const box = list.getBoundingClientRect()
    const at = element.getBoundingClientRect()
    if (box.width <= 0 || box.height <= 0) return
    burst(list, {
      x: (at.left + at.width / 2 - box.left) / box.width,
      y: (at.top + at.height / 2 - box.top) / box.height,
      count: options.count,
      distance: options.distance,
      size: [5, 11],
      colors: options.gold ? BURST_GOLD : BURST_REGULAR
    })
  }, [])

  /** Rings a slot for a moment (a search hit, a fresh catch that did not fill anything new). */
  const flash = useCallback(
    (index: number) => {
      setFlashIndex(index)
      later(1800, () => setFlashIndex((current) => (current === index ? -1 : current)))
    },
    [later]
  )

  // ---------------------------------------------------------------- celebrations

  /**
   * A slot was filled (while the page was open, or by the catch the user just came from): bring
   * it into view, flip it in with a small burst, and give the box a moment when that completed it.
   */
  const celebrate = useCallback(
    (plan: { fresh: number[]; target: number; arrival: boolean }) => {
      const grid = gridRef.current
      const now = live.current
      if (!grid) return
      const gold = now.mode === 'shiny'
      const doneBoxes = [...new Set(plan.fresh.map((index) => Math.floor(index / BOX_SIZE)))].filter((b) => (now.stats.boxFilled[b] ?? 0) === (now.boxes[b]?.slots.length ?? -1))

      if ((now.layout.rowOf[plan.target] ?? -1) < 0) {
        // Filtered out by "Missing only": the slot just leaves the list. A finished box still deserves a word.
        for (const b of doneBoxes) toast({ kind: 'success', icon: 'star', title: `Box ${b + 1} complete`, body: `All ${now.boxes[b]?.slots.length ?? BOX_SIZE} slots are filled.` })
        return
      }

      setFocusIndex(plan.target)
      const moved = grid.scrollToSlot(plan.target, { align: plan.arrival ? 'center' : 'nearest', smooth: !plan.arrival })
      later(plan.arrival ? 260 : moved ? 440 : 30, () => {
        if (plan.fresh.length === 0) {
          flash(plan.target)
          whenMounted(plan.target, (element) => pulse(element, { scale: 1.14 }))
          return
        }
        for (const index of plan.fresh) {
          whenMounted(index, (element) => {
            flipIn(element)
            later(200, () => burstAt(element, { count: 12, distance: 54, gold }))
          })
        }
        for (const b of doneBoxes) {
          later(620, () => {
            const panel = gridRef.current?.boxElement(b)
            const badge = panel?.querySelector('.living-box__status')
            if (!panel || !badge) return
            panel.setAttribute('data-celebrate', '')
            later(1500, () => panel.removeAttribute('data-celebrate'))
            pulse(badge, { scale: 1.2 })
            burstAt(badge, { count: 22, distance: 104, gold: true })
          })
        }
      })
    },
    [later, flash, whenMounted, burstAt]
  )

  // Notices slots that became filled since the last render, and takes the "just caught" marker.
  // While the entry editor or the slot drawer covers the grid the moment is held back, so it plays where it can be seen.
  const editorOpen = useUiStore((s) => s.entryEditor.open)
  const covered = editorOpen || drawerKey !== null
  const baseline = useRef<{ slots: readonly LivingSlot[]; mode: LivingMode; filled: ReadonlySet<string> } | null>(null)
  const held = useRef<number[]>([])
  const ready = width > 0
  useEffect(() => {
    if (!ready) return
    const before = baseline.current
    baseline.current = { slots, mode, filled }
    const comparable = before !== null && before.slots === slots && before.mode === mode
    if (!comparable) held.current = []

    if (comparable && before.filled !== filled) {
      for (const key of filled) {
        if (before.filled.has(key)) continue
        const index = indexOf.get(key)
        if (index !== undefined) held.current.push(index)
      }
    }
    if (covered) return

    const fresh = [...new Set(held.current)].filter((index) => filled.has(slots[index]?.key ?? ''))
    held.current = []

    let target = -1
    const captured = lastCapture === null ? null : useUiStore.getState().consumeLastCapture()
    if (captured !== null) {
      const key = collection.slotOfEntry.get(captured)
      const index = key === undefined ? undefined : indexOf.get(key)
      if (key !== undefined && index !== undefined) {
        target = index
        // Arriving from the catch: it is new to its slot when it is the only entry that counts there.
        const info = slotInfo(collection, key, mode)
        const counts = mode === 'normal' || collection.bySlot.get(key)?.some((e) => e.id === captured && e.shiny) === true
        if (before === null && counts && info.count === 1) fresh.push(index)
      }
    }

    // A whole import (or an undo of many) landing at once is not a moment to animate.
    const few = fresh.length <= 3 ? fresh : []
    if (few.length === 0 && target < 0) return
    celebrate({ fresh: few, target: target >= 0 ? target : (few[0] ?? -1), arrival: before === null })
  }, [ready, covered, slots, mode, filled, lastCapture, collection, indexOf, celebrate])

  // ---------------------------------------------------------------- rules changed the slot count

  const rules = rulesKey(collection.rules)
  const slotCount = slots.length
  useEffect(() => {
    const seen = prefs.seen
    if (seen && seen.slots !== slotCount) setNotice({ was: seen.slots, now: slotCount, rulesChanged: seen.rules !== rules })
    if (!seen || seen.rules !== rules || seen.slots !== slotCount) setPrefs({ seen: { rules, slots: slotCount } })
    // Only a change of the rules or the slot count matters here, not every preference write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, slotCount])

  // ---------------------------------------------------------------- navigation inside the page

  const jumpTo = useCallback(
    (index: number) => {
      if (index < 0) return
      setFocusIndex(index)
      gridRef.current?.scrollToSlot(index, { align: 'start', smooth: true })
    },
    [setFocusIndex]
  )

  const onJumpGen = (gen: number): void => jumpTo(layout.order.find((index) => gens[index] === gen) ?? -1)
  const onJumpBox = (boxIndex: number): void => jumpTo(layout.order.find((index) => index >= boxIndex * BOX_SIZE) ?? layout.order[layout.order.length - 1] ?? -1)

  // Switching the view or the filter re-flows everything: once scrolled into the boxes, stay with the slot that led the screen.
  const keepPlace = useRef<number | null>(null)
  const relayout = (patch: { view?: LivingView; missingOnly?: boolean }): void => {
    if (toolbarRef.current?.hasAttribute('data-stuck') && visible[0] >= 0) keepPlace.current = visible[0]
    setPrefs(patch)
  }
  useEffect(() => {
    const anchor = keepPlace.current
    if (anchor === null) return
    keepPlace.current = null
    const index = layout.order.find((each) => each >= anchor) ?? layout.order[layout.order.length - 1]
    if (index !== undefined) gridRef.current?.scrollToSlot(index, { align: 'start' })
  }, [layout])

  /** Brings a search hit to the middle of the screen and gives it a nudge. */
  const revealSlot = useCallback(
    (index: number) => {
      setFocusIndex(index)
      const moved = gridRef.current?.scrollToSlot(index, { align: 'center', smooth: true }) ?? false
      later(moved ? 420 : 0, () => whenMounted(index, (element) => pulse(element, { scale: 1.16 })))
    },
    [later, whenMounted]
  )

  // A search hit that "Missing only" hides is revealed by switching the filter off; the scroll follows once the layout has it.
  const reveal = useRef<number | null>(null)
  useEffect(() => {
    const index = reveal.current
    if (index === null || !shown(index)) return
    reveal.current = null
    revealSlot(index)
  }, [layout, shown, revealSlot])

  const onFind = (key: string | null): void => {
    setFoundKey(key)
    const index = key === null ? undefined : indexOf.get(key)
    if (key === null || index === undefined) return
    if (shown(index)) return revealSlot(index)
    reveal.current = index
    if (missingOnly) {
      setPrefs({ missingOnly: false })
      toast({ kind: 'info', icon: 'eye', title: 'Showing every slot', body: `${slots[index]?.label ?? 'That Pokémon'} is already caught, so “Missing only” was switched off.` })
    }
  }

  // ---------------------------------------------------------------- the drawer

  const openSlot = useCallback(
    (index: number) => {
      const slot = live.current.slots[index]
      if (!slot) return
      setFocusIndex(index)
      setDrawerKey(slot.key)
    },
    [setFocusIndex]
  )

  const stepDrawer = (step: 1 | -1): (() => void) | undefined => {
    const next = drawerIndex >= 0 ? neighbour(layout.order, drawerIndex, step) : -1
    if (next < 0) return undefined
    return () => {
      openSlot(next)
      gridRef.current?.scrollToSlot(next, { align: 'nearest' })
    }
  }

  /**
   * Puts keyboard focus back on a slot once a closing drawer or dialog has released the page
   * (their own focus restore runs while the page is still inert, or points at something gone).
   * Without an index: whichever slot holds the tab stop by then.
   */
  const focusNow = useRef(focus)
  focusNow.current = focus
  const refocus = useCallback((index?: number) => {
    whenPageReleased(
      () => {
        const target = index ?? focusNow.current
        // No scrolling here: the slot is where the page already brought it, or on its way there.
        if (target >= 0 && focusIsLost()) gridRef.current?.focusSlot(target, false)
      },
      () => alive.current
    )
  }, [])

  const closeDrawer = (): void => {
    const index = drawerIndex
    setDrawerKey(null)
    if (index >= 0) refocus(index)
  }

  const onLog = (slot: LivingSlot): void => {
    setDrawerKey(null)
    useUiStore.getState().openCreate({ ...slotTarget(slot), ...(mode === 'shiny' && { shiny: true }) })
  }

  // The entry editor closed: its own focus restore points at the drawer that is gone, so take focus back.
  const wasEditing = useRef(editorOpen)
  useEffect(() => {
    if (wasEditing.current && !editorOpen && drawerKey === null) refocus()
    wasEditing.current = editorOpen
  }, [editorOpen, drawerKey, refocus])

  // ---------------------------------------------------------------- toolbar wiring

  const searchOptions = useMemo<SelectOption<string>[]>(
    () =>
      slots.map((slot) => ({
        value: slot.key,
        label: slot.label,
        description: dexNo(slot.species),
        keywords: `${slot.species} ${dex.species(slot.species)?.name ?? ''}`,
        icon: <Sprite path={slot.spritePath(mode === 'shiny')} size={24} />
      })),
    [slots, dex, mode]
  )

  const onVisible = useCallback((first: number, last: number) => setVisible((old) => (old[0] === first && old[1] === last ? old : [first, last])), [])

  // The toolbar grows a shadow once it has stuck to the top of the scroller.
  useStuckFlag(scroller, toolbarRef, hasSlots)

  // The generation tabs follow what is in the middle of the screen, not the row just leaving at the top.
  const currentGen = visible[0] >= 0 ? (gens[Math.floor((visible[0] + Math.max(visible[0], visible[1])) / 2)] ?? 0) : (stats.gens[0]?.gen ?? 0)
  const nothingMissing = missingOnly && layout.order.length === 0 && ready
  const firstMissing = slots.findIndex((slot) => !filled.has(slot.key))

  if (slots.length === 0) {
    return (
      <div className="page">
        <EmptyState size="lg" icon="grid" tone="neutral" title="No Pokémon to show" description="The Pokédex data holds no Pokémon, so there are no slots to fill yet." />
      </div>
    )
  }

  return (
    <div className={`page living${mode === 'shiny' ? ' is-shiny' : ''}`}>
      <LivingHero mode={mode} onMode={(next) => setDexView({ shinyView: next === 'shiny' })} stats={stats} totals={collection.totals} shinySpecies={collection.speciesShiny.size} rules={collection.rules} boxes={boxes.length} />

      {notice && (
        <div className="living-banner living-banner--info" role="status">
          <Icon name="info" size={18} />
          <p>
            <b>{notice.rulesChanged ? 'Your Living Dex rules changed.' : 'The Pokédex data was updated.'}</b> There are now {formatCount(notice.now)} slots to fill ({formatCount(notice.was)} before). Nothing you logged was lost.
          </p>
          <Link href={paths.settings()} className="living-banner__link">
            Review rules
          </Link>
          <IconButton icon="close" size="sm" label="Dismiss" onClick={() => setNotice(null)} />
        </div>
      )}

      {complete ? (
        <div className="living-banner living-banner--gold" role="status">
          <Icon name="trophy" size={20} />
          <p>
            <b>{mode === 'shiny' ? 'Shiny Living Dex complete!' : 'Living Dex complete!'}</b> Every one of the {formatCount(stats.slots)} slots is filled{mode === 'shiny' ? ' with a shiny' : ''}. That is the whole collection.
          </p>
        </div>
      ) : entryCount === 0 ? (
        <div className="living-banner living-banner--accent">
          <Icon name="pokeball" size={20} />
          <p>
            <b>Your Living Dex is waiting.</b> Find a Pokémon in the Pokédex, pick the game and the place you caught it, and it lands in its slot here.
          </p>
          <Button variant="primary" icon="dex" onClick={() => navigate(paths.dex())}>
            Open the Pokédex
          </Button>
        </div>
      ) : mode === 'shiny' && stats.filled === 0 ? (
        <div className="living-banner living-banner--gold">
          <Icon name="sparkle" size={20} />
          <p>
            <b>No shiny Pokémon yet.</b> Log a catch as shiny and its slot lights up here. Your {plural(collection.totals.caught, 'caught slot', 'caught slots')} stay in the regular Living Dex.
          </p>
          {firstMissing >= 0 && (
            <Button variant="subtle" icon="plus" onClick={() => openSlot(firstMissing)}>
              Log a shiny
            </Button>
          )}
        </div>
      ) : null}

      {collection.unplaced.length > 0 && (
        <p className="living-aside">
          <Icon name="help" size={15} />
          <span>
            {plural(collection.unplaced.length, 'entry is', 'entries are')} for Pokémon this version does not know yet. {collection.unplaced.length === 1 ? 'It stays' : 'They stay'} safe in your{' '}
            <Link href={paths.journal()}>Journal</Link>.
          </span>
        </p>
      )}

      <LivingToolbar
        ref={toolbarRef}
        mode={mode}
        view={view}
        onView={(next) => relayout({ view: next })}
        missingOnly={missingOnly}
        onMissingOnly={(on) => relayout({ missingOnly: on })}
        stats={stats}
        boxes={boxes}
        visible={visible}
        currentGen={currentGen}
        searchOptions={searchOptions}
        found={foundKey}
        onFind={onFind}
        onJumpGen={onJumpGen}
        onJumpBox={onJumpBox}
      />

      <div ref={frameRef} className="living-frame">
        {nothingMissing ? (
          <EmptyState
            tone="gold"
            icon="trophy"
            title="Nothing is missing"
            description={mode === 'shiny' ? 'Every slot holds a shiny. There is nothing left to hunt.' : 'Every slot is filled. There is nothing left to catch.'}
            action={
              <Button variant="subtle" icon="eye" onClick={() => setPrefs({ missingOnly: false })}>
                Show every slot
              </Button>
            }
          />
        ) : (
          <LivingGrid
            ref={gridRef}
            collection={collection}
            mode={mode}
            layout={layout}
            cell={metrics.cell}
            columns={columns}
            stats={stats}
            quietFilled={missingOnly && view === 'boxes'}
            countMissing={missingOnly}
            scroller={scroller}
            inset={toolbarHeight}
            focusIndex={focus}
            foundIndex={flashIndex >= 0 ? flashIndex : foundIndex}
            onFocusIndex={setFocusIndex}
            onOpen={openSlot}
            onVisible={onVisible}
          />
        )}
      </div>

      <SlotDrawer
        slot={drawerSlot}
        index={drawerIndex}
        collection={collection}
        mode={mode}
        onClose={closeDrawer}
        onPrevious={stepDrawer(-1)}
        onNext={stepDrawer(1)}
        onLog={onLog}
        onFind={(slot) => navigate(paths.species(slot.species, slot.form))}
      />
    </div>
  )
}
