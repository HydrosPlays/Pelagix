import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { BALL_BY_ID } from '@shared/balls'
import { GAME_BY_ID, SYSTEM_BY_ID } from '@shared/games'
import type { CatchEntry, EntryKind } from '@shared/save-types'
import { describeEntry, type EntryView } from '@renderer/domain/entries'
import { entryDay } from '@renderer/domain/progress'
import { popIn } from '@renderer/lib/anim'
import { useDexStore, type Dex } from '@renderer/lib/data'
import { entryMenuItems, entryMethodText, entryOriginText, entrySummary, type EntryMenuOptions } from '@renderer/lib/entry-actions'
import { dexNo, entryValues, formatDate } from '@renderer/lib/format'
import { speciesSpritePath } from '@renderer/lib/sprites'
import { Tag } from '../ui/Chip'
import { cx } from '../ui/cx'
import { Icon, type IconName } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { Menu } from '../ui/Menu'
import { Tooltip } from '../ui/Tooltip'
import { BallIcon } from './BallIcon'
import { GameBadge, GameIcon } from './GameIcon'
import { GenderIcon, ShinyMark } from './Marks'
import { Sprite } from './Sprite'
import './EntryCard.css'

export type EntryCardVariant = 'card' | 'row' | 'compact'

export interface EntryCardProps {
  entry: CatchEntry
  /**
   * card (default): the rich card, for grids and the Pokémon page.
   * row: one dense line whose columns line up across rows, for long lists. Needs a parent that gives it a width.
   * compact: render, game icon, ball and date, for drawers, tooltips and the dashboard.
   */
  variant?: EntryCardVariant
  /** Print the Pokémon's name. Default true; false when the surrounding page already says which Pokémon it is. */
  showSpecies?: boolean
  /** Show the entry menu (Open Pokédex page, Edit, Duplicate, Delete). Default true; never shown in `compact`. */
  actions?: boolean
  /** Options for that menu. "Open Pokédex page" is left out by default when `showSpecies` is false. */
  menu?: EntryMenuOptions
  /** Makes the whole card activatable (click, Enter, Space). */
  onOpen?: (entry: CatchEntry) => void
  /** Accessible name of that activation. Default "Open entry: <Pokémon> · <game>". */
  openLabel?: string
  /** A just-added entry: gold ring, and the card pops in once each time this turns true. */
  highlight?: boolean
  className?: string
}

/** Sizes worth knowing when laying entries out (virtual lists, skeletons). All in CSS px. */
export const ENTRY_CARD_METRICS = {
  /** Fixed height of the `row` variant. */
  rowHeight: 56,
  /** Fixed height of the `compact` variant. */
  compactHeight: 52,
  /** Narrowest comfortable column for the `card` variant in a grid. */
  cardMinWidth: 300
} as const

/** Roughly how large the render is drawn, to pick a thumbnail; the box itself is sized in CSS (`.pk-entry__art`). */
const SPRITE_PX: Readonly<Record<EntryCardVariant, number>> = { card: 84, row: 40, compact: 40 }

/** Glyph of the "how" line when the entry has no location to pin. */
const KIND_ICONS: Readonly<Partial<Record<EntryKind, IconName>>> = {
  gift: 'gift',
  egg: 'egg',
  bred: 'egg',
  trade: 'swap',
  transfer: 'swap',
  evolved: 'evolve',
  event: 'star'
}

/** The entry with every reference resolved; works without the dataset too (names fall back to the dex number). */
function resolveView(dex: Dex | null, entry: CatchEntry): EntryView {
  if (dex) return describeEntry(dex, entry)
  const game = GAME_BY_ID.get(entry.game)
  const name = `Pokémon #${entry.species}`
  return {
    entry,
    species: undefined,
    form: undefined,
    variant: undefined,
    name,
    title: entry.nickname ?? name,
    game,
    system: game ? SYSTEM_BY_ID.get(game.system) : undefined,
    ball: entry.ball === undefined ? undefined : BALL_BY_ID.get(entry.ball),
    sprite: { path: speciesSpritePath(entry.species, entry.shiny), shinyApplied: entry.shiny, femaleApplied: false, approx: true },
    day: entryDay(entry)
  }
}

interface WhereLines {
  icon: IconName
  primary?: string
  secondary?: string
}

/** Where and how it was obtained, as a headline and a detail line. Either may be missing. */
function whereLines(entry: CatchEntry, origin: string | undefined): WhereLines {
  const bareEvolved = entry.kind === 'evolved' && (entry.method === undefined || entry.method.trim() === '')
  const method = origin !== undefined && bareEvolved ? undefined : entryMethodText(entry)
  const how = (entry.kind === 'evolved' ? [origin, method] : [method, origin]).filter((text): text is string => text !== undefined)
  if (entry.location !== undefined && entry.location !== '') return { icon: 'map-pin', primary: entry.location, secondary: how.length > 0 ? how.join(' · ') : undefined }
  return { icon: KIND_ICONS[entry.kind] ?? 'pokeball', primary: how[0], secondary: how[1] }
}

const clip = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

/** Placeholder that keeps a column's rhythm when a row has nothing to show there. */
const Blank = (): ReactNode => (
  <span className="pk-entry__blank" aria-hidden="true">
    –
  </span>
)

/** Origin of the entry: console glyph, game icon, game name; a neutral tile and "Unknown game" for ids this build does not know. */
function EntryGame({ view, size, short }: { view: EntryView; size: 'sm' | 'md'; short?: boolean }) {
  if (view.game) return <GameBadge game={view.game} size={size} short={short} />
  const tile = size === 'sm' ? 20 : 28
  return (
    <span className={cx('pk-gamebadge', `pk-gamebadge--${size}`)} title={`Saved as “${view.entry.game}”`}>
      <span className="pk-gamebadge__system">
        <Icon name="help" size={size === 'sm' ? 14 : 16} />
      </span>
      <span className="pk-entry__nogame" style={{ width: tile, height: tile }} aria-hidden="true">
        ?
      </span>
      <span className="pk-gamebadge__text">
        <span className="pk-gamebadge__name">Unknown game</span>
      </span>
    </span>
  )
}

/**
 * THE way a logged entry is shown, anywhere in the app. Carries everything the user logged: the
 * HOME render (shiny, female, variant and Gigantamax renders as applicable), name and form, shiny
 * and gender marks, console + game, location and method, ball, level, date, and when present the
 * nickname, OT, what it evolved from, Alpha / G-Max marks and notes. Missing data is left out.
 */
export function EntryCard({ entry, variant = 'card', showSpecies = true, actions = true, menu, onOpen, openLabel, highlight = false, className }: EntryCardProps) {
  const dex = useDexStore((s) => s.dex)
  const view = useMemo(() => resolveView(dex, entry), [dex, entry])
  const rootRef = useRef<HTMLElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (highlight) popIn(rootRef.current, { from: variant === 'compact' ? 0.82 : 0.9 })
  }, [highlight, variant])

  const summary = entrySummary(dex, entry)
  const origin = entryOriginText(dex, entry)
  const where = whereLines(entry, origin)
  const gender = entry.gender ?? view.form?.gender
  const nickname = entry.nickname !== undefined && entry.nickname !== '' ? entry.nickname : undefined
  const notes = entry.notes !== undefined && entry.notes.trim() !== '' ? entry.notes.trim() : undefined
  const values = entryValues(entry)
  const date = formatDate(view.day)
  const dateTitle = `${entry.date !== undefined ? 'Caught' : 'Logged'} ${formatDate(view.day, 'long')}`
  const withMenu = actions && variant !== 'compact'
  // On a page about one Pokémon the name is implied, but the form that was caught still has to show.
  const formLabel = !showSpecies && (entry.form !== 0 || view.variant !== undefined || (entry.gmax === true && view.form?.gmax !== undefined)) ? view.name : undefined

  // A Pokémon the loaded data does not know has no render at the pinned sprite commit either:
  // the placeholder is drawn straight away instead of asking for an image that cannot exist.
  const unknownSpecies = dex !== null && view.species === undefined
  const sprite = unknownSpecies ? <Sprite size="fill" /> : <Sprite path={view.sprite.path} size="fill" resolution={SPRITE_PX[variant]} alt={showSpecies ? '' : view.name} />

  const marks = (
    <>
      {entry.shiny && <ShinyMark size={variant === 'card' && showSpecies ? 16 : 14} />}
      <GenderIcon gender={gender} size={variant === 'card' && showSpecies ? 15 : 13} />
    </>
  )

  const tags = (entry.alpha === true || entry.gmax === true) && (
    <>
      {entry.alpha === true && (
        <Tag tone="catch" title="Alpha Pokémon">
          Alpha
        </Tag>
      )}
      {entry.gmax === true && (
        <Tag tone="accent" title="Can Gigantamax">
          G-Max
        </Tag>
      )}
    </>
  )

  // The tooltip wraps a real box (Menu and Tooltip both anchor to their first child, and both wrappers are `display: contents`).
  const kebab = withMenu && (
    <Tooltip content="Entry actions" disabled={menuOpen}>
      <span className="pk-entry__actions" onClick={(event) => event.stopPropagation()}>
        <Menu
          label={`Entry actions: ${summary}`}
          align="end"
          onOpenChange={setMenuOpen}
          trigger={<IconButton className="pk-entry__kebab" icon="more" size="sm" label={`Entry actions: ${summary}`} tooltip={false} />}
          items={entryMenuItems(entry, { ...menu, openSpecies: menu?.openSpecies ?? showSpecies })}
        />
      </span>
    </Tooltip>
  )

  const rootProps = {
    ref: rootRef,
    className: cx('pk-entry', `pk-entry--${variant}`, entry.shiny && 'is-shiny', highlight && 'is-highlight', onOpen && 'is-openable', withMenu && 'has-actions', !showSpecies && 'no-species', className),
    style: (view.game ? { '--entry-tint': view.game.color } : undefined) as CSSProperties | undefined,
    'aria-label': summary,
    onClick: onOpen ? () => onOpen(entry) : undefined
  }
  // A real button under the content makes the card keyboard and screen-reader operable; pointer clicks anywhere on the card bubble to the root.
  const opener = onOpen && <button type="button" className="pk-entry__open" aria-label={openLabel ?? `Open entry: ${summary}`} />

  // The line under the heading: number and nickname, or (without the name) the marks and the form.
  const sub = (withTags: boolean): ReactNode => {
    const showsSomething = showSpecies || entry.shiny || gender !== undefined || formLabel !== undefined || nickname !== undefined || (withTags && tags !== false)
    if (!showsSomething) return null
    return (
      <div className="pk-entry__sub">
        {showSpecies ? <span className="pk-entry__no">{dexNo(entry.species)}</span> : marks}
        {formLabel !== undefined && (
          <span className="pk-entry__form" title={formLabel}>
            {formLabel}
          </span>
        )}
        {nickname !== undefined && (
          <span className="pk-entry__nick" title={`Nickname: ${nickname}`}>
            “{nickname}”
          </span>
        )}
        {withTags && tags}
      </div>
    )
  }

  const title = showSpecies && (
    <div className="pk-entry__title">
      <span className="pk-entry__name" title={view.name}>
        {view.name}
      </span>
      {marks}
    </div>
  )

  // ---------------------------------------------------------------- compact

  if (variant === 'compact') {
    return (
      <article {...rootProps}>
        {opener}
        <span className="pk-entry__art">{sprite}</span>
        <div className="pk-entry__ident">
          {showSpecies ? (
            title
          ) : (
            <div className="pk-entry__title">
              <span className="pk-entry__name">{view.game?.short ?? 'Unknown game'}</span>
              {marks}
            </div>
          )}
          <div className="pk-entry__sub">
            <span title={dateTitle}>{date}</span>
            {formLabel !== undefined && <span className="pk-entry__form">{formLabel}</span>}
            {nickname !== undefined && <span className="pk-entry__nick">“{nickname}”</span>}
          </div>
        </div>
        <span className="pk-entry__origin">
          {view.game ? (
            <GameIcon game={view.game} size={24} />
          ) : (
            <Tooltip content="Unknown game">
              <span className="pk-entry__nogame" style={{ width: 24, height: 24 }} role="img" aria-label="Unknown game">
                ?
              </span>
            </Tooltip>
          )}
          {entry.ball !== undefined && (
            <Tooltip content={view.ball?.name ?? 'Unknown ball'}>
              <BallIcon ball={entry.ball} size={20} />
            </Tooltip>
          )}
        </span>
      </article>
    )
  }

  // ---------------------------------------------------------------- row

  if (variant === 'row') {
    return (
      <article {...rootProps}>
        {opener}
        <div className="pk-entry__cols">
          <span className="pk-entry__art">{sprite}</span>
          {showSpecies && (
            <div className="pk-entry__cell pk-entry__cell--name">
              {title}
              {sub(true)}
            </div>
          )}
          <div className="pk-entry__cell pk-entry__cell--game">
            <EntryGame view={view} size="sm" />
            {!showSpecies && sub(true)}
          </div>
          <div className="pk-entry__cell pk-entry__cell--where">
            {where.primary !== undefined ? (
              <>
                <span className="pk-entry__place" title={where.primary}>
                  {where.primary}
                </span>
                {where.secondary !== undefined && (
                  <span className="pk-entry__how" title={where.secondary}>
                    {where.secondary}
                  </span>
                )}
              </>
            ) : (
              <Blank />
            )}
          </div>
          <div className="pk-entry__cell pk-entry__cell--ball">
            {entry.ball !== undefined ? (
              <span className="pk-entry__ball" title={view.ball?.name ?? 'Unknown ball'}>
                <BallIcon ball={entry.ball} size={20} />
                <span className="pk-entry__ball-name" aria-hidden="true">
                  {view.ball?.name ?? 'Unknown ball'}
                </span>
              </span>
            ) : (
              <Blank />
            )}
          </div>
          <div className="pk-entry__cell pk-entry__cell--level">{entry.level !== undefined ? <span className="pk-entry__level">Lv. {entry.level}</span> : <Blank />}</div>
          <div className="pk-entry__cell pk-entry__cell--date">
            <span className="pk-entry__date" title={dateTitle}>
              {date}
            </span>
            {entry.ot !== undefined && entry.ot !== '' && (
              <span className="pk-entry__how pk-entry__ot" title={`Original Trainer: ${entry.ot}`}>
                OT {entry.ot}
              </span>
            )}
          </div>
          <div className="pk-entry__cell pk-entry__cell--end">
            {(notes !== undefined || values.length > 0) && (
              <Tooltip
                content={
                  <span className="pk-entry__tip">
                    {notes !== undefined && <span>{clip(notes, 320)}</span>}
                    {values.map((v) => (
                      <span key={v.label} className="pk-entry__tip-value">
                        {v.label} {v.text}
                      </span>
                    ))}
                  </span>
                }
                placement="left"
              >
                <span className="pk-entry__noteflag">
                  <Icon name={notes !== undefined ? 'note' : 'chart'} size={15} label={[notes !== undefined ? `Notes: ${clip(notes, 320)}` : '', ...values.map((v) => `${v.label} ${v.text}`)].filter(Boolean).join('. ')} />
                </span>
              </Tooltip>
            )}
            {kebab}
          </div>
        </div>
      </article>
    )
  }

  // ---------------------------------------------------------------- card

  const hasExtras = tags !== false || (entry.ot !== undefined && entry.ot !== '')
  return (
    <article {...rootProps}>
      {opener}
      <div className="pk-entry__head">
        <span className="pk-entry__art">{sprite}</span>
        <div className="pk-entry__ident">
          {title}
          {showSpecies && sub(false)}
          <EntryGame view={view} size="md" />
          {!showSpecies && sub(false)}
        </div>
        {kebab}
      </div>

      {where.primary !== undefined && (
        <div className="pk-entry__where">
          <Icon name={where.icon} size={16} className="pk-entry__where-icon" />
          <div className="pk-entry__where-text">
            <span className="pk-entry__place" title={where.primary}>
              {where.primary}
            </span>
            {where.secondary !== undefined && (
              <span className="pk-entry__how" title={where.secondary}>
                {where.secondary}
              </span>
            )}
          </div>
        </div>
      )}

      {hasExtras && (
        <div className="pk-entry__extras">
          {tags}
          {entry.ot !== undefined && entry.ot !== '' && (
            <span className="pk-entry__ot" title={`Original Trainer: ${entry.ot}`}>
              <Icon name="user" size={14} />
              <span className="pk-entry__ot-label">OT</span>
              <span className="pk-entry__ot-name">{entry.ot}</span>
            </span>
          )}
        </div>
      )}

      {values.length > 0 && (
        <dl className="pk-entry__values">
          {values.map((v) => (
            <div key={v.label} title={v.title}>
              <dt>{v.label}</dt>
              <dd>{v.text}</dd>
            </div>
          ))}
        </dl>
      )}

      {notes !== undefined && <p className="pk-entry__notes">{notes}</p>}

      <div className="pk-entry__foot">
        {entry.ball !== undefined ? (
          <span className="pk-entry__ball">
            <BallIcon ball={entry.ball} size={22} label="" />
            <span className="pk-entry__ball-name">{view.ball?.name ?? 'Unknown ball'}</span>
          </span>
        ) : (
          <span />
        )}
        <span className="pk-entry__meta">
          {entry.level !== undefined && <span className="pk-entry__level">Lv. {entry.level}</span>}
          <span className="pk-entry__date" title={dateTitle}>
            <Icon name="calendar" size={14} />
            {date}
          </span>
        </span>
      </div>
    </article>
  )
}

export interface EntryRowHeaderProps {
  /** Match the rows below: same `showSpecies` and `actions`. */
  showSpecies?: boolean
  actions?: boolean
  className?: string
}

/** Column labels that line up with `<EntryCard variant="row">` (and collapse at the same widths). Decorative. */
export function EntryRowHeader({ showSpecies = true, actions = true, className }: EntryRowHeaderProps) {
  return (
    <div className={cx('pk-entry-head', actions && 'has-actions', !showSpecies && 'no-species', className)} aria-hidden="true">
      <div className="pk-entry__cols">
        <span />
        {showSpecies && <span className="pk-entry__cell--name">Pokémon</span>}
        <span className="pk-entry__cell--game">Game</span>
        <span className="pk-entry__cell--where">Location</span>
        <span className="pk-entry__cell--ball">Ball</span>
        <span className="pk-entry__cell--level">Level</span>
        <span className="pk-entry__cell--date">Date</span>
        <span className="pk-entry__cell--end" />
      </div>
    </div>
  )
}
