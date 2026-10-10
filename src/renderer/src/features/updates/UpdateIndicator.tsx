import { useMemo } from 'react'
import { Icon, Tooltip, cx } from '@renderer/components/ui'
import { useLanguage } from '@renderer/i18n'
import { indicatorInfo, type IndicatorInfo } from './model'
import { useUpdateStore } from './store'
import './updates.css'

export interface UpdateIndicatorViewProps {
  info: IndicatorInfo
  /** The rail shows icons only: the label moves into a tooltip. */
  collapsed: boolean
  onOpen: () => void
}

/** The marker itself, without the store: also what the kit previews. */
export function UpdateIndicatorView({ info, collapsed, onOpen }: UpdateIndicatorViewProps) {
  return (
    <Tooltip content={info.label} placement="right" disabled={!collapsed}>
      <button type="button" className={cx('upd-indicator', collapsed && 'is-collapsed', info.ready && 'is-ready')} aria-label={collapsed ? info.label : undefined} aria-haspopup="dialog" onClick={onOpen}>
        <span className="upd-indicator__icon">
          <Icon name={info.icon} size={18} />
          <span className="upd-indicator__dot" />
        </span>
        <span className="upd-indicator__label">{info.label}</span>
        {info.progress !== null && (
          <span className="upd-indicator__bar" aria-hidden="true">
            <span style={{ transform: `scaleX(${info.progress})` }} />
          </span>
        )}
      </button>
    </Tooltip>
  )
}

/**
 * The small, lasting sign in the foot of the navigation rail that a newer version is on offer.
 * It reopens the changelog window; there is nothing to see while the app is up to date.
 */
export function UpdateIndicator({ collapsed }: { collapsed: boolean }) {
  const state = useUpdateStore((s) => s.state)
  const language = useLanguage()
  const info = useMemo(() => indicatorInfo(state), [state, language])
  if (info === null) return null
  return <UpdateIndicatorView info={info} collapsed={collapsed} onOpen={useUpdateStore.getState().openOffer} />
}
