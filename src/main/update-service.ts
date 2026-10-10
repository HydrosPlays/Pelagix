/**
 * The update feature as the rest of the main process sees it: check, download, install, and
 * the What's-new notes after an update. It owns the snapshot the page reads and pushes a new
 * one on every change.
 *
 * No Electron imports, so it runs under vitest: the updater library, the network, the files and
 * the window all come in through `UpdateServiceDeps` (see updates.ts for the real ones).
 */

import type { UpdateMode, UpdateState } from '@shared/api'
import {
  CHECK_POLL_MS,
  classifyUpdateError,
  createProgressGate,
  decideWhatsNew,
  defaultStoredUpdates,
  embeddedNote,
  FIRST_CHECK_DELAY_MS,
  holdsVersion,
  initialUpdateState,
  isAutoCheckDue,
  reduceUpdate,
  selectNotes,
  toOffer,
  toProgress,
  toWhatsNew,
  type StoredUpdates,
  type UpdateEvent
} from './update-model'
import type { GitHubRelease, ReleaseFetch } from './update-releases'
import type { StoredRead, UpdateLog, UpdateStore } from './update-store'
import { isNewerVersion, plainVersion } from './update-version'

/** After a request for the release list, successful or not, the next one waits at least this long. */
export const NOTES_REFETCH_MIN_MS = 10 * 60 * 1000
/** A stored "come back after" further away than this is not believed. */
const MAX_RATE_LIMIT_MS = 24 * 60 * 60 * 1000
/**
 * A check normally takes under a second. The library has no time limit of its own that works
 * under Electron, so a connection that never answers would leave "checking" on screen for good.
 */
export const CHECK_TIMEOUT_MS = 60_000
/** How long "Cancel" waits for the library to let go of a download before it stops waiting. */
export const CANCEL_GRACE_MS = 5000
/**
 * When updates.json is there but cannot be opened at start-up (a virus scanner or a sync client
 * holds it), it is tried again after each of these waits before the run goes on without it.
 */
export const READ_RETRY_MS: readonly number[] = [1500, 4000]

// The only texts of this module that reach the page: fixed, with nothing of the failure in them.
const NOTHING_TO_INSTALL = 'There is no downloaded update to install.'
const INSTALL_NOT_STARTED = 'The update could not be started.'
const SETTING_NOT_SAVED = 'The setting could not be saved.'

/** What a check found, as far as this module reads it. */
export interface UpdaterCheck {
  isUpdateAvailable: boolean
  updateInfo: { version: string; tag?: unknown; releaseNotes?: unknown }
}

export interface UpdaterDownload {
  /** Resolves with the downloaded files once they are verified; rejects on failure or after `cancel()`. */
  readonly done: Promise<string[]>
  cancel(): void
}

/** The part of electron-updater this module drives (see updater.ts). */
export interface Updater {
  /** Null when the library decided not to check at all. */
  check(): Promise<UpdaterCheck | null>
  /**
   * Like the library, this hands out the download that is already running when there is one,
   * and `cancel()` of the handle it returns then stops nothing.
   */
  download(): UpdaterDownload
  /**
   * Starts the installer and then quits the app. False when no installer was started. True only
   * says that Windows was asked to start it: a refusal comes too late to be reported, and the
   * app quits all the same.
   */
  install(): boolean
  onProgress(listener: (info: unknown) => void): void
}

export interface UpdateServiceDeps {
  mode: UpdateMode
  /** `app.getVersion()`. */
  currentVersion: string
  /** Whether updates.json was there when the app started. */
  hadUpdatesFile: boolean
  /** Whether save.json was there when the app started, read before the page could write one. */
  hadSaveFile: boolean
  store: UpdateStore
  log: UpdateLog
  /** Loads and sets up electron-updater. Not called before the first check, and never in mode `off`. */
  loadUpdater(): Promise<Updater>
  /** One request to GitHub for the release list. Never rejects. */
  fetchReleases(): Promise<ReleaseFetch>
  /** Resolves once no save is being written. */
  saveIdle(): Promise<void>
  fileExists(path: string): boolean
  /** Called with every new snapshot. */
  onState(state: UpdateState): void
  /** Clock override for tests. */
  now?: () => number
}

export interface UpdateService {
  /** Begins the automatic checks. Call when the main window has loaded; later calls do nothing. */
  start(): void
  state(): Promise<UpdateState>
  /** A check the user asked for. */
  check(): Promise<UpdateState>
  download(): Promise<UpdateState>
  cancelDownload(): Promise<UpdateState>
  /** Rejects when there is nothing to install or the installer could not be started. */
  install(): Promise<void>
  /** Rejects when the choice could not be written to disk; it then holds until the app closes. */
  setAutoCheck(enabled: boolean): Promise<UpdateState>
  markAnnounced(version: string): Promise<UpdateState>
  dismissWhatsNew(): Promise<UpdateState>
  /** True while updates.json or a line of the log is still on its way to the disk. */
  readonly busy: boolean
  /** Resolves once both are written. The app waits for this before it quits. */
  idle(): Promise<void>
}

const errorText = (err: unknown): string => (err instanceof Error ? (err.stack ?? err.message) : String(err))

/**
 * The first line of what went wrong. The library writes its own failures to the log in full, with
 * the response headers and a stack; the line this module adds only says what was made of one.
 */
function firstLine(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err)
  const line = text.slice(0, 1000).split(/[\r\n]/, 1)[0] ?? ''
  return line.length > 300 ? `${line.slice(0, 300)}…` : line
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** True when `work` settles, either way, within `ms`. Nothing is stopped: the caller just stops waiting. */
function settlesWithin(work: Promise<unknown>, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms)
    const done = (): void => {
      clearTimeout(timer)
      resolve(true)
    }
    work.then(done, done)
  })
}

interface DownloadRun {
  /** Null until the library has been asked: a run first waits for a download "Cancel" gave up on. */
  handle: UpdaterDownload | null
  /** "Cancel" has been pressed. */
  cancelled: boolean
  /** Set when "Cancel" gave up waiting; whatever the library reports for this download later is ignored. */
  abandoned: boolean
  /** Resolves when "Cancel" is pressed. */
  stopped: Promise<void>
  stop(): void
  /** Resolves when the download has finished, failed, been cancelled or been abandoned. */
  settled: Promise<void>
  settle(): void
}

function newDownloadRun(): DownloadRun {
  let stop = (): void => {}
  let settle = (): void => {}
  const stopped = new Promise<void>((resolve) => {
    stop = resolve
  })
  const settled = new Promise<void>((resolve) => {
    settle = resolve
  })
  return { handle: null, cancelled: false, abandoned: false, stopped, stop, settled, settle }
}

export function createUpdateService(deps: UpdateServiceDeps): UpdateService {
  const { mode, log } = deps
  const now = deps.now ?? Date.now
  const currentVersion = plainVersion(deps.currentVersion) ?? deps.currentVersion
  let state = initialUpdateState(mode, currentVersion)

  if (mode === 'off') {
    // Development, the screenshot tool, a smoke run: nothing is loaded, read, scheduled or written.
    const unchanged = (): Promise<UpdateState> => Promise.resolve(state)
    return {
      start() {},
      state: unchanged,
      check: unchanged,
      download: unchanged,
      cancelDownload: unchanged,
      install: () => Promise.reject(new Error(NOTHING_TO_INSTALL)),
      setAutoCheck: unchanged,
      markAnnounced: unchanged,
      dismissWhatsNew: unchanged,
      busy: false,
      idle: () => Promise.resolve()
    }
  }

  let stored: StoredUpdates = defaultStoredUpdates()
  /** False when updates.json was there but could not be read: it may be good, so this run leaves it alone. */
  let writable = true
  /** Writes of updates.json that have not ended yet. */
  const writing = new Set<Promise<boolean>>()
  let updater: Updater | null = null
  let updaterLoad: Promise<Updater> | null = null
  /** The releases behind `state.offer.notes`, kept for the What's-new window of the next version. */
  let offerNotes: GitHubRelease[] = []
  let installerFile: string | null = null
  /** A version whose installer an earlier run started without the update ever arriving. */
  let unfinishedInstall: string | null = null
  let lastAttemptAt: number | null = null
  let lastListFetchAt: number | null = null
  let started = false

  let checkRun: { manual: boolean; done: Promise<void> } | null = null
  let downloadRun: DownloadRun | null = null
  /** A download "Cancel" stopped waiting for, for as long as the library is still busy with it. */
  let leftover: Promise<void> | null = null
  let installRun: Promise<void> | null = null
  let listFetch: Promise<GitHubRelease[] | null> | null = null
  const progressGate = createProgressGate()

  function apply(event: UpdateEvent): void {
    const next = reduceUpdate(state, event)
    if (next === state) return
    state = next
    try {
      deps.onState(state)
    } catch (err) {
      log.warn(`could not pass the update state on: ${errorText(err)}`)
    }
  }

  /**
   * Writes updates.json. Never rejects: what could not be saved still holds until the app
   * closes. Resolves false when nothing was written, for the one caller that has to say so.
   */
  function persist(): Promise<boolean> {
    if (!writable) return Promise.resolve(false)
    let write: Promise<void>
    try {
      write = deps.store.write(stored)
    } catch (err) {
      write = Promise.reject(err)
    }
    const run = write.then(
      () => true,
      (err) => {
        log.warn(`could not write updates.json: ${errorText(err)}`)
        return false
      }
    )
    writing.add(run)
    void run.then(() => writing.delete(run))
    return run
  }

  function getUpdater(): Promise<Updater> {
    updaterLoad ??= deps.loadUpdater().then(
      (loaded) => {
        loaded.onProgress((info) => {
          // Only for a download this run asked the library for: one that was given up on may still be reporting.
          if (downloadRun?.handle != null && progressGate.pass(now())) apply({ type: 'download-progress', progress: toProgress(info) })
        })
        updater = loaded
        return loaded
      },
      (err) => {
        updaterLoad = null // the next check tries again
        throw err
      }
    )
    return updaterLoad
  }

  // ── Release notes ──────────────────────────────────────────────────────────

  /** One request for the release list, shared by everyone who asks while it runs. Null when it was not made or failed. */
  function fetchList(): Promise<GitHubRelease[] | null> {
    if (listFetch) return listFetch
    const at = now()
    const until = stored.rateLimitedUntil
    if (until !== null && at < until && until - at <= MAX_RATE_LIMIT_MS) return Promise.resolve(null)
    // Repeated "Check for updates" clicks must not turn into repeated requests against GitHub's hourly allowance.
    if (lastListFetchAt !== null && at >= lastListFetchAt && at - lastListFetchAt < NOTES_REFETCH_MIN_MS) return Promise.resolve(null)
    lastListFetchAt = at
    const run = (async (): Promise<GitHubRelease[] | null> => {
      let result: ReleaseFetch
      try {
        result = await deps.fetchReleases()
      } catch (err) {
        log.warn(`release notes request failed: ${errorText(err)}`)
        return null
      }
      if (result.ok) {
        stored = { ...stored, rateLimitedUntil: null, cache: result.releases.length > 0 ? { fetchedAt: now(), releases: result.releases } : stored.cache }
        await persist()
        return result.releases
      }
      if (result.reason === 'rate-limited') {
        stored = { ...stored, rateLimitedUntil: result.retryAt }
        await persist()
      }
      log.warn(`release notes request failed: ${result.reason}${result.reason === 'http' ? ` ${result.status}` : ''}`)
      return null
    })()
    listFetch = run
    void run.finally(() => {
      if (listFetch === run) listFetch = null
    })
    return run
  }

  /** The saved release list, when it holds `version`. Asks nobody. */
  function savedReleasesHolding(version: string): readonly GitHubRelease[] | null {
    const cached = stored.cache?.releases
    return cached && holdsVersion(cached, version) ? cached : null
  }

  /** A release list that holds `version`: the saved one when it already does, a fresh one otherwise. */
  async function releasesHolding(version: string): Promise<readonly GitHubRelease[] | null> {
    const saved = savedReleasesHolding(version)
    if (saved !== null) return saved
    const fresh = await fetchList()
    return fresh !== null && holdsVersion(fresh, version) ? fresh : null
  }

  /** Notes for the step from the running version to `version`: GitHub's, else the ones built into latest.yml, else none. */
  async function notesFor(version: string, info: UpdaterCheck['updateInfo']): Promise<GitHubRelease[]> {
    const list = await releasesHolding(version)
    const notes = list ? selectNotes(list, currentVersion, version) : []
    if (notes.length > 0) return notes
    const embedded = embeddedNote(version, info)
    return embedded ? [embedded] : []
  }

  /**
   * Finds the notes of a What's-new record that has none, then shows it either way. Nobody asked
   * for this, so while automatic checks are off GitHub is not asked: the saved list has the notes,
   * or the record is shown without any. The switch counts as it stood at start-up: turning it on
   * later in the same run does not send the request after all.
   */
  async function fillWhatsNew(): Promise<void> {
    const record = stored.whatsNew
    if (record === null) return
    const list = stored.autoCheck ? await releasesHolding(record.version) : savedReleasesHolding(record.version)
    // Dismissed while the request was running.
    if (stored.whatsNew !== record) return
    const filled = { ...record, notes: list ? selectNotes(list, record.from, record.version) : [] }
    stored = { ...stored, whatsNew: filled }
    if (filled.notes.length > 0) await persist()
    if (stored.whatsNew === filled) apply({ type: 'whats-new', whatsNew: toWhatsNew(filled) })
  }

  // ── Start-up ───────────────────────────────────────────────────────────────

  /** Reads updates.json, a few times over when something else holds the file just then. */
  async function readStored(): Promise<StoredRead> {
    for (let attempt = 0; ; attempt++) {
      const read = await deps.store.read().catch((err): StoredRead => {
        log.warn(`updates.json could not be read: ${errorText(err)}`)
        return { data: defaultStoredUpdates(), source: 'unreadable' }
      })
      const wait = READ_RETRY_MS[attempt]
      if (read.source !== 'unreadable' || wait === undefined) return read
      await sleep(wait)
    }
  }

  /** Settles once updates.json has been read and the What's-new decision of this launch is made. Every call waits for it. */
  const ready: Promise<void> = (async () => {
    const read = await readStored()
    stored = read.data
    if (read.source === 'unreadable') {
      // The file may say that automatic checks are off, and it may be in perfect order. So this
      // run checks nothing by itself and writes nothing over it; the next start reads it again.
      writable = false
      stored = { ...stored, autoCheck: false }
      log.warn('updates.json cannot be read: until the next start nothing is checked automatically and nothing is remembered')
    }
    const decision = decideWhatsNew({ running: currentVersion, hadUpdatesFile: deps.hadUpdatesFile, hadSaveFile: deps.hadSaveFile, stored })
    stored = decision.stored
    // The last check of an earlier run may have offered a newer version than this copy. Its time
    // is then held back until a check of this run has answered: with nothing on offer yet, the
    // page would read "checked" as "up to date".
    const newerKnown = stored.offeredVersion !== null && isNewerVersion(stored.offeredVersion, currentVersion)
    apply({ type: 'restored', autoCheck: stored.autoCheck, lastCheckedAt: newerKnown ? null : stored.lastCheckedAt, whatsNew: decision.show ? toWhatsNew(decision.show) : null })
    // Notes are saved just before the installer is started and dropped once that version runs.
    // Still here for a newer version, they mean an earlier run started an installer and the
    // update never arrived: Windows refused to run it, or it broke off. Nothing could tell the
    // user at the time, because the app had already quit.
    if (mode === 'auto' && stored.pendingNotes !== null) {
      unfinishedInstall = stored.pendingNotes.version
      log.warn(`an earlier run started the installer of ${unfinishedInstall}, and this is still ${currentVersion}`)
    }
    // Not waited for: the first snapshot needs what was read, not what is being written.
    if (decision.changed) void persist()
    if (decision.fetch) void fillWhatsNew().catch((err) => log.warn(`could not load the notes for this version: ${errorText(err)}`))
  })().catch((err) => {
    // Nothing is known for sure now, so the same caution applies as for a file that cannot be read.
    writable = false
    stored = { ...stored, autoCheck: false }
    apply({ type: 'auto-check-set', enabled: false })
    log.error(`update state could not be restored: ${errorText(err)}`)
  })

  // ── Check ──────────────────────────────────────────────────────────────────

  async function runCheck(run: { manual: boolean }): Promise<void> {
    try {
      const answer = (await getUpdater()).check()
      if (!(await settlesWithin(answer, CHECK_TIMEOUT_MS))) throw new Error('Request timed out')
      const result = await answer
      if (result === null) throw new Error('the updater did not check')
      const at = now()
      const version = result.isUpdateAvailable ? plainVersion(result.updateInfo.version) : null
      // The library has already compared the versions; a second opinion costs nothing and keeps a
      // malformed latest.yml from being offered.
      if (version === null || !isNewerVersion(version, currentVersion)) {
        offerNotes = []
        stored = { ...stored, lastCheckedAt: at, offeredVersion: null }
        apply({ type: 'check-succeeded', offer: null, at })
      } else {
        const notes = await notesFor(version, result.updateInfo)
        offerNotes = notes
        stored = { ...stored, lastCheckedAt: at, offeredVersion: version }
        apply({ type: 'check-succeeded', offer: toOffer(version, notes, result.updateInfo.tag, stored.announcedVersion), at })
        if (unfinishedInstall === version) {
          // Said once: the next attempt speaks for itself.
          unfinishedInstall = null
          apply({ type: 'install-unfinished', version, at })
        }
      }
      await persist()
    } catch (err) {
      const kind = classifyUpdateError(err)
      log.error(`check failed: ${firstLine(err)} (${kind})`)
      apply({ type: 'check-failed', manual: run.manual, kind, at: now() })
    }
  }

  async function check(manual: boolean): Promise<UpdateState> {
    await ready
    // A check that already has its answer and is only writing it down cannot be joined: it will
    // not report again, and "checking" would stay on screen for good. It is waited out instead.
    while (checkRun && state.phase !== 'checking') await checkRun.done
    if (checkRun) {
      // Joining a check the app started by itself makes it the user's: its failure is then shown.
      if (manual && !checkRun.manual) {
        checkRun.manual = true
        apply({ type: 'check-started', manual: true })
      }
      await checkRun.done
      return state
    }
    // Not while a download or an install is under way, and not over an installer that is waiting.
    if (state.phase !== 'idle' && state.phase !== 'available') return state
    lastAttemptAt = now()
    apply({ type: 'check-started', manual })
    const run = { manual, done: Promise.resolve() }
    run.done = runCheck(run).finally(() => {
      if (checkRun === run) checkRun = null
    })
    checkRun = run
    await run.done
    return state
  }

  // ── Download ───────────────────────────────────────────────────────────────

  async function runDownload(run: DownloadRun, from: Updater): Promise<void> {
    try {
      // The library hands a download that is still running to whoever asks next, and only the
      // first caller's "cancel" reaches it. So one that "Cancel" gave up on has to end before a
      // new one is asked for; the page shows 0% meanwhile, and "Cancel" still works.
      if (leftover !== null) await Promise.race([leftover, run.stopped])
      if (run.cancelled) {
        apply({ type: 'download-cancelled' })
        return
      }
      run.handle = from.download()
      const files = await run.handle.done
      if (run.abandoned) return
      installerFile = files[0] ?? null
      apply({ type: 'download-succeeded' })
    } catch (err) {
      if (run.abandoned) return
      if (run.cancelled) {
        apply({ type: 'download-cancelled' })
        return
      }
      const kind = classifyUpdateError(err)
      log.error(`download failed: ${firstLine(err)} (${kind})`)
      apply({ type: 'download-failed', kind, at: now() })
    }
  }

  async function download(): Promise<UpdateState> {
    await ready
    // The gate that matters: only an installed copy may fetch the installer. A portable copy
    // would download it and then have nothing it could safely do with it.
    if (mode !== 'auto') return state
    if (downloadRun) {
      await downloadRun.settled
      return state
    }
    if (state.phase !== 'available' || updater === null) return state
    progressGate.reset()
    apply({ type: 'download-started' })
    const run = newDownloadRun()
    downloadRun = run
    void runDownload(run, updater).finally(() => {
      if (downloadRun === run) downloadRun = null
      run.settle()
    })
    await run.settled
    return state
  }

  async function cancelDownload(): Promise<UpdateState> {
    await ready
    const run = downloadRun
    if (run === null) return state
    run.cancelled = true
    run.stop()
    run.handle?.cancel()
    // The library lets go at once in most places, but not while it waits on a stalled connection
    // for a part of the file. "Cancel" must not hang on that: the download is left to end by itself.
    if (!(await settlesWithin(run.settled, CANCEL_GRACE_MS)) && !run.abandoned) {
      run.abandoned = true
      if (run.handle !== null) {
        const ending = run.handle.done.then(
          () => {},
          () => {}
        )
        leftover = ending
        void ending.then(() => {
          if (leftover === ending) leftover = null
        })
      }
      if (downloadRun === run) downloadRun = null
      apply({ type: 'download-cancelled' })
      run.settle()
    }
    return state
  }

  // ── Install ────────────────────────────────────────────────────────────────

  async function runInstall(): Promise<void> {
    await ready
    const offer = state.offer
    if (mode !== 'auto' || state.phase !== 'ready' || offer === null || updater === null) throw new Error(NOTHING_TO_INSTALL)

    // The installer stops a running app about a second after it starts, and it starts before
    // the app quits. So everything is put on disk first, in this order.
    await deps.saveIdle()
    stored = { ...stored, pendingNotes: { version: offer.version, from: currentVersion, notes: offerNotes } }
    await persist()
    apply({ type: 'install-started' })
    // A save that slipped in while the notes were being written.
    await deps.saveIdle()

    let begun = false
    try {
      begun = installerFile !== null && deps.fileExists(installerFile) && updater.install()
    } catch (err) {
      log.error(`install failed: ${errorText(err)}`)
    }
    if (!begun) {
      log.error('the installer could not be started')
      apply({ type: 'install-failed', kind: 'unknown', at: now() })
      // The notes were saved for a restart that is not going to happen, and the user has just been
      // told. Left behind, the next start would take them for an install that failed unseen.
      stored = { ...stored, pendingNotes: null }
      await persist()
      throw new Error(INSTALL_NOT_STARTED)
    }
  }

  function install(): Promise<void> {
    // A second click joins the first: the installer must never be started twice.
    installRun ??= runInstall().finally(() => {
      installRun = null
    })
    return installRun
  }

  // ── Settings and acknowledgements ──────────────────────────────────────────

  async function setAutoCheck(enabled: boolean): Promise<UpdateState> {
    await ready
    if (stored.autoCheck !== enabled) {
      stored = { ...stored, autoCheck: enabled }
      apply({ type: 'auto-check-set', enabled })
      // The choice holds for this run either way. It is the one thing in the file the user set by
      // hand, so they are told when it will not be there after a restart.
      if (!(await persist())) throw new Error(SETTING_NOT_SAVED)
    }
    return state
  }

  async function markAnnounced(version: string): Promise<UpdateState> {
    await ready
    // Only the version on offer can be acknowledged; anything else is a stale or made-up call.
    if (state.offer !== null && state.offer.version === version && stored.announcedVersion !== version) {
      stored = { ...stored, announcedVersion: version }
      apply({ type: 'announced', version })
      await persist()
    }
    return state
  }

  async function dismissWhatsNew(): Promise<UpdateState> {
    await ready
    // Only what this copy shows, or would show once its notes arrive: an older copy sharing the
    // folder must not throw away the record of a newer one.
    if (stored.whatsNew !== null && stored.whatsNew.version === currentVersion) {
      stored = { ...stored, whatsNew: null }
      apply({ type: 'whats-new', whatsNew: null })
      await persist()
    }
    return state
  }

  // ── Timing ─────────────────────────────────────────────────────────────────

  function checkIfDue(): void {
    void ready.then(() => {
      if (isAutoCheckDue({ autoCheck: state.autoCheck, phase: state.phase, lastAttemptAt, now: now() })) void check(false)
    })
  }

  function start(): void {
    if (started) return
    started = true
    // The first thing anyone reading the log needs to know: which kind of copy wrote it.
    log.info(`Pelagix ${currentVersion}, update mode ${mode}`)
    setTimeout(() => {
      checkIfDue()
      setInterval(checkIfDue, CHECK_POLL_MS).unref()
    }, FIRST_CHECK_DELAY_MS).unref()
  }

  const isBusy = (): boolean => writing.size > 0 || log.busy

  async function idle(): Promise<void> {
    // Looked at again afterwards: a write can begin while another one is being waited for.
    while (isBusy()) await Promise.all([...writing, log.idle()])
  }

  return {
    start,
    state: () => ready.then(() => state),
    check: () => check(true),
    download,
    cancelDownload,
    install,
    setAutoCheck,
    markAnnounced,
    dismissWhatsNew,
    get busy() {
      return isBusy()
    },
    idle
  }
}
