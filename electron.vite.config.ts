import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { dropDevFixture, OPTIMIZE_DEPS } from './vite.shared'

const shared = { '@shared': resolve('src/shared') }

// electron-vite 5 only knows Electron <= 39, so the Node / Chrome targets are set by hand
// (Electron 44 = Node 24 + Chromium 152).
export default defineConfig({
  main: {
    build: { target: 'node24' },
    resolve: { alias: shared }
  },
  preload: {
    // Bundled completely: a sandboxed preload may only require 'electron'.
    build: { target: 'node24', externalizeDeps: false },
    resolve: { alias: shared }
  },
  renderer: {
    // One chunk on purpose: everything loads from disk, so splitting buys nothing.
    build: { target: 'chrome152', minify: 'esbuild', chunkSizeWarningLimit: 1500 },
    resolve: { alias: { ...shared, '@renderer': resolve('src/renderer/src') } },
    optimizeDeps: { include: OPTIMIZE_DEPS },
    // The development fixture never ships: see vite.shared.ts.
    plugins: [react(), dropDevFixture()]
  }
})
