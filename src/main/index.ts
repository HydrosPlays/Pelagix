import { app, Menu, protocol, session, type BrowserWindow } from 'electron'
import { registerIpc } from './ipc'
import { createSaveStore } from './save'
import { SPRITE_SCHEME } from './sprite-request'
import { registerSpriteProtocol } from './sprites'
import { createMainWindow } from './window'

/** The page needs nothing beyond copying text; every other permission request is refused. */
const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write'])

// Must run before 'ready', exactly once, with every custom scheme in this one call.
protocol.registerSchemesAsPrivileged([
  { scheme: SPRITE_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
])

let mainWindow: BrowserWindow | null = null

function openMainWindow(): void {
  const win = createMainWindow()
  mainWindow = win
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

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
  registerIpc(() => mainWindow, store)
  openMainWindow()

  app.on('activate', () => {
    if (!mainWindow) openMainWindow()
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
  // Let a save that is still being written reach the disk before the process goes away.
  app.on('before-quit', (event) => {
    if (!store.busy) return
    event.preventDefault()
    void store.idle().then(() => app.quit())
  })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', focusMainWindow)
  void app.whenReady().then(start)
}
