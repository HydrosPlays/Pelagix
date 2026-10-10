import { useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react'
import type { FormSummary, SpeciesSummary } from '@shared/dex-types'
import { GAME_BY_ID, SYSTEM_BY_ID, type GameDef } from '@shared/games'
import type { CatchEntry } from '@shared/save-types'
import { GameIcon, SystemIcon } from '@renderer/components/pokemon'
import { Button, Chip, cx, EmptyState, Icon, Skeleton, Switch, Tag, TextField } from '@renderer/components/ui'
import { sourcesByGame, type GameSources, type SourcePreset } from '@renderer/domain/encounters'
import { useT, type MessageKey } from '@renderer/i18n'
import { formFullName, gameName, gameShortName } from '@renderer/i18n/terms'
import type { Dex } from '@renderer/lib/data'
import { errorMessage } from '@renderer/lib/format'
import { useSaveStore } from '@renderer/store/save'
import { rovingRadioKeyDown, type DetailState } from './hooks'
import { SourceList, type SourceSubject } from './SourceList'
import {
  buildSourceView,
  defaultGameId,
  gameOverview,
  gameState,
  isBattleOnly,
  manualPreset,
  overviewSummary,
  SECTION_INFO,
  type GameState,
  type LogTarget,
  type SectionId,
  type SourceView,
  type ViewChoices
} from './sources'

/** The game picked last, for the rest of the session: moving to another Pokémon keeps showing it. */
let rememberedGame: string | null = null

const STATE_TEXT: Readonly<Record<GameState, MessageKey>> = {
  obtainable: 'species.where.state.obtainable',
  event: 'species.where.state.event',
  transfer: 'species.where.state.transfer',
  absent: 'species.where.state.absent'
}

export interface WhereToFindProps {
  dex: Dex
  species: SpeciesSummary
  form: FormSummary
  detail: DetailState
  /** The user's entries of this species (all forms). */
  entries: readonly CatchEntry[]
  view: ViewChoices
  onLog: (preset: SourcePreset) => void
  onOpenSpecies: (species: number, form: number) => void
  headingRef?: Ref<HTMLHeadingElement>
}

function StateTag({ state, battleOnly }: { state: GameState; battleOnly: boolean }) {
  const t = useT()
  if (state === 'transfer' && battleOnly) return <Tag variant="outline">{t('species.where.state.battle')}</Tag>
  if (state === 'obtainable') return <Tag tone="success">{t(STATE_TEXT.obtainable)}</Tag>
  if (state === 'event') {
    return (
      <Tag tone="gold" icon="star">
        {t(STATE_TEXT.event)}
      </Tag>
    )
  }
  return <Tag variant="outline">{t(STATE_TEXT[state])}</Tag>
}

function GameItem({ game, state, battleOnly, selected, logged, onPick }: { game: GameDef; state: GameState; battleOnly: boolean; selected: boolean; logged: boolean; onPick: () => void }) {
  const t = useT()
  const stateText = state === 'transfer' && battleOnly ? t('species.where.state.battle') : t(STATE_TEXT[state])
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={t(logged ? 'species.where.game.optionLogged' : 'species.where.game.option', { game: gameName(game.id), state: stateText })}
      tabIndex={selected ? 0 : -1}
      className={cx('sp-game', `sp-game--${state}`, selected && 'is-selected')}
      onClick={onPick}
    >
      <GameIcon game={game} size={24} tooltip={false} alt="" />
      <span className="sp-game__name">{gameShortName(game.id)}</span>
      {state === 'event' && (
        <span className="sp-game__state sp-game__state--event">
          <Icon name="star" size={11} />
          {t('species.where.state.event')}
        </span>
      )}
      {(state === 'transfer' || state === 'absent') && <span className="sp-game__state">{state === 'absent' ? t('species.where.state.absentShort') : stateText}</span>}
      {logged && (
        <span className="sp-game__logged" title={t('species.where.game.logged')}>
          <Icon name="check" size={12} strokeWidth={2.6} />
        </span>
      )}
    </button>
  )
}

/** Explains a game where the form cannot be obtained and offers the ones where it can. */
function Elsewhere({ dex, species, form, game, state, onPick }: { dex: Dex; species: SpeciesSummary; form: FormSummary; game: GameDef | null; state: GameState | null; onPick: (id: string) => void }) {
  const t = useT()
  const obtainable = dex.obtainableGames(form)
  const events = dex.eventGames(form)
  const battleOnly = isBattleOnly(form)
  const name = formFullName(species, form)
  let lead: string
  if (battleOnly) lead = t('species.where.else.battle', { name })
  else if (!game || state === null) lead = t('species.where.else.noSource', { name })
  else if (state === 'transfer') lead = t('species.where.else.transfer', { name, game: gameName(game.id) })
  else lead = t('species.where.else.absent', { name, game: gameName(game.id) })

  return (
    <div className="sp-else">
      <div className="sp-else__lead">
        <span className="sp-else__icon" aria-hidden="true">
          <Icon name={battleOnly ? 'bolt' : 'swap'} size={18} />
        </span>
        <p>{lead}</p>
      </div>
      {obtainable.length > 0 && (
        <div className="sp-else__group">
          <div className="u-eyebrow">{t('species.where.else.obtainable')}</div>
          <div className="sp-else__games">
            {obtainable.map((g) => (
              <Chip key={g.id} icon={<GameIcon game={g} size={16} tooltip={false} alt="" />} onClick={() => onPick(g.id)}>
                {gameShortName(g.id)}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {events.length > 0 && (
        <div className="sp-else__group">
          <div className="u-eyebrow">{t('species.where.else.event')}</div>
          <div className="sp-else__games">
            {events.map((g) => (
              <Chip key={g.id} tone="gold" icon={<GameIcon game={g} size={16} tooltip={false} alt="" />} onClick={() => onPick(g.id)}>
                {gameShortName(g.id)}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {obtainable.length === 0 && events.length === 0 && !battleOnly && <p className="sp-else__note">{t('species.where.else.onlyTransfer')}</p>}
      {battleOnly && <p className="sp-else__note">{t('species.where.else.battleNote')}</p>}
    </div>
  )
}

interface PaneProps {
  dex: Dex
  game: GameDef
  subject: SourceSubject
  target: LogTarget
  view: SourceView
  sources: Pick<GameSources, 'rows' | 'evolve' | 'breed'>
  eventOnly: boolean
  onLog: (preset: SourcePreset) => void
  onOpenSpecies: (species: number, form: number) => void
}

/** Filter bar + the source list of the picked game. Keyed by form and game, so its state starts fresh for each. */
function SourcesPane({ dex, game, subject, target, view, sources, eventOnly, onLog, onOpenSpecies }: PaneProps) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [only, setOnly] = useState<ReadonlySet<SectionId>>(new Set())
  const showFilter = view.total >= 8
  const counts = useMemo(() => {
    const map = new Map<SectionId, number>()
    for (const section of view.sections) map.set(section.id, section.count)
    if (view.evolve.length > 0) map.set('evolve', view.evolve.length)
    if (view.change.length > 0) map.set('change', view.change.length)
    if (view.breed) map.set('breed', 1)
    return map
  }, [view])

  const toggle = (id: SectionId): void => {
    const next = new Set(only)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setOnly(next)
  }
  const clear = (): void => {
    setQuery('')
    setOnly(new Set())
  }

  return (
    <>
      {showFilter && (
        <div className="sp-filter">
          <TextField value={query} onChange={setQuery} size="sm" icon="search" placeholder={t('species.where.filter.placeholder')} aria-label={t('species.where.filter.label', { game: gameName(game.id) })} clearable wrapperClassName="sp-filter__box" />
          {view.present.length > 1 && (
            <div className="sp-filter__chips" role="group" aria-label={t('species.where.filter.only')}>
              {view.present.map((id) => (
                <Chip key={id} size="sm" selected={only.has(id)} onClick={() => toggle(id)}>
                  {SECTION_INFO[id].chip} {counts.get(id) ?? 0}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}
      <SourceList
        dex={dex}
        game={game}
        subject={subject}
        sources={sources}
        target={target}
        query={query}
        only={only}
        eventsOpen={eventOnly}
        onLog={onLog}
        onOpenSpecies={onOpenSpecies}
        emptyState={
          <div className="sp-nomatch">
            <p>{query.trim() !== '' ? t('species.where.filter.noMatch', { query: query.trim() }) : t('species.where.filter.noMatchFilter')}</p>
            <Button size="sm" onClick={clear}>
              {t('species.where.filter.clear')}
            </Button>
          </div>
        }
      />
    </>
  )
}

/**
 * The centrepiece of the Pokémon page: pick a game, see every way it offers the selected form,
 * and log a catch straight from the way you got it.
 */
export function WhereToFind({ dex, species, form, detail, entries, view, onLog, onOpenSpecies, headingRef }: WhereToFindProps) {
  const t = useT()
  const fullName = formFullName(species, form)
  const [userPick, setUserPick] = useState<string | null>(null)
  const [showAbsent, setShowAbsent] = useState(false)

  const overview = useMemo(() => gameOverview(dex, form), [dex, form])
  // Decided once per form: a catch logged a moment ago must not move the selection.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fallback = useMemo(() => defaultGameId(dex, form, rememberedGame, useSaveStore.getState().save.entries), [dex, form])
  const gameId = userPick ?? fallback
  const game = gameId !== null ? (GAME_BY_ID.get(gameId) ?? null) : null
  const state = game ? gameState(dex, form, game.id) : null

  const logged = useMemo(() => new Set(entries.filter((e) => e.form === form.f).map((e) => e.game)), [entries, form.f])
  const allSources = useMemo(() => (detail.data ? sourcesByGame(dex, detail.data, form) : null), [dex, detail.data, form])
  const sources = game && allSources ? allSources.find((s) => s.game.id === game.id) : undefined
  const sourceView = useMemo(() => (detail.data && sources ? buildSourceView(detail.data, sources, species.id) : null), [detail.data, sources, species.id])
  const subject = useMemo<SourceSubject | null>(() => (detail.data ? { species, form, detail: detail.data } : null), [species, form, detail.data])
  const target = useMemo<LogTarget>(() => ({ species, form, view }), [species, form, view])

  const pick = (id: string): void => {
    rememberedGame = id
    setUserPick(id)
  }

  // The picked game is kept in view inside the list (it may start far down, or be picked from a chip).
  // Only the list itself is scrolled; `scrollIntoView` would move the page as well.
  const listRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const list = listRef.current
    const selected = list?.querySelector<HTMLElement>('.sp-game.is-selected')
    if (!list || !selected) return
    const frame = list.getBoundingClientRect()
    const item = selected.getBoundingClientRect()
    if (item.top < frame.top + 30 || item.bottom > frame.bottom - 8) list.scrollTop += item.top + item.height / 2 - (frame.top + frame.height / 2)
  }, [gameId, showAbsent, form.f])

  const system = game ? SYSTEM_BY_ID.get(game.system) : undefined
  const battleOnly = isBattleOnly(form)
  const hasSources = state === 'obtainable' || state === 'event'

  let body: ReactNode
  if (!hasSources) {
    body = <Elsewhere dex={dex} species={species} form={form} game={game} state={state} onPick={pick} />
  } else if (detail.error) {
    body = (
      <EmptyState
        size="sm"
        tone="danger"
        icon="warning"
        title={t('species.where.error.title')}
        description={errorMessage(detail.error, t('species.where.error.description'))}
        action={
          <Button size="sm" icon="refresh" onClick={detail.retry}>
            {t('species.retry')}
          </Button>
        }
      />
    )
  } else if (!detail.data || !subject) {
    body = (
      <div className="sp-loading" aria-busy="true">
        <span className="u-sr-only">{t('species.where.loading', { name: fullName })}</span>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} height={38} radius={8} />
        ))}
      </div>
    )
  } else if (!game || !sources || !sourceView || sourceView.total === 0) {
    body = (
      <div className="sp-else">
        <div className="sp-else__lead">
          <span className="sp-else__icon" aria-hidden="true">
            <Icon name="info" size={18} />
          </span>
          <p>{game ? t('species.where.noDetails', { name: fullName, game: gameName(game.id) }) : t('species.where.noDetailsNoGame', { name: fullName })}</p>
        </div>
      </div>
    )
  } else {
    body = <SourcesPane key={`${form.f}:${game.id}`} dex={dex} game={game} subject={subject} target={target} view={sourceView} sources={sources} eventOnly={state === 'event'} onLog={onLog} onOpenSpecies={onOpenSpecies} />
  }

  const visibleGroups = overview.groups
    .map((group) => ({ label: group.label, games: group.games.filter((g) => showAbsent || g.state !== 'absent' || g.game.id === gameId) }))
    .filter((group) => group.games.length > 0)

  return (
    <section className="section sp-where" aria-labelledby="sp-where-title">
      <div className="section-header sp-where__header">
        <div>
          <h2 id="sp-where-title" ref={headingRef} tabIndex={-1} className="section-title">
            {form.cat === 'base' ? t('species.where.title') : t('species.where.titleForm', { name: fullName })}
          </h2>
          <p className="sp-where__summary">{overviewSummary(overview.counts, battleOnly)}</p>
        </div>
        <Button icon="edit" onClick={() => onLog(manualPreset(target, game, state))}>
          {t('species.where.logManually')}
        </Button>
      </div>

      <div className="sp-where__layout">
        <div className="sp-games">
          <div ref={listRef} className="sp-games__list" role="radiogroup" aria-label={t('pokedex.game.label')} onKeyDown={rovingRadioKeyDown}>
            {visibleGroups.length === 0 && <p className="sp-games__none">{t('species.where.noGames')}</p>}
            {visibleGroups.map((group) => (
              <div key={group.label} className="sp-games__group" role="presentation">
                <div className="sp-games__label">{group.label}</div>
                {group.games.map(({ game: g, state: s }) => (
                  <GameItem key={g.id} game={g} state={s} battleOnly={battleOnly} selected={g.id === gameId} logged={logged.has(g.id)} onPick={() => pick(g.id)} />
                ))}
              </div>
            ))}
          </div>
          {overview.counts.absent > 0 && (
            <div className="sp-games__foot">
              <Switch checked={showAbsent} onChange={setShowAbsent} label={t('species.where.showUnavailable')} />
            </div>
          )}
        </div>

        <div className="sp-pane">
          {game && state !== null && (
            <header className="sp-pane__head">
              <GameIcon game={game} size={40} tooltip={false} alt="" />
              <div className="sp-pane__title">
                <h3 className="sp-pane__name">{gameName(game.id)}</h3>
                <div className="sp-pane__meta">
                  {system && (
                    <>
                      <SystemIcon system={system.id} size={14} label="" />
                      <span>{system.name}</span>
                      <span aria-hidden="true">·</span>
                    </>
                  )}
                  <span>{game.year}</span>
                </div>
              </div>
              <StateTag state={state} battleOnly={battleOnly} />
            </header>
          )}
          {body}
        </div>
      </div>
    </section>
  )
}
