import type { ReactNode, SVGProps } from 'react'

/**
 * The app's icon set: 24 px grid, 1.75 px round strokes, drawn in `currentColor`.
 * Add new glyphs here rather than inlining SVG in features.
 */
const dot = (cx: number, cy: number, r = 1.25): ReactNode => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />

const ICONS = {
  // ---- navigation
  home: (
    <>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.5v9.5a1 1 0 0 0 1 1h3.7v-5.5h3.6V20h3.7a1 1 0 0 0 1-1V9.5" />
    </>
  ),
  dex: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="2.5" />
      <circle cx="8.6" cy="7.3" r="1.7" />
      <path d="M13 7.3h.01M16 7.3h.01" strokeWidth="2.2" />
      <rect x="7.5" y="11.5" width="9" height="6" rx="1.2" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </>
  ),
  box: (
    <>
      <path d="M12 3 20 7.2v9.6L12 21l-8-4.2V7.2z" />
      <path d="m4 7.2 8 4.3 8-4.3M12 11.5V21" />
    </>
  ),
  journal: (
    <>
      <path d="M5 5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2z" />
      <path d="M5 20a2 2 0 0 0 2 2h12v-4M9.5 7.5h5.5M9.5 11h3.5" />
    </>
  ),
  trophy: (
    <>
      <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z" />
      <path d="M7.5 5.5H5a.6.6 0 0 0-.6.6V7a3.1 3.1 0 0 0 3.3 3M16.5 5.5H19a.6.6 0 0 1 .6.6V7a3.1 3.1 0 0 1-3.3 3M12 13.5V17M8.5 20.5h7M9.8 17h4.4l.6 3.5H9.2z" />
    </>
  ),
  settings: (
    <>
      <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.9-1.5-1.9-3.3-2.3.9a7.6 7.6 0 0 0-2.6-1.5l-.4-2.4h-3.8l-.4 2.4a7.6 7.6 0 0 0-2.6 1.5L5 5.7 3.1 9 5 10.5a7.6 7.6 0 0 0 0 3L3.1 15 5 18.3l2.3-.9a7.6 7.6 0 0 0 2.6 1.5l.4 2.4h3.8l.4-2.4a7.6 7.6 0 0 0 2.6-1.5l2.3.9L21.3 15z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),

  // ---- actions
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </>
  ),
  filter: <path d="M4 5.5h16l-6.2 7.2V19l-3.6-1.8v-4.5z" />,
  sort: <path d="M7.5 4.5v15M4.5 16.5l3 3 3-3M16.5 19.5v-15M13.5 7.5l3-3 3 3" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  edit: (
    <>
      <path d="m4 20 1-4.5L16.3 4.2a2.1 2.1 0 0 1 3 0l.5.5a2.1 2.1 0 0 1 0 3L8.5 19z" />
      <path d="m14.5 6 3.5 3.5" />
    </>
  ),
  trash: <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.8 12.1a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9L17.5 7M10 11v5.5M14 11v5.5" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" />
      <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
    </>
  ),
  undo: <path d="M8.5 6.5 4 11l4.5 4.5M4 11h10.5a4.75 4.75 0 0 1 0 9.5H11" />,
  refresh: <path d="M20 11a8 8 0 0 0-14.3-4.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.3L20 15.5M20 20v-4.5h-4.5" />,
  more: (
    <>
      {dot(5, 12, 1.6)}
      {dot(12, 12, 1.6)}
      {dot(19, 12, 1.6)}
    </>
  ),
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />,
  download: <path d="M12 4v11.5M7.5 11l4.5 4.5 4.5-4.5M4.5 19.5h15" />,
  upload: <path d="M12 15.5V4M7.5 8.5 12 4l4.5 4.5M4.5 19.5h15" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  expand: <path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  'eye-off': <path d="M4 4l16 16M9.9 6A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.7 3.5M14.1 14.2A2.8 2.8 0 0 1 9.8 9.9M6.2 7.7A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 3.8-.9" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),

  // ---- chevrons and arrows
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevron-up': <path d="m6 15 6-6 6 6" />,
  'chevron-left': <path d="m15 6-6 6 6 6" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
  'arrow-left': <path d="M19 12H5M11 6l-6 6 6 6" />,
  'arrow-up': <path d="M12 19V5M6 11l6-6 6 6" />,
  'arrow-down': <path d="M12 5v14M6 13l6 6 6-6" />,

  // ---- status
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      {dot(12, 7.7, 1.1)}
    </>
  ),
  warning: (
    <>
      <path d="M12 4 21 19.5H3z" />
      <path d="M12 10v4.5" />
      {dot(12, 16.9, 1.1)}
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </>
  ),
  success: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m7.8 12.3 2.9 2.9 5.5-5.7" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.6 2.6 0 1 1 3.7 2.4c-.8.4-1.2.9-1.2 1.8" />
      {dot(12, 16.7, 1.1)}
    </>
  ),

  // ---- Pokémon
  sparkle: (
    <g fill="currentColor" stroke="none">
      <path d="M10 2.5 12 8l5.5 2-5.5 2-2 5.5L8 12l-5.5-2L8 8z" />
      <path d="m18 13.5 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" />
    </g>
  ),
  star: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" />,
  'star-filled': <path fill="currentColor" d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" />,
  male: (
    <>
      <circle cx="10" cy="14" r="5.5" />
      <path d="M14 10l6-6M14.5 4H20v5.5" />
    </>
  ),
  female: (
    <>
      <circle cx="12" cy="9" r="5.5" />
      <path d="M12 14.5V21M8.5 18h7" />
    </>
  ),
  genderless: (
    <>
      <circle cx="12" cy="12" r="6.5" />
      {dot(12, 12, 1.8)}
    </>
  ),
  pokeball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h5.8M15.2 12H21" />
      <circle cx="12" cy="12" r="3.2" />
    </>
  ),
  egg: <path d="M12 3c3.5 0 6.5 5.5 6.5 10.3a6.5 6.5 0 0 1-13 0C5.5 8.5 8.5 3 12 3z" />,
  evolve: <path d="m6 12 6-6 6 6M6 18.5l6-6 6 6" />,
  swap: <path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4" />,
  gift: (
    <>
      <rect x="3.5" y="8.5" width="17" height="4" rx="1" />
      <path d="M5.5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-6.5M12 8.5v12M12 8.5S10.5 4 8.2 4.2 7 8.5 12 8.5zM12 8.5s1.5-4.5 3.8-4.3S17 8.5 12 8.5z" />
    </>
  ),
  flame: <path d="M12 3c.4 3.3 4.8 5.3 4.8 10.2a4.8 4.8 0 0 1-9.6 0c0-1.7.6-2.9 1.5-3.8.3 1.6 1 2.3 1.9 2.5C10.2 9.1 10.6 5.9 12 3z" />,
  bolt: <path d="M13 3 5.5 13.5H11L10 21l8-11h-5.8z" />,
  medal: (
    <>
      <circle cx="12" cy="14.5" r="5.5" />
      <path d="M8.8 10 6 3.5h4l2 4.5 2-4.5h4L15.2 10M12 12.5l.7 1.4 1.5.2-1.1 1.1.3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1.1 1.5-.2z" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.2" />
      {dot(12, 12, 1.3)}
    </>
  ),

  // ---- objects
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.3 2" />
    </>
  ),
  'map-pin': (
    <>
      <path d="M12 21s-6.5-6-6.5-11.3a6.5 6.5 0 0 1 13 0C18.5 15 12 21 12 21z" />
      <circle cx="12" cy="9.8" r="2.3" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.2V5A1.5 1.5 0 0 1 5 3.5h7.2l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.6 6.6a1.5 1.5 0 0 1-2.1 0z" />
      {dot(8, 8, 1.3)}
    </>
  ),
  list: (
    <>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      {dot(4.8, 6.5, 1.2)}
      {dot(4.8, 12, 1.2)}
      {dot(4.8, 17.5, 1.2)}
    </>
  ),
  gamepad: (
    <>
      <path d="M7.5 7.5h9a4.5 4.5 0 0 1 4.5 4.5v1.8a3.2 3.2 0 0 1-5.9 1.7l-.5-.8H9.4l-.5.8A3.2 3.2 0 0 1 3 13.8V12a4.5 4.5 0 0 1 4.5-4.5z" />
      <path d="M8 10.3v3M6.5 11.8h3" />
      {dot(15.3, 10.8, 1)}
      {dot(17.5, 12.8, 1)}
    </>
  ),
  note: (
    <>
      <path d="M6 3.5h8.5L19 8v11a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5z" />
      <path d="M14.5 3.5V8H19M8 12.5h7.5M8 16h5" />
    </>
  ),
  chart: <path d="M4 20.5h16M6.5 17v-5M11 17V7M15.5 17v-7.5M20 17v-3" />,
  database: (
    <>
      <ellipse cx="12" cy="6" rx="7.5" ry="3" />
      <path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="8.7" cy="9.5" r="1.6" />
      <path d="m4 17 4.7-4.5 3.5 3.3 2.8-2.6 5 4.8" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9z" />
    </>
  ),
  layers: <path d="m12 3.5 9 4.7-9 4.7-9-4.7zM3.5 12.5l8.5 4.4 8.5-4.4M3.5 16.5l8.5 4.4 8.5-4.4" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
    </>
  ),
  moon: <path d="M20 14.5A8.3 8.3 0 0 1 9.5 4a8.3 8.3 0 1 0 10.5 10.5z" />,
  motion: <path d="M3 8.5h9.5a3 3 0 1 0-3-3M3 12.5h15a3 3 0 1 1-3 3M3 16.5h7.5" />,
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9" strokeWidth="2" />
    </>
  ),
  dot: dot(12, 12, 4)
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof ICONS

/** Every icon name, for galleries and pickers. */
export const ICON_NAMES = Object.keys(ICONS) as IconName[]

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  /** Square size in px. Default 18. */
  size?: number
  /** Accessible name. Without it the icon is decorative (aria-hidden). */
  label?: string
}

export function Icon({ name, size = 18, label, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      style={{ flex: 'none' }}
      {...rest}
    >
      {ICONS[name]}
    </svg>
  )
}
