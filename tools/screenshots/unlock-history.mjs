/**
 * Works out when the demo collection earned each of its achievements.
 *
 * A save of the app records every unlock with its date. A demo save without them would be given
 * all of them at once on its first load, and the Achievements page would then date a year of
 * medals, "First Catch" included, to the day the pictures are taken. So the collection is replayed
 * here, catch by catch in the order it was logged, through the app's own achievement engine
 * (src/renderer/src/domain/achievements): each achievement is dated to the catch that earned it.
 *
 * The engine is the app's TypeScript source, loaded through Vite the way the unit tests load it.
 * Nothing of it is copied here, so the dates cannot drift away from what the app would have done.
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const DATA_DIR = join(ROOT, 'src/renderer/public/data')

/** Loads modules of the app's source with its path aliases, without bundling or a dev server port. */
async function withAppModules(use) {
  const server = await createServer({
    root: ROOT,
    configFile: false,
    logLevel: 'error',
    appType: 'custom',
    resolve: { alias: { '@renderer': join(ROOT, 'src/renderer/src'), '@shared': join(ROOT, 'src/shared') } },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] }
  })
  try {
    return await use((path) => server.ssrLoadModule(path))
  } finally {
    await server.close()
  }
}

/**
 * `{ achievement id: ISO timestamp }` for every achievement the collection has earned along the
 * way, as the app would have recorded them. An achievement stays unlocked once earned, so this
 * can hold more than the ones whose condition still holds at the end.
 */
export async function unlockHistory(save, { dataDir = DATA_DIR } = {}) {
  return withAppModules(async (load) => {
    const { Dex, validateDexIndex } = await load('/src/renderer/src/lib/data.ts')
    const { buildContext, evaluateAll } = await load('/src/renderer/src/domain/achievements/engine.ts')
    const dex = new Dex(validateDexIndex(JSON.parse(readFileSync(join(dataDir, 'dex.json'), 'utf8'))))

    // The order the catches were logged in.
    const entries = [...save.entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    const unlocked = {}
    entries.forEach((entry, i) => {
      // The app checks right after a catch is saved, so the catch's own timestamp is the unlock's.
      for (const state of evaluateAll(buildContext(dex, entries.slice(0, i + 1), save.settings.rules, new Date(entry.createdAt)))) {
        if (state.done && !Object.hasOwn(unlocked, state.id)) unlocked[state.id] = entry.createdAt
      }
    })
    return unlocked
  })
}
