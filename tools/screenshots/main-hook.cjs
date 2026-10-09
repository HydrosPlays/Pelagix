/**
 * Loaded into the Electron main process by run.mjs (`electron -r main-hook.cjs <app>`), before
 * the app's own code. It changes nothing about the app itself; it only keeps the capture window
 * out of the way and at a fixed size:
 *
 *   - the window is shown without taking keyboard focus, so a capture run never steals what you
 *     are typing elsewhere;
 *   - it is parked outside every display, so the real mouse pointer can never hover it;
 *   - its content area is held at exactly WIDTH x HEIGHT.
 *
 * The page is still a normal, visible, composited window: the title-bar overlay, the preload
 * bridge and the sprite:// protocol are the shipped ones.
 */

const { app, screen } = require('electron')

const WIDTH = Number(process.env.PELAGIX_SHOT_WIDTH) || 1440
const HEIGHT = Number(process.env.PELAGIX_SHOT_HEIGHT) || 900
const ON_SCREEN = process.env.PELAGIX_SHOT_VISIBLE === '1'

/** A point below and left of every connected display. */
function parkingSpot() {
  let left = 0
  let bottom = 0
  for (const display of screen.getAllDisplays()) {
    left = Math.min(left, display.bounds.x)
    bottom = Math.max(bottom, display.bounds.y + display.bounds.height)
  }
  return { x: left, y: bottom + 200 }
}

app.on('browser-window-created', (_event, win) => {
  const place = () => {
    if (win.isDestroyed()) return
    const [w, h] = win.getContentSize()
    if (w !== WIDTH || h !== HEIGHT) win.setContentSize(WIDTH, HEIGHT)
    if (ON_SCREEN) return
    const spot = parkingSpot()
    const [x, y] = win.getPosition()
    if (x !== spot.x || y !== spot.y) win.setPosition(spot.x, spot.y)
  }

  // The app reveals its window with show(); the inactive variant does the same without focus.
  win.show = () => {
    place()
    win.showInactive()
    place()
  }
  win.maximize = () => {}
  win.once('ready-to-show', () => setTimeout(place, 50))
  win.webContents.once('did-finish-load', place)
})
