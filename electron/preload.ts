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
  SearchTerm,
  BanListEntry,
  JobPosting,
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

  importProfileFromResumePdf(): Promise<{ added: number; entries: unknown[] } | null> {
    return ipcRenderer.invoke('profile:import-resume-pdf')
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

  // ── Search Terms ───────────────────────────────────────────────────────────
  getSearchTerms(): Promise<SearchTerm[]> {
    return ipcRenderer.invoke('search-terms:get')
  },

  generateSearchTerms(): Promise<SearchTerm[]> {
    return ipcRenderer.invoke('search-terms:generate')
  },

  updateSearchTerm(id: string, updates: { term?: string; enabled?: boolean }): Promise<void> {
    return ipcRenderer.invoke('search-terms:update', { id, updates })
  },

  addSearchTerm(adapterId: string, term: string): Promise<SearchTerm> {
    return ipcRenderer.invoke('search-terms:add', { adapterId, term })
  },

  deleteSearchTerm(id: string): Promise<void> {
    return ipcRenderer.invoke('search-terms:delete', id)
  },

  // ── Ban List ───────────────────────────────────────────────────────────────
  getBanList(): Promise<BanListEntry[]> {
    return ipcRenderer.invoke('ban-list:get')
  },

  addBanEntry(entry: {
    type: 'company' | 'domain'
    value: string
    reason?: string
  }): Promise<{ entry: BanListEntry; deletedCount: number }> {
    return ipcRenderer.invoke('ban-list:add', entry)
  },

  removeBanEntry(id: string): Promise<void> {
    return ipcRenderer.invoke('ban-list:remove', id)
  },

  previewBanMatch(type: 'company' | 'domain', value: string): Promise<number> {
    return ipcRenderer.invoke('ban-list:preview', { type, value })
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

  deletePostings(ids: string[]): Promise<void> {
    return ipcRenderer.invoke('jobs:delete-postings', { ids })
  },

  // ── Tracker ────────────────────────────────────────────────────────────────
  getTrackerPostings() {
    return ipcRenderer.invoke('tracker:get-postings')
  },

  // ── Analytics ──────────────────────────────────────────────────────────────
  getAnalyticsFunnel() {
    return ipcRenderer.invoke('analytics:funnel')
  },

  getAnalyticsBySource() {
    return ipcRenderer.invoke('analytics:by-source')
  },

  getAnalyticsBySeniority() {
    return ipcRenderer.invoke('analytics:by-seniority')
  },

  getAnalyticsWeekly() {
    return ipcRenderer.invoke('analytics:weekly')
  },

  getAnalyticsLLMCost() {
    return ipcRenderer.invoke('analytics:llm-cost')
  },

  getAnalyticsLLMCostByType() {
    return ipcRenderer.invoke('analytics:llm-cost-by-type')
  },

  // ── Backup / Export / Import ───────────────────────────────────────────────
  createBackup(): Promise<string | null> {
    return ipcRenderer.invoke('backup:create')
  },

  exportData(): Promise<string | null> {
    return ipcRenderer.invoke('data:export')
  },

  importData(mode: 'merge' | 'replace'): Promise<{ imported: number } | null> {
    return ipcRenderer.invoke('data:import', mode)
  },

  importDataFromFile(mode: 'merge' | 'replace', filePath: string): Promise<{ imported: number }> {
    return ipcRenderer.invoke('data:import-file', { mode, filePath })
  },

  // ── Events ─────────────────────────────────────────────────────────────────
  onScrapingCommitted(cb: () => void): void {
    ipcRenderer.on('jobs:scrape-committed', () => cb())
  },

  onAffinityUpdated(cb: (postings: JobPosting[]) => void): void {
    ipcRenderer.on('jobs:affinity-updated', (_event, postings: JobPosting[]) => cb(postings))
  },
} satisfies ElectronAPI)
