/**
 * Achievement glyphs, drawn like the app's icon set: 24 px grid, 1.75 px round strokes,
 * `currentColor`. Each one is used inside a medal and, for categories, on its own.
 */

import type { ReactNode } from 'react'
import type { AchievementGlyph } from '@renderer/domain/achievements'

const dot = (cx: number, cy: number, r = 1.25): ReactNode => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />

export const GLYPHS: Readonly<Record<AchievementGlyph, ReactNode>> = {
  pokeball: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h5.3M15.2 12h5.3" />
      <circle cx="12" cy="12" r="3.2" />
    </>
  ),
  boxes: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </>
  ),
  journal: (
    <>
      <path d="M5.5 5a2 2 0 0 1 2-2h11v15h-11a2 2 0 0 0-2 2z" />
      <path d="M5.5 20a2 2 0 0 0 2 2h11v-4M10 7.5h5M10 11h3" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.8 8.2-2.3 5.3-5.3 2.3 2.3-5.3z" />
      {dot(12, 12, 1)}
    </>
  ),
  gem: (
    <>
      <path d="M7.5 4h9l4.5 5.2-9 11.3-9-11.3z" />
      <path d="M3 9.2h18M9 9.2l3 11.3 3-11.3M7.5 4 9 9.2M16.5 4 15 9.2" />
    </>
  ),
  sparkle: (
    <g fill="currentColor" stroke="none">
      <path d="M10 2.5 12 8l5.5 2-5.5 2-2 5.5L8 12l-5.5-2L8 8z" />
      <path d="m18 13.5 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" />
    </g>
  ),
  cartridge: (
    <>
      <path d="M6.5 3.5H16L19 6.5v12.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z" />
      <path d="M8.5 3.5v4.5h6.5V3.5" />
      <rect x="8.5" y="12" width="7" height="5" rx="1" />
    </>
  ),
  console: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <rect x="8.5" y="5" width="7" height="5.5" rx="0.8" />
      <path d="M9.7 14v3M8.2 15.5h3" />
      {dot(14.6, 14.4, 0.9)}
      {dot(15.9, 16.6, 0.9)}
    </>
  ),
  balls: (
    <>
      <circle cx="12" cy="7.2" r="3.7" />
      <circle cx="6.9" cy="16.2" r="3.7" />
      <circle cx="17.1" cy="16.2" r="3.7" />
      <path d="M8.3 7.2h7.4M3.2 16.2h7.4M13.4 16.2h7.4" />
    </>
  ),
  shapes: (
    <>
      <path d="M12 3.5 16.5 11h-9z" />
      <rect x="4" y="13.5" width="7" height="7" rx="1.3" />
      <circle cx="16.8" cy="17" r="3.5" />
    </>
  ),
  gender: (
    <>
      <circle cx="11.5" cy="11" r="4.5" />
      <path d="M14.7 7.8 19 3.5M15.5 3.5H19V7M11.5 15.5V21M9 18.5h5" />
    </>
  ),
  gmax: (
    <>
      <path d="M14 4h6v6M10 20H4v-6M20 4l-5.5 5.5M4 20l5.5-5.5" />
      {dot(12, 12, 1.8)}
    </>
  ),
  mega: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 15.6c2.6 0 3-2 4-3.6s1.4-3.6 4-3.6M8 8.4c2.6 0 3 2 4 3.6s1.4 3.6 4 3.6" />
    </>
  ),
  sprout: (
    <>
      <path d="M12 20.5v-9.5M8 20.5h8" />
      <path d="M12 12.5c0-3.4-2.5-5.5-6.5-5.5 0 3.4 2.5 5.5 6.5 5.5zM12 10.5c0-3.2 2.4-5.5 6.5-5.5 0 3.2-2.4 5.5-6.5 5.5z" />
    </>
  ),
  crown: (
    <>
      <path d="m4 8.5 4 3.5 4-6.5 4 6.5 4-3.5-1.5 8.5h-13z" />
      <path d="M6.5 20.5h11" />
    </>
  ),
  star: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" />,
  fossil: <path d="M10.5 12.8a1.5 1.5 0 0 1 3 0 3 3 0 0 1-6 0 4.5 4.5 0 0 1 9 0 6 6 0 0 1-12 0 7.5 7.5 0 0 1 15 0" />,
  egg: (
    <>
      <path d="M12 3c3.5 0 6.5 5.5 6.5 10.3a6.5 6.5 0 0 1-13 0C5.5 8.5 8.5 3 12 3z" />
      <path d="m5.8 12.5 2.4-1.8 2.5 2 2.6-2 2.5 2 2.4-1.8" />
    </>
  ),
  portal: (
    <>
      <ellipse cx="12" cy="12" rx="9" ry="4.6" transform="rotate(-35 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="4.6" transform="rotate(35 12 12)" />
      {dot(12, 12, 1.5)}
    </>
  ),
  hourglass: (
    <>
      <path d="M7 3.5h10M7 20.5h10" />
      <path d="M8.2 3.5v2.3c0 2.7 3.8 3.9 3.8 6.2s-3.8 3.5-3.8 6.2v2.3M15.8 3.5v2.3c0 2.7-3.8 3.9-3.8 6.2s3.8 3.5 3.8 6.2v2.3" />
    </>
  ),
  grass: (
    <>
      <path d="M3 20.5h18" />
      <path d="M5 20.5c.2-4.8 1.3-8.4 3.3-10.8.9 3 1.3 6.6 1.1 10.8M10.2 20.5c.1-6.9 1-12.2 2.6-16 1.5 4.3 2.2 9.6 2 16M15.8 20.5c.2-4 1.2-7.1 2.9-9.4.9 2.7 1.3 5.8 1.2 9.4" />
    </>
  ),
  evolve: <path d="m6 12 6-6 6 6M6 18.5l6-6 6 6" />,
  swap: <path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4" />,
  gift: (
    <>
      <rect x="3.5" y="8.5" width="17" height="4" rx="1" />
      <path d="M5.5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-6.5M12 8.5v12M12 8.5S10.5 4 8.2 4.2 7 8.5 12 8.5zM12 8.5s1.5-4.5 3.8-4.3S17 8.5 12 8.5z" />
    </>
  ),
  duel: <path d="M5 4l10.5 10.5M12.7 17.3l4.6-4.6M16.5 16.5l3.5 3.5M19 4 8.5 14.5M6.7 12.7l4.6 4.6M7.5 16.5 4 20" />,
  den: (
    <>
      <path d="M4.5 20.5v-6a7.5 7.5 0 0 1 15 0v6z" />
      <path d="M9.5 20.5V16a2.5 2.5 0 0 1 5 0v4.5M12 2.5v2.2M7.3 3.6l.9 2M16.7 3.6l-.9 2" />
    </>
  ),
  crystal: (
    <>
      <path d="m12 2.5 5.5 7-5.5 12-5.5-12z" />
      <path d="M6.5 9.5h11M9.6 9.5 12 21.5l2.4-12M12 2.5 9.6 9.5M12 2.5l2.4 7" />
    </>
  ),
  swarm: <path d="m3.5 8.5 3.2 2.6 3.2-2.6M14.1 6l3.2 2.6L20.5 6M8.8 15.5l3.2 2.6 3.2-2.6" />,
  moon: <path d="M20 14.5A8.3 8.3 0 0 1 9.5 4a8.3 8.3 0 1 0 10.5 10.5z" />,
  steps: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <rect x="8.2" y="7.2" width="7.6" height="5.4" rx="1" />
      {dot(12, 16.4, 1.2)}
    </>
  ),
  cloud: <path d="M7.2 18.5a4 4 0 0 1-.6-7.96 5.5 5.5 0 0 1 10.6-1.2 4.6 4.6 0 0 1-.2 9.16z" />,
  ticket: (
    <>
      <path d="M4 8a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 8v2a2 2 0 0 0 0 4v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16v-2a2 2 0 0 0 0-4z" />
      <path d="M14.5 9.2v5.6" strokeDasharray="0.1 2.7" />
      <path d="m9.3 10.2.6 1.2 1.3.2-.9.9.2 1.3-1.2-.6-1.2.6.2-1.3-.9-.9 1.3-.2z" />
    </>
  ),
  transfer: <path d="M12 3v10.5M8 9.5l4 4 4-4M4.5 14.5v4a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4" />,
  alpha: <path d="M18.2 6c-1.2 6.8-3.8 11.5-7.6 11.5a4.9 4.9 0 0 1 0-9.8c3.8 0 6.4 4.7 7.6 11.5" />,
  tag: (
    <>
      <path d="M3.5 12.2V5A1.5 1.5 0 0 1 5 3.5h7.2l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.6 6.6a1.5 1.5 0 0 1-2.1 0z" />
      {dot(8, 8, 1.3)}
    </>
  ),
  peak: (
    <>
      <path d="M3 20 9.5 8.5l4 6.5 2.5-3.5L21 20z" />
      <path d="M9.5 8.5v-5l3.5 1.5-3.5 1.5" />
    </>
  ),
  paths: <path d="M12 3v18M12 5.5h5.5l2 2.2-2 2.2H12M12 12H6.5l-2 2.2 2 2.2H12M9 21h6" />,
  stack: (
    <>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" />
      <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
    </>
  ),
  tree: (
    <>
      <circle cx="12" cy="5.5" r="2.5" />
      <circle cx="6" cy="18.5" r="2.5" />
      <circle cx="18" cy="18.5" r="2.5" />
      <path d="M12 8v4M6 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
    </>
  ),
  flame: <path d="M12 3c.4 3.3 4.8 5.3 4.8 10.2a4.8 4.8 0 0 1-9.6 0c0-1.7.6-2.9 1.5-3.8.3 1.6 1 2.3 1.9 2.5C10.2 9.1 10.6 5.9 12 3z" />,
  bolt: <path d="M13 3 5.5 13.5H11L10 21l8-11h-5.8z" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4M8.8 15l2.2 2.2 4.2-4.4" />
    </>
  ),
  question: (
    <>
      <path d="M8.3 8.6a3.7 3.7 0 1 1 5.4 3.3c-1.1.6-1.7 1.4-1.7 2.8" />
      {dot(12, 18.4, 1.3)}
    </>
  ),
  trophy: (
    <>
      <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z" />
      <path d="M7.5 5.5H5a.6.6 0 0 0-.6.6V7a3.1 3.1 0 0 0 3.3 3M16.5 5.5H19a.6.6 0 0 1 .6.6V7a3.1 3.1 0 0 1-3.3 3M12 13.5V17M8.5 20.5h7M9.8 17h4.4l.6 3.5H9.2z" />
    </>
  )
}

/** The lock of a locked medal, on the same grid. */
export const LOCK_GLYPH: ReactNode = (
  <>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </>
)

export interface GlyphIconProps {
  name: AchievementGlyph
  /** Square size in px. Default 18. */
  size?: number
  className?: string
}

/** A glyph on its own, as a decorative icon in the current text colour. */
export function GlyphIcon({ name, size = 18, className }: GlyphIconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flex: 'none' }}
    >
      {GLYPHS[name]}
    </svg>
  )
}
