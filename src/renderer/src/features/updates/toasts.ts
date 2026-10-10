/**
 * The three toasts the update feature can show. Each follows something the user did (updated the
 * app, started a download); a check that finds nothing or fails in the background never toasts.
 */

import type { UpdateError, WhatsNew } from '@shared/api'
import { toast } from '@renderer/store/ui'
import { openWebPage } from './links'
import { errorWording, releaseUrl } from './model'

/** The app was updated but its notes could not be loaded: the way to them, instead of an empty window. */
export function toastUpdated(whatsNew: Pick<WhatsNew, 'version' | 'url'>): void {
  const url = releaseUrl(whatsNew.url)
  toast({
    kind: 'success',
    title: `Pelagix was updated to version ${whatsNew.version}`,
    body: 'What changed is on the release page.',
    icon: 'gift',
    action: { label: 'Open it', onSelect: () => openWebPage(url) }
  })
}

/** A download finished while the changelog window was closed. */
export function toastReady(version: string, onRestart: () => void): void {
  toast({
    kind: 'success',
    title: `Pelagix ${version} is ready to install`,
    // Says what installs it: nothing happens by itself, and nothing when the app is simply closed.
    body: 'Choose Restart to install it: Pelagix closes and reopens by itself.',
    icon: 'download',
    durationMs: 12_000,
    action: { label: 'Restart', onSelect: onRestart }
  })
}

/** A download broke while the changelog window was closed. */
export function toastDownloadFailed(version: string, error: Pick<UpdateError, 'kind' | 'during'>, onShow: () => void): void {
  toast({ kind: 'error', title: `Pelagix ${version} could not be downloaded`, body: errorWording(error).text, action: { label: 'Show', onSelect: onShow } })
}
