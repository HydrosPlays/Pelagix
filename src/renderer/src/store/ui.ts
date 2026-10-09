/**
 * Cross-feature UI state: toasts, the entry editor, the command palette, dex view preferences and
 * the "just captured" marker. Nothing here belongs in the save file; only the dex view
 * preferences are remembered (per device, in localStorage).
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { CatchEntry } from '@shared/save-types'
import { newId } from '@renderer/lib/id'

// ---------------------------------------------------------------- toasts

export type ToastKind = 'info' | 'success' | 'error' | 'achievement'

/** One button inside a toast ("Undo", "View"). Activating it runs `onSelect` once, then the toast goes away. */
export interface ToastAction {
  label: string
  onSelect: () => void
}

export interface ToastInput {
  kind: ToastKind
  title: string
  body?: string
  /** Free-form icon hint for the toast renderer: an icon name, an image URL or an achievement id. */
  icon?: string
  /** How long it stays up. Defaults per kind (longer when there is an action); 0 keeps it until dismissed. */
  durationMs?: number
  /** Optional button, e.g. `{ label: 'Undo', onSelect: restore }`. */
  action?: ToastAction
}

export interface Toast extends ToastInput {
  id: string
  durationMs: number
  /** `Date.now()` when it was pushed. */
  createdAt: number
  /** The action has been run; it cannot run a second time. */
  actionTaken?: boolean
}

/** Default lifetime per kind, in milliseconds. The toast renderer owns the timers. */
export const TOAST_DURATIONS: Readonly<Record<ToastKind, number>> = { info: 4000, success: 3500, error: 8000, achievement: 7000 }
/** A toast that offers an action stays at least this long by default, so there is time to reach the button. */
export const TOAST_ACTION_MIN_MS = 7000
/** Oldest toasts are dropped beyond this many. */
export const MAX_TOASTS = 6

// ---------------------------------------------------------------- entry editor

/** Fields the editor starts from when logging a new catch. Species and form are always known. */
export type EntryPreset = Partial<CatchEntry> & { species: number; form: number }

export type EntryEditorState =
  | { open: false }
  | { open: true; mode: 'create'; preset: EntryPreset }
  | { open: true; mode: 'edit'; entryId: string }

// ---------------------------------------------------------------- dex view

export type DexDensity = 'comfortable' | 'compact'

export interface DexViewPrefs {
  /** Show shiny renders in the dex grid. */
  shinyView: boolean
  density: DexDensity
}

export const DEFAULT_DEX_VIEW: DexViewPrefs = { shinyView: false, density: 'comfortable' }
export const UI_STORAGE_KEY = 'pelagix.ui.v1'

function readDexView(): DexViewPrefs {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_DEX_VIEW
    const raw: unknown = JSON.parse(localStorage.getItem(UI_STORAGE_KEY) ?? 'null')
    const stored = (raw as { dexView?: Partial<DexViewPrefs> } | null)?.dexView
    return {
      shinyView: typeof stored?.shinyView === 'boolean' ? stored.shinyView : DEFAULT_DEX_VIEW.shinyView,
      density: stored?.density === 'compact' || stored?.density === 'comfortable' ? stored.density : DEFAULT_DEX_VIEW.density
    }
  } catch {
    return DEFAULT_DEX_VIEW
  }
}

function writeDexView(dexView: DexViewPrefs): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ dexView }))
  } catch {
    // Preferences are a convenience; a full or blocked storage is not worth an error.
  }
}

// ---------------------------------------------------------------- store

export interface UiState {
  /** Oldest first. */
  toasts: readonly Toast[]
  /** Shows a toast and returns its id. */
  push(toast: ToastInput): string
  dismiss(id: string): void
  clearToasts(): void
  /**
   * Runs the action of a toast, once: true when it ran, false when the toast is gone, has no
   * action or already ran it. The toast stays in the list (the renderer plays its exit, then
   * dismisses it); call `dismiss` yourself when running an action from anywhere else.
   */
  runToastAction(id: string): boolean

  entryEditor: EntryEditorState
  /** Opens the editor to log a new catch, pre-filled from `preset`. */
  openCreate(preset: EntryPreset): void
  /** Opens the editor on an existing entry. */
  openEdit(entryId: string): void
  closeEditor(): void

  /** The command palette is open. */
  commandPalette: boolean
  setCommandPalette(open: boolean): void
  toggleCommandPalette(): void

  dexView: DexViewPrefs
  setDexView(patch: Partial<DexViewPrefs>): void

  /**
   * Id of the entry that was just logged, until a page has celebrated it. "Just" is taken
   * literally: it lapses after `LAST_CAPTURE_MS`, so a page opened much later does not celebrate
   * a catch that is old news by then.
   */
  lastCapture: string | null
  setLastCapture(entryId: string | null): void
  /** Returns the pending capture id and clears it, so exactly one caller gets to celebrate. */
  consumeLastCapture(): string | null
}

/** How long a logged entry counts as "just logged" for the pages that celebrate it. */
export const LAST_CAPTURE_MS = 90_000

let captureTimer: ReturnType<typeof setTimeout> | undefined

export const useUiStore = create<UiState>()(
  subscribeWithSelector((set, get) => ({
    toasts: [],
    push(toast) {
      const id = newId()
      const fallback = toast.action ? Math.max(TOAST_DURATIONS[toast.kind], TOAST_ACTION_MIN_MS) : TOAST_DURATIONS[toast.kind]
      const full: Toast = { ...toast, id, durationMs: toast.durationMs ?? fallback, createdAt: Date.now() }
      set((s) => ({ toasts: [...s.toasts, full].slice(-MAX_TOASTS) }))
      return id
    },
    dismiss(id) {
      set((s) => (s.toasts.some((t) => t.id === id) ? { toasts: s.toasts.filter((t) => t.id !== id) } : s))
    },
    clearToasts() {
      if (get().toasts.length > 0) set({ toasts: [] })
    },
    runToastAction(id) {
      const target = get().toasts.find((t) => t.id === id)
      if (!target?.action || target.actionTaken) return false
      // Marked first, so a handler that throws or a second click can never run it twice.
      set((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, actionTaken: true } : t)) }))
      target.action.onSelect()
      return true
    },

    entryEditor: { open: false },
    openCreate(preset) {
      set({ entryEditor: { open: true, mode: 'create', preset }, commandPalette: false })
    },
    openEdit(entryId) {
      set({ entryEditor: { open: true, mode: 'edit', entryId }, commandPalette: false })
    },
    closeEditor() {
      if (get().entryEditor.open) set({ entryEditor: { open: false } })
    },

    commandPalette: false,
    setCommandPalette(open) {
      if (get().commandPalette !== open) set({ commandPalette: open })
    },
    toggleCommandPalette() {
      set((s) => ({ commandPalette: !s.commandPalette }))
    },

    dexView: readDexView(),
    setDexView(patch) {
      const dexView = { ...get().dexView, ...patch }
      set({ dexView })
      writeDexView(dexView)
    },

    lastCapture: null,
    setLastCapture(entryId) {
      clearTimeout(captureTimer)
      captureTimer = undefined
      set({ lastCapture: entryId })
      if (entryId === null) return
      captureTimer = setTimeout(() => {
        captureTimer = undefined
        if (get().lastCapture === entryId) set({ lastCapture: null })
      }, LAST_CAPTURE_MS)
      // Never the reason a process stays alive (tests, scripts).
      ;(captureTimer as { unref?: () => void }).unref?.()
    },
    consumeLastCapture() {
      const id = get().lastCapture
      if (id !== null) {
        clearTimeout(captureTimer)
        captureTimer = undefined
        set({ lastCapture: null })
      }
      return id
    }
  }))
)

/** Shorthand for pushing a toast from anywhere (event handlers, stores, effects). */
export function toast(input: ToastInput): string {
  return useUiStore.getState().push(input)
}
