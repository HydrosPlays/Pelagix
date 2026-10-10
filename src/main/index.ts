import { app, Menu, protocol, session, type BrowserWindow } from 'electron'
import { pushToPage, registerIpc } from './ipc'
import { createSaveStore } from './save'
import { SPRITE_SCHEME } from './sprite-request'
import { registerSpriteProtocol } from './sprites'
import type { UpdateService } from './update-service'
import { createUpdates } from './updates'
import { createMainWindow } from './window'

/** The page needs nothing beyond copying text; every other permission request is refused. */
const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write'])

// Must run before 'ready', exactly once, with every custom scheme in this one call.
protocol.registerSchemesAsPrivileged([
  { scheme: SPRITE_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
])

let mainWindow: BrowserWindow | null = null
let updates: UpdateService | null = null

function openMainWindow(): void {
  const win = createMainWindow()
  mainWindow = win
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
  // Update checks wait for the page, so they never compete with start-up.
  win.webContents.once('did-finish-load', () => updates?.start())

  // The one test hook: lets a script confirm the built app boots, then exits on its own.
  if (process.env['PELAGIX_SMOKE'] === '1') {
    win.webContents.once('did-finish-load', () => {
      console.log(`SMOKE_OK ${win.webContents.getTitle()}`)
      setTimeout(() => app.quit(), 1500)
    })
  }
}

function focusMainWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function start(): void {
  if (process.platform === 'win32') app.setAppUserModelId('com.pelagix.app')
  // The default menu only carries developer accelerators; macOS still needs it for Edit shortcuts.
  if (app.isPackaged && process.platform !== 'darwin') Menu.setApplicationMenu(null)

  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission))
  })
  session.defaultSession.setPermissionCheckHandler((_contents, permission) => ALLOWED_PERMISSIONS.has(permission))

  const store = createSaveStore(app.getPath('userData'))
  registerSpriteProtocol()
  openMainWindow()
  // After the window, so that nothing here holds it up, and before the page can run: it has not
  // asked for anything yet, and it has not written a first save, which is how the update service
  // tells a fresh install from an upgrade.
  updates = createUpdates(store, (state) => pushToPage(() => mainWindow, 'pelagix:update-changed', state))
  registerIpc(() => mainWindow, store, updates)

  app.on('activate', () => {
    if (!mainWindow) openMainWindow()
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
  // Let a save that is still being written reach the disk before the process goes away. The same
  // goes for what the updater keeps: the last lines of its log are the ones about an install, and
  // they are written a moment before the quit that the install itself asks for.
  app.on('before-quit', (event) => {
    if (!store.busy && !updates?.busy) return
    event.preventDefault()
    void Promise.all([store.idle(), updates?.idle()]).then(() => app.quit())
  })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', focusMainWindow)
  void app.whenReady().then(start)
}
