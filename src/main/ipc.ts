/** IPC handlers behind `window.api`. Everything that arrives from the renderer is validated here. */

import { app, dialog, ipcMain, shell, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import type { PelagixChannel, PelagixIpc } from '@shared/api'
import type { SaveFile, ThemeId } from '@shared/save-types'
import { exportFileName, isPlainObject, readImportFile, writeExportFile, type SaveStore } from './save'
import { clearSpriteCache, spriteCacheInfo } from './sprites'
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

export function registerIpc(getWindow: () => BrowserWindow | null, store: SaveStore): void {
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
}
