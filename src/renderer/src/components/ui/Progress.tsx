import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { countUp, type CountUpOptions } from '@renderer/lib/anim'
import { languageTag } from '@shared/languages'
import { activeLanguage } from '@renderer/i18n'
import { cx } from './cx'
import './Progress.css'

export type ProgressTone = 'accent' | 'gold' | 'success' | 'catch'

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)

export interface ProgressBarProps {
  /** Fraction 0..1. */
  value: number
  tone?: ProgressTone
  size?: 'sm' | 'md' | 'lg'
  /** Accessible name. */
  label: string
  /** Text for assistive tech, e.g. "151 of 1,025". Default: the percentage. */
  valueText?: string
  /** A second, fainter fill behind the main one (e.g. shiny progress under normal progress). */
  secondary?: number
  /** Custom fill colour (any CSS colour); overrides the tone. */
  color?: string
  className?: string
}

/** Horizontal progress bar. The fill is scaled with a transform, so it animates cheaply. */
export function ProgressBar({ value, tone = 'accent', size = 'md', label, valueText, secondary, color, className }: ProgressBarProps) {
  const v = clamp01(value)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-valuetext={valueText}
      className={cx('ui-progress', `ui-progress--${tone}`, `ui-progress--${size}`, v >= 1 && 'is-complete', className)}
      style={color ? ({ '--progress-fill': color } as CSSProperties) : undefined}
    >
      {secondary !== undefined && <span className="ui-progress__fill ui-progress__fill--secondary" style={{ transform: `scaleX(${clamp01(secondary)})` }} />}
      <span className="ui-progress__fill" style={{ transform: `scaleX(${v})` }} />
    </div>
  )
}

export interface ProgressRingProps {
  /** Fraction 0..1. */
  value: number
  /** Outer diameter in px. Default 64. */
  size?: number
  /** Stroke width in px. Default: size / 9. */
  thickness?: number
  tone?: ProgressTone
  /** Accessible name. */
  label: string
  valueText?: string
  /** Centre content (a percentage, an icon ...). */
  children?: ReactNode
  className?: string
}

/** Circular progress. The arc animates when the value changes. */
export function ProgressRing({ value, size = 64, thickness, tone = 'accent', label, valueText, children, className }: ProgressRingProps) {
  const v = clamp01(value)
  const stroke = thickness ?? Math.max(3, Math.round(size / 9))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-valuetext={valueText}
      className={cx('ui-ring', `ui-ring--${tone}`, v >= 1 && 'is-complete', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ui-ring__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <circle
          className="ui-ring__arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children !== undefined && <div className="ui-ring__center">{children}</div>}
    </div>
  )
}

export interface NumberTickerProps extends Pick<CountUpOptions, 'duration' | 'decimals' | 'format'> {
  value: number
  /** Count up from 0 on first mount. Default true. */
  animateOnMount?: boolean
  className?: string
}

const plain = (value: number, decimals: number): string => {
  const language = activeLanguage()
  if (language !== 'en') return new Intl.NumberFormat(languageTag(language), { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)
  const [whole, fraction] = value.toFixed(decimals).split('.')
  const grouped = (whole ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}

/** A number that counts to its new value whenever it changes. */
export function NumberTicker({ value, animateOnMount = true, duration, decimals = 0, format, className }: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  // The number currently on screen, so a change mid-count continues from where it is.
  const shown = useRef<number | null>(null)
  const formatRef = useRef(format)
  formatRef.current = format
  const toText = (v: number): string => (formatRef.current ?? ((n: number) => plain(n, decimals)))(v)

  // The visible text is written imperatively (React never owns it), before paint.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const write = (v: number): string => {
      shown.current = v
      return toText(v)
    }
    const from = shown.current ?? (animateOnMount ? 0 : value)
    el.textContent = write(from)
    const animation = countUp(el, value, { from, duration, decimals, format: write })
    return () => {
      animation?.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, animateOnMount, duration, decimals])

  // The real value is always in the accessibility tree; the animated text is presentation only.
  return (
    <span className={cx('ui-ticker', className)}>
      <span ref={ref} aria-hidden="true" />
      <span className="u-sr-only">{toText(value)}</span>
    </span>
  )
}
