import type { ReactNode } from 'react'
import { cx } from './cx'
import type { Tone } from './Chip'
import './Badge.css'

export interface BadgeProps {
  /** Number to show; capped at `max` ("99+"). Omit with `dot` for a bare status dot. */
  count?: number
  max?: number
  /** A status dot with no text. */
  dot?: boolean
  tone?: Tone
  /** Hide when the count is 0. Default true. */
  hideZero?: boolean
  /** Free content instead of a count (short text such as "NEW"). */
  children?: ReactNode
  /** Accessible description, e.g. "3 new entries". */
  label?: string
  className?: string
}

/** Counter / status marker for nav items, tabs and tiles. */
export function Badge({ count, max = 99, dot, tone = 'accent', hideZero = true, children, label, className }: BadgeProps) {
  if (dot) return <span className={cx('ui-badge', 'ui-badge--dot', `ui-badge--${tone}`, className)} role={label ? 'img' : undefined} aria-label={label} />
  if (children === undefined && (count === undefined || (count === 0 && hideZero))) return null
  const text = children ?? (count! > max ? `${max}+` : String(count))
  return (
    <span className={cx('ui-badge', `ui-badge--${tone}`, className)} aria-label={label}>
      {text}
    </span>
  )
}
