/**
 * Takes the README screenshots from the real, built application.
 *
 *   npm run screenshots                     build, then capture everything into docs/screenshots
 *   npm run screenshots -- --only 04,05     only the shots whose file name starts with 04 or 05
 *   npm run screenshots -- --no-build       reuse out/ as it is
 *   npm run screenshots -- --fresh          also throw away the downloaded sprites first
 *   npm run screenshots -- --visible        leave the window on screen (to watch a run)
 *   npm run screenshots -- --out <folder>   write somewhere else
 *
 * See README.md in this folder.
 */

import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { HEIGHT, launchApp, resetUserData, ROOT, USER_DATA, WIDTH } from './app.mjs'
import { DEMO_TODAY, demoSave, describeDemoSave } from './demo-save.mjs'
import { optimizePng, pngSize } from './png.mjs'
import { SHOTS } from './shots.mjs'
import { createStage } from './stage.mjs'

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const option = (name) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined)

const outDir = resolve(option('out') ?? join(ROOT, 'docs/screenshots'))
const only = option('only')?.split(',').map((s) => s.trim()).filter(Boolean)
const wanted = SHOTS.filter((shot) => !only || only.some((prefix) => shot.file.startsWith(prefix)))
if (wanted.length === 0) {
  console.error(`No shot matches --only ${option('only')}. Shots: ${SHOTS.map((s) => s.file).join(', ')}`)
  process.exit(1)
}

const started = Date.now()
const log = (message) => console.log(message)

if (!flag('no-build')) {
  log('Building the app (electron-vite build) ...')
  const require = createRequire(join(ROOT, 'package.json'))
  const pkgPath = require.resolve('electron-vite/package.json')
  const bin = join(dirname(pkgPath), require(pkgPath).bin['electron-vite'])
  const built = spawnSync(process.execPath, [bin, 'build'], { cwd: ROOT, encoding: 'utf8' })
  if (built.status !== 0) {
    console.error(built.stdout, built.stderr)
    process.exit(1)
  }
}

const save = await demoSave()
const facts = describeDemoSave(save)
log(`Demo save: ${facts.entries} entries, ${facts.species} species, ${facts.games} games, ${facts.shiny} shiny, ${facts.firstDay} to ${facts.lastDay}, ${Object.keys(save.achievements).length} achievements unlocked along the way`)

// 19:30 on the demo's "today", local time: the evening after the last catch of the save.
const [year, month, day] = DEMO_TODAY.split('-').map(Number)
const clock = new Date(year, month - 1, day, 19, 30, 0)

mkdirSync(outDir, { recursive: true })
resetUserData({ fresh: flag('fresh') })
log(`Scratch profile: ${USER_DATA}`)

const app = await launchApp({ save, clock, visible: flag('visible'), log })
const stage = createStage(app.page, { log })
const results = []
let failed = false
try {
  // First run on this save. The app checks it about a second after arriving and should have
  // nothing to say: an entry it had to repair or drop is reported in a notification, and so is an
  // achievement the collection has earned that the save does not record (unlock-history.mjs
  // replays the collection through the app's own engine, so the two agree).
  const said = await app.page.waitFor(`const t = document.querySelector('.ui-toast'); return t ? t.innerText.split(String.fromCharCode(10)).join(' / ') : null`, { timeoutMs: 4000 })
  if (said) throw new Error(`The app did not take the demo save as it is. It says: ${said}`)

  // The Achievements page marks what was unlocked since it was last opened as new. These medals
  // arrived over a year, so the page is opened once before any picture is taken.
  await stage.goto('/achievements')
  if (!(await app.page.waitFor(`return !!document.querySelector('.ach-card')`, { timeoutMs: 10_000 }))) throw new Error('The Achievements page did not open.')
  await stage.sleep(800)

  // Every entry kept: the Journal counts what the app holds in memory.
  await stage.goto('/journal')
  const counted = await app.page.waitFor(`const n = Number((document.querySelector('.journal-summary .journal-stat__value .u-sr-only')?.textContent ?? '').split(',').join('')); return n === args.want ? n : null`, { args: { want: save.entries.length }, timeoutMs: 10_000 })
  if (counted !== save.entries.length) throw new Error(`The app did not accept every entry of the demo save: the Journal does not count ${save.entries.length}.`)
  log(`First load: nothing repaired, nothing newly unlocked, ${counted} of ${save.entries.length} entries in the Journal`)

  for (const shot of wanted) {
    const t0 = Date.now()
    try {
      const png = optimizePng(await shot.take(stage))
      const { width, height } = pngSize(png)
      if (width !== WIDTH || height !== HEIGHT) throw new Error(`captured ${width}x${height}, expected ${WIDTH}x${HEIGHT}`)
      writeFileSync(join(outDir, shot.file), png)
      results.push({ file: shot.file, bytes: png.length, ms: Date.now() - t0 })
      log(`${shot.file}  ${(png.length / 1024).toFixed(0)} kB  ${((Date.now() - t0) / 1000).toFixed(1)} s`)
      for (const remark of stage.remarks.splice(0)) log(`  note: ${remark}`)
    } catch (err) {
      failed = true
      log(`${shot.file}  FAILED: ${err.message}`)
      // The next shot starts by closing whatever this one left open; only the toasts are cleared here.
      await stage.clearToasts().catch(() => {})
    }
  }
} finally {
  const problems = [...new Set(app.page.problems)]
  const exitCode = await app.quit()
  if (problems.length > 0) log(`Page errors during the run:\n  ${problems.slice(0, 20).join('\n  ')}`)
  // The app has written its save for the last time. Whatever it changed on the way (the theme, for
  // the light picture), the collection and the dates of its achievements must be as they were given.
  try {
    const written = JSON.parse(readFileSync(join(USER_DATA, 'save.json'), 'utf8'))
    const same = written.entries.length === save.entries.length && JSON.stringify(Object.entries(written.achievements).sort()) === JSON.stringify(Object.entries(save.achievements).sort())
    log(`Save on disk after the run: ${written.entries.length} of ${save.entries.length} entries, ${Object.keys(written.achievements).length} achievements${same ? ', as given' : ''}`)
    if (!same) {
      failed = true
      log('  FAILED: the app changed the entries or the achievements of the demo save.')
    }
  } catch (err) {
    failed = true
    log(`  FAILED: the save could not be read back: ${err.message}`)
  }
  log(`Electron exited with ${exitCode}. ${results.length} of ${wanted.length} shots written to ${relative(ROOT, outDir) || outDir} in ${((Date.now() - started) / 1000).toFixed(0)} s.`)
}
process.exit(failed ? 1 : 0)
