import keytar from 'keytar'
import { getDb } from '../db/database'
import type { Settings, SettingKey } from '../src/shared/ipc-types'

const SERVICE = 'jobhunt'
const ACCOUNT = 'anthropic_api_key'

// ─── Keychain ────────────────────────────────────────────────────────────────

export const saveApiKey = (key: string): Promise<void> =>
  keytar.setPassword(SERVICE, ACCOUNT, key)

export const getApiKey = (): Promise<string | null> =>
  keytar.getPassword(SERVICE, ACCOUNT)

export const deleteApiKey = (): Promise<boolean> =>
  keytar.deletePassword(SERVICE, ACCOUNT)

export async function getApiKeyPresent(): Promise<boolean> {
  const key = await keytar.getPassword(SERVICE, ACCOUNT)
  return key !== null && key.length > 0
}

// ─── Settings table ──────────────────────────────────────────────────────────

export function getSettings(): Settings {
  const db = getDb()
  return db.prepare('SELECT * FROM settings WHERE id = 1').get() as Settings
}

// Allowed column names are hardcoded to prevent any SQL injection via key.
const ALLOWED_KEYS: ReadonlyArray<SettingKey> = [
  'tex_binary_path',
  'pdf_export_path',
  'crawl_delay_ms',
  'posting_retention_days',
  'profile_entry_word_limit',
  'log_retention_days',
  'parse_error_abort_threshold',
  'affinity_token_budget',
  'log_level',
]

export function updateSetting(key: SettingKey, value: Settings[SettingKey]): void {
  if (!ALLOWED_KEYS.includes(key)) {
    throw new Error(`Unknown setting key: ${String(key)}`)
  }
  const db = getDb()
  // key is validated against the whitelist above — safe to interpolate as column name
  db.prepare(`UPDATE settings SET "${key}" = ? WHERE id = 1`).run(
    value as string | number | null,
  )
}
