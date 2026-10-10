import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpdateState } from '@shared/api'
import { createSaveStore } from './save'
import type { UpdateService } from './update-service'
import { UPDATES_FILE } from './update-store'
import { createUpdates } from './updates'

/**
 * The wiring in updates.ts, with a stand-in for the two things it takes from Electron. What it
 * has to get right happens before the page can run: which kind of copy this is, and whether
 * updates.json and save.json were already there. A check is never started here, so the updater
 * library is not loaded.
 */

const electron = vi.hoisted(() => ({ userData: '', packaged: true, requests: [] as { url: string; headers: Record<string, string> }[] }))

vi.mock('electron', () => ({
  app: {
    getPath: () => electron.userData,
    getVersion: () => '0.2.0',
    get isPackaged() {
      return electron.packaged
    }
  },
  net: {
    fetch: (url: string, init?: { headers?: Record<string, string> }) => {
      electron.requests.push({ url, headers: init?.headers ?? {} })
      return Promise.reject(new Error('net::ERR_INTERNET_DISCONNECTED'))
    }
  }
}))

let dir: string
let states: UpdateState[]
let created: UpdateService[]
const platform = Object.getOwnPropertyDescriptor(process, 'platform')
const execPath = Object.getOwnPropertyDescriptor(process, 'execPath')

/** Lets the writes the service started without waiting for them reach the folder. */
const settled = async (service: { idle(): Promise<void> }): Promise<void> => {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5))
    await service.idle()
  }
}

function create(): UpdateService {
  const service = createUpdates(createSaveStore(dir, { log: () => {} }), (state) => void states.push(state))
  created.push(service)
  return service
}

/** Which kind of copy a service created now takes itself for. One at a time: they share the folder. */
async function modeNow(): Promise<string> {
  const service = create()
  const { mode } = await service.state()
  await settled(service)
  return mode
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pelagix-updates-wiring-'))
  electron.userData = dir
  electron.packaged = true
  electron.requests = []
  states = []
  created = []
  // The updater only exists on Windows; the tests say so wherever they run.
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
  // Where the running exe is: a folder of the test's own, so that it can hold an uninstaller or not.
  Object.defineProperty(process, 'execPath', { value: join(dir, 'app', 'Pelagix.exe'), configurable: true })
  vi.stubEnv('PELAGIX_SMOKE', '')
  vi.stubEnv('PORTABLE_EXECUTABLE_FILE', '')
})

afterEach(async () => {
  if (platform) Object.defineProperty(process, 'platform', platform)
  if (execPath) Object.defineProperty(process, 'execPath', execPath)
  vi.unstubAllEnvs()
  // Nothing may still be writing into the folder when it is removed.
  for (const service of created) await settled(service)
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
})

describe('createUpdates', () => {
  it('a fresh profile: records the version, shows nothing and asks nobody', async () => {
    const service = create()
    expect(await service.state()).toEqual({ mode: 'manual', currentVersion: '0.2.0', autoCheck: true, phase: 'idle', lastCheckedAt: null, offer: null, progress: null, error: null, whatsNew: null })
    await settled(service)
    expect(JSON.parse(await readFile(join(dir, UPDATES_FILE), 'utf8'))).toMatchObject({ lastRunVersion: '0.2.0', whatsNew: null })
    expect(electron.requests).toEqual([])
    expect(await readdir(dir)).toEqual([UPDATES_FILE])
  })

  it('a save without updates.json is the upgrade from 0.1.0, even when the page writes a save straight away', async () => {
    await writeFile(join(dir, 'save.json'), '{}')
    const service = create()
    // What was there is looked at when the service is created, not when it is first asked.
    await rm(join(dir, 'save.json'))
    await service.state()
    await settled(service)
    expect(states.at(-1)?.whatsNew).toEqual({ version: '0.2.0', from: '0.1.0', url: 'https://github.com/HydrosPlays/Pelagix/releases/tag/v0.2.0', notes: [] })
    // The one request for the notes says which app is asking and nothing about who.
    expect(electron.requests.map((request) => request.url)).toEqual(['https://api.github.com/repos/HydrosPlays/Pelagix/releases?per_page=20'])
    expect(electron.requests[0]?.headers).toMatchObject({ 'User-Agent': 'Pelagix/0.2.0', 'Accept-Language': 'en' })
  })

  it('a profile that already had updates.json is not taken for an upgrade', async () => {
    await writeFile(join(dir, 'save.json'), '{}')
    await writeFile(join(dir, UPDATES_FILE), JSON.stringify({ v: 1, autoCheck: false, lastRunVersion: '0.2.0' }))
    const service = create()
    expect(await service.state()).toMatchObject({ autoCheck: false, whatsNew: null })
    await settled(service)
    expect(electron.requests).toEqual([])
  })

  it('only a copy with the setup exe’s uninstaller beside it installs updates itself', async () => {
    expect(await modeNow()).toBe('manual')
    await writeFile(join(dir, 'Uninstall Pelagix.exe'), '')
    // Not beside the exe: in its parent folder.
    expect(await modeNow()).toBe('manual')
    await rm(join(dir, 'Uninstall Pelagix.exe'))

    await mkdir(join(dir, 'app'))
    await writeFile(join(dir, 'app', 'Uninstall Pelagix.exe'), '')
    expect(await modeNow()).toBe('auto')
    // The portable exe unpacks next to nothing of the kind, and says what it is.
    vi.stubEnv('PORTABLE_EXECUTABLE_FILE', 'D:\\Pelagix-0.2.0-portable.exe')
    expect(await modeNow()).toBe('manual')
  })

  it('does nothing at all when the app is not packaged, in a smoke run, or not on Windows', async () => {
    await writeFile(join(dir, 'save.json'), '{}')
    const off = { mode: 'off', currentVersion: '0.2.0', autoCheck: false, phase: 'idle', lastCheckedAt: null, offer: null, progress: null, error: null, whatsNew: null }

    electron.packaged = false
    const unpackaged = create()
    electron.packaged = true
    vi.stubEnv('PELAGIX_SMOKE', '1')
    const smoke = create()
    vi.stubEnv('PELAGIX_SMOKE', '')
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
    const elsewhere = create()

    for (const service of [unpackaged, smoke, elsewhere]) {
      service.start()
      expect(await service.state()).toEqual(off)
      expect(await service.check()).toEqual(off)
      expect(service.busy).toBe(false)
      await settled(service)
    }
    expect(states).toEqual([])
    expect(electron.requests).toEqual([])
    expect(await readdir(dir)).toEqual(['save.json'])
  })
})
