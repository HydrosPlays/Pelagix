/**
 * Starts the built app (out/) for a capture run and wraps the page in the helpers the shots use.
 *
 * What is real: the Electron main process, the preload bridge, the sprite:// protocol, the save
 * file on disk, the window with its title-bar overlay. What the run controls from outside:
 *
 *   - the user-data folder (a scratch folder under the OS temp folder, never the real one);
 *   - the window's size and position (main-hook.cjs and the app's own window.json);
 *   - the display scale (--force-device-scale-factor=1);
 *   - the page's clock, pinned to the demo save's "today" so dates, streaks and the greeting
 *     come out the same on every run.
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connect, sleep } from './cdp.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(HERE, '../..')
export const WIDTH = 1440
export const HEIGHT = 900
/** Scratch profile. Only sprite-cache/ survives between runs (it is a pure download cache). */
export const USER_DATA = join(tmpdir(), 'pelagix-screenshots', 'user-data')

const freePort = () =>
  new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolvePort(port))
    })
  })

/** Empties the scratch profile, keeping the downloaded sprites unless `fresh`. */
export function resetUserData({ fresh = false } = {}) {
  mkdirSync(USER_DATA, { recursive: true })
  for (const name of readdirSync(USER_DATA)) {
    if (name === 'sprite-cache' && !fresh) continue
    rmSync(join(USER_DATA, name), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
}

/**
 * Replaces the page's Date with one that runs `offsetMs` ahead of (or behind) the real clock.
 * Timers and animation frames are untouched, so everything still moves at normal speed.
 */
const pinnedClockScript = (offsetMs) => `(() => {
  const RealDate = Date
  const offset = ${Math.round(offsetMs)}
  function PinnedDate(...args) {
    if (!new.target) return new PinnedDate().toString()
    return Reflect.construct(RealDate, args.length === 0 ? [RealDate.now() + offset] : args, new.target)
  }
  PinnedDate.prototype = RealDate.prototype
  PinnedDate.now = () => RealDate.now() + offset
  PinnedDate.parse = RealDate.parse
  PinnedDate.UTC = RealDate.UTC
  globalThis.Date = PinnedDate
})()`

/**
 * Launches the app on `save` with the page clock pinned to `clock` (a local date and time).
 * Resolves once the shell is on screen with the save loaded.
 */
export async function launchApp({ save, clock, theme = 'dark', visible = false, log = () => {} }) {
  if (!existsSync(join(ROOT, 'out/main/index.js')) || !existsSync(join(ROOT, 'out/renderer/index.html'))) {
    throw new Error('out/ is missing. Run "npx electron-vite build" first (npm run screenshots does it for you).')
  }
  const require = createRequire(join(ROOT, 'package.json'))
  const electron = require('electron') // path of the Electron binary

  // The app restores its window from window.json; this is how it is given its size and theme.
  writeFileSync(join(USER_DATA, 'window.json'), JSON.stringify({ bounds: { x: 80, y: 60, width: WIDTH, height: HEIGHT }, maximized: false, theme }))
  // The first start is on an empty save, but one that already has its language (the demo save's),
  // so the "choose your language" pop-up never comes up in a capture run.
  writeFileSync(join(USER_DATA, 'save.json'), JSON.stringify({ ...save, entries: [], achievements: {} }))

  const port = await freePort()
  const env = { ...process.env, PELAGIX_SHOT_WIDTH: String(WIDTH), PELAGIX_SHOT_HEIGHT: String(HEIGHT), PELAGIX_SHOT_VISIBLE: visible ? '1' : '0' }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  delete env.PELAGIX_SMOKE // the app's own boot test would quit it after a second and a half
  const child = spawn(
    electron,
    [
      '-r',
      join(HERE, 'main-hook.cjs'),
      ROOT,
      `--user-data-dir=${USER_DATA}`,
      `--remote-debugging-port=${port}`,
      '--force-device-scale-factor=1',
      // The window is parked off screen and never focused; it must keep drawing at full rate anyway.
      '--disable-features=CalculateNativeWinOcclusion',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling'
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], env }
  )
  let mainLog = ''
  child.stdout.on('data', (d) => (mainLog += d))
  child.stderr.on('data', (d) => (mainLog += d))

  let page
  const quit = async () => {
    if (page) {
      await Promise.race([page.send('Browser.close').catch(() => {}), sleep(2000)])
      page.close()
    }
    for (let i = 0; i < 50 && child.exitCode === null; i++) await sleep(100)
    if (child.exitCode === null) child.kill()
    for (let i = 0; i < 30 && child.exitCode === null; i++) await sleep(100)
    return child.exitCode
  }

  try {
    page = await connect(port, { alive: () => child.exitCode === null })

    // The app has started on an empty save. Pin the clock for every later document, put the
    // demo save where the app keeps its save, and load the page again: this second load is the
    // app's real first run on that save (it validates every entry and checks the achievements).
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: pinnedClockScript(clock.getTime() - Date.now()) })
    await page.send('Emulation.setFocusEmulationEnabled', { enabled: true })
    await page.waitFor(`return document.readyState === 'complete' && !!document.querySelector('.shell')`, { timeoutMs: 20_000 })
    writeFileSync(join(USER_DATA, 'save.json'), JSON.stringify(save))
    const reloaded = page.once('Page.loadEventFired')
    await page.send('Page.reload', { ignoreCache: false })
    await Promise.race([reloaded, sleep(20_000)])
    const ready = await page.waitFor(
      `return document.readyState === 'complete' && !!document.querySelector('.shell') && !document.querySelector('.boot') && !!document.querySelector('.shell-rail__count')`,
      { timeoutMs: 30_000 }
    )
    if (!ready) throw new Error('The app did not finish loading.')

    const metrics = await page.evaluate(`return {
      width: innerWidth, height: innerHeight, dpr: devicePixelRatio, api: typeof window.api,
      href: location.href, overlay: navigator.windowControlsOverlay?.visible === true,
      today: new Date().toString(), flag: document.querySelector('.shell-topbar__flag')?.innerText.trim() ?? null
    }`)
    log(`app up: ${metrics.width}x${metrics.height} @${metrics.dpr}x, clock ${metrics.today}`)
    if (metrics.width !== WIDTH || metrics.height !== HEIGHT || metrics.dpr !== 1) {
      throw new Error(`The window is ${metrics.width}x${metrics.height} at ${metrics.dpr}x; ${WIDTH}x${HEIGHT} at 1x is required. Is every display smaller than that?`)
    }
    if (metrics.api !== 'object' || !metrics.href.startsWith('file:')) throw new Error('This is not the packaged page: window.api is missing.')
    if (metrics.flag !== null) throw new Error(`The app started with a warning in its title bar: "${metrics.flag}".`)
  } catch (err) {
    await quit()
    throw new Error(`${err.message}\n--- Electron output ---\n${mainLog.trim().split(/\r?\n/).slice(-15).join('\n')}`)
  }

  return { page, quit, mainLog: () => mainLog }
}
