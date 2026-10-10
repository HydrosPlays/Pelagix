import { describe, expect, it } from 'vitest'
import type { UpdateOffer, UpdatePhase, UpdateState, WhatsNew } from '@shared/api'
import {
  CHECK_INTERVAL_MS,
  classifyUpdateError,
  createProgressGate,
  decideWhatsNew,
  defaultStoredUpdates,
  detectUpdateMode,
  embeddedNote,
  holdsVersion,
  initialUpdateState,
  isAutoCheckDue,
  MAX_NOTES,
  MAX_UPDATES_BYTES,
  parseStoredUpdates,
  reduceUpdate,
  rescueStoredUpdates,
  RESCUE_SCAN_LENGTH,
  selectNotes,
  serializeStoredUpdates,
  toOffer,
  toProgress,
  toReleaseNote,
  toWhatsNew,
  uninstallerPath,
  versionPageUrl,
  type ModeInput,
  type StoredNotes,
  type StoredUpdates,
  type UpdateEvent
} from './update-model'
import type { GitHubRelease } from './update-releases'

const TAG_URL = 'https://github.com/HydrosPlays/Pelagix/releases/tag/'

const release = (tag: string, extra: Partial<GitHubRelease> = {}): GitHubRelease => ({
  tag,
  version: tag.replace(/^v/, '').replace(/\+.*$/, ''),
  name: `Pelagix ${tag}`,
  publishedAt: '2026-11-01T10:00:00Z',
  body: `notes of ${tag}`,
  prerelease: tag.includes('-'),
  ...extra
})

describe('detectUpdateMode', () => {
  const installed: ModeInput = { platform: 'win32', isPackaged: true, env: {}, hasUninstaller: true }

  const cases: [string, Partial<ModeInput>, string][] = [
    ['installed with the setup exe', {}, 'auto'],
    ['the portable exe', { hasUninstaller: false, env: { PORTABLE_EXECUTABLE_FILE: 'C:\\Users\\me\\Downloads\\Pelagix-0.2.0-portable.exe' } }, 'manual'],
    ['an unpacked folder', { hasUninstaller: false }, 'manual'],
    ['a portable exe started from inside an install folder', { env: { PORTABLE_EXECUTABLE_FILE: 'D:\\Pelagix\\Pelagix-portable.exe' } }, 'manual'],
    ['an empty portable variable is no portable run', { env: { PORTABLE_EXECUTABLE_FILE: '' } }, 'auto'],
    ['development', { isPackaged: false }, 'off'],
    ['development next to an uninstaller', { isPackaged: false, hasUninstaller: true }, 'off'],
    ['a smoke run of the installed app', { env: { PELAGIX_SMOKE: '1' } }, 'off'],
    ['a smoke run of the portable exe', { hasUninstaller: false, env: { PELAGIX_SMOKE: '1', PORTABLE_EXECUTABLE_FILE: 'x.exe' } }, 'off'],
    ['a smoke variable that is not exactly 1', { env: { PELAGIX_SMOKE: 'true' } }, 'auto'],
    ['macOS', { platform: 'darwin' }, 'off'],
    ['Linux', { platform: 'linux' }, 'off']
  ]
  for (const [name, change, expected] of cases) {
    it(`${name} -> ${expected}`, () => {
      expect(detectUpdateMode({ ...installed, ...change })).toBe(expected)
    })
  }

  it('looks for the uninstaller the setup exe writes next to the app', () => {
    expect(uninstallerPath('C:\\Users\\me\\AppData\\Local\\Programs\\Pelagix\\Pelagix.exe')).toBe('C:\\Users\\me\\AppData\\Local\\Programs\\Pelagix\\Uninstall Pelagix.exe')
    expect(uninstallerPath('D:\\Apps\\My Dex\\PELAGIX.EXE')).toBe('D:\\Apps\\My Dex\\Uninstall PELAGIX.exe')
    expect(uninstallerPath('C:/Program Files/Pelagix/Pelagix.exe')).toBe('C:\\Program Files\\Pelagix\\Uninstall Pelagix.exe')
  })
})

describe('classifyUpdateError', () => {
  const coded = (code: string, message = 'x'): Error => Object.assign(new Error(message), { code })
  const http = (statusCode: number): Error => Object.assign(new Error(`${statusCode} whatever\nHeaders: {"server": "GitHub.com"}`), { statusCode, code: `HTTP_ERROR_${statusCode}`, name: 'HttpError' })

  const cases: [string, unknown, string][] = [
    // Observed in the spike (electron-updater 6.8.9 on Electron 44).
    ['DNS failure', new Error('net::ERR_NAME_NOT_RESOLVED'), 'offline'],
    ['connection refused', new Error('net::ERR_CONNECTION_REFUSED'), 'offline'],
    ['no network', new Error('net::ERR_INTERNET_DISCONNECTED'), 'offline'],
    ['proxy failure', new Error('net::ERR_PROXY_CONNECTION_FAILED'), 'offline'],
    ['certificate problem', new Error('net::ERR_CERT_AUTHORITY_INVALID'), 'offline'],
    ['socket timeout', new Error('Request timed out'), 'offline'],
    ['dropped connection', new Error('Request has been aborted by the server'), 'offline'],
    ['node socket error', coded('ECONNRESET', 'read ECONNRESET'), 'offline'],
    [
      'the real v0.1.0 release, which has no latest.yml',
      coded(
        'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND',
        'Cannot find latest.yml in the latest release artifacts (https://github.com/HydrosPlays/Pelagix/releases/download/v0.1.0/latest.yml): HttpError: 404 \n"method: GET url: https://github.com/..."\nHeaders: {"x-ratelimit-remaining": "0", "status": "403"}'
      ),
      'not-ready'
    ],
    ['unparsable latest.yml', coded('ERR_UPDATER_INVALID_UPDATE_INFO'), 'not-ready'],
    ['latest.yml without files', coded('ERR_UPDATER_NO_FILES_PROVIDED'), 'not-ready'],
    ['latest.yml without a checksum', coded('ERR_UPDATER_NO_CHECKSUM'), 'not-ready'],
    ['no release yet', coded('ERR_UPDATER_NO_PUBLISHED_VERSIONS', 'No published versions on GitHub'), 'not-ready'],
    ['a version that is not one', coded('ERR_UPDATER_INVALID_VERSION'), 'not-ready'],
    ['no latest release', coded('ERR_UPDATER_LATEST_VERSION_NOT_FOUND', 'Unable to find latest version on GitHub (https://github.com/x/y/releases/latest), please ensure a production release exists: HttpError: 404 Not Found'), 'not-ready'],
    ['a feed that does not parse', coded('ERR_UPDATER_INVALID_RELEASE_FEED', 'Cannot parse releases feed: TypeError: x,\nXML:\n<feed/>'), 'not-ready'],
    ['the setup exe named in latest.yml is not uploaded', new Error('Cannot download "https://github.com/HydrosPlays/Pelagix/releases/download/v0.2.0/Pelagix-0.2.0-setup.exe", status 404: Not Found'), 'not-ready'],
    ['a 404 as an HttpError', http(404), 'not-ready'],
    ['checksum mismatch', coded('ERR_CHECKSUM_MISMATCH', 'sha512 checksum mismatch, expected a, got b'), 'corrupt'],
    ['checksum mismatch without a code', new Error('sha512 checksum mismatch, expected a, got b'), 'corrupt'],
    ['rate limited feed', http(429), 'rate-limited'],
    ['forbidden feed', http(403), 'rate-limited'],
    ['rate limited download', new Error('Cannot download "https://github.com/x/y.exe", status 429: Too Many Requests'), 'rate-limited'],
    ['a status code without a code string', Object.assign(new Error('nope'), { statusCode: 403 }), 'rate-limited'],
    ['GitHub is down', http(503), 'offline'],
    ['bad gateway on a download', new Error('Cannot download "https://github.com/x/y.exe", status 502: Bad Gateway'), 'offline'],
    ['disk full', coded('ENOSPC', 'ENOSPC: no space left on device, write'), 'disk'],
    ['no permission', coded('EPERM', 'EPERM: operation not permitted, rename'), 'disk'],
    ['file in use', coded('EBUSY'), 'disk'],
    ['access denied', coded('EACCES'), 'disk'],
    ['an unpacked folder without app-update.yml', coded('ENOENT', "ENOENT: no such file or directory, open 'C:\\Pelagix\\resources\\app-update.yml'"), 'unknown'],
    ['a cancelled download', new Error('cancelled'), 'unknown'],
    ['a plain error', new Error('boom'), 'unknown']
  ]
  for (const [name, err, expected] of cases) {
    it(`${name} -> ${expected}`, () => {
      expect(classifyUpdateError(err)).toBe(expected)
    })
  }

  it('reads the cause out of an error that only names the failed step', () => {
    const wrap = (inner: string): Error => coded('ERR_UPDATER_LATEST_VERSION_NOT_FOUND', `Unable to find latest version on GitHub (https://github.com/HydrosPlays/Pelagix/releases/latest), please ensure a production release exists: ${inner}`)
    expect(classifyUpdateError(wrap('Error: net::ERR_INTERNET_DISCONNECTED\n    at SimpleURLLoaderWrapper'))).toBe('offline')
    expect(classifyUpdateError(wrap('HttpError: 429 Too Many Requests\nHeaders: {}'))).toBe('rate-limited')
    expect(classifyUpdateError(wrap('HttpError: 503 Service Unavailable'))).toBe('offline')
    expect(classifyUpdateError(wrap('SyntaxError: Unexpected token <'))).toBe('not-ready')
    expect(classifyUpdateError(coded('ERR_UPDATER_INVALID_RELEASE_FEED', 'Cannot parse releases feed: Error: Unable to find latest version on GitHub (x): Error: net::ERR_NAME_NOT_RESOLVED,\nXML:\n<feed>'))).toBe('offline')
  })

  it('does not let text inside a known error change its meaning', () => {
    // The header dump of a 404 mentions rate limits and other statuses.
    const notFound = coded('ERR_UPDATER_CHANNEL_FILE_NOT_FOUND', 'HttpError: 404\nHeaders: {"retry-after": "status 429", "x": "net::ERR_FAILED"}')
    expect(classifyUpdateError(notFound)).toBe('not-ready')
    expect(classifyUpdateError(coded('ERR_CHECKSUM_MISMATCH', 'status 404 net::ERR_FAILED'))).toBe('corrupt')
    expect(classifyUpdateError(coded('ENOSPC', 'status 429'))).toBe('disk')
  })

  it('only looks at the start of a very long message', () => {
    const padded = new Error(`${'x'.repeat(10_000)} net::ERR_FAILED status 429`)
    expect(classifyUpdateError(padded)).toBe('unknown')
  })

  it('answers "unknown" for anything that is not an error, without throwing', () => {
    const trap = new Proxy(
      {},
      {
        get: () => {
          throw new Error('trap')
        }
      }
    )
    for (const odd of [null, undefined, 0, 42, '', 'plain text', true, [], {}, { code: 42, message: 7, statusCode: '404' }, { statusCode: 9999 }, Symbol('x'), () => {}, trap]) {
      expect(classifyUpdateError(odd)).toBe('unknown')
    }
    expect(classifyUpdateError('net::ERR_FAILED')).toBe('offline')
  })

  it('never returns anything outside the closed set', () => {
    const kinds = new Set(['offline', 'not-ready', 'rate-limited', 'corrupt', 'disk', 'unknown'])
    for (const [, err] of cases) expect(kinds.has(classifyUpdateError(err))).toBe(true)
  })
})

describe('reduceUpdate', () => {
  const offer: UpdateOffer = { version: '0.3.0', url: `${TAG_URL}v0.3.0`, notes: [], announced: false }
  const idle = initialUpdateState('auto', '0.2.0')
  const run = (state: UpdateState, ...events: UpdateEvent[]): UpdateState => events.reduce(reduceUpdate, state)
  const available = run(idle, { type: 'check-started', manual: false }, { type: 'check-succeeded', offer, at: 1000 })
  const downloading = run(available, { type: 'download-started' })
  const ready = run(downloading, { type: 'download-succeeded' })
  const installing = run(ready, { type: 'install-started' })
  const everyPhase: Record<UpdatePhase, UpdateState> = { idle, checking: run(idle, { type: 'check-started', manual: false }), available, downloading, ready, installing }

  it('starts idle, with the switch on wherever checks can run', () => {
    expect(idle).toEqual({ mode: 'auto', currentVersion: '0.2.0', autoCheck: true, phase: 'idle', lastCheckedAt: null, offer: null, progress: null, error: null, whatsNew: null })
    expect(initialUpdateState('manual', '0.2.0').autoCheck).toBe(true)
    expect(initialUpdateState('off', '0.2.0')).toMatchObject({ mode: 'off', autoCheck: false, phase: 'idle' })
  })

  it('walks the whole way from a check to an install', () => {
    expect(available).toMatchObject({ phase: 'available', offer, lastCheckedAt: 1000, progress: null, error: null })
    expect(downloading).toMatchObject({ phase: 'downloading', offer, progress: { percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 } })
    const half = { percent: 50, transferred: 5, total: 10, bytesPerSecond: 2 }
    expect(run(downloading, { type: 'download-progress', progress: half }).progress).toEqual(half)
    expect(ready).toMatchObject({ phase: 'ready', offer, progress: null, error: null })
    expect(installing).toMatchObject({ phase: 'installing', offer, progress: null })
  })

  it('returns to idle, and records the time, when there is nothing newer', () => {
    const checked = run(idle, { type: 'check-started', manual: true }, { type: 'check-succeeded', offer: null, at: 5000 })
    expect(checked).toMatchObject({ phase: 'idle', offer: null, lastCheckedAt: 5000, error: null })
    // An offer that is gone from GitHub is gone here too.
    expect(run(available, { type: 'check-started', manual: true }, { type: 'check-succeeded', offer: null, at: 6000 })).toMatchObject({ phase: 'idle', offer: null })
  })

  it('shows a failed check the user asked for, and leaves lastCheckedAt alone', () => {
    const failed = run(idle, { type: 'check-started', manual: true }, { type: 'check-failed', manual: true, kind: 'offline', at: 7000 })
    expect(failed).toMatchObject({ phase: 'idle', lastCheckedAt: null, error: { kind: 'offline', during: 'check', at: 7000 } })
  })

  it('keeps a failed check of its own silent', () => {
    const failed = run(idle, { type: 'check-started', manual: false }, { type: 'check-failed', manual: false, kind: 'offline', at: 7000 })
    expect(failed).toEqual(idle)
  })

  it('keeps the offer when a later check fails', () => {
    const silent = run(available, { type: 'check-started', manual: false }, { type: 'check-failed', manual: false, kind: 'not-ready', at: 7000 })
    expect(silent).toEqual(available)
    const shown = run(available, { type: 'check-started', manual: true }, { type: 'check-failed', manual: true, kind: 'rate-limited', at: 7000 })
    expect(shown).toMatchObject({ phase: 'available', offer, lastCheckedAt: 1000, error: { kind: 'rate-limited', during: 'check', at: 7000 } })
  })

  it('clears the last error when the user starts the next step, not when the app does', () => {
    const failed = run(idle, { type: 'check-started', manual: true }, { type: 'check-failed', manual: true, kind: 'offline', at: 7000 })
    expect(run(failed, { type: 'check-started', manual: true }).error).toBeNull()
    expect(run(failed, { type: 'check-started', manual: false }).error).toEqual({ kind: 'offline', during: 'check', at: 7000 })
    // ...but once the app's own check has an answer, "could not check" would be a lie.
    expect(run(failed, { type: 'check-started', manual: false }, { type: 'check-succeeded', offer: null, at: 8000 }).error).toBeNull()
  })

  it('lets the user join a running automatic check', () => {
    const failed = run(idle, { type: 'check-started', manual: true }, { type: 'check-failed', manual: true, kind: 'offline', at: 7000 })
    const auto = run(failed, { type: 'check-started', manual: false })
    const joined = run(auto, { type: 'check-started', manual: true })
    expect(joined).toMatchObject({ phase: 'checking', error: null })
    // Joining with nothing to clear changes nothing, so nothing is pushed.
    expect(reduceUpdate(joined, { type: 'check-started', manual: true })).toBe(joined)
    expect(reduceUpdate(joined, { type: 'check-started', manual: false })).toBe(joined)
  })

  it('returns to "available" with the offer after a failed or cancelled download', () => {
    const failed = run(downloading, { type: 'download-progress', progress: { percent: 40, transferred: 4, total: 10, bytesPerSecond: 1 } }, { type: 'download-failed', kind: 'corrupt', at: 9000 })
    expect(failed).toMatchObject({ phase: 'available', offer, progress: null, error: { kind: 'corrupt', during: 'download', at: 9000 } })
    const cancelled = run(downloading, { type: 'download-cancelled' })
    expect(cancelled).toMatchObject({ phase: 'available', offer, progress: null, error: null })
    // Starting again clears the failure.
    expect(run(failed, { type: 'download-started' })).toMatchObject({ phase: 'downloading', error: null })
  })

  it('returns to "available" when the installer could not be started', () => {
    expect(run(installing, { type: 'install-failed', kind: 'unknown', at: 9500 })).toMatchObject({ phase: 'available', offer, error: { kind: 'unknown', during: 'install', at: 9500 } })
  })

  it('keeps a download error on screen through a successful automatic check', () => {
    const failed = run(downloading, { type: 'download-failed', kind: 'disk', at: 9000 })
    const rechecked = run(failed, { type: 'check-started', manual: false }, { type: 'check-succeeded', offer, at: 9900 })
    expect(rechecked.error).toEqual({ kind: 'disk', during: 'download', at: 9000 })
  })

  it('drops a download or install error once the check offers another version, or none', () => {
    const newer: UpdateOffer = { ...offer, version: '0.3.1', url: `${TAG_URL}v0.3.1` }
    const failedDownload = run(downloading, { type: 'download-failed', kind: 'disk', at: 9000 })
    const failedInstall = run(installing, { type: 'install-failed', kind: 'unknown', at: 9500 })
    for (const failed of [failedDownload, failedInstall]) {
      expect(run(failed, { type: 'check-started', manual: false }, { type: 'check-succeeded', offer: newer, at: 9900 })).toMatchObject({ phase: 'available', offer: newer, error: null })
      expect(run(failed, { type: 'check-started', manual: false }, { type: 'check-succeeded', offer: null, at: 9900 })).toMatchObject({ phase: 'idle', offer: null, error: null })
    }
  })

  it('ignores every event that does not fit the phase, returning the same object', () => {
    const fits: Record<UpdateEvent['type'], UpdatePhase[] | 'any'> = {
      restored: 'any',
      'check-started': ['idle', 'available'],
      'check-succeeded': ['checking'],
      'check-failed': ['checking'],
      'download-started': ['available'],
      'download-progress': ['downloading'],
      'download-succeeded': ['downloading'],
      'download-failed': ['downloading'],
      'download-cancelled': ['downloading'],
      'install-started': ['ready'],
      'install-failed': ['installing'],
      'install-unfinished': ['available'],
      'auto-check-set': 'any',
      announced: 'any',
      'whats-new': 'any'
    }
    const events: UpdateEvent[] = [
      { type: 'check-started', manual: false },
      { type: 'check-succeeded', offer, at: 1 },
      { type: 'check-succeeded', offer: null, at: 1 },
      { type: 'check-failed', manual: true, kind: 'offline', at: 1 },
      { type: 'download-started' },
      { type: 'download-progress', progress: { percent: 1, transferred: 1, total: 100, bytesPerSecond: 1 } },
      { type: 'download-succeeded' },
      { type: 'download-failed', kind: 'disk', at: 1 },
      { type: 'download-cancelled' },
      { type: 'install-started' },
      { type: 'install-failed', kind: 'unknown', at: 1 },
      { type: 'install-unfinished', version: '0.3.0', at: 1 }
    ]
    for (const [phase, state] of Object.entries(everyPhase) as [UpdatePhase, UpdateState][]) {
      for (const event of events) {
        const allowed = fits[event.type]
        const next = reduceUpdate(state, event)
        if (allowed !== 'any' && !allowed.includes(phase)) expect([phase, event.type, next === state]).toEqual([phase, event.type, true])
        else expect([phase, event.type, next === state]).toEqual([phase, event.type, false])
      }
    }
  })

  it('never leaves a phase without what it promises', () => {
    // Every phase reachable by any three events from any phase still has its offer and progress right.
    const events: UpdateEvent[] = [
      { type: 'check-started', manual: true },
      { type: 'check-succeeded', offer, at: 1 },
      { type: 'check-succeeded', offer: null, at: 1 },
      { type: 'check-failed', manual: true, kind: 'offline', at: 1 },
      { type: 'download-started' },
      { type: 'download-progress', progress: { percent: 1, transferred: 1, total: 100, bytesPerSecond: 1 } },
      { type: 'download-succeeded' },
      { type: 'download-failed', kind: 'disk', at: 1 },
      { type: 'download-cancelled' },
      { type: 'install-started' },
      { type: 'install-failed', kind: 'unknown', at: 1 },
      { type: 'install-unfinished', version: '0.3.0', at: 1 },
      { type: 'announced', version: '0.3.0' },
      { type: 'whats-new', whatsNew: null }
    ]
    let frontier = Object.values(everyPhase)
    for (let depth = 0; depth < 3; depth++) {
      frontier = frontier.flatMap((state) => events.map((event) => reduceUpdate(state, event)))
      for (const state of frontier) {
        if (state.phase !== 'idle' && state.phase !== 'checking') expect(state.offer).not.toBeNull()
        expect(state.progress !== null).toBe(state.phase === 'downloading')
        expect(state.mode).toBe('auto')
        expect(state.currentVersion).toBe('0.2.0')
      }
    }
  })

  it('reports an install an earlier run started in vain, under the same version only', () => {
    const told = run(available, { type: 'install-unfinished', version: '0.3.0', at: 4000 })
    expect(told).toMatchObject({ phase: 'available', offer, error: { kind: 'unknown', during: 'install', at: 4000 } })
    // Another version on offer: the failed one is not its business.
    expect(reduceUpdate(available, { type: 'install-unfinished', version: '0.2.9', at: 4000 })).toBe(available)
    // It stays through the app's own later checks, and goes when the user tries again.
    expect(run(told, { type: 'check-started', manual: false }, { type: 'check-succeeded', offer, at: 5000 }).error).toMatchObject({ during: 'install' })
    expect(run(told, { type: 'download-started' }).error).toBeNull()
  })

  it('applies what updates.json held', () => {
    const whatsNew: WhatsNew = { version: '0.2.0', from: '0.1.0', url: `${TAG_URL}v0.2.0`, notes: [] }
    expect(run(idle, { type: 'restored', autoCheck: false, lastCheckedAt: 123, whatsNew })).toMatchObject({ autoCheck: false, lastCheckedAt: 123, whatsNew, phase: 'idle' })
    expect(run(idle, { type: 'restored', autoCheck: true, lastCheckedAt: 123, whatsNew: null }).lastCheckedAt).toBe(123)
    // A file that says what the defaults say changes nothing, so nothing is pushed.
    expect(reduceUpdate(idle, { type: 'restored', autoCheck: true, lastCheckedAt: null, whatsNew: null })).toBe(idle)
  })

  it('switches the automatic check and marks the offer as announced', () => {
    expect(run(idle, { type: 'auto-check-set', enabled: false }).autoCheck).toBe(false)
    expect(reduceUpdate(idle, { type: 'auto-check-set', enabled: true })).toBe(idle)
    expect(run(available, { type: 'announced', version: '0.3.0' }).offer?.announced).toBe(true)
    expect(reduceUpdate(available, { type: 'announced', version: '0.4.0' })).toBe(available)
    expect(reduceUpdate(idle, { type: 'announced', version: '0.3.0' })).toBe(idle)
    const announced = run(available, { type: 'announced', version: '0.3.0' })
    expect(reduceUpdate(announced, { type: 'announced', version: '0.3.0' })).toBe(announced)
    // The mark survives a download and the way back.
    expect(run(announced, { type: 'download-started' }, { type: 'download-cancelled' }).offer?.announced).toBe(true)
  })

  it('sets and drops the What’s-new notes in any phase', () => {
    const whatsNew: WhatsNew = { version: '0.2.0', from: null, url: `${TAG_URL}v0.2.0`, notes: [] }
    for (const state of Object.values(everyPhase)) {
      const shown = reduceUpdate(state, { type: 'whats-new', whatsNew })
      expect(shown.whatsNew).toEqual(whatsNew)
      expect(shown.phase).toBe(state.phase)
      expect(reduceUpdate(shown, { type: 'whats-new', whatsNew: null }).whatsNew).toBeNull()
      expect(reduceUpdate(state, { type: 'whats-new', whatsNew: null })).toBe(state)
    }
  })
})

describe('isAutoCheckDue', () => {
  const now = 1_800_000_000_000
  const base = { autoCheck: true, phase: 'idle' as UpdatePhase, lastAttemptAt: null as number | null, now }

  it('is due at the first look of a launch', () => {
    expect(isAutoCheckDue(base)).toBe(true)
    expect(isAutoCheckDue({ ...base, phase: 'available' })).toBe(true)
  })

  it('is never due while the switch is off', () => {
    expect(isAutoCheckDue({ ...base, autoCheck: false })).toBe(false)
    expect(isAutoCheckDue({ ...base, autoCheck: false, lastAttemptAt: 0 })).toBe(false)
  })

  it('waits six hours after the last check of either kind', () => {
    expect(isAutoCheckDue({ ...base, lastAttemptAt: now })).toBe(false)
    expect(isAutoCheckDue({ ...base, lastAttemptAt: now - CHECK_INTERVAL_MS + 1 })).toBe(false)
    expect(isAutoCheckDue({ ...base, lastAttemptAt: now - CHECK_INTERVAL_MS })).toBe(true)
    expect(isAutoCheckDue({ ...base, lastAttemptAt: now - 3 * CHECK_INTERVAL_MS })).toBe(true)
  })

  it('is due when the clock was set back', () => {
    expect(isAutoCheckDue({ ...base, lastAttemptAt: now + 60_000 })).toBe(true)
  })

  it('never interrupts a check, a download, a waiting installer or an install', () => {
    for (const phase of ['checking', 'downloading', 'ready', 'installing'] as const) {
      expect(isAutoCheckDue({ ...base, phase })).toBe(false)
      expect(isAutoCheckDue({ ...base, phase, lastAttemptAt: 0 })).toBe(false)
    }
  })
})

describe('download progress', () => {
  it('passes real numbers through', () => {
    expect(toProgress({ total: 789_630, delta: 100, transferred: 394_815, percent: 50, bytesPerSecond: 1_200_000 })).toEqual({ percent: 50, transferred: 394_815, total: 789_630, bytesPerSecond: 1_200_000 })
  })

  it('does not report "100% of nothing", which a stale block map produces', () => {
    expect(toProgress({ total: 0, transferred: 0, percent: 100, bytesPerSecond: 0 })).toEqual({ percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 })
  })

  it('makes hostile and broken reports safe to show', () => {
    const zero = { percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 }
    for (const odd of [null, undefined, 'x', 42, [], {}, { percent: 'a lot', total: null, transferred: {}, bytesPerSecond: [] }]) expect(toProgress(odd)).toEqual(zero)
    expect(toProgress({ percent: 250, total: 10, transferred: 99, bytesPerSecond: Infinity })).toEqual({ percent: 100, transferred: 99, total: 10, bytesPerSecond: 0 })
    expect(toProgress({ percent: -5, total: 10, transferred: -1, bytesPerSecond: NaN })).toEqual({ percent: 0, transferred: 0, total: 10, bytesPerSecond: 0 })
  })

  it('lets the first report through and then one per interval', () => {
    const gate = createProgressGate(250)
    const passed = [0, 10, 100, 249, 250, 260, 499, 500, 2000, 2001].filter((at) => gate.pass(1_000_000 + at))
    expect(passed).toEqual([0, 250, 500, 2000])
  })

  it('starts over after a reset, and does not jam when the clock goes back', () => {
    const gate = createProgressGate(250)
    expect(gate.pass(5000)).toBe(true)
    expect(gate.pass(5001)).toBe(false)
    gate.reset()
    expect(gate.pass(5002)).toBe(true)
    expect(gate.pass(100)).toBe(true)
    expect(gate.pass(120)).toBe(false)
  })

  it('throttles a burst to a handful of pushes', () => {
    const gate = createProgressGate()
    let passed = 0
    for (let at = 0; at < 10_000; at += 3) if (gate.pass(at)) passed++
    expect(passed).toBeLessThanOrEqual(41)
    expect(passed).toBeGreaterThanOrEqual(39)
  })
})

describe('selectNotes', () => {
  // GitHub lists releases by the date of the tagged commit, not by version.
  const list = [release('v0.2.1'), release('v0.4.0-beta.1'), release('v0.3.0'), release('0.3.0', { name: 'duplicate' }), release('v0.2.0'), release('v0.1.0')]
  const tags = (notes: GitHubRelease[]): string[] => notes.map((r) => r.tag)

  it('returns every stable release after the old version up to the new one, newest first', () => {
    expect(tags(selectNotes(list, '0.1.0', '0.3.0'))).toEqual(['v0.3.0', 'v0.2.1', 'v0.2.0'])
    expect(tags(selectNotes(list, '0.2.0', '0.2.1'))).toEqual(['v0.2.1'])
    expect(tags(selectNotes([...list].reverse(), 'v0.1.0', 'v0.2.1'))).toEqual(['v0.2.1', 'v0.2.0'])
  })

  it('returns only the target when the old version is not known', () => {
    expect(tags(selectNotes(list, null, '0.3.0'))).toEqual(['v0.3.0'])
  })

  it('returns nothing when the range is empty or backwards, or a version is garbage', () => {
    expect(selectNotes(list, '0.3.0', '0.3.0')).toEqual([])
    expect(selectNotes(list, '0.3.0', '0.2.0')).toEqual([])
    expect(selectNotes(list, 'dev', '0.3.0')).toEqual([])
    expect(selectNotes(list, '0.1.0', 'latest')).toEqual([])
    expect(selectNotes([], '0.1.0', '0.3.0')).toEqual([])
  })

  it('returns nothing when the list does not hold the target itself', () => {
    // 0.5.0 is out but the saved list is older: 0.3.0's notes alone would pass for 0.5.0's.
    expect(selectNotes(list, '0.2.0', '0.5.0')).toEqual([])
    expect(selectNotes(list, null, '0.5.0')).toEqual([])
  })

  it('includes prereleases only when the target is one', () => {
    expect(tags(selectNotes(list, '0.3.0', '0.4.0-beta.1'))).toEqual(['v0.4.0-beta.1'])
    expect(tags(selectNotes([...list, release('v0.4.0')], '0.2.1', '0.4.0'))).toEqual(['v0.4.0', 'v0.3.0'])
    expect(tags(selectNotes([...list, release('v0.4.0-beta.2')], '0.2.1', '0.4.0-beta.2'))).toEqual(['v0.4.0-beta.2', 'v0.4.0-beta.1', 'v0.3.0'])
  })

  it('still shows the target when GitHub flags it as a prerelease but its tag is stable', () => {
    expect(tags(selectNotes([release('v0.3.0', { prerelease: true }), release('v0.2.0')], '0.1.0', '0.3.0'))).toEqual(['v0.3.0', 'v0.2.0'])
  })

  it('honours the limit', () => {
    const many = Array.from({ length: 50 }, (_, i) => release(`v0.${i + 1}.0`))
    expect(tags(selectNotes(many, '0.0.1', '0.50.0', 3))).toEqual(['v0.50.0', 'v0.49.0', 'v0.48.0'])
    expect(selectNotes(many, '0.0.1', '0.50.0')).toHaveLength(MAX_NOTES)
  })

  it('knows whether a list holds a version', () => {
    expect(holdsVersion(list, '0.3.0')).toBe(true)
    expect(holdsVersion(list, '0.5.0')).toBe(false)
    expect(holdsVersion([], '0.3.0')).toBe(false)
  })
})

describe('what the page is given', () => {
  it('builds every release URL itself', () => {
    expect(toReleaseNote(release('v0.3.0'))).toEqual({ version: '0.3.0', name: 'Pelagix v0.3.0', publishedAt: '2026-11-01T10:00:00Z', url: `${TAG_URL}v0.3.0`, body: 'notes of v0.3.0' })
    expect(toReleaseNote(release('0.3.0')).url).toBe(`${TAG_URL}0.3.0`)
  })

  it('links a version under its real tag when known, under the usual one otherwise', () => {
    expect(versionPageUrl('0.3.0', [release('0.3.0')])).toBe(`${TAG_URL}0.3.0`)
    expect(versionPageUrl('0.3.0', [release('v0.2.0')])).toBe(`${TAG_URL}v0.3.0`)
    expect(versionPageUrl('0.3.0', [])).toBe(`${TAG_URL}v0.3.0`)
  })

  it('builds an offer from the notes, the tag the updater saw and the announced version', () => {
    const notes = [release('v0.3.0'), release('v0.2.1')]
    expect(toOffer('0.3.0', notes, 'v0.3.0', null)).toEqual({ version: '0.3.0', url: `${TAG_URL}v0.3.0`, notes: notes.map(toReleaseNote), announced: false })
    expect(toOffer('0.3.0', notes, undefined, '0.3.0').announced).toBe(true)
    expect(toOffer('0.3.0', notes, undefined, '0.2.1').announced).toBe(false)
    // Without notes the tag the updater read from GitHub still gives the right page.
    expect(toOffer('0.3.0', [], '0.3.0', null)).toEqual({ version: '0.3.0', url: `${TAG_URL}0.3.0`, notes: [], announced: false })
  })

  it('does not let a hostile tag hint into the URL', () => {
    for (const hint of ['v9.9.9', '../../../evil', 'https://evil.example/', 'v0.3.0/../../x', ' v0.3.0', 42, null, {}, 'javascript:alert(1)']) {
      expect(toOffer('0.3.0', [], hint, null).url).toBe(`${TAG_URL}v0.3.0`)
    }
  })

  it('turns a stored record into the What’s-new notes', () => {
    const record: StoredNotes = { version: '0.3.0', from: '0.2.0', notes: [release('0.3.0')] }
    expect(toWhatsNew(record)).toEqual({ version: '0.3.0', from: '0.2.0', url: `${TAG_URL}0.3.0`, notes: [toReleaseNote(release('0.3.0'))] })
    expect(toWhatsNew({ version: '0.3.0', from: null, notes: [] })).toEqual({ version: '0.3.0', from: null, url: `${TAG_URL}v0.3.0`, notes: [] })
  })
})

describe('embeddedNote', () => {
  it('uses Markdown the build wrote into latest.yml', () => {
    const md = '## What is new in 0.3.0\r\n\r\n- **Bold** item\r\n'
    expect(embeddedNote('0.3.0', { tag: 'v0.3.0', releaseNotes: md })).toEqual({ tag: 'v0.3.0', version: '0.3.0', name: '', publishedAt: null, body: md, prerelease: false })
    expect(embeddedNote('0.3.0', { releaseNotes: 'plain' })?.tag).toBe('v0.3.0')
    expect(embeddedNote('0.3.0', { tag: '0.3.0', releaseNotes: 'plain' })?.tag).toBe('0.3.0')
  })

  it('never uses the HTML that comes from GitHub’s feed', () => {
    for (const html of ['<ul>\n<li>New: thing</li></ul>', '<p>Hello</p>', '  \n<h2>Title</h2>', '<!-- generated -->\n## Notes', '<script>alert(1)</script>']) {
      expect(embeddedNote('0.3.0', { tag: 'v0.3.0', releaseNotes: html })).toBeNull()
    }
  })

  it('ignores empty notes, the changelog list form and anything that is not text', () => {
    for (const notes of ['', '   \n', null, undefined, 42, [{ version: '0.3.0', note: '<p>x</p>' }], { note: 'x' }]) {
      expect(embeddedNote('0.3.0', { tag: 'v0.3.0', releaseNotes: notes })).toBeNull()
    }
  })

  it('does not trust the tag, and caps the text', () => {
    expect(embeddedNote('0.3.0', { tag: 'v9.9.9', releaseNotes: 'x' })?.tag).toBe('v0.3.0')
    expect(embeddedNote('0.3.0', { tag: '../../x', releaseNotes: 'x' })?.tag).toBe('v0.3.0')
    expect(embeddedNote('0.3.0', { releaseNotes: 'x'.repeat(500_000) })?.body.length).toBe(125_000)
    expect(embeddedNote('not a version', { releaseNotes: 'x' })).toBeNull()
  })
})

describe('updates.json', () => {
  const full: StoredUpdates = {
    autoCheck: false,
    lastCheckedAt: 1_800_000_000_000,
    offeredVersion: '0.3.0',
    lastRunVersion: '0.2.0',
    announcedVersion: '0.3.0',
    rateLimitedUntil: 1_800_000_600_000,
    whatsNew: { version: '0.2.0', from: '0.1.0', notes: [release('v0.2.0')] },
    pendingNotes: { version: '0.3.0', from: '0.2.0', notes: [release('v0.3.0'), release('v0.2.1')] },
    cache: { fetchedAt: 1_800_000_000_000, releases: [release('v0.3.0'), release('v0.2.1'), release('v0.2.0'), release('v0.1.0')] }
  }

  it('round-trips everything it holds', () => {
    expect(parseStoredUpdates(JSON.parse(serializeStoredUpdates(full)))).toEqual(full)
    expect(parseStoredUpdates(JSON.parse(serializeStoredUpdates(defaultStoredUpdates())))).toEqual(defaultStoredUpdates())
  })

  it('writes the documented shape', () => {
    expect(JSON.parse(serializeStoredUpdates(defaultStoredUpdates()))).toEqual({ v: 1, autoCheck: true, lastCheckedAt: null, offeredVersion: null, lastRunVersion: null, announcedVersion: null, rateLimitedUntil: null, whatsNew: null, pendingNotes: null, cache: null })
    const written = JSON.parse(serializeStoredUpdates(full)) as Record<string, unknown>
    expect(Object.keys(written)).toEqual(['v', 'autoCheck', 'lastCheckedAt', 'offeredVersion', 'lastRunVersion', 'announcedVersion', 'rateLimitedUntil', 'whatsNew', 'pendingNotes', 'cache'])
    expect((written['whatsNew'] as { notes: unknown[] }).notes[0]).toEqual({ tag: 'v0.2.0', version: '0.2.0', name: 'Pelagix v0.2.0', publishedAt: '2026-11-01T10:00:00Z', body: 'notes of v0.2.0', prerelease: false })
  })

  it('falls back to the defaults for anything that is not an object', () => {
    for (const bad of [null, undefined, 42, 'text', true, [], [full], () => full]) expect(parseStoredUpdates(bad)).toEqual(defaultStoredUpdates())
    expect(parseStoredUpdates({})).toEqual(defaultStoredUpdates())
  })

  it('keeps the good fields of a file with bad ones', () => {
    const mixed = { ...full, lastCheckedAt: 'yesterday', offeredVersion: 'newest', announcedVersion: 3, whatsNew: 'soon', cache: { fetchedAt: 'x', releases: 'none' } }
    expect(parseStoredUpdates(mixed)).toEqual({ ...full, lastCheckedAt: null, offeredVersion: null, announcedVersion: null, whatsNew: null, cache: null })
  })

  it('reads a file from a newer or older app field by field, whatever version it claims', () => {
    expect(parseStoredUpdates({ v: 99, autoCheck: false, lastRunVersion: '9.0.0', somethingNew: { deep: true } })).toEqual({ ...defaultStoredUpdates(), autoCheck: false, lastRunVersion: '9.0.0' })
    expect(parseStoredUpdates({ v: 'one', autoCheck: false }).autoCheck).toBe(false)
  })

  it('only accepts real booleans, versions and timestamps', () => {
    const hostile = {
      autoCheck: 'false',
      lastCheckedAt: -1,
      lastRunVersion: '0.2',
      announcedVersion: '<script>alert(1)</script>',
      rateLimitedUntil: 1e308
    }
    expect(parseStoredUpdates(hostile)).toEqual(defaultStoredUpdates())
    expect(parseStoredUpdates({ autoCheck: 0 }).autoCheck).toBe(true)
    expect(parseStoredUpdates({ autoCheck: null }).autoCheck).toBe(true)
    for (const at of [1.5, NaN, Infinity, '1800000000000', Number.MAX_SAFE_INTEGER + 2, {}, [1]]) expect(parseStoredUpdates({ lastCheckedAt: at, rateLimitedUntil: at })).toMatchObject({ lastCheckedAt: null, rateLimitedUntil: null })
    expect(parseStoredUpdates({ lastCheckedAt: 0 }).lastCheckedAt).toBe(0)
  })

  it('stores versions the one plain way', () => {
    expect(parseStoredUpdates({ lastRunVersion: 'v0.2.0', announcedVersion: ' 0.3.0+build.5 ', offeredVersion: 'V0.3.0' })).toMatchObject({ lastRunVersion: '0.2.0', announcedVersion: '0.3.0', offeredVersion: '0.3.0' })
  })

  it('rescues a switched-off automatic check from a file that no longer parses', () => {
    const written = serializeStoredUpdates({ ...full, autoCheck: false })
    // Cut short, as a write that never finished would leave it.
    expect(rescueStoredUpdates(written.slice(0, -3))).toEqual({ ...defaultStoredUpdates(), autoCheck: false })
    expect(rescueStoredUpdates(written.slice(0, 40))).toEqual({ ...defaultStoredUpdates(), autoCheck: false })
    expect(rescueStoredUpdates('{\r\n  "v": 1,\r\n  "autoCheck" : false,\r\n  "lastCheckedAt": nul')).toMatchObject({ autoCheck: false })
    // Switched on, or nothing left to tell: the default.
    expect(rescueStoredUpdates(serializeStoredUpdates(full).replace('"autoCheck":false', '"autoCheck":true').slice(0, -3))).toEqual(defaultStoredUpdates())
    for (const nothing of ['', 'not json', '{"autoCheck": fal', '{"autoCheck":"false"}', '{"autoCheck":falsey']) expect(rescueStoredUpdates(nothing)).toEqual(defaultStoredUpdates())
  })

  it('looks for the switch at the start of the file only, never in release text further down', () => {
    // A release description is stored as a JSON string, so its quotes are escaped; even unescaped it is too far in.
    const body = 'Set "autoCheck": false in the file to stop the checks.'
    const withText = serializeStoredUpdates({ ...full, autoCheck: true, whatsNew: null, pendingNotes: null, cache: { fetchedAt: 1, releases: [release('v0.3.0', { body })] } })
    expect(rescueStoredUpdates(withText.slice(0, -3)).autoCheck).toBe(true)
    expect(rescueStoredUpdates(`${' '.repeat(RESCUE_SCAN_LENGTH)}"autoCheck":false`).autoCheck).toBe(true)
  })

  it('holds stored releases to the same rules as a GitHub response', () => {
    const stored = {
      cache: {
        fetchedAt: 5,
        releases: [
          { tag: 'v0.3.0', version: '9.9.9', name: 'n'.repeat(500), publishedAt: 'never', body: 'x'.repeat(200_000), prerelease: 'yes', url: 'https://evil.example/' },
          { tag: '../../etc/passwd', body: 'x' },
          { tag: 'v0.2.0', name: 7, body: null },
          { tag: 'v0.2.0', name: 'same version again' },
          'v0.1.0',
          null,
          42,
          ['v0.1.0']
        ]
      }
    }
    const cache = parseStoredUpdates(stored).cache
    expect(cache?.fetchedAt).toBe(5)
    expect(cache?.releases).toEqual([
      // The version always follows from the tag; the stored one is not believed.
      { tag: 'v0.3.0', version: '0.3.0', name: '', publishedAt: null, body: 'x'.repeat(125_000), prerelease: false },
      { tag: 'v0.2.0', version: '0.2.0', name: '', publishedAt: null, body: '', prerelease: false }
    ])
    expect(JSON.stringify(cache)).not.toContain('evil')
  })

  it('sorts stored releases and caps how many it reads', () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ tag: `v0.${i}.0` }))
    expect(parseStoredUpdates({ cache: { fetchedAt: 1, releases: many } }).cache?.releases).toHaveLength(100)
    const notes = parseStoredUpdates({ whatsNew: { version: '1.0.0', notes: many } }).whatsNew?.notes
    expect(notes).toHaveLength(MAX_NOTES)
    expect(notes?.[0]?.tag).toBe('v0.19.0')
  })

  it('drops an empty cache and a notes record without a version', () => {
    expect(parseStoredUpdates({ cache: { fetchedAt: 1, releases: [] } }).cache).toBeNull()
    expect(parseStoredUpdates({ cache: { fetchedAt: 1, releases: [{ tag: 'nightly' }] } }).cache).toBeNull()
    expect(parseStoredUpdates({ whatsNew: { version: 'latest', notes: [] } }).whatsNew).toBeNull()
    expect(parseStoredUpdates({ pendingNotes: { notes: [{ tag: 'v0.3.0' }] } }).pendingNotes).toBeNull()
    expect(parseStoredUpdates({ whatsNew: [], pendingNotes: 3 })).toMatchObject({ whatsNew: null, pendingNotes: null })
  })

  it('keeps a notes record whose notes or old version are unusable', () => {
    expect(parseStoredUpdates({ whatsNew: { version: 'v0.3.0', from: 'earlier', notes: 'none' } }).whatsNew).toEqual({ version: '0.3.0', from: null, notes: [] })
    // An "old version" that is not older than the new one says nothing.
    expect(parseStoredUpdates({ whatsNew: { version: '0.3.0', from: '0.3.0' } }).whatsNew?.from).toBeNull()
    expect(parseStoredUpdates({ whatsNew: { version: '0.3.0', from: '0.4.0' } }).whatsNew?.from).toBeNull()
  })

  it('is not fooled by keys that live on the prototype', () => {
    const inherited = Object.create({ autoCheck: false, lastRunVersion: '9.9.9' }) as Record<string, unknown>
    // JSON.parse never produces such an object; the reader simply reads what it is given.
    expect(parseStoredUpdates(JSON.parse(JSON.stringify(inherited)))).toEqual(defaultStoredUpdates())
    const polluted = JSON.parse('{"__proto__": {"autoCheck": false}, "constructor": {"prototype": {"x": 1}}}') as unknown
    expect(parseStoredUpdates(polluted)).toEqual(defaultStoredUpdates())
    expect(({} as Record<string, unknown>)['autoCheck']).toBeUndefined()
  })

  it('never writes more than the size cap: the cache goes first, then the notes', () => {
    const big = (tag: string): GitHubRelease => release(tag, { body: 'é'.repeat(120_000) }) // 240 kB each in UTF-8
    const bigCache: StoredUpdates = { ...full, cache: { fetchedAt: 1, releases: Array.from({ length: 12 }, (_, i) => big(`v1.${i}.0`)) } }
    const withoutCache = serializeStoredUpdates(bigCache)
    expect(Buffer.byteLength(withoutCache, 'utf8')).toBeLessThanOrEqual(MAX_UPDATES_BYTES)
    expect(parseStoredUpdates(JSON.parse(withoutCache))).toEqual({ ...full, cache: null })

    const bigNotes: StoredUpdates = { ...bigCache, whatsNew: { version: '1.11.0', from: '0.2.0', notes: Array.from({ length: 12 }, (_, i) => big(`v1.${i}.0`)) } }
    const bare = serializeStoredUpdates(bigNotes)
    expect(Buffer.byteLength(bare, 'utf8')).toBeLessThan(1000)
    expect(parseStoredUpdates(JSON.parse(bare))).toEqual({ ...full, cache: null, whatsNew: { version: '1.11.0', from: '0.2.0', notes: [] }, pendingNotes: { version: '0.3.0', from: '0.2.0', notes: [] } })
  })

  it('keeps a cache that fits', () => {
    const realistic: StoredUpdates = { ...full, cache: { fetchedAt: 1, releases: Array.from({ length: 20 }, (_, i) => release(`v0.${i}.0`, { body: 'x'.repeat(3500) })) } }
    const text = serializeStoredUpdates(realistic)
    expect(Buffer.byteLength(text, 'utf8')).toBeLessThan(100_000)
    expect(parseStoredUpdates(JSON.parse(text)).cache?.releases).toHaveLength(20)
  })
})

describe('decideWhatsNew', () => {
  const stored = (change: Partial<StoredUpdates> = {}): StoredUpdates => ({ ...defaultStoredUpdates(), ...change })
  const notes = [release('v0.3.0')]

  it('fresh install: neither file exists, so only the version is recorded', () => {
    const d = decideWhatsNew({ running: '0.2.0', hadUpdatesFile: false, hadSaveFile: false, stored: stored() })
    expect(d).toEqual({ stored: stored({ lastRunVersion: '0.2.0' }), changed: true, show: null, fetch: false })
  })

  it('upgrade from 0.1.0: a save but no updates.json means the notes have to be fetched', () => {
    const d = decideWhatsNew({ running: '0.2.0', hadUpdatesFile: false, hadSaveFile: true, stored: stored() })
    expect(d).toEqual({ stored: stored({ lastRunVersion: '0.2.0', whatsNew: { version: '0.2.0', from: '0.1.0', notes: [] } }), changed: true, show: null, fetch: true })
  })

  it('a save but no updates.json says nothing when 0.1.0 itself is running', () => {
    const d = decideWhatsNew({ running: '0.1.0', hadUpdatesFile: false, hadSaveFile: true, stored: stored() })
    expect(d).toMatchObject({ changed: true, show: null, fetch: false })
    expect(d.stored).toEqual(stored({ lastRunVersion: '0.1.0' }))
  })

  it('same version as last time: nothing to show and nothing to write', () => {
    const before = stored({ lastRunVersion: '0.2.0' })
    const d = decideWhatsNew({ running: '0.2.0', hadUpdatesFile: true, hadSaveFile: true, stored: before })
    expect(d).toEqual({ stored: before, changed: false, show: null, fetch: false })
    expect(d.stored).toBe(before)
  })

  it('updated in the app: the notes saved for exactly this version are shown at once', () => {
    const before = stored({ lastRunVersion: '0.2.0', pendingNotes: { version: '0.3.0', from: '0.2.0', notes } })
    const d = decideWhatsNew({ running: '0.3.0', hadUpdatesFile: true, hadSaveFile: true, stored: before })
    expect(d.show).toEqual({ version: '0.3.0', from: '0.2.0', notes })
    expect(d.fetch).toBe(false)
    expect(d.changed).toBe(true)
    expect(d.stored).toEqual(stored({ lastRunVersion: '0.3.0', whatsNew: { version: '0.3.0', from: '0.2.0', notes }, pendingNotes: null }))
  })

  it('updated in the app but the notes could not be fetched before: they are fetched now', () => {
    const before = stored({ lastRunVersion: '0.2.0', pendingNotes: { version: '0.3.0', from: '0.2.0', notes: [] } })
    const d = decideWhatsNew({ running: '0.3.0', hadUpdatesFile: true, hadSaveFile: true, stored: before })
    expect(d).toMatchObject({ show: null, fetch: true, changed: true })
    expect(d.stored.whatsNew).toEqual({ version: '0.3.0', from: '0.2.0', notes: [] })
    expect(d.stored.pendingNotes).toBeNull()
  })

  it('updated by hand: lastRunVersion is lower, so the notes are fetched', () => {
    const d = decideWhatsNew({ running: '0.3.0', hadUpdatesFile: true, hadSaveFile: true, stored: stored({ lastRunVersion: '0.2.0' }) })
    expect(d).toEqual({ stored: stored({ lastRunVersion: '0.3.0', whatsNew: { version: '0.3.0', from: '0.2.0', notes: [] } }), changed: true, show: null, fetch: true })
  })

  it('updated by hand past the version an install was started for: the saved notes are dropped', () => {
    const before = stored({ lastRunVersion: '0.2.0', pendingNotes: { version: '0.3.0', from: '0.2.0', notes } })
    const d = decideWhatsNew({ running: '0.4.0', hadUpdatesFile: true, hadSaveFile: true, stored: before })
    expect(d.stored.pendingNotes).toBeNull()
    expect(d.stored.whatsNew).toEqual({ version: '0.4.0', from: '0.2.0', notes: [] })
    expect(d).toMatchObject({ show: null, fetch: true })
  })

  it('an install that did not happen: the saved notes wait for the version they belong to', () => {
    const before = stored({ lastRunVersion: '0.2.0', pendingNotes: { version: '0.3.0', from: '0.2.0', notes } })
    const d = decideWhatsNew({ running: '0.2.0', hadUpdatesFile: true, hadSaveFile: true, stored: before })
    expect(d).toEqual({ stored: before, changed: false, show: null, fetch: false })
  })

  it('shows a record again after a restart until it is dismissed', () => {
    const before = stored({ lastRunVersion: '0.3.0', whatsNew: { version: '0.3.0', from: '0.2.0', notes } })
    const d = decideWhatsNew({ running: '0.3.0', hadUpdatesFile: true, hadSaveFile: true, stored: before })
    expect(d).toEqual({ stored: before, changed: false, show: { version: '0.3.0', from: '0.2.0', notes }, fetch: false })
  })

  it('tries the fetch again on a later launch while the record still has no notes', () => {
    const before = stored({ lastRunVersion: '0.3.0', whatsNew: { version: '0.3.0', from: '0.2.0', notes: [] } })
    expect(decideWhatsNew({ running: '0.3.0', hadUpdatesFile: true, hadSaveFile: true, stored: before })).toEqual({ stored: before, changed: false, show: null, fetch: true })
  })

  it('replaces an unread record when the app is updated again', () => {
    const before = stored({ lastRunVersion: '0.3.0', whatsNew: { version: '0.3.0', from: '0.2.0', notes } })
    const d = decideWhatsNew({ running: '0.4.0', hadUpdatesFile: true, hadSaveFile: true, stored: before })
    expect(d.stored.whatsNew).toEqual({ version: '0.4.0', from: '0.3.0', notes: [] })
    expect(d.fetch).toBe(true)
  })

  it('an older copy sharing the folder shows nothing, lowers nothing and keeps the newer copy’s record', () => {
    const before = stored({ lastRunVersion: '0.4.0', whatsNew: { version: '0.4.0', from: '0.3.0', notes }, pendingNotes: { version: '0.5.0', from: '0.4.0', notes } })
    const d = decideWhatsNew({ running: '0.3.0', hadUpdatesFile: true, hadSaveFile: true, stored: before })
    expect(d).toEqual({ stored: before, changed: false, show: null, fetch: false })
  })

  it('drops a record left behind for a version below the running one', () => {
    const before = stored({ lastRunVersion: '0.4.0', whatsNew: { version: '0.3.0', from: '0.2.0', notes } })
    const d = decideWhatsNew({ running: '0.4.0', hadUpdatesFile: true, hadSaveFile: true, stored: before })
    expect(d).toMatchObject({ changed: true, show: null, fetch: false })
    expect(d.stored.whatsNew).toBeNull()
  })

  it('an unreadable updates.json is no upgrade from 0.1.0: the version is recorded and nothing shown', () => {
    // The file existed, so an updater-era version ran before; which one is not known.
    const d = decideWhatsNew({ running: '0.3.0', hadUpdatesFile: true, hadSaveFile: true, stored: stored() })
    expect(d).toEqual({ stored: stored({ lastRunVersion: '0.3.0' }), changed: true, show: null, fetch: false })
  })

  it('treats a prerelease and its release as different versions', () => {
    const d = decideWhatsNew({ running: '0.3.0', hadUpdatesFile: true, hadSaveFile: true, stored: stored({ lastRunVersion: '0.3.0-beta.1' }) })
    expect(d.stored.whatsNew).toEqual({ version: '0.3.0', from: '0.3.0-beta.1', notes: [] })
  })

  it('writes versions the plain way even when the app reports one with a "v"', () => {
    const d = decideWhatsNew({ running: 'v0.2.0', hadUpdatesFile: false, hadSaveFile: true, stored: stored() })
    expect(d.stored.lastRunVersion).toBe('0.2.0')
    expect(d.stored.whatsNew?.version).toBe('0.2.0')
  })

  it('does nothing at all when the running version is not a version', () => {
    const before = stored({ lastRunVersion: '0.2.0', pendingNotes: { version: '0.3.0', from: '0.2.0', notes } })
    expect(decideWhatsNew({ running: 'dev', hadUpdatesFile: true, hadSaveFile: true, stored: before })).toEqual({ stored: before, changed: false, show: null, fetch: false })
  })

  it('is settled after one launch: deciding again on its own result changes nothing', () => {
    const inputs: StoredUpdates[] = [
      stored(),
      stored({ lastRunVersion: '0.2.0' }),
      stored({ lastRunVersion: '0.2.0', pendingNotes: { version: '0.3.0', from: '0.2.0', notes } }),
      stored({ lastRunVersion: '0.9.0', whatsNew: { version: '0.9.0', from: null, notes } })
    ]
    const files = [
      [false, false],
      [false, true],
      [true, true]
    ] as const
    for (const before of inputs) {
      for (const [hadUpdatesFile, hadSaveFile] of files) {
        const first = decideWhatsNew({ running: '0.3.0', hadUpdatesFile, hadSaveFile, stored: before })
        const second = decideWhatsNew({ running: '0.3.0', hadUpdatesFile: true, hadSaveFile: true, stored: first.stored })
        expect(second.changed).toBe(false)
        expect(second.stored).toBe(first.stored)
      }
    }
  })
})
