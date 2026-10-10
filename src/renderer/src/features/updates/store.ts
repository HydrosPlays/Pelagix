/**
 * What this page knows about updates: the snapshot the main process owns, which update window is
 * open, and the few things only the page can know (a step it started that has not come back, a
 * restart it refused). Nothing here survives a reload. Whatever must happen once per launch or
 * once per version is remembered by the main process and read from its snapshot.
 */

import { create } from 'zustand'
import type { PelagixApi, ReleaseNote, UpdateState } from '@shared/api'
import { useSaveStore } from '@renderer/store/save'
import { useUiStore } from '@renderer/store/ui'
import { NOTHING_PENDING, type HandledHere, type OfferPending, type OfferProblem, type UpdateSurface } from './model'

/** The update half of the preload bridge. */
export type UpdateBridge = Pick<
  PelagixApi,
  'updateState' | 'onUpdateState' | 'checkForUpdates' | 'downloadUpdate' | 'cancelUpdateDownload' | 'installUpdate' | 'setUpdateAutoCheck' | 'markUpdateAnnounced' | 'dismissWhatsNew'
>

export interface UpdateStoreState {
  /** The latest snapshot; null in a browser and until the first one has arrived. */
  state: UpdateState | null
  surface: UpdateSurface
  /**
   * The window on screen came up by itself, so it must not put the keyboard on one of its
   * buttons: a key on its way to the page would press it. Set when a window opens and left
   * alone for as long as that window is shown.
   */
  unasked: boolean
  handled: HandledHere
  pending: OfferPending
  /** Why the last download or restart asked for here did not go through; cleared by the next attempt. */
  problem: OfferProblem | null
  /** A check the user asked for is running. */
  checking: boolean

  /** Follows the main process: asks for the snapshot, then takes every one it sends. Returns the function that stops it. */
  connect(): () => void
  /** Takes a snapshot in. */
  apply(next: UpdateState): void
  /**
   * Opens the changelog window for the current offer because the user asked for it, and records
   * that it has been shown. The command palette gives way: the window would open underneath it.
   */
  openOffer(): void
  /** Opens a window nobody asked for (see `unasked`). Only the watcher calls this, once nothing is in the way. */
  openByItself(which: 'offer' | 'whats-new'): void
  /** Closes whichever update window is open. Closing "What's new" dismisses it for good. */
  closeWindow(): void
  /** Drops "What's new" without showing it (there were no notes). */
  dismissWhatsNew(): void
  /**
   * Checks now, because the user asked. Never rejects: resolves true once the answer is in the
   * snapshot (a failed check is an answer too), false when the request itself did not get through.
   */
  check(): Promise<boolean>
  download(): Promise<void>
  cancelDownload(): Promise<void>
  /** Saves everything, then asks the main process to close the app and install. Says why in `problem` when it cannot. */
  restartAndUpdate(): Promise<void>
  /** Resolves false when the setting could not be changed. */
  setAutoCheck(enabled: boolean): Promise<boolean>
}

export interface UpdateStoreOptions {
  /** Defaults to `window.api`. Without one (a browser) every action does nothing. */
  bridge?: UpdateBridge
  /** Writes the pending save; true once everything is on disk. Defaults to the save store. */
  flushSave?: () => Promise<boolean>
  /** Whether the entry editor is open. Defaults to the UI store. */
  editorOpen?: () => boolean
  /** Closes the command palette if it is open. Defaults to the UI store. */
  closePalette?: () => void
}

const isSnapshot = (value: unknown): value is UpdateState => typeof value === 'object' && value !== null && typeof (value as UpdateState).phase === 'string'

function sameNotes(a: readonly ReleaseNote[], b: readonly ReleaseNote[]): boolean {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((note, i) => note.version === b[i]?.version && note.body === b[i]?.body && note.name === b[i]?.name && note.publishedAt === b[i]?.publishedAt && note.url === b[i]?.url)
}

/**
 * Every snapshot arrives as a fresh copy, also when only the download progress moved. Notes
 * that did not change keep the array they had, so the windows do not lay them out again on
 * every tick.
 */
function keepNotes(previous: UpdateState | null, next: UpdateState): UpdateState {
  if (previous === null) return next
  let out = next
  if (previous.offer && next.offer && sameNotes(previous.offer.notes, next.offer.notes)) out = { ...out, offer: { ...next.offer, notes: previous.offer.notes } }
  if (previous.whatsNew && next.whatsNew && sameNotes(previous.whatsNew.notes, next.whatsNew.notes)) out = { ...out, whatsNew: { ...next.whatsNew, notes: previous.whatsNew.notes } }
  return out
}

/** Creates an independent update store. The app uses the shared `useUpdateStore`; tests make their own. */
export function createUpdateStore(options: UpdateStoreOptions = {}) {
  const bridge = options.bridge ?? (typeof window === 'undefined' ? undefined : window.api)
  const flushSave = options.flushSave ?? (() => useSaveStore.getState().flush())
  const editorOpen = options.editorOpen ?? (() => useUiStore.getState().entryEditor.open)
  const closePalette = options.closePalette ?? (() => useUiStore.getState().setCommandPalette(false))

  return create<UpdateStoreState>()((set, get) => {
    const setPending = (patch: Partial<OfferPending>): void => set((s) => ({ pending: { ...s.pending, ...patch } }))

    /** Puts a window on screen. How it was opened only counts when it was not there already. */
    function show(surface: 'offer' | 'whats-new', unasked: boolean): void {
      set((s) => (s.surface === surface ? s : { surface, unasked }))
    }

    /** Tells the main process the changelog window has been shown for this version. */
    function announce(version: string): void {
      set((s) => ({ handled: { ...s.handled, offer: version } }))
      // A failure only means the window may open by itself once more after a reload.
      bridge?.markUpdateAnnounced(version).then(get().apply, () => {})
    }

    function showOffer(unasked: boolean): void {
      const offer = get().state?.offer
      if (!offer) return
      show('offer', unasked)
      if (!offer.announced && get().handled.offer !== offer.version) announce(offer.version)
      else set((s) => ({ handled: { ...s.handled, offer: offer.version } }))
    }

    return {
      state: null,
      surface: 'none',
      unasked: false,
      handled: { offer: null, whatsNew: null },
      pending: NOTHING_PENDING,
      problem: null,
      checking: false,

      connect() {
        if (!bridge) return () => {}
        let live = true
        const take = (next: UpdateState): void => {
          if (live) get().apply(next)
        }
        // The request goes out first and the listener is in place before its answer can arrive,
        // so no snapshot falls between the two.
        bridge.updateState().then(take, () => {
          // The next snapshot the main process sends brings the page up to date.
        })
        const stop = bridge.onUpdateState(take)
        return () => {
          live = false
          stop()
        }
      },

      apply(next) {
        if (!isSnapshot(next)) return
        const { surface, handled, problem, pending, state: previous } = get()
        const patch: Partial<UpdateStoreState> = { state: keepNotes(previous, next) }
        // The download asked for here is over, whether or not its own answer has arrived yet.
        if (pending.download && previous?.phase === 'downloading' && next.phase !== 'downloading') patch.pending = { ...pending, download: false }
        // A window whose subject is gone closes; its content stays on screen while it fades.
        if ((surface === 'offer' && next.offer === null) || (surface === 'whats-new' && next.whatsNew === null)) patch.surface = 'none'
        // Notes about a restart or a download are over once the step is under way.
        if (next.phase === 'downloading' || next.phase === 'installing') patch.problem = null
        // The main process names the reason for a failed step better than this page can.
        else if (problem?.type === 'error' && next.error?.during === problem.during) patch.problem = null
        set(patch)
        // A newer version replaced the one on screen: the window now shows that one.
        if (surface === 'offer' && next.offer !== null && !next.offer.announced && next.offer.version !== handled.offer) announce(next.offer.version)
      },

      openOffer() {
        if (!get().state?.offer) return
        closePalette()
        showOffer(false)
      },

      openByItself(which) {
        if (which === 'offer') showOffer(true)
        else if (get().state?.whatsNew) show('whats-new', true)
      },

      closeWindow() {
        const { surface } = get()
        if (surface === 'whats-new') get().dismissWhatsNew()
        if (surface !== 'none') set({ surface: 'none', problem: null })
      },

      dismissWhatsNew() {
        const whatsNew = get().state?.whatsNew
        if (!whatsNew) return
        set((s) => ({ handled: { ...s.handled, whatsNew: whatsNew.version } }))
        // A failure only means it is offered again at the next start.
        bridge?.dismissWhatsNew().then(get().apply, () => {})
      },

      async check() {
        // In mode "off" there is nothing to ask, and a check already running is the one to wait for.
        if (!bridge || get().checking || get().state?.mode === 'off') return false
        set({ checking: true })
        try {
          const next = await bridge.checkForUpdates()
          get().apply(next)
          return isSnapshot(next)
        } catch {
          return false
        } finally {
          set({ checking: false })
        }
      },

      async download() {
        // Only the installed copy downloads; the main process refuses the others as well.
        if (!bridge || get().pending.download || get().state?.mode !== 'auto') return
        set({ problem: null })
        setPending({ download: true })
        try {
          get().apply(await bridge.downloadUpdate())
        } catch {
          set({ problem: { type: 'error', kind: 'unknown', during: 'download' } })
        } finally {
          setPending({ download: false })
        }
      },

      async cancelDownload() {
        if (!bridge || get().pending.cancel) return
        setPending({ cancel: true })
        try {
          get().apply(await bridge.cancelUpdateDownload())
        } catch {
          // Nothing to say: the window keeps showing the download, which is what is happening.
        } finally {
          setPending({ cancel: false })
        }
      },

      async restartAndUpdate() {
        if (!bridge || get().pending.restart || get().state?.mode !== 'auto') return
        // The draft in the entry editor exists only in memory, and the app is about to close.
        if (editorOpen()) {
          set({ problem: { type: 'editor-open' } })
          return
        }
        set({ problem: null })
        setPending({ restart: true })
        try {
          let saved = false
          try {
            saved = (await flushSave()) === true
          } catch {
            saved = false
          }
          if (!saved) {
            set({ problem: { type: 'not-saved' } })
            return
          }
          // The editor may have been opened while the save was being written.
          if (editorOpen()) {
            set({ problem: { type: 'editor-open' } })
            return
          }
          try {
            await bridge.installUpdate()
            // The app closes within a moment. Until then the snapshot's "installing" phase keeps the window as it is.
          } catch {
            // The snapshot names the reason when the main process knows one.
            if (get().state?.error?.during !== 'install') set({ problem: { type: 'error', kind: 'unknown', during: 'install' } })
          }
        } finally {
          setPending({ restart: false })
        }
      },

      async setAutoCheck(enabled) {
        if (!bridge) return false
        try {
          get().apply(await bridge.setUpdateAutoCheck(enabled))
          return true
        } catch {
          return false
        }
      }
    }
  })
}

/** The app's update store. Actions are stable: call them as `useUpdateStore.getState().check()` or select them. */
export const useUpdateStore = createUpdateStore()
