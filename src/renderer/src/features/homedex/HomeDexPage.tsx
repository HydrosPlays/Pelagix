import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CatchEntry } from '@shared/save-types'
import { HomeMark, ShinyMark } from '@renderer/components/pokemon'
import { Button, Chip, EmptyState, HudBrackets, NumberTicker, ProgressRing, SegmentedControl, cx, useScrollParent } from '@renderer/components/ui'
import { boxMarkTargets, computeHomeDex, filterCount, HOME_FILTERS, slotPress, type HomeFilter, type HomeTotals } from '@renderer/domain/home'
import { useGameView } from '@renderer/domain/gamedex'
import { slotTarget, type LivingSlot } from '@renderer/domain/slots'
import { focusIsLost, whenPageReleased } from '@renderer/features/living/focus'
import { LivingGrid, type LivingGridHandle, type LivingGridHome } from '@renderer/features/living/LivingGrid'
import { boxMetrics, boxName, buildBoxes, computeStats, generationSpans, layoutBoxes, layoutList, listMetrics, neighbour, rulesLine, slotIndexByKey, type LivingLayout, type LivingMode } from '@renderer/features/living/model'
import { SlotDrawer } from '@renderer/features/living/SlotDrawer'
import { GameDexBar } from '@renderer/features/pokedex/GamePicker'
import { useElementWidth } from '@renderer/features/living/windowing'
import { rich, t, useT } from '@renderer/i18n'
import { gameShortName } from '@renderer/i18n/terms'
import { useDex } from '@renderer/lib/data'
import { errorMessage, formatCount, ratio } from '@renderer/lib/format'
import { navigate, paths } from '@renderer/shell/router'
import { useSaveStore } from '@renderer/store/save'
import { toast, useUiStore } from '@renderer/store/ui'
import '@renderer/features/living/LivingDexPage.css'
import './HomeDexPage.css'

const NO_LAYOUT: LivingLayout = layoutList([], [], listMetrics(0))

/** Switches the flag of entries in one save commit. Returns how many changed; failures become an error toast. */
function setInHome(ids: readonly string[], on: boolean): number {
  try {
    return useSaveStore.getState().patchEntries(ids.map((id) => ({ id, patch: { inHome: on ? true : undefined } })))
  } catch (err) {
    toast({ kind: 'error', title: t('homedex.saveFailed'), body: errorMessage(err) })
    return 0
  }
}

interface HeroProps {
  mode: LivingMode
  onMode: (mode: LivingMode) => void
  totals: HomeTotals
  rulesText: string
  /** Short name of the game the page is narrowed to: the numbers count what was obtained there. */
  game?: string
}

/** The page header, in the Living Dex's own style: the ring, "N / M in HOME" and what is left to send. */
function HomeDexHero({ mode, onMode, totals, rulesText, game }: HeroProps) {
  const t = useT()
  const shiny = mode === 'shiny'
  const complete = totals.slots > 0 && totals.inHome === totals.slots
  const share = ratio(totals.inHome, totals.slots)
  const pct = totals.inHome <= 0 ? 0 : complete ? 100 : Math.min(99.9, Math.max(0.1, Math.round(share * 1000) / 10))
  const unit = game === undefined ? t(shiny ? 'homedex.hero.unitShiny' : 'homedex.hero.unit') : t(shiny ? 'homedex.hero.unitShinyGame' : 'homedex.hero.unitGame', { game })
  const countText =
    game === undefined
      ? t(shiny ? 'homedex.hero.countShiny' : 'homedex.hero.count', { inHome: totals.inHome, count: totals.slots })
      : t(shiny ? 'homedex.hero.countShinyGame' : 'homedex.hero.countGame', { inHome: totals.inHome, count: totals.slots, game })
  const bold = { b: (text: ReactNode) => <b>{text}</b> }

  return (
    <header className={cx('living-hero', shiny && 'is-shiny', complete && 'is-complete')}>
      <HudBrackets corners="diagonal" inset={8} size={16} />
      <ProgressRing className="living-hero__ring" value={share} size={124} thickness={10} tone={shiny || complete ? 'gold' : 'accent'} label={shiny ? t('homedex.hero.ringShiny') : t('homedex.hero.ring')} valueText={countText}>
        <span className="living-hero__pct">
          <NumberTicker value={pct} decimals={pct > 0 && pct < 100 ? 1 : 0} />
          <span className="living-hero__pct-sign">%</span>
        </span>
      </ProgressRing>

      <div className="living-hero__main">
        <h1 className="living-hero__title">
          {shiny ? <ShinyMark size={22} twinkle label="" /> : <HomeMark size={24} label="" />}
          {shiny ? t('homedex.hero.titleShiny') : t('homedex.hero.title')}
        </h1>
        <p className="living-hero__count" aria-label={countText}>
          <NumberTicker value={totals.inHome} className="living-hero__caught" />
          <span className="living-hero__total"> / {formatCount(totals.slots)}</span>
          <span className="living-hero__unit">{unit}</span>
        </p>
        <p className="living-hero__second">
          <span>{rich('homedex.hero.pending', bold, { count: totals.pending })}</span>
          <span className="living-hero__dot" aria-hidden="true" />
          <span>
            {game === undefined
              ? rich(shiny ? 'homedex.hero.missingShiny' : 'homedex.hero.missing', bold, { count: totals.missing })
              : rich(shiny ? 'homedex.hero.missingShinyGame' : 'homedex.hero.missingGame', bold, { count: totals.missing, game })}
          </span>
        </p>
        <p className="living-hero__rules">{rulesText}</p>
      </div>

      <div className="living-hero__side">
        <SegmentedControl
          className="living-hero__mode"
          label={t('homedex.hero.mode')}
          value={mode}
          onChange={onMode}
          options={[
            { value: 'normal', label: t('homedex.hero.mode.normal'), icon: 'box' },
            { value: 'shiny', label: t('common.shiny'), icon: 'sparkle' }
          ]}
        />
      </div>
    </header>
  )
}

/**
 * The HOME Dex: the Living Dex's boxes again, showing which Pokémon have been sent to Pokémon
 * HOME. A press marks a caught Pokémon; a slot with several entries or none opens the drawer.
 */
export default function HomeDexPage() {
  useT()
  const dex = useDex()
  // With a game chosen: that game's slots, and only the entries obtained in it (so nothing else is ever marked).
  const gameView = useGameView(dex)
  const { collection, game } = gameView
  const gameName = game === null ? undefined : gameShortName(game)
  const scroller = useScrollParent()
  const shinyView = useUiStore((s) => s.dexView.shinyView)
  const setDexView = useUiStore((s) => s.setDexView)
  const editorOpen = useUiStore((s) => s.entryEditor.open)
  const shiny = shinyView
  const mode: LivingMode = shiny ? 'shiny' : 'normal'

  const frameRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<LivingGridHandle>(null)
  const { slots } = collection
  const hasSlots = gameView.base.slots.length > 0
  const width = useElementWidth(frameRef, hasSlots)

  const [filter, setFilter] = useState<HomeFilter>('all')
  const [focusIndex, setFocusIndex] = useState(0)
  const [drawerKey, setDrawerKey] = useState<string | null>(null)

  const home = useMemo(() => computeHomeDex(collection, shiny), [collection, shiny])
  const stats = useMemo(() => computeStats(dex, slots, home.inHome), [dex, slots, home])
  const boxes = buildBoxes(slots)
  const indexOf = slotIndexByKey(slots)

  // Every slot keeps its place in its box under "All"; a filter lists just the slots it asks for.
  const layout = useMemo<LivingLayout>(() => {
    if (width <= 0) return NO_LAYOUT
    if (filter === 'all') return layoutBoxes(slots, boxMetrics(width))
    return layoutList(slots, generationSpans(dex, slots), listMetrics(width), (index) => home.states.get(slots[index]?.key ?? '') === filter)
  }, [width, filter, slots, dex, home])
  const metrics = filter === 'all' ? boxMetrics(width) : listMetrics(width)
  const columns = 'perRow' in metrics ? metrics.perRow : metrics.cols

  const shown = (index: number): boolean => (layout.rowOf[index] ?? -1) >= 0
  const focus = shown(focusIndex) ? focusIndex : (layout.order[0] ?? -1)
  const drawerIndex = drawerKey !== null ? (indexOf.get(drawerKey) ?? -1) : -1
  const drawerSlot = drawerIndex >= 0 ? (slots[drawerIndex] ?? null) : null

  const live = useRef({ collection, shiny, layout, boxes, filter })
  live.current = { collection, shiny, layout, boxes, filter }
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // ---------------------------------------------------------------- marking

  // A slot that a filter drops once it is marked takes the keyboard focus with it: hand it to the slot that follows.
  const handOver = useRef<{ from: number; to: number } | null>(null)
  useEffect(() => {
    const plan = handOver.current
    handOver.current = null
    if (!plan || (layout.rowOf[plan.from] ?? -1) >= 0 || (layout.rowOf[plan.to] ?? -1) < 0) return
    gridRef.current?.focusSlot(plan.to, false)
  }, [layout])

  const openSlot = useCallback((index: number) => {
    const now = live.current
    const slot = now.collection.slots[index]
    if (!slot) return
    setFocusIndex(index)
    const press = slotPress(now.collection, slot.key, now.shiny)
    if (press.kind === 'open') return setDrawerKey(slot.key)
    if (now.filter !== 'all') {
      const next = neighbour(now.layout.order, index, 1)
      handOver.current = { from: index, to: next >= 0 ? next : neighbour(now.layout.order, index, -1) }
    }
    setInHome([press.entry.id], press.on)
  }, [])

  const markBox = useCallback((boxIndex: number) => {
    const now = live.current
    const box = now.boxes[boxIndex]
    if (!box) return
    const ids = boxMarkTargets(now.collection, box.slots, now.shiny).map((entry) => entry.id)
    const marked = ids.length > 0 ? setInHome(ids, true) : 0
    if (marked === 0) return
    // The button leaves with the last unmarked slot: keep the keyboard in the box.
    requestAnimationFrame(() => {
      if (alive.current && focusIsLost()) gridRef.current?.focusSlot(box.start, false)
    })
    toast({
      kind: 'success',
      icon: 'check',
      title: t('homedex.box.marked', { box: boxName(box) }),
      body: t('homedex.box.marked.body', { count: marked }),
      durationMs: 10000,
      action: {
        label: t('homedex.box.undo'),
        onSelect: () => {
          const undone = setInHome(ids, false)
          if (undone > 0) toast({ kind: 'info', icon: 'undo', title: t('homedex.box.unmarked', { box: boxName(box) }), body: t('homedex.box.unmarked.body', { count: undone }) })
        }
      }
    })
  }, [])

  const gridHome = useMemo<LivingGridHome>(() => ({ dex: home, onMarkBox: markBox }), [home, markBox])

  // ---------------------------------------------------------------- the drawer

  const focusNow = useRef(focus)
  focusNow.current = focus
  const refocus = useCallback((index?: number) => {
    whenPageReleased(
      () => {
        const target = index ?? focusNow.current
        if (target >= 0 && focusIsLost()) gridRef.current?.focusSlot(target, false)
      },
      () => alive.current
    )
  }, [])

  const stepDrawer = (step: 1 | -1): (() => void) | undefined => {
    const next = drawerIndex >= 0 ? neighbour(layout.order, drawerIndex, step) : -1
    const slot = slots[next]
    if (next < 0 || !slot) return undefined
    return () => {
      setFocusIndex(next)
      setDrawerKey(slot.key)
      gridRef.current?.scrollToSlot(next, { align: 'nearest' })
    }
  }

  const closeDrawer = (): void => {
    const index = drawerIndex
    setDrawerKey(null)
    if (index >= 0) refocus(index)
  }

  const onLog = (slot: LivingSlot): void => {
    setDrawerKey(null)
    useUiStore.getState().openCreate({ ...slotTarget(slot), ...(shiny && { shiny: true }), ...(game !== null && { game }) })
  }

  const onHome = useCallback((entry: CatchEntry, on: boolean) => void setInHome([entry.id], on), [])

  // The entry editor closed: its own focus restore points at the drawer that is gone, so take focus back.
  const wasEditing = useRef(editorOpen)
  useEffect(() => {
    if (wasEditing.current && !editorOpen && drawerKey === null) refocus()
    wasEditing.current = editorOpen
  }, [editorOpen, drawerKey, refocus])

  const onVisible = useCallback(() => {}, [])

  if (!hasSlots) {
    return (
      <div className="page">
        <EmptyState size="lg" icon="box" tone="neutral" title={t('homedex.empty.noSlots.title')} description={t('homedex.empty.noSlots.description')} />
      </div>
    )
  }

  const { totals } = home
  const nothingCaught = totals.inHome + totals.pending === 0
  const nothingShown = !nothingCaught && width > 0 && layout.order.length === 0

  return (
    <div className={cx('page', 'living', 'hdex', shiny && 'is-shiny')}>
      <HomeDexHero mode={mode} onMode={(next) => setDexView({ shinyView: next === 'shiny' })} totals={totals} rulesText={rulesLine(collection.rules, slots.length, gameName)} game={gameName} />

      <GameDexBar dex={dex} game={game} onGame={gameView.setGame} />

      {!nothingCaught && (
        <div className="hdex-bar">
          <div className="hdex-filters" role="group" aria-label={t('homedex.filters.label')}>
            {HOME_FILTERS.map((f) => (
              <Chip key={f.id} tone={shiny ? 'gold' : 'accent'} selected={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.id === 'missing' && shiny ? t('homedex.filters.noShiny') : f.label}
                <span className="hdex-filters__count"> {formatCount(filterCount(totals, f.id))}</span>
              </Chip>
            ))}
          </div>
          <p className="hdex-hint">
            <HomeMark size={14} label="" />
            {t('homedex.hint')}
          </p>
        </div>
      )}

      <div ref={frameRef} className="living-frame">
        {nothingCaught && gameName !== undefined && !(shiny && collection.caught.size > 0) ? (
          <EmptyState
            tone="accent"
            icon="gamepad"
            title={slots.length === 0 ? t('homedex.empty.game.title', { game: gameName }) : t('homedex.empty.gameNothing.title', { game: gameName })}
            description={slots.length === 0 ? t('homedex.empty.game.description') : t('homedex.empty.gameNothing.description', { game: gameName })}
            action={
              <Button variant="subtle" icon="close" onClick={() => gameView.setGame(null)}>
                {t('pokedex.game.showAll')}
              </Button>
            }
          />
        ) : nothingCaught ? (
          shiny && collection.caught.size > 0 ? (
            <EmptyState
              tone="gold"
              icon="sparkle"
              title={t('homedex.empty.noShiny.title')}
              description={t('homedex.empty.noShiny.description')}
              action={
                <Button variant="subtle" icon="box" onClick={() => setDexView({ shinyView: false })}>
                  {t('homedex.empty.noShiny.action')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              tone="accent"
              icon="box"
              title={t('homedex.empty.nothing.title')}
              description={t('homedex.empty.nothing.description')}
              action={
                <Button variant="primary" icon="dex" onClick={() => navigate(paths.dex())}>
                  {t('homedex.empty.nothing.action')}
                </Button>
              }
            />
          )
        ) : nothingShown ? (
          <EmptyState
            icon={filter === 'pending' ? 'check' : 'box'}
            tone={filter === 'missing' ? 'gold' : 'neutral'}
            title={filter === 'home' ? t('homedex.empty.filter.home.title') : filter === 'pending' ? t('homedex.empty.filter.pending.title') : t('homedex.empty.filter.missing.title')}
            description={filter === 'home' ? t('homedex.empty.filter.home.description') : filter === 'pending' ? t('homedex.empty.filter.pending.description') : t('homedex.empty.filter.missing.description')}
            action={
              <Button variant="subtle" icon="eye" onClick={() => setFilter('all')}>
                {t('homedex.empty.filter.action')}
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
            quietFilled={false}
            countMissing={false}
            scroller={scroller}
            inset={0}
            focusIndex={focus}
            foundIndex={-1}
            onFocusIndex={setFocusIndex}
            onOpen={openSlot}
            onVisible={onVisible}
            home={gridHome}
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
        onHome={onHome}
      />
    </div>
  )
}
