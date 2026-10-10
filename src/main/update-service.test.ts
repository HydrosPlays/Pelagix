import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UpdateMode, UpdateState } from '@shared/api'
import { CHECK_INTERVAL_MS, CHECK_POLL_MS, defaultStoredUpdates, FIRST_CHECK_DELAY_MS, parseStoredUpdates, serializeStoredUpdates, type StoredUpdates } from './update-model'
import type { GitHubRelease, ReleaseFetch } from './update-releases'
import { CANCEL_GRACE_MS, CHECK_TIMEOUT_MS, createUpdateService, NOTES_REFETCH_MIN_MS, READ_RETRY_MS, type Updater, type UpdaterCheck, type UpdaterDownload, type UpdateService } from './update-service'
import type { StoredRead, StoredSource, UpdateLog, UpdateStore } from './update-store'

const TAG_URL = 'https://github.com/HydrosPlays/Pelagix/releases/tag/'

const release = (tag: string, extra: Partial<GitHubRelease> = {}): GitHubRelease => ({
  tag,
  version: tag.replace(/^v/, ''),
  name: `Pelagix ${tag}`,
  publishedAt: '2026-11-01T10:00:00Z',
  body: `notes of ${tag}`,
  prerelease: false,
  ...extra
})

const found = (version: string, extra: Partial<UpdaterCheck['updateInfo']> = {}): UpdaterCheck => ({ isUpdateAvailable: true, updateInfo: { version, tag: `v${version}`, ...extra } })
const upToDate: UpdaterCheck = { isUpdateAvailable: false, updateInfo: { version: '0.2.0' } }
const listOf = (...tags: string[]): ReleaseFetch => ({ ok: true, releases: tags.map((tag) => release(tag)) })

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
  reject(err: unknown): void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Lets every promise that is ready run. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

interface FakeDownload {
  handle: UpdaterDownload
  finish(files?: string[]): void
  fail(err: unknown): void
}

/**
 * Stands in for electron-updater: counts what it is asked and answers what the test tells it to.
 * Like the library, it has one download at a time: asked again while one is running, it hands
 * out that one, and the cancel of the second caller stops nothing.
 */
function fakeUpdater() {
  let running: Promise<string[]> | null = null
  const fake = {
    checks: 0,
    installs: 0,
    /** Downloads the library really started. */
    downloads: [] as FakeDownload[],
    /** Times it was asked for one, including the times it answered with one already running. */
    downloadCalls: 0,
    /** What the next checks answer. A function is called for each check. */
    answer: (() => Promise.resolve(upToDate)) as () => Promise<UpdaterCheck | null>,
    installs_ok: true as boolean | Error,
    progress: (_info: unknown): void => {},
    updater: {} as Updater
  }
  fake.updater = {
    check() {
      fake.checks++
      return fake.answer()
    },
    download() {
      fake.downloadCalls++
      if (running !== null) return { done: running, cancel() {} }
      const done = deferred<string[]>()
      const mine = done.promise
      running = mine
      const over = (): void => {
        if (running === mine) running = null
      }
      mine.then(over, over)
      const handle: UpdaterDownload = {
        done: mine,
        // The library rejects with "cancelled" and raises no error event.
        cancel: () => done.reject(new Error('cancelled'))
      }
      fake.downloads.push({ handle, finish: (files = ['C:\\cache\\pending\\Pelagix-setup.exe']) => done.resolve(files), fail: (err) => done.reject(err) })
      return handle
    },
    install() {
      fake.installs++
      if (fake.installs_ok instanceof Error) throw fake.installs_ok
      return fake.installs_ok
    },
    onProgress(listener) {
      fake.progress = listener
    }
  }
  return fake
}

function memoryStore(initial?: unknown) {
  let text: string | null = initial === undefined ? null : JSON.stringify(initial)
  const memory = {
    reads: 0,
    writes: [] as StoredUpdates[],
    failWrites: false,
    /** How many of the next reads find the file there but impossible to open. */
    unreadable: 0,
    /** Returns a promise to hold a write open until it resolves; anything else lets it through. */
    holdWrite: (_data: StoredUpdates): Promise<void> | void => {},
    current: (): StoredUpdates | null => (text === null ? null : parseStoredUpdates(JSON.parse(text))),
    store: {} as UpdateStore
  }
  memory.store = {
    file: 'updates.json',
    read: async () => {
      memory.reads++
      if (memory.unreadable > 0) {
        memory.unreadable--
        return { data: defaultStoredUpdates(), source: 'unreadable' as StoredSource }
      }
      return text === null ? { data: defaultStoredUpdates(), source: 'none' as StoredSource } : { data: parseStoredUpdates(JSON.parse(text)), source: 'file' as StoredSource }
    },
    write: async (data) => {
      // Serialised at once, like the real store.
      const json = serializeStoredUpdates(data)
      await memory.holdWrite(data)
      if (memory.failWrites) throw new Error('ENOSPC: no space left on device')
      text = json
      memory.writes.push(parseStoredUpdates(JSON.parse(text)))
    }
  }
  return memory
}

interface Options {
  mode?: UpdateMode
  currentVersion?: string
  stored?: unknown
  hadUpdatesFile?: boolean
  hadSaveFile?: boolean
  fetch?: () => Promise<ReleaseFetch>
  fileExists?: (path: string) => boolean
  saveIdle?: () => Promise<void>
  loadFails?: number
  readFails?: boolean
  /** How many reads of updates.json find it impossible to open. */
  unreadable?: number
  /** What reading updates.json gives, in place of the store's own answer. */
  read?: () => Promise<StoredRead>
  now?: () => number
}

function setup(options: Options = {}) {
  const fake = fakeUpdater()
  const memory = memoryStore(options.stored)
  memory.unreadable = options.unreadable ?? 0
  if (options.readFails) memory.store.read = () => Promise.reject(new Error('EIO: i/o error, read'))
  if (options.read) memory.store.read = options.read
  const states: UpdateState[] = []
  const lines: string[] = []
  const timeline: string[] = []
  const log: UpdateLog = {
    info: (m) => void lines.push(`info ${String(m)}`),
    warn: (m) => void lines.push(`warn ${String(m)}`),
    error: (m) => void lines.push(`error ${String(m)}`),
    get busy() {
      return world.logWriting !== null
    },
    idle: () => world.logWriting?.promise ?? Promise.resolve()
  }
  const world = {
    fake,
    memory,
    states,
    lines,
    timeline,
    /** Set to make the log report lines that are still being written, until it is resolved and cleared. */
    logWriting: null as Deferred<void> | null,
    loads: 0,
    fetches: 0,
    loadFails: options.loadFails ?? 0,
    fetch: options.fetch ?? (() => Promise.resolve<ReleaseFetch>({ ok: false, reason: 'network' })),
    service: {} as UpdateService
  }
  const realWrite = memory.store.write
  memory.store.write = async (data) => {
    timeline.push(`write pending=${data.pendingNotes?.version ?? 'none'}`)
    await realWrite(data)
  }
  const realInstall = fake.updater.install
  fake.updater.install = () => {
    timeline.push('install')
    return realInstall()
  }
  world.service = createUpdateService({
    mode: options.mode ?? 'auto',
    currentVersion: options.currentVersion ?? '0.2.0',
    hadUpdatesFile: options.hadUpdatesFile ?? options.stored !== undefined,
    hadSaveFile: options.hadSaveFile ?? false,
    store: memory.store,
    log,
    loadUpdater: async () => {
      world.loads++
      if (world.loadFails > 0) {
        world.loadFails--
        throw new Error('Cannot find module electron-updater')
      }
      return fake.updater
    },
    fetchReleases: () => {
      world.fetches++
      return world.fetch()
    },
    saveIdle:
      options.saveIdle ??
      (async () => {
        timeline.push('save idle')
      }),
    fileExists: options.fileExists ?? (() => true),
    onState: (state) => {
      states.push(state)
      timeline.push(`state ${state.phase}`)
    },
    ...(options.now ? { now: options.now } : {})
  })
  return world
}

/** A service that has found 0.3.0 and, when asked, downloaded it. */
async function withOffer(options: Options = {}, upTo: 'available' | 'ready' = 'available') {
  const world = setup({ stored: { lastRunVersion: '0.2.0' }, fetch: () => Promise.resolve(listOf('v0.3.0', 'v0.2.0')), ...options })
  world.fake.answer = () => Promise.resolve(found('0.3.0'))
  await world.service.check()
  if (upTo === 'ready') {
    const downloading = world.service.download()
    await settle()
    world.fake.downloads[0]?.finish()
    await downloading
  }
  world.states.length = 0
  world.timeline.length = 0
  return world
}

afterEach(() => {
  vi.useRealTimers()
})

describe('mode off', () => {
  it('answers every call and touches nothing', async () => {
    vi.useFakeTimers()
    const world = setup({ mode: 'off', fetch: () => Promise.resolve(listOf('v0.3.0')) })
    const { service } = world
    const snapshot: UpdateState = { mode: 'off', currentVersion: '0.2.0', autoCheck: false, phase: 'idle', lastCheckedAt: null, offer: null, progress: null, error: null, whatsNew: null }

    service.start()
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 3)
    expect(await service.state()).toEqual(snapshot)
    expect(await service.check()).toEqual(snapshot)
    expect(await service.download()).toEqual(snapshot)
    expect(await service.cancelDownload()).toEqual(snapshot)
    expect(await service.setAutoCheck(true)).toEqual(snapshot)
    expect(await service.markAnnounced('0.3.0')).toEqual(snapshot)
    expect(await service.dismissWhatsNew()).toEqual(snapshot)
    await expect(service.install()).rejects.toThrow('There is no downloaded update to install.')
    expect(service.busy).toBe(false)
    await service.idle()

    expect(world.loads).toBe(0)
    expect(world.fetches).toBe(0)
    expect(world.memory.reads).toBe(0)
    expect(world.memory.writes).toEqual([])
    expect(world.states).toEqual([])
    expect(world.lines).toEqual([])
    expect(world.timeline).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('start-up', () => {
  it('reports what updates.json held', async () => {
    const world = setup({ stored: { autoCheck: false, lastCheckedAt: 1234, lastRunVersion: '0.2.0' } })
    expect(await world.service.state()).toEqual({ mode: 'auto', currentVersion: '0.2.0', autoCheck: false, phase: 'idle', lastCheckedAt: 1234, offer: null, progress: null, error: null, whatsNew: null })
    // Nothing changed, so nothing is written, loaded or fetched.
    expect(world.memory.writes).toEqual([])
    expect(world.loads).toBe(0)
    expect(world.fetches).toBe(0)
  })

  it('does not report the time of a check that offered a newer version', async () => {
    // "Later" in an earlier run. Until this run has checked, the page must not be able to say "up to date".
    const world = setup({ stored: { lastCheckedAt: 1234, offeredVersion: '0.3.0', lastRunVersion: '0.2.0', announcedVersion: '0.3.0' } })
    expect(await world.service.state()).toMatchObject({ phase: 'idle', offer: null, lastCheckedAt: null })
    // The file keeps the time, and a version this copy has reached is no reason to hide it.
    expect(world.memory.writes).toEqual([])
    const reached = setup({ stored: { lastCheckedAt: 1234, offeredVersion: '0.2.0', lastRunVersion: '0.2.0', announcedVersion: '0.2.0' } })
    expect((await reached.service.state()).lastCheckedAt).toBe(1234)
  })

  it('holds that time back whether or not the changelog window was ever shown for the version', async () => {
    // The check found 0.3.0 while the entry editor was open, and the app was closed before the window could come up.
    const first = setup({ stored: { lastRunVersion: '0.2.0' }, fetch: () => Promise.resolve(listOf('v0.3.0')), now: () => 5000 })
    first.fake.answer = () => Promise.resolve(found('0.3.0'))
    expect((await first.service.check()).lastCheckedAt).toBe(5000)
    expect(first.memory.current()).toMatchObject({ lastCheckedAt: 5000, offeredVersion: '0.3.0', announcedVersion: null })

    const next = setup({ stored: first.memory.current() })
    expect(await next.service.state()).toMatchObject({ phase: 'idle', offer: null, lastCheckedAt: null })
    // A check that finds nothing newer after all makes the time good again, here and after a restart.
    expect(await next.service.check()).toMatchObject({ phase: 'idle', offer: null })
    expect(next.memory.current()?.offeredVersion).toBeNull()
    const later = setup({ stored: next.memory.current() })
    expect((await later.service.state()).lastCheckedAt).not.toBeNull()
  })

  it('fresh install: records the version and shows nothing', async () => {
    const world = setup({ hadUpdatesFile: false, hadSaveFile: false })
    expect((await world.service.state()).whatsNew).toBeNull()
    await settle()
    expect(world.memory.writes).toEqual([{ ...defaultStoredUpdates(), lastRunVersion: '0.2.0' }])
    expect(world.fetches).toBe(0)
  })

  it('upgrade from 0.1.0: fetches the notes and then shows them', async () => {
    const list = deferred<ReleaseFetch>()
    const world = setup({ hadUpdatesFile: false, hadSaveFile: true, fetch: () => list.promise })
    // The first snapshot does not wait for GitHub.
    expect((await world.service.state()).whatsNew).toBeNull()
    expect(world.fetches).toBe(1)
    list.resolve(listOf('v0.2.0', 'v0.1.0'))
    await settle()
    const state = await world.service.state()
    expect(state.whatsNew).toEqual({
      version: '0.2.0',
      from: '0.1.0',
      url: `${TAG_URL}v0.2.0`,
      notes: [{ version: '0.2.0', name: 'Pelagix v0.2.0', publishedAt: '2026-11-01T10:00:00Z', url: `${TAG_URL}v0.2.0`, body: 'notes of v0.2.0' }]
    })
    expect(world.states.at(-1)).toEqual(state)
    expect(world.memory.current()).toMatchObject({ lastRunVersion: '0.2.0', whatsNew: { version: '0.2.0', from: '0.1.0', notes: [release('v0.2.0')] } })
    // The library is not needed for any of this.
    expect(world.loads).toBe(0)
  })

  it('shows the What’s-new window with a link when the notes cannot be fetched, and tries again next launch', async () => {
    const world = setup({ hadUpdatesFile: false, hadSaveFile: true })
    await world.service.state()
    await settle()
    expect((await world.service.state()).whatsNew).toEqual({ version: '0.2.0', from: '0.1.0', url: `${TAG_URL}v0.2.0`, notes: [] })
    const kept = world.memory.current()
    expect(kept?.whatsNew).toEqual({ version: '0.2.0', from: '0.1.0', notes: [] })

    const next = setup({ stored: kept, fetch: () => Promise.resolve(listOf('v0.2.0')) })
    await next.service.state()
    await settle()
    expect((await next.service.state()).whatsNew?.notes).toHaveLength(1)
  })

  it('shows notes saved before the install at once, without asking GitHub', async () => {
    const stored = { lastRunVersion: '0.1.5', pendingNotes: { version: '0.2.0', from: '0.1.5', notes: [release('v0.2.0'), release('v0.1.9')] } }
    const world = setup({ stored })
    const state = await world.service.state()
    expect(state.whatsNew?.from).toBe('0.1.5')
    expect(state.whatsNew?.notes.map((n) => n.version)).toEqual(['0.2.0', '0.1.9'])
    await settle()
    expect(world.fetches).toBe(0)
    expect(world.memory.current()).toMatchObject({ lastRunVersion: '0.2.0', pendingNotes: null, whatsNew: { version: '0.2.0' } })
  })

  it('keeps showing the notes after a restart until they are dismissed', async () => {
    const stored = { lastRunVersion: '0.2.0', whatsNew: { version: '0.2.0', from: '0.1.0', notes: [release('v0.2.0')] } }
    const world = setup({ stored })
    expect((await world.service.state()).whatsNew?.version).toBe('0.2.0')
    const dismissed = await world.service.dismissWhatsNew()
    expect(dismissed.whatsNew).toBeNull()
    expect(world.memory.current()?.whatsNew).toBeNull()
    expect((await setup({ stored: world.memory.current() }).service.state()).whatsNew).toBeNull()
    // A second dismissal has nothing to do.
    const writes = world.memory.writes.length
    await world.service.dismissWhatsNew()
    expect(world.memory.writes).toHaveLength(writes)
  })

  it('does not show notes that were dismissed while they were being fetched', async () => {
    const list = deferred<ReleaseFetch>()
    const world = setup({ hadUpdatesFile: false, hadSaveFile: true, fetch: () => list.promise })
    await world.service.dismissWhatsNew()
    list.resolve(listOf('v0.2.0'))
    await settle()
    expect((await world.service.state()).whatsNew).toBeNull()
    expect(world.memory.current()?.whatsNew).toBeNull()
  })

  it('an older copy leaves the record of a newer one alone', async () => {
    const stored = { lastRunVersion: '0.3.0', whatsNew: { version: '0.3.0', from: '0.2.0', notes: [release('v0.3.0')] } }
    const world = setup({ stored })
    expect((await world.service.state()).whatsNew).toBeNull()
    await world.service.dismissWhatsNew()
    expect(world.memory.writes).toEqual([])
    expect(world.fetches).toBe(0)
  })

})

describe('an updates.json that is there but cannot be used', () => {
  const optedOut = { autoCheck: false, lastCheckedAt: 1234, lastRunVersion: '0.2.0', announcedVersion: '0.3.0' }

  it('waits for a file that something else holds for a moment, and then starts as usual', async () => {
    vi.useFakeTimers()
    const world = setup({ stored: optedOut, unreadable: READ_RETRY_MS.length })
    let first: UpdateState | null = null
    void world.service.state().then((state) => (first = state))
    await vi.advanceTimersByTimeAsync(READ_RETRY_MS.reduce((sum, ms) => sum + ms, 0) - 1)
    // No snapshot yet: the defaults are not passed off as what the user chose.
    expect(first).toBeNull()
    expect(world.states).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(first).toMatchObject({ autoCheck: false, lastCheckedAt: 1234 })
    expect(world.memory.reads).toBe(READ_RETRY_MS.length + 1)

    world.service.start()
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 2)
    expect(world.fake.checks).toBe(0)
    // The file is used again like any other.
    await world.service.setAutoCheck(true)
    expect(world.memory.current()).toMatchObject({ autoCheck: true, lastRunVersion: '0.2.0', announcedVersion: '0.3.0' })
  })

  it('checks nothing by itself and writes nothing over a file it could not read', async () => {
    vi.useFakeTimers()
    const world = setup({ stored: optedOut, unreadable: 99 })
    world.fake.answer = () => Promise.resolve(found('0.3.0'))
    const reading = world.service.state()
    await vi.advanceTimersByTimeAsync(60_000)
    // The switch reads as off, because that is what this run does.
    expect(await reading).toMatchObject({ mode: 'auto', phase: 'idle', autoCheck: false, lastCheckedAt: null })
    expect(world.memory.reads).toBe(READ_RETRY_MS.length + 1)
    expect(world.lines.filter((line) => line.includes('cannot be read'))).toHaveLength(1)

    world.service.start()
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 3)
    expect(world.fake.checks).toBe(0)
    expect(world.loads).toBe(0)

    // Everything the user asks for still works, for as long as the app stays open...
    expect(await world.service.check()).toMatchObject({ phase: 'available', offer: { version: '0.3.0', announced: false } })
    expect((await world.service.markAnnounced('0.3.0')).offer?.announced).toBe(true)
    // ...but the file, which may be in perfect order, is left exactly as it was.
    expect(world.memory.writes).toEqual([])
    expect(world.memory.current()).toEqual(parseStoredUpdates(optedOut))
  })

  it('treats a store that fails outright the same way', async () => {
    vi.useFakeTimers()
    const world = setup({ stored: optedOut, readFails: true })
    const reading = world.service.state()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(await reading).toMatchObject({ phase: 'idle', autoCheck: false })
    world.service.start()
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 2)
    expect(world.fake.checks).toBe(0)
    expect((await world.service.check()).phase).toBe('idle')
    expect(world.memory.writes).toEqual([])
  })

  it('keeps a switched-off automatic check that was rescued from a damaged file', async () => {
    vi.useFakeTimers()
    // What the real store hands over for a file that no longer parses but still says "autoCheck": false.
    const world = setup({ hadUpdatesFile: true, read: async () => ({ data: { ...defaultStoredUpdates(), autoCheck: false }, source: 'damaged' }) })
    expect(await world.service.state()).toMatchObject({ autoCheck: false, whatsNew: null })
    world.service.start()
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 2)
    expect(world.fake.checks).toBe(0)
    // A damaged file is replaced, with the choice in it.
    expect(world.memory.current()).toMatchObject({ autoCheck: false, lastRunVersion: '0.2.0' })
  })
})

describe('the automatic-check switch', () => {
  it('says so when the choice could not be saved, and keeps to it until the app closes', async () => {
    vi.useFakeTimers()
    const world = setup({ stored: { lastRunVersion: '0.2.0' } })
    world.memory.failWrites = true
    await expect(world.service.setAutoCheck(false)).rejects.toThrow('The setting could not be saved.')
    // The page has been sent the switch as it now is.
    expect(world.states.at(-1)?.autoCheck).toBe(false)
    expect(world.lines.some((line) => line.startsWith('warn could not write updates.json'))).toBe(true)
    world.service.start()
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 2)
    expect(world.fake.checks).toBe(0)
    // Nothing of the failure is in what the page is told.
    const failure = await world.service.setAutoCheck(true).then(
      () => null,
      (err: unknown) => err
    )
    expect((failure as Error).message).toBe('The setting could not be saved.')

    // Once the disk works again, so does the switch.
    world.memory.failWrites = false
    expect((await world.service.setAutoCheck(false)).autoCheck).toBe(false)
    expect(world.memory.current()?.autoCheck).toBe(false)
  })

  it('cannot be saved while updates.json is unreadable, and says that too', async () => {
    vi.useFakeTimers()
    const world = setup({ stored: { autoCheck: true, lastRunVersion: '0.2.0' }, unreadable: 99 })
    const reading = world.service.state()
    await vi.advanceTimersByTimeAsync(60_000)
    await reading
    await expect(world.service.setAutoCheck(true)).rejects.toThrow('The setting could not be saved.')
    expect((await world.service.state()).autoCheck).toBe(true)
    world.service.start()
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_DELAY_MS)
    expect(world.fake.checks).toBe(1)
    expect(world.memory.writes).toEqual([])
  })

  it('only fails the calls whose own write failed', async () => {
    const world = setup({ stored: { lastRunVersion: '0.2.0' } })
    world.memory.failWrites = true
    // Everything else that cannot be saved still holds until the app closes, without a word.
    expect((await world.service.check()).phase).toBe('idle')
    await expect(world.service.setAutoCheck(false)).rejects.toThrow()
    // Already off: nothing to write, nothing to fail.
    expect((await world.service.setAutoCheck(false)).autoCheck).toBe(false)
  })
})

describe('an update noticed at start-up while automatic checks are off', () => {
  // 0.2.0 was installed by hand over 0.1.0: nothing saved its notes.
  const byHand = { autoCheck: false, lastRunVersion: '0.1.0' }
  const everything = (): Promise<ReleaseFetch> => Promise.resolve(listOf('v0.3.0', 'v0.2.0', 'v0.1.5', 'v0.1.0'))
  const versions = (state: UpdateState): string[] | undefined => state.whatsNew?.notes.map((note) => note.version)

  it('is recorded and shown without notes, and GitHub is not asked for them', async () => {
    vi.useFakeTimers()
    const world = setup({ stored: byHand, fetch: everything })
    await world.service.state()
    await vi.advanceTimersByTimeAsync(0)
    const state = await world.service.state()
    expect(state).toMatchObject({ autoCheck: false, phase: 'idle', whatsNew: { version: '0.2.0', from: '0.1.0', url: `${TAG_URL}v0.2.0`, notes: [] } })
    expect(world.states.at(-1)).toEqual(state)
    expect(world.memory.current()).toMatchObject({ autoCheck: false, lastRunVersion: '0.2.0', whatsNew: { version: '0.2.0', from: '0.1.0', notes: [] } })
    // Not later either, for as long as the app stays open.
    world.service.start()
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 2)
    expect(world.fetches).toBe(0)
    expect(world.fake.checks).toBe(0)
    expect(world.loads).toBe(0)
    expect(world.lines).toEqual(['info Pelagix 0.2.0, update mode auto'])
  })

  it('takes the notes from the saved release list when that holds them', async () => {
    const stored = { ...byHand, cache: { fetchedAt: 1, releases: [release('v0.2.0'), release('v0.1.5'), release('v0.1.0')] } }
    const world = setup({ stored, fetch: everything })
    await world.service.state()
    await settle()
    expect(versions(await world.service.state())).toEqual(['0.2.0', '0.1.5'])
    expect(world.memory.current()?.whatsNew?.notes).toEqual([release('v0.2.0'), release('v0.1.5')])
    expect(world.fetches).toBe(0)
  })

  it('shows no notes rather than older ones when the saved list stops short of this version', async () => {
    const stored = { ...byHand, cache: { fetchedAt: 1, releases: [release('v0.1.5'), release('v0.1.0')] } }
    const world = setup({ stored, fetch: everything })
    await world.service.state()
    await settle()
    expect(versions(await world.service.state())).toEqual([])
    expect(world.fetches).toBe(0)
  })

  it('does not ask on a later start either, while the record is still there without notes', async () => {
    const stored = { autoCheck: false, lastRunVersion: '0.2.0', whatsNew: { version: '0.2.0', from: '0.1.0', notes: [] } }
    const world = setup({ stored, fetch: everything })
    await world.service.state()
    await settle()
    expect(versions(await world.service.state())).toEqual([])
    expect(world.fetches).toBe(0)
    expect(world.memory.writes).toEqual([])
  })

  it('does not ask after an update made in the app whose notes could not be had at the time', async () => {
    const stored = { ...byHand, pendingNotes: { version: '0.2.0', from: '0.1.0', notes: [] } }
    const world = setup({ stored, fetch: everything })
    await world.service.state()
    await settle()
    expect(await world.service.state()).toMatchObject({ whatsNew: { version: '0.2.0', from: '0.1.0', notes: [] } })
    expect(world.fetches).toBe(0)
  })

  it('switching the checks on later in the same run does not send the request after all', async () => {
    vi.useFakeTimers()
    const world = setup({ stored: byHand, fetch: everything })
    world.service.start()
    await world.service.state()
    await world.service.setAutoCheck(true)
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 2)
    // The checks run from then on, and they do not fetch notes unless they find an update.
    expect(world.fake.checks).toBe(2)
    expect(world.fetches).toBe(0)
    expect(versions(await world.service.state())).toEqual([])

    // A record that nobody dismissed gets its notes at the next start, now that the switch is on.
    const next = setup({ stored: world.memory.current(), fetch: everything })
    await next.service.state()
    await vi.advanceTimersByTimeAsync(0)
    expect(next.fetches).toBe(1)
    expect(versions(await next.service.state())).toEqual(['0.2.0', '0.1.5'])
  })

  it('a check the user asks for fetches the notes of what it finds, as always', async () => {
    const world = setup({ stored: byHand, fetch: everything })
    world.fake.answer = () => Promise.resolve(found('0.3.0'))
    await world.service.state()
    await settle()
    expect(world.fetches).toBe(0)
    const state = await world.service.check()
    expect(world.fetches).toBe(1)
    expect(state.offer?.notes.map((note) => note.version)).toEqual(['0.3.0'])
    // That request was for the offer. The record this run has already passed to the page stays as it is...
    expect(versions(state)).toEqual([])
    // ...and, if nobody dismissed it, finds its notes in the saved list at the next start.
    const next = setup({ stored: world.memory.current(), fetch: everything })
    await next.service.state()
    await settle()
    expect(versions(await next.service.state())).toEqual(['0.2.0', '0.1.5'])
    expect(next.fetches).toBe(0)
  })
})

describe('an update noticed at start-up while automatic checks are on', () => {
  it('fetches its notes with one request, as before', async () => {
    const list = deferred<ReleaseFetch>()
    const world = setup({ stored: { autoCheck: true, lastRunVersion: '0.1.0' }, fetch: () => list.promise })
    // The first snapshot does not wait for GitHub.
    expect((await world.service.state()).whatsNew).toBeNull()
    expect(world.fetches).toBe(1)
    list.resolve(listOf('v0.2.0', 'v0.1.5', 'v0.1.0'))
    await settle()
    expect((await world.service.state()).whatsNew?.notes.map((note) => note.version)).toEqual(['0.2.0', '0.1.5'])
    expect(world.fetches).toBe(1)
    expect(world.memory.current()).toMatchObject({ autoCheck: true, lastRunVersion: '0.2.0', whatsNew: { version: '0.2.0', from: '0.1.0', notes: [release('v0.2.0'), release('v0.1.5')] } })
  })

  it('shows it without notes when the request fails, as before', async () => {
    const world = setup({ stored: { autoCheck: true, lastRunVersion: '0.1.0' } })
    await world.service.state()
    await settle()
    expect((await world.service.state()).whatsNew).toEqual({ version: '0.2.0', from: '0.1.0', url: `${TAG_URL}v0.2.0`, notes: [] })
    expect(world.fetches).toBe(1)
  })

  it('needs no request when the saved release list holds the notes, as before', async () => {
    const stored = { autoCheck: true, lastRunVersion: '0.1.0', cache: { fetchedAt: 1, releases: [release('v0.2.0'), release('v0.1.0')] } }
    const world = setup({ stored, fetch: () => Promise.resolve(listOf('v0.2.0')) })
    await world.service.state()
    await settle()
    expect((await world.service.state()).whatsNew?.notes.map((note) => note.version)).toEqual(['0.2.0'])
    expect(world.fetches).toBe(0)
  })
})

describe('check', () => {
  it('up to date: back to idle with the time recorded and saved', async () => {
    const world = setup({ stored: { lastRunVersion: '0.2.0' }, now: () => 5000 })
    const state = await world.service.check()
    expect(state).toMatchObject({ phase: 'idle', offer: null, lastCheckedAt: 5000, error: null })
    expect(world.states.map((s) => s.phase)).toEqual(['checking', 'idle'])
    expect(world.memory.current()?.lastCheckedAt).toBe(5000)
    expect(world.fetches).toBe(0)
  })

  it('update found: offers it with every release in between, newest first', async () => {
    const world = setup({ stored: { lastRunVersion: '0.2.0' }, fetch: () => Promise.resolve(listOf('v0.2.1', 'v0.3.0', 'v0.2.0', 'v0.1.0')), now: () => 5000 })
    world.fake.answer = () => Promise.resolve(found('0.3.0'))
    const state = await world.service.check()
    expect(state.phase).toBe('available')
    expect(state.lastCheckedAt).toBe(5000)
    expect(state.offer).toEqual({
      version: '0.3.0',
      url: `${TAG_URL}v0.3.0`,
      announced: false,
      notes: [
        { version: '0.3.0', name: 'Pelagix v0.3.0', publishedAt: '2026-11-01T10:00:00Z', url: `${TAG_URL}v0.3.0`, body: 'notes of v0.3.0' },
        { version: '0.2.1', name: 'Pelagix v0.2.1', publishedAt: '2026-11-01T10:00:00Z', url: `${TAG_URL}v0.2.1`, body: 'notes of v0.2.1' }
      ]
    })
    expect(world.memory.current()?.cache?.releases.map((r) => r.tag)).toEqual(['v0.3.0', 'v0.2.1', 'v0.2.0', 'v0.1.0'])
  })

  it('asks GitHub for the notes only when there is an update, and reuses the saved list after that', async () => {
    const world = setup({ stored: { lastRunVersion: '0.2.0' }, fetch: () => Promise.resolve(listOf('v0.3.0', 'v0.2.0')) })
    await world.service.check()
    expect(world.fetches).toBe(0)
    world.fake.answer = () => Promise.resolve(found('0.3.0'))
    await world.service.check()
    await world.service.check()
    await world.service.check()
    expect(world.fake.checks).toBe(4)
    expect(world.fetches).toBe(1)

    // A later launch starts from the saved list too.
    const next = setup({ stored: world.memory.current(), fetch: () => Promise.resolve(listOf()) })
    next.fake.answer = () => Promise.resolve(found('0.3.0'))
    expect((await next.service.check()).offer?.notes.map((n) => n.version)).toEqual(['0.3.0'])
    expect(next.fetches).toBe(0)
  })

  it('fetches again when a newer version appears than the saved list holds', async () => {
    let tags = ['v0.3.0', 'v0.2.0']
    let time = 0
    const world = setup({ stored: { lastRunVersion: '0.2.0' }, fetch: () => Promise.resolve(listOf(...tags)), now: () => time })
    world.fake.answer = () => Promise.resolve(found('0.3.0'))
    await world.service.check()
    tags = ['v0.4.0', 'v0.3.0', 'v0.2.0']
    world.fake.answer = () => Promise.resolve(found('0.4.0'))
    time += NOTES_REFETCH_MIN_MS
    const state = await world.service.check()
    expect(world.fetches).toBe(2)
    expect(state.offer?.notes.map((n) => n.version)).toEqual(['0.4.0', '0.3.0'])
  })

  it('falls back to the notes built into latest.yml when GitHub’s API cannot be asked', async () => {
    const world = setup({ stored: { lastRunVersion: '0.2.0' } })
    world.fake.answer = () => Promise.resolve(found('0.3.0', { tag: '0.3.0', releaseNotes: '## New\n\n- thing' }))
    const state = await world.service.check()
    expect(state.offer).toEqual({ version: '0.3.0', url: `${TAG_URL}0.3.0`, announced: false, notes: [{ version: '0.3.0', name: '', publishedAt: null, url: `${TAG_URL}0.3.0`, body: '## New\n\n- thing' }] })
  })

  it('offers the update with no notes rather than show the HTML from GitHub’s feed', async () => {
    const world = setup({ stored: { lastRunVersion: '0.2.0' } })
    world.fake.answer = () => Promise.resolve(found('0.3.0', { releaseNotes: '<ul>\n<li>New: <a class="issue-link">thing</a></li>\n</ul>' }))
    const state = await world.service.check()
    expect(state).toMatchObject({ phase: 'available', offer: { version: '0.3.0', url: `${TAG_URL}v0.3.0`, notes: [] } })
    expect(JSON.stringify(state)).not.toContain('issue-link')
  })

  it('does not pass off older notes as the new version’s when the list does not hold it yet', async () => {
    const world = setup({ stored: { lastRunVersion: '0.1.0' }, currentVersion: '0.1.0', fetch: () => Promise.resolve(listOf('v0.2.0', 'v0.1.0')) })
    world.fake.answer = () => Promise.resolve(found('0.3.0'))
    expect((await world.service.check()).offer?.notes).toEqual([])
  })

  it('remembers a rate limit and stays away until it is over', async () => {
    let time = 1_000_000
    let answer: ReleaseFetch = { ok: false, reason: 'rate-limited', retryAt: time + 3_600_000 }
    const world = setup({ stored: { lastRunVersion: '0.2.0' }, fetch: () => Promise.resolve(answer), now: () => time })
    world.fake.answer = () => Promise.resolve(found('0.3.0'))
    expect((await world.service.check()).offer?.notes).toEqual([])
    expect(world.memory.current()?.rateLimitedUntil).toBe(time + 3_600_000)

    answer = listOf('v0.3.0')
    time += 3_599_000
    await world.service.check()
    expect(world.fetches).toBe(1)
    // The limit also holds across a restart.
    const next = setup({ stored: world.memory.current(), fetch: () => Promise.resolve(answer), now: () => time })
    next.fake.answer = () => Promise.resolve(found('0.3.0'))
    await next.service.check()
    expect(next.fetches).toBe(0)

    time += 2000
    const state = await world.service.check()
    expect(world.fetches).toBe(2)
    expect(state.offer?.notes).toHaveLength(1)
    expect(world.memory.current()?.rateLimitedUntil).toBeNull()
  })

  it('does not believe a stored rate limit that lies absurdly far ahead', async () => {
    const time = 1_000_000
    const world = setup({ stored: { lastRunVersion: '0.2.0', rateLimitedUntil: time + 365 * 24 * 3_600_000 }, fetch: () => Promise.resolve(listOf('v0.3.0')), now: () => time })
    world.fake.answer = () => Promise.resolve(found('0.3.0'))
    expect((await world.service.check()).offer?.notes).toHaveLength(1)
  })

  it('does not turn repeated checks into repeated requests when the notes cannot be had', async () => {
    let time = 0
    const world = setup({ stored: { lastRunVersion: '0.2.0' }, now: () => time })
    world.fake.answer = () => Promise.resolve(found('0.3.0'))
    for (let i = 0; i < 10; i++) {
      await world.service.check()
      time += 1000
    }
    expect(world.fake.checks).toBe(10)
    expect(world.fetches).toBe(1)
    time += NOTES_REFETCH_MIN_MS
    await world.service.check()
    expect(world.fetches).toBe(2)
  })

  it('a failed check the user asked for shows its kind and nothing of the message', async () => {
    const world = setup({ stored: { lastRunVersion: '0.2.0', lastCheckedAt: 1234 }, now: () => 5000 })
    world.fake.answer = () => Promise.reject(Object.assign(new Error('Cannot find latest.yml (https://github.com/secret/path): HttpError: 404\nHeaders: {"x": "C:\\Users\\me"}'), { code: 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND' }))
    const state = await world.service.check()
    expect(state).toMatchObject({ phase: 'idle', lastCheckedAt: 1234, error: { kind: 'not-ready', during: 'check', at: 5000 } })
    expect(JSON.stringify(world.states)).not.toContain('secret')
    expect(JSON.stringify(world.states)).not.toContain('Users')
    // The detail is in the log: one line that says what was made of the failure. The library has
    // already written the whole of it there, headers and all, and it is not written a second time.
    expect(world.lines.filter((line) => line.startsWith('error'))).toEqual(['error check failed: Cannot find latest.yml (https://github.com/secret/path): HttpError: 404 (not-ready)'])
    expect(world.memory.current()?.lastCheckedAt).toBe(1234)
  })

  it('keeps its own log line short however much the failure quotes', async () => {
    const world = setup({ stored: { lastRunVersion: '0.2.0' } })
    world.fake.answer = () => Promise.reject(new Error(`Cannot parse releases feed: ${'<entry>'.repeat(200_000)}\nXML: ${' '.repeat(500_000)}`))
    await world.service.check()
    const line = world.lines.find((entry) => entry.startsWith('error check failed')) ?? ''
    expect(line.startsWith('error check failed: Cannot parse releases feed: <entry>')).toBe(true)
    expect(line.length).toBeLessThan(400)
    expect(line.endsWith('… (unknown)')).toBe(true)
  })

  it('keeps the offer when a later check fails', async () => {
    const world = await withOffer()
    world.fake.answer = () => Promise.reject(new Error('net::ERR_INTERNET_DISCONNECTED'))
    const state = await world.service.check()
    expect(state).toMatchObject({ phase: 'available', offer: { version: '0.3.0' }, error: { kind: 'offline', during: 'check' } })
    // And the next step the user takes clears the message.
    world.fake.answer = () => Promise.resolve(found('0.3.0'))
    expect((await world.service.check()).error).toBeNull()
  })

  it('drops the offer when GitHub no longer has anything newer', async () => {
    const world = await withOffer()
    world.fake.answer = () => Promise.resolve(upToDate)
    expect(await world.service.check()).toMatchObject({ phase: 'idle', offer: null })
    expect((await world.service.download()).phase).toBe('idle')
    expect(world.fake.downloads).toHaveLength(0)
  })

  it('does not offer a version that is not newer, or not a version, whatever the library says', async () => {
    const world = setup({ stored: { lastRunVersion: '0.2.0' } })
    for (const version of ['0.2.0', '0.1.0', 'latest', '', '0.2', '0.2.0+build.9']) {
      world.fake.answer = () => Promise.resolve(found(version))
      expect(await world.service.check()).toMatchObject({ phase: 'idle', offer: null, error: null })
    }
  })

  it('offers a version the library writes with a "v" the plain way', async () => {
    const world = setup({ stored: { lastRunVersion: '0.2.0' } })
    world.fake.answer = () => Promise.resolve(found('v0.3.0'))
    expect((await world.service.check()).offer).toMatchObject({ version: '0.3.0', url: `${TAG_URL}v0.3.0` })
  })

  it('treats a check the library refused to run as a failure, not as "up to date"', async () => {
    const world = setup({ stored: { lastRunVersion: '0.2.0' } })
    world.fake.answer = () => Promise.resolve(null)
    expect(await world.service.check()).toMatchObject({ phase: 'idle', lastCheckedAt: null, error: { kind: 'unknown', during: 'check' } })
  })

  it('two checks at once run one check', async () => {
    const world = setup({ stored: { lastRunVersion: '0.2.0' } })
    const answer = deferred<UpdaterCheck | null>()
    world.fake.answer = () => answer.promise
    const first = world.service.check()
    const second = world.service.check()
    const third = world.service.state().then(() => world.service.check())
    await settle()
    expect(world.fake.checks).toBe(1)
    expect((await world.service.state()).phase).toBe('checking')
    answer.resolve(found('0.3.0'))
    const [a, b, c] = await Promise.all([first, second, third])
    expect(a.phase).toBe('available')
    expect(b).toEqual(a)
    expect(c).toEqual(a)
    expect(world.fake.checks).toBe(1)
    expect(world.loads).toBe(1)
    expect(world.states.map((s) => s.phase)).toEqual(['checking', 'available'])
  })

  it('loads the library once, on the first check', async () => {
    const world = setup({ stored: { lastRunVersion: '0.2.0' } })
    await world.service.state()
    expect(world.loads).toBe(0)
    await world.service.check()
    await world.service.check()
    expect(world.loads).toBe(1)
  })

  it('tries to load the library again after it failed to load', async () => {
    const world = setup({ stored: { lastRunVersion: '0.2.0' }, loadFails: 1 })
    expect(await world.service.check()).toMatchObject({ phase: 'idle', error: { kind: 'unknown', during: 'check' } })
    expect(await world.service.check()).toMatchObject({ phase: 'idle', error: null })
    expect(world.loads).toBe(2)
    expect(world.fake.checks).toBe(1)
  })

  it('marks the offer as announced, remembers it, and only for the version on offer', async () => {
    const world = await withOffer()
    expect((await world.service.markAnnounced('0.4.0')).offer?.announced).toBe(false)
    expect(world.memory.current()?.announcedVersion).toBeNull()
    expect((await world.service.markAnnounced('0.3.0')).offer?.announced).toBe(true)
    expect(world.memory.current()?.announcedVersion).toBe('0.3.0')
    // The next check, and the next launch, still know.
    expect((await world.service.check()).offer?.announced).toBe(true)
    const next = setup({ stored: world.memory.current() })
    next.fake.answer = () => Promise.resolve(found('0.3.0'))
    expect((await next.service.check()).offer?.announced).toBe(true)
    // A newer version is new again.
    next.fake.answer = () => Promise.resolve(found('0.4.0'))
    expect((await next.service.check()).offer?.announced).toBe(false)
  })

  it('ignores an announcement when nothing is on offer', async () => {
    const world = setup({ stored: { lastRunVersion: '0.2.0' } })
    expect(await world.service.markAnnounced('0.3.0')).toMatchObject({ phase: 'idle', offer: null })
    expect(world.memory.writes).toEqual([])
  })

  it('saves the automatic-check switch', async () => {
    const world = setup({ stored: { lastRunVersion: '0.2.0' } })
    expect((await world.service.setAutoCheck(false)).autoCheck).toBe(false)
    expect(world.memory.current()?.autoCheck).toBe(false)
    const writes = world.memory.writes.length
    await world.service.setAutoCheck(false)
    expect(world.memory.writes).toHaveLength(writes)
    expect((await world.service.setAutoCheck(true)).autoCheck).toBe(true)
    expect(world.memory.current()?.autoCheck).toBe(true)
  })
})

describe('mode manual', () => {
  it('checks and shows the notes like an installed copy', async () => {
    const world = setup({ mode: 'manual', stored: { lastRunVersion: '0.2.0' }, fetch: () => Promise.resolve(listOf('v0.3.0')) })
    world.fake.answer = () => Promise.resolve(found('0.3.0'))
    expect(await world.service.check()).toMatchObject({ mode: 'manual', phase: 'available', offer: { version: '0.3.0' } })
  })

  it('never downloads and never installs, whatever is asked', async () => {
    const world = await withOffer({ mode: 'manual' })
    for (let i = 0; i < 3; i++) {
      expect(await world.service.download()).toMatchObject({ phase: 'available', progress: null, error: null })
      expect(await world.service.cancelDownload()).toMatchObject({ phase: 'available' })
      await expect(world.service.install()).rejects.toThrow('There is no downloaded update to install.')
    }
    expect(world.fake.downloads).toHaveLength(0)
    expect(world.fake.installs).toBe(0)
    expect(world.states).toEqual([])
    expect(world.memory.current()?.pendingNotes).toBeNull()
  })
})

describe('download', () => {
  it('downloads the offered version and waits for a restart', async () => {
    const world = await withOffer()
    const downloading = world.service.download()
    await settle()
    expect((await world.service.state()).phase).toBe('downloading')
    world.fake.progress({ percent: 40, transferred: 400, total: 1000, bytesPerSecond: 200 })
    expect((await world.service.state()).progress).toEqual({ percent: 40, transferred: 400, total: 1000, bytesPerSecond: 200 })
    world.fake.downloads[0]?.finish()
    expect(await downloading).toMatchObject({ phase: 'ready', progress: null, error: null, offer: { version: '0.3.0' } })
    expect(world.states.map((s) => s.phase)).toEqual(['downloading', 'downloading', 'ready'])
  })

  it('does nothing unless an update is on offer', async () => {
    const world = setup({ stored: { lastRunVersion: '0.2.0' } })
    expect((await world.service.download()).phase).toBe('idle')
    await world.service.check()
    expect((await world.service.download()).phase).toBe('idle')
    expect(world.fake.downloads).toHaveLength(0)
  })

  it('a double click starts one download and both calls get the result', async () => {
    const world = await withOffer()
    const first = world.service.download()
    const second = world.service.download()
    await settle()
    const third = world.service.download()
    await settle()
    expect(world.fake.downloads).toHaveLength(1)
    world.fake.downloads[0]?.finish()
    const results = await Promise.all([first, second, third])
    expect(results.map((s) => s.phase)).toEqual(['ready', 'ready', 'ready'])
    // Asked again once it is there, nothing more is fetched.
    expect((await world.service.download()).phase).toBe('ready')
    expect(world.fake.downloads).toHaveLength(1)
  })

  it('returns to "available" with the offer and the reason when it fails', async () => {
    const world = await withOffer({ now: () => 9000 })
    const downloading = world.service.download()
    await settle()
    world.fake.downloads[0]?.fail(Object.assign(new Error('sha512 checksum mismatch, expected a, got b'), { code: 'ERR_CHECKSUM_MISMATCH' }))
    expect(await downloading).toMatchObject({ phase: 'available', progress: null, offer: { version: '0.3.0' }, error: { kind: 'corrupt', during: 'download', at: 9000 } })
    // Trying again works and clears the message.
    const again = world.service.download()
    await settle()
    expect((await world.service.state()).error).toBeNull()
    world.fake.downloads[1]?.finish()
    expect((await again).phase).toBe('ready')
  })

  it('returns to "available" without an error when it is cancelled', async () => {
    const world = await withOffer()
    const downloading = world.service.download()
    await settle()
    const cancelled = await world.service.cancelDownload()
    expect(cancelled).toMatchObject({ phase: 'available', progress: null, error: null, offer: { version: '0.3.0' } })
    expect(await downloading).toEqual(cancelled)
    expect(world.lines.filter((line) => line.startsWith('error'))).toEqual([])
  })

  it('cancelling with nothing running changes nothing, in any phase', async () => {
    const idle = setup({ stored: { lastRunVersion: '0.2.0' } })
    expect((await idle.service.cancelDownload()).phase).toBe('idle')
    const available = await withOffer()
    expect((await available.service.cancelDownload()).phase).toBe('available')
    const ready = await withOffer({}, 'ready')
    expect((await ready.service.cancelDownload()).phase).toBe('ready')
    expect([...idle.states, ...available.states, ...ready.states]).toEqual([])
  })

  it('a cancel that arrives as the download finishes leaves the installer ready', async () => {
    const world = await withOffer()
    const downloading = world.service.download()
    await settle()
    world.fake.downloads[0]?.finish()
    const cancelling = world.service.cancelDownload()
    expect((await downloading).phase).toBe('ready')
    expect((await cancelling).phase).toBe('ready')
  })

  it('two cancels and a late progress report leave the phase where it belongs', async () => {
    const world = await withOffer()
    void world.service.download()
    await settle()
    const [a, b] = await Promise.all([world.service.cancelDownload(), world.service.cancelDownload()])
    expect([a.phase, b.phase]).toEqual(['available', 'available'])
    const pushed = world.states.length
    world.fake.progress({ percent: 99, transferred: 99, total: 100, bytesPerSecond: 1 })
    expect(world.states).toHaveLength(pushed)
    expect((await world.service.state()).progress).toBeNull()
  })

  it('does not let a check disturb a download or a waiting installer', async () => {
    const world = await withOffer()
    const checks = world.fake.checks
    const downloading = world.service.download()
    await settle()
    expect((await world.service.check()).phase).toBe('downloading')
    world.fake.downloads[0]?.finish()
    await downloading
    expect((await world.service.check()).phase).toBe('ready')
    expect(world.fake.checks).toBe(checks)
  })

  it('reports a download that could not even start', async () => {
    const world = await withOffer()
    world.fake.updater.download = () => {
      throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
    }
    expect(await world.service.download()).toMatchObject({ phase: 'available', error: { kind: 'disk', during: 'download' } })
  })

  it('passes progress on at most a few times a second', async () => {
    let time = 0
    const world = await withOffer({ now: () => time })
    const downloading = world.service.download()
    await settle()
    world.states.length = 0
    // 5 seconds of reports arriving every 5 ms.
    for (; time < 5000; time += 5) world.fake.progress({ percent: time / 50, transferred: time, total: 5000, bytesPerSecond: 1000 })
    expect(world.states.length).toBeGreaterThanOrEqual(19)
    expect(world.states.length).toBeLessThanOrEqual(21)
    expect(world.states.every((s) => s.phase === 'downloading' && s.progress !== null)).toBe(true)
    world.fake.downloads[0]?.finish()
    expect((await downloading).phase).toBe('ready')
  })

  it('shows the first report of a second download at once', async () => {
    let time = 0
    const world = await withOffer({ now: () => time })
    void world.service.download()
    await settle()
    world.fake.progress({ percent: 10, transferred: 1, total: 10, bytesPerSecond: 1 })
    await world.service.cancelDownload()
    time += 10
    void world.service.download()
    await settle()
    world.fake.progress({ percent: 20, transferred: 2, total: 10, bytesPerSecond: 1 })
    expect((await world.service.state()).progress?.percent).toBe(20)
  })
})

describe('install', () => {
  it('puts everything on disk, says so, and only then starts the installer', async () => {
    const world = await withOffer({}, 'ready')
    await world.service.install()
    expect(world.timeline).toEqual(['save idle', 'write pending=0.3.0', 'state installing', 'save idle', 'install'])
    expect(world.fake.installs).toBe(1)
    expect((await world.service.state()).phase).toBe('installing')
    expect(world.memory.current()?.pendingNotes).toEqual({ version: '0.3.0', from: '0.2.0', notes: [release('v0.3.0')] })
  })

  it('waits for a save that is still being written', async () => {
    const saving = deferred<void>()
    const world = await withOffer({ saveIdle: () => saving.promise }, 'ready')
    const installing = world.service.install()
    await settle()
    expect(world.fake.installs).toBe(0)
    expect((await world.service.state()).phase).toBe('ready')
    expect(world.memory.current()?.pendingNotes).toBeNull()
    saving.resolve()
    await installing
    expect(world.fake.installs).toBe(1)
  })

  it('the version that comes back shows exactly those notes', async () => {
    const world = await withOffer({}, 'ready')
    await world.service.install()
    const next = setup({ currentVersion: '0.3.0', stored: world.memory.current() })
    expect((await next.service.state()).whatsNew).toEqual({
      version: '0.3.0',
      from: '0.2.0',
      url: `${TAG_URL}v0.3.0`,
      notes: [{ version: '0.3.0', name: 'Pelagix v0.3.0', publishedAt: '2026-11-01T10:00:00Z', url: `${TAG_URL}v0.3.0`, body: 'notes of v0.3.0' }]
    })
    expect(next.fetches).toBe(0)
  })

  it('rejects clearly, and starts nothing, in every phase but "ready"', async () => {
    const idle = setup({ stored: { lastRunVersion: '0.2.0' } })
    await expect(idle.service.install()).rejects.toThrow('There is no downloaded update to install.')

    const available = await withOffer()
    await expect(available.service.install()).rejects.toThrow('There is no downloaded update to install.')

    const downloading = await withOffer()
    void downloading.service.download()
    await settle()
    await expect(downloading.service.install()).rejects.toThrow('There is no downloaded update to install.')

    const checking = setup({ stored: { lastRunVersion: '0.2.0' } })
    checking.fake.answer = () => new Promise(() => {})
    void checking.service.check()
    await settle()
    await expect(checking.service.install()).rejects.toThrow('There is no downloaded update to install.')

    for (const world of [idle, available, downloading, checking]) {
      expect(world.fake.installs).toBe(0)
      expect(world.memory.current()?.pendingNotes ?? null).toBeNull()
      expect(world.timeline.filter((entry) => entry === 'save idle' || entry === 'install')).toEqual([])
    }
  })

  it('a double click starts the installer once', async () => {
    const world = await withOffer({}, 'ready')
    await Promise.all([world.service.install(), world.service.install(), world.service.install()])
    expect(world.fake.installs).toBe(1)
    // Once it is running there is nothing left to install.
    await expect(world.service.install()).rejects.toThrow('There is no downloaded update to install.')
    expect(world.fake.installs).toBe(1)
    expect((await world.service.state()).phase).toBe('installing')
  })

  it('goes back to "available" when the downloaded installer is gone', async () => {
    const world = await withOffer({ fileExists: () => false, now: () => 9500 }, 'ready')
    await expect(world.service.install()).rejects.toThrow('The update could not be started.')
    expect(world.fake.installs).toBe(0)
    expect(await world.service.state()).toMatchObject({ phase: 'available', offer: { version: '0.3.0' }, error: { kind: 'unknown', during: 'install', at: 9500 } })
    // It can be downloaded and installed again.
    const downloading = world.service.download()
    await settle()
    world.fake.downloads[1]?.finish()
    expect((await downloading).phase).toBe('ready')
  })

  it('goes back to "available" when the library could not start the installer', async () => {
    for (const outcome of [false, new Error('spawn EACCES C:\\Users\\me\\AppData\\x.exe')]) {
      const world = await withOffer({}, 'ready')
      world.fake.installs_ok = outcome
      const failure = await world.service.install().then(
        () => null,
        (err: unknown) => err
      )
      expect(failure).toBeInstanceOf(Error)
      expect((failure as Error).message).toBe('The update could not be started.')
      expect(await world.service.state()).toMatchObject({ phase: 'available', error: { kind: 'unknown', during: 'install' } })
      expect(JSON.stringify(world.states)).not.toContain('AppData')
    }
  })

  it('checks that the very file the download produced is still there', async () => {
    const asked: string[] = []
    const world = await withOffer({
      fileExists: (path) => {
        asked.push(path)
        return true
      }
    })
    const downloading = world.service.download()
    await settle()
    world.fake.downloads[0]?.finish(['D:\\cache\\pending\\Pelagix-0.3.0-setup.exe'])
    await downloading
    await world.service.install()
    expect(asked).toEqual(['D:\\cache\\pending\\Pelagix-0.3.0-setup.exe'])
  })

  it('does not install a download that reported no file', async () => {
    const world = await withOffer()
    const downloading = world.service.download()
    await settle()
    world.fake.downloads[0]?.finish([])
    await downloading
    await expect(world.service.install()).rejects.toThrow('The update could not be started.')
    expect(world.fake.installs).toBe(0)
  })
})

describe('timing', () => {
  it('first checks about 12 seconds after the page has loaded, then every six hours', async () => {
    vi.useFakeTimers()
    const world = setup({ stored: { lastRunVersion: '0.2.0' } })
    await world.service.state()
    // Nothing is scheduled until the window has loaded.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(world.fake.checks).toBe(0)
    expect(world.loads).toBe(0)

    expect(world.lines).toEqual([])

    world.service.start()
    expect(world.lines).toEqual(['info Pelagix 0.2.0, update mode auto'])
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_DELAY_MS - 1)
    expect(world.fake.checks).toBe(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(world.fake.checks).toBe(1)

    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS - CHECK_POLL_MS)
    expect(world.fake.checks).toBe(1)
    await vi.advanceTimersByTimeAsync(CHECK_POLL_MS)
    expect(world.fake.checks).toBe(2)
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 3)
    expect(world.fake.checks).toBe(5)
  })

  it('starting twice schedules once', async () => {
    vi.useFakeTimers()
    const world = setup({ stored: { lastRunVersion: '0.2.0' } })
    world.service.start()
    world.service.start()
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_DELAY_MS)
    world.service.start()
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_DELAY_MS)
    expect(world.fake.checks).toBe(1)
  })

  it('checks nothing by itself while the switch is off, and starts when it is switched on', async () => {
    vi.useFakeTimers()
    const world = setup({ stored: { lastRunVersion: '0.2.0', autoCheck: false } })
    world.service.start()
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 2)
    expect(world.fake.checks).toBe(0)
    expect(world.loads).toBe(0)
    // A check the user asks for always runs.
    await world.service.check()
    expect(world.fake.checks).toBe(1)

    await world.service.setAutoCheck(true)
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS + CHECK_POLL_MS)
    expect(world.fake.checks).toBe(2)
    await world.service.setAutoCheck(false)
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 2)
    expect(world.fake.checks).toBe(2)
  })

  it('counts six hours from the last check of either kind', async () => {
    vi.useFakeTimers()
    const world = setup({ stored: { lastRunVersion: '0.2.0' } })
    world.service.start()
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_DELAY_MS)
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS / 2)
    await world.service.check()
    expect(world.fake.checks).toBe(2)
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS - CHECK_POLL_MS)
    expect(world.fake.checks).toBe(2)
    await vi.advanceTimersByTimeAsync(CHECK_POLL_MS)
    expect(world.fake.checks).toBe(3)
  })

  it('a check of its own that fails stays silent, and is tried again six hours later', async () => {
    vi.useFakeTimers()
    const world = setup({ stored: { lastRunVersion: '0.2.0', lastCheckedAt: 1234 } })
    world.fake.answer = () => Promise.reject(new Error('net::ERR_INTERNET_DISCONNECTED'))
    world.service.start()
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_DELAY_MS)
    expect(world.fake.checks).toBe(1)
    expect(await world.service.state()).toMatchObject({ phase: 'idle', error: null, lastCheckedAt: 1234 })
    expect(world.memory.writes).toEqual([])
    expect(world.lines.some((line) => line.startsWith('error check failed'))).toBe(true)
    // Not in a loop: the next try is the next regular one.
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS - CHECK_POLL_MS)
    expect(world.fake.checks).toBe(1)
    await vi.advanceTimersByTimeAsync(CHECK_POLL_MS)
    expect(world.fake.checks).toBe(2)
  })

  it('shows the failure when the user joins a check the app started', async () => {
    vi.useFakeTimers()
    const world = setup({ stored: { lastRunVersion: '0.2.0' } })
    const answer = deferred<UpdaterCheck | null>()
    world.fake.answer = () => answer.promise
    world.service.start()
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_DELAY_MS)
    expect((await world.service.state()).phase).toBe('checking')
    const joined = world.service.check()
    await vi.advanceTimersByTimeAsync(0)
    answer.reject(new Error('net::ERR_NAME_NOT_RESOLVED'))
    expect(await joined).toMatchObject({ phase: 'idle', error: { kind: 'offline', during: 'check' } })
    expect(world.fake.checks).toBe(1)
  })

  it('leaves a download and a waiting installer alone', async () => {
    vi.useFakeTimers()
    const world = setup({ stored: { lastRunVersion: '0.2.0' }, fetch: () => Promise.resolve(listOf('v0.3.0')) })
    world.fake.answer = () => Promise.resolve(found('0.3.0'))
    world.service.start()
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_DELAY_MS)
    expect((await world.service.state()).phase).toBe('available')
    const downloading = world.service.download()
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 2)
    expect(world.fake.checks).toBe(1)
    world.fake.downloads[0]?.finish()
    await downloading
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 2)
    expect(world.fake.checks).toBe(1)
    expect((await world.service.state()).phase).toBe('ready')
  })

  it('keeps finding the same update without asking GitHub’s API again', async () => {
    vi.useFakeTimers()
    const world = setup({ stored: { lastRunVersion: '0.2.0' }, fetch: () => Promise.resolve(listOf('v0.3.0')) })
    world.fake.answer = () => Promise.resolve(found('0.3.0'))
    world.service.start()
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_DELAY_MS + CHECK_INTERVAL_MS * 4)
    expect(world.fake.checks).toBe(5)
    expect(world.fetches).toBe(1)
    expect((await world.service.state()).phase).toBe('available')
  })
})

describe('a library that does not answer', () => {
  it('gives up on a check after a minute, and the next check works', async () => {
    vi.useFakeTimers()
    const world = setup({ stored: { lastRunVersion: '0.2.0', lastCheckedAt: 1234 } })
    const late = deferred<UpdaterCheck | null>()
    world.fake.answer = () => late.promise
    const checking = world.service.check()
    await vi.advanceTimersByTimeAsync(CHECK_TIMEOUT_MS - 1)
    expect((await world.service.state()).phase).toBe('checking')
    await vi.advanceTimersByTimeAsync(1)
    expect(await checking).toMatchObject({ phase: 'idle', lastCheckedAt: 1234, error: { kind: 'offline', during: 'check' } })

    // An answer that arrives after all is not acted on.
    late.resolve(found('0.3.0'))
    await vi.advanceTimersByTimeAsync(0)
    expect(await world.service.state()).toMatchObject({ phase: 'idle', offer: null })

    world.fake.answer = () => Promise.resolve(found('0.3.0'))
    expect(await world.service.check()).toMatchObject({ phase: 'available', error: null })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stays silent when it was the app’s own check, and swallows a late failure', async () => {
    vi.useFakeTimers()
    const world = setup({ stored: { lastRunVersion: '0.2.0' } })
    const late = deferred<UpdaterCheck | null>()
    world.fake.answer = () => late.promise
    world.service.start()
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_DELAY_MS + CHECK_TIMEOUT_MS)
    expect(await world.service.state()).toMatchObject({ phase: 'idle', error: null, lastCheckedAt: null })
    late.reject(new Error('net::ERR_CONNECTION_RESET'))
    await vi.advanceTimersByTimeAsync(0)
    expect((await world.service.state()).error).toBeNull()
  })

  it('"Cancel" does not hang on a download the library will not let go of', async () => {
    vi.useFakeTimers()
    const world = await withOffer()
    const downloading = world.service.download()
    await vi.advanceTimersByTimeAsync(0)
    const stuck = world.fake.downloads[0]
    if (!stuck) throw new Error('no download was started')
    stuck.handle.cancel = () => {} // the library is waiting on a stalled connection and does not notice
    const joined = world.service.download()
    const cancelling = world.service.cancelDownload()
    const cancellingAgain = world.service.cancelDownload()
    await vi.advanceTimersByTimeAsync(CANCEL_GRACE_MS - 1)
    expect((await world.service.state()).phase).toBe('downloading')
    await vi.advanceTimersByTimeAsync(1)
    const phases = (await Promise.all([cancelling, cancellingAgain, downloading, joined])).map((s) => s.phase)
    expect(phases).toEqual(['available', 'available', 'available', 'available'])
    expect(await world.service.state()).toMatchObject({ phase: 'available', progress: null, error: null, offer: { version: '0.3.0' } })

    // Whatever the abandoned download reports later changes nothing.
    world.fake.progress({ percent: 50, transferred: 5, total: 10, bytesPerSecond: 1 })
    stuck.finish()
    await vi.advanceTimersByTimeAsync(0)
    expect((await world.service.state()).phase).toBe('available')
    await expect(world.service.install()).rejects.toThrow('There is no downloaded update to install.')

    // And a new download starts from scratch.
    const again = world.service.download()
    await vi.advanceTimersByTimeAsync(0)
    expect(world.fake.downloads).toHaveLength(2)
    world.fake.downloads[1]?.finish()
    expect((await again).phase).toBe('ready')
  })

  it('ignores the late failure of an abandoned download too', async () => {
    vi.useFakeTimers()
    const world = await withOffer()
    void world.service.download()
    await vi.advanceTimersByTimeAsync(0)
    const stuck = world.fake.downloads[0]
    if (!stuck) throw new Error('no download was started')
    stuck.handle.cancel = () => {}
    const cancelling = world.service.cancelDownload()
    await vi.advanceTimersByTimeAsync(CANCEL_GRACE_MS)
    await cancelling
    stuck.fail(new Error('net::ERR_CONNECTION_RESET'))
    await vi.advanceTimersByTimeAsync(0)
    expect(await world.service.state()).toMatchObject({ phase: 'available', error: null })
  })

  it('a cancel the library honours at once does not wait for the grace period', async () => {
    vi.useFakeTimers()
    const world = await withOffer()
    void world.service.download()
    await vi.advanceTimersByTimeAsync(0)
    expect((await world.service.cancelDownload()).phase).toBe('available')
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('a check that is still writing its result down', () => {
  for (const outcome of ['nothing newer', 'an update'] as const) {
    it(`gets a check of its own when "Check for updates" is pressed just then (${outcome})`, async () => {
      vi.useFakeTimers()
      const world = setup({ stored: { lastRunVersion: '0.2.0' }, fetch: () => Promise.resolve(listOf('v0.3.0', 'v0.2.0')) })
      world.fake.answer = () => Promise.resolve(outcome === 'an update' ? found('0.3.0') : upToDate)
      const after = outcome === 'an update' ? 'available' : 'idle'
      // Only the write that ends the first check is slow: a virus scanner, a busy disk.
      const slow = deferred<void>()
      let held = false
      world.memory.holdWrite = (data) => {
        if (data.lastCheckedAt === null || held) return
        held = true
        return slow.promise
      }
      world.service.start()
      await vi.advanceTimersByTimeAsync(FIRST_CHECK_DELAY_MS)
      // The app's own check has its answer and has pushed it; updates.json is still being written.
      expect(held).toBe(true)
      expect((await world.service.state()).phase).toBe(after)

      const clicked = world.service.check()
      await vi.advanceTimersByTimeAsync(0)
      // Not "checking" on the strength of a check that will never report again.
      expect((await world.service.state()).phase).toBe(after)
      expect(world.fake.checks).toBe(1)
      slow.resolve()
      expect((await clicked).phase).toBe(after)
      expect(world.fake.checks).toBe(2)
      expect(world.states.map((s) => s.phase)).toEqual(['checking', after, 'checking', after])

      // Nothing is left hanging: the next check runs, and so do the app's own, six hours on.
      expect((await world.service.check()).phase).toBe(after)
      expect(world.fake.checks).toBe(3)
      await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS + CHECK_POLL_MS)
      expect(world.fake.checks).toBe(4)
      if (outcome === 'an update') {
        const downloading = world.service.download()
        await vi.advanceTimersByTimeAsync(0)
        world.fake.downloads[0]?.finish()
        expect((await downloading).phase).toBe('ready')
      }
    })
  }

  it('is still joined while it is waiting for GitHub', async () => {
    vi.useFakeTimers()
    const world = setup({ stored: { lastRunVersion: '0.2.0' }, fetch: () => Promise.resolve(listOf('v0.3.0')) })
    const answer = deferred<UpdaterCheck | null>()
    world.fake.answer = () => answer.promise
    world.service.start()
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_DELAY_MS)
    const clicked = world.service.check()
    await vi.advanceTimersByTimeAsync(0)
    answer.resolve(found('0.3.0'))
    expect((await clicked).phase).toBe('available')
    expect(world.fake.checks).toBe(1)
  })
})

describe('a download that "Cancel" had to give up on', () => {
  /** A service whose download stalled, was cancelled, and was left to end by itself. */
  async function withStalled() {
    const world = await withOffer()
    void world.service.download()
    await vi.advanceTimersByTimeAsync(0)
    const stuck = world.fake.downloads[0]
    if (!stuck) throw new Error('no download was started')
    stuck.handle.cancel = () => {} // the library is waiting on a stalled connection and does not notice
    const cancelling = world.service.cancelDownload()
    await vi.advanceTimersByTimeAsync(CANCEL_GRACE_MS)
    expect((await cancelling).phase).toBe('available')
    world.states.length = 0
    return { world, stuck }
  }

  it('is waited for by the next download, which then gets one of its own', async () => {
    vi.useFakeTimers()
    const { world, stuck } = await withStalled()
    const again = world.service.download()
    await vi.advanceTimersByTimeAsync(0)
    // The page shows a download that has not got anywhere yet. The library has not been asked:
    // it would only hand over the old download, and with it the old one's ending.
    expect(await world.service.state()).toMatchObject({ phase: 'downloading', progress: { percent: 0, transferred: 0 }, error: null })
    expect(world.fake.downloadCalls).toBe(1)
    // What the old download still reports is not the new one's progress.
    world.fake.progress({ percent: 50, transferred: 5, total: 10, bytesPerSecond: 1 })
    expect((await world.service.state()).progress?.percent).toBe(0)

    // The stalled transfer finally notices that it was cancelled.
    stuck.fail(new Error('cancelled'))
    await vi.advanceTimersByTimeAsync(0)
    expect(world.fake.downloads).toHaveLength(2)
    expect(await world.service.state()).toMatchObject({ phase: 'downloading', error: null })
    world.fake.progress({ percent: 20, transferred: 2, total: 10, bytesPerSecond: 1 })
    expect((await world.service.state()).progress?.percent).toBe(20)
    world.fake.downloads[1]?.finish()
    expect(await again).toMatchObject({ phase: 'ready', error: null })
    expect(world.lines.filter((line) => line.startsWith('error'))).toEqual([])
    expect(world.states.some((s) => s.error !== null)).toBe(false)
  })

  it('does not hold up "Cancel" on the download that is waiting for it', async () => {
    vi.useFakeTimers()
    const { world, stuck } = await withStalled()
    const again = world.service.download()
    await vi.advanceTimersByTimeAsync(0)
    // No grace period this time: there is nothing of the new download to let go of.
    const cancelled = await world.service.cancelDownload()
    expect(cancelled).toMatchObject({ phase: 'available', progress: null, error: null })
    expect(await again).toEqual(cancelled)
    expect(world.fake.downloadCalls).toBe(1)
    expect(vi.getTimerCount()).toBe(0)

    // The old one is still waited for by whoever comes next, and may also end well.
    const third = world.service.download()
    await vi.advanceTimersByTimeAsync(0)
    expect(world.fake.downloadCalls).toBe(1)
    stuck.finish()
    await vi.advanceTimersByTimeAsync(0)
    expect(world.fake.downloadCalls).toBe(2)
    world.fake.downloads[1]?.finish()
    expect((await third).phase).toBe('ready')
  })
})

describe('an install that an earlier run started and that never happened', () => {
  // What a run leaves in updates.json when it started the installer of 0.3.0 and quit.
  const begun = {
    lastRunVersion: '0.2.0',
    announcedVersion: '0.3.0',
    pendingNotes: { version: '0.3.0', from: '0.2.0', notes: [release('v0.3.0')] },
    cache: { fetchedAt: 1, releases: [release('v0.4.0'), release('v0.3.0'), release('v0.2.0')] }
  }
  const noted = 'warn an earlier run started the installer of 0.3.0, and this is still 0.2.0'

  it('is noted in the log, and reported once the same version is on offer again', async () => {
    vi.useFakeTimers()
    const world = setup({ stored: begun, now: () => 7000 })
    expect(await world.service.state()).toMatchObject({ phase: 'idle', error: null, whatsNew: null })
    expect(world.lines).toEqual([noted])

    // The app's own check finds 0.3.0 again. Its changelog window has been shown before, so
    // nothing opens; whoever opens it reads why "Restart and update" came to nothing.
    world.fake.answer = () => Promise.resolve(found('0.3.0'))
    world.service.start()
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_DELAY_MS)
    expect(await world.service.state()).toMatchObject({ phase: 'available', offer: { version: '0.3.0', announced: true }, error: { kind: 'unknown', during: 'install', at: 7000 } })

    // Trying again clears it, and it is said once per run.
    void world.service.download()
    await vi.advanceTimersByTimeAsync(0)
    expect((await world.service.state()).error).toBeNull()
    await world.service.cancelDownload()
    expect(await world.service.check()).toMatchObject({ phase: 'available', error: null })
    // The notes are still there for the day the update does arrive.
    expect(world.memory.current()?.pendingNotes?.version).toBe('0.3.0')
  })

  it('says nothing under another version, and nothing in a copy that cannot install', async () => {
    const newer = setup({ stored: begun })
    newer.fake.answer = () => Promise.resolve(found('0.4.0'))
    expect(await newer.service.check()).toMatchObject({ phase: 'available', offer: { version: '0.4.0' }, error: null })
    expect(newer.lines).toEqual([noted])

    // A portable copy that shares the folder with the installed one did not start that installer.
    const portable = setup({ stored: begun, mode: 'manual' })
    portable.fake.answer = () => Promise.resolve(found('0.3.0'))
    expect(await portable.service.check()).toMatchObject({ phase: 'available', error: null })
    expect(portable.lines).toEqual([])
  })

  it('is over once that version runs', async () => {
    const world = setup({ stored: begun, currentVersion: '0.3.0' })
    expect((await world.service.state()).whatsNew?.version).toBe('0.3.0')
    expect(world.lines).toEqual([])
    world.fake.answer = () => Promise.resolve(found('0.4.0'))
    expect((await world.service.check()).error).toBeNull()
  })

  it('is not what a failure the user was shown leaves behind', async () => {
    const world = await withOffer({ fileExists: () => false }, 'ready')
    await expect(world.service.install()).rejects.toThrow('The update could not be started.')
    expect(world.memory.current()?.pendingNotes).toBeNull()

    const next = setup({ stored: world.memory.current() })
    next.fake.answer = () => Promise.resolve(found('0.3.0'))
    expect(await next.service.check()).toMatchObject({ phase: 'available', error: null })
    expect(next.lines.filter((line) => line.includes('earlier run'))).toEqual([])
  })
})

describe('before the app quits', () => {
  it('there is a way to wait until updates.json has been written', async () => {
    const world = setup({ stored: { lastRunVersion: '0.2.0' } })
    await world.service.state()
    expect(world.service.busy).toBe(false)
    await world.service.idle()

    const slow = deferred<void>()
    world.memory.holdWrite = () => slow.promise
    const switching = world.service.setAutoCheck(false)
    const marking = world.service.check()
    await settle()
    expect(world.service.busy).toBe(true)
    let idle = false
    void world.service.idle().then(() => (idle = true))
    await settle()
    expect(idle).toBe(false)

    slow.resolve()
    await Promise.all([switching, marking])
    await settle()
    expect(idle).toBe(true)
    expect(world.service.busy).toBe(false)
    expect(world.memory.current()).toMatchObject({ autoCheck: false })
    expect(world.memory.current()?.lastCheckedAt).not.toBeNull()
  })

  it('and until the log has: its last lines are the ones about the install', async () => {
    const world = await withOffer({}, 'ready')
    await world.service.install()
    // The library has just logged the command line of the installer.
    const writing = deferred<void>()
    world.logWriting = writing
    expect(world.service.busy).toBe(true)
    let idle = false
    void world.service.idle().then(() => (idle = true))
    await settle()
    expect(idle).toBe(false)
    world.logWriting = null
    writing.resolve()
    await settle()
    expect(idle).toBe(true)
    expect(world.service.busy).toBe(false)
  })

  it('a write that fails does not keep the app from quitting', async () => {
    const world = setup({ stored: { lastRunVersion: '0.2.0' } })
    world.memory.failWrites = true
    await world.service.check()
    await world.service.idle()
    expect(world.service.busy).toBe(false)
  })
})

describe('what is pushed', () => {
  it('sends whole snapshots, one per change, and none when nothing changed', async () => {
    const world = await withOffer()
    await world.service.state()
    await world.service.markAnnounced('0.9.9')
    await world.service.setAutoCheck(true)
    await world.service.cancelDownload()
    await world.service.dismissWhatsNew()
    expect(world.states).toEqual([])
    await world.service.setAutoCheck(false)
    expect(world.states).toHaveLength(1)
    expect(Object.keys(world.states[0] ?? {}).sort()).toEqual(['autoCheck', 'currentVersion', 'error', 'lastCheckedAt', 'mode', 'offer', 'phase', 'progress', 'whatsNew'])
  })

  it('keeps working when the listener throws', async () => {
    const world = setup({ stored: { lastRunVersion: '0.2.0' } })
    const service = createUpdateService({
      mode: 'auto',
      currentVersion: '0.2.0',
      hadUpdatesFile: true,
      hadSaveFile: true,
      store: world.memory.store,
      log: { info() {}, warn() {}, error() {}, busy: false, idle: () => Promise.resolve() },
      loadUpdater: () => Promise.resolve(world.fake.updater),
      fetchReleases: () => Promise.resolve({ ok: false, reason: 'network' }),
      saveIdle: () => Promise.resolve(),
      fileExists: () => true,
      onState: () => {
        throw new Error('window is gone')
      }
    })
    expect((await service.check()).phase).toBe('idle')
    expect((await service.setAutoCheck(false)).autoCheck).toBe(false)
  })

  it('never passes on anything but the closed set of error kinds', async () => {
    const world = await withOffer()
    const kinds = new Set(['offline', 'not-ready', 'rate-limited', 'corrupt', 'disk', 'unknown'])
    const failures = [new Error('net::ERR_FAILED'), 'text', null, { code: 'EPERM' }, Object.assign(new Error('x'), { statusCode: 429 }), new Error('C:\\Users\\someone\\secret.txt')]
    for (const failure of failures) {
      world.fake.answer = () => Promise.reject(failure)
      const state = await world.service.check()
      expect(kinds.has(state.error?.kind ?? '')).toBe(true)
      expect(Object.keys(state.error ?? {}).sort()).toEqual(['at', 'during', 'kind'])
    }
    expect(JSON.stringify(world.states)).not.toContain('someone')
  })
})
