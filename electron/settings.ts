import { safeStorage } from 'electron'
import { getDb } from '../db/database'
import type { Settings, SettingKey } from '../src/shared/ipc-types'

// ─── API key via safeStorage ──────────────────────────────────────────────────
//
// safeStorage encrypts with DPAPI (Windows), Keychain (macOS), or Secret
// Service / fallback key (Linux). The encrypted Buffer is stored as base64 in
// the settings table — no native addon, no D-Bus dependency.

export function saveApiKey(key: string): void {
  if (process.env.CAREERAID_TEST === '1' || !safeStorage.isEncryptionAvailable()) {
    // Test mode or no encryption available — store as plain base64 (no safeStorage)
    getDb()
      .prepare('UPDATE settings SET encrypted_api_key = ? WHERE id = 1')
      .run(Buffer.from(key, 'utf-8').toString('base64'))
    return
  }
  const encrypted = safeStorage.encryptString(key)
  getDb()
    .prepare('UPDATE settings SET encrypted_api_key = ? WHERE id = 1')
    .run(encrypted.toString('base64'))
}

export function getApiKey(): string | null {
  const row = getDb()
    .prepare('SELECT encrypted_api_key FROM settings WHERE id = 1')
    .get() as { encrypted_api_key: string | null }
  if (!row?.encrypted_api_key) {
    // Dev convenience: fall back to env var if no stored key
    return process.env.ANTHROPIC_API_KEY ?? null
  }
  try {
    return safeStorage.decryptString(Buffer.from(row.encrypted_api_key, 'base64'))
  } catch {
    // May be plain base64 (test mode / no encryption)
    try {
      const plain = Buffer.from(row.encrypted_api_key, 'base64').toString('utf-8')
      if (plain.startsWith('sk-ant') || process.env.CAREERAID_TEST === '1') return plain
    } catch { /* ignore */ }
    return process.env.ANTHROPIC_API_KEY ?? null
  }
}

export function deleteApiKey(): void {
  getDb()
    .prepare('UPDATE settings SET encrypted_api_key = NULL WHERE id = 1')
    .run()
}

export function getApiKeyPresent(): boolean {
  const key = getApiKey()
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
