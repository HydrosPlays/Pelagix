import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button, EmptyState, SegmentedControl, Select, useScrollParent } from '@renderer/components/ui'
import {
  ACHIEVEMENT_BY_ID, CATEGORY_BY_ID, useAchievementEvaluation, useAchievementSummary, useCategoryStats, type AchievementCategoryId
} from '@renderer/domain/achievements'
import { animate, burst, enterStagger, motionOK, pulse, stagger, useAnimeScope } from '@renderer/lib/anim'
import { plural } from '@renderer/lib/format'
import { navigate, paths } from '@renderer/shell/router'
import { useAchievements } from '@renderer/store/save'
import { AchievementCard } from './AchievementCard'
import { AchievementsHero } from './AchievementsHero'
import { CategoryList, categoryTabId } from './CategoryList'
import { buildRows, FILTER_OPTIONS, selectRows, SORT_OPTIONS, type AchievementFilter, type AchievementSort, type CategoryChoice } from './model'
import { readLastVisit, writeLastVisit } from './visit'
import './AchievementsPage.css'

const PANEL_ID = 'ach-panel'
/** How many freshly unlocked cards get a sparkle burst when the page opens. */
const BURST_LIMIT = 6

/**
 * What the user was looking at, kept while the app runs: coming back from a Pokémon's page (the
 * missing lists link there) returns to the same category with the same cards open.
 */
const remembered: { category: CategoryChoice; filter: AchievementFilter; sort: AchievementSort; expanded: ReadonlySet<string> } = {
  category: 'all',
  filter: 'all',
  sort: 'default',
  expanded: new Set()
}

const SORT_SELECT_OPTIONS = SORT_OPTIONS.map((option) => ({ value: option.value, label: option.label }))

export default function AchievementsPage() {
  const evaluation = useAchievementEvaluation()
  const unlocked = useAchievements()
  const summary = useAchievementSummary(5, 4)
  const stats = useCategoryStats()

  const [category, setCategory] = useState<CategoryChoice>(remembered.category)
  const [filter, setFilter] = useState<AchievementFilter>(remembered.filter)
  const [sort, setSort] = useState<AchievementSort>(remembered.sort)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(remembered.expanded)
  const [pending, setPending] = useState<string | null>(null)
  // When the page was last opened, read once: it decides which unlocks are new to the user.
  const [since] = useState(readLastVisit)
  const gridRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef<HTMLDivElement>(null)
  const scroller = useScrollParent()

  useEffect(() => writeLastVisit(), [])
  useEffect(() => {
    remembered.category = category
    remembered.filter = filter
    remembered.sort = sort
    remembered.expanded = expanded
  }, [category, filter, sort, expanded])

  // A category can disappear when the dataset changes under the page (development fixture).
  const activeCategory: CategoryChoice = category === 'all' || stats.some((s) => s.category.id === category) ? category : 'all'

  const rows = useMemo(() => buildRows(evaluation.states, unlocked, since), [evaluation.states, unlocked, since])
  const shown = useMemo(() => selectRows(rows, { category: activeCategory, filter, sort }), [rows, activeCategory, filter, sort])
  const freshCount = useMemo(() => shown.filter((row) => row.fresh).length, [shown])

  const toggle = useCallback((id: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  /** Picking a category from deep inside a long list brings the top of the new list back into view. */
  const pickCategory = useCallback(
    (next: CategoryChoice) => {
      setCategory(next)
      const layout = layoutRef.current
      if (layout && scroller && layout.getBoundingClientRect().top < scroller.getBoundingClientRect().top) layout.scrollIntoView({ block: 'start' })
    },
    [scroller]
  )

  /** Brings one achievement into view, opened up, whatever the current category and filter are. */
  const showAchievement = useCallback(
    (id: string) => {
      const def = ACHIEVEMENT_BY_ID.get(id)
      if (!def) return
      if (activeCategory !== 'all' && activeCategory !== def.category) setCategory(def.category)
      const isUnlocked = Object.hasOwn(unlocked, id)
      if ((filter === 'unlocked' && !isUnlocked) || (filter === 'locked' && isUnlocked)) setFilter('all')
      setExpanded((current) => new Set(current).add(id))
      setPending(id)
    },
    [activeCategory, filter, unlocked]
  )

  // After the jump has rendered: scroll to the card, hand it focus and give it a nudge.
  useEffect(() => {
    if (pending === null) return
    const card = gridRef.current?.querySelector<HTMLElement>(`[data-ach="${CSS.escape(pending)}"]`)
    setPending(null)
    if (!card) return
    card.scrollIntoView({ block: 'center', behavior: motionOK() ? 'smooth' : 'auto' })
    card.focus({ preventScroll: true })
    pulse(card, { scale: 1.03 })
  }, [pending, shown])

  // Cards rise in whenever the selection changes (not when a catch merely updates the numbers).
  useLayoutEffect(() => {
    enterStagger(gridRef.current?.querySelectorAll('.ach-card'), { step: 22, y: 10, limit: 24 })
  }, [activeCategory, filter, sort])

  // Freshly unlocked cards: a sheen sweeps across a few times, and the first ones throw sparkles.
  useAnimeScope(
    gridRef,
    (_scope, { motion }) => {
      if (!motion || freshCount === 0) return
      animate('.ach-card__sheen', { x: { from: '-140%', to: '360%' }, duration: 1500, delay: stagger(150, { start: 650 }), loop: 2, loopDelay: 2800, ease: 'inOut(2)' })
    },
    [freshCount, activeCategory, filter, sort]
  )
  useEffect(() => {
    const medals = Array.from(gridRef.current?.querySelectorAll<HTMLElement>('.ach-card.is-fresh .ach-card__medal') ?? []).slice(0, BURST_LIMIT)
    const timers = medals.map((medal, i) => setTimeout(() => burst(medal, { count: 10, distance: 46, size: [4, 10] }), 520 + i * 170))
    return () => timers.forEach(clearTimeout)
    // Once per visit: later unlocks are celebrated by their toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const heading = activeCategory === 'all' ? { name: 'All achievements', description: 'Every medal there is to earn.' } : CATEGORY_BY_ID.get(activeCategory as AchievementCategoryId)
  const unlockedShown = shown.filter((row) => row.unlockedAt !== null).length

  return (
    <div className="page ach-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Achievements</h1>
          <p className="page-subtitle">Medals for the milestones of your Living Dex.</p>
        </div>
      </header>

      <AchievementsHero summary={summary} onPick={showAchievement} />

      <div ref={layoutRef} className="ach-layout">
        <CategoryList stats={stats} value={activeCategory} onChange={pickCategory} panelId={PANEL_ID} />

        <div id={PANEL_ID} role="tabpanel" aria-labelledby={categoryTabId(activeCategory)} className="ach-main">
          <div className="ach-toolbar">
            <div className="ach-toolbar__heading">
              <h2 className="section-title">{heading?.name}</h2>
              <p className="ach-toolbar__desc">{heading?.description}</p>
            </div>
            <div className="ach-toolbar__controls">
              <SegmentedControl label="Show" size="sm" options={FILTER_OPTIONS} value={filter} onChange={setFilter} />
              <Select size="sm" ariaLabel="Sort achievements" icon="sort" options={SORT_SELECT_OPTIONS} value={sort} onChange={setSort} className="ach-toolbar__sort" />
            </div>
          </div>

          <p className="u-sr-only" role="status">
            {plural(shown.length, 'achievement')} shown, {unlockedShown} unlocked.
          </p>

          {shown.length === 0 ? (
            filter === 'locked' ? (
              <EmptyState tone="gold" icon="trophy" title="All done here" description="You have unlocked every achievement in this list." />
            ) : (
              <EmptyState
                tone="gold"
                icon="medal"
                title="Nothing unlocked here yet"
                description="Keep logging catches and the medals will follow."
                action={
                  <Button variant="primary" icon="dex" onClick={() => navigate(paths.dex())}>
                    Open the Pokédex
                  </Button>
                }
              />
            )
          ) : (
            <div ref={gridRef} className="ach-grid">
              {shown.map((row) => (
                <AchievementCard key={row.def.id} row={row} context={evaluation.context} expanded={expanded.has(row.def.id)} onToggle={toggle} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
