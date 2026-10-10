/**
 * The three toasts the update feature can show. Each follows something the user did (updated the
 * app, started a download); a check that finds nothing or fails in the background never toasts.
 */

import type { UpdateError, WhatsNew } from '@shared/api'
import { t } from '@renderer/i18n'
import { toast } from '@renderer/store/ui'
import { openWebPage } from './links'
import { errorWording, releaseUrl } from './model'

/** The app was updated but its notes could not be loaded: the way to them, instead of an empty window. */
export function toastUpdated(whatsNew: Pick<WhatsNew, 'version' | 'url'>): void {
  const url = releaseUrl(whatsNew.url)
  toast({
    kind: 'success',
    title: t('updates.toast.updated.title', { version: whatsNew.version }),
    body: t('updates.toast.updated.body'),
    icon: 'gift',
    action: { label: t('updates.toast.open'), onSelect: () => openWebPage(url) }
  })
}

/** A download finished while the changelog window was closed. */
export function toastReady(version: string, onRestart: () => void): void {
  toast({
    kind: 'success',
    title: t('updates.offer.title.ready', { version }),
    // Says what installs it: nothing happens by itself, and nothing when the app is simply closed.
    body: t('updates.toast.ready.body'),
    icon: 'download',
    durationMs: 12_000,
    action: { label: t('updates.toast.ready.action'), onSelect: onRestart }
  })
}

/** A download broke while the changelog window was closed. */
export function toastDownloadFailed(version: string, error: Pick<UpdateError, 'kind' | 'during'>, onShow: () => void): void {
  toast({ kind: 'error', title: t('updates.toast.failed.title', { version }), body: errorWording(error).text, action: { label: t('updates.toast.failed.action'), onSelect: onShow } })
}
