import { useEffect, useRef } from 'react'
import type { UpdatePhase } from '@shared/api'
import { useLayerOpen } from '@renderer/components/ui/layers'
import { useUiStore } from '@renderer/store/ui'
import { autoAction, transitionToast, type AutoAction } from './model'
import { useUpdateStore } from './store'
import { toastDownloadFailed, toastReady, toastUpdated } from './toasts'

/** Quiet period before a window opens by itself: after start-up, and after whatever was in its way has closed. */
const SETTLE_MS = 1200
/** A window never opens under the user's hands: it waits for this long without a key or mouse press. */
const QUIET_MS = 2500

function run(action: AutoAction): void {
  const store = useUpdateStore.getState()
  if (action === 'whats-new' || action === 'offer') store.openByItself(action)
  else if (action === 'updated-toast') {
    const whatsNew = store.state?.whatsNew
    if (!whatsNew) return
    toastUpdated(whatsNew)
    store.dismissWhatsNew()
  }
}

/**
 * Follows the update state of the main process and decides when an update window opens by
 * itself. Mounted once by `App`, in the desktop app only; renders nothing.
 *
 * Nothing is decided "once" here: the page can be reloaded while the main process runs on, so
 * whether an offer was already shown (`offer.announced`) and whether "What's new" is still owed
 * (`whatsNew`) come from its snapshot. A check that finds nothing, or fails in the background,
 * never opens a window or a toast.
 *
 * `hold` keeps every window back for as long as it is true (the app is still loading).
 */
export default function UpdateWatcher({ hold = false }: { hold?: boolean }) {
  const state = useUpdateStore((s) => s.state)
  const surface = useUpdateStore((s) => s.surface)
  const handled = useUpdateStore((s) => s.handled)
  const editorOpen = useUiStore((s) => s.entryEditor.open)
  const paletteOpen = useUiStore((s) => s.commandPalette)
  const layerOpen = useLayerOpen()
  const lastInput = useRef<number | null>(null)
  const lastPhase = useRef<UpdatePhase | null>(null)

  // The cleanup unsubscribes: in development StrictMode runs this effect twice.
  useEffect(() => useUpdateStore.getState().connect(), [])

  useEffect(() => {
    const note = (): void => {
      lastInput.current = performance.now()
    }
    window.addEventListener('keydown', note, true)
    window.addEventListener('pointerdown', note, true)
    return () => {
      window.removeEventListener('keydown', note, true)
      window.removeEventListener('pointerdown', note, true)
    }
  }, [])

  // Opens "What's new" or the changelog of an offer once nothing is in the way. Every input of
  // the decision is a dependency, so the timer starts over when a dialog opens or closes.
  const action = hold ? 'none' : autoAction(state, surface, { layerOpen, editorOpen, paletteOpen, recentInput: false }, handled)
  const subject = action === 'offer' ? state?.offer?.version : action === 'none' ? undefined : state?.whatsNew?.version
  useEffect(() => {
    if (action === 'none') return
    let timer: ReturnType<typeof setTimeout>
    const attempt = (): void => {
      const quiet = lastInput.current === null ? QUIET_MS : performance.now() - lastInput.current
      if (quiet < QUIET_MS) timer = setTimeout(attempt, QUIET_MS - quiet + 50)
      else run(action)
    }
    timer = setTimeout(attempt, SETTLE_MS)
    return () => clearTimeout(timer)
  }, [action, subject])

  // A download the user started has ended while the changelog window was closed.
  useEffect(() => {
    const previous = lastPhase.current
    lastPhase.current = state?.phase ?? null
    if (!state?.offer) return
    const store = useUpdateStore.getState()
    const ended = transitionToast(previous, state, store.surface)
    if (ended === 'ready') {
      toastReady(state.offer.version, () => {
        // The window shows the restart, or says why it could not happen.
        store.openOffer()
        void store.restartAndUpdate()
      })
    } else if (ended === 'download-failed' && state.error) {
      toastDownloadFailed(state.offer.version, state.error, store.openOffer)
    }
  }, [state])

  return null
}
