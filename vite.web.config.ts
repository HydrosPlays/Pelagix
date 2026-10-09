import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { dropDevFixture, OPTIMIZE_DEPS } from './vite.shared'

// Renderer-only browser mode (no Electron): window.api is undefined, so the app falls back to
// localStorage for the save and loads sprites straight from the CDN.
//
// PELAGIX_WEB_PORT / PELAGIX_VITE_CACHE let several dev servers run side by side, each on its own
// origin (so each has its own localStorage save) and with its own dependency cache.
const port = Number(process.env['PELAGIX_WEB_PORT'] ?? 5199)
const cacheDir = process.env['PELAGIX_VITE_CACHE']

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  ...(cacheDir ? { cacheDir: resolve(__dirname, cacheDir) } : {}),
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  // The development fixture is left out of `vite build`: see vite.shared.ts.
  plugins: [react(), dropDevFixture()],
  optimizeDeps: { include: OPTIMIZE_DEPS },
  server: { host: '127.0.0.1', port, strictPort: true },
  preview: { host: '127.0.0.1', port, strictPort: true },
  // Not under out/: electron-builder packs out/** into the asar.
  build: { target: 'chrome152', outDir: resolve(__dirname, 'dist-web'), emptyOutDir: true, chunkSizeWarningLimit: 1500 }
})
