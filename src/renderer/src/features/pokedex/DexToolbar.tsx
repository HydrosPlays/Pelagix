import { memo, useMemo, type CSSProperties, type KeyboardEvent, type RefObject } from 'react'
import type { SpeciesTag, TypeId } from '@shared/dex-types'
import { GENERATION_NAMES } from '@shared/games'
import { GameIcon, ShinyMark, TYPE_IDS, TYPE_NAMES, typeColor } from '@renderer/components/pokemon'
import { Button, Chip, cx, Icon, Kbd, SegmentedControl, Switch, TextField, Tooltip, type IconName, type IconSlot } from '@renderer/components/ui'
import type { Dex } from '@renderer/lib/data'
import { formatCount } from '@renderer/lib/format'
import { FilterPopover } from './FilterPopover'
import { GamePicker } from './GamePicker'
import { useDexBrowser } from './dex-store'
import {
  activeChips, DEX_STATUSES, facetCounts, GENERATION_REGIONS, hasActiveFilters, romanNumeral, SPECIES_TAGS, STATUS_INFO, TAG_LABELS,
  type DexFilters, type DexStatus, type FilterChip, type TypeMatch
} from './dex-query'

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

const STATUS_ICONS: Readonly<Record<DexStatus, IconName>> = {
  all: 'dex',
  caught: 'check',
  missing: 'target',
  shiny: 'sparkle',
  'shiny-missing': 'star',
  'multi-game': 'gamepad'
}

// ---------------------------------------------------------------- panels

function GenerationPanel({ dex, value, onToggle }: { dex: Dex; value: readonly number[]; onToggle: (gen: number) => void }) {
  const counts = facetCounts(dex).gens
  return (
    <div className="dex-gens" role="group" aria-label="Generations">
      {GENERATIONS.filter((gen) => counts.has(gen)).map((gen, i) => {
        const on = value.includes(gen)
        return (
          <button key={gen} type="button" className={cx('dex-gen', on && 'is-on')} aria-pressed={on} aria-label={`${GENERATION_NAMES[gen] ?? `Generation ${gen}`}, ${GENERATION_REGIONS[gen] ?? ''}, ${counts.get(gen) ?? 0} Pokémon`} data-autofocus={i === 0 ? '' : undefined} onClick={() => onToggle(gen)}>
            <span className="dex-gen__num">{romanNumeral(gen)}</span>
            <span className="dex-gen__region">{GENERATION_REGIONS[gen]}</span>
            <span className="dex-gen__count">{counts.get(gen) ?? 0}</span>
          </button>
        )
      })}
    </div>
  )
}

const MATCH_OPTIONS: ReadonlyArray<{ value: TypeMatch; label: string }> = [
  { value: 'any', label: 'Any type' },
  { value: 'all', label: 'Every type' }
]

function TypePanel({ dex, value, match, onToggle, onMatch }: { dex: Dex; value: readonly TypeId[]; match: TypeMatch; onToggle: (type: TypeId) => void; onMatch: (match: TypeMatch) => void }) {
  const counts = facetCounts(dex).types
  const types = TYPE_IDS.filter((type) => counts.has(type))
  return (
    <>
      <div className="dex-types" role="group" aria-label="Types">
        {types.map((type, i) => {
          const on = value.includes(type)
          return (
            <button key={type} type="button" className={cx('dex-typeopt', on && 'is-on')} style={{ '--tc': typeColor(type) } as CSSProperties} aria-pressed={on} data-autofocus={i === 0 ? '' : undefined} onClick={() => onToggle(type)}>
              <span className="dex-typeopt__dot" aria-hidden="true" />
              {TYPE_NAMES[type]}
            </button>
          )
        })}
      </div>
      <div className="dex-pop__row">
        <span className="dex-pop__label" aria-hidden="true">
          Must have
        </span>
        <SegmentedControl label="With several types chosen, a Pokémon must have" size="sm" value={match} onChange={onMatch} options={MATCH_OPTIONS} />
      </div>
    </>
  )
}

function StatusPanel({ value, onChange }: { value: DexStatus; onChange: (status: DexStatus, done: boolean) => void }) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const next = DEX_STATUSES[(DEX_STATUSES.indexOf(value) + step + DEX_STATUSES.length) % DEX_STATUSES.length]
    if (next === undefined) return
    onChange(next, false)
    event.currentTarget.querySelector<HTMLElement>(`[data-status="${next}"]`)?.focus()
  }
  return (
    <div className="dex-statuses" role="radiogroup" aria-label="Status" onKeyDown={onKeyDown}>
      {DEX_STATUSES.map((status) => {
        const checked = status === value
        return (
          <button key={status} type="button" role="radio" aria-checked={checked} tabIndex={checked ? 0 : -1} data-status={status} data-autofocus={checked ? '' : undefined} className={cx('dex-status', checked && 'is-on')} onClick={() => onChange(status, true)}>
            <span className={cx('dex-status__icon', (status === 'shiny' || status === 'shiny-missing') && 'is-gold')}>{status === 'shiny' ? <ShinyMark size={16} label="" /> : <Icon name={STATUS_ICONS[status]} size={16} />}</span>
            <span className="dex-status__text">
              <span className="dex-status__label">{STATUS_INFO[status].label}</span>
              <span className="dex-status__desc">{STATUS_INFO[status].description}</span>
            </span>
            <Icon name="check" size={15} className="dex-status__check" />
          </button>
        )
      })}
    </div>
  )
}

function GamePanel({ dex, filters, onChange }: { dex: Dex; filters: DexFilters; onChange: (patch: Partial<DexFilters>) => void }) {
  const chosen = filters.game !== null
  return (
    <div className="dex-game">
      <GamePicker dex={dex} value={filters.game} onChange={(game) => onChange(game === null ? { game: null, gameEvents: false, gameMissing: false } : { game })} />
      <Switch checked={filters.gameMissing} onChange={(gameMissing) => onChange({ gameMissing })} disabled={!chosen} reverse label="Only what I still need" description="Leaves out Pokémon and forms already in your Living Dex." />
      <Switch checked={filters.gameEvents} onChange={(gameEvents) => onChange({ gameEvents })} disabled={!chosen} reverse label="Include event-only Pokémon" description="Distributions and other time-limited sources." />
    </div>
  )
}

function TagPanel({ dex, value, onToggle }: { dex: Dex; value: readonly SpeciesTag[]; onToggle: (tag: SpeciesTag) => void }) {
  const counts = facetCounts(dex).tags
  return (
    <div className="dex-tags" role="group" aria-label="Categories">
      {SPECIES_TAGS.map((tag) => (
        <Chip key={tag} selected={value.includes(tag)} onClick={() => onToggle(tag)}>
          {TAG_LABELS[tag]} <span className="dex-tags__count">{counts.get(tag) ?? 0}</span>
        </Chip>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- toolbar

export interface DexToolbarProps {
  dex: Dex
  searchRef: RefObject<HTMLInputElement | null>
  /** Arrow down or Enter in the search box: carry on in the grid. */
  onEnterGrid: () => void
}

/** Search box and filter buttons. Reads and writes the browser store itself, so typing re-renders only this row. */
export const DexToolbar = memo(function DexToolbar({ dex, searchRef, onEnterGrid }: DexToolbarProps) {
  const text = useDexBrowser((s) => s.text)
  const filters = useDexBrowser((s) => s.filters)
  const setText = useDexBrowser((s) => s.setText)
  const setFilters = useDexBrowser((s) => s.setFilters)
  const toggleGen = useDexBrowser((s) => s.toggleGen)
  const toggleType = useDexBrowser((s) => s.toggleType)
  const toggleTag = useDexBrowser((s) => s.toggleTag)

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      if (text !== '') {
        event.preventDefault()
        setText('')
      } else {
        event.currentTarget.blur()
      }
    } else if (event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault()
      onEnterGrid()
    }
  }

  const game = filters.game === null ? undefined : dex.games.find((g) => g.id === filters.game)

  return (
    <div className="dex-toolbar" role="search" aria-label="Find Pokémon">
      <TextField
        ref={searchRef}
        value={text}
        onChange={setText}
        icon="search"
        placeholder="Name or number"
        aria-label="Search by name or number"
        aria-keyshortcuts="/"
        clearable
        suffix={text === '' ? <Kbd>/</Kbd> : undefined}
        wrapperClassName="dex-search"
        maxLength={80}
        onKeyDown={onSearchKey}
      />

      <FilterPopover label="Generation" icon="globe" width={348} active={filters.gens.length > 0} summary={filters.gens.length > 0 ? filters.gens.map(romanNumeral).join(' ') : undefined} onClear={() => setFilters({ gens: [] })}>
        <GenerationPanel dex={dex} value={filters.gens} onToggle={toggleGen} />
      </FilterPopover>

      <FilterPopover label="Type" icon="flame" width={348} active={filters.types.length > 0} summary={filters.types.length > 0 ? <TypeSummary types={filters.types} /> : undefined} onClear={() => setFilters({ types: [], typeMatch: 'any' })}>
        <TypePanel dex={dex} value={filters.types} match={filters.typeMatch} onToggle={(type) => toggleType(type, TYPE_IDS)} onMatch={(typeMatch) => setFilters({ typeMatch })} />
      </FilterPopover>

      <FilterPopover label="Status" icon="pokeball" width={296} active={filters.status !== 'all'} summary={filters.status !== 'all' ? STATUS_INFO[filters.status].label : undefined} onClear={() => setFilters({ status: 'all' })}>
        {(close) => (
          <StatusPanel
            value={filters.status}
            onChange={(status, done) => {
              setFilters({ status })
              if (done) close()
            }}
          />
        )}
      </FilterPopover>

      <FilterPopover
        label="Obtainable in"
        icon="gamepad"
        width={340}
        active={filters.game !== null}
        summary={game ? game.short : undefined}
        onClear={() => setFilters({ game: null, gameEvents: false, gameMissing: false })}
      >
        <GamePanel dex={dex} filters={filters} onChange={setFilters} />
      </FilterPopover>

      <FilterPopover label="Category" icon="tag" width={320} active={filters.tags.length > 0} summary={filters.tags.length > 0 ? String(filters.tags.length) : undefined} onClear={() => setFilters({ tags: [] })}>
        <TagPanel dex={dex} value={filters.tags} onToggle={toggleTag} />
      </FilterPopover>

      <Tooltip content="Only Pokémon with more than one form to collect under your Living Dex rules" placement="bottom">
        <Button icon="layers" className={cx('dex-filter', filters.altForms && 'is-active')} aria-pressed={filters.altForms} onClick={() => setFilters({ altForms: !filters.altForms })}>
          Alternate forms
        </Button>
      </Tooltip>
    </div>
  )
})

function TypeSummary({ types }: { types: readonly TypeId[] }) {
  return (
    <span className="dex-filter__dots">
      {types.slice(0, 4).map((type) => (
        <span key={type} className="dex-filter__dot" style={{ background: typeColor(type) }} />
      ))}
      {types.length > 4 && <span>+{types.length - 4}</span>}
      <span className="u-sr-only">{types.map((t) => TYPE_NAMES[t]).join(', ')}</span>
    </span>
  )
}

// ---------------------------------------------------------------- active filters

function chipIcon(chip: FilterChip): IconSlot | undefined {
  switch (chip.kind) {
    case 'text':
      return 'search'
    case 'game':
      return typeof chip.value === 'string' ? <GameIcon game={chip.value} size={16} tooltip={false} alt="" /> : 'gamepad'
    case 'status':
      return chip.value === 'shiny' || chip.value === 'shiny-missing' ? 'sparkle' : undefined
    case 'alt-forms':
      return 'layers'
    default:
      return undefined
  }
}

/** The row of removable chips under the toolbar; renders nothing while no condition is active. */
export const DexActiveFilters = memo(function DexActiveFilters({ shown, total, noun }: { shown: number; total: number; noun: string }) {
  const text = useDexBrowser((s) => s.text)
  const filters = useDexBrowser((s) => s.filters)
  const setQuery = useDexBrowser((s) => s.setQuery)
  const clearAll = useDexBrowser((s) => s.clearAll)
  const chips = useMemo(() => activeChips(text, filters, (type) => TYPE_NAMES[type] ?? type), [text, filters])
  if (chips.length === 0) return null

  return (
    <div className="dex-active" role="group" aria-label="Active filters">
      <span className="dex-active__label u-eyebrow">
        {hasActiveFilters(filters) ? 'Filters' : 'Search'}
        <span className="u-sr-only">
          : {formatCount(shown)} of {formatCount(total)} {noun} shown
        </span>
      </span>
      <div className="dex-active__chips">
        {chips.map((chip) => (
          <Chip
            key={chip.id}
            tone={chip.kind === 'status' && (chip.value === 'shiny' || chip.value === 'shiny-missing') ? 'gold' : 'accent'}
            color={chip.kind === 'type' && typeof chip.value === 'string' ? `color-mix(in srgb, ${typeColor(chip.value as TypeId)} 62%, var(--text-1))` : undefined}
            icon={chipIcon(chip)}
            onRemove={() => setQuery(chip.remove({ text, filters }))}
            removeLabel={`Remove filter: ${chip.label}`}
          >
            {chip.label}
          </Chip>
        ))}
      </div>
      <Button variant="ghost" size="sm" icon="close" onClick={clearAll}>
        Clear all
      </Button>
    </div>
  )
})
