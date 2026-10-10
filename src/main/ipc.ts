/** IPC handlers behind `window.api`. Everything that arrives from the renderer is validated here. */

import { app, dialog, ipcMain, shell, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import type { PelagixChannel, PelagixEventChannel, PelagixEvents, PelagixIpc } from '@shared/api'
import type { SaveFile, ThemeId } from '@shared/save-types'
import { exportFileName, isPlainObject, readImportFile, writeExportFile, type SaveStore } from './save'
import { clearSpriteCache, spriteCacheInfo } from './sprites'
import type { UpdateService } from './update-service'
import { plainVersion } from './update-version'
import { applyTheme, isAppUrl } from './window'

const JSON_FILTERS = [
  { name: 'Pelagix save', extensions: ['json'] },
  { name: 'All files', extensions: ['*'] }
]
const MAX_URL_LENGTH = 2048

type Result<K extends PelagixChannel> = PelagixIpc[K]['result']

function invalid(method: string, what: string): never {
  throw new TypeError(`${method}: ${what}`)
}

function expectNoArgs(method: string, args: unknown[]): void {
  if (args.length !== 0) invalid(method, 'takes no arguments')
}

/** Checks the top-level shape of a save; entry-level validation is the renderer's job. */
function expectSave(method: string, args: unknown[]): SaveFile {
  const save = args[0]
  if (args.length !== 1 || !isPlainObject(save)) invalid(method, 'expected one save object')
  const { version, entries, settings, achievements, createdAt, updatedAt } = save
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    invalid(method, 'save.version must be a positive integer')
  }
  if (!Array.isArray(entries) || !entries.every(isPlainObject)) invalid(method, 'save.entries must be an array of objects')
  if (!isPlainObject(settings)) invalid(method, 'save.settings must be an object')
  if (!isPlainObject(achievements)) invalid(method, 'save.achievements must be an object')
  if (typeof createdAt !== 'string' || typeof updatedAt !== 'string') {
    invalid(method, 'save.createdAt and save.updatedAt must be strings')
  }
  return save as unknown as SaveFile
}

function expectHttpsUrl(args: unknown[]): string {
  const raw = args[0]
  if (args.length !== 1 || typeof raw !== 'string' || raw.length > MAX_URL_LENGTH) {
    invalid('openExternal', 'expected one URL string')
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    invalid('openExternal', 'not a valid URL')
  }
  if (url.protocol !== 'https:') invalid('openExternal', 'only https URLs can be opened')
  return url.href
}

function expectTheme(args: unknown[]): ThemeId {
  const theme = args[0]
  if (args.length !== 1 || (theme !== 'dark' && theme !== 'light')) {
    invalid('setTheme', 'theme must be "dark" or "light"')
  }
  return theme
}

function expectBoolean(method: string, args: unknown[]): boolean {
  const value = args[0]
  if (args.length !== 1 || typeof value !== 'boolean') invalid(method, 'expected one boolean')
  return value
}

/** A version such as "0.2.0". Returned without a leading "v", the way the update state writes it. */
function expectVersion(method: string, args: unknown[]): string {
  const version = args.length === 1 ? plainVersion(args[0]) : null
  if (version === null) invalid(method, 'expected one version string')
  return version
}

/**
 * Sends a message to the app's own page in the main window, and to nothing else. The window is
 * looked up on every call because it can be closed and opened again. A message for a page that
 * is not there yet is simply lost, which is why the page asks for the current state first.
 */
export function pushToPage<K extends PelagixEventChannel>(getWindow: () => BrowserWindow | null, channel: K, ...args: PelagixEvents[K]): void {
  const win = getWindow()
  if (!win || win.isDestroyed()) return
  const contents = win.webContents
  try {
    if (contents.isDestroyed() || !isAppUrl(contents.mainFrame.url)) return
    contents.send(channel, ...args)
  } catch {
    // The page went away between the check and the send.
  }
}

export function registerIpc(getWindow: () => BrowserWindow | null, store: SaveStore, updates: UpdateService): void {
  /** Only the app's own page in the main window may talk to these handlers. */
  function requireWindow(event: IpcMainInvokeEvent): BrowserWindow {
    const win = getWindow()
    const frame = event.senderFrame
    if (!win || win.isDestroyed() || event.sender !== win.webContents || !frame || frame !== win.webContents.mainFrame || !isAppUrl(frame.url)) {
      throw new Error('IPC call from an untrusted sender')
    }
    return win
  }

  function handle<K extends PelagixChannel>(
    channel: K,
    handler: (args: unknown[], win: BrowserWindow) => Promise<Result<K>> | Result<K>
  ): void {
    ipcMain.handle(channel, async (event, ...args: unknown[]) => handler(args, requireWindow(event)))
  }

  handle('pelagix:save-load', (args) => {
    expectNoArgs('loadSave', args)
    return store.load()
  })

  handle('pelagix:save-write', (args) => store.write(expectSave('writeSave', args)))

  handle('pelagix:save-export', async (args, win) => {
    const save = expectSave('exportSave', args)
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Export Pelagix save',
      defaultPath: join(app.getPath('documents'), exportFileName(new Date())),
      filters: JSON_FILTERS
    })
    if (canceled || !filePath) return { canceled: true }
    await writeExportFile(filePath, save)
    return { canceled: false, path: filePath }
  })

  handle('pelagix:save-import', async (args, win) => {
    expectNoArgs('importSave', args)
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Import Pelagix save',
      properties: ['openFile'],
      filters: JSON_FILTERS
    })
    const path = filePaths[0]
    if (canceled || path === undefined) return null
    return readImportFile(path)
  })

  handle('pelagix:sprite-cache-info', (args) => {
    expectNoArgs('spriteCacheInfo', args)
    return spriteCacheInfo()
  })

  handle('pelagix:sprite-cache-clear', (args) => {
    expectNoArgs('clearSpriteCache', args)
    return clearSpriteCache()
  })

  handle('pelagix:app-info', (args) => {
    expectNoArgs('appInfo', args)
    return {
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      userData: app.getPath('userData')
    }
  })

  handle('pelagix:open-external', (args) => shell.openExternal(expectHttpsUrl(args)))

  handle('pelagix:set-theme', (args, win) => applyTheme(win, expectTheme(args)))

  handle('pelagix:update-state', (args) => {
    expectNoArgs('updateState', args)
    return updates.state()
  })

  handle('pelagix:update-check', (args) => {
    expectNoArgs('checkForUpdates', args)
    return updates.check()
  })

  handle('pelagix:update-download', (args) => {
    expectNoArgs('downloadUpdate', args)
    return updates.download()
  })

  handle('pelagix:update-cancel', (args) => {
    expectNoArgs('cancelUpdateDownload', args)
    return updates.cancelDownload()
  })

  handle('pelagix:update-install', (args) => {
    expectNoArgs('installUpdate', args)
    return updates.install()
  })

  handle('pelagix:update-set-auto-check', (args) => updates.setAutoCheck(expectBoolean('setUpdateAutoCheck', args)))

  handle('pelagix:update-announced', (args) => updates.markAnnounced(expectVersion('markUpdateAnnounced', args)))

  handle('pelagix:update-whats-new-seen', (args) => {
    expectNoArgs('dismissWhatsNew', args)
    return updates.dismissWhatsNew()
  })
}
