import { contextBridge, ipcRenderer } from 'electron'
import type {
  Settings,
  FeatureLocks,
  SettingKey,
  ElectronAPI,
  CreateProfileEntryInput,
  UpdateProfileEntryInput,
  PostingStatus,
  SearchConfigRow,
} from '../src/shared/ipc-types'

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

  // ── Profile ────────────────────────────────────────────────────────────────
  getProfileEntries() {
    return ipcRenderer.invoke('profile:get-all')
  },

  createProfileEntry(input: CreateProfileEntryInput) {
    return ipcRenderer.invoke('profile:create', input)
  },

  updateProfileEntry(id: string, updates: UpdateProfileEntryInput) {
    return ipcRenderer.invoke('profile:update', { id, updates })
  },

  deleteProfileEntry(id: string): Promise<void> {
    return ipcRenderer.invoke('profile:delete', id)
  },

  getUserProfile() {
    return ipcRenderer.invoke('profile:get-user')
  },

  setUserYoe(yoe: number | null): Promise<void> {
    return ipcRenderer.invoke('profile:set-yoe', yoe)
  },

  exportProfileMarkdown(): Promise<string | null> {
    return ipcRenderer.invoke('profile:export')
  },

  importProfileMarkdown(): Promise<{ added: number; skipped: number } | null> {
    return ipcRenderer.invoke('profile:import')
  },

  // ── Resume ────────────────────────────────────────────────────────────────
  tailorResume(jobDescription: string, templateName: string, postingId?: string) {
    return ipcRenderer.invoke('resume:tailor', { jobDescription, templateName, postingId })
  },

  getApplications() {
    return ipcRenderer.invoke('resume:get-applications')
  },

  getAvailableTemplates() {
    return ipcRenderer.invoke('resume:get-templates')
  },

  recompileResume(applicationId: string) {
    return ipcRenderer.invoke('resume:recompile', applicationId)
  },

  // ── Search Config ──────────────────────────────────────────────────────────
  getSearchConfig(): Promise<SearchConfigRow> {
    return ipcRenderer.invoke('search:get-config')
  },

  updateSearchConfig(updates: Partial<SearchConfigRow>): Promise<void> {
    return ipcRenderer.invoke('search:update-config', updates)
  },

  // ── Jobs ───────────────────────────────────────────────────────────────────
  runScrape() {
    return ipcRenderer.invoke('jobs:run-scrape')
  },

  commitScrape(): Promise<void> {
    return ipcRenderer.invoke('jobs:commit-scrape')
  },

  discardScrape(): Promise<void> {
    return ipcRenderer.invoke('jobs:discard-scrape')
  },

  getPostings() {
    return ipcRenderer.invoke('jobs:get-postings')
  },

  updatePostingStatus(id: string, status: PostingStatus): Promise<void> {
    return ipcRenderer.invoke('jobs:update-status', { id, status })
  },

  // ── Tracker ────────────────────────────────────────────────────────────────
  getTrackerPostings() {
    return ipcRenderer.invoke('tracker:get-postings')
  },

  // ── Events ─────────────────────────────────────────────────────────────────
  onScrapingCommitted(cb: () => void): void {
    ipcRenderer.on('jobs:scrape-committed', () => cb())
  },
} satisfies ElectronAPI)
