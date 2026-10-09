import { useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { Link } from 'wouter'
import { Icon, cx, type IconName } from '@renderer/components/ui'

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)

export interface MeterProps {
  /** Fraction 0..1. */
  value: number
  /** Accessible name. Without one the meter is decorative (the numbers are printed or announced next to it). */
  label?: string
  /** Text for assistive tech, e.g. "151 of 1,025". */
  valueText?: string
  /** Custom fill (any CSS colour or gradient). */
  color?: string
  tone?: 'accent' | 'gold' | 'success'
  size?: 'sm' | 'md'
  className?: string
}

/**
 * The dashboard's horizontal bar. Same look as the shared ProgressBar, plus a wrapper that
 * `growIn` slides in once (see motion.ts); the fill keeps a round cap at any value.
 */
export function Meter({ value, label, valueText, color, tone = 'accent', size = 'md', className }: MeterProps) {
  const v = clamp01(value)
  // A started bar always shows a sliver, so "1 of 400" does not read as nothing.
  const shown = v === 0 ? 0 : Math.max(v, 0.025)
  const a11y = label === undefined ? ({ 'aria-hidden': true } as const) : ({ role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(v * 100), 'aria-valuetext': valueText } as const)
  return (
    <div {...a11y} className={cx('home-meter', `home-meter--${tone}`, `home-meter--${size}`, v >= 1 && 'is-complete', className)} style={color ? ({ '--meter-fill': color } as CSSProperties) : undefined}>
      <span className="home-meter__grow">
        <span className="home-meter__fill" style={{ transform: `translateX(${(shown - 1) * 100}%)` }} />
      </span>
    </div>
  )
}

/** Small text link with an arrow, for panel headers ("Journal", "Pokédex"). */
export function MoreLink({ href, children, label }: { href: string; children: ReactNode; label?: string }) {
  return (
    <Link href={href} className="home-more" aria-label={label}>
      <span>{children}</span>
      <Icon name="arrow-right" size={14} />
    </Link>
  )
}

/** One figure with its label, used in the streak row. Render inside a list. */
export function StatTile({ icon, value, label, note, tone = 'neutral' }: { icon: IconName; value: ReactNode; label: string; note?: ReactNode; tone?: 'neutral' | 'catch' | 'gold' }) {
  return (
    <li className={cx('home-stat', `home-stat--${tone}`)}>
      <span className="home-stat__icon" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <span className="home-stat__text">
        <span className="u-eyebrow">{label}</span>
        <span className="home-stat__value">{value}</span>
        {note !== undefined && <span className="home-stat__note">{note}</span>}
      </span>
    </li>
  )
}

/**
 * False on the first paint, true shortly after: lets a shared ring start empty and sweep to its
 * value once. A timer, not an animation frame, so it also flips in a window that is not painting.
 */
export function useArmed(delayMs = 60): boolean {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setArmed(true), delayMs)
    return () => clearTimeout(timer)
  }, [delayMs])
  return armed
}

/**
 * True while the element is at most `maxWidth` px wide. Measured before the first paint and kept
 * up to date, for the few things CSS cannot size from a container query (an SVG ring's diameter).
 */
export function useNarrowerThan(ref: RefObject<HTMLElement | null>, maxWidth: number): boolean {
  const [narrow, setNarrow] = useState(false)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    setNarrow(element.getBoundingClientRect().width <= maxWidth)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width !== undefined) setNarrow(width <= maxWidth)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, maxWidth])
  return narrow
}
