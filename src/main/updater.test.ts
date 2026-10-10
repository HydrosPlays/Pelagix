import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import electronUpdater, { type AppUpdater, type CancellationToken } from 'electron-updater'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyOptions, driveUpdater, filterRequests, NO_STAGING_ID, outgoingHeaders, requestHeaders, STAGING_ID_HEADER, withoutStagingId } from './updater'

/**
 * These run against the real electron-updater, not a stand-in: the point is to notice when a new
 * version of the library starts handling its id or its headers differently. Only the part that
 * needs a running Electron (the request filter on the library's session) uses a stand-in here.
 */

let dir: string
let lines: string[]
const logger = {
  info: (message?: unknown) => void lines.push(`info ${String(message)}`),
  warn: (message?: unknown) => void lines.push(`warn ${String(message)}`),
  error: (message?: unknown) => void lines.push(`error ${String(message)}`)
}
const options = { userAgent: 'Pelagix/0.2.0', logger }

/** The members of the library that are not public but decide what a request carries. */
interface Internals {
  stagingUserIdPromise: { value: Promise<string> }
  computeFinalHeaders(headers: Record<string, string>): Record<string, string>
  computeRequestHeaders(provider: { fileExtraDownloadHeaders: null }): Record<string, string>
}

const internals = (updater: AppUpdater): Internals => updater as unknown as Internals

/** A real updater, as the library builds it on Windows, running without Electron. */
function realUpdater(version = '0.2.0', quit: () => void = () => {}): AppUpdater {
  const app = {
    version,
    name: 'pelagix',
    isPackaged: true,
    appUpdateConfigPath: join(dir, 'app-update.yml'),
    userDataPath: dir,
    baseCachePath: dir,
    whenReady: () => Promise.resolve(),
    quit,
    relaunch() {},
    onQuit() {}
  }
  const Updater = electronUpdater.NsisUpdater as unknown as new (options: null, app: unknown) => AppUpdater
  return new Updater(null, app)
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pelagix-updater-'))
  lines = []
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('the library as shipped', () => {
  it('would download and install by itself, which is why the options are set', () => {
    const updater = realUpdater()
    expect(updater.autoDownload).toBe(true)
    expect(updater.autoInstallOnAppQuit).toBe(true)
    expect(updater.requestHeaders).toBeNull()
  })

  it('makes up an id, writes it to .updaterId and puts it on its requests', async () => {
    const updater = realUpdater()
    updater.logger = null
    const id = await internals(updater).stagingUserIdPromise.value
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(id).not.toBe(NO_STAGING_ID)
    expect(await readdir(dir)).toEqual(['.updaterId'])
    expect(internals(updater).computeFinalHeaders({ [STAGING_ID_HEADER]: id })).toEqual({ [STAGING_ID_HEADER]: id })
  })
})

describe('applyOptions', () => {
  it('sets every option the way Pelagix needs it', () => {
    const updater = realUpdater()
    applyOptions(updater, options)
    expect(updater.autoDownload).toBe(false)
    expect(updater.autoInstallOnAppQuit).toBe(false)
    expect(updater.autoRunAppAfterInstall).toBe(true)
    expect(updater.allowPrerelease).toBe(false)
    expect(updater.allowDowngrade).toBe(false)
    expect(updater.disableWebInstaller).toBe(true)
    expect(updater.fullChangelog).toBe(false)
    expect(updater.logger).toBe(logger)
    expect(updater.requestHeaders).toEqual({ 'User-Agent': 'Pelagix/0.2.0', 'Accept-Language': 'en', 'x-user-staging-id': NO_STAGING_ID })
    expect(lines).toEqual([])
  })

  it('never offers prereleases, even to a prerelease build', () => {
    const updater = realUpdater('0.3.0-beta.1')
    expect(updater.allowPrerelease).toBe(true)
    applyOptions(updater, options)
    expect(updater.allowPrerelease).toBe(false)
    expect(updater.allowDowngrade).toBe(false)
  })

  it('keeps the library from making up an id: nothing is generated and no file is written', async () => {
    const updater = realUpdater()
    applyOptions(updater, options)
    expect(await internals(updater).stagingUserIdPromise.value).toBe(NO_STAGING_ID)
    expect(await internals(updater).stagingUserIdPromise.value).toBe(NO_STAGING_ID)
    expect(await readdir(dir)).toEqual([])
    expect(lines.filter((line) => line.includes('staging'))).toEqual([])
  })

  it('does not use an id an earlier version of the library left on disk', async () => {
    const earlier = '5f974a46-2093-5967-8a5e-9270892238d0'
    await writeFile(join(dir, '.updaterId'), earlier)
    const updater = realUpdater()
    applyOptions(updater, options)
    expect(await internals(updater).stagingUserIdPromise.value).toBe(NO_STAGING_ID)
    expect(JSON.stringify(internals(updater).computeFinalHeaders({ [STAGING_ID_HEADER]: await internals(updater).stagingUserIdPromise.value }))).not.toContain(earlier)
  })

  it('replaces the id in the headers of a check even if the library had a real one', () => {
    const updater = realUpdater()
    applyOptions(updater, options)
    // What AppUpdater.getUpdateInfoAndProvider hands to the provider before every check.
    const forCheck = internals(updater).computeFinalHeaders({ [STAGING_ID_HEADER]: 'a-real-id-from-somewhere' })
    expect(forCheck).toEqual({ 'User-Agent': 'Pelagix/0.2.0', 'Accept-Language': 'en', 'x-user-staging-id': NO_STAGING_ID })
    // What it puts on the download of the installer and its block maps.
    const forDownload = internals(updater).computeRequestHeaders({ fileExtraDownloadHeaders: null })
    expect(forDownload).toEqual({ accept: '*/*', 'User-Agent': 'Pelagix/0.2.0', 'Accept-Language': 'en', 'x-user-staging-id': NO_STAGING_ID })
  })

  it('leaves an emitted error without anything to throw it', () => {
    const updater = realUpdater()
    applyOptions(updater, options)
    expect(() => updater.emit('error', new Error('boom'))).not.toThrow()
    expect(updater.listenerCount('error')).toBeGreaterThanOrEqual(2)
    // The library reports it through the logger it was given.
    expect(lines.some((line) => line.startsWith('error Error: Error: boom'))).toBe(true)
  })

  it('says so when the library no longer keeps its id where it used to', () => {
    const changed = Object.assign(realUpdater(), { stagingUserIdPromise: undefined })
    applyOptions(changed, options)
    expect(lines).toEqual(['warn the updater keeps its id differently now; it is still removed from every request'])
    // The public measure still holds.
    expect(internals(changed).computeFinalHeaders({ [STAGING_ID_HEADER]: 'real' })[STAGING_ID_HEADER]).toBe(NO_STAGING_ID)
  })

  it('reports whether the id could be fixed at its source', () => {
    expect(withoutStagingId(realUpdater())).toBe(true)
    expect(withoutStagingId({} as AppUpdater)).toBe(false)
    expect(withoutStagingId({ stagingUserIdPromise: 'x' } as unknown as AppUpdater)).toBe(false)
    expect(withoutStagingId({ stagingUserIdPromise: Object.freeze({ value: 1 }) } as unknown as AppUpdater)).toBe(false)
  })
})

describe('driveUpdater', () => {
  // The same module objects the library gets when it asks for them.
  const nodeRequire = createRequire(import.meta.url)
  const childProcess = nodeRequire('node:child_process') as typeof import('node:child_process')
  const electronId = nodeRequire.resolve('electron')
  let happened: string[]

  /** What the library reads off a finished download when it is told to install. */
  const downloaded = (updater: AppUpdater, file: string): void => {
    Object.assign(updater, { downloadedUpdateHelper: { file, packageFile: null, downloadedFileInfo: {} } })
  }
  /** One turn of the event loop: the library quits from a `setImmediate`. */
  const nextTurn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))
  const drive = (updater: AppUpdater) => driveUpdater(updater, () => new electronUpdater.CancellationToken())

  beforeEach(() => {
    happened = []
    // The library asks for "electron" at the moment it quits. Outside Electron that module is
    // only the path of the program, so it is handed the one thing it uses instead.
    const standIn = { autoUpdater: { emit: (name: string) => void happened.push(`electron: ${name}`) } }
    nodeRequire.cache[electronId] = { id: electronId, filename: electronId, loaded: true, exports: standIn, children: [], paths: [] } as unknown as NodeJS.Module
    vi.spyOn(childProcess, 'spawn').mockImplementation(((command: string, args: readonly string[]) => {
      happened.push(`spawn: ${[command, ...args].join(' ')}`)
      return { pid: 4242, on() {}, unref() {} }
    }) as unknown as typeof childProcess.spawn)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete nodeRequire.cache[electronId]
  })

  it('install() starts the downloaded installer silently, set to reopen the app, and the app then quits', async () => {
    const updater = realUpdater('0.2.0', () => void happened.push('app: quit'))
    applyOptions(updater, options)
    const installer = join(dir, 'pending', 'Pelagix-0.3.0-setup.exe')
    downloaded(updater, installer)
    expect(drive(updater).install()).toBe(true)
    // Silent ("/S"): not silent, the installer opens on "who is this for" and waits. "--force-run"
    // reopens the app; without it the user is left with nothing on screen.
    expect(happened).toEqual([`spawn: ${installer} --updated /S --force-run`])
    expect(vi.mocked(childProcess.spawn).mock.calls[0]?.[2]).toMatchObject({ detached: true })
    await nextTurn()
    expect(happened).toEqual([`spawn: ${installer} --updated /S --force-run`, 'electron: before-quit-for-update', 'app: quit'])
    expect(lines.some((line) => line.startsWith('info Executing: ') && line.endsWith('with args: --updated,/S,--force-run'))).toBe(true)
  })

  it('install() answers false, starts nothing and quits nothing when there is no download', async () => {
    const updater = realUpdater('0.2.0', () => void happened.push('app: quit'))
    applyOptions(updater, options)
    const driven = drive(updater)
    expect(driven.install()).toBe(false)
    await nextTurn()
    expect(happened).toEqual([])
    // Its own listener is gone again, and the attempt has not locked the next one out.
    expect(updater.listenerCount('error')).toBe(2)
    downloaded(updater, join(dir, 'Pelagix-0.3.0-setup.exe'))
    expect(driven.install()).toBe(true)
    await nextTurn()
    expect(happened.at(-1)).toBe('app: quit')
  })

  it('install() still answers true when Windows refuses to run the installer: that is found out too late', async () => {
    const updater = realUpdater('0.2.0', () => void happened.push('app: quit'))
    applyOptions(updater, options)
    downloaded(updater, join(dir, 'Pelagix-0.3.0-setup.exe'))
    vi.mocked(childProcess.spawn).mockImplementation((() => {
      throw Object.assign(new Error('spawn EPERM'), { code: 'EPERM' })
    }) as unknown as typeof childProcess.spawn)
    expect(drive(updater).install()).toBe(true)
    await nextTurn()
    // The library reports it, to its log, and quits the app all the same. The update service
    // therefore notices at the next start that the update never arrived.
    expect(lines.some((line) => line.startsWith('info Cannot run installer: error code: EPERM'))).toBe(true)
    expect(happened).toEqual(['electron: before-quit-for-update', 'app: quit'])
  })

  it('download() gives the library a cancel token of its own every time', async () => {
    const updater = realUpdater()
    applyOptions(updater, options)
    const tokens: CancellationToken[] = []
    const ends: Array<(err: Error) => void> = []
    // The network part only: a download that runs until the test ends it.
    Object.assign(updater, {
      updateInfoAndProvider: { info: { version: '0.3.0', files: [] }, provider: { fileExtraDownloadHeaders: null } },
      doDownloadUpdate: (asked: { cancellationToken: CancellationToken }) => {
        tokens.push(asked.cancellationToken)
        return new Promise<string[]>((_resolve, reject) => ends.push(reject))
      }
    })
    const driven = drive(updater)
    const first = driven.download()
    first.cancel()
    expect(tokens).toHaveLength(1)
    expect(tokens[0]?.cancelled).toBe(true)

    // While that one runs the library answers with it, whoever asks: the second caller's cancel
    // reaches nothing, and both get the first one's ending. The update service waits for that.
    const second = driven.download()
    second.cancel()
    expect(tokens).toHaveLength(1)
    ends[0]?.(new Error('cancelled'))
    await expect(first.done).rejects.toThrow('cancelled')
    await expect(second.done).rejects.toThrow('cancelled')

    const third = driven.download()
    expect(tokens).toHaveLength(2)
    expect(tokens[1]).not.toBe(tokens[0])
    expect(tokens[1]?.cancelled).toBe(false)
    third.cancel()
    expect(tokens[1]?.cancelled).toBe(true)
    ends[1]?.(new Error('cancelled'))
    await expect(third.done).rejects.toThrow('cancelled')
  })

  it('passes download progress on', () => {
    const updater = realUpdater()
    const seen: unknown[] = []
    drive(updater).onProgress((info) => seen.push(info))
    updater.emit('download-progress', { percent: 40, transferred: 4, total: 10, bytesPerSecond: 2, delta: 1 })
    expect(seen).toEqual([{ percent: 40, transferred: 4, total: 10, bytesPerSecond: 2, delta: 1 }])
  })
})

describe('request headers', () => {
  it('asks the library for exactly three headers', () => {
    expect(requestHeaders('Pelagix/0.2.0')).toEqual({ 'User-Agent': 'Pelagix/0.2.0', 'Accept-Language': 'en', 'x-user-staging-id': NO_STAGING_ID })
    // The key the library looks for before it adds "User-Agent: electron-builder".
    expect(Object.keys(requestHeaders('x'))).toContain('User-Agent')
  })

  it('removes the id from what leaves the machine, however it is spelled', () => {
    const real = '5f974a46-2093-5967-8a5e-9270892238d0'
    for (const name of ['x-user-staging-id', 'X-User-Staging-Id', 'X-USER-STAGING-ID']) {
      const out = outgoingHeaders({ [name]: real, accept: '*/*' }, 'Pelagix/0.2.0')
      expect(out).toEqual({ accept: '*/*', 'User-Agent': 'Pelagix/0.2.0', 'Accept-Language': 'en' })
      expect(JSON.stringify(out)).not.toContain(real)
    }
    // The placeholder goes too: nothing is sent at all.
    expect(outgoingHeaders(requestHeaders('Pelagix/0.2.0'), 'Pelagix/0.2.0')).toEqual({ 'User-Agent': 'Pelagix/0.2.0', 'Accept-Language': 'en' })
  })

  it('puts the app name and a fixed language on every request, once', () => {
    const out = outgoingHeaders({ 'user-agent': 'electron-builder', 'User-Agent': 'Mozilla/5.0 Electron/44', 'accept-language': 'de-DE,de;q=0.9', 'Cache-Control': 'no-cache', Range: 'bytes=0-99' }, 'Pelagix/0.2.0')
    expect(out).toEqual({ 'Cache-Control': 'no-cache', Range: 'bytes=0-99', 'User-Agent': 'Pelagix/0.2.0', 'Accept-Language': 'en' })
  })

  it('sends no cookies', () => {
    expect(outgoingHeaders({ Cookie: '_gh_sess=abc; logged_in=no', cookie: '_octo=GH1.1' }, 'Pelagix/0.2.0')).toEqual({ 'User-Agent': 'Pelagix/0.2.0', 'Accept-Language': 'en' })
  })

  it('filters every request of the session it is given', () => {
    type Listener = (details: { requestHeaders: Record<string, string> }, callback: (response: { requestHeaders?: Record<string, string | string[]> }) => void) => void
    const listeners: Listener[] = []
    const session = { webRequest: { onBeforeSendHeaders: (listener: Listener) => void listeners.push(listener) } }
    filterRequests(session as unknown as Parameters<typeof filterRequests>[0], 'Pelagix/0.2.0')
    expect(listeners).toHaveLength(1)
    const sent: unknown[] = []
    listeners[0]?.({ requestHeaders: { 'x-user-staging-id': 'real', 'User-Agent': 'electron-builder', accept: 'application/json' } }, (response) => sent.push(response))
    expect(sent).toEqual([{ requestHeaders: { accept: 'application/json', 'User-Agent': 'Pelagix/0.2.0', 'Accept-Language': 'en' } }])
  })
})
