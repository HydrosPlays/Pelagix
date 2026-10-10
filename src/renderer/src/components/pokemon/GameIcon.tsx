import { useState, type CSSProperties } from 'react'
import { GAME_BY_ID, SYSTEM_BY_ID, type GameDef } from '@shared/games'
import { t } from '@renderer/i18n'
import { gameName, gameShortName } from '@renderer/i18n/terms'
import { gameIconUrl } from '@renderer/lib/assets'
import { cx } from '../ui/cx'
import { Tooltip } from '../ui/Tooltip'
import { SystemIcon } from './SystemIcon'
import './GameIcon.css'

/** Accepts a game definition or a saved game id (which may be unknown to this build). */
export type GameRef = GameDef | string

export function resolveGame(game: GameRef): GameDef | undefined {
  return typeof game === 'string' ? GAME_BY_ID.get(game) : game
}

export interface GameIconProps {
  game: GameRef
  /** Square size in px. Default 32. */
  size?: number
  /** Tooltip with the game's name. Default true. */
  tooltip?: boolean
  /** Alt text. Default: the game's name; pass "" when the name is printed next to it. */
  alt?: string
  className?: string
}

/** A game's icon in a rounded-square mask; falls back to a coloured tile with the short name. */
export function GameIcon({ game, size = 32, tooltip = true, alt, className }: GameIconProps) {
  const def = resolveGame(game)
  const [failed, setFailed] = useState(false)
  const name = def ? gameName(def.id) : typeof game === 'string' ? game : t('components.game.unknown')
  const short = def ? gameShortName(def.id) : '?'
  const label = alt ?? name
  const style = { width: size, height: size, '--game-color': def?.color } as CSSProperties

  const icon =
    def && !failed ? (
      <span className={cx('pk-game', className)} style={style}>
        <img src={gameIconUrl(def)} alt={label} width={size} height={size} loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)} />
      </span>
    ) : (
      <span className={cx('pk-game', 'pk-game--fallback', className)} style={style} role={label === '' ? undefined : 'img'} aria-label={label === '' ? undefined : label}>
        <span style={{ fontSize: Math.max(8, Math.round(size * (short.length > 6 ? 0.2 : short.length > 3 ? 0.26 : 0.36))) }}>{short}</span>
      </span>
    )

  return tooltip ? <Tooltip content={name}>{icon}</Tooltip> : icon
}

export interface GameBadgeProps {
  game: GameRef
  /** sm: 20 px icon, one line. md (default): 28 px icon. lg: 36 px icon with the system on a second line. */
  size?: 'sm' | 'md' | 'lg'
  /** Show the console glyph. Default true. */
  system?: boolean
  /** Print the short name ("Scarlet") instead of the full one. Default true for sm. */
  short?: boolean
  /** Icons only; the name becomes a tooltip. */
  compact?: boolean
  className?: string
}

const BADGE_ICON: Record<NonNullable<GameBadgeProps['size']>, number> = { sm: 20, md: 28, lg: 36 }

/** The standard way to show where an entry comes from: console glyph + game icon + game name. */
export function GameBadge({ game, size = 'md', system = true, short, compact = false, className }: GameBadgeProps) {
  const def = resolveGame(game)
  const name = def ? ((short ?? size === 'sm') ? gameShortName(def.id) : gameName(def.id)) : typeof game === 'string' ? game : t('components.game.unknown')
  const sys = def ? SYSTEM_BY_ID.get(def.system) : undefined
  const glyph = system && def ? <SystemIcon system={def.system} size={size === 'lg' ? 16 : size === 'sm' ? 14 : 16} label={compact ? undefined : ''} /> : null

  if (compact) {
    return (
      <span className={cx('pk-gamebadge', 'pk-gamebadge--compact', `pk-gamebadge--${size}`, className)}>
        {glyph && <span className="pk-gamebadge__system">{glyph}</span>}
        <GameIcon game={game} size={BADGE_ICON[size]} />
      </span>
    )
  }
  return (
    <span className={cx('pk-gamebadge', `pk-gamebadge--${size}`, className)}>
      {size !== 'lg' && glyph && (
        <span className="pk-gamebadge__system" title={sys?.name}>
          {glyph}
          <span className="u-sr-only">{sys?.name}</span>
        </span>
      )}
      <GameIcon game={game} size={BADGE_ICON[size]} tooltip={false} alt="" />
      <span className="pk-gamebadge__text">
        <span className="pk-gamebadge__name">{name}</span>
        {size === 'lg' && sys && (
          <span className="pk-gamebadge__sub">
            {glyph}
            {sys.name}
          </span>
        )}
      </span>
    </span>
  )
}
