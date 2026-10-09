// Runs sandboxed: only 'electron' may be imported at runtime, everything else here is types.
import { contextBridge, ipcRenderer } from 'electron'
import type { PelagixApi, PelagixChannel, PelagixIpc } from '@shared/api'

function invoke<K extends PelagixChannel>(channel: K, ...args: PelagixIpc[K]['args']): Promise<PelagixIpc[K]['result']> {
  return ipcRenderer.invoke(channel, ...args) as Promise<PelagixIpc[K]['result']>
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
  setTheme: (theme) => invoke('pelagix:set-theme', theme)
}

contextBridge.exposeInMainWorld('api', api)
