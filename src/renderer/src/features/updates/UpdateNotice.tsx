import { useMemo } from 'react'
import { Button, Icon } from '@renderer/components/ui'
import { useLanguage } from '@renderer/i18n'
import { noticeInfo, type NoticeInfo } from './model'
import { useUpdateStore } from './store'
import './updates.css'

export interface UpdateNoticeViewProps {
  info: NoticeInfo
  onOpen: () => void
}

/** The line itself, without the store: also what the kit previews. */
export function UpdateNoticeView({ info, onOpen }: UpdateNoticeViewProps) {
  return (
    <div className="upd-notice">
      <span className="upd-notice__icon" aria-hidden="true">
        <Icon name={info.icon} size={18} />
      </span>
      <span className="upd-notice__text">{info.text}</span>
      <Button size="sm" icon={info.button.icon} aria-haspopup="dialog" onClick={onOpen}>
        {info.button.label}
      </Button>
    </div>
  )
}

/**
 * What the marker in the navigation rail is for the screens that have no rail: the start-up
 * error, and the message shown when the shell has crashed. A version that cannot start must
 * still be able to offer the one that fixes it, so the way to the changelog window is there too.
 * Renders nothing while there is nothing to offer.
 */
export function UpdateNotice() {
  const state = useUpdateStore((s) => s.state)
  const language = useLanguage()
  const info = useMemo(() => noticeInfo(state), [state, language])
  if (info === null) return null
  return <UpdateNoticeView info={info} onOpen={useUpdateStore.getState().openOffer} />
}
