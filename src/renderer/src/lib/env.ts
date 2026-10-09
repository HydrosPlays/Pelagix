/** Where the renderer is running. Evaluated once: the preload script installs `window.api` before any page script runs. */

/** True inside Electron (the preload bridge is present); false in `npm run dev:web` and in tests. */
export const isElectron: boolean = typeof window !== 'undefined' && window.api !== undefined

/** True under the Vite dev server (and under vitest). */
export const isDev: boolean = import.meta.env.DEV === true
