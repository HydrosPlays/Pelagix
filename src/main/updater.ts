/**
 * electron-updater, loaded on demand and set up the one way Pelagix uses it.
 *
 * The library is a devDependency on purpose: electron-vite bundles it into out/main as a chunk of
 * its own, so the asar still holds only out/ and package.json, and the chunk is not read from
 * disk before the first check. Only types are imported at the top of this file.
 */

import type { Session } from 'electron'
import type { AppUpdater, CancellationToken, Logger } from 'electron-updater'
import type { Updater } from './update-service'

/**
 * electron-updater sends this header with every request. Its value is a random id the library
 * makes up once and keeps in userData/.updaterId, meant for rolling a release out to a share of
 * the users. Pelagix has no such rollouts and sends nothing that tells one installation from
 * another, so the id is stopped in three places: see `withoutStagingId`, `requestHeaders` and
 * `filterRequests`.
 */
export const STAGING_ID_HEADER = 'x-user-staging-id'
/** What the library is handed in place of an id. The same on every computer. */
export const NO_STAGING_ID = '00000000-0000-0000-0000-000000000000'

export interface UpdaterOptions {
  /** "Pelagix/<version>": the only thing a request says about its sender. */
  userAgent: string
  /** Where the library's own log lines go; a packaged app has no console. */
  logger: Logger
}

/**
 * Makes the library use a fixed id instead of generating one, so userData/.updaterId is never
 * written. This reaches into a member that is not part of the library's public API, which is
 * why it only acts when the member looks as it does in 6.8.9 and says so when it does not; the
 * two public measures below do not depend on it.
 */
export function withoutStagingId(updater: AppUpdater): boolean {
  const lazy = (updater as unknown as { stagingUserIdPromise?: unknown }).stagingUserIdPromise
  if (typeof lazy !== 'object' || lazy === null || !('value' in lazy)) return false
  try {
    // A lazy value that is assigned before it is first read never runs its own creator.
    ;(lazy as { value: unknown }).value = Promise.resolve(NO_STAGING_ID)
    return true
  } catch {
    return false
  }
}

/** The headers Pelagix asks the library to put on every request. */
export function requestHeaders(userAgent: string): Record<string, string> {
  return {
    // Spelled exactly like this: the library adds "User-Agent: electron-builder" unless this very key is set.
    'User-Agent': userAgent,
    // Otherwise the system language is sent.
    'Accept-Language': 'en',
    // The library merges these over its own headers, so this replaces the id it would send.
    [STAGING_ID_HEADER]: NO_STAGING_ID
  }
}

/** What actually leaves the machine for a request with `headers`. */
export function outgoingHeaders(headers: Readonly<Record<string, string>>, userAgent: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase()
    if (lower === STAGING_ID_HEADER || lower === 'cookie' || lower === 'user-agent' || lower === 'accept-language') continue
    out[name] = value
  }
  out['User-Agent'] = userAgent
  out['Accept-Language'] = 'en'
  return out
}

/**
 * The last word on what the library sends. Its requests go through a session of their own, and
 * this rewrites the headers of every one of them just before it leaves: checks, downloads and
 * the redirects in between, whatever the library itself put on them.
 */
export function filterRequests(session: Pick<Session, 'webRequest'>, userAgent: string): void {
  session.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({ requestHeaders: outgoingHeaders(details.requestHeaders, userAgent) })
  })
}

/** Everything about the library's behaviour that does not need a running Electron. */
export function applyOptions(updater: AppUpdater, options: UpdaterOptions): void {
  // Nothing is downloaded without a click...
  updater.autoDownload = false
  // ...and nothing is installed without one. The default would run the installer silently
  // whenever the app quits after a download, on a portable copy too.
  updater.autoInstallOnAppQuit = false
  updater.autoRunAppAfterInstall = true
  updater.allowPrerelease = false
  updater.allowDowngrade = false
  updater.disableWebInstaller = true
  // The notes come from GitHub's API as Markdown (update-releases.ts). This would collect the
  // rendered HTML of GitHub's feed instead, which is never shown.
  updater.fullChangelog = false
  updater.logger = options.logger
  updater.requestHeaders = requestHeaders(options.userAgent)
  if (!withoutStagingId(updater)) options.logger.warn('the updater keeps its id differently now; it is still removed from every request')
  // An emitter throws when an 'error' has no listener. The rejected promises carry the same
  // error, so this one has nothing to do but exist.
  updater.on('error', () => {})
}

/**
 * The few things the update service does with the library, on an updater that is already set up.
 * Kept apart from `loadUpdater` so that it runs against the real library without Electron.
 */
export function driveUpdater(updater: AppUpdater, newToken: () => CancellationToken): Updater {
  return {
    check: () => updater.checkForUpdates(),
    download() {
      // A token of its own for every download. While one is running the library ignores it and
      // answers with that download; the update service allows for that.
      const token = newToken()
      return { done: updater.downloadUpdate(token), cancel: () => token.cancel() }
    },
    install() {
      // Only one failure is reported inside the call, as an 'error' event: nothing has been
      // downloaded. Whether Windows agrees to run the installer is found out after the call has
      // returned, and the library quits the app either way.
      let failed = false
      const onError = (): void => {
        failed = true
      }
      updater.on('error', onError)
      try {
        // (isSilent, isForceRunAfter): no wizard, the same folder, and the app reopens by itself.
        // Not silent, the installer would open on "who is this for" and wait for an answer.
        updater.quitAndInstall(true, true)
      } finally {
        updater.removeListener('error', onError)
      }
      return !failed
    },
    onProgress(listener) {
      updater.on('download-progress', listener)
    }
  }
}

/** Loads the library, sets it up, and returns the few things the update service does with it. */
export async function loadUpdater(options: UpdaterOptions): Promise<Updater> {
  const lib = await import('electron-updater')
  // Reading `autoUpdater` is what creates the updater; it happens here and nowhere else.
  const updater = lib.autoUpdater
  applyOptions(updater, options)
  filterRequests(updater.netSession, options.userAgent)
  return driveUpdater(updater, () => new lib.CancellationToken())
}
