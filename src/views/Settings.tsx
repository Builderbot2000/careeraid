import React, { useEffect, useState } from 'react'
import type { FeatureLocks, Settings as SettingsType } from '../shared/ipc-types'

interface Props {
    featureLocks: FeatureLocks
}

function LockRow({ label, locked }: { label: string; locked: boolean }): React.ReactElement {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13 }}>{label}</span>
            <span className={`badge ${locked ? 'badge-err' : 'badge-ok'}`}>
                {locked ? 'Locked' : 'OK'}
            </span>
        </div>
    )
}

export default function Settings({ featureLocks }: Props): React.ReactElement {
    const [settings, setSettings] = useState<SettingsType | null>(null)
    const [apiKeyInput, setApiKeyInput] = useState('')
    const [apiKeyPresent, setApiKeyPresent] = useState(false)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState('')

    useEffect(() => {
        window.api.getSettings().then(setSettings)
        window.api.getApiKeyPresent().then(setApiKeyPresent)
    }, [])

    async function saveSetting<K extends keyof SettingsType>(key: K, value: SettingsType[K]): Promise<void> {
        await window.api.updateSetting(key, value)
        setSettings((prev) => prev ? { ...prev, [key]: value } : prev)
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

    if (!settings) return <div>Loading settings…</div>

    return (
        <div>
            <h1>Settings</h1>

            {/* Feature status */}
            <div className="card">
                <h2>Feature Status</h2>
                <LockRow label="Claude API key" locked={featureLocks.claudeApiKey} />
                <LockRow label="Claude connectivity" locked={featureLocks.claudeConnectivity} />
                <LockRow label="xelatex binary" locked={featureLocks.xelatex} />
                <LockRow label="Playwright Chromium" locked={featureLocks.playwrightChromium} />
                <LockRow label="Profile has entries" locked={featureLocks.profileEmpty} />
            </div>

            {/* API key */}
            <div className="card">
                <h2>Anthropic API Key</h2>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
                    Stored securely in your OS keychain. Never written to disk.
                    {apiKeyPresent && <> A key is currently stored.</>}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input
                        type="password"
                        placeholder={apiKeyPresent ? '••••••••••••••••' : 'sk-ant-…'}
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSetApiKey() }}
                        style={{ flex: 1 }}
                    />
                    <button className="btn btn-primary" onClick={handleSetApiKey} disabled={saving || !apiKeyInput.trim()}>
                        {apiKeyPresent ? 'Update' : 'Save'}
                    </button>
                    {apiKeyPresent && (
                        <button className="btn btn-danger" onClick={handleDeleteApiKey} disabled={saving}>
                            Remove
                        </button>
                    )}
                </div>
                {msg && <div className="form-hint" style={{ marginTop: 8 }}>{msg}</div>}
            </div>

            {/* Paths */}
            <div className="card">
                <h2>Paths</h2>
                <div className="form-row">
                    <label>xelatex binary path</label>
                    <input
                        type="text"
                        value={settings.tex_binary_path ?? ''}
                        placeholder="/usr/bin/xelatex"
                        onChange={(e) => saveSetting('tex_binary_path', e.target.value || null)}
                    />
                    <div className="form-hint">Leave blank to auto-detect common locations.</div>
                </div>
                <div className="form-row">
                    <label>PDF export path</label>
                    <input
                        type="text"
                        value={settings.pdf_export_path ?? ''}
                        placeholder="~/Downloads"
                        onChange={(e) => saveSetting('pdf_export_path', e.target.value || null)}
                    />
                </div>
            </div>

            {/* Scraping */}
            <div className="card">
                <h2>Scraping</h2>
                <div className="form-row">
                    <label>Crawl delay (ms)</label>
                    <input
                        type="number"
                        min={500}
                        max={30000}
                        value={settings.crawl_delay_ms}
                        onChange={(e) => saveSetting('crawl_delay_ms', Number(e.target.value))}
                    />
                    <div className="form-hint">Delay between page fetches (default 3000 ms).</div>
                </div>
                <div className="form-row">
                    <label>Posting retention (days)</label>
                    <input
                        type="number"
                        min={1}
                        max={365}
                        value={settings.posting_retention_days}
                        onChange={(e) => saveSetting('posting_retention_days', Number(e.target.value))}
                    />
                    <div className="form-hint">Non-favorited postings are soft-deleted after this many days.</div>
                </div>
                <div className="form-row">
                    <label>Parse error abort threshold</label>
                    <input
                        type="number"
                        min={1}
                        max={50}
                        value={settings.parse_error_abort_threshold}
                        onChange={(e) => saveSetting('parse_error_abort_threshold', Number(e.target.value))}
                    />
                    <div className="form-hint">Consecutive parse failures before a scraper mod is aborted.</div>
                </div>
            </div>

            {/* Profile & LLM */}
            <div className="card">
                <h2>Profile &amp; LLM</h2>
                <div className="form-row">
                    <label>Profile entry word limit</label>
                    <input
                        type="number"
                        min={50}
                        max={1000}
                        value={settings.profile_entry_word_limit}
                        onChange={(e) => saveSetting('profile_entry_word_limit', Number(e.target.value))}
                    />
                </div>
                <div className="form-row">
                    <label>Affinity scoring token budget</label>
                    <input
                        type="number"
                        min={10000}
                        max={200000}
                        step={1000}
                        value={settings.affinity_token_budget}
                        onChange={(e) => saveSetting('affinity_token_budget', Number(e.target.value))}
                    />
                    <div className="form-hint">Max input tokens per affinity scoring batch (default 80,000).</div>
                </div>
            </div>

            {/* Logging */}
            <div className="card">
                <h2>Logging</h2>
                <div className="form-row">
                    <label>Log level</label>
                    <select
                        value={settings.log_level}
                        onChange={(e) => saveSetting('log_level', e.target.value as SettingsType['log_level'])}
                    >
                        <option value="error">error</option>
                        <option value="warn">warn</option>
                        <option value="info">info</option>
                        <option value="debug">debug</option>
                    </select>
                </div>
                <div className="form-row">
                    <label>Log retention (days)</label>
                    <input
                        type="number"
                        min={1}
                        max={365}
                        value={settings.log_retention_days}
                        onChange={(e) => saveSetting('log_retention_days', Number(e.target.value))}
                    />
                </div>
            </div>
        </div>
    )
}
