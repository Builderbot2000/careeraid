import { contextBridge, ipcRenderer } from 'electron'
import type { Settings, FeatureLocks, SettingKey, ElectronAPI } from '../src/shared/ipc-types'

contextBridge.exposeInMainWorld('api', {
  // ── Startup ────────────────────────────────────────────────────────────────
  onFeatureLocks(cb: (locks: FeatureLocks) => void): void {
    ipcRenderer.on('startup:feature-locks', (_event, locks: FeatureLocks) => cb(locks))
  },

  // ── Settings ───────────────────────────────────────────────────────────────
  getSettings(): Promise<Settings> {
    return ipcRenderer.invoke('settings:get')
  },

  updateSetting(key: SettingKey, value: Settings[SettingKey]): Promise<void> {
    return ipcRenderer.invoke('settings:update', { key, value })
  },

  getApiKeyPresent(): Promise<boolean> {
    return ipcRenderer.invoke('settings:api-key-present')
  },

  setApiKey(key: string): Promise<void> {
    return ipcRenderer.invoke('settings:set-api-key', key)
  },

  deleteApiKey(): Promise<void> {
    return ipcRenderer.invoke('settings:delete-api-key')
  },

  // ── Shell ──────────────────────────────────────────────────────────────────
  /** Opens a URL in the default browser. Only https:// URLs are allowed. */
  openExternal(url: string): Promise<void> {
    return ipcRenderer.invoke('shell:open-external', url)
  },
} satisfies ElectronAPI)
