/**
 * The Pokédex browser (route /dex): every species, or every Living Dex slot, in a searchable,
 * filterable, sortable grid. Selecting a tile opens the species page.
 */

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, type ReactElement } from 'react'
import { useSearch } from 'wouter'
import { GAME_BY_ID } from '@shared/games'
import { TYPE_IDS } from '@renderer/components/pokemon'
import { Button, EmptyState, NumberTicker, SegmentedControl, Select, Skeleton, Tooltip, type SelectOption } from '@renderer/components/ui'
import { arrange, planSections, usePokedexes } from '@renderer/domain/gamedex'
import { useCollection } from '@renderer/domain/slots'
import { rich, useT } from '@renderer/i18n'
import { gameName, gameShortName } from '@renderer/i18n/terms'
import { useDexStore, type Dex } from '@renderer/lib/data'
import { formatCount } from '@renderer/lib/format'
import { navigate, paths } from '@renderer/shell/router'
import { useEntries } from '@renderer/store/save'
import { useUiStore, type DexDensity } from '@renderer/store/ui'
import { DexGrid, type DexGridHandle } from './DexGrid'
import { TILE_METRICS, tileHeight } from './DexTile'
import { DexActiveFilters, DexToolbar } from './DexToolbar'
import { dexMemory, useDexBrowser } from './dex-store'
import { buildTiles, DEX_SORTS, filterTiles, hasActiveFilters, parseDexLink, SORT_LABELS, sortTiles, viewKeyOf, type DexDisplay, type DexFilters, type DexSort, type DexTile } from './dex-query'
import './PokedexPage.css'


/** Tile-size glyphs: four large cells, nine small ones. */
function DensityIcon({ cells }: { cells: 2 | 3 }) {
  const size = cells === 2 ? 6.5 : 3.8
  const gap = cells === 2 ? 3 : 2.3
  const rects: ReactElement[] = []
  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) rects.push(<rect key={`${row}-${col}`} x={col * (size + gap)} y={row * (size + gap)} width={size} height={size} rx={cells === 2 ? 1.6 : 1} />)
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false" style={{ flex: 'none' }}>
      {rects}
    </svg>
  )
}


const isTyping = (target: EventTarget | null): boolean => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

// ---------------------------------------------------------------- empty state

function DexEmpty({ dex, text, filters, hasEntries, onClear }: { dex: Dex; text: string; filters: DexFilters; hasEntries: boolean; onClear: () => void }) {
  const t = useT()
  const setFilters = useDexBrowser((s) => s.setFilters)
  const query = text.trim()
  const filtered = hasActiveFilters(filters)
  const needsEntries = filters.status === 'caught' || filters.status === 'shiny' || filters.status === 'multi-game'
  const game = filters.game === null ? undefined : (dex.games.find((g) => g.id === filters.game) ?? GAME_BY_ID.get(filters.game))
  const onlyGameLeft = query === '' && game !== undefined && filters.gameMissing && filters.gens.length === 0 && filters.types.length === 0 && filters.tags.length === 0 && filters.status === 'all' && !filters.altForms

  if (onlyGameLeft && hasEntries) {
    return (
      <EmptyState
        tone="gold"
        icon="trophy"
        title={t('pokedex.empty.gameDone.title', { game: gameShortName(game.id) })}
        description={t(filters.gameEvents ? 'pokedex.empty.gameDone.descriptionEvents' : 'pokedex.empty.gameDone.description', { game: gameName(game.id) })}
        action={
          <>
            <Button variant="primary" onClick={() => setFilters({ gameMissing: false })}>
              {t('pokedex.empty.gameDone.showAll', { game: gameShortName(game.id) })}
            </Button>
            <Button variant="ghost" onClick={onClear}>
              {t('pokedex.empty.clearFilters')}
            </Button>
          </>
        }
      />
    )
  }
  if (needsEntries && !hasEntries) {
    return (
      <EmptyState
        icon="pokeball"
        title={t('pokedex.empty.noEntries.title')}
        description={t('pokedex.empty.noEntries.description')}
        action={
          <Button variant="primary" onClick={onClear}>
            {t('pokedex.empty.noEntries.showAll')}
          </Button>
        }
      />
    )
  }
  return (
    <EmptyState
      tone="neutral"
      icon="search"
      title={query !== '' && !filtered ? t('pokedex.empty.noMatch.titleQuery', { query }) : t('pokedex.empty.noMatch.title')}
      description={query !== '' && !filtered ? t('pokedex.empty.noMatch.spelling') : query !== '' ? t('pokedex.empty.noMatch.queryAndFilters') : t('pokedex.empty.noMatch.filters')}
      action={
        <Button variant="primary" icon="close" onClick={onClear}>
          {filtered ? t('pokedex.empty.clearSearchAndFilters') : t('pokedex.empty.clearSearch')}
        </Button>
      }
    />
  )
}

// ---------------------------------------------------------------- page

function PokedexBrowser({ dex }: { dex: Dex }) {
  const t = useT()
  const collection = useCollection()
  const hasEntries = useEntries().length > 0
  const text = useDexBrowser((s) => s.text)
  const filters = useDexBrowser((s) => s.filters)
  const display = useDexBrowser((s) => s.display)
  const sort = useDexBrowser((s) => s.sort)
  const setDisplay = useDexBrowser((s) => s.setDisplay)
  const setSort = useDexBrowser((s) => s.setSort)
  const clearAll = useDexBrowser((s) => s.clearAll)
  const density = useUiStore((s) => s.dexView.density)
  const shinyView = useUiStore((s) => s.dexView.shinyView)
  const setDexView = useUiStore((s) => s.setDexView)

  const gridRef = useRef<DexGridHandle>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Typing stays instant: the list catches up with the text at a lower priority.
  const deferredText = useDeferredValue(text)
  const universe = useMemo(() => buildTiles(dex, collection, display), [dex, collection, display])
  const filtered = useMemo(() => filterTiles(universe, { dex, collection, display, text: deferredText, filters }), [universe, dex, collection, display, deferredText, filters])
  const sorted = useMemo(() => sortTiles(filtered, sort), [filtered, sort])
  // A game chosen and the default order: the game's own Pokédex order, one section per Pokédex.
  const pokedexes = usePokedexes()
  const sectioned = useMemo(() => {
    const plan = filters.game !== null && sort === 'number' ? planSections(filters.game, pokedexes) : null
    return plan ? arrange(sorted, (tile) => tile.species.id, plan) : null
  }, [sorted, sort, filters.game, pokedexes])
  const tiles = sectioned?.items ?? sorted
  const viewKey = useMemo(() => viewKeyOf(tiles), [tiles])

  // A link such as /dex?game=scarlet&missing=1 sets the view once, then the address is tidied up
  // so that coming back later does not undo what the user changed since.
  const search = useSearch()
  useEffect(() => {
    if (search === '') return
    const link = parseDexLink(search, TYPE_IDS)
    if (link) useDexBrowser.getState().applyLink(link)
    navigate(paths.dex(), { replace: true })
  }, [search])

  // "/" jumps to the search box from anywhere on the page.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented || isTyping(event.target)) return
      const input = searchRef.current
      // Not while a dialog, the command palette or one of the filter panels is in front of the page.
      if (!input || input.closest('[inert]') || document.querySelector('.dex-pop')) return
      event.preventDefault()
      input.focus()
      input.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onOpen = useCallback((tile: DexTile) => {
    dexMemory.focusKey = tile.key
    navigate(paths.species(tile.species.id, tile.slot ? tile.slot.form : undefined))
  }, [])

  const onEnterGrid = useCallback(() => gridRef.current?.focusTile(0), [])

  // Stable while nothing it shows changes, so the memoised grid can skip the renders typing causes.
  const empty = useMemo(() => <DexEmpty dex={dex} text={deferredText} filters={filters} hasEntries={hasEntries} onClear={clearAll} />, [dex, deferredText, filters, hasEntries, clearAll])

  const narrowed = tiles.length !== universe.length
  const forms = display === 'forms'
  const displayOptions = useMemo<ReadonlyArray<{ value: DexDisplay; label: string }>>(
    () => [
      { value: 'species', label: t('pokedex.view.species') },
      { value: 'forms', label: t('pokedex.view.forms') }
    ],
    [t]
  )
  const densityOptions = useMemo<ReadonlyArray<{ value: DexDensity; icon: ReactElement; ariaLabel: string }>>(
    () => [
      { value: 'comfortable', icon: <DensityIcon cells={2} />, ariaLabel: t('pokedex.view.largeTiles') },
      { value: 'compact', icon: <DensityIcon cells={3} />, ariaLabel: t('pokedex.view.smallTiles') }
    ],
    [t]
  )
  const sortOptions = useMemo<ReadonlyArray<SelectOption<DexSort>>>(() => DEX_SORTS.map((value) => ({ value, label: SORT_LABELS[value] })), [])

  return (
    <div className="page page--fill dex">
      <header className="page-header dex-header">
        <div className="dex-heading">
          <h1 className="page-title">{t('pokedex.title')}</h1>
          <p className="dex-count" role="status">
            {rich(
              narrowed ? (forms ? 'pokedex.header.narrowed.forms' : 'pokedex.header.narrowed.species') : forms ? 'pokedex.header.count.forms' : 'pokedex.header.count.species',
              {
                shown: () => <NumberTicker value={tiles.length} animateOnMount={false} duration={260} className="dex-count__shown" />,
                total: () => <span className={narrowed ? undefined : 'dex-count__shown'}>{formatCount(universe.length)}</span>
              },
              { count: universe.length }
            )}
          </p>
        </div>
        <div className="dex-view">
          <SegmentedControl label={t('pokedex.view.show')} value={display} onChange={setDisplay} options={displayOptions} />
          <Tooltip content={t('pokedex.view.tileSize')} placement="bottom">
            <SegmentedControl label={t('pokedex.view.tileSize')} value={density} onChange={(next) => setDexView({ density: next })} options={densityOptions} />
          </Tooltip>
          <Select ariaLabel={t('pokedex.view.sortBy')} icon="sort" options={sortOptions} value={sort} onChange={setSort} wrapperClassName="dex-sort" />
        </div>
      </header>

      <DexToolbar dex={dex} searchRef={searchRef} onEnterGrid={onEnterGrid} />
      <DexActiveFilters shown={tiles.length} total={universe.length} display={display} />

      <DexGrid
        tiles={tiles}
        sections={sectioned?.sections}
        viewKey={viewKey}
        display={display}
        density={density}
        shinyView={shinyView}
        label={forms ? t('pokedex.grid.labelForms') : t('pokedex.grid.label')}
        handleRef={gridRef}
        onOpen={onOpen}
        empty={empty}
      />
    </div>
  )
}

/** The page frame with placeholder tiles, shown until the Pokédex data is there. */
export function PokedexSkeleton() {
  const t = useT()
  const density = useUiStore((s) => s.dexView.density)
  const metrics = TILE_METRICS[density]
  return (
    <div className="page page--fill dex" aria-busy="true">
      <header className="page-header dex-header">
        <div className="dex-heading">
          <h1 className="page-title">{t('pokedex.title')}</h1>
          <p className="dex-count">{t('pokedex.loading')}</p>
        </div>
      </header>
      <div className="dex-toolbar">
        <Skeleton height={36} radius={10} className="dex-search" />
        {[112, 84, 92, 136, 104].map((width) => (
          <Skeleton key={width} width={width} height={36} radius={10} />
        ))}
      </div>
      <div className="dex-grid">
        <div className="dex-skeleton" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${metrics.minWidth}px, 1fr))`, gap: metrics.gap, gridAutoRows: tileHeight(density, 'species') }}>
          {Array.from({ length: density === 'compact' ? 54 : 24 }, (_, i) => (
            <Skeleton key={i} height="100%" radius={14} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function PokedexPage() {
  const dex = useDexStore((s) => s.dex)
  return dex ? <PokedexBrowser dex={dex} /> : <PokedexSkeleton />
}
