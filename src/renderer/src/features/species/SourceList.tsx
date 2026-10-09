import { useId, useMemo, useState, type ReactNode } from 'react'
import { BALL_BY_ID } from '@shared/balls'
import type { EvolveSource, FormSummary, SpeciesDetail, SpeciesSummary } from '@shared/dex-types'
import type { GameDef } from '@shared/games'
import { BallIcon, GameIcon, GenderIcon, Sprite } from '@renderer/components/pokemon'
import { Button, cx, Icon, Skeleton, Tag } from '@renderer/components/ui'
import { rowGender, sourcesByGame, type GameSources, type SourcePreset } from '@renderer/domain/encounters'
import type { Dex } from '@renderer/lib/data'
import { levelRange } from '@renderer/lib/format'
import { normalizeText } from '@renderer/lib/search'
import { useSpeciesDetailRetry } from './hooks'
import {
  breedParents,
  breedPreset,
  buildSourceView,
  changeText,
  eventDates,
  evolvePreset,
  filterBlocks,
  initialBlockCount,
  rowPreset,
  SECTION_INFO,
  SECTION_ORDER,
  viaGameId,
  viaLabel,
  type LogTarget,
  type RowSection,
  type SectionId,
  type SourceBlock,
  type SourceRow
} from './sources'

/** How deep "where to find its pre-evolution" can be opened inside itself. */
const MAX_DEPTH = 3

/** The Pokémon whose sources are listed: the page's own, or an earlier stage opened inline. */
export interface SourceSubject {
  species: SpeciesSummary
  form: FormSummary
  detail: SpeciesDetail
}

interface Context {
  dex: Dex
  game: GameDef
  subject: SourceSubject
  target: LogTarget
  depth: number
  /** "species-form" keys already opened above this list, so a form-change loop cannot recurse. */
  trail: readonly string[]
  /** A long list of events starts open (they are the only way in this game). */
  eventsOpen: boolean
  onLog: (preset: SourcePreset) => void
  onOpenSpecies: (species: number, form: number) => void
}

export interface SourceListProps extends Omit<Context, 'depth' | 'trail' | 'eventsOpen'> {
  sources: Pick<GameSources, 'rows' | 'evolve' | 'breed'>
  depth?: number
  trail?: readonly string[]
  eventsOpen?: boolean
  /** Filter text over places, methods and notes. */
  query?: string
  /** Only these sections; empty or absent shows all. */
  only?: ReadonlySet<SectionId>
  /** Shown instead of the list when the filter leaves nothing. */
  emptyState?: ReactNode
}

const joinOr = (items: readonly string[]): string => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`)

function LogButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="sp-log" aria-label={label} onClick={onClick}>
      <Icon name="pokeball" size={14} />
      <span>Log</span>
    </button>
  )
}

// ---------------------------------------------------------------- section frame

function SectionFrame({ id, count, depth, defaultOpen = true, children }: { id: SectionId; count: number; depth: number; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()
  const info = SECTION_INFO[id]
  const Heading = depth === 0 ? 'h4' : 'h5'
  return (
    <section className={cx('sp-sec', !open && 'is-closed')} data-section={id}>
      <Heading className="sp-sec__head">
        <button type="button" className="sp-sec__toggle" aria-expanded={open} aria-controls={open ? bodyId : undefined} onClick={() => setOpen(!open)}>
          <span className="sp-sec__icon" aria-hidden="true">
            <Icon name={info.icon} size={15} />
          </span>
          <span className="sp-sec__title">{info.title}</span>
          <span className="sp-sec__count" aria-label={`${count} ${count === 1 ? info.one : info.many}`}>
            {count}
          </span>
          <Icon name="chevron-down" size={16} className="sp-sec__chev" />
        </button>
      </Heading>
      {open && (
        <div id={bodyId} className="sp-sec__body">
          {children}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- encounter rows

function RowTags({ item }: { item: SourceRow }) {
  const { row } = item
  const gender = rowGender(row)
  const via = row.via
  const viaGame = via ? viaGameId(via) : undefined
  const dates = eventDates(row)
  return (
    <div className="sp-src__tags">
      {item.alpha && (
        <Tag tone="catch" title="An Alpha Pokémon">
          Alpha
        </Tag>
      )}
      {item.conditions.map((condition) => (
        <Tag key={condition} variant="outline">
          {condition}
        </Tag>
      ))}
      {row.s === 'locked' && (
        <Tag tone="warning" icon="lock" title="This one can never be shiny">
          Shiny locked
        </Tag>
      )}
      {row.s === 'forced' && (
        <Tag tone="gold" icon="sparkle" title="This one is always shiny">
          Always shiny
        </Tag>
      )}
      {row.b !== undefined && (
        <Tag icon={<BallIcon ball={row.b} size={13} label="" />} title="Always comes in this ball">
          {BALL_BY_ID.get(row.b)?.name ?? 'Fixed ball'}
        </Tag>
      )}
      {(gender === 'm' || gender === 'f') && (
        <Tag
          icon={
            <span aria-hidden="true" className="sp-src__tagicon">
              <GenderIcon gender={gender} size={11} />
            </span>
          }
          title="Its gender is fixed"
        >
          {gender === 'm' ? 'Male only' : 'Female only'}
        </Tag>
      )}
      {row.rf === 1 && (
        <Tag tone="accent" title="The game picks the form at random or by your save's region">
          Random form
        </Tag>
      )}
      {via && (
        <Tag icon={viaGame ? <GameIcon game={viaGame} size={13} tooltip={false} alt="" /> : 'external'} title={`Delivered through ${viaLabel(via)}`}>
          via {viaLabel(via)}
        </Tag>
      )}
      {row.x?.ot !== undefined && (
        <Tag variant="outline" title="Original Trainer">
          OT {row.x.ot}
        </Tag>
      )}
      {dates !== undefined && (
        <span className="sp-src__dates">
          <Icon name="calendar" size={12} />
          {dates}
        </span>
      )}
    </div>
  )
}

function RowView({ item, first, context }: { item: SourceRow; first: boolean; context: Context }) {
  const { game, subject, target, onLog } = context
  const level = levelRange(item.row.lv)
  const nested = target.origin !== undefined
  const label = `Log ${target.form.full}${nested ? `, caught as ${subject.form.full}` : ''}: ${item.title}${item.location !== undefined ? ` at ${item.location}` : ''} in ${game.name}`
  return (
    <li className={cx('sp-src', item.location === undefined && 'sp-src--loose')}>
      {item.location !== undefined && (
        <div className="sp-src__place">
          {first ? (
            <>
              <Icon name="map-pin" size={14} className="sp-src__pin" />
              <span className="sp-src__placename" title={item.location}>
                {item.location}
              </span>
            </>
          ) : (
            <span className="u-sr-only">{item.location}</span>
          )}
        </div>
      )}
      <div className="sp-src__what">
        <span className="sp-src__title" title={item.title}>
          {item.title}
        </span>
        {item.detail !== undefined && (
          <span className="sp-src__detail" title={item.detail}>
            {item.detail}
          </span>
        )}
      </div>
      <div className="sp-src__level">{level}</div>
      <RowTags item={item} />
      <LogButton label={label} onClick={() => onLog(rowPreset(target, game, subject.detail, item.row))} />
    </li>
  )
}

function RowSectionView({ section, blocks, searching, context }: { section: RowSection; blocks: SourceBlock[]; searching: boolean; context: Context }) {
  const [all, setAll] = useState(false)
  const initial = searching ? Math.min(blocks.length, 30) : initialBlockCount(blocks, context.depth === 0 ? 10 : 6)
  const shown = all ? blocks : blocks.slice(0, initial)
  const rowCount = blocks.reduce((sum, block) => sum + block.rows.length, 0)
  const hidden = rowCount - shown.reduce((sum, block) => sum + block.rows.length, 0)
  return (
    <SectionFrame id={section.id} count={searching ? rowCount : section.count} depth={context.depth} defaultOpen={searching || section.id !== 'event' || section.count <= 5 || context.eventsOpen}>
      <div className="sp-blocks">
        {shown.map((block) => (
          <ul key={block.key} className="sp-block" aria-label={block.location}>
            {block.rows.map((item, index) => (
              <RowView key={item.key} item={item} first={index === 0} context={context} />
            ))}
          </ul>
        ))}
      </div>
      {(hidden > 0 || (all && blocks.length > initial)) && (
        <div className="sp-sec__more">
          <Button size="sm" variant="ghost" icon={all ? 'chevron-up' : 'chevron-down'} aria-expanded={all} onClick={() => setAll(!all)}>
            {all ? 'Show fewer' : `Show ${hidden} more`}
          </Button>
        </div>
      )}
    </SectionFrame>
  )
}

// ---------------------------------------------------------------- evolutions, form changes, breeding

/** The sources of an earlier stage, loaded on demand and listed inline. */
function NestedSources({ from, context }: { from: [number, number]; context: Context }) {
  const { dex, game, target, trail, depth, onLog, onOpenSpecies } = context
  const species = dex.species(from[0])
  const form = dex.form(from[0], from[1])
  const detail = useSpeciesDetailRetry(species ? species.id : null)
  const sources = useMemo(() => (detail.data && form ? sourcesByGame(dex, detail.data, form).find((s) => s.game.id === game.id) : undefined), [dex, detail.data, form, game.id])

  if (!species || !form) return null
  if (detail.loading) {
    return (
      <div className="sp-nested" aria-busy="true">
        <span className="u-sr-only">Loading where to find {form.full}</span>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={36} radius={8} />
        ))}
      </div>
    )
  }
  if (!detail.data) {
    return (
      <div className="sp-nested sp-nested--note" role="alert">
        <span>The details of {form.full} could not be loaded.</span>
        <Button size="sm" icon="refresh" onClick={detail.retry}>
          Try again
        </Button>
      </div>
    )
  }
  const empty = !sources || (sources.rows.length === 0 && sources.evolve.length === 0 && !sources.breed)
  if (empty) {
    return (
      <div className="sp-nested sp-nested--note">
        <span>
          {form.full} cannot be obtained in {game.name} either, so it has to be brought in from another game.
        </span>
        <Button size="sm" variant="ghost" iconEnd="arrow-right" onClick={() => onOpenSpecies(species.id, form.f)}>
          Open {form.full}
        </Button>
      </div>
    )
  }
  return (
    <div className="sp-nested">
      <div className="sp-nested__head">
        <span>
          {form.full} in {game.name}
        </span>
        <Button size="sm" variant="ghost" iconEnd="arrow-right" onClick={() => onOpenSpecies(species.id, form.f)}>
          Open its page
        </Button>
      </div>
      <SourceList
        dex={dex}
        game={game}
        subject={{ species, form, detail: detail.data }}
        sources={sources}
        target={{ ...target, origin: [species.id, form.f] }}
        depth={depth + 1}
        trail={[...trail, `${species.id}-${form.f}`]}
        onLog={onLog}
        onOpenSpecies={onOpenSpecies}
      />
    </div>
  )
}

function EvolveItem({ source, change, context }: { source: EvolveSource; change: boolean; context: Context }) {
  const { dex, game, target, depth, trail, onLog, onOpenSpecies } = context
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const fromSpecies = dex.species(source.from[0])
  const fromForm = dex.form(source.from[0], source.from[1])
  const name = fromForm?.full ?? fromSpecies?.name ?? `Pokémon #${source.from[0]}`
  const canExpand = depth < MAX_DEPTH && fromSpecies !== undefined && fromForm !== undefined && !trail.includes(`${source.from[0]}-${source.from[1]}`)
  return (
    <li className="sp-evo">
      <div className="sp-evo__row">
        <button type="button" className="sp-evo__mon" aria-label={`Open ${name}`} title={`Open ${name}`} onClick={() => onOpenSpecies(source.from[0], source.from[1])}>
          <Sprite species={source.from[0]} form={source.from[1]} size={44} />
        </button>
        <div className="sp-evo__text">
          <span className="sp-evo__title">{change ? `Change from ${name}` : `Evolve ${name}`}</span>
          <span className="sp-evo__how">{change ? changeText(source.how) : source.how}</span>
        </div>
        <div className="sp-evo__actions">
          {canExpand && (
            <Button size="sm" variant="ghost" iconEnd={open ? 'chevron-up' : 'chevron-down'} aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen(!open)}>
              Where to find {name} in {game.short}
            </Button>
          )}
          {depth === 0 && <LogButton label={`Log ${target.form.full}: ${change ? 'changed' : 'evolved'} from ${name} in ${game.name}`} onClick={() => onLog(evolvePreset(target, game, source))} />}
        </div>
      </div>
      {open && canExpand && (
        <div id={panelId}>
          <NestedSources from={source.from} context={context} />
        </div>
      )}
    </li>
  )
}

function BreedItem({ context }: { context: Context }) {
  const { dex, game, subject, target, onLog, onOpenSpecies } = context
  const parents = useMemo(() => breedParents(dex, subject.detail.family, subject.species.id, subject.form.f, game.id), [dex, subject, game.id])
  const names = parents.map((p) => dex.form(p.s, p.f)?.full ?? dex.species(p.s)?.name ?? `Pokémon #${p.s}`)
  const shownNames = names.length > 4 ? [...names.slice(0, 3), `${names.length - 3} more`] : names
  const nested = target.origin !== undefined
  return (
    <li className="sp-evo">
      <div className="sp-evo__row">
        <span className="sp-evo__mon sp-evo__mon--egg" aria-hidden="true">
          <Icon name="egg" size={22} />
        </span>
        <div className="sp-evo__text">
          <span className="sp-evo__title">Hatch from an Egg</span>
          <span className="sp-evo__how">{names.length > 0 ? `Breed ${joinOr(shownNames)}. A Ditto works as the partner.` : 'Breed a member of its family.'}</span>
        </div>
        <div className="sp-evo__actions">
          {parents.length > 0 && (
            <span className="sp-evo__parents">
              {parents.slice(0, 4).map((p, i) => (
                <button key={`${p.s}-${p.f}`} type="button" className="sp-evo__parent" aria-label={`Open ${names[i]}`} title={names[i]} onClick={() => onOpenSpecies(p.s, p.f)}>
                  <Sprite species={p.s} form={p.f} size={30} />
                </button>
              ))}
            </span>
          )}
          <LogButton label={`Log ${target.form.full}: hatched${nested ? ` as ${subject.form.full}` : ''} from an Egg in ${game.name}`} onClick={() => onLog(breedPreset(target, game))} />
        </div>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------- the list

/**
 * Every way one game offers a Pokémon, in the order a player thinks: wild, static, gifts, trades,
 * raids, the side sources, then evolving, changing form, breeding and events. Each has a "Log"
 * action; an evolution can open the sources of the Pokémon it starts from inline.
 */
export function SourceList({ sources, depth = 0, trail = [], eventsOpen = false, query = '', only, emptyState, ...rest }: SourceListProps) {
  const context: Context = { ...rest, depth, trail, eventsOpen }
  const { subject, dex } = context
  const view = useMemo(() => buildSourceView(subject.detail, sources, subject.species.id), [subject.detail, sources, subject.species.id])
  const needle = normalizeText(query)
  const searching = needle !== ''
  const wants = (id: SectionId): boolean => !only || only.size === 0 || only.has(id)
  const matchesEvolve = (source: EvolveSource): boolean => {
    if (!searching) return true
    const name = dex.form(source.from[0], source.from[1])?.full ?? dex.species(source.from[0])?.name ?? ''
    return normalizeText(`${name} ${source.how}`).includes(needle)
  }

  const parts: ReactNode[] = []
  for (const id of SECTION_ORDER) {
    if (!wants(id)) continue
    if (id === 'evolve' || id === 'change') {
      const list = (id === 'evolve' ? view.evolve : view.change).filter(matchesEvolve)
      if (list.length === 0) continue
      parts.push(
        <SectionFrame key={id} id={id} count={list.length} depth={depth}>
          <ul className="sp-evos">
            {list.map((source) => (
              <EvolveItem key={`${source.from[0]}-${source.from[1]}-${source.how}`} source={source} change={id === 'change'} context={context} />
            ))}
          </ul>
        </SectionFrame>
      )
      continue
    }
    if (id === 'breed') {
      if (!view.breed || (searching && !'hatch from an egg breed'.includes(needle))) continue
      parts.push(
        <SectionFrame key={id} id={id} count={1} depth={depth}>
          <ul className="sp-evos">
            <BreedItem context={context} />
          </ul>
        </SectionFrame>
      )
      continue
    }
    const section = view.sections.find((s) => s.id === id)
    if (!section) continue
    const blocks = filterBlocks(section.blocks, query)
    if (blocks.length === 0) continue
    parts.push(<RowSectionView key={`${id}-${searching ? 'q' : 'all'}`} section={section} blocks={blocks} searching={searching} context={context} />)
  }

  if (parts.length === 0) return <>{emptyState ?? null}</>
  return <div className={cx('sp-sources', depth > 0 && 'sp-sources--nested')}>{parts}</div>
}
