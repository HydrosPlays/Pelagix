import { useId, type ReactNode } from 'react'
import { BALL_BY_ID, type BallDef } from '@shared/balls'
import { cx } from '../ui/cx'
import './BallIcon.css'

/**
 * Poké Ball artwork for every PKHeX ball id, drawn parametrically on a 32 px grid: two halves, a
 * band, a button and one bold motif per ball so each stays recognisable at 20-32 px. Colours are
 * the balls' own and do not follow the theme; only the thin outer rim does.
 */

const INK = '#1b2233'
const WHITE = '#f6f8fc'
const RED = '#f0413e'
const YELLOW = '#ffd23f'
const WOOD = '#ead9b5'
const WOOD_GRAIN = '#c7b081'
const IRON = '#3b3f4a'
const STEEL = '#c5cad5'

interface BallSpec {
  top: string
  bottom?: string
  /** Colour of the centre band. */
  band?: string
  /** Button face and the ring around it. */
  button?: string
  ring?: string
  outline?: string
  /** Decoration, clipped to the ball. */
  motif?: ReactNode
  /** Hisuian construction: wooden lower half, iron band, square latch, steam nub on top. */
  hisui?: boolean
  /** Hisuian flight balls: wing size 1-3 and colour. */
  wings?: { size: 1 | 2 | 3; color: string }
  /** Hisuian heavy balls: thicker band. */
  bulky?: boolean
}

const stroke = (d: string, color: string, width: number): ReactNode => <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />

const RIVETS = (cs: Array<[number, number]>): ReactNode => cs.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.25} fill="#9097a6" stroke="#22252d" strokeWidth={0.5} />)

const SPECS: Record<string, BallSpec> = {
  poke: { top: RED },
  great: {
    top: '#3b82e0',
    motif: (
      <>
        <rect x="4.6" y="6.4" width="5.6" height="7.4" rx="2" fill={RED} transform="rotate(-30 7.4 10.1)" />
        <rect x="21.8" y="6.4" width="5.6" height="7.4" rx="2" fill={RED} transform="rotate(30 24.6 10.1)" />
      </>
    )
  },
  ultra: {
    top: '#2b2f3a',
    motif: (
      <>
        <rect x="7.2" y="2" width="3.9" height="14" fill={YELLOW} />
        <rect x="20.9" y="2" width="3.9" height="14" fill={YELLOW} />
      </>
    )
  },
  master: {
    top: '#7b48c8',
    motif: (
      <>
        <circle cx="8.3" cy="9.6" r="3" fill="#f06fb0" />
        <circle cx="23.7" cy="9.6" r="3" fill="#f06fb0" />
        {stroke('M12.7 11.6V6.6l3.3 3.2 3.3-3.2v5', '#ffffff', 1.6)}
      </>
    )
  },
  premier: { top: WHITE, band: RED, ring: RED },
  luxury: {
    top: '#23242b',
    bottom: '#23242b',
    band: '#e3b23c',
    ring: '#e3b23c',
    button: '#f3ead0',
    outline: '#101116',
    motif: (
      <>
        {stroke('M3 12.6q13-3.4 26 0', '#d8323a', 1.4)}
        {stroke('M3 19.4q13 3.4 26 0', '#e3b23c', 1)}
      </>
    )
  },
  net: {
    top: '#2fb3a5',
    motif: stroke('M9.5 3v13M16 3v13M22.5 3v13M3 8.2h26M3 12.3h26', '#0f3b3d', 1)
  },
  dive: {
    top: '#4f9fe3',
    motif: (
      <>
        {stroke('M2.5 12.2a5 5 0 0 1 7 0 5 5 0 0 0 6.5 0 5 5 0 0 1 6.5 0 5 5 0 0 0 7 0', '#dff2ff', 1.9)}
        {stroke('M6 7.6a4.2 4.2 0 0 1 6 0 4.2 4.2 0 0 0 6 0 4.2 4.2 0 0 1 6 0', '#a8d8ff', 1.4)}
      </>
    )
  },
  nest: {
    top: '#6fb34a',
    motif: (
      <>
        {stroke('M3 12.2q13-5.6 26 0', '#ecd97c', 2.3)}
        {stroke('M6 7.3q10-4.2 20 0', '#ecd97c', 1.8)}
      </>
    )
  },
  repeat: {
    top: RED,
    motif: (
      <>
        <circle cx="6.6" cy="15.4" r="5.2" fill="none" stroke={YELLOW} strokeWidth="2.3" />
        <circle cx="25.4" cy="15.4" r="5.2" fill="none" stroke={YELLOW} strokeWidth="2.3" />
      </>
    )
  },
  timer: {
    top: WHITE,
    motif: (
      <>
        {stroke('M3 12.6h26', '#f0503a', 2.4)}
        {stroke('M3 8.2h26', '#f0503a', 1.9)}
        {stroke('M3 21h26', '#f0503a', 2.4)}
        <path d="M10 2.5h12l-2.4 2.9h-7.2z" fill="#2b2f3a" />
      </>
    )
  },
  dusk: {
    top: '#26392d',
    bottom: '#1f2026',
    ring: '#6fd06a',
    outline: '#101116',
    motif: (
      <>
        <circle cx="6.2" cy="9.8" r="4.4" fill="#f08a2e" stroke="#6fd06a" strokeWidth="1.1" />
        <circle cx="25.8" cy="9.8" r="4.4" fill="#f08a2e" stroke="#6fd06a" strokeWidth="1.1" />
      </>
    )
  },
  heal: {
    top: '#f48fbf',
    bottom: '#fdf1f6',
    band: '#b9457b',
    ring: '#b9457b',
    motif: (
      <>
        {stroke('M3 12q13-6.2 26 0', '#ffe6f1', 2.5)}
        <circle cx="16" cy="6.4" r="1.5" fill="#8fd3ff" />
      </>
    )
  },
  quick: {
    top: '#3d8fe6',
    bottom: '#3d8fe6',
    motif: <path d="M16 16 4.5 7l4-3.5zM16 16 27.5 7l-4-3.5zM16 16 4.5 25l4 3.5zM16 16 27.5 25l-4 3.5z" fill={YELLOW} />
  },
  cherish: {
    top: '#d92b32',
    bottom: '#d92b32',
    band: '#7a1218',
    ring: '#7a1218',
    button: '#f0747a',
    outline: '#5c0d12',
    motif: (
      <>
        {stroke('M8.5 3q7.5 5.6 15 0', '#8f161d', 1.7)}
        {stroke('M8.5 29q7.5-5.6 15 0', '#8f161d', 1.7)}
      </>
    )
  },
  fast: {
    top: '#f08a2e',
    motif: (
      <>
        <path d="M10.2 4 5.8 10.2h3.1l-1.9 4.6 6.2-7h-3.1l2.3-3.8z" fill="#ffe65c" />
        <path d="M21.8 4l4.4 6.2h-3.1l1.9 4.6-6.2-7h3.1L19.6 4z" fill="#ffe65c" />
      </>
    )
  },
  level: {
    top: '#f5c531',
    motif: (
      <>
        <path d="M2 2h28v7.5q-14-5.5-28 0z" fill="#e0433a" />
        {stroke('M2.5 9.3q13.5-5.3 27 0', INK, 1.2)}
      </>
    )
  },
  lure: {
    top: '#3a86d8',
    motif: (
      <>
        <path d="M5.2 16a10.8 10.8 0 0 1 21.6 0" fill="none" stroke="#f0603a" strokeWidth="3" />
        <path d="M8.5 16a7.5 7.5 0 0 1 15 0" fill="none" stroke={YELLOW} strokeWidth="1.2" />
      </>
    )
  },
  heavy: {
    top: '#8b97a8',
    motif: (
      <>
        <rect x="4.8" y="8.6" width="4.8" height="5.2" rx="1.5" fill="#3b6fd0" />
        <rect x="22.4" y="8.6" width="4.8" height="5.2" rx="1.5" fill="#3b6fd0" />
        <rect x="10.3" y="4.3" width="4.2" height="3.8" rx="1.3" fill="#3b6fd0" />
        <rect x="17.5" y="4.3" width="4.2" height="3.8" rx="1.3" fill="#3b6fd0" />
      </>
    )
  },
  love: {
    top: '#f58fc0',
    motif: <path d="M16 13.3c-3.7-2.4-5.3-4.2-5.3-6a2.6 2.6 0 0 1 5.3-.9 2.6 2.6 0 0 1 5.3.9c0 1.8-1.6 3.6-5.3 6z" fill="#ffffff" />
  },
  friend: {
    top: '#6cbf4a',
    motif: (
      <>
        <circle cx="16" cy="8.6" r="3.3" fill={RED} stroke={YELLOW} strokeWidth="1.3" />
        <circle cx="7.3" cy="11.8" r="1.7" fill={RED} />
        <circle cx="24.7" cy="11.8" r="1.7" fill={RED} />
      </>
    )
  },
  moon: {
    top: '#2c64b0',
    motif: (
      <>
        <path d="M17.6 4.6a4.7 4.7 0 1 0 4 7.3 3.8 3.8 0 0 1-4-7.3z" fill="#ffe65c" />
        {stroke('M3 13.6h5M24 13.6h5', '#101522', 1.8)}
      </>
    )
  },
  safari: {
    top: '#6f9440',
    motif: (
      <>
        <path d="M4.5 8.5c2-2.2 5.3-1.2 5.5 1.3s-3.2 3.7-5 2.7z" fill="#3f6b2a" />
        <path d="M14 4.3c3-1 6.2.2 6.6 2.6s-3.2 3-5.7 2-2.4-3.8-.9-4.6z" fill="#bcc75c" />
        <path d="M21 11.2c1.6-1.6 5-1 5.6 1.4s-3.5 3.1-5 1.6z" fill="#3f6b2a" />
        <circle cx="12" cy="13" r="1.7" fill="#bcc75c" />
      </>
    )
  },
  sport: {
    top: WHITE,
    ring: '#f08a2e',
    motif: (
      <>
        <path d="M2 2h28v7.8q-14-5.6-28 0z" fill="#f08a2e" />
        {stroke('M3 21.3q13 3.6 26 0', '#f08a2e', 1.4)}
      </>
    )
  },
  dream: {
    top: '#f5a9d0',
    band: '#d874b4',
    ring: '#d874b4',
    motif: (
      <>
        {stroke('M4.8 13c2.3-3.8 6.2-3.8 7.6-1.2s-1.2 4.2-2.7 2.7-.1-3.2 1.5-2.6', '#b9479a', 1.5)}
        {stroke('M17.4 7.2c2.4-2.7 6.2-2.2 7.2.4s-1.6 4.1-3.1 2.9 0-2.9 1.3-2.4', '#b9479a', 1.5)}
      </>
    )
  },
  beast: {
    top: '#2f7fd8',
    bottom: '#2567b8',
    band: '#153a70',
    ring: '#ffe65c',
    button: '#2f7fd8',
    motif: (
      <>
        {stroke('M16 16 4.5 5.5M16 16 27.5 5.5M16 16 4.5 26.5M16 16 27.5 26.5M16 3v26', '#ffe65c', 1.1)}
        <circle cx="8.6" cy="9.2" r="1.8" fill="#ffe65c" />
        <circle cx="23.4" cy="9.2" r="1.8" fill="#ffe65c" />
        <circle cx="8.6" cy="22.8" r="1.8" fill="#ffe65c" />
        <circle cx="23.4" cy="22.8" r="1.8" fill="#ffe65c" />
      </>
    )
  },
  strange: {
    top: '#566078',
    bottom: '#2d3140',
    band: '#e6c94a',
    ring: '#e6c94a',
    button: '#2d3140',
    outline: '#14161d',
    motif: (
      <>
        <rect x="6.8" y="7" width="3.7" height="3.7" fill="#b35cff" />
        <rect x="11.8" y="10.3" width="2.6" height="2.6" fill="#3cc8ff" />
        <rect x="19.6" y="5.8" width="4.4" height="2.3" fill="#b35cff" />
        <rect x="22.3" y="10.2" width="2.8" height="2.8" fill="#ffd23f" />
        <rect x="8.5" y="20.5" width="5.5" height="2.1" fill="#3cc8ff" />
        <rect x="18.5" y="23.5" width="3.6" height="2.1" fill="#b35cff" />
      </>
    )
  },

  // ---- Hisui: hand-made balls of wood and iron
  'la-poke': { top: '#d94a40', hisui: true },
  'la-great': { top: '#3f78c9', hisui: true, motif: stroke('M6 14 10.8 6.5M21.2 6.5 26 14', '#e0554a', 2.8) },
  'la-ultra': { top: '#2b2d36', hisui: true, motif: stroke('M9.5 16.5V6.5M22.5 16.5V6.5', '#f0c93a', 2.8) },
  'la-feather': { top: '#58aee6', hisui: true, wings: { size: 1, color: '#d9efff' }, motif: stroke('M4.5 13.5q11.5-7.5 23 0', '#ffffff', 1.9) },
  'la-wing': {
    top: '#3b74d9',
    hisui: true,
    wings: { size: 2, color: '#a9cdfa' },
    motif: (
      <>
        {stroke('M4.5 13.8q11.5-7.5 23 0', '#cfe6ff', 1.6)}
        {stroke('M7.5 9.8q8.5-5.4 17 0', '#cfe6ff', 1.4)}
      </>
    )
  },
  'la-jet': {
    top: '#1f2d50',
    hisui: true,
    wings: { size: 3, color: '#f0c93a' },
    motif: (
      <>
        {stroke('M4.5 13.8q11.5-7.5 23 0', '#f0c93a', 1.8)}
        {stroke('M16 6v5.5', '#f0c93a', 1.6)}
      </>
    )
  },
  'la-heavy': { top: '#4d515e', hisui: true, bulky: true, motif: RIVETS([[7.6, 12.6], [12.3, 8.3], [19.7, 8.3], [24.4, 12.6]]) },
  'la-leaden': {
    top: '#3d404b',
    hisui: true,
    bulky: true,
    motif: (
      <>
        {stroke('M4.5 13.2q11.5-7 23 0', '#4f8fe6', 2.4)}
        {RIVETS([[11, 7.5], [21, 7.5]])}
      </>
    )
  },
  'la-gigaton': {
    top: '#2b2d36',
    hisui: true,
    bulky: true,
    motif: (
      <>
        {stroke('M4.5 13.2q11.5-7 23 0', '#f0c93a', 2.4)}
        {RIVETS([[11, 7.5], [21, 7.5]])}
      </>
    )
  },
  'la-origin': {
    top: '#1c2a63',
    bottom: '#141c44',
    band: '#f0c93a',
    button: '#ffe9a6',
    hisui: true,
    motif: (
      <>
        {stroke('M5.5 14q4-8 10.5-8.5', '#4fd8ff', 1.9)}
        {stroke('M26.5 14q-4-8-10.5-8.5', '#ff7ad9', 1.9)}
        {stroke('M8 23.5q8 3.6 16 0', '#f0c93a', 1.2)}
      </>
    )
  }
}

const UNKNOWN: BallSpec = { top: '#6b7487', bottom: '#aab2c2' }

function StandardBall({ spec, clip }: { spec: BallSpec; clip: string }) {
  const band = spec.band ?? INK
  return (
    <>
      <circle className="pk-ball__rim" cx="16" cy="16" r="14.3" fill="none" strokeWidth="0.8" />
      <g clipPath={`url(#${clip})`}>
        <rect x="2" y="2" width="28" height="14" fill={spec.top} />
        <rect x="2" y="16" width="28" height="14" fill={spec.bottom ?? WHITE} />
        {spec.motif}
        <ellipse cx="10.8" cy="8.2" rx="4.3" ry="2.3" fill="#ffffff" opacity="0.2" transform="rotate(-30 10.8 8.2)" />
        <path d="M3.3 19.5a13 13 0 0 0 25.4 0 13.6 10.5 0 0 1-25.4 0z" fill="#06101f" opacity="0.14" />
      </g>
      <path d="M3 16h26" stroke={band} strokeWidth="2.2" />
      <circle cx="16" cy="16" r="13" fill="none" stroke={spec.outline ?? INK} strokeWidth="1.6" />
      <circle cx="16" cy="16" r="4.3" fill={spec.ring ?? band} />
      <circle cx="16" cy="16" r="2.6" fill={spec.button ?? WHITE} />
    </>
  )
}

function HisuiBall({ spec, clip }: { spec: BallSpec; clip: string }) {
  const band = spec.band ?? IRON
  const w = spec.wings
  const reach = w ? 1.2 + w.size * 1.4 : 0
  return (
    <>
      {w && (
        <g fill={w.color} stroke={INK} strokeWidth="1" strokeLinejoin="round">
          <path d={`M5.2 14.8 ${3.8 - reach} ${10.6 - reach * 0.8} 10 8z`} />
          <path d={`M26.8 14.8 ${28.2 + reach} ${10.6 - reach * 0.8} 22 8z`} />
        </g>
      )}
      <path d="M13.3 5.8V3.4a1 1 0 0 1 1-1h3.4a1 1 0 0 1 1 1v2.4z" fill="#9aa3b2" stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />
      <circle className="pk-ball__rim" cx="16" cy="17" r="13.3" fill="none" strokeWidth="0.8" />
      <g clipPath={`url(#${clip})`}>
        <rect x="3" y="4" width="26" height="13" fill={spec.top} />
        <rect x="3" y="17" width="26" height="13" fill={spec.bottom ?? WOOD} />
        {spec.bottom === undefined && <path d="M5.5 21.8q10.5 2.8 21 0M8 25.3q8 2 16 0" fill="none" stroke={WOOD_GRAIN} strokeWidth="0.9" strokeLinecap="round" />}
        {spec.motif}
        <ellipse cx="11" cy="9.6" rx="4" ry="2.1" fill="#ffffff" opacity="0.16" transform="rotate(-30 11 9.6)" />
        <path d="M4.3 20.5a12 12 0 0 0 23.4 0 12.6 9.6 0 0 1-23.4 0z" fill="#2a1c05" opacity="0.16" />
      </g>
      <path d="M4 17h24" stroke={band} strokeWidth={spec.bulky ? 3.6 : 2.6} />
      <circle cx="16" cy="17" r="12" fill="none" stroke={spec.outline ?? INK} strokeWidth="1.6" />
      <rect x="13.2" y="14.2" width="5.6" height="5.6" rx="1.3" fill={spec.button ?? STEEL} stroke={INK} strokeWidth="1.1" />
      <circle cx="16" cy="17" r="0.95" fill={INK} />
    </>
  )
}

export interface BallIconProps {
  /** PKHeX Ball id, or a `BallDef`. */
  ball: number | BallDef
  /** Square size in px. Default 24. */
  size?: number
  /** Accessible name. Default: the ball's name. Pass "" when the name is printed next to it. */
  label?: string
  className?: string
}

export function BallIcon({ ball, size = 24, label, className }: BallIconProps) {
  const def = typeof ball === 'number' ? BALL_BY_ID.get(ball) : ball
  const spec = (def && SPECS[def.slug]) ?? UNKNOWN
  const clip = useId()
  const name = label ?? def?.name ?? 'Unknown ball'
  return (
    <svg className={cx('pk-ball', className)} width={size} height={size} viewBox="0 0 32 32" role={name === '' ? undefined : 'img'} aria-label={name === '' ? undefined : name} aria-hidden={name === '' ? true : undefined} focusable="false">
      <defs>
        <clipPath id={clip}>{spec.hisui ? <circle cx="16" cy="17" r="12" /> : <circle cx="16" cy="16" r="13" />}</clipPath>
      </defs>
      {spec.hisui ? <HisuiBall spec={spec} clip={clip} /> : <StandardBall spec={spec} clip={clip} />}
    </svg>
  )
}

/** Slugs that have dedicated artwork (every entry of `BALLS`). */
export const BALL_ART_SLUGS: readonly string[] = Object.keys(SPECS)
