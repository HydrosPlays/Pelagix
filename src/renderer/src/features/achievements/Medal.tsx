import { useId, type CSSProperties } from 'react'
import { cx } from '@renderer/components/ui'
import type { AchievementGlyph, AchievementTier } from '@renderer/domain/achievements'
import { GLYPHS, LOCK_GLYPH } from './glyphs'
import './Medal.css'

export interface MedalProps {
  tier: AchievementTier
  glyph: AchievementGlyph
  /** Square size in px. Default 56. */
  size?: number
  /** Not earned yet: drawn dim, with a lock. */
  locked?: boolean
  /** CSS colour of the ring around the glyph (a type or game colour). */
  accent?: string
  /** Accessible name. Without it the medal is decorative. */
  label?: string
  className?: string
}

/** A closed star-like outline: `points` tips at radius `outer`, valleys at `inner`. */
function starPath(cx0: number, cy0: number, outer: readonly number[], inner: number, points: number): string {
  const step = Math.PI / points
  let d = ''
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? (outer[(i / 2) % outer.length] ?? inner) : inner
    const a = -Math.PI / 2 + i * step
    d += `${i === 0 ? 'M' : 'L'}${(cx0 + Math.cos(a) * r).toFixed(2)} ${(cy0 + Math.sin(a) * r).toFixed(2)}`
  }
  return `${d}Z`
}

interface TierArt {
  /** Centre of the body in the 64 px box. */
  cy: number
  /** Outline of the body. */
  body: string
  ribbon: boolean
}

const circlePath = (cy0: number, r: number): string => `M${32 - r} ${cy0}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`

/** One shape per tier: a coin, a hexagon, a twelve-point rosette on a ribbon, a compass star on a ribbon. */
const ART: Readonly<Record<AchievementTier, TierArt>> = {
  bronze: { cy: 32, body: circlePath(32, 25), ribbon: false },
  silver: { cy: 32, body: starPath(32, 32, [27.5], 23.8, 6), ribbon: false },
  gold: { cy: 28.5, body: starPath(32, 28.5, [26], 22.6, 12), ribbon: true },
  platinum: { cy: 28.5, body: starPath(32, 28.5, [28, 24.5], 20.6, 8), ribbon: true }
}

/**
 * An achievement medal: the tier decides the metal and the outline, the glyph says what it is for.
 * Locked medals keep their shape but lose their colour and carry a lock.
 */
export function Medal({ tier, glyph, size = 56, locked = false, accent, label, className }: MedalProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const art = ART[tier]
  const fill = locked ? undefined : `url(#${uid}m)`
  const ring: CSSProperties | undefined = accent ? { stroke: accent } : undefined

  return (
    <svg
      className={cx('ach-medal', `ach-tier--${tier}`, locked && 'is-locked', className)}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {!locked && (
        <defs>
          <linearGradient id={`${uid}m`} x1="12" y1="6" x2="52" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0" className="ach-medal__stop-hi" />
            <stop offset="0.5" className="ach-medal__stop-mid" />
            <stop offset="1" className="ach-medal__stop-lo" />
          </linearGradient>
        </defs>
      )}

      {art.ribbon && (
        <g className="ach-medal__ribbon">
          <path d="M19.5 40h11l-2.6 23-5-4.6-6 4.2z" />
          <path d="M33.5 40h11l2.6 22.6-6-4.2-5 4.6z" />
        </g>
      )}

      <path className="ach-medal__body" d={art.body} fill={fill} />
      <circle className="ach-medal__plate" cx="32" cy={art.cy} r="17" />
      <circle className={cx('ach-medal__ring', accent && 'has-accent')} cx="32" cy={art.cy} r="17" style={ring} />
      {!locked && <path className="ach-medal__gloss" d={`M${32 - 13.6} ${art.cy - 6.2}a15 15 0 0 1 11.2-8.6`} />}

      <g className="ach-medal__glyph" transform={`translate(${32 - 12.6} ${art.cy - 12.6}) scale(1.05)`}>
        {GLYPHS[glyph]}
      </g>

      {locked && (
        <g className="ach-medal__lock">
          <circle cx="49" cy="49" r="10" />
          <g transform="translate(42.4 42.2) scale(0.55)">{LOCK_GLYPH}</g>
        </g>
      )}
    </svg>
  )
}
