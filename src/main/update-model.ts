/**
 * The rules of the update feature, with no Electron in them: which kind of copy is running, how
 * the snapshot the page sees changes, what updates.json holds, and what to show after an update.
 * No Electron imports, so it runs under vitest.
 */

import { win32 } from 'node:path'
import type { ReleaseNote, UpdateErrorKind, UpdateMode, UpdateOffer, UpdatePhase, UpdateProgress, UpdateState, WhatsNew } from '@shared/api'
import { MAX_BODY_LENGTH, readRelease, releasePageUrl, sortReleases, type GitHubRelease } from './update-releases'
import { compareVersions, isNewerVersion, isPrerelease, parseVersion, plainVersion } from './update-version'

/** How long after the page has loaded the first automatic check runs. */
export const FIRST_CHECK_DELAY_MS = 12_000
export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
/** How often the clock is looked at to see whether a check is due. A sleeping laptop stops timers, not the clock. */
export const CHECK_POLL_MS = 15 * 60 * 1000
/** At most this often is download progress passed on to the page. */
export const PROGRESS_INTERVAL_MS = 250
/** The changelog never lists more releases than this. */
export const MAX_NOTES = 20
export const MAX_UPDATES_BYTES = 2 * 1024 * 1024
/** 0.1.0 had no updater, so it never wrote updates.json. */
export const LAST_VERSION_WITHOUT_UPDATER = '0.1.0'

const MAX_CACHED_RELEASES = 100
const STORED_VERSION = 1

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

// ── Which kind of copy is this ───────────────────────────────────────────────

export interface ModeInput {
  /** `process.platform`. */
  platform: string
  isPackaged: boolean
  env: Readonly<Record<string, string | undefined>>
  /** Whether the uninstaller the setup exe writes sits next to the running exe. */
  hasUninstaller: boolean
}

/** Where the setup exe puts its uninstaller: "Uninstall <exe name>.exe" beside the app. */
export function uninstallerPath(execPath: string): string {
  const name = win32.basename(execPath).replace(/\.exe$/i, '')
  return win32.join(win32.dirname(execPath), `Uninstall ${name}.exe`)
}

export function detectUpdateMode(input: ModeInput): UpdateMode {
  // A smoke run only proves that the app boots; it must not touch the network or the disk.
  if (input.env['PELAGIX_SMOKE'] === '1') return 'off'
  if (input.platform !== 'win32' || !input.isPackaged) return 'off'
  // The portable launcher unpacks to a temp folder and sets this before it starts the real exe.
  const portable = (input.env['PORTABLE_EXECUTABLE_FILE'] ?? '') !== ''
  // Only a copy the setup exe installed may run the setup exe again; anything else would be
  // installed a second time somewhere else.
  return input.hasUninstaller && !portable ? 'auto' : 'manual'
}

// ── Errors ───────────────────────────────────────────────────────────────────

/** electron-updater codes that mean "the release is there but its update files are not usable". */
const NOT_READY_CODES = new Set([
  'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND',
  'ERR_UPDATER_INVALID_UPDATE_INFO',
  'ERR_UPDATER_NO_FILES_PROVIDED',
  'ERR_UPDATER_NO_CHECKSUM',
  'ERR_UPDATER_NO_PUBLISHED_VERSIONS',
  'ERR_UPDATER_INVALID_VERSION',
  'ERR_UPDATER_WEB_INSTALLER_DISABLED'
])
/** Codes that only say which step failed; the real cause is quoted inside the message. */
const WRAPPING_CODES = new Set(['ERR_UPDATER_LATEST_VERSION_NOT_FOUND', 'ERR_UPDATER_INVALID_RELEASE_FEED'])
const DISK_CODES = new Set(['ENOSPC', 'EPERM', 'EACCES', 'EBUSY', 'EROFS', 'EIO', 'EDQUOT', 'EMFILE'])
const OFFLINE_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED', 'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'EPIPE'])
/** Only the start of a message is looked at: the rest can be a megabyte of feed XML. */
const MESSAGE_SCAN_LENGTH = 4000

function field(err: unknown, name: string): unknown {
  if (typeof err !== 'object' || err === null) return undefined
  try {
    return (err as Record<string, unknown>)[name]
  } catch {
    return undefined // a getter that throws
  }
}

function httpStatus(err: unknown, code: string, message: string): number | null {
  const direct = field(err, 'statusCode')
  if (typeof direct === 'number' && Number.isInteger(direct) && direct >= 100 && direct <= 599) return direct
  // "HTTP_ERROR_404" on the error itself, "HttpError: 429" quoted by a wrapper, `status 404` from a failed download.
  const found = /^HTTP_ERROR_(\d{3})$/.exec(code) ?? /\bHttpError: (\d{3})\b/.exec(message) ?? /\bstatus (\d{3})\b/.exec(message)
  return found ? Number(found[1]) : null
}

/**
 * Maps whatever a check or download threw to the closed set the page has wording for. The
 * message itself never goes further than the log: it holds URLs, response headers and paths.
 */
export function classifyUpdateError(err: unknown): UpdateErrorKind {
  const rawCode = field(err, 'code')
  const code = typeof rawCode === 'string' ? rawCode : ''
  const rawMessage = typeof err === 'string' ? err : field(err, 'message')
  const message = typeof rawMessage === 'string' ? rawMessage.slice(0, MESSAGE_SCAN_LENGTH) : ''

  if (code === 'ERR_CHECKSUM_MISMATCH') return 'corrupt'
  if (NOT_READY_CODES.has(code)) return 'not-ready'
  if (DISK_CODES.has(code)) return 'disk'

  const status = httpStatus(err, code, message)
  if (status === 403 || status === 429) return 'rate-limited'
  // The newest release names a file that was never uploaded.
  if (status === 404) return 'not-ready'
  // GitHub having a bad moment looks the same from here as no connection: try again later.
  if (status !== null && status >= 500) return 'offline'

  // Electron's network stack reports failures as a bare message such as "net::ERR_NAME_NOT_RESOLVED".
  if (message.includes('net::ERR_') || OFFLINE_CODES.has(code)) return 'offline'
  if (/Request timed out|aborted by the server/.test(message)) return 'offline'

  if (WRAPPING_CODES.has(code)) return 'not-ready'
  if (/checksum mismatch/i.test(message)) return 'corrupt'
  return 'unknown'
}

// ── The snapshot and how it changes ──────────────────────────────────────────

export function initialUpdateState(mode: UpdateMode, currentVersion: string): UpdateState {
  return {
    mode,
    currentVersion,
    // Nothing checks by itself in mode `off`, so the switch reads as off there.
    autoCheck: mode !== 'off',
    phase: 'idle',
    lastCheckedAt: null,
    offer: null,
    progress: null,
    error: null,
    whatsNew: null
  }
}

export type UpdateEvent =
  /** What updates.json held when the app started. */
  | { type: 'restored'; autoCheck: boolean; lastCheckedAt: number | null; whatsNew: WhatsNew | null }
  /** A check begins, or the user joins one that is already running. */
  | { type: 'check-started'; manual: boolean }
  | { type: 'check-succeeded'; offer: UpdateOffer | null; at: number }
  | { type: 'check-failed'; manual: boolean; kind: UpdateErrorKind; at: number }
  | { type: 'download-started' }
  | { type: 'download-progress'; progress: UpdateProgress }
  | { type: 'download-succeeded' }
  | { type: 'download-failed'; kind: UpdateErrorKind; at: number }
  | { type: 'download-cancelled' }
  | { type: 'install-started' }
  | { type: 'install-failed'; kind: UpdateErrorKind; at: number }
  /** An earlier run started the installer of `version`, and this is still the old version. */
  | { type: 'install-unfinished'; version: string; at: number }
  | { type: 'auto-check-set'; enabled: boolean }
  | { type: 'announced'; version: string }
  | { type: 'whats-new'; whatsNew: WhatsNew | null }

const ZERO_PROGRESS: UpdateProgress = { percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 }

/**
 * The next snapshot. An event that does not fit the current phase (a late progress report, a
 * second "download finished") returns the very same object, which callers use to skip the push.
 */
export function reduceUpdate(state: UpdateState, event: UpdateEvent): UpdateState {
  switch (event.type) {
    case 'restored':
      if (state.autoCheck === event.autoCheck && state.lastCheckedAt === event.lastCheckedAt && state.whatsNew === null && event.whatsNew === null) return state
      return { ...state, autoCheck: event.autoCheck, lastCheckedAt: event.lastCheckedAt, whatsNew: event.whatsNew }

    case 'check-started': {
      const starting = state.phase === 'idle' || state.phase === 'available'
      if (!starting && state.phase !== 'checking') return state
      // Only a step the user asked for clears what the last one left behind.
      const error = event.manual ? null : state.error
      if (!starting && error === state.error) return state
      return { ...state, phase: 'checking', error }
    }

    case 'check-succeeded': {
      if (state.phase !== 'checking') return state
      // A failed download or install is about one version. The page shows it under whatever is
      // on offer, so it only stays while that is still the same version.
      const sameOffer = state.offer !== null && event.offer !== null && state.offer.version === event.offer.version
      return {
        ...state,
        phase: event.offer ? 'available' : 'idle',
        offer: event.offer,
        lastCheckedAt: event.at,
        // "Could not check" next to a fresh "last checked" would contradict itself.
        error: state.error !== null && state.error.during !== 'check' && sameOffer ? state.error : null
      }
    }

    case 'check-failed':
      if (state.phase !== 'checking') return state
      return {
        ...state,
        // A known offer survives a failed check; lastCheckedAt only moves when GitHub answered.
        phase: state.offer ? 'available' : 'idle',
        // A check the app started by itself fails silently.
        error: event.manual ? { kind: event.kind, during: 'check', at: event.at } : state.error
      }

    case 'download-started':
      if (state.phase !== 'available' || state.offer === null) return state
      return { ...state, phase: 'downloading', progress: ZERO_PROGRESS, error: null }

    case 'download-progress':
      if (state.phase !== 'downloading') return state
      return { ...state, progress: event.progress }

    case 'download-succeeded':
      if (state.phase !== 'downloading') return state
      return { ...state, phase: 'ready', progress: null }

    case 'download-failed':
      if (state.phase !== 'downloading') return state
      return { ...state, phase: 'available', progress: null, error: { kind: event.kind, during: 'download', at: event.at } }

    case 'download-cancelled':
      if (state.phase !== 'downloading') return state
      return { ...state, phase: 'available', progress: null }

    case 'install-started':
      if (state.phase !== 'ready') return state
      return { ...state, phase: 'installing', error: null }

    case 'install-failed':
      if (state.phase !== 'installing') return state
      // Back to `available`, not `ready`: the installer could not be started, so it is fetched or verified again.
      return { ...state, phase: 'available', error: { kind: event.kind, during: 'install', at: event.at } }

    case 'install-unfinished':
      // Said where the same version is offered again, so "Download and install" does not just lead to the same silent end.
      if (state.phase !== 'available' || state.offer === null || state.offer.version !== event.version) return state
      return { ...state, error: { kind: 'unknown', during: 'install', at: event.at } }

    case 'auto-check-set':
      return state.autoCheck === event.enabled ? state : { ...state, autoCheck: event.enabled }

    case 'announced':
      if (state.offer === null || state.offer.version !== event.version || state.offer.announced) return state
      return { ...state, offer: { ...state.offer, announced: true } }

    case 'whats-new':
      return state.whatsNew === null && event.whatsNew === null ? state : { ...state, whatsNew: event.whatsNew }
  }
}

/** Whether the app should start a check by itself now. `lastAttemptAt` is the last check of this launch, of either kind. */
export function isAutoCheckDue(input: { autoCheck: boolean; phase: UpdatePhase; lastAttemptAt: number | null; now: number }): boolean {
  if (!input.autoCheck) return false
  // Never while a check, a download or an install is under way, and not once an installer is waiting.
  if (input.phase !== 'idle' && input.phase !== 'available') return false
  if (input.lastAttemptAt === null) return true
  const since = input.now - input.lastAttemptAt
  // A clock that was set back must not silence the checks.
  return since < 0 || since >= CHECK_INTERVAL_MS
}

const finite = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0)

/** electron-updater's progress report, with every number made safe to show. */
export function toProgress(raw: unknown): UpdateProgress {
  const info = isRecord(raw) ? raw : {}
  const total = finite(info['total'])
  // A stale block map makes the library report "100% of 0 bytes" before it starts over.
  const percent = total > 0 ? Math.min(100, finite(info['percent'])) : 0
  return { percent, transferred: finite(info['transferred']), total, bytesPerSecond: finite(info['bytesPerSecond']) }
}

export interface ProgressGate {
  /** True when a report arriving at `now` should be passed on. */
  pass(now: number): boolean
  reset(): void
}

/** Lets the first report through, then at most one per interval. */
export function createProgressGate(intervalMs = PROGRESS_INTERVAL_MS): ProgressGate {
  let last: number | null = null
  return {
    pass(now) {
      if (last !== null && now >= last && now - last < intervalMs) return false
      last = now
      return true
    },
    reset() {
      last = null
    }
  }
}

// ── Release notes ────────────────────────────────────────────────────────────

export const toReleaseNote = (release: GitHubRelease): ReleaseNote => ({
  version: release.version,
  name: release.name,
  publishedAt: release.publishedAt,
  url: releasePageUrl(release.tag),
  body: release.body
})

/** The page of `version`: under its real tag when `releases` knows it, under the usual "v" tag otherwise. */
export function versionPageUrl(version: string, releases: readonly GitHubRelease[]): string {
  const known = releases.find((release) => release.version === version)
  return releasePageUrl(known ? known.tag : `v${version}`)
}

export const holdsVersion = (releases: readonly GitHubRelease[], version: string): boolean => releases.some((release) => release.version === version)

/**
 * The releases whose notes describe the step from `fromExclusive` to `toInclusive`, newest first:
 * every release with fromExclusive < version <= toInclusive, or the target alone when the old
 * version is not known. Prereleases in between are left out unless the target is one.
 * Empty unless the list holds the target itself: older notes without the newest would mislead.
 */
export function selectNotes(releases: readonly GitHubRelease[], fromExclusive: string | null, toInclusive: string, limit = MAX_NOTES): GitHubRelease[] {
  const to = parseVersion(toInclusive)
  if (to === null) return []
  const from = fromExclusive === null ? null : parseVersion(fromExclusive)
  if (fromExclusive !== null && (from === null || compareVersions(to, from) <= 0)) return []
  const allowPre = isPrerelease(to)
  const picked: GitHubRelease[] = []
  for (const release of sortReleases(releases)) {
    const version = parseVersion(release.tag)
    if (version === null) continue
    const toTarget = compareVersions(version, to)
    if (toTarget > 0) continue
    if (toTarget < 0 && (from === null || compareVersions(version, from) <= 0)) continue
    if (toTarget < 0 && release.prerelease && !allowPre) continue
    picked.push(release)
  }
  if (picked[0]?.version !== plainVersion(toInclusive)) return []
  return picked.slice(0, Math.max(0, limit))
}

/**
 * Notes the build itself wrote into latest.yml, as a last resort when GitHub's API cannot be
 * asked. With no such notes electron-updater fills the field from GitHub's feed, which is
 * rendered HTML: that is recognised by its first character and never used.
 */
export function embeddedNote(version: string, info: { tag?: unknown; releaseNotes?: unknown }): GitHubRelease | null {
  const text = info.releaseNotes
  if (typeof text !== 'string') return null
  const start = text.trimStart()
  if (start === '' || start.startsWith('<')) return null
  const named = readRelease({ tag: info.tag, name: '', body: '', publishedAt: null, prerelease: false })
  const tag = named !== null && named.version === version ? named.tag : `v${version}`
  return readRelease({ tag, name: '', body: text.slice(0, MAX_BODY_LENGTH), publishedAt: null, prerelease: false })
}

export function toOffer(version: string, notes: readonly GitHubRelease[], tagHint: unknown, announcedVersion: string | null): UpdateOffer {
  const hinted = readRelease({ tag: tagHint, name: '', body: '', publishedAt: null, prerelease: false })
  return {
    version,
    url: versionPageUrl(version, hinted !== null ? [...notes, hinted] : notes),
    notes: notes.map(toReleaseNote),
    announced: announcedVersion === version
  }
}

// ── updates.json ─────────────────────────────────────────────────────────────

/** Notes kept for the What's-new window: `whatsNew` once it is due, `pendingNotes` before an install. */
export interface StoredNotes {
  /** The version the notes lead up to. */
  version: string
  /** The version that was running before, when known. */
  from: string | null
  notes: GitHubRelease[]
}

export interface StoredCache {
  /** Epoch milliseconds. */
  fetchedAt: number
  /** Newest first. */
  releases: GitHubRelease[]
}

/** Everything updates.json holds. Per computer, never part of the save. */
export interface StoredUpdates {
  autoCheck: boolean
  lastCheckedAt: number | null
  /** The version the check at `lastCheckedAt` offered; null when it found nothing newer. */
  offeredVersion: string | null
  /** The highest version that has run from this user-data folder. */
  lastRunVersion: string | null
  /** The offered version the changelog window has already opened for by itself. */
  announcedVersion: string | null
  /** No request to api.github.com before this time (epoch milliseconds). */
  rateLimitedUntil: number | null
  /** Set after an update until the user closes the What's-new window. */
  whatsNew: StoredNotes | null
  /** Saved just before an install, to be shown by the version that comes back. */
  pendingNotes: StoredNotes | null
  cache: StoredCache | null
}

export function defaultStoredUpdates(): StoredUpdates {
  return { autoCheck: true, lastCheckedAt: null, offeredVersion: null, lastRunVersion: null, announcedVersion: null, rateLimitedUntil: null, whatsNew: null, pendingNotes: null, cache: null }
}

const timestamp = (value: unknown): number | null => (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null)

function parseReleases(value: unknown, max: number): GitHubRelease[] {
  if (!Array.isArray(value)) return []
  const out: GitHubRelease[] = []
  for (const raw of value.slice(0, max)) {
    if (!isRecord(raw)) continue
    const release = readRelease({ tag: raw['tag'], name: raw['name'], body: raw['body'], publishedAt: raw['publishedAt'], prerelease: raw['prerelease'] })
    if (release !== null) out.push(release)
  }
  return sortReleases(out)
}

function parseNotes(value: unknown): StoredNotes | null {
  if (!isRecord(value)) return null
  const version = plainVersion(value['version'])
  if (version === null) return null
  const from = plainVersion(value['from'])
  return { version, from: from !== null && isNewerVersion(version, from) ? from : null, notes: parseReleases(value['notes'], MAX_NOTES) }
}

function parseCache(value: unknown): StoredCache | null {
  if (!isRecord(value)) return null
  const releases = parseReleases(value['releases'], MAX_CACHED_RELEASES)
  return releases.length === 0 ? null : { fetchedAt: timestamp(value['fetchedAt']) ?? 0, releases }
}

/**
 * Reads the parsed JSON of updates.json. Tolerant field by field: whatever is missing, of the
 * wrong type or not a version falls back to its default, and nothing in the file is trusted
 * further than the same checks a GitHub response gets.
 */
export function parseStoredUpdates(raw: unknown): StoredUpdates {
  const defaults = defaultStoredUpdates()
  if (!isRecord(raw)) return defaults
  return {
    autoCheck: typeof raw['autoCheck'] === 'boolean' ? raw['autoCheck'] : defaults.autoCheck,
    lastCheckedAt: timestamp(raw['lastCheckedAt']),
    offeredVersion: plainVersion(raw['offeredVersion']),
    lastRunVersion: plainVersion(raw['lastRunVersion']),
    announcedVersion: plainVersion(raw['announcedVersion']),
    rateLimitedUntil: timestamp(raw['rateLimitedUntil']),
    whatsNew: parseNotes(raw['whatsNew']),
    pendingNotes: parseNotes(raw['pendingNotes']),
    cache: parseCache(raw['cache'])
  }
}

/** How much of a damaged updates.json is searched for the switch: `serializeStoredUpdates` writes it second. */
export const RESCUE_SCAN_LENGTH = 512

/**
 * What can still be told from an updates.json that no longer parses (cut short, a stray byte, far
 * too large): whether automatic checks were switched off. That is the one thing in the file the
 * user decided, and losing it would mean checking again after they said no. Everything else is
 * found out again, so the rest is the defaults. `head` is the start of the file's text.
 */
export function rescueStoredUpdates(head: string): StoredUpdates {
  const switchedOff = /"autoCheck"\s*:\s*false\b/.test(head.slice(0, RESCUE_SCAN_LENGTH))
  return { ...defaultStoredUpdates(), autoCheck: !switchedOff }
}

const withoutNotes = (record: StoredNotes | null): StoredNotes | null => (record === null ? null : { ...record, notes: [] })

/**
 * The text of updates.json, never larger than `MAX_UPDATES_BYTES`. When it would be, the release
 * cache goes first (it can be fetched again), then the saved notes (the release page has them).
 */
export function serializeStoredUpdates(data: StoredUpdates): string {
  const write = (d: StoredUpdates): string =>
    JSON.stringify({
      v: STORED_VERSION,
      autoCheck: d.autoCheck,
      lastCheckedAt: d.lastCheckedAt,
      offeredVersion: d.offeredVersion,
      lastRunVersion: d.lastRunVersion,
      announcedVersion: d.announcedVersion,
      rateLimitedUntil: d.rateLimitedUntil,
      whatsNew: d.whatsNew,
      pendingNotes: d.pendingNotes,
      cache: d.cache
    })
  const fits = (text: string): boolean => Buffer.byteLength(text, 'utf8') <= MAX_UPDATES_BYTES
  const full = write(data)
  if (fits(full)) return full
  const withoutCache = write({ ...data, cache: null })
  if (fits(withoutCache)) return withoutCache
  return write({ ...data, cache: null, whatsNew: withoutNotes(data.whatsNew), pendingNotes: withoutNotes(data.pendingNotes) })
}

// ── What's new ───────────────────────────────────────────────────────────────

export interface WhatsNewInput {
  /** `app.getVersion()`. */
  running: string
  /** Whether updates.json was there when the app started. */
  hadUpdatesFile: boolean
  /** Whether save.json was there when the app started, before the page could write one. */
  hadSaveFile: boolean
  stored: StoredUpdates
}

export interface WhatsNewDecision {
  /** What updates.json should hold from now on. */
  stored: StoredUpdates
  /** True when `stored` differs from what was read and has to be written. */
  changed: boolean
  /** Notes that can be shown at once. */
  show: StoredNotes | null
  /**
   * True when `stored.whatsNew` is for this version but has no notes yet. They are taken from the
   * saved release list or fetched, and never fetched while automatic checks are off.
   */
  fetch: boolean
}

/**
 * Decides, once per launch, whether this is the first run after an update and what to show for it.
 *
 * - Notes saved before an install for exactly this version are shown.
 * - Otherwise a `lastRunVersion` below this version means the user updated by hand: the notes
 *   have to be fetched.
 * - No updates.json but a save: the upgrade from 0.1.0, which had no updater.
 * - Neither file: a fresh install. Only the version is recorded.
 * - `lastRunVersion` never goes down, because an installed and a portable copy of different
 *   versions can share the folder; an older copy shows nothing and leaves the record alone.
 * - A record stays until it is dismissed, so it is shown again after a restart.
 */
export function decideWhatsNew(input: WhatsNewInput): WhatsNewDecision {
  const { stored } = input
  const running = parseVersion(input.running)
  if (running === null) return { stored, changed: false, show: null, fetch: false }
  const version = plainVersion(input.running) as string

  const before = input.hadUpdatesFile ? stored.lastRunVersion : input.hadSaveFile ? LAST_VERSION_WITHOUT_UPDATER : null
  const updated = before !== null && isNewerVersion(version, before)

  let whatsNew = stored.whatsNew
  let pendingNotes = stored.pendingNotes
  if (pendingNotes !== null && pendingNotes.version === version) {
    whatsNew = pendingNotes
    pendingNotes = null
  } else if (updated) {
    whatsNew = { version, from: before, notes: [] }
  }
  // Notes for a version this copy has reached or passed some other way will never be wanted.
  if (pendingNotes !== null && !isNewerVersion(pendingNotes.version, version)) pendingNotes = null
  if (whatsNew !== null && isNewerVersion(version, whatsNew.version)) whatsNew = null

  const lastRunVersion = stored.lastRunVersion !== null && !isNewerVersion(version, stored.lastRunVersion) ? stored.lastRunVersion : version
  const changed = whatsNew !== stored.whatsNew || pendingNotes !== stored.pendingNotes || lastRunVersion !== stored.lastRunVersion
  const mine = whatsNew !== null && whatsNew.version === version ? whatsNew : null
  return {
    stored: changed ? { ...stored, whatsNew, pendingNotes, lastRunVersion } : stored,
    changed,
    show: mine !== null && mine.notes.length > 0 ? mine : null,
    fetch: mine !== null && mine.notes.length === 0
  }
}

export function toWhatsNew(record: StoredNotes): WhatsNew {
  return { version: record.version, from: record.from, url: versionPageUrl(record.version, record.notes), notes: record.notes.map(toReleaseNote) }
}
