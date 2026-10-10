import { describe, expect, it, vi } from 'vitest'
import type { UpdateState } from '@shared/api'
import { fixtureState, fixtureWhatsNew } from './fixtures/preview'
import { createUpdateStore, type UpdateBridge } from './store'

/** A stand-in for the preload bridge: records every call and lets the test push snapshots. */
function fakeBridge(initial: UpdateState = fixtureState({ notes: null })) {
  let current = initial
  const listeners = new Set<(state: UpdateState) => void>()
  const calls: string[] = []
  const answer = (name: string): Promise<UpdateState> => {
    calls.push(name)
    return Promise.resolve(current)
  }
  const bridge = {
    updateState: vi.fn(() => answer('updateState')),
    onUpdateState: vi.fn((listener: (state: UpdateState) => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }),
    checkForUpdates: vi.fn(() => answer('checkForUpdates')),
    downloadUpdate: vi.fn(() => answer('downloadUpdate')),
    cancelUpdateDownload: vi.fn(() => answer('cancelUpdateDownload')),
    installUpdate: vi.fn((): Promise<void> => {
      calls.push('installUpdate')
      return Promise.resolve()
    }),
    setUpdateAutoCheck: vi.fn((enabled: boolean) => {
      current = { ...current, autoCheck: enabled }
      return answer('setUpdateAutoCheck')
    }),
    markUpdateAnnounced: vi.fn((version: string) => {
      if (current.offer?.version === version) current = { ...current, offer: { ...current.offer, announced: true } }
      return answer('markUpdateAnnounced')
    }),
    dismissWhatsNew: vi.fn(() => {
      current = { ...current, whatsNew: null }
      return answer('dismissWhatsNew')
    })
  } satisfies UpdateBridge
  return {
    bridge,
    calls,
    listeners,
    /** What the main process holds now; the next call resolves with it. */
    set(next: UpdateState): void {
      current = next
    },
    /** The main process sends a snapshot. */
    push(next: UpdateState): void {
      current = next
      for (const listener of [...listeners]) listener(next)
    }
  }
}

function setup(initial?: UpdateState, options: { flushSave?: () => Promise<boolean>; editorOpen?: () => boolean } = {}) {
  const main = fakeBridge(initial)
  const flushSave = vi.fn(options.flushSave ?? (() => Promise.resolve(true)))
  const editorOpen = vi.fn(options.editorOpen ?? (() => false))
  const closePalette = vi.fn()
  const store = createUpdateStore({ bridge: main.bridge, flushSave, editorOpen, closePalette })
  return { main, store, flushSave, editorOpen, closePalette, get: store.getState }
}

/** Lets promise callbacks that are already queued run. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

const unannounced = (): UpdateState => fixtureState({ announced: false })

describe('connect', () => {
  it('asks for the snapshot, then follows every one the main process sends', async () => {
    const { main, get } = setup(fixtureState({ notes: null }))
    const stop = get().connect()
    expect(main.bridge.updateState).toHaveBeenCalledTimes(1)
    // The listener is in place before the answer to the request can arrive.
    expect(main.listeners.size).toBe(1)
    expect(get().state).toBeNull()
    await settle()
    expect(get().state?.phase).toBe('available')
    main.push(fixtureState({ phase: 'downloading' }))
    expect(get().state?.phase).toBe('downloading')
    stop()
  })

  it('unsubscribes, and ignores an answer that arrives after it has stopped', async () => {
    const { main, get } = setup()
    const stop = get().connect()
    stop()
    expect(main.listeners.size).toBe(0)
    await settle()
    expect(get().state).toBeNull()
  })

  it('leaves exactly one listener when it is started twice, as StrictMode does in development', async () => {
    const { main, get } = setup(fixtureState())
    get().connect()()
    const stop = get().connect()
    expect(main.listeners.size).toBe(1)
    await settle()
    expect(get().state?.offer?.version).toBe('0.3.0')
    stop()
    expect(main.listeners.size).toBe(0)
  })

  it('carries on when the first request fails: the next snapshot brings the page up to date', async () => {
    const { main, get } = setup()
    main.bridge.updateState.mockImplementationOnce(() => Promise.reject(new Error('gone')))
    get().connect()
    await settle()
    expect(get().state).toBeNull()
    main.push(fixtureState())
    expect(get().state?.phase).toBe('available')
  })

  it('does nothing in a browser', async () => {
    const store = createUpdateStore({ bridge: undefined, flushSave: () => Promise.resolve(true), editorOpen: () => false })
    const stop = store.getState().connect()
    expect(await store.getState().check()).toBe(false)
    await store.getState().download()
    await store.getState().cancelDownload()
    await store.getState().restartAndUpdate()
    expect(await store.getState().setAutoCheck(false)).toBe(false)
    store.getState().openOffer()
    store.getState().openByItself('whats-new')
    store.getState().closeWindow()
    stop()
    expect(store.getState()).toMatchObject({ state: null, surface: 'none', problem: null, checking: false })
  })
})

describe('apply', () => {
  it('ignores anything that is not a snapshot', () => {
    const { get } = setup()
    get().apply(fixtureState())
    const before = get().state
    for (const junk of [null, undefined, 'state', 42, {}, []]) get().apply(junk as unknown as UpdateState)
    expect(get().state).toBe(before)
  })

  it('keeps the notes it already has when a new snapshot carries the same ones', () => {
    const { get } = setup()
    get().apply(fixtureState({ whatsNew: fixtureWhatsNew('real') }))
    const notes = get().state?.offer?.notes
    const whatsNew = get().state?.whatsNew?.notes
    // A copy, as every snapshot is after crossing from the main process.
    get().apply(structuredClone(fixtureState({ phase: 'downloading', percent: 10, whatsNew: fixtureWhatsNew('real') })))
    expect(get().state?.phase).toBe('downloading')
    expect(get().state?.offer?.notes).toBe(notes)
    expect(get().state?.whatsNew?.notes).toBe(whatsNew)
    // Different notes replace them.
    get().apply(fixtureState({ notes: 'real' }))
    expect(get().state?.offer?.notes).not.toBe(notes)
    expect(get().state?.offer?.notes[0]?.version).toBe('0.1.0')
  })

  it('closes a window whose subject is gone', () => {
    const { get } = setup()
    get().apply(fixtureState())
    get().openOffer()
    expect(get().surface).toBe('offer')
    get().apply(fixtureState({ notes: null }))
    expect(get().surface).toBe('none')

    get().apply(fixtureState({ notes: null, whatsNew: fixtureWhatsNew() }))
    get().openByItself('whats-new')
    expect(get().surface).toBe('whats-new')
    get().apply(fixtureState({ notes: null }))
    expect(get().surface).toBe('none')
  })

  it('drops the note about a refused restart once a step is under way', () => {
    const { get } = setup(undefined, { editorOpen: () => true })
    get().apply(fixtureState({ phase: 'ready' }))
    void get().restartAndUpdate()
    expect(get().problem).toEqual({ type: 'editor-open' })
    get().apply(fixtureState({ phase: 'ready' }))
    expect(get().problem).toEqual({ type: 'editor-open' })
    get().apply(fixtureState({ phase: 'installing' }))
    expect(get().problem).toBeNull()
  })
})

describe('the changelog window', () => {
  it('opens only when there is an offer', () => {
    const { main, get } = setup()
    get().openOffer()
    expect(get().surface).toBe('none')
    get().apply(fixtureState({ notes: null }))
    get().openOffer()
    expect(get().surface).toBe('none')
    expect(main.bridge.markUpdateAnnounced).not.toHaveBeenCalled()
  })

  it('tells the main process once that it has been shown for this version', async () => {
    const { main, get } = setup(unannounced())
    get().apply(unannounced())
    get().openOffer()
    expect(get().surface).toBe('offer')
    expect(get().handled.offer).toBe('0.3.0')
    expect(main.bridge.markUpdateAnnounced).toHaveBeenCalledTimes(1)
    expect(main.bridge.markUpdateAnnounced).toHaveBeenCalledWith('0.3.0')
    // Closed and opened again before the main process has answered: still one call.
    get().closeWindow()
    get().openOffer()
    expect(main.bridge.markUpdateAnnounced).toHaveBeenCalledTimes(1)
    await settle()
    expect(get().state?.offer?.announced).toBe(true)
    get().closeWindow()
    get().openOffer()
    expect(main.bridge.markUpdateAnnounced).toHaveBeenCalledTimes(1)
  })

  it('does not report an offer the main process already knows was shown', () => {
    const { main, get } = setup(fixtureState({ announced: true }))
    get().apply(fixtureState({ announced: true }))
    get().openOffer()
    expect(get().surface).toBe('offer')
    expect(main.bridge.markUpdateAnnounced).not.toHaveBeenCalled()
  })

  it('reports a newer version that replaces the one on screen', () => {
    const { main, get } = setup(unannounced())
    get().apply(unannounced())
    get().openOffer()
    const next = unannounced()
    get().apply({ ...next, offer: { ...next.offer!, version: '0.3.1' } })
    expect(main.bridge.markUpdateAnnounced).toHaveBeenLastCalledWith('0.3.1')
    expect(get().handled.offer).toBe('0.3.1')
    expect(get().surface).toBe('offer')
  })

  it('keeps working when reporting it fails', async () => {
    const { main, get } = setup(unannounced())
    main.bridge.markUpdateAnnounced.mockImplementationOnce(() => Promise.reject(new Error('gone')))
    get().apply(unannounced())
    get().openOffer()
    await settle()
    expect(get().surface).toBe('offer')
    expect(get().handled.offer).toBe('0.3.0')
  })

  it('remembers whether it came up by itself, for as long as it stays on screen', () => {
    const { get, closePalette } = setup(fixtureState({ announced: true }))
    get().apply(fixtureState({ announced: true }))
    // Opened by the watcher: nobody asked, so the window must not put the keyboard on a button.
    get().openByItself('offer')
    expect(get()).toMatchObject({ surface: 'offer', unasked: true })
    expect(closePalette).not.toHaveBeenCalled()
    // A toast's "Restart" asks for the window that is already there: how it opened does not change under it.
    get().openOffer()
    expect(get()).toMatchObject({ surface: 'offer', unasked: true })
    // Still the same while it fades out, and decided anew the next time it opens.
    get().closeWindow()
    expect(get()).toMatchObject({ surface: 'none', unasked: true })
    get().openOffer()
    expect(get()).toMatchObject({ surface: 'offer', unasked: false })
    get().openByItself('offer')
    expect(get().unasked).toBe(false)
  })

  it('reports a window that opened by itself to the main process like any other', () => {
    const { main, get } = setup(unannounced())
    get().apply(unannounced())
    get().openByItself('offer')
    expect(main.bridge.markUpdateAnnounced).toHaveBeenCalledWith('0.3.0')
    expect(get().handled.offer).toBe('0.3.0')
  })

  it('closes the command palette when the user asks for it, and only then', () => {
    // The palette sits above every dialog: the window would open underneath it and take the keyboard unseen.
    const { get, closePalette } = setup()
    get().openOffer()
    expect(closePalette).not.toHaveBeenCalled()
    get().apply(fixtureState({ announced: true }))
    get().openByItself('offer')
    get().closeWindow()
    expect(closePalette).not.toHaveBeenCalled()
    get().openOffer()
    expect(closePalette).toHaveBeenCalledTimes(1)
  })

  it('takes over from "What’s new" as a window of its own', () => {
    const both = fixtureState({ announced: true, whatsNew: fixtureWhatsNew() })
    const { get } = setup(both)
    get().apply(both)
    get().openByItself('whats-new')
    expect(get()).toMatchObject({ surface: 'whats-new', unasked: true })
    get().openOffer()
    expect(get()).toMatchObject({ surface: 'offer', unasked: false })
  })

  it('closing it never stops a download', async () => {
    const { main, get } = setup(fixtureState({ phase: 'downloading' }))
    get().apply(fixtureState({ phase: 'downloading' }))
    get().openOffer()
    get().closeWindow()
    await settle()
    expect(get().surface).toBe('none')
    expect(main.bridge.cancelUpdateDownload).not.toHaveBeenCalled()
    expect(get().state?.phase).toBe('downloading')
  })
})

describe("what's new", () => {
  it('opens only when there is something to show, and is dismissed for good when closed', async () => {
    const { main, get } = setup(fixtureState({ notes: null, whatsNew: fixtureWhatsNew() }))
    get().openByItself('whats-new')
    expect(get().surface).toBe('none')
    get().apply(fixtureState({ notes: null, whatsNew: fixtureWhatsNew() }))
    get().openByItself('whats-new')
    expect(get().surface).toBe('whats-new')

    get().closeWindow()
    expect(get().surface).toBe('none')
    expect(get().handled.whatsNew).toBe('0.3.0')
    expect(main.bridge.dismissWhatsNew).toHaveBeenCalledTimes(1)
    await settle()
    expect(get().state?.whatsNew).toBeNull()
  })

  it('can be dropped without ever being shown', async () => {
    const { main, get } = setup(fixtureState({ notes: null, whatsNew: fixtureWhatsNew('empty') }))
    get().apply(fixtureState({ notes: null, whatsNew: fixtureWhatsNew('empty') }))
    get().dismissWhatsNew()
    expect(get().handled.whatsNew).toBe('0.3.0')
    expect(get().surface).toBe('none')
    await settle()
    expect(main.bridge.dismissWhatsNew).toHaveBeenCalledTimes(1)
    // Nothing left to dismiss.
    get().dismissWhatsNew()
    expect(main.bridge.dismissWhatsNew).toHaveBeenCalledTimes(1)
  })

  it('stays closed on this page when the main process cannot be told', async () => {
    const { main, get } = setup(fixtureState({ notes: null, whatsNew: fixtureWhatsNew() }))
    main.bridge.dismissWhatsNew.mockImplementationOnce(() => Promise.reject(new Error('gone')))
    get().apply(fixtureState({ notes: null, whatsNew: fixtureWhatsNew() }))
    get().openByItself('whats-new')
    get().closeWindow()
    await settle()
    expect(get().surface).toBe('none')
    expect(get().handled.whatsNew).toBe('0.3.0')
  })
})

describe('check', () => {
  it('resolves true with the answer in the snapshot, also when the check failed', async () => {
    const { main, get } = setup(fixtureState({ notes: null }))
    main.set(fixtureState())
    const pending = get().check()
    expect(get().checking).toBe(true)
    expect(await pending).toBe(true)
    expect(get().checking).toBe(false)
    expect(get().state?.offer?.version).toBe('0.3.0')

    main.set(fixtureState({ notes: null, error: { kind: 'offline', during: 'check' } }))
    expect(await get().check()).toBe(true)
    expect(get().state?.error?.kind).toBe('offline')
  })

  it('resolves false when the request itself fails', async () => {
    const { main, get } = setup()
    main.bridge.checkForUpdates.mockImplementationOnce(() => Promise.reject(new Error('IPC call from an untrusted sender')))
    expect(await get().check()).toBe(false)
    expect(get().checking).toBe(false)
    expect(get().state).toBeNull()
  })

  it('runs one check at a time and none at all in mode off', async () => {
    const { main, get } = setup()
    const first = get().check()
    expect(await get().check()).toBe(false)
    await first
    expect(main.bridge.checkForUpdates).toHaveBeenCalledTimes(1)

    get().apply(fixtureState({ mode: 'off', notes: null }))
    expect(await get().check()).toBe(false)
    expect(main.bridge.checkForUpdates).toHaveBeenCalledTimes(1)
  })
})

describe('download', () => {
  it('is marked as pending until the main process answers, then takes its snapshot', async () => {
    const { main, get } = setup(fixtureState())
    get().apply(fixtureState())
    main.set(fixtureState({ phase: 'ready' }))
    const pending = get().download()
    expect(get().pending.download).toBe(true)
    await pending
    expect(get().pending.download).toBe(false)
    expect(get().state?.phase).toBe('ready')
    expect(get().problem).toBeNull()
  })

  it('stops counting as pending once the snapshots show the download has ended', async () => {
    const { main, get } = setup(fixtureState())
    get().connect()
    await settle()
    // An answer that never comes: the snapshots are what the window goes by.
    main.bridge.downloadUpdate.mockImplementationOnce(() => new Promise<UpdateState>(() => {}))
    void get().download()
    expect(get().pending.download).toBe(true)
    main.push(fixtureState({ phase: 'downloading', percent: 10 }))
    expect(get().pending.download).toBe(true)
    main.push(fixtureState({ phase: 'available' }))
    expect(get().pending.download).toBe(false)
  })

  it('is asked for once, however often the button is pressed', async () => {
    const { main, get } = setup(fixtureState())
    get().apply(fixtureState())
    const first = get().download()
    void get().download()
    await first
    expect(main.bridge.downloadUpdate).toHaveBeenCalledTimes(1)
  })

  it('reports a request that failed outright', async () => {
    const { main, get } = setup(fixtureState())
    get().apply(fixtureState())
    main.bridge.downloadUpdate.mockImplementationOnce(() => Promise.reject(new Error('gone')))
    await get().download()
    expect(get().problem).toEqual({ type: 'error', kind: 'unknown', during: 'download' })
    expect(get().pending.download).toBe(false)
    // The next attempt starts clean.
    await get().download()
    expect(get().problem).toBeNull()
  })

  it('is never asked for by a copy that cannot update itself', async () => {
    for (const mode of ['manual', 'off'] as const) {
      const { main, get } = setup(fixtureState({ mode, phase: 'ready' }))
      get().apply(fixtureState({ mode, phase: 'ready' }))
      await get().download()
      await get().restartAndUpdate()
      expect(main.bridge.downloadUpdate).not.toHaveBeenCalled()
      expect(main.bridge.installUpdate).not.toHaveBeenCalled()
      expect(get().problem).toBeNull()
    }
    // Nor before the first snapshot has said what kind of copy this is.
    const { main, get } = setup(fixtureState())
    await get().download()
    await get().restartAndUpdate()
    expect(main.calls).toEqual([])
  })

  it('can be cancelled', async () => {
    const { main, get } = setup(fixtureState({ phase: 'downloading' }))
    get().apply(fixtureState({ phase: 'downloading' }))
    main.set(fixtureState())
    const pending = get().cancelDownload()
    expect(get().pending.cancel).toBe(true)
    await pending
    expect(get().pending.cancel).toBe(false)
    expect(get().state?.phase).toBe('available')

    main.bridge.cancelUpdateDownload.mockImplementationOnce(() => Promise.reject(new Error('gone')))
    await get().cancelDownload()
    expect(get().pending.cancel).toBe(false)
    expect(get().problem).toBeNull()
  })
})

describe('restartAndUpdate', () => {
  const ready = fixtureState({ phase: 'ready' })

  it('writes the save first, then asks the main process to install', async () => {
    const order: string[] = []
    const { main, get, flushSave } = setup(ready, {
      flushSave: () => {
        order.push('flush')
        return Promise.resolve(true)
      }
    })
    main.bridge.installUpdate.mockImplementationOnce(() => {
      order.push('install')
      return Promise.resolve()
    })
    get().apply(ready)
    const pending = get().restartAndUpdate()
    expect(get().pending.restart).toBe(true)
    await pending
    expect(order).toEqual(['flush', 'install'])
    expect(flushSave).toHaveBeenCalledTimes(1)
    expect(get().problem).toBeNull()
    expect(get().pending.restart).toBe(false)
  })

  it('refuses while the entry editor is open, without touching the save or the installer', async () => {
    const { main, get, flushSave } = setup(ready, { editorOpen: () => true })
    get().apply(ready)
    await get().restartAndUpdate()
    expect(get().problem).toEqual({ type: 'editor-open' })
    expect(flushSave).not.toHaveBeenCalled()
    expect(main.bridge.installUpdate).not.toHaveBeenCalled()
    expect(get().pending.restart).toBe(false)
  })

  it('stops when the save could not be written', async () => {
    for (const flushSave of [() => Promise.resolve(false), () => Promise.reject(new Error('disk full')), () => Promise.resolve(undefined as unknown as boolean)]) {
      const { main, get } = setup(ready, { flushSave })
      get().apply(ready)
      await get().restartAndUpdate()
      expect(get().problem).toEqual({ type: 'not-saved' })
      expect(main.bridge.installUpdate).not.toHaveBeenCalled()
      expect(get().pending.restart).toBe(false)
    }
  })

  it('stops when the entry editor was opened while the save was being written', async () => {
    let open = false
    const { main, get } = setup(ready, {
      editorOpen: () => open,
      flushSave: () => {
        open = true
        return Promise.resolve(true)
      }
    })
    get().apply(ready)
    await get().restartAndUpdate()
    expect(get().problem).toEqual({ type: 'editor-open' })
    expect(main.bridge.installUpdate).not.toHaveBeenCalled()
  })

  it('reports an install the main process turned down', async () => {
    const { main, get } = setup(ready)
    main.bridge.installUpdate.mockImplementationOnce(() => Promise.reject(new Error('nothing to install')))
    get().apply(ready)
    await get().restartAndUpdate()
    expect(get().problem).toEqual({ type: 'error', kind: 'unknown', during: 'install' })
    expect(get().pending.restart).toBe(false)
  })

  it('leaves the reason to the snapshot when the main process named one', async () => {
    const { main, get } = setup(ready)
    get().connect()
    await settle()
    main.bridge.installUpdate.mockImplementationOnce(() => {
      main.push(fixtureState({ phase: 'ready', error: { kind: 'disk', during: 'install' } }))
      return Promise.reject(new Error('EACCES'))
    })
    await get().restartAndUpdate()
    expect(get().problem).toBeNull()
    expect(get().state?.error).toMatchObject({ kind: 'disk', during: 'install' })
  })

  it('gives way to the reason from the main process when that arrives after the refusal', async () => {
    const { main, get } = setup(ready)
    get().connect()
    await settle()
    main.bridge.installUpdate.mockImplementationOnce(() => Promise.reject(new Error('EACCES')))
    await get().restartAndUpdate()
    expect(get().problem).toEqual({ type: 'error', kind: 'unknown', during: 'install' })
    main.push(fixtureState({ phase: 'ready', error: { kind: 'disk', during: 'install' } }))
    expect(get().problem).toBeNull()
    // A note that is not about a failed step stays until the next attempt.
    main.push(fixtureState({ phase: 'ready', error: { kind: 'disk', during: 'check' } }))
    expect(get().problem).toBeNull()
  })

  it('is asked for once, and a new attempt clears the old refusal', async () => {
    let open = true
    const { main, get } = setup(ready, { editorOpen: () => open })
    get().apply(ready)
    await get().restartAndUpdate()
    expect(get().problem).toEqual({ type: 'editor-open' })
    open = false
    const first = get().restartAndUpdate()
    expect(get().problem).toBeNull()
    void get().restartAndUpdate()
    await first
    expect(main.bridge.installUpdate).toHaveBeenCalledTimes(1)
  })
})

describe('setAutoCheck', () => {
  it('stores the switch through the main process and says whether that worked', async () => {
    const { main, get } = setup(fixtureState({ notes: null }))
    get().apply(fixtureState({ notes: null }))
    expect(await get().setAutoCheck(false)).toBe(true)
    expect(main.bridge.setUpdateAutoCheck).toHaveBeenCalledWith(false)
    expect(get().state?.autoCheck).toBe(false)

    main.bridge.setUpdateAutoCheck.mockImplementationOnce(() => Promise.reject(new Error('disk')))
    expect(await get().setAutoCheck(true)).toBe(false)
    expect(get().state?.autoCheck).toBe(false)
  })
})
