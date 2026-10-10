import { useEffect, useRef } from 'react'
import { ErrorBoundary } from '@renderer/components/ui'
import { t } from '@renderer/i18n'
import { toast } from '@renderer/store/ui'
import { openWebPage } from './links'
import { releaseUrl } from './model'
import { useUpdateStore } from './store'
import { OfferDialog, WhatsNewDialog } from './UpdateDialogs'

/** Shown in place of a window that threw: closes it, says so once and points to the notes on the web. */
function WindowFailed() {
  const told = useRef(false)
  useEffect(() => {
    if (told.current) return
    told.current = true
    const store = useUpdateStore.getState()
    const url = releaseUrl(store.state?.offer?.url ?? store.state?.whatsNew?.url ?? '')
    store.closeWindow()
    toast({ kind: 'error', title: t('updates.window.failed.title'), body: t('updates.window.failed.body'), action: { label: t('updates.toast.open'), onSelect: () => openWebPage(url) } })
  }, [])
  return null
}

/**
 * Renders the two update windows for `useUpdateStore().surface`: the changelog of an offered
 * version, and "What's new" after an update. Mounted once by `App`, in the desktop app only.
 */
export default function UpdateWindows() {
  const state = useUpdateStore((s) => s.state)
  const surface = useUpdateStore((s) => s.surface)
  const unasked = useUpdateStore((s) => s.unasked)
  const pending = useUpdateStore((s) => s.pending)
  const problem = useUpdateStore((s) => s.problem)
  const { closeWindow, download, cancelDownload, restartAndUpdate } = useUpdateStore.getState()

  return (
    // Keyed by what is shown, so a failure in one window never takes the next one down with it.
    <ErrorBoundary resetKeys={[surface, state?.offer?.version, state?.whatsNew?.version]} fallback={() => <WindowFailed />}>
      <OfferDialog
        open={surface === 'offer' && state?.offer != null}
        state={state}
        pending={pending}
        problem={problem}
        onClose={closeWindow}
        onDownload={() => void download()}
        onCancel={() => void cancelDownload()}
        onRestart={() => void restartAndUpdate()}
        unasked={unasked}
      />
      <WhatsNewDialog open={surface === 'whats-new' && state?.whatsNew != null} whatsNew={state?.whatsNew ?? null} onClose={closeWindow} unasked={unasked} />
    </ErrorBoundary>
  )
}
