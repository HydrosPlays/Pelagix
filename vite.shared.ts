import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

/**
 * Pieces shared by the two renderer configs: electron.vite.config.ts (the app) and
 * vite.web.config.ts (the interface on its own in a browser).
 */

/** Pre-bundled up front: discovering these lazily re-optimises mid-session and briefly loads two Reacts. */
export const OPTIMIZE_DEPS: string[] = ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'zustand', 'zustand/middleware', 'animejs', 'wouter', '@tanstack/react-virtual']

/** Folder inside the renderer's public directory holding the small development dataset. */
export const DEV_FIXTURE_DIR = 'data-fixture'

/**
 * Keeps the development fixture out of production builds. It lives in the renderer's public
 * folder so that `npm run dev` can fall back to it while the real datasets are not built yet; a
 * production build never reads it (a missing dataset is an error there), so it is removed from
 * the output once everything has been written. The dev servers are not affected.
 */
export function dropDevFixture(): Plugin {
  let outDir = ''
  return {
    name: 'pelagix:drop-dev-fixture',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    async closeBundle() {
      if (outDir !== '') await rm(resolve(outDir, DEV_FIXTURE_DIR), { recursive: true, force: true })
    }
  }
}
