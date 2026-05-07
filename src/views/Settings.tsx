import React, { useEffect, useState } from 'react'
import type { FeatureLocks, Settings as SettingsType } from '../shared/ipc-types'

interface Props {
    featureLocks: FeatureLocks
}

function LockRow({ label, locked, testId }: { label: string; locked: boolean; testId?: string }): React.ReactElement {
    return (
        <div data-testid={testId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13 }}>{label}</span>
            <span className={`badge ${locked ? 'badge-err' : 'badge-ok'}`}>
                {locked ? 'Locked' : 'OK'}
            </span>
        </div>
    )
}

export default function Settings({ featureLocks }: Props): React.ReactElement {
    const [settings, setSettings] = useState<SettingsType | null>(null)
    const [draft, setDraft] = useState<SettingsType | null>(null)
    const [apiKeyInput, setApiKeyInput] = useState('')
    const [apiKeyPresent, setApiKeyPresent] = useState(false)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState('')
    const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
    const [refreshing, setRefreshing] = useState(false)
    const [savedGroup, setSavedGroup] = useState<string | null>(null)

    useEffect(() => {
        window.api.getSettings().then((s) => {
            setSettings(s)
            setDraft(s)
        })
        window.api.getApiKeyPresent().then(setApiKeyPresent)
    }, [])

    function flashSaved(group: string): void {
        setSavedGroup(group)
        setTimeout(() => setSavedGroup((cur) => cur === group ? null : cur), 2000)
    }

    async function saveGroup(group: string, fields: Partial<SettingsType>): Promise<void> {
        for (const [key, value] of Object.entries(fields) as [keyof SettingsType, SettingsType[keyof SettingsType]][]) {
            await window.api.updateSetting(key, value)
        }
        setSettings((prev) => prev ? { ...prev, ...fields } : prev)
        flashSaved(group)
    }

    async function handleSetApiKey(): Promise<void> {
        if (!apiKeyInput.trim()) return
        setSaving(true)
        try {
            await window.api.setApiKey(apiKeyInput.trim())
            setApiKeyInput('')
            setApiKeyPresent(true)
            setMsg('API key saved.')
        } catch (e) {
            setMsg(`Error: ${e}`)
        } finally {
            setSaving(false)
        }
    }

    async function handleDeleteApiKey(): Promise<void> {
        await window.api.deleteApiKey()
        setApiKeyPresent(false)
        setMsg('API key removed.')
    }

    async function handleRefreshLocks(): Promise<void> {
        setRefreshing(true)
        try {
            await window.api.refreshFeatureLocks()
        } finally {
            setRefreshing(false)
        }
    }

    if (!settings || !draft) return <div>Loading settings…</div>

    return (
        <div>
            <h1>Settings</h1>

            {/* Feature status */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h2 style={{ margin: 0 }}>Feature Status</h2>
                    <button
                        data-testid="settings-refresh-locks-btn"
                        className="btn"
                        onClick={handleRefreshLocks}
                        disabled={refreshing}
                        style={{ fontSize: 13 }}
                    >
                        {refreshing ? 'Checking…' : 'Refresh'}
                    </button>
                </div>
                <LockRow label="Claude API key" locked={featureLocks.claudeApiKey} testId="settings-lock-claudeApiKey" />
                <LockRow label="Claude connectivity" locked={featureLocks.claudeConnectivity} testId="settings-lock-claudeConnectivity" />
                <LockRow label="Typst" locked={featureLocks.typst} testId="settings-lock-typst" />
                <LockRow label="Playwright Chromium" locked={featureLocks.playwrightChromium} testId="settings-lock-playwrightChromium" />
                <LockRow label="Profile has entries" locked={featureLocks.profileEmpty} testId="settings-lock-profileEmpty" />
            </div>

            {/* API key */}
            <div className="card">
                <h2>Anthropic Credentials</h2>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
                    Stored securely in your OS keychain. Never written to disk.
                    {apiKeyPresent && <> A key is currently stored.</>}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input
                        data-testid="settings-api-key-input"
                        type="password"
                        placeholder={apiKeyPresent ? '••••••••••••••••' : 'sk-ant-…'}
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSetApiKey() }}
                        style={{ flex: 1 }}
                    />
                    <button data-testid="settings-api-key-save" className="btn btn-primary" onClick={handleSetApiKey} disabled={saving || !apiKeyInput.trim()}>
                        {apiKeyPresent ? 'Update key' : 'Save key'}
                    </button>
                    {apiKeyPresent && (
                        <button data-testid="settings-api-key-remove" className="btn btn-danger" onClick={handleDeleteApiKey} disabled={saving}>
                            Remove key
                        </button>
                    )}
                </div>
                {msg && <div data-testid="settings-msg" className="form-hint" style={{ marginTop: 8 }}>{msg}</div>}
            </div>

            {/* Paths */}
            <div className="card">
                <h2>Paths</h2>
                <div className="form-row">
                    <label>PDF compiler</label>
                    <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Bundled binary</span>
                </div>
                <div className="form-row">
                    <label>PDF export path</label>
                    <input
                        type="text"
                        value={draft.pdf_export_path ?? ''}
                        placeholder="~/Downloads"
                        onChange={(e) => setDraft((p) => p ? { ...p, pdf_export_path: e.target.value || null } : p)}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <button data-testid="settings-save-paths" className="btn btn-primary" onClick={() => saveGroup('paths', { pdf_export_path: draft.pdf_export_path })}>
                        Save
                    </button>
                    {savedGroup === 'paths' && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Saved</span>}
                </div>
            </div>

            {/* Scraping */}
            <div className="card">
                <h2>Scraping</h2>
                <div className="form-row">
                    <label htmlFor="settings-crawl-delay">Crawl delay (ms)</label>
                    <input
                        id="settings-crawl-delay"
                        type="number"
                        min={500}
                        max={30000}
                        value={draft.crawl_delay_ms}
                        onChange={(e) => setDraft((p) => p ? { ...p, crawl_delay_ms: Number(e.target.value) } : p)}
                    />
                    <div className="form-hint">Delay between page fetches (default 3000 ms).</div>
                </div>
                <div className="form-row">
                    <label htmlFor="settings-posting-retention">Posting retention (days)</label>
                    <input
                        id="settings-posting-retention"
                        type="number"
                        min={1}
                        max={365}
                        value={draft.posting_retention_days}
                        onChange={(e) => setDraft((p) => p ? { ...p, posting_retention_days: Number(e.target.value) } : p)}
                    />
                    <div className="form-hint">Non-favorited postings are soft-deleted after this many days.</div>
                </div>
                <div className="form-row">
                    <label>Parse error abort threshold</label>
                    <input
                        type="number"
                        min={1}
                        max={50}
                        value={draft.parse_error_abort_threshold}
                        onChange={(e) => setDraft((p) => p ? { ...p, parse_error_abort_threshold: Number(e.target.value) } : p)}
                    />
                    <div className="form-hint">Consecutive parse failures before a scraper mod is aborted.</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <button data-testid="settings-save-scraping" className="btn btn-primary" onClick={() => saveGroup('scraping', {
                        crawl_delay_ms: draft.crawl_delay_ms,
                        posting_retention_days: draft.posting_retention_days,
                        parse_error_abort_threshold: draft.parse_error_abort_threshold,
                    })}>
                        Save
                    </button>
                    {savedGroup === 'scraping' && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Saved</span>}
                </div>
            </div>

            {/* Profile & LLM */}
            <div className="card">
                <h2>Profile &amp; LLM</h2>
                <div className="form-row">
                    <label htmlFor="settings-word-limit">Profile entry word limit</label>
                    <input
                        id="settings-word-limit"
                        type="number"
                        min={50}
                        max={1000}
                        value={draft.profile_entry_word_limit}
                        onChange={(e) => setDraft((p) => p ? { ...p, profile_entry_word_limit: Number(e.target.value) } : p)}
                    />
                </div>
                <div className="form-row">
                    <label>Affinity scoring token budget</label>
                    <input
                        type="number"
                        min={10000}
                        max={200000}
                        step={1000}
                        value={draft.affinity_token_budget}
                        onChange={(e) => setDraft((p) => p ? { ...p, affinity_token_budget: Number(e.target.value) } : p)}
                    />
                    <div className="form-hint">Max input tokens per affinity scoring batch (default 80,000).</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <button data-testid="settings-save-profile-llm" className="btn btn-primary" onClick={() => saveGroup('profile-llm', {
                        profile_entry_word_limit: draft.profile_entry_word_limit,
                        affinity_token_budget: draft.affinity_token_budget,
                    })}>
                        Save
                    </button>
                    {savedGroup === 'profile-llm' && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Saved</span>}
                </div>
            </div>

            {/* Backup & Export */}
            <div className="card">
                <h2>Backup &amp; Export</h2>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    <button
                        data-testid="settings-backup-btn"
                        className="btn"
                        onClick={async () => {
                            const path = await window.api.createBackup()
                            if (path) setMsg(`Backup saved to ${path}`)
                        }}
                    >
                        Create Backup (.db)
                    </button>
                    <button
                        data-testid="settings-export-btn"
                        className="btn"
                        onClick={async () => {
                            const path = await window.api.exportData()
                            if (path) setMsg(`Data exported to ${path}`)
                        }}
                    >
                        Export Data (.json)
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        value={importMode}
                        onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}
                        style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem', fontFamily: 'inherit' }}
                    >
                        <option value="merge">Merge (keep existing, add new)</option>
                        <option value="replace">Replace (clear first)</option>
                    </select>
                    <button
                        data-testid="settings-import-btn"
                        className="btn btn-danger"
                        onClick={async () => {
                            const result = await window.api.importData(importMode)
                            if (result) setMsg(`Imported ${result.imported} records (${importMode} mode)`)
                        }}
                    >
                        Import from JSON…
                    </button>
                </div>
            </div>

            {/* Logging */}
            <div className="card">
                <h2>Logging</h2>
                <div className="form-row">
                    <label htmlFor="settings-log-level">Log level</label>
                    <select
                        id="settings-log-level"
                        value={draft.log_level}
                        onChange={(e) => setDraft((p) => p ? { ...p, log_level: e.target.value as SettingsType['log_level'] } : p)}
                    >
                        <option value="error">error</option>
                        <option value="warn">warn</option>
                        <option value="info">info</option>
                        <option value="debug">debug</option>
                    </select>
                </div>
                <div className="form-row">
                    <label>Log keep (days)</label>
                    <input
                        type="number"
                        min={1}
                        max={365}
                        value={draft.log_retention_days}
                        onChange={(e) => setDraft((p) => p ? { ...p, log_retention_days: Number(e.target.value) } : p)}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <button data-testid="settings-save-logging" className="btn btn-primary" onClick={() => saveGroup('logging', {
                        log_level: draft.log_level,
                        log_retention_days: draft.log_retention_days,
                    })}>
                        Save
                    </button>
                    {savedGroup === 'logging' && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Saved</span>}
                </div>
            </div>
        </div>
    )
}
