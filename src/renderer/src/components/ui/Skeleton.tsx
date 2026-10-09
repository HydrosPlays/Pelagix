import type { CSSProperties } from 'react'
import { cx } from './cx'
import './Skeleton.css'

export interface SkeletonProps {
  /** rect: block (default). text: one line sized to the font. circle: avatar / icon. */
  variant?: 'rect' | 'text' | 'circle'
  /** CSS width (number = px). Default 100%; for a circle, the diameter. */
  width?: number | string
  /** CSS height (number = px). Text defaults to 1em, a circle to its width. */
  height?: number | string
  /** Corner radius override (number = px). */
  radius?: number | string
  className?: string
  style?: CSSProperties
}

const px = (v: number | string | undefined): string | undefined => (typeof v === 'number' ? `${v}px` : v)

/** Loading placeholder with a soft shimmer. Give it the size of what it stands in for to avoid layout shift. */
export function Skeleton({ variant = 'rect', width, height, radius, className, style }: SkeletonProps) {
  const w = px(width)
  const h = px(height) ?? (variant === 'circle' ? w : undefined)
  return <span aria-hidden="true" className={cx('ui-skeleton', `ui-skeleton--${variant}`, className)} style={{ width: w, height: h, borderRadius: px(radius), ...style }} />
}
