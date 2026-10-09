import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { BALL_BY_ID } from '@shared/balls'
import { GAME_BY_ID, SYSTEM_BY_ID, type SystemId } from '@shared/games'
import type { CatchEntry, EntryKind } from '@shared/save-types'
import { BallIcon, EntryRowHeader, GameIcon, ShinyMark, SystemIcon } from '@renderer/components/pokemon'
import { Button, Checkbox, Chip, Dialog, EmptyState, IconButton, Kbd, NumberTicker, Select, TextField, Tooltip, cx, useEscapeLayer, useScrollParent } from '@renderer/components/ui'
import { focusIsLost, whenPageReleased } from '@renderer/features/living/focus'
import { useElementHeight, useElementWidth, useStuckFlag } from '@renderer/features/living/windowing'
import { useDex } from '@renderer/lib/data'
import { deleteEntryWithUndo, editEntry } from '@renderer/lib/entry-actions'
import { errorMessage, formatCount, kindLabel, plural } from '@renderer/lib/format'
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

const DIRECTION_LABEL: Readonly<Record<JournalSort, Record<SortDirection, string>>> = {
  caught: { desc: 'Newest catch first', asc: 'Oldest catch first' },
  logged: { desc: 'Last logged first', asc: 'First logged first' },
  dex: { asc: 'Lowest number first', desc: 'Highest number first' },
  game: { asc: 'Oldest game first', desc: 'Newest game first' }
}

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
      toast({ kind: 'error', title: 'Some entries could not be deleted', body: errorMessage(err) })
    }
    if (removed.length === 0) return
    const gone = new Set(removed.map((e) => e.id))
    const ui = useUiStore.getState()
    if (ui.entryEditor.open && ui.entryEditor.mode === 'edit' && gone.has(ui.entryEditor.entryId)) ui.closeEditor()
    if (ui.lastCapture !== null && gone.has(ui.lastCapture)) ui.setLastCapture(null)
    toast({
      kind: 'info',
      icon: 'trash',
      title: `${plural(removed.length, 'entry', 'entries')} deleted`,
      body: 'Undo puts every one of them back.',
      durationMs: 10000,
      action: {
        label: 'Undo',
        onSelect: () => {
          try {
            const { added } = useSaveStore.getState().mergeEntries(removed)
            if (added > 0) toast({ kind: 'success', icon: 'undo', title: `${plural(added, 'entry', 'entries')} restored` })
            else toast({ kind: 'info', title: 'Nothing to restore', body: 'Those entries are already in your Journal.' })
          } catch (err) {
            toast({ kind: 'error', title: 'The entries could not be restored', body: errorMessage(err) })
          }
        }
      }
    })
    leaveSelection()
  }

  // ---------------------------------------------------------------- filter options

  const gameOptions = useMemo<FilterOption<string>[]>(
    () => facets.games.map((f) => ({ value: f.value, label: f.label, count: f.count, group: f.game ? gameGenLabel(f.game.generation) : 'Other', icon: f.game ? <GameIcon game={f.game} size={22} tooltip={false} alt="" /> : undefined })),
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
            <h1 className="page-title">Journal</h1>
            <p className="page-subtitle">Every catch you log, across all your games.</p>
          </div>
        </header>
        <EmptyState
          size="lg"
          icon="journal"
          title="Your Journal is empty"
          description="Log a catch and it shows up here with its game, place, ball and date. Find a Pokémon to get started."
          action={
            <>
              <Button variant="primary" icon="dex" onClick={() => navigate(paths.dex())}>
                Open the Pokédex
              </Button>
              <Button variant="ghost" icon="search" onClick={() => useUiStore.getState().setCommandPalette(true)}>
                Search for a Pokémon <Kbd keys={[IS_MAC ? '⌘' : 'Ctrl', 'K']} />
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

  return (
    <div className="page journal">
      <header className="page-header">
        <div>
          <h1 className="page-title">Journal</h1>
          <p className="page-subtitle">Every catch you have logged, across all your games.</p>
        </div>
        <div className="journal-actions">
          <Select<JournalSort>
            wrapperClassName="journal-actions__sort"
            ariaLabel="Sort and group by"
            icon="sort"
            value={prefs.sort}
            options={JOURNAL_SORTS.map((sort) => ({ value: sort, label: SORT_LABELS[sort] }))}
            onChange={(sort) => setPrefs({ sort, direction: DEFAULT_DIRECTION[sort] })}
          />
          <IconButton
            variant="subtle"
            icon={prefs.direction === 'desc' ? 'arrow-down' : 'arrow-up'}
            label={`${DIRECTION_LABEL[prefs.sort][prefs.direction]}. Reverse the order`}
            tooltip={DIRECTION_LABEL[prefs.sort][prefs.direction]}
            onClick={() => setPrefs({ sort: prefs.sort, direction: prefs.direction === 'desc' ? 'asc' : 'desc' })}
          />
          <Button ref={selectButton} variant={selecting ? 'primary' : 'subtle'} icon="check" aria-pressed={selecting} onClick={() => (selecting ? leaveSelection() : setSelecting(true))}>
            {selecting ? 'Done' : 'Select'}
          </Button>
        </div>
      </header>

      <section className="journal-summary" aria-label="Journal summary">
        <div className="journal-stat">
          <span className="u-eyebrow">Entries</span>
          <NumberTicker value={summary.entries} className="journal-stat__value" />
        </div>
        <div className="journal-stat">
          <span className="u-eyebrow">Pokémon</span>
          <NumberTicker value={summary.pokemon} className="journal-stat__value" />
        </div>
        <div className="journal-stat journal-stat--shiny">
          <span className="u-eyebrow">Shiny</span>
          <span className="journal-stat__value">
            <ShinyMark size={18} label="" />
            <NumberTicker value={summary.shiny} />
          </span>
        </div>
        <div className="journal-stat journal-stat--wide">
          <span className="u-eyebrow">
            {plural(summary.games.length, 'game')}
            {summary.unknownGames > 0 && ` · ${formatCount(summary.unknownGames)} from an unknown game`}
          </span>
          <div ref={gamesRef} className="journal-icons">
            {summary.games.slice(0, shownGames).map(({ game, count }) => (
              <Tooltip key={game.id} content={`${game.name} · ${plural(count, 'entry', 'entries')}`}>
                <button type="button" className={cx('journal-icons__item', filters.games.includes(game.id) && 'is-on')} aria-pressed={filters.games.includes(game.id)} aria-label={`Filter by ${game.name}, ${plural(count, 'entry', 'entries')}`} onClick={() => setFilters({ games: toggleIn(filters.games, game.id) })}>
                  <GameIcon game={game} size={28} tooltip={false} alt="" />
                </button>
              </Tooltip>
            ))}
            {moreGames > 0 && (
              <Tooltip content={`${plural(moreGames, 'more game')}: ${summary.games.slice(shownGames).map((g) => g.game.short).join(', ')}`}>
                <span className="journal-icons__more">+{moreGames}</span>
              </Tooltip>
            )}
          </div>
        </div>
        <div className="journal-stat journal-stat--systems">
          <span className="u-eyebrow">{plural(summary.systems.length, 'system')}</span>
          <div className="journal-icons">
            {summary.systems.map(({ system, name, count }) => (
              <Tooltip key={system} content={`${name} · ${plural(count, 'entry', 'entries')}`}>
                <button type="button" className={cx('journal-icons__item journal-icons__item--system', filters.systems.includes(system) && 'is-on')} aria-pressed={filters.systems.includes(system)} aria-label={`Filter by ${name}, ${plural(count, 'entry', 'entries')}`} onClick={() => setFilters({ systems: toggleIn(filters.systems, system) })}>
                  <SystemIcon system={system} size={20} label="" />
                </button>
              </Tooltip>
            ))}
          </div>
        </div>
      </section>

      <div ref={barRef} className="journal-bar">
        <div className="journal-bar__filters" role="search" aria-label="Filter the Journal">
          <TextField wrapperClassName="journal-bar__text" icon="search" clearable value={filters.text} placeholder="Name, nickname, place, notes, OT…" aria-label="Search entries" onChange={(value) => setFilters({ text: value })} />
          <FilterMenu label="Game" options={gameOptions} selected={filters.games} searchable={gameOptions.length > 8} onChange={(games) => setFilters({ games })} />
          <FilterMenu label="Generation" options={genOptions} selected={filters.gens} onChange={(gens) => setFilters({ gens })} />
          <FilterMenu label="System" options={systemOptions} selected={filters.systems} onChange={(systems) => setFilters({ systems })} />
          <FilterMenu label="Ball" options={ballOptions} selected={filters.balls} searchable={ballOptions.length > 8} onChange={(balls) => setFilters({ balls })} />
          <FilterMenu label="Obtained" options={kindOptions} selected={filters.kinds} onChange={(kinds) => setFilters({ kinds })} />
          <DateMenu from={filters.from} to={filters.to} onChange={(range) => setFilters(range)} />
          <Chip icon="sparkle" tone="gold" selected={filters.shinyOnly} onClick={() => setFilters({ shinyOnly: !filters.shinyOnly })}>
            Shiny
          </Chip>
        </div>

        {selecting ? (
          <div className="journal-bar__status journal-bar__status--select" role="toolbar" aria-label="Selection">
            <Checkbox
              checked={allPicked}
              indeterminate={picked.length > 0 && !allPicked}
              label={allPicked ? 'Deselect all' : `Select all ${formatCount(listing.order.length)}`}
              onChange={(on) => {
                setSelected(on ? new Set(listing.order) : new Set())
                anchor.current = null
              }}
            />
            <span className="journal-bar__picked" aria-live="polite">
              <b>{formatCount(picked.length)}</b> selected
            </span>
            <span className="journal-bar__hint">Shift-click selects a range</span>
            <Button ref={deleteButton} size="sm" variant="danger" icon="trash" disabled={picked.length === 0} onClick={() => setConfirming(true)}>
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={leaveSelection}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="journal-bar__status">
            <span className="journal-bar__counts" aria-live="polite">
              {countsLine(listed)}
              {filterCount > 0 && <span className="journal-bar__of"> of {formatCount(items.length)}</span>}
            </span>
            {filterCount > 0 && (
              <div className="journal-chips">
                {filters.text.trim() !== '' && <Chip size="sm" icon="search" onRemove={() => setFilters({ text: '' })} removeLabel="Remove the text filter">{`“${filters.text.trim()}”`}</Chip>}
                {filters.games.map((id) => (
                  <Chip key={id} size="sm" tone="accent" onRemove={() => setFilters({ games: filters.games.filter((g) => g !== id) })} removeLabel={`Remove ${GAME_BY_ID.get(id)?.name ?? 'Unknown game'}`}>
                    {id === UNKNOWN_GAME ? 'Unknown game' : (GAME_BY_ID.get(id)?.short ?? id)}
                  </Chip>
                ))}
                {filters.gens.map((gen) => (
                  <Chip key={gen} size="sm" tone="accent" onRemove={() => setFilters({ gens: filters.gens.filter((g) => g !== gen) })} removeLabel={`Remove ${gameGenLabel(gen)}`}>
                    {gameGenLabel(gen)}
                  </Chip>
                ))}
                {filters.systems.map((id) => (
                  <Chip key={id} size="sm" tone="accent" onRemove={() => setFilters({ systems: filters.systems.filter((s) => s !== id) })} removeLabel={`Remove ${SYSTEM_BY_ID.get(id)?.name ?? id}`}>
                    {SYSTEM_BY_ID.get(id)?.short ?? id}
                  </Chip>
                ))}
                {filters.balls.map((id) => (
                  <Chip key={id} size="sm" tone="accent" onRemove={() => setFilters({ balls: filters.balls.filter((b) => b !== id) })} removeLabel={`Remove ${BALL_BY_ID.get(id)?.name ?? 'Unknown ball'}`}>
                    {BALL_BY_ID.get(id)?.name ?? 'Unknown ball'}
                  </Chip>
                ))}
                {filters.kinds.map((kind) => (
                  <Chip key={kind} size="sm" tone="accent" onRemove={() => setFilters({ kinds: filters.kinds.filter((k) => k !== kind) })} removeLabel={`Remove ${kindLabel(kind)}`}>
                    {kindLabel(kind)}
                  </Chip>
                ))}
                {rangeText !== '' && (
                  <Chip size="sm" tone="accent" icon="calendar" onRemove={() => setFilters({ from: '', to: '' })} removeLabel="Remove the date range">
                    {rangeText}
                  </Chip>
                )}
                {filters.shinyOnly && (
                  <Chip size="sm" tone="gold" icon="sparkle" onRemove={() => setFilters({ shinyOnly: false })} removeLabel="Remove the shiny filter">
                    Shiny only
                  </Chip>
                )}
                <button type="button" className="journal-chips__clear" onClick={clearFilters}>
                  Clear all
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
          title="No entries match"
          description="Nothing in your Journal fits these filters. Loosen one of them, or start over."
          action={
            <Button variant="subtle" icon="close" onClick={clearFilters}>
              Clear all filters
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
        title={`Delete ${plural(picked.length, 'entry', 'entries')}?`}
        description="They leave your Journal and your Living Dex. You can undo this right afterwards."
        footer={
          <>
            <Button variant="ghost" data-autofocus onClick={closeConfirm}>
              Keep them
            </Button>
            <Button variant="danger" icon="trash" onClick={deleteSelected}>
              Delete
            </Button>
          </>
        }
      />
    </div>
  )
}
