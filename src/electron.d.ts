import type { ElectronAPI } from './shared/ipc-types'

declare global {
  interface Window {
    api: ElectronAPI
  }
}
