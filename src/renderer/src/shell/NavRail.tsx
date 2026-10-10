import { useSyncExternalStore } from 'react'
import { Link, useLocation } from 'wouter'
import { Icon, Leds, Lens, NumberTicker, ProgressRing, Tooltip, cx } from '@renderer/components/ui'
import { useCollection } from '@renderer/domain/slots'
import { UpdateIndicator } from '@renderer/features/updates/UpdateIndicator'
import { isDev } from '@renderer/lib/env'
import { formatCount, percent, ratio } from '@renderer/lib/format'
import { paths } from './router'
import { matchRoute, NAV_ITEMS } from './routes'
import './NavRail.css'

/** Must match the breakpoint in AppShell.css. */
const COLLAPSE_QUERY = '(max-width: 1100px)'

function subscribeCollapse(onChange: () => void): () => void {
  const media = window.matchMedia(COLLAPSE_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/** True while the rail shows icons only. */
export function useRailCollapsed(): boolean {
  return useSyncExternalStore(
    subscribeCollapse,
    () => window.matchMedia(COLLAPSE_QUERY).matches,
    () => false
  )
}

function ProgressReadout({ collapsed }: { collapsed: boolean }) {
  const { totals } = useCollection()
  const done = ratio(totals.caught, totals.slots)
  const text = `${formatCount(totals.caught)} of ${formatCount(totals.slots)} caught`
  return (
    <Tooltip content={`Living Dex: ${text} (${percent(totals.caught, totals.slots)})`} placement="right" disabled={!collapsed}>
      <Link href={paths.living()} className="shell-rail__progress" aria-label={`Living Dex progress: ${text}`}>
        <ProgressRing value={done} size={42} thickness={4} tone={done >= 1 ? 'gold' : 'accent'} label="Living Dex completion" valueText={text}>
          <span className="shell-rail__pct">{percent(totals.caught, totals.slots, 0)}</span>
        </ProgressRing>
        <span className="shell-rail__progress-text">
          <span className="u-eyebrow">Living Dex</span>
          <span className="shell-rail__count">
            <NumberTicker value={totals.caught} className="shell-rail__caught" />
            <span className="shell-rail__total"> / {formatCount(totals.slots)}</span>
          </span>
        </span>
      </Link>
    </Tooltip>
  )
}

export function NavRail() {
  const [location] = useLocation()
  const collapsed = useRailCollapsed()
  const activeNav = matchRoute(location)?.nav ?? null

  return (
    <nav className="shell-rail" aria-label="Main">
      <div className="shell-rail__brand">
        <Lens size={36} />
        <div className="shell-rail__brand-text">
          <span className="shell-rail__wordmark">Pelagix</span>
          <span className="shell-rail__tagline">Living Dex</span>
        </div>
        <Leds className="shell-rail__leds" />
      </div>

      <ul className="shell-rail__nav">
        {NAV_ITEMS.map((item) => {
          const active = item.id === activeNav
          return (
            <li key={item.id}>
              <Tooltip content={item.label} placement="right" disabled={!collapsed}>
                <Link href={item.href} className={cx('shell-rail__link', active && 'is-active')} aria-current={active ? 'page' : undefined} aria-label={collapsed ? item.label : undefined}>
                  <Icon name={item.icon} size={20} />
                  <span className="shell-rail__label">{item.label}</span>
                </Link>
              </Tooltip>
            </li>
          )
        })}
      </ul>

      <div className="shell-rail__foot">
        {/* Only there while a newer version is on offer. */}
        <UpdateIndicator collapsed={collapsed} />
        {isDev && (
          <Tooltip content="Component kit" placement="right" disabled={!collapsed}>
            <Link href={paths.kit()} className={cx('shell-rail__link', 'shell-rail__link--minor', activeNav === 'kit' && 'is-active')} aria-current={activeNav === 'kit' ? 'page' : undefined} aria-label={collapsed ? 'Component kit' : undefined}>
              <Icon name="layers" size={18} />
              <span className="shell-rail__label">Component kit</span>
            </Link>
          </Tooltip>
        )}
        <ProgressReadout collapsed={collapsed} />
      </div>
    </nav>
  )
}
