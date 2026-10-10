import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { SYSTEM_BY_ID, type SystemId } from '@shared/games'
import type { CatchEntry, EntryKind } from '@shared/save-types'
import { BallIcon, EntryRowHeader, GameIcon, ShinyMark, SystemIcon } from '@renderer/components/pokemon'
import { Button, Checkbox, Chip, Dialog, EmptyState, IconButton, Kbd, NumberTicker, Select, TextField, Tooltip, cx, useEscapeLayer, useScrollParent } from '@renderer/components/ui'
import { focusIsLost, whenPageReleased } from '@renderer/features/living/focus'
import { useElementHeight, useElementWidth, useStuckFlag } from '@renderer/features/living/windowing'
import { rich, useT, type MessageKey } from '@renderer/i18n'
import { ballName, gameName, gameShortName } from '@renderer/i18n/terms'
import { useDex } from '@renderer/lib/data'
import { deleteEntryWithUndo, editEntry } from '@renderer/lib/entry-actions'
import { errorMessage, kindLabel } from '@renderer/lib/format'
import { navigate, paths } from '@renderer/shell/router'
import { useEntries, useSaveStore } from '@renderer/store/save'
import { toast, useUiStore } from '@renderer/store/ui'
import { DateMenu, FilterMenu, type FilterOption } from './FilterMenus'
import { JournalList, type JournalListHandle } from './JournalList'
import {
  DEFAULT_DIRECTION, JOURNAL_SORTS, NO_FILTERS, SORT_LABELS, UNKNOWN_GAME, activeFilterCount, buildListing, computeFacets, countsLine, filterItems, gameGenLabel, idRange, indexEntries, rangeLabel, summarize,
  type JournalFilters, type JournalSort, type SortDirection
} from './model'
import './JournalPage.css'

// ---------------------------------------------------------------- what the page remembers

const STORAGE_KEY = 'pelagix.journal.v1'

interface JournalPrefs {
  sort: JournalSort
  direction: SortDirection
}

function readPrefs(): JournalPrefs {
  const fallback: JournalPrefs = { sort: 'caught', direction: DEFAULT_DIRECTION.caught }
  try {
    if (typeof localStorage === 'undefined') return fallback
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<JournalPrefs> | null
    const sort = raw && JOURNAL_SORTS.includes(raw.sort as JournalSort) ? (raw.sort as JournalSort) : fallback.sort
    return { sort, direction: raw?.direction === 'asc' || raw?.direction === 'desc' ? raw.direction : DEFAULT_DIRECTION[sort] }
  } catch {
    return fallback
  }
}

function writePrefs(prefs: JournalPrefs): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // A convenience only.
  }
}

/** Filters survive a trip to another page and back, for as long as the app runs. */
let rememberedFilters: JournalFilters = NO_FILTERS
/** The capture the page already scrolled to once; it is only ringed after that. */
let scrolledCapture: string | null = null

const IS_MAC = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

/** What a sort direction means for each sort ("Newest catch first"): the message to show. */
const directionKey = (sort: JournalSort, direction: SortDirection): MessageKey => `journal.direction.${sort}.${direction}`

/** Width one game icon takes in the summary strip (icon, padding, gap), and what the "+12" at the end needs. */
const GAME_ICON_STEP = 36
const MORE_LABEL_WIDTH = 40

/** How many game icons fit in `width` px, keeping room for the "+N" when some are left out. */
function gamesThatFit(width: number, total: number): number {
  if (width <= 0) return Math.min(total, 10)
  if (total * GAME_ICON_STEP <= width) return total
  return Math.max(1, Math.floor((width - MORE_LABEL_WIDTH) / GAME_ICON_STEP))
}

/**
 * The Journal: every logged entry across all games, filterable and grouped by the active sort.
 * A row opens the editor; selection mode deletes several at once with a single undo.
 */
export default function JournalPage() {
  const t = useT()
  const dex = useDex()
  const entries = useEntries()
  const scroller = useScrollParent()
  const listRef = useRef<JournalListHandle>(null)
  const barRef = useRef<HTMLDivElement>(null)
  // The bar and the summary only exist once there is an entry; the measuring hooks follow them in and out.
  const hasEntries = entries.length > 0
  const barHeight = useElementHeight(barRef, hasEntries)
  const gamesRef = useRef<HTMLDivElement>(null)
  const gamesWidth = useElementWidth(gamesRef, hasEntries)
  useStuckFlag(scroller, barRef, hasEntries)

  const [filters, setFiltersState] = useState<JournalFilters>(rememberedFilters)
  const [prefs, setPrefsState] = useState(readPrefs)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(() => useUiStore.getState().lastCapture)
  const anchor = useRef<string | null>(null)
  const scrollTo = useRef<{ id: string; smooth: boolean } | null>(null)
  const selectButton = useRef<HTMLButtonElement>(null)
  const deleteButton = useRef<HTMLButtonElement>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  /** Places focus once a closing dialog has released the page, unless something else already has it. */
  const focusAfterModal = useCallback((place: () => void) => {
    whenPageReleased(
      () => {
        if (focusIsLost()) place()
      },
      () => alive.current
    )
  }, [])

  const setFilters = useCallback((patch: Partial<JournalFilters>) => {
    setFiltersState((old) => (rememberedFilters = { ...old, ...patch }))
  }, [])
  const clearFilters = useCallback(() => setFiltersState((rememberedFilters = NO_FILTERS)), [])
  const setPrefs = (next: JournalPrefs): void => {
    setPrefsState(next)
    writePrefs(next)
  }

  // ---------------------------------------------------------------- data

  const text = useDeferredValue(filters.text)
  const applied = useMemo(() => ({ ...filters, text }), [filters, text])
  const items = useMemo(() => indexEntries(dex, entries), [dex, entries])
  const facets = useMemo(() => computeFacets(items), [items])
  const summary = useMemo(() => summarize(items), [items])
  const listed = useMemo(() => filterItems(items, applied), [items, applied])
  const listing = useMemo(() => buildListing(listed, prefs.sort, prefs.direction), [listed, prefs.sort, prefs.direction])
  const filterCount = activeFilterCount(filters)

  // Only what is listed can be selected: a filter change never leaves hidden rows marked for deletion.
  const picked = useMemo(() => listing.order.filter((id) => selected.has(id)), [listing, selected])
  const allPicked = picked.length > 0 && picked.length === listing.order.length

  // A new sort or filter, deep in the list: start again from its first row (the bar stays where it is).
  const listingKey = `${prefs.sort}|${prefs.direction}|${JSON.stringify(applied)}`
  useEffect(() => {
    if (barRef.current?.hasAttribute('data-stuck')) listRef.current?.scrollToTop()
  }, [listingKey])

  // ---------------------------------------------------------------- highlight and scroll to an entry

  // The entry that was just logged elsewhere is ringed when the page opens (read, not consumed) and scrolled to once.
  useEffect(() => {
    if (highlightId === null) return
    if (scrolledCapture !== highlightId && useUiStore.getState().lastCapture === highlightId) {
      scrolledCapture = highlightId
      scrollTo.current = { id: highlightId, smooth: false }
    }
    const timer = setTimeout(() => setHighlightId(null), 2800)
    return () => clearTimeout(timer)
  }, [highlightId])

  useEffect(() => {
    const wanted = scrollTo.current
    if (!wanted || barHeight <= 0 || !listing.rowOf.has(wanted.id)) return
    scrollTo.current = null
    listRef.current?.scrollToEntry(wanted.id, { align: 'center', smooth: wanted.smooth })
  }, [listing, barHeight, highlightId])

  const onDuplicated = useCallback((copy: CatchEntry) => {
    scrollTo.current = { id: copy.id, smooth: true }
    setHighlightId(copy.id)
  }, [])

  // ---------------------------------------------------------------- selection

  const leaveSelection = useCallback(() => {
    setSelecting(false)
    setSelected(new Set())
    anchor.current = null
  }, [])
  useEscapeLayer(selecting && !confirming, leaveSelection)

  const order = useRef(listing.order)
  order.current = listing.order
  const onToggle = useCallback((id: string, range: boolean) => {
    const from = anchor.current
    const span = range && from !== null && from !== id ? idRange(order.current, from, id) : null
    anchor.current = id
    setSelected((old) => {
      const next = new Set(old)
      if (span) for (const each of span) next.add(each)
      else if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const onOpen = useCallback((entry: CatchEntry) => void editEntry(entry.id), [])

  // The editor closed: put the keyboard back on the row it was opened from.
  const editor = useUiStore((s) => s.entryEditor)
  const editing = useRef<string | null>(null)
  useEffect(() => {
    if (editor.open) {
      editing.current = editor.mode === 'edit' ? editor.entryId : null
      return
    }
    const id = editing.current
    editing.current = null
    if (id !== null) focusAfterModal(() => listRef.current?.focusEntry(id))
  }, [editor, focusAfterModal])

  const closeConfirm = (): void => {
    setConfirming(false)
    focusAfterModal(() => deleteButton.current?.focus())
  }

  const deleteSelected = (): void => {
    setConfirming(false)
    focusAfterModal(() => selectButton.current?.focus())
    const ids = picked
    if (ids.length === 0) return
    if (ids.length === 1 && ids[0] !== undefined) {
      deleteEntryWithUndo(ids[0])
      leaveSelection()
      return
    }
    const removed: CatchEntry[] = []
    try {
      for (const id of ids) {
        const entry = useSaveStore.getState().deleteEntry(id)
        if (entry) removed.push(entry)
      }
    } catch (err) {
      toast({ kind: 'error', title: t('journal.delete.failed'), body: errorMessage(err) })
    }
    if (removed.length === 0) return
    const gone = new Set(removed.map((e) => e.id))
    const ui = useUiStore.getState()
    if (ui.entryEditor.open && ui.entryEditor.mode === 'edit' && gone.has(ui.entryEditor.entryId)) ui.closeEditor()
    if (ui.lastCapture !== null && gone.has(ui.lastCapture)) ui.setLastCapture(null)
    toast({
      kind: 'info',
      icon: 'trash',
      title: t('journal.delete.done', { count: removed.length }),
      body: t('journal.delete.doneBody'),
      durationMs: 10000,
      action: {
        label: t('common.undo'),
        onSelect: () => {
          try {
            const { added } = useSaveStore.getState().mergeEntries(removed)
            if (added > 0) toast({ kind: 'success', icon: 'undo', title: t('journal.restore.done', { count: added }) })
            else toast({ kind: 'info', title: t('journal.restore.nothing.title'), body: t('journal.restore.nothing.body') })
          } catch (err) {
            toast({ kind: 'error', title: t('journal.restore.failed'), body: errorMessage(err) })
          }
        }
      }
    })
    leaveSelection()
  }

  // ---------------------------------------------------------------- filter options

  const gameOptions = useMemo<FilterOption<string>[]>(
    () => facets.games.map((f) => ({ value: f.value, label: f.label, count: f.count, group: f.game ? gameGenLabel(f.game.generation) : t('journal.filter.game.other'), icon: f.game ? <GameIcon game={f.game} size={22} tooltip={false} alt="" /> : undefined })),
    [facets]
  )
  const genOptions = useMemo<FilterOption<number>[]>(() => facets.gens.map((f) => ({ value: f.value, label: f.label, count: f.count })), [facets])
  const systemOptions = useMemo<FilterOption<SystemId>[]>(() => facets.systems.map((f) => ({ value: f.value, label: f.label, count: f.count, icon: <SystemIcon system={f.value} size={18} label="" /> })), [facets])
  const ballOptions = useMemo<FilterOption<number>[]>(() => facets.balls.map((f) => ({ value: f.value, label: f.label, count: f.count, icon: <BallIcon ball={f.value} size={20} label="" /> })), [facets])
  const kindOptions = useMemo<FilterOption<EntryKind>[]>(() => facets.kinds.map((f) => ({ value: f.value, label: f.label, count: f.count })), [facets])

  const toggleIn = <T,>(list: readonly T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

  // ---------------------------------------------------------------- empty journal

  if (entries.length === 0) {
    return (
      <div className="page journal">
        <header className="page-header">
          <div>
            <h1 className="page-title">{t('journal.page.title')}</h1>
            <p className="page-subtitle">{t('journal.page.subtitleEmpty')}</p>
          </div>
        </header>
        <EmptyState
          size="lg"
          icon="journal"
          title={t('journal.empty.title')}
          description={t('journal.empty.description')}
          action={
            <>
              <Button variant="primary" icon="dex" onClick={() => navigate(paths.dex())}>
                {t('journal.empty.openDex')}
              </Button>
              <Button variant="ghost" icon="search" onClick={() => useUiStore.getState().setCommandPalette(true)}>
                {rich('journal.empty.search', { key: () => <Kbd keys={[IS_MAC ? '⌘' : 'Ctrl', 'K']} /> })}
              </Button>
            </>
          }
        />
      </div>
    )
  }

  const rangeText = rangeLabel(filters.from, filters.to)
  const shownGames = gamesThatFit(gamesWidth, summary.games.length)
  const moreGames = summary.games.length - shownGames
  const directionText = t(directionKey(prefs.sort, prefs.direction))
  const gamesCount = t('journal.summary.games', { count: summary.games.length })

  return (
    <div className="page journal">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('journal.page.title')}</h1>
          <p className="page-subtitle">{t('journal.page.subtitle')}</p>
        </div>
        <div className="journal-actions">
          <Select<JournalSort>
            wrapperClassName="journal-actions__sort"
            ariaLabel={t('journal.sort.label')}
            icon="sort"
            value={prefs.sort}
            options={JOURNAL_SORTS.map((sort) => ({ value: sort, label: SORT_LABELS[sort] }))}
            onChange={(sort) => setPrefs({ sort, direction: DEFAULT_DIRECTION[sort] })}
          />
          <IconButton
            variant="subtle"
            icon={prefs.direction === 'desc' ? 'arrow-down' : 'arrow-up'}
            label={t('journal.direction.reverse', { order: directionText })}
            tooltip={directionText}
            onClick={() => setPrefs({ sort: prefs.sort, direction: prefs.direction === 'desc' ? 'asc' : 'desc' })}
          />
          <Button ref={selectButton} variant={selecting ? 'primary' : 'subtle'} icon="check" aria-pressed={selecting} onClick={() => (selecting ? leaveSelection() : setSelecting(true))}>
            {selecting ? t('common.done') : t('journal.select.start')}
          </Button>
        </div>
      </header>

      <section className="journal-summary" aria-label={t('journal.summary.label')}>
        <div className="journal-stat">
          <span className="u-eyebrow">{t('journal.summary.entries')}</span>
          <NumberTicker value={summary.entries} className="journal-stat__value" />
        </div>
        <div className="journal-stat">
          <span className="u-eyebrow">{t('journal.summary.pokemon')}</span>
          <NumberTicker value={summary.pokemon} className="journal-stat__value" />
        </div>
        <div className="journal-stat journal-stat--shiny">
          <span className="u-eyebrow">{t('common.shiny')}</span>
          <span className="journal-stat__value">
            <ShinyMark size={18} label="" />
            <NumberTicker value={summary.shiny} />
          </span>
        </div>
        <div className="journal-stat journal-stat--wide">
          <span className="u-eyebrow">
            {summary.unknownGames > 0 ? t('journal.summary.gamesUnknown', { games: gamesCount, count: summary.unknownGames }) : gamesCount}
          </span>
          <div ref={gamesRef} className="journal-icons">
            {summary.games.slice(0, shownGames).map(({ game, count }) => (
              <Tooltip key={game.id} content={t('journal.summary.iconTip', { name: gameName(game.id), count })}>
                <button type="button" className={cx('journal-icons__item', filters.games.includes(game.id) && 'is-on')} aria-pressed={filters.games.includes(game.id)} aria-label={t('journal.summary.filterBy', { name: gameName(game.id), count })} onClick={() => setFilters({ games: toggleIn(filters.games, game.id) })}>
                  <GameIcon game={game} size={28} tooltip={false} alt="" />
                </button>
              </Tooltip>
            ))}
            {moreGames > 0 && (
              <Tooltip content={t('journal.summary.moreGames', { count: moreGames, names: summary.games.slice(shownGames).map((g) => gameShortName(g.game.id)).join(t('journal.summary.separator')) })}>
                <span className="journal-icons__more">+{moreGames}</span>
              </Tooltip>
            )}
          </div>
        </div>
        <div className="journal-stat journal-stat--systems">
          <span className="u-eyebrow">{t('journal.summary.systems', { count: summary.systems.length })}</span>
          <div className="journal-icons">
            {summary.systems.map(({ system, name, count }) => (
              <Tooltip key={system} content={t('journal.summary.iconTip', { name, count })}>
                <button type="button" className={cx('journal-icons__item journal-icons__item--system', filters.systems.includes(system) && 'is-on')} aria-pressed={filters.systems.includes(system)} aria-label={t('journal.summary.filterBy', { name, count })} onClick={() => setFilters({ systems: toggleIn(filters.systems, system) })}>
                  <SystemIcon system={system} size={20} label="" />
                </button>
              </Tooltip>
            ))}
          </div>
        </div>
      </section>

      <div ref={barRef} className="journal-bar">
        <div className="journal-bar__filters" role="search" aria-label={t('journal.filter.label')}>
          <TextField wrapperClassName="journal-bar__text" icon="search" clearable value={filters.text} placeholder={t('journal.filter.text.placeholder')} aria-label={t('journal.filter.text.label')} onChange={(value) => setFilters({ text: value })} />
          <FilterMenu label={t('journal.filter.game')} searchLabel={t('journal.filter.game.search')} options={gameOptions} selected={filters.games} searchable={gameOptions.length > 8} onChange={(games) => setFilters({ games })} />
          <FilterMenu label={t('journal.filter.generation')} options={genOptions} selected={filters.gens} onChange={(gens) => setFilters({ gens })} />
          <FilterMenu label={t('journal.filter.system')} options={systemOptions} selected={filters.systems} onChange={(systems) => setFilters({ systems })} />
          <FilterMenu label={t('journal.filter.ball')} searchLabel={t('journal.filter.ball.search')} options={ballOptions} selected={filters.balls} searchable={ballOptions.length > 8} onChange={(balls) => setFilters({ balls })} />
          <FilterMenu label={t('journal.filter.kind')} options={kindOptions} selected={filters.kinds} onChange={(kinds) => setFilters({ kinds })} />
          <DateMenu from={filters.from} to={filters.to} onChange={(range) => setFilters(range)} />
          <Chip icon="sparkle" tone="gold" selected={filters.shinyOnly} onClick={() => setFilters({ shinyOnly: !filters.shinyOnly })}>
            {t('journal.filter.shiny')}
          </Chip>
        </div>

        {selecting ? (
          <div className="journal-bar__status journal-bar__status--select" role="toolbar" aria-label={t('journal.select.toolbar')}>
            <Checkbox
              checked={allPicked}
              indeterminate={picked.length > 0 && !allPicked}
              label={allPicked ? t('journal.select.none') : t('journal.select.all', { count: listing.order.length })}
              onChange={(on) => {
                setSelected(on ? new Set(listing.order) : new Set())
                anchor.current = null
              }}
            />
            <span className="journal-bar__picked" aria-live="polite">
              {rich('journal.select.picked', { b: (count) => <b>{count}</b> }, { count: picked.length })}
            </span>
            <span className="journal-bar__hint">{t('journal.select.hint')}</span>
            <Button ref={deleteButton} size="sm" variant="danger" icon="trash" disabled={picked.length === 0} onClick={() => setConfirming(true)}>
              {t('common.delete')}
            </Button>
            <Button size="sm" variant="ghost" onClick={leaveSelection}>
              {t('common.cancel')}
            </Button>
          </div>
        ) : (
          <div className="journal-bar__status">
            <span className="journal-bar__counts" aria-live="polite">
              {filterCount > 0 ? rich('journal.counts.of', { of: (text) => <span className="journal-bar__of">{text}</span> }, { counts: countsLine(listed), total: items.length }) : countsLine(listed)}
            </span>
            {filterCount > 0 && (
              <div className="journal-chips">
                {filters.text.trim() !== '' && <Chip size="sm" icon="search" onRemove={() => setFilters({ text: '' })} removeLabel={t('journal.chips.removeText')}>{t('journal.chips.text', { text: filters.text.trim() })}</Chip>}
                {filters.games.map((id) => (
                  <Chip key={id} size="sm" tone="accent" onRemove={() => setFilters({ games: filters.games.filter((g) => g !== id) })} removeLabel={t('journal.chips.remove', { name: id === UNKNOWN_GAME ? t('components.game.unknown') : gameName(id) })}>
                    {id === UNKNOWN_GAME ? t('components.game.unknown') : gameShortName(id)}
                  </Chip>
                ))}
                {filters.gens.map((gen) => (
                  <Chip key={gen} size="sm" tone="accent" onRemove={() => setFilters({ gens: filters.gens.filter((g) => g !== gen) })} removeLabel={t('journal.chips.remove', { name: gameGenLabel(gen) })}>
                    {gameGenLabel(gen)}
                  </Chip>
                ))}
                {filters.systems.map((id) => (
                  <Chip key={id} size="sm" tone="accent" onRemove={() => setFilters({ systems: filters.systems.filter((s) => s !== id) })} removeLabel={t('journal.chips.remove', { name: SYSTEM_BY_ID.get(id)?.name ?? id })}>
                    {SYSTEM_BY_ID.get(id)?.short ?? id}
                  </Chip>
                ))}
                {filters.balls.map((id) => (
                  <Chip key={id} size="sm" tone="accent" onRemove={() => setFilters({ balls: filters.balls.filter((b) => b !== id) })} removeLabel={t('journal.chips.remove', { name: ballName(id) ?? t('components.ball.unknown') })}>
                    {ballName(id) ?? t('components.ball.unknown')}
                  </Chip>
                ))}
                {filters.kinds.map((kind) => (
                  <Chip key={kind} size="sm" tone="accent" onRemove={() => setFilters({ kinds: filters.kinds.filter((k) => k !== kind) })} removeLabel={t('journal.chips.remove', { name: kindLabel(kind) })}>
                    {kindLabel(kind)}
                  </Chip>
                ))}
                {rangeText !== '' && (
                  <Chip size="sm" tone="accent" icon="calendar" onRemove={() => setFilters({ from: '', to: '' })} removeLabel={t('journal.chips.removeDates')}>
                    {rangeText}
                  </Chip>
                )}
                {filters.shinyOnly && (
                  <Chip size="sm" tone="gold" icon="sparkle" onRemove={() => setFilters({ shinyOnly: false })} removeLabel={t('journal.chips.removeShiny')}>
                    {t('journal.chips.shinyOnly')}
                  </Chip>
                )}
                <button type="button" className="journal-chips__clear" onClick={clearFilters}>
                  {t('journal.chips.clearAll')}
                </button>
              </div>
            )}
          </div>
        )}

        {listing.order.length > 0 && <EntryRowHeader className={cx('journal-bar__columns', selecting && 'is-selecting')} actions={!selecting} />}
      </div>

      {listing.order.length === 0 ? (
        <EmptyState
          icon="filter"
          tone="neutral"
          title={t('journal.noMatch.title')}
          description={t('journal.noMatch.description')}
          action={
            <Button variant="subtle" icon="close" onClick={clearFilters}>
              {t('journal.noMatch.clear')}
            </Button>
          }
        />
      ) : (
        <JournalList ref={listRef} listing={listing} scroller={scroller} inset={barHeight} selecting={selecting} selected={selected} highlightId={highlightId} onOpen={onOpen} onToggle={onToggle} onDuplicated={onDuplicated} />
      )}

      <Dialog
        open={confirming}
        onClose={closeConfirm}
        size="sm"
        title={t('journal.delete.title', { count: picked.length })}
        description={t('journal.delete.description')}
        footer={
          <>
            <Button variant="ghost" data-autofocus onClick={closeConfirm}>
              {t('journal.select.keep')}
            </Button>
            <Button variant="danger" icon="trash" onClick={deleteSelected}>
              {t('common.delete')}
            </Button>
          </>
        }
      />
    </div>
  )
}
