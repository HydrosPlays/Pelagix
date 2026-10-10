import { useId, useMemo, useState, type ReactNode } from 'react'
import type { EvolveSource, FormSummary, SpeciesDetail, SpeciesSummary } from '@shared/dex-types'
import type { GameDef } from '@shared/games'
import { languageTag } from '@shared/languages'
import { BallIcon, GameIcon, GenderIcon, Sprite } from '@renderer/components/pokemon'
import { Button, cx, Icon, Skeleton, Tag } from '@renderer/components/ui'
import { rowGender, sourcesByGame, type GameSources, type SourcePreset } from '@renderer/domain/encounters'
import { activeLanguage, useT } from '@renderer/i18n'
import { ballName, evolutionText, formFullName, gameName, gameShortName } from '@renderer/i18n/terms'
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
  monName,
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

/** "A", "A or B", "A, B or C": a list of alternatives the way the language joins one. */
function joinOr(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  const language = activeLanguage()
  if (language !== 'en') return new Intl.ListFormat(languageTag(language), { style: 'long', type: 'disjunction' }).format(items)
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`
}

function LogButton({ label, onClick }: { label: string; onClick: () => void }) {
  const t = useT()
  return (
    <button type="button" className="sp-log" aria-label={label} onClick={onClick}>
      <Icon name="pokeball" size={14} />
      <span>{t('species.source.log')}</span>
    </button>
  )
}

// ---------------------------------------------------------------- section frame

function SectionFrame({ id, count, depth, defaultOpen = true, children }: { id: SectionId; count: number; depth: number; defaultOpen?: boolean; children: ReactNode }) {
  useT()
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
          <span className="sp-sec__count" aria-label={info.count(count)}>
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
  const t = useT()
  const { row } = item
  const gender = rowGender(row)
  const via = row.via
  const viaGame = via ? viaGameId(via) : undefined
  const dates = eventDates(row)
  return (
    <div className="sp-src__tags">
      {item.alpha && (
        <Tag tone="catch" title={t('species.source.alpha.hint')}>
          {t('species.source.alpha')}
        </Tag>
      )}
      {item.conditions.map((condition) => (
        <Tag key={condition} variant="outline">
          {condition}
        </Tag>
      ))}
      {row.s === 'locked' && (
        <Tag tone="warning" icon="lock" title={t('species.source.shinyLocked.hint')}>
          {t('species.source.shinyLocked')}
        </Tag>
      )}
      {row.s === 'forced' && (
        <Tag tone="gold" icon="sparkle" title={t('species.source.shinyForced.hint')}>
          {t('species.source.shinyForced')}
        </Tag>
      )}
      {row.b !== undefined && (
        <Tag icon={<BallIcon ball={row.b} size={13} label="" />} title={t('species.source.ball.hint')}>
          {ballName(row.b) ?? t('species.source.ball.unknown')}
        </Tag>
      )}
      {(gender === 'm' || gender === 'f') && (
        <Tag
          icon={
            <span aria-hidden="true" className="sp-src__tagicon">
              <GenderIcon gender={gender} size={11} />
            </span>
          }
          title={t('species.source.gender.hint')}
        >
          {gender === 'm' ? t('species.source.gender.male') : t('species.source.gender.female')}
        </Tag>
      )}
      {row.rf === 1 && (
        <Tag tone="accent" title={t('species.source.randomForm.hint')}>
          {t('species.source.randomForm')}
        </Tag>
      )}
      {via && (
        <Tag icon={viaGame ? <GameIcon game={viaGame} size={13} tooltip={false} alt="" /> : 'external'} title={t('species.source.via.hint', { product: viaLabel(via) })}>
          {t('species.source.via', { product: viaLabel(via) })}
        </Tag>
      )}
      {row.x?.ot !== undefined && (
        <Tag variant="outline" title={t('species.source.ot.hint')}>
          {t('species.source.ot', { trainer: row.x.ot })}
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
  const t = useT()
  const { game, subject, target, onLog } = context
  const level = levelRange(item.row.lv)
  const nested = target.origin !== undefined
  const names = { name: formFullName(target.species, target.form), origin: formFullName(subject.species, subject.form), source: item.title, place: item.location ?? '', game: gameName(game.id) }
  const label =
    item.location !== undefined
      ? t(nested ? 'species.source.logRowAsAt' : 'species.source.logRowAt', names)
      : t(nested ? 'species.source.logRowAs' : 'species.source.logRow', names)
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
  const t = useT()
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
            {all ? t('species.showFewer') : t('species.source.showMore', { count: hidden })}
          </Button>
        </div>
      )}
    </SectionFrame>
  )
}

// ---------------------------------------------------------------- evolutions, form changes, breeding

/** The sources of an earlier stage, loaded on demand and listed inline. */
function NestedSources({ from, context }: { from: [number, number]; context: Context }) {
  const t = useT()
  const { dex, game, target, trail, depth, onLog, onOpenSpecies } = context
  const species = dex.species(from[0])
  const form = dex.form(from[0], from[1])
  const detail = useSpeciesDetailRetry(species ? species.id : null)
  const sources = useMemo(() => (detail.data && form ? sourcesByGame(dex, detail.data, form).find((s) => s.game.id === game.id) : undefined), [dex, detail.data, form, game.id])

  if (!species || !form) return null
  const fullName = formFullName(species, form)
  if (detail.loading) {
    return (
      <div className="sp-nested" aria-busy="true">
        <span className="u-sr-only">{t('species.where.loading', { name: fullName })}</span>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={36} radius={8} />
        ))}
      </div>
    )
  }
  if (!detail.data) {
    return (
      <div className="sp-nested sp-nested--note" role="alert">
        <span>{t('species.source.nested.error', { name: fullName })}</span>
        <Button size="sm" icon="refresh" onClick={detail.retry}>
          {t('species.retry')}
        </Button>
      </div>
    )
  }
  const empty = !sources || (sources.rows.length === 0 && sources.evolve.length === 0 && !sources.breed)
  if (empty) {
    return (
      <div className="sp-nested sp-nested--note">
        <span>{t('species.source.nested.none', { name: fullName, game: gameName(game.id) })}</span>
        <Button size="sm" variant="ghost" iconEnd="arrow-right" onClick={() => onOpenSpecies(species.id, form.f)}>
          {t('species.source.open', { name: fullName })}
        </Button>
      </div>
    )
  }
  return (
    <div className="sp-nested">
      <div className="sp-nested__head">
        <span>{t('species.source.nested.title', { name: fullName, game: gameName(game.id) })}</span>
        <Button size="sm" variant="ghost" iconEnd="arrow-right" onClick={() => onOpenSpecies(species.id, form.f)}>
          {t('species.source.nested.open')}
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
  const t = useT()
  const { dex, game, target, depth, trail, onLog, onOpenSpecies } = context
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const fromSpecies = dex.species(source.from[0])
  const fromForm = dex.form(source.from[0], source.from[1])
  const name = monName(dex, source.from[0], source.from[1])
  const canExpand = depth < MAX_DEPTH && fromSpecies !== undefined && fromForm !== undefined && !trail.includes(`${source.from[0]}-${source.from[1]}`)
  return (
    <li className="sp-evo">
      <div className="sp-evo__row">
        <button type="button" className="sp-evo__mon" aria-label={t('species.source.open', { name })} title={t('species.source.open', { name })} onClick={() => onOpenSpecies(source.from[0], source.from[1])}>
          <Sprite species={source.from[0]} form={source.from[1]} size={44} />
        </button>
        <div className="sp-evo__text">
          <span className="sp-evo__title">{change ? t('species.source.change', { name }) : t('species.source.evolve', { name })}</span>
          <span className="sp-evo__how">{change ? changeText(source.how) : evolutionText(source.how)}</span>
        </div>
        <div className="sp-evo__actions">
          {canExpand && (
            <Button size="sm" variant="ghost" iconEnd={open ? 'chevron-up' : 'chevron-down'} aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen(!open)}>
              {t('species.source.whereFrom', { name, game: gameShortName(game.id) })}
            </Button>
          )}
          {depth === 0 && <LogButton label={t(change ? 'species.source.logChanged' : 'species.source.logEvolved', { name: formFullName(target.species, target.form), from: name, game: gameName(game.id) })} onClick={() => onLog(evolvePreset(target, game, source))} />}
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
  const t = useT()
  const { dex, game, subject, target, onLog, onOpenSpecies } = context
  const parents = useMemo(() => breedParents(dex, subject.detail.family, subject.species.id, subject.form.f, game.id), [dex, subject, game.id])
  const names = parents.map((p) => monName(dex, p.s, p.f))
  const shownNames = names.length > 4 ? [...names.slice(0, 3), t('species.source.breed.more', { count: names.length - 3 })] : names
  const nested = target.origin !== undefined
  return (
    <li className="sp-evo">
      <div className="sp-evo__row">
        <span className="sp-evo__mon sp-evo__mon--egg" aria-hidden="true">
          <Icon name="egg" size={22} />
        </span>
        <div className="sp-evo__text">
          <span className="sp-evo__title">{t('species.source.breed.title')}</span>
          <span className="sp-evo__how">{names.length > 0 ? t('species.source.breed.parents', { parents: joinOr(shownNames) }) : t('species.source.breed.family')}</span>
        </div>
        <div className="sp-evo__actions">
          {parents.length > 0 && (
            <span className="sp-evo__parents">
              {parents.slice(0, 4).map((p, i) => (
                <button key={`${p.s}-${p.f}`} type="button" className="sp-evo__parent" aria-label={t('species.source.open', { name: names[i] ?? '' })} title={names[i]} onClick={() => onOpenSpecies(p.s, p.f)}>
                  <Sprite species={p.s} form={p.f} size={30} />
                </button>
              ))}
            </span>
          )}
          <LogButton label={t(nested ? 'species.source.logHatchedAs' : 'species.source.logHatched', { name: formFullName(target.species, target.form), origin: formFullName(subject.species, subject.form), game: gameName(game.id) })} onClick={() => onLog(breedPreset(target, game))} />
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
  const t = useT()
  const context: Context = { ...rest, depth, trail, eventsOpen }
  const { subject, dex } = context
  const view = useMemo(() => buildSourceView(subject.detail, sources, subject.species.id), [subject.detail, sources, subject.species.id])
  const needle = normalizeText(query)
  const searching = needle !== ''
  const wants = (id: SectionId): boolean => !only || only.size === 0 || only.has(id)
  const matchesEvolve = (source: EvolveSource): boolean => {
    if (!searching) return true
    // Found by the name and the text shown, and by their English originals.
    const english = dex.form(source.from[0], source.from[1])?.full ?? dex.species(source.from[0])?.name ?? ''
    const shown = english === '' ? '' : monName(dex, source.from[0], source.from[1])
    return normalizeText([...new Set([shown, evolutionText(source.how), english, source.how])].join(' ')).includes(needle)
  }

  // "hatch from an egg breed", and the same in English when another language is shown.
  const breedWords = (): string => {
    const shown = normalizeText(`${t('species.source.breed.title')} ${SECTION_INFO.breed.title}`)
    return activeLanguage() === 'en' ? shown : `${shown} hatch from an egg breed`
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
      if (!view.breed || (searching && !breedWords().includes(needle))) continue
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
