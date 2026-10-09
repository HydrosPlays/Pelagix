/**
 * The contract between the Electron preload script and the renderer.
 *
 * `window.api` exists only inside Electron. In a plain browser (`npm run dev:web`) it is
 * undefined and the renderer falls back to localStorage and direct CDN sprite URLs.
 *
 * Types only: this file must stay free of runtime code.
 */

import type { SaveFile, ThemeId } from './save-types'

export interface ExportResult {
  canceled: boolean
  /** Absolute path the save was written to; absent when the dialog was cancelled. */
  path?: string
}

export interface SpriteCacheInfo {
  files: number
  bytes: number
}

export interface AppInfo {
  version: string
  electron: string
  chrome: string
  /** Folder holding save.json, backups/ and sprite-cache/. */
  userData: string
}

export interface PelagixApi {
  /** `process.platform` of the main process: "win32", "darwin", "linux". */
  platform: string
  /** Raw parsed JSON of the save file, or null when there is none yet. Validated by the renderer. */
  loadSave(): Promise<unknown | null>
  writeSave(save: SaveFile): Promise<void>
  exportSave(save: SaveFile): Promise<ExportResult>
  /** Open dialog -> parsed JSON; null if cancelled. Rejects on unreadable or oversized files. */
  importSave(): Promise<unknown | null>
  spriteCacheInfo(): Promise<SpriteCacheInfo>
  clearSpriteCache(): Promise<void>
  appInfo(): Promise<AppInfo>
  /** Opens the URL in the system browser. https only. */
  openExternal(url: string): Promise<void>
  /** Recolours the native title-bar overlay and window background to match the theme. */
  setTheme(theme: ThemeId): Promise<void>
}

/** IPC channels behind `PelagixApi`: argument tuple and resolved value of each. */
export interface PelagixIpc {
  'pelagix:save-load': { args: []; result: unknown | null }
  'pelagix:save-write': { args: [save: SaveFile]; result: void }
  'pelagix:save-export': { args: [save: SaveFile]; result: ExportResult }
  'pelagix:save-import': { args: []; result: unknown | null }
  'pelagix:sprite-cache-info': { args: []; result: SpriteCacheInfo }
  'pelagix:sprite-cache-clear': { args: []; result: void }
  'pelagix:app-info': { args: []; result: AppInfo }
  'pelagix:open-external': { args: [url: string]; result: void }
  'pelagix:set-theme': { args: [theme: ThemeId]; result: void }
}

export type PelagixChannel = keyof PelagixIpc

declare global {
  interface Window {
    api?: PelagixApi
  }
}
