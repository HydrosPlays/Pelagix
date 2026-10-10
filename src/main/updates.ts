/**
 * In-app updates, wired to Electron: which kind of copy this is, the real updater library, the
 * real network and the files in the user-data folder. The behaviour itself is in
 * update-service.ts and update-model.ts.
 *
 *   userData/updates.json   per-computer update state (update-store.ts)
 *   userData/updates.log    the updater's log
 */

import { app, net } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { UpdateState } from '@shared/api'
import { REPO_SLUG } from '@shared/repo'
import type { SaveStore } from './save'
import { detectUpdateMode, uninstallerPath } from './update-model'
import { fetchReleaseList, releasesApiUrl, userAgent } from './update-releases'
import { createUpdateService, type UpdateService } from './update-service'
import { createUpdateLog, createUpdateStore, UPDATES_FILE, UPDATES_LOG_FILE } from './update-store'
import { loadUpdater } from './updater'

/**
 * Creates the update service. Nothing slow happens here: the library is not loaded and
 * updates.json is not read until later. The one thing that cannot wait is looking whether
 * updates.json and save.json exist, because that tells a fresh install from an upgrade and has
 * to be known before the page writes its first save. So call this before the page can run.
 */
export function createUpdates(saves: SaveStore, onState: (state: UpdateState) => void): UpdateService {
  const userData = app.getPath('userData')
  const version = app.getVersion()
  const packagedOnWindows = process.platform === 'win32' && app.isPackaged
  const mode = detectUpdateMode({
    platform: process.platform,
    isPackaged: app.isPackaged,
    env: process.env,
    hasUninstaller: packagedOnWindows && existsSync(uninstallerPath(process.execPath))
  })
  const active = mode !== 'off'
  // Neither of these touches the disk until it is used, and in mode `off` neither ever is.
  const log = createUpdateLog(join(userData, UPDATES_LOG_FILE))
  const store = createUpdateStore(userData, { log: (message, err) => log.warn(err === undefined ? message : `${message}: ${String(err)}`) })

  return createUpdateService({
    mode,
    currentVersion: version,
    hadUpdatesFile: active && existsSync(join(userData, UPDATES_FILE)),
    hadSaveFile: active && existsSync(saves.file),
    store,
    log,
    loadUpdater: () => loadUpdater({ userAgent: userAgent(version), logger: log }),
    fetchReleases: () => fetchReleaseList({ fetch: (url, init) => net.fetch(url, init), url: releasesApiUrl(REPO_SLUG), appVersion: version }),
    saveIdle: () => saves.idle(),
    fileExists: existsSync,
    onState
  })
}
