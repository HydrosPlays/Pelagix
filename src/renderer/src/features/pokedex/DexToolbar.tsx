import { memo, useMemo, type CSSProperties, type KeyboardEvent, type RefObject } from 'react'
import type { SpeciesTag, TypeId } from '@shared/dex-types'
import { GameIcon, ShinyMark, TYPE_IDS, typeColor } from '@renderer/components/pokemon'
import { Button, Chip, cx, Icon, Kbd, SegmentedControl, Switch, TextField, Tooltip, type IconName, type IconSlot } from '@renderer/components/ui'
import { generationName } from '@renderer/domain/generation'
import { useT } from '@renderer/i18n'
import { gameShortName, typeName } from '@renderer/i18n/terms'
import type { Dex } from '@renderer/lib/data'
import { FilterPopover } from './FilterPopover'
import { GamePicker } from './GamePicker'
import { useDexBrowser } from './dex-store'
import {
  activeChips, DEX_STATUSES, facetCounts, GENERATION_REGIONS, hasActiveFilters, romanNumeral, SPECIES_TAGS, STATUS_INFO, TAG_LABELS,
  type DexDisplay, type DexFilters, type DexStatus, type FilterChip, type TypeMatch
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
  const t = useT()
  const counts = facetCounts(dex).gens
  return (
    <div className="dex-gens" role="group" aria-label={t('pokedex.filter.generations')}>
      {GENERATIONS.filter((gen) => counts.has(gen)).map((gen, i) => {
        const on = value.includes(gen)
        return (
          <button key={gen} type="button" className={cx('dex-gen', on && 'is-on')} aria-pressed={on} aria-label={t('pokedex.filter.generationOption', { generation: generationName(gen), region: GENERATION_REGIONS[gen] ?? '', count: counts.get(gen) ?? 0 })} data-autofocus={i === 0 ? '' : undefined} onClick={() => onToggle(gen)}>
            <span className="dex-gen__num">{romanNumeral(gen)}</span>
            <span className="dex-gen__region">{GENERATION_REGIONS[gen]}</span>
            <span className="dex-gen__count">{counts.get(gen) ?? 0}</span>
          </button>
        )
      })}
    </div>
  )
}

function TypePanel({ dex, value, match, onToggle, onMatch }: { dex: Dex; value: readonly TypeId[]; match: TypeMatch; onToggle: (type: TypeId) => void; onMatch: (match: TypeMatch) => void }) {
  const t = useT()
  const counts = facetCounts(dex).types
  const types = TYPE_IDS.filter((type) => counts.has(type))
  const matchOptions: ReadonlyArray<{ value: TypeMatch; label: string }> = [
    { value: 'any', label: t('pokedex.filter.typeMatch.any') },
    { value: 'all', label: t('pokedex.filter.typeMatch.all') }
  ]
  return (
    <>
      <div className="dex-types" role="group" aria-label={t('pokedex.filter.types')}>
        {types.map((type, i) => {
          const on = value.includes(type)
          return (
            <button key={type} type="button" className={cx('dex-typeopt', on && 'is-on')} style={{ '--tc': typeColor(type) } as CSSProperties} aria-pressed={on} data-autofocus={i === 0 ? '' : undefined} onClick={() => onToggle(type)}>
              <span className="dex-typeopt__dot" aria-hidden="true" />
              {typeName(type)}
            </button>
          )
        })}
      </div>
      <div className="dex-pop__row">
        <span className="dex-pop__label" aria-hidden="true">
          {t('pokedex.filter.typeMatch.label')}
        </span>
        <SegmentedControl label={t('pokedex.filter.typeMatch.description')} size="sm" value={match} onChange={onMatch} options={matchOptions} />
      </div>
    </>
  )
}

function StatusPanel({ value, onChange }: { value: DexStatus; onChange: (status: DexStatus, done: boolean) => void }) {
  const t = useT()
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
    <div className="dex-statuses" role="radiogroup" aria-label={t('pokedex.filter.status')} onKeyDown={onKeyDown}>
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
  const t = useT()
  const chosen = filters.game !== null
  return (
    <div className="dex-game">
      <GamePicker dex={dex} value={filters.game} onChange={(game) => onChange(game === null ? { game: null, gameEvents: false, gameMissing: false } : { game })} />
      <Switch checked={filters.gameMissing} onChange={(gameMissing) => onChange({ gameMissing })} disabled={!chosen} reverse label={t('pokedex.filter.gameMissing.label')} description={t('pokedex.filter.gameMissing.description')} />
      <Switch checked={filters.gameEvents} onChange={(gameEvents) => onChange({ gameEvents })} disabled={!chosen} reverse label={t('pokedex.filter.gameEvents.label')} description={t('pokedex.filter.gameEvents.description')} />
    </div>
  )
}

function TagPanel({ dex, value, onToggle }: { dex: Dex; value: readonly SpeciesTag[]; onToggle: (tag: SpeciesTag) => void }) {
  const t = useT()
  const counts = facetCounts(dex).tags
  return (
    <div className="dex-tags" role="group" aria-label={t('pokedex.filter.categories')}>
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
  const t = useT()
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
    <div className="dex-toolbar" role="search" aria-label={t('pokedex.toolbar.label')}>
      <TextField
        ref={searchRef}
        value={text}
        onChange={setText}
        icon="search"
        placeholder={t('pokedex.toolbar.search.placeholder')}
        aria-label={t('pokedex.toolbar.search.label')}
        aria-keyshortcuts="/"
        clearable
        suffix={text === '' ? <Kbd>/</Kbd> : undefined}
        wrapperClassName="dex-search"
        maxLength={80}
        onKeyDown={onSearchKey}
      />

      <FilterPopover label={t('pokedex.filter.generation')} icon="globe" width={348} active={filters.gens.length > 0} summary={filters.gens.length > 0 ? filters.gens.map(romanNumeral).join(' ') : undefined} onClear={() => setFilters({ gens: [] })}>
        <GenerationPanel dex={dex} value={filters.gens} onToggle={toggleGen} />
      </FilterPopover>

      <FilterPopover label={t('pokedex.filter.type')} icon="flame" width={348} active={filters.types.length > 0} summary={filters.types.length > 0 ? <TypeSummary types={filters.types} /> : undefined} onClear={() => setFilters({ types: [], typeMatch: 'any' })}>
        <TypePanel dex={dex} value={filters.types} match={filters.typeMatch} onToggle={(type) => toggleType(type, TYPE_IDS)} onMatch={(typeMatch) => setFilters({ typeMatch })} />
      </FilterPopover>

      <FilterPopover label={t('pokedex.filter.status')} icon="pokeball" width={296} active={filters.status !== 'all'} summary={filters.status !== 'all' ? STATUS_INFO[filters.status].label : undefined} onClear={() => setFilters({ status: 'all' })}>
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
        label={t('pokedex.game.obtainableIn')}
        icon="gamepad"
        width={340}
        active={filters.game !== null}
        summary={game ? gameShortName(game.id) : undefined}
        onClear={() => setFilters({ game: null, gameEvents: false, gameMissing: false })}
      >
        <GamePanel dex={dex} filters={filters} onChange={setFilters} />
      </FilterPopover>

      <FilterPopover label={t('pokedex.filter.category')} icon="tag" width={320} active={filters.tags.length > 0} summary={filters.tags.length > 0 ? String(filters.tags.length) : undefined} onClear={() => setFilters({ tags: [] })}>
        <TagPanel dex={dex} value={filters.tags} onToggle={toggleTag} />
      </FilterPopover>

      <Tooltip content={t('pokedex.filter.altForms.hint')} placement="bottom">
        <Button icon="layers" className={cx('dex-filter', filters.altForms && 'is-active')} aria-pressed={filters.altForms} onClick={() => setFilters({ altForms: !filters.altForms })}>
          {t('pokedex.filter.altForms')}
        </Button>
      </Tooltip>
    </div>
  )
})

function TypeSummary({ types }: { types: readonly TypeId[] }) {
  useT()
  return (
    <span className="dex-filter__dots">
      {types.slice(0, 4).map((type) => (
        <span key={type} className="dex-filter__dot" style={{ background: typeColor(type) }} />
      ))}
      {types.length > 4 && <span>+{types.length - 4}</span>}
      <span className="u-sr-only">{types.map(typeName).join(', ')}</span>
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

const SHOWN_KEYS = {
  filters: { species: 'pokedex.active.filtersShown.species', forms: 'pokedex.active.filtersShown.forms' },
  search: { species: 'pokedex.active.searchShown.species', forms: 'pokedex.active.searchShown.forms' }
} as const

/** The row of removable chips under the toolbar; renders nothing while no condition is active. */
export const DexActiveFilters = memo(function DexActiveFilters({ shown, total, display }: { shown: number; total: number; display: DexDisplay }) {
  const t = useT()
  const text = useDexBrowser((s) => s.text)
  const filters = useDexBrowser((s) => s.filters)
  const setQuery = useDexBrowser((s) => s.setQuery)
  const clearAll = useDexBrowser((s) => s.clearAll)
  const chips = useMemo(() => activeChips(text, filters, typeName), [text, filters])
  if (chips.length === 0) return null
  const byFilters = hasActiveFilters(filters)

  return (
    <div className="dex-active" role="group" aria-label={t('pokedex.active.label')}>
      <span className="dex-active__label u-eyebrow">
        <span aria-hidden="true">{byFilters ? t('pokedex.active.filters') : t('pokedex.active.search')}</span>
        <span className="u-sr-only">{t(SHOWN_KEYS[byFilters ? 'filters' : 'search'][display], { shown, count: total })}</span>
      </span>
      <div className="dex-active__chips">
        {chips.map((chip) => (
          <Chip
            key={chip.id}
            tone={chip.kind === 'status' && (chip.value === 'shiny' || chip.value === 'shiny-missing') ? 'gold' : 'accent'}
            color={chip.kind === 'type' && typeof chip.value === 'string' ? `color-mix(in srgb, ${typeColor(chip.value as TypeId)} 62%, var(--text-1))` : undefined}
            icon={chipIcon(chip)}
            onRemove={() => setQuery(chip.remove({ text, filters }))}
            removeLabel={t('pokedex.active.remove', { filter: chip.label })}
          >
            {chip.label}
          </Chip>
        ))}
      </div>
      <Button variant="ghost" size="sm" icon="close" onClick={clearAll}>
        {t('pokedex.active.clearAll')}
      </Button>
    </div>
  )
})
