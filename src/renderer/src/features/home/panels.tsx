import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'wouter'
import { BallIcon, EntryCard, GameIcon, ShinyMark, SystemIcon, TYPE_NAMES, typeColor } from '@renderer/components/pokemon'
import { Chip, Icon, Panel, Tooltip, cx } from '@renderer/components/ui'
import type { Progress } from '@renderer/domain/progress'
import { burst } from '@renderer/lib/anim'
import { editEntry } from '@renderer/lib/entry-actions'
import { formatCount, formatDate, percent, plural, pluralWord, ratio, todayIso } from '@renderer/lib/format'
import { paths } from '@renderer/shell/router'
import { useUiStore } from '@renderer/store/ui'
import { SYSTEM_BY_ID } from '@shared/games'
import { coveredTypes, daysText, monthRangeText, recentMonths, regionOfGeneration, roman, timelineSummary, usedBalls, usedGames, usedSystems } from './home-model'
import { growIn, useRevealOnce } from './motion'
import { Meter, MoreLink, StatTile } from './parts'

/** Slides a panel's bars in the first time it is on screen. */
function useBars(axis: 'x' | 'y', selector: string) {
  const ref = useRef<HTMLDivElement>(null)
  useRevealOnce(ref, (panel) => growIn(panel.querySelectorAll(selector), axis, { delay: 140 }))
  return ref
}

// ---------------------------------------------------------------- generations

/** Nine rows, one per generation; each opens the Pokédex narrowed to that generation. */
export function GenerationPanel({ progress, className }: { progress: Progress; className?: string }) {
  const ref = useBars('x', '.home-meter__grow')
  return (
    <Panel ref={ref} className={cx('home-gens', className)} title="Generation progress" eyebrow="Region by region" actions={<MoreLink href={paths.dex()}>Pokédex</MoreLink>}>
      <ol className="home-gens__list">
        {progress.byGeneration.map((g) => {
          const region = regionOfGeneration(g.gen)
          const done = g.slots > 0 && g.caught >= g.slots
          return (
            <li key={g.gen}>
              <Link href={`${paths.dex()}?gen=${g.gen}`} className={cx('home-gen', done && 'is-complete')} aria-label={`${region}, ${g.name}: ${formatCount(g.caught)} of ${formatCount(g.slots)} caught (${percent(g.caught, g.slots)}). Show this generation in the Pokédex`}>
                <span className="home-gen__numeral" aria-hidden="true">
                  {roman(g.gen)}
                </span>
                <span className="home-gen__name">
                  <span className="home-gen__region">{region}</span>
                  <span className="home-gen__sub">{g.name}</span>
                </span>
                <Meter value={ratio(g.caught, g.slots)} tone={done ? 'gold' : 'accent'} className="home-gen__meter" />
                <span className="home-gen__count">
                  <b>{formatCount(g.caught)}</b> / {formatCount(g.slots)}
                </span>
                <span className="home-gen__pct">{done ? <Icon name="check" size={16} /> : percent(g.caught, g.slots, 0)}</span>
              </Link>
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}

// ---------------------------------------------------------------- recent catches

const RECENT_SHOWN = 7
const HIGHLIGHT_MS = 4200

/** The newest entries. A catch logged a moment ago is ringed in gold and gets a burst of sparkles. */
export function RecentPanel({ progress, className }: { progress: Progress; className?: string }) {
  const recent = progress.recent.slice(0, RECENT_SHOWN)
  const lastCapture = useUiStore((s) => s.lastCapture)
  const [highlight, setHighlight] = useState<string | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const newest = recent[0]?.id

  // Celebrate a just-logged entry once: this page takes the marker so no other page repeats it.
  useEffect(() => {
    if (lastCapture === null || lastCapture !== newest) return
    const id = useUiStore.getState().consumeLastCapture()
    if (id === null) return
    setHighlight(id)
    burst(listRef.current?.querySelector<HTMLElement>('.home-recent__item'), { x: 0.08, distance: 56, count: 12 })
  }, [lastCapture, newest])

  // Its own effect: taking the marker above re-runs that one, which must not cancel this timer.
  useEffect(() => {
    if (highlight === null) return
    const timer = setTimeout(() => setHighlight(null), HIGHLIGHT_MS)
    return () => clearTimeout(timer)
  }, [highlight])

  return (
    <Panel className={cx('home-recent', className)} title="Recent catches" eyebrow={plural(progress.totals.entries, 'entry', 'entries')} actions={<MoreLink href={paths.journal()}>Journal</MoreLink>}>
      <ul ref={listRef} className="home-recent__list">
        {recent.map((entry) => (
          <li key={entry.id} className="home-recent__item">
            <EntryCard variant="compact" entry={entry} highlight={entry.id === highlight} onOpen={(e) => void editEntry(e.id)} />
          </li>
        ))}
      </ul>
      {progress.totals.entries > recent.length && (
        <Link href={paths.journal()} className="home-recent__all">
          See all {formatCount(progress.totals.entries)} entries in the journal
        </Link>
      )}
    </Panel>
  )
}

// ---------------------------------------------------------------- games and systems

const GAMES_SHOWN = 6

/** The games the user has logged from, most used first, and the consoles behind them. */
export function GamesPanel({ progress, className }: { progress: Progress; className?: string }) {
  const ref = useBars('x', '.home-meter__grow')
  const games = useMemo(() => usedGames(progress.byGame), [progress.byGame])
  const systems = useMemo(() => usedSystems(progress.bySystem), [progress.bySystem])
  const top = games[0]?.entries ?? 0
  const shown = games.slice(0, GAMES_SHOWN)
  const hidden = games.slice(GAMES_SHOWN)
  const unknown = progress.counts.unknownGame

  return (
    <Panel ref={ref} className={cx('home-games', className)} title="Your games" eyebrow={games.length === 0 ? 'Where you catch' : `${plural(games.length, 'game')} on ${plural(systems.length, 'system')}`}>
      {games.length === 0 ? (
        <p className="home-note">None of your entries come from a game Pelagix knows yet.</p>
      ) : (
        <ol className="home-games__list">
          {shown.map((g) => {
            const system = SYSTEM_BY_ID.get(g.game.system)
            return (
              <li key={g.game.id} className="home-game">
                <GameIcon game={g.game} size={38} tooltip={false} alt="" />
                <div className="home-game__name">
                  <span className="home-game__title" title={g.game.name}>
                    {g.game.name}
                  </span>
                  <span className="home-game__meta">
                    <SystemIcon system={g.game.system} size={14} label="" />
                    <span>{system?.short ?? g.game.system}</span>
                    <span aria-hidden="true">·</span>
                    <span>{plural(g.species, 'species', 'species')}</span>
                    {g.shiny > 0 && (
                      <span className="home-game__shiny">
                        <ShinyMark size={12} label="" />
                        {formatCount(g.shiny)}
                        <span className="u-sr-only"> shiny</span>
                      </span>
                    )}
                  </span>
                </div>
                <Meter value={ratio(g.entries, top)} label={`Share of entries from ${g.game.name}`} valueText={plural(g.entries, 'entry', 'entries')} className="home-game__meter" />
                <span className="home-game__count">
                  <b>{formatCount(g.entries)}</b>
                  <span>{pluralWord(g.entries, 'entry', 'entries')}</span>
                </span>
              </li>
            )
          })}
        </ol>
      )}

      {hidden.length > 0 && (
        <div className="home-games__more">
          <span className="u-eyebrow">Also</span>
          <span className="home-games__more-icons">
            {hidden.map((g) => (
              <Tooltip key={g.game.id} content={`${g.game.name}: ${plural(g.entries, 'entry', 'entries')}`}>
                <span className="home-games__more-icon">
                  <GameIcon game={g.game} size={26} tooltip={false} alt={`${g.game.name}: ${plural(g.entries, 'entry', 'entries')}`} />
                </span>
              </Tooltip>
            ))}
          </span>
        </div>
      )}

      {systems.length > 0 && (
        <div className="home-systems">
          <span className="u-eyebrow">Systems</span>
          <ul className="home-systems__list">
            {systems.map((s) => (
              <li key={s.system.id}>
                <Chip icon={<SystemIcon system={s.system.id} size={15} label="" />} title={`${s.system.name}: ${plural(s.entries, 'entry', 'entries')} from ${plural(s.games, 'game')}`}>
                  {s.system.short}
                  <span className="home-systems__count">{formatCount(s.entries)}</span>
                </Chip>
              </li>
            ))}
          </ul>
        </div>
      )}

      {unknown > 0 && (
        <p className="home-note">
          {plural(unknown, 'entry comes', 'entries come')} from a game this version of Pelagix does not know. {unknown === 1 ? 'It still counts' : 'They still count'} toward your Living Dex.
        </p>
      )}
    </Panel>
  )
}

// ---------------------------------------------------------------- activity

/** Streaks and a twelve-month bar chart of catches. */
export function ActivityPanel({ progress, className }: { progress: Progress; className?: string }) {
  const ref = useBars('y', '.home-month__grow')
  const months = useMemo(() => recentMonths(progress.byMonth, todayIso()), [progress.byMonth])
  const peak = Math.max(1, ...months.map((m) => m.entries))
  const { streaks } = progress
  const summary = timelineSummary(months)

  return (
    <Panel ref={ref} className={cx('home-activity', className)} title="Activity" eyebrow={monthRangeText(months)}>
      <ul className="home-streaks">
        <StatTile icon="flame" tone={streaks.current > 0 ? 'catch' : 'neutral'} label="Current streak" value={daysText(streaks.current)} note={streaks.caughtToday ? 'Caught today' : streaks.current > 0 ? 'Log one today' : 'Starts with a catch'} />
        <StatTile icon="trophy" tone={streaks.longest > 0 && streaks.longest === streaks.current ? 'gold' : 'neutral'} label="Best streak" value={daysText(streaks.longest)} note={streaks.longest > 0 && streaks.longest === streaks.current ? 'Still going' : streaks.longestEnd ? `Ended ${formatDate(streaks.longestEnd)}` : undefined} />
        <StatTile icon="calendar" label="Days with a catch" value={formatCount(streaks.activeDays)} note={streaks.firstDay ? `Since ${formatDate(streaks.firstDay)}` : undefined} />
      </ul>

      <figure className="home-timeline">
        <ol className="home-timeline__bars" aria-label={`Catches per month, ${monthRangeText(months)}`}>
          {months.map((m) => (
            <li key={m.period} className={cx('home-month', m.current && 'is-current', m.entries === 0 && 'is-empty')}>
              <Tooltip content={m.entries === 0 ? `${m.title}: no catches` : `${m.title}: ${plural(m.entries, 'catch', 'catches')}, ${formatCount(m.newSlots)} new for your Living Dex${m.shiny > 0 ? `, ${formatCount(m.shiny)} shiny` : ''}`}>
                <div className="home-month__column">
                  <span className="home-month__value" aria-hidden="true">
                    {m.entries > 0 ? formatCount(m.entries) : ''}
                  </span>
                  <span className="home-month__track" aria-hidden="true">
                    <span className="home-month__grow" style={{ height: `${m.entries === 0 ? 0 : Math.max(4, (m.entries / peak) * 100)}%` }}>
                      <span className="home-month__fill" />
                    </span>
                  </span>
                  <span className="home-month__label" aria-hidden="true">
                    {m.label}
                  </span>
                  <span className="u-sr-only">
                    {m.title}: {plural(m.entries, 'catch', 'catches')}
                  </span>
                </div>
              </Tooltip>
            </li>
          ))}
        </ol>
        <figcaption className="home-timeline__caption">{summary}</figcaption>
      </figure>
    </Panel>
  )
}

// ---------------------------------------------------------------- types

/** Eighteen small bars in the type colours: how much of each type is caught. */
export function TypesPanel({ progress, className }: { progress: Progress; className?: string }) {
  const ref = useBars('x', '.home-meter__grow')
  const types = useMemo(() => coveredTypes(progress.byType), [progress.byType])
  return (
    <Panel ref={ref} className={cx('home-types', className)} title="Type coverage" eyebrow={plural(types.length, 'type')}>
      <ul className="home-types__list" style={{ '--type-rows': Math.ceil(types.length / 2) } as CSSProperties}>
        {types.map((t) => {
          const name = TYPE_NAMES[t.type] ?? t.type
          return (
            <li key={t.type} className="home-type" title={`${name}: ${formatCount(t.caught)} of ${formatCount(t.slots)} caught (${percent(t.caught, t.slots)})`}>
              <span className="home-type__dot" style={{ background: typeColor(t.type) }} aria-hidden="true" />
              <span className="home-type__name">{name}</span>
              <Meter value={ratio(t.caught, t.slots)} color={typeColor(t.type)} size="sm" label={`${name} type`} valueText={`${formatCount(t.caught)} of ${formatCount(t.slots)} caught`} className="home-type__meter" />
              <span className="home-type__count" aria-hidden="true">
                <b>{formatCount(t.caught)}</b>/{formatCount(t.slots)}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="home-note home-types__note">A Pokémon with two types counts toward both.</p>
    </Panel>
  )
}

// ---------------------------------------------------------------- balls

/** Every ball the user has caught with, most used first. */
export function BallsPanel({ progress, className }: { progress: Progress; className?: string }) {
  const balls = useMemo(() => usedBalls(progress.byBall), [progress.byBall])
  const favourite = balls[0]
  const withBall = progress.totals.entries - progress.counts.noBall
  const noBall = progress.counts.noBall

  return (
    <Panel className={cx('home-balls', className)} title="Balls used" eyebrow={balls.length === 0 ? 'What you catch with' : `${plural(balls.length, 'kind')} of ball`}>
      {favourite === undefined ? (
        <p className="home-note">No balls recorded yet. Pick the ball when you log a catch and it shows up here.</p>
      ) : (
        <div className="home-balls__body">
          <div className="home-balls__favourite">
            <BallIcon ball={favourite.ball} size={52} label="" />
            <div>
              <div className="u-eyebrow">Favourite</div>
              <div className="home-balls__favourite-name">{favourite.ball.name}</div>
              <div className="home-balls__favourite-share">
                {formatCount(favourite.entries)} of {plural(withBall, 'catch', 'catches')} ({percent(favourite.entries, withBall, 0)})
              </div>
            </div>
          </div>
          <ul className="home-balls__list">
            {balls.map((b) => (
              <li key={b.ball.id}>
                <Tooltip content={`${b.ball.name}: ${plural(b.entries, 'catch', 'catches')}${b.shiny > 0 ? `, ${formatCount(b.shiny)} shiny` : ''}`}>
                  <span className="home-ball">
                    <BallIcon ball={b.ball} size={26} label="" />
                    <span className="home-ball__count" aria-hidden="true">
                      {formatCount(b.entries)}
                    </span>
                    <span className="u-sr-only">
                      {b.ball.name}: {plural(b.entries, 'catch', 'catches')}
                    </span>
                  </span>
                </Tooltip>
              </li>
            ))}
          </ul>
        </div>
      )}
      {noBall > 0 && favourite !== undefined && (
        <p className="home-note">
          {plural(noBall, 'entry has', 'entries have')} no ball recorded.
        </p>
      )}
    </Panel>
  )
}
