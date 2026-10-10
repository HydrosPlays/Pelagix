// Runs sandboxed: only 'electron' may be imported at runtime, everything else here is types.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { PelagixApi, PelagixChannel, PelagixEventChannel, PelagixEvents, PelagixIpc } from '@shared/api'

function invoke<K extends PelagixChannel>(channel: K, ...args: PelagixIpc[K]['args']): Promise<PelagixIpc[K]['result']> {
  return ipcRenderer.invoke(channel, ...args) as Promise<PelagixIpc[K]['result']>
}

/** Listens to a message the main process pushes. Returns the function that stops listening. */
function subscribe<K extends PelagixEventChannel>(channel: K, listener: (...args: PelagixEvents[K]) => void): () => void {
  // The event object stays on this side: the page only ever gets the message itself.
  const handler = (_event: IpcRendererEvent, ...args: unknown[]): void => listener(...(args as PelagixEvents[K]))
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api: PelagixApi = {
  platform: process.platform,
  loadSave: () => invoke('pelagix:save-load'),
  writeSave: (save) => invoke('pelagix:save-write', save),
  exportSave: (save) => invoke('pelagix:save-export', save),
  importSave: () => invoke('pelagix:save-import'),
  spriteCacheInfo: () => invoke('pelagix:sprite-cache-info'),
  clearSpriteCache: () => invoke('pelagix:sprite-cache-clear'),
  appInfo: () => invoke('pelagix:app-info'),
  openExternal: (url) => invoke('pelagix:open-external', url),
  setTheme: (theme) => invoke('pelagix:set-theme', theme),
  updateState: () => invoke('pelagix:update-state'),
  onUpdateState: (listener) => subscribe('pelagix:update-changed', listener),
  checkForUpdates: () => invoke('pelagix:update-check'),
  downloadUpdate: () => invoke('pelagix:update-download'),
  cancelUpdateDownload: () => invoke('pelagix:update-cancel'),
  installUpdate: () => invoke('pelagix:update-install'),
  setUpdateAutoCheck: (enabled) => invoke('pelagix:update-set-auto-check', enabled),
  markUpdateAnnounced: (version) => invoke('pelagix:update-announced', version),
  dismissWhatsNew: () => invoke('pelagix:update-whats-new-seen')
}

contextBridge.exposeInMainWorld('api', api)
