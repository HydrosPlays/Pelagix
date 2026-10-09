import type { ReactNode } from 'react'
import { SYSTEM_BY_ID, type SystemId } from '@shared/games'
import { cx } from '../ui/cx'

const dot = (cx: number, cy: number, r = 0.9): ReactNode => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />

/** Line-art silhouettes of each device, on a 24 px grid. */
const GLYPHS: Record<SystemId, ReactNode> = {
  // Game Boy: upright brick with the one big rounded corner.
  gb: (
    <>
      <path d="M8 2.5h8A1.5 1.5 0 0 1 17.5 4v12.5a5 5 0 0 1-5 5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5z" />
      <rect x="8.7" y="4.8" width="6.6" height="5.6" rx="0.6" />
      <path d="M9.2 15.3h2.6M10.5 14v2.6" />
      {dot(14.1, 15.9)}
      {dot(15.6, 14.4)}
    </>
  ),
  // Game Boy Color: slimmer, both lower corners rounded, curved shoulders.
  gbc: (
    <>
      <path d="M9 2.5h6A1.5 1.5 0 0 1 16.5 4v14a3.5 3.5 0 0 1-3.5 3.5h-2A3.5 3.5 0 0 1 7.5 18V4A1.5 1.5 0 0 1 9 2.5z" />
      <rect x="9.4" y="4.7" width="5.2" height="4.8" rx="0.6" />
      <path d="M9.3 11.3h5.4" strokeDasharray="0.2 1.5" />
      <path d="M9.4 15h2.4M10.6 13.8v2.4" />
      {dot(13.5, 15.6, 0.8)}
      {dot(14.7, 14.2, 0.8)}
    </>
  ),
  // Nintendo 64: the three-pronged controller.
  n64: (
    <>
      <path d="M4.3 9.8C4.3 7.6 6 6.5 8 6.5h8c2 0 3.7 1.1 3.7 3.3l1.5 7.7c.3 1.7-2 2.4-2.8.9L16 13.5h-2l-.7 6.3c-.2 1.6-2.4 1.6-2.6 0L10 13.5H8l-2.4 4.9c-.8 1.5-3.1.8-2.8-.9z" />
      <circle cx="12" cy="10" r="1.2" />
      <path d="M7.4 8.9v2.2M6.3 10h2.2" />
      {dot(16.2, 9.3, 0.8)}
      {dot(17.6, 10.7, 0.8)}
    </>
  ),
  // Game Boy Advance: wide body with flared ends.
  gba: (
    <>
      <path d="M5.5 7.5h13a4 4 0 0 1 4 4v1a4 4 0 0 1-4 4h-13a4 4 0 0 1-4-4v-1a4 4 0 0 1 4-4z" />
      <rect x="8.3" y="9.3" width="7.4" height="5.4" rx="0.6" />
      <path d="M4.9 10.8v2.4M3.7 12h2.4" />
      {dot(18.3, 12.7, 0.8)}
      {dot(19.9, 11.3, 0.8)}
    </>
  ),
  // GameCube: the cube with its round disc lid and four controller ports.
  gcn: (
    <>
      <rect x="4.5" y="4.5" width="15" height="15" rx="2" />
      <circle cx="12" cy="10.3" r="3.6" />
      <path d="M4.5 15.8h15" />
      {dot(7.5, 17.7, 0.7)}
      {dot(10.5, 17.7, 0.7)}
      {dot(13.5, 17.7, 0.7)}
      {dot(16.5, 17.7, 0.7)}
    </>
  ),
  // Nintendo DS: clamshell, two near-equal screens.
  nds: (
    <>
      <rect x="5" y="2.8" width="14" height="8.4" rx="1.4" />
      <rect x="5" y="12.8" width="14" height="8.4" rx="1.4" />
      <rect x="7.8" y="4.7" width="8.4" height="4.6" rx="0.4" />
      <rect x="9" y="14.7" width="6" height="4.6" rx="0.4" />
      <path d="M7 16.1v1.8M6.1 17h1.8" />
      {dot(17, 17, 0.8)}
    </>
  ),
  // Nintendo 3DS: clamshell with a wide top screen, circle pad and 3D slider.
  '3ds': (
    <>
      <rect x="4.5" y="2.8" width="15" height="8.4" rx="1.4" />
      <rect x="4.5" y="12.8" width="15" height="8.4" rx="1.4" />
      <rect x="6.3" y="4.7" width="10.4" height="4.6" rx="0.4" />
      <path d="M18 5.3v3.4" />
      <rect x="8.8" y="14.6" width="6.4" height="4.4" rx="0.4" />
      <circle cx="6.7" cy="16.2" r="1" />
      {dot(17.3, 16.2, 0.8)}
      <path d="M11.3 20h1.4" />
    </>
  ),
  // Nintendo Switch: tablet between two Joy-Con, offset sticks.
  switch: (
    <>
      <path d="M7.5 5.5H5.8A2.8 2.8 0 0 0 3 8.3v7.4a2.8 2.8 0 0 0 2.8 2.8h1.7z" />
      <rect x="7.5" y="5.5" width="9" height="13" />
      <path d="M16.5 5.5h1.7A2.8 2.8 0 0 1 21 8.3v7.4a2.8 2.8 0 0 1-2.8 2.8h-1.7z" />
      {dot(5.2, 9.2, 0.9)}
      {dot(18.8, 14.2, 0.9)}
    </>
  ),
  // Nintendo Switch 2: the same silhouette, marked with a 2.
  switch2: (
    <>
      <path d="M7.5 5.5H5.8A2.8 2.8 0 0 0 3 8.3v7.4a2.8 2.8 0 0 0 2.8 2.8h1.7z" />
      <rect x="7.5" y="5.5" width="9" height="13" />
      <path d="M16.5 5.5h1.7A2.8 2.8 0 0 1 21 8.3v7.4a2.8 2.8 0 0 1-2.8 2.8h-1.7z" />
      <path d="M10.5 10.6c0-2 3-2 3 0 0 1.7-3 2.4-3 4.2h3.1" strokeWidth="1.4" />
    </>
  ),
  // Mobile: a phone.
  mobile: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.4" />
      <path d="M10.8 5h2.4M10.3 18.8h3.4" />
    </>
  )
}

export interface SystemIconProps {
  system: SystemId
  /** Square size in px. Default 18. */
  size?: number
  /** Accessible name. Default: the system's name. Pass "" when the name is printed next to it. */
  label?: string
  className?: string
}

/** Glyph of the console a game runs on. Drawn in `currentColor`. */
export function SystemIcon({ system, size = 18, label, className }: SystemIconProps) {
  const name = label ?? SYSTEM_BY_ID.get(system)?.name ?? system
  return (
    <svg
      className={cx('pk-system', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={name === '' ? undefined : 'img'}
      aria-label={name === '' ? undefined : name}
      aria-hidden={name === '' ? true : undefined}
      focusable="false"
      style={{ flex: 'none' }}
    >
      {GLYPHS[system] ?? GLYPHS.mobile}
    </svg>
  )
}
