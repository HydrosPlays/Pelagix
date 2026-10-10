/**
 * The contract between the Electron preload script and the renderer.
 *
 * `window.api` exists only inside Electron. In a plain browser (`npm run dev:web`) it is
 * undefined and the renderer falls back to localStorage and direct CDN sprite URLs.
 *
 * Types only: this file must stay free of runtime code.
 */

import type { GameSaveResult } from './game-save-types'
import type { ShinyDexResult } from './shinydex-types'
import type { SaveFile, ThemeId } from './save-types'

export interface ExportResult {
  canceled: boolean
  /** Absolute path the save was written to; absent when the dialog was cancelled. */
  path?: string
}

export interface SpriteCacheInfo {
  files: number
  bytes: number
}

export interface AppInfo {
  version: string
  electron: string
  chrome: string
  /** Folder holding save.json, backups/ and sprite-cache/. */
  userData: string
}

/**
 * How this copy of the app can be updated.
 * - `auto`: installed with the setup exe. It downloads and installs updates itself.
 * - `manual`: the portable exe, or an unpacked folder. It checks and shows the notes, but the new
 *   version has to be downloaded from GitHub by hand.
 * - `off`: not packaged (development, the screenshot tool), a smoke run, or not Windows. Nothing
 *   is checked, fetched or written.
 */
export type UpdateMode = 'auto' | 'manual' | 'off'

/** One GitHub release, as the changelog shows it. */
export interface ReleaseNote {
  /** Plain version without a leading "v": "0.2.0". */
  version: string
  /** The release title as written on GitHub; may be empty. */
  name: string
  /** ISO 8601 timestamp, or null when unknown. */
  publishedAt: string | null
  /** The release page. Built by the main process, always under `RELEASES_URL` + "/tag/". */
  url: string
  /**
   * The release description: Markdown as written on GitHub. Untrusted text, so it is only ever
   * shown through the app's own Markdown renderer, never as HTML.
   */
  body: string
}

/** A version newer than the running one. */
export interface UpdateOffer {
  /** Plain version without a leading "v". */
  version: string
  /** The release page of `version`. */
  url: string
  /**
   * Every release newer than the running version up to `version`, newest first.
   * Empty when the notes could not be fetched; the UI then links to `url` instead.
   */
  notes: ReleaseNote[]
  /** True once the changelog window has been shown for this version on this computer. */
  announced: boolean
}

export interface UpdateProgress {
  /** 0 to 100. */
  percent: number
  transferred: number
  /** Bytes this download fetches. An update that only fetches the changed parts reports those, not the installer size. */
  total: number
  bytesPerSecond: number
}

/**
 * - `idle`: nothing to do. No check has run yet, or the app is up to date.
 * - `checking`: a check is running.
 * - `available`: `offer` is set and nothing has been downloaded.
 * - `downloading`: `offer` and `progress` are set (`auto` only).
 * - `ready`: the installer is downloaded and verified, waiting for a restart (`auto` only).
 * - `installing`: the installer has been started and the app is about to close.
 */
export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'installing'

/**
 * Why an update step failed, as a closed set the UI has wording for. The underlying error text
 * never crosses to the renderer: it holds URLs, response headers and local paths.
 * - `offline`: GitHub could not be reached.
 * - `not-ready`: the newest release is missing its update files, or there is no release yet.
 * - `rate-limited`: GitHub refused the request for now.
 * - `corrupt`: the download did not match its checksum.
 * - `disk`: the download could not be written.
 */
export type UpdateErrorKind = 'offline' | 'not-ready' | 'rate-limited' | 'corrupt' | 'disk' | 'unknown'

export interface UpdateError {
  kind: UpdateErrorKind
  during: 'check' | 'download' | 'install'
  /** Epoch milliseconds. */
  at: number
}

/** Shown once after the app has been updated. */
export interface WhatsNew {
  /** The version now running. */
  version: string
  /** The version it replaced, when known. */
  from: string | null
  /** The release page of `version`. */
  url: string
  /**
   * Releases after `from` up to `version`, newest first. Empty when they could not be fetched, and
   * when automatic checks are off and this computer has not saved them: they are not fetched then.
   */
  notes: ReleaseNote[]
}

/**
 * Everything the renderer knows about updates. The main process owns it and always sends the
 * whole snapshot: read it once with `updateState()`, then follow `onUpdateState()`.
 */
export interface UpdateState {
  mode: UpdateMode
  /** The running version, `app.getVersion()`. */
  currentVersion: string
  /**
   * Whether the app checks by itself at start-up and every few hours. While it is off the app
   * sends no update request of its own: no check, and no fetch of the notes after an update.
   * Kept per computer, not in the save.
   */
  autoCheck: boolean
  phase: UpdatePhase
  /**
   * Epoch milliseconds of the last check that got an answer from GitHub; null if there has been
   * none. Also null after a restart while the last answer was "a newer version exists" and this
   * run has not checked yet: with no offer to show, a time alone would read as "up to date".
   */
  lastCheckedAt: number | null
  /** Set from `available` onwards, and kept while a later check or step fails. */
  offer: UpdateOffer | null
  /** Set while `phase` is `downloading`. */
  progress: UpdateProgress | null
  /**
   * The failure of the last step the user asked for. Checks the app starts by itself fail
   * silently and leave this null. Cleared when the next step starts.
   *
   * One failure is reported late, as `unknown` during `install`: an installer that an earlier
   * run started without the update ever arriving (Windows refused to run it, or it broke off).
   * The app had already quit by then, so it is said once the same version is on offer again.
   */
  error: UpdateError | null
  /** Notes waiting to be shown after an update; null once dismissed. */
  whatsNew: WhatsNew | null
}

export interface PelagixApi {
  /** `process.platform` of the main process: "win32", "darwin", "linux". */
  platform: string
  /** Raw parsed JSON of the save file, or null when there is none yet. Validated by the renderer. */
  loadSave(): Promise<unknown | null>
  writeSave(save: SaveFile): Promise<void>
  exportSave(save: SaveFile): Promise<ExportResult>
  /** Open dialog -> parsed JSON; null if cancelled. Rejects on unreadable or oversized files. */
  importSave(): Promise<unknown | null>
  /**
   * Open dialog -> the Pokémon in a save file of a Pokémon game; null if cancelled. The file is only
   * read. Never rejects because of the file: what went wrong is the result's `reason`.
   */
  readGameSave(): Promise<GameSaveResult | null>
  /**
   * Open dialog -> the shinies of a ShinyDex export or a saved ShinyDex History page; null if cancelled. The file
   * is only read. Never rejects because of the file: what went wrong is the result's `reason`.
   */
  readShinyDex(): Promise<ShinyDexResult | null>
  spriteCacheInfo(): Promise<SpriteCacheInfo>
  clearSpriteCache(): Promise<void>
  appInfo(): Promise<AppInfo>
  /** Opens the URL in the system browser. https only. */
  openExternal(url: string): Promise<void>
  /** Recolours the native title-bar overlay and window background to match the theme. */
  setTheme(theme: ThemeId): Promise<void>

  /** The current update snapshot. */
  updateState(): Promise<UpdateState>
  /** Calls `listener` with every new snapshot. Returns the function that stops it. */
  onUpdateState(listener: (state: UpdateState) => void): () => void
  /**
   * Checks now because the user asked. Resolves with the snapshot once the check has finished;
   * a failed check resolves too, with `error` set. In mode `off` it resolves unchanged.
   */
  checkForUpdates(): Promise<UpdateState>
  /**
   * Mode `auto`, phase `available` only: downloads the offered version. Resolves when the
   * download has finished, failed or been cancelled; progress arrives through `onUpdateState`.
   */
  downloadUpdate(): Promise<UpdateState>
  /** Stops a running download and returns to `available`. */
  cancelUpdateDownload(): Promise<UpdateState>
  /**
   * Mode `auto`, phase `ready` only: waits until the save is on disk, then closes the app,
   * installs the update and reopens the app. The renderer must flush its own pending save
   * before calling this. Rejects when there is nothing to install.
   */
  installUpdate(): Promise<void>
  /**
   * Switches the automatic checks on or off. Rejects when the choice could not be written to
   * disk: it then holds, as the pushed snapshot shows, but only until the app closes.
   */
  setUpdateAutoCheck(enabled: boolean): Promise<UpdateState>
  /** Records that the changelog window has been shown for `version`, so it does not open by itself again. */
  markUpdateAnnounced(version: string): Promise<UpdateState>
  /** Drops `whatsNew` after the user has closed it. */
  dismissWhatsNew(): Promise<UpdateState>
}

/** IPC channels behind `PelagixApi`: argument tuple and resolved value of each. */
export interface PelagixIpc {
  'pelagix:save-load': { args: []; result: unknown | null }
  'pelagix:save-write': { args: [save: SaveFile]; result: void }
  'pelagix:save-export': { args: [save: SaveFile]; result: ExportResult }
  'pelagix:save-import': { args: []; result: unknown | null }
  'pelagix:game-save-read': { args: []; result: GameSaveResult | null }
  'pelagix:shinydex-read': { args: []; result: ShinyDexResult | null }
  'pelagix:sprite-cache-info': { args: []; result: SpriteCacheInfo }
  'pelagix:sprite-cache-clear': { args: []; result: void }
  'pelagix:app-info': { args: []; result: AppInfo }
  'pelagix:open-external': { args: [url: string]; result: void }
  'pelagix:set-theme': { args: [theme: ThemeId]; result: void }
  'pelagix:update-state': { args: []; result: UpdateState }
  'pelagix:update-check': { args: []; result: UpdateState }
  'pelagix:update-download': { args: []; result: UpdateState }
  'pelagix:update-cancel': { args: []; result: UpdateState }
  'pelagix:update-install': { args: []; result: void }
  'pelagix:update-set-auto-check': { args: [enabled: boolean]; result: UpdateState }
  'pelagix:update-announced': { args: [version: string]; result: UpdateState }
  'pelagix:update-whats-new-seen': { args: []; result: UpdateState }
}

export type PelagixChannel = keyof PelagixIpc

/** Messages the main process pushes to the page: channel -> argument tuple. */
export interface PelagixEvents {
  'pelagix:update-changed': [state: UpdateState]
}

export type PelagixEventChannel = keyof PelagixEvents

declare global {
  interface Window {
    api?: PelagixApi
  }
}
