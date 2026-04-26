// ─── Profile ──────────────────────────────────────────────────────────────────

export type ProfileEntryType =
  | 'experience'
  | 'credential'
  | 'accomplishment'
  | 'skill'
  | 'education'

export interface ProfileEntry {
  id: string
  type: ProfileEntryType
  title: string
  content: string
  tags: string[]
  start_date: string | null
  end_date: string | null
  created_at: string
}

export interface UserProfile {
  id: number
  yoe: number | null
}

export type CreateProfileEntryInput = Omit<ProfileEntry, 'id' | 'created_at'>
export type UpdateProfileEntryInput = Partial<Omit<ProfileEntry, 'id' | 'created_at'>>

// ─── Resume ───────────────────────────────────────────────────────────────────

export interface ResumeExperience {
  company: string
  role: string
  start_date: string
  end_date: string
  bullets: string[]
}

export interface ResumeSkills {
  languages: string[]
  frameworks: string[]
  tools: string[]
}

export interface ResumeEducation {
  institution: string
  degree: string
  year: string
}

export interface ResumeData {
  summary: string
  experience: ResumeExperience[]
  skills: ResumeSkills
  education: ResumeEducation[]
  credentials: string[]
}

export interface Application {
  id: string
  posting_id: string | null
  tex_path: string
  resume_json: string
  schema_version: number
  applied_at: string | null
  notes: string
}

export interface TailorResumeResult {
  application: Application
  pdfUrl: string
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export type PostingStatus =
  | 'new'
  | 'viewed'
  | 'favorited'
  | 'applied'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'ghosted'

export type Seniority = 'intern' | 'junior' | 'mid' | 'senior' | 'staff' | 'any'

export interface JobPosting {
  id: string
  source: string
  url: string
  resolved_domain: string | null
  title: string
  company: string
  location: string
  yoe_min: number | null
  yoe_max: number | null
  seniority: Seniority
  tech_stack: string[]
  posted_at: string | null
  applicant_count: number | null
  raw_text: string | null
  fetched_at: string
  scraper_mod_version: string
  status: PostingStatus
  affinity_score: number | null
  affinity_skipped: boolean
  affinity_scored_at: string | null
  affinity_reasoning: string | null
  first_response_at: string | null
  last_seen_at: string
}

export interface SearchConfigRow {
  intent: string | null
  term_generation_hash: string | null
  ranking_weights: string        // JSON: Record<string, number>
  affinity_skip_threshold: number
  excluded_stack: string         // JSON: string[]
  required_keywords: string      // JSON: string[]
  excluded_keywords: string      // JSON: string[]
  keyword_match_fields: string   // JSON: string[]
}

export interface ScrapeSummary {
  fetched: number
  dupes: number
  netNew: number
  ban_excluded: number
  keyword_filtered: number
}

// ─── Search terms ─────────────────────────────────────────────────────────────

export interface SearchTerm {
  id: string
  adapter_id: string
  term: string
  enabled: boolean
  source: 'llm_generated' | 'user_added'
  created_at: string
}

// ─── Ban list ─────────────────────────────────────────────────────────────────

export interface BanListEntry {
  id: string
  type: 'company' | 'domain'
  value: string
  reason: string | null
  created_at: string
}

// ─── LLM usage ────────────────────────────────────────────────────────────────

export interface LLMUsageRecord {
  id: string
  call_type: 'search_term_gen' | 'affinity_scoring' | 'resume_tailoring'
  model: string
  input_tokens: number
  output_tokens: number
  estimated_cost: number
  called_at: string
  posting_id: string | null
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface FunnelSummary {
  applied: number
  interviewing: number
  offer: number
  rejected: number
  ghosted: number
  response_rate: number   // (interviewing + offer + rejected) / applied; NaN if 0 applied
  conversion_rate: number // offer / applied
}

export interface SourceMetric {
  source: string
  count: number
  response_rate: number
  avg_days_to_response: number | null
}

export interface SeniorityMetric {
  seniority: string
  count: number
  response_rate: number
}

export interface WeeklyMetric {
  week: string  // ISO week label "YYYY-Www"
  applications: number
}

export interface LLMCostSummary {
  all_time: number
  current_month: number
}

export interface LLMCostByType {
  call_type: string
  total_cost: number
  call_count: number
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface Settings {
  tex_binary_path: string | null
  pdf_export_path: string | null
  crawl_delay_ms: number
  posting_retention_days: number
  profile_entry_word_limit: number
  log_retention_days: number
  parse_error_abort_threshold: number
  affinity_token_budget: number
  log_level: 'error' | 'warn' | 'info' | 'debug'
}

export type SettingKey = keyof Settings

export interface FeatureLocks {
  /** True = no API key stored → Claude features locked */
  claudeApiKey: boolean
  /** True = API unreachable at startup → Claude features locked */
  claudeConnectivity: boolean
  /** True = xelatex binary not found → resume compilation locked */
  xelatex: boolean
  /** True = Playwright Chromium absent → Playwright scrapers locked */
  playwrightChromium: boolean
  /** True = no profile entries → resume tailoring locked */
  profileEmpty: boolean
}

/** Shape of window.api as exposed by the context bridge. */
export interface ElectronAPI {
  onFeatureLocks(cb: (locks: FeatureLocks) => void): void
  getSettings(): Promise<Settings>
  updateSetting(key: SettingKey, value: Settings[SettingKey]): Promise<void>
  getApiKeyPresent(): Promise<boolean>
  setApiKey(key: string): Promise<void>
  deleteApiKey(): Promise<void>
  openExternal(url: string): Promise<void>

  // Profile
  getProfileEntries(): Promise<ProfileEntry[]>
  createProfileEntry(input: CreateProfileEntryInput): Promise<ProfileEntry>
  updateProfileEntry(id: string, updates: UpdateProfileEntryInput): Promise<ProfileEntry>
  deleteProfileEntry(id: string): Promise<void>
  getUserProfile(): Promise<UserProfile>
  setUserYoe(yoe: number | null): Promise<void>
  exportProfileMarkdown(): Promise<string | null>
  importProfileMarkdown(): Promise<{ added: number; skipped: number } | null>

  // Resume
  tailorResume(
    jobDescription: string,
    templateName: string,
    postingId?: string,
  ): Promise<TailorResumeResult>
  getApplications(): Promise<Application[]>
  getAvailableTemplates(): Promise<string[]>
  recompileResume(applicationId: string): Promise<string>

  // Search config
  getSearchConfig(): Promise<SearchConfigRow>
  updateSearchConfig(updates: Partial<SearchConfigRow>): Promise<void>

  // Search terms
  getSearchTerms(): Promise<SearchTerm[]>
  generateSearchTerms(): Promise<SearchTerm[]>
  updateSearchTerm(id: string, updates: { term?: string; enabled?: boolean }): Promise<void>
  addSearchTerm(adapterId: string, term: string): Promise<SearchTerm>
  deleteSearchTerm(id: string): Promise<void>

  // Ban list
  getBanList(): Promise<BanListEntry[]>
  addBanEntry(entry: { type: 'company' | 'domain'; value: string; reason?: string }): Promise<{ entry: BanListEntry; deletedCount: number }>
  removeBanEntry(id: string): Promise<void>
  previewBanMatch(type: 'company' | 'domain', value: string): Promise<number>

  // Jobs
  runScrape(): Promise<ScrapeSummary>
  commitScrape(): Promise<void>
  discardScrape(): Promise<void>
  getPostings(): Promise<JobPosting[]>
  updatePostingStatus(id: string, status: PostingStatus): Promise<void>

  // Tracker
  getTrackerPostings(): Promise<JobPosting[]>

  // Analytics
  getAnalyticsFunnel(): Promise<FunnelSummary>
  getAnalyticsBySource(): Promise<SourceMetric[]>
  getAnalyticsBySeniority(): Promise<SeniorityMetric[]>
  getAnalyticsWeekly(): Promise<WeeklyMetric[]>
  getAnalyticsLLMCost(): Promise<LLMCostSummary>
  getAnalyticsLLMCostByType(): Promise<LLMCostByType[]>

  // Backup + Data export/import
  createBackup(): Promise<string | null>
  exportData(): Promise<string | null>
  importData(mode: 'merge' | 'replace'): Promise<{ imported: number } | null>
  importDataFromFile(mode: 'merge' | 'replace', filePath: string): Promise<{ imported: number }>

  // Events
  onScrapingCommitted(cb: () => void): void
}
