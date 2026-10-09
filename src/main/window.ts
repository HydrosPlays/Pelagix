/** The single application window: creation, remembered bounds, navigation lock-down, theming. */

import { app, BrowserWindow, screen, shell, type Rectangle } from 'electron'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ThemeId } from '@shared/save-types'
import iconIco from '../../build/icon.ico?asset'
import iconPng from '../renderer/public/icon.png?asset'

const DEFAULT_WIDTH = 1360
const DEFAULT_HEIGHT = 860
const MIN_WIDTH = 1040
const MIN_HEIGHT = 680
const TITLE_BAR_HEIGHT = 40
/** Chromium's code for a navigation that was cancelled on purpose (for example by will-navigate). */
const ERR_ABORTED = -3

/** Native colours per theme: window background and the min / max / close glyphs drawn over the page. */
const CHROME: Record<ThemeId, { background: string; symbol: string }> = {
  dark: { background: '#060c18', symbol: '#e6efff' },
  light: { background: '#eef3fb', symbol: '#0b1830' }
}

interface WindowState {
  bounds: Rectangle | null
  maximized: boolean
  theme: ThemeId
}

const stateFile = (): string => join(app.getPath('userData'), 'window.json')
const rendererFile = join(__dirname, '../renderer/index.html')
const devServerUrl = !app.isPackaged ? process.env['ELECTRON_RENDERER_URL'] : undefined

let state: WindowState = { bounds: null, maximized: false, theme: 'dark' }
let saveTimer: NodeJS.Timeout | null = null

const isThemeId = (value: unknown): value is ThemeId => value === 'dark' || value === 'light'

const isInt = (value: unknown): value is number => Number.isInteger(value)

function parseBounds(value: unknown): Rectangle | null {
  if (typeof value !== 'object' || value === null) return null
  const { x, y, width, height } = value as Record<string, unknown>
  return isInt(x) && isInt(y) && isInt(width) && isInt(height) ? { x, y, width, height } : null
}

function readState(): WindowState {
  const fallback: WindowState = { bounds: null, maximized: false, theme: 'dark' }
  try {
    const raw: unknown = JSON.parse(readFileSync(stateFile(), 'utf8'))
    if (typeof raw !== 'object' || raw === null) return fallback
    const { bounds, maximized, theme } = raw as Record<string, unknown>
    return { bounds: parseBounds(bounds), maximized: maximized === true, theme: isThemeId(theme) ? theme : 'dark' }
  } catch {
    return fallback // first run, or an unreadable file: start with defaults
  }
}

function writeState(): void {
  try {
    const file = stateFile()
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(`${file}.tmp`, JSON.stringify(state))
    renameSync(`${file}.tmp`, file)
  } catch (err) {
    console.warn('[window] could not save window state', err)
  }
}

type InitialBounds = Partial<Rectangle> & { width: number; height: number }

/** Remembered bounds if they still land on a connected display, else centred defaults. */
function initialBounds(saved: Rectangle | null): InitialBounds {
  if (saved) {
    const area = screen.getDisplayMatching(saved).workArea
    const width = Math.min(Math.max(saved.width, MIN_WIDTH), area.width)
    const height = Math.min(Math.max(saved.height, MIN_HEIGHT), area.height)
    const visibleX = Math.min(saved.x + width, area.x + area.width) - Math.max(saved.x, area.x)
    const titleBarOnScreen = saved.y >= area.y - 8 && saved.y <= area.y + area.height - TITLE_BAR_HEIGHT
    if (visibleX >= 160 && titleBarOnScreen) return { x: saved.x, y: saved.y, width, height }
  }
  const area = screen.getPrimaryDisplay().workArea
  return { width: Math.min(DEFAULT_WIDTH, area.width), height: Math.min(DEFAULT_HEIGHT, area.height) }
}

/** True for the app's own page: the dev server in development, the bundled index.html otherwise. */
export function isAppUrl(rawUrl: string): boolean {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return false
  }
  if (devServerUrl) return url.origin === new URL(devServerUrl).origin
  if (url.protocol !== 'file:') return false
  try {
    const a = resolve(fileURLToPath(url))
    const b = resolve(rendererFile)
    return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
  } catch {
    return false
  }
}

export function openExternalHttps(rawUrl: string): boolean {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  void shell.openExternal(url.href)
  return true
}

/**
 * On fractional display scales Windows hands back a hidden-title-bar window a few DIPs larger
 * than asked for, so storing the reported bounds as they are makes the window grow on every
 * launch. The offset measured at creation is taken off again before the bounds are stored.
 */
function measureInflation(requested: InitialBounds, actual: Rectangle): Rectangle {
  const small = (delta: number): number => (Math.abs(delta) <= 8 ? delta : 0)
  return {
    x: requested.x === undefined ? 0 : small(actual.x - requested.x),
    y: requested.y === undefined ? 0 : small(actual.y - requested.y),
    width: small(actual.width - requested.width),
    height: small(actual.height - requested.height)
  }
}

/** Starts recording bounds and maximised state. Call once the window is on screen in its restored state. */
function trackState(win: BrowserWindow, inflation: Rectangle): void {
  const capture = (): void => {
    if (win.isDestroyed()) return
    const b = win.getNormalBounds()
    state = {
      ...state,
      bounds: { x: b.x - inflation.x, y: b.y - inflation.y, width: b.width - inflation.width, height: b.height - inflation.height },
      maximized: win.isMaximized()
    }
  }
  const schedule = (): void => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      capture()
      writeState()
    }, 500)
  }
  win.on('resize', schedule)
  win.on('move', schedule)
  win.on('maximize', schedule)
  win.on('unmaximize', schedule)
  win.on('close', () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = null
    capture()
    writeState()
  })
}

function lockDownNavigation(win: BrowserWindow): void {
  const contents = win.webContents
  // No child windows: links that ask for one go to the system browser instead.
  contents.setWindowOpenHandler(({ url }) => {
    openExternalHttps(url)
    return { action: 'deny' }
  })
  // The app is a single page with hash routing; anything else (dropped files included) is blocked.
  contents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return
    event.preventDefault()
    openExternalHttps(url)
  })
  contents.on('will-attach-webview', (event) => event.preventDefault())
}

export function createMainWindow(): BrowserWindow {
  state = readState()
  const chrome = CHROME[state.theme]
  const bounds = initialBounds(state.bounds)
  const win = new BrowserWindow({
    ...bounds,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    title: 'Pelagix',
    icon: process.platform === 'win32' ? iconIco : iconPng,
    backgroundColor: chrome.background,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: chrome.symbol, height: TITLE_BAR_HEIGHT },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false
    }
  })

  const inflation = measureInflation(bounds, win.getNormalBounds())
  const startMaximized = state.maximized
  const reveal = (): void => {
    if (win.isDestroyed() || win.isVisible()) return
    if (startMaximized) win.maximize()
    win.show()
    // Only from here on: bounds seen before the window is restored would overwrite the remembered state.
    trackState(win, inflation)
  }
  win.once('ready-to-show', reveal)
  // Never leave an invisible process behind if the page cannot load.
  win.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === ERR_ABORTED) return
    console.error(`[window] failed to load ${url}: ${code} ${description}`)
    reveal()
  })

  lockDownNavigation(win)

  // Failures are reported through did-fail-load above.
  const loading = devServerUrl ? win.loadURL(devServerUrl) : win.loadFile(rendererFile)
  loading.catch(() => {})
  return win
}

export function applyTheme(win: BrowserWindow, theme: ThemeId): void {
  const chrome = CHROME[theme]
  win.setBackgroundColor(chrome.background)
  // macOS draws its own traffic lights; the overlay only exists on Windows and Linux.
  if (process.platform !== 'darwin') {
    win.setTitleBarOverlay({ color: '#00000000', symbolColor: chrome.symbol, height: TITLE_BAR_HEIGHT })
  }
  if (state.theme === theme) return
  // Remembered so the next launch paints the right colours before the page has loaded.
  state = { ...state, theme }
  writeState()
}
