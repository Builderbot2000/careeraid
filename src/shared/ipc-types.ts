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
}
