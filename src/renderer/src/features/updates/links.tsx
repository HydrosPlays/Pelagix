import type { ReactNode } from 'react'
import { Icon } from '@renderer/components/ui'
import { t, useT } from '@renderer/i18n'
import { errorMessage } from '@renderer/lib/format'
import { toast } from '@renderer/store/ui'

/** Opens a web page: the system browser inside the desktop app, a new tab in a browser. */
export function openWebPage(href: string): void {
  const api = window.api
  if (!api) {
    window.open(href, '_blank', 'noopener,noreferrer')
    return
  }
  api.openExternal(href).catch((err: unknown) => {
    toast({ kind: 'error', title: t('updates.link.failed'), body: errorMessage(err) })
  })
}

/** A link to a web page from one of the update windows. Its tooltip shows where it goes. */
export function WebLink({ href, children }: { href: string; children: ReactNode }) {
  const t = useT()
  return (
    <a
      className="upd-link"
      href={href}
      title={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        if (!window.api) return
        event.preventDefault()
        openWebPage(href)
      }}
    >
      {children}
      <Icon name="external" size={13} label={t('updates.link.opens')} />
    </a>
  )
}
