import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_DEX_VIEW, LAST_CAPTURE_MS, MAX_TOASTS, toast, TOAST_ACTION_MIN_MS, TOAST_DURATIONS, UI_STORAGE_KEY, useUiStore } from './ui'

const ui = useUiStore.getState
const initial = useUiStore.getInitialState()

beforeEach(() => {
  useUiStore.setState(initial, true)
})

describe('toasts', () => {
  it('push returns an id and appends with the default duration of its kind', () => {
    const a = ui().push({ kind: 'success', title: 'Saved' })
    const b = ui().push({ kind: 'error', title: 'Failed', body: 'Disk full', icon: 'alert' })
    expect(a).not.toBe(b)
    expect(ui().toasts.map((t) => t.id)).toEqual([a, b])
    expect(ui().toasts[0]).toMatchObject({ kind: 'success', title: 'Saved', durationMs: TOAST_DURATIONS.success })
    expect(ui().toasts[1]).toMatchObject({ kind: 'error', body: 'Disk full', icon: 'alert', durationMs: TOAST_DURATIONS.error })
    expect(typeof ui().toasts[0]?.createdAt).toBe('number')
  })

  it('keeps an explicit duration, including 0 for sticky', () => {
    ui().push({ kind: 'info', title: 'Sticky', durationMs: 0 })
    ui().push({ kind: 'achievement', title: 'Unlocked', durationMs: 12_000 })
    expect(ui().toasts.map((t) => t.durationMs)).toEqual([0, 12_000])
  })

  it('dismiss removes one toast and ignores unknown ids', () => {
    const a = ui().push({ kind: 'info', title: 'A' })
    const b = ui().push({ kind: 'info', title: 'B' })
    const before = ui().toasts
    ui().dismiss('nope')
    expect(ui().toasts).toBe(before)
    ui().dismiss(a)
    expect(ui().toasts.map((t) => t.id)).toEqual([b])
  })

  it('drops the oldest beyond the cap', () => {
    const ids = Array.from({ length: MAX_TOASTS + 3 }, (_, i) => ui().push({ kind: 'info', title: `T${i}` }))
    expect(ui().toasts.map((t) => t.id)).toEqual(ids.slice(3))
  })

  it('clearToasts empties the list; toast() is a shorthand for push', () => {
    const id = toast({ kind: 'achievement', title: 'First catch' })
    expect(ui().toasts.map((t) => t.id)).toEqual([id])
    ui().clearToasts()
    expect(ui().toasts).toEqual([])
  })
})

describe('toast actions', () => {
  it('keeps the action on the toast and leaves toasts without one untouched', () => {
    const onSelect = vi.fn()
    const withAction = ui().push({ kind: 'info', title: 'Entry deleted', action: { label: 'Undo', onSelect } })
    const plain = ui().push({ kind: 'info', title: 'Plain' })
    const [a, b] = ui().toasts
    expect(a).toMatchObject({ id: withAction, action: { label: 'Undo', onSelect } })
    expect(a?.actionTaken).toBeUndefined()
    expect(b?.id).toBe(plain)
    expect(b?.action).toBeUndefined()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('gives a toast with an action more time by default, but never overrides an explicit duration', () => {
    const action = { label: 'Undo', onSelect: () => {} }
    ui().push({ kind: 'info', title: 'A', action })
    ui().push({ kind: 'success', title: 'B', action })
    ui().push({ kind: 'error', title: 'C', action })
    ui().push({ kind: 'info', title: 'D', action, durationMs: 1500 })
    ui().push({ kind: 'info', title: 'E', action, durationMs: 0 })
    expect(TOAST_ACTION_MIN_MS).toBeGreaterThan(TOAST_DURATIONS.info)
    expect(ui().toasts.map((t) => t.durationMs)).toEqual([TOAST_ACTION_MIN_MS, TOAST_ACTION_MIN_MS, TOAST_DURATIONS.error, 1500, 0])
  })

  it('runs the action exactly once and keeps the toast for its exit', () => {
    const onSelect = vi.fn()
    const id = ui().push({ kind: 'info', title: 'Entry deleted', action: { label: 'Undo', onSelect } })
    expect(ui().runToastAction(id)).toBe(true)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(ui().toasts.map((t) => t.id)).toEqual([id])
    expect(ui().toasts[0]).toMatchObject({ actionTaken: true, action: { label: 'Undo' } })

    expect(ui().runToastAction(id)).toBe(false)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('returns false for a toast without an action, an unknown id and a dismissed toast', () => {
    const onSelect = vi.fn()
    const plain = ui().push({ kind: 'success', title: 'Saved' })
    const gone = ui().push({ kind: 'info', title: 'Gone', action: { label: 'Undo', onSelect } })
    const before = ui().toasts
    expect(ui().runToastAction(plain)).toBe(false)
    expect(ui().runToastAction('nope')).toBe(false)
    expect(ui().toasts).toBe(before)
    ui().dismiss(gone)
    expect(ui().runToastAction(gone)).toBe(false)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('dismissing or clearing never runs an action', () => {
    const onSelect = vi.fn()
    const a = ui().push({ kind: 'info', title: 'A', action: { label: 'Undo', onSelect } })
    ui().push({ kind: 'info', title: 'B', action: { label: 'Undo', onSelect } })
    ui().dismiss(a)
    ui().clearToasts()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('counts as taken even when the handler throws, and only touches its own toast', () => {
    const other = ui().push({ kind: 'info', title: 'Other', action: { label: 'View', onSelect: () => {} } })
    const id = ui().push({
      kind: 'error',
      title: 'Broken',
      action: {
        label: 'Retry',
        onSelect: () => {
          throw new Error('boom')
        }
      }
    })
    expect(() => ui().runToastAction(id)).toThrow('boom')
    expect(ui().toasts.find((t) => t.id === id)?.actionTaken).toBe(true)
    expect(ui().toasts.find((t) => t.id === other)?.actionTaken).toBeUndefined()
    expect(ui().runToastAction(id)).toBe(false)
  })

  it('an action may push or dismiss toasts itself', () => {
    const id = ui().push({ kind: 'info', title: 'Entry deleted', action: { label: 'Undo', onSelect: () => void toast({ kind: 'success', title: 'Entry restored' }) } })
    expect(ui().runToastAction(id)).toBe(true)
    expect(ui().toasts.map((t) => t.title)).toEqual(['Entry deleted', 'Entry restored'])

    const self = ui().push({ kind: 'info', title: 'Self', action: { label: 'Close', onSelect: () => ui().dismiss(self) } })
    expect(ui().runToastAction(self)).toBe(true)
    expect(ui().toasts.some((t) => t.id === self)).toBe(false)
  })
})

describe('entry editor', () => {
  it('opens for a new catch with a preset, for an existing entry, and closes', () => {
    expect(ui().entryEditor).toEqual({ open: false })
    ui().openCreate({ species: 25, form: 0, game: 'yellow', shiny: true })
    expect(ui().entryEditor).toEqual({ open: true, mode: 'create', preset: { species: 25, form: 0, game: 'yellow', shiny: true } })
    ui().openEdit('entry-1')
    expect(ui().entryEditor).toEqual({ open: true, mode: 'edit', entryId: 'entry-1' })
    ui().closeEditor()
    expect(ui().entryEditor).toEqual({ open: false })
  })

  it('closes the command palette when it opens', () => {
    ui().setCommandPalette(true)
    ui().openCreate({ species: 1, form: 0 })
    expect(ui().commandPalette).toBe(false)
    ui().setCommandPalette(true)
    ui().openEdit('x')
    expect(ui().commandPalette).toBe(false)
  })

  it('closeEditor on a closed editor changes nothing', () => {
    const listener = vi.fn()
    const off = useUiStore.subscribe((s) => s.entryEditor, listener)
    ui().closeEditor()
    expect(listener).not.toHaveBeenCalled()
    off()
  })
})

describe('command palette', () => {
  it('opens, closes and toggles', () => {
    expect(ui().commandPalette).toBe(false)
    ui().setCommandPalette(true)
    expect(ui().commandPalette).toBe(true)
    ui().toggleCommandPalette()
    expect(ui().commandPalette).toBe(false)
    ui().toggleCommandPalette()
    expect(ui().commandPalette).toBe(true)
  })
})

describe('last capture', () => {
  it('is handed out exactly once', () => {
    expect(ui().consumeLastCapture()).toBeNull()
    ui().setLastCapture('entry-9')
    expect(ui().lastCapture).toBe('entry-9')
    expect(ui().consumeLastCapture()).toBe('entry-9')
    expect(ui().consumeLastCapture()).toBeNull()
    expect(ui().lastCapture).toBeNull()
  })

  it('lapses when no page celebrates it in time', () => {
    vi.useFakeTimers()
    try {
      ui().setLastCapture('entry-1')
      vi.advanceTimersByTime(LAST_CAPTURE_MS - 1)
      expect(ui().lastCapture).toBe('entry-1')
      // A newer catch starts its own clock.
      ui().setLastCapture('entry-2')
      vi.advanceTimersByTime(LAST_CAPTURE_MS - 1)
      expect(ui().lastCapture).toBe('entry-2')
      vi.advanceTimersByTime(1)
      expect(ui().lastCapture).toBeNull()
      expect(ui().consumeLastCapture()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('dex view preferences', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('defaults to normal renders and a comfortable grid', () => {
    expect(ui().dexView).toEqual(DEFAULT_DEX_VIEW)
    expect(DEFAULT_DEX_VIEW).toEqual({ shinyView: false, density: 'comfortable' })
  })

  it('merges patches', () => {
    ui().setDexView({ shinyView: true })
    expect(ui().dexView).toEqual({ shinyView: true, density: 'comfortable' })
    ui().setDexView({ density: 'compact' })
    expect(ui().dexView).toEqual({ shinyView: true, density: 'compact' })
  })

  function fakeLocalStorage(initialItems: Record<string, string> = {}) {
    const items = new Map(Object.entries(initialItems))
    return { items, getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v) }
  }

  it('remembers them in localStorage', async () => {
    const storage = fakeLocalStorage()
    vi.stubGlobal('localStorage', storage)
    vi.resetModules()
    const fresh = await import('./ui')
    fresh.useUiStore.getState().setDexView({ density: 'compact' })
    expect(JSON.parse(storage.items.get(UI_STORAGE_KEY)!)).toEqual({ dexView: { shinyView: false, density: 'compact' } })

    vi.resetModules()
    const reloaded = await import('./ui')
    expect(reloaded.useUiStore.getState().dexView).toEqual({ shinyView: false, density: 'compact' })
  })

  it('ignores stored junk', async () => {
    for (const junk of ['{not json', '"text"', '{"dexView":{"shinyView":"yes","density":"huge"}}', 'null']) {
      vi.stubGlobal('localStorage', fakeLocalStorage({ [UI_STORAGE_KEY]: junk }))
      vi.resetModules()
      const fresh = await import('./ui')
      expect(fresh.useUiStore.getState().dexView, junk).toEqual(DEFAULT_DEX_VIEW)
    }
  })

  it('keeps working when storage throws', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      }
    })
    vi.resetModules()
    const fresh = await import('./ui')
    expect(fresh.useUiStore.getState().dexView).toEqual(DEFAULT_DEX_VIEW)
    fresh.useUiStore.getState().setDexView({ shinyView: true })
    expect(fresh.useUiStore.getState().dexView.shinyView).toBe(true)
  })
})
