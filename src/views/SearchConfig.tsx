import React, { useState, useEffect, useRef, useCallback } from 'react'
import type {
    ScrapeSummary,
    SearchTerm,
    BanListEntry,
    SearchConfigRow,
} from '../shared/ipc-types'

type ScrapeState = 'idle' | 'running' | 'pending_commit' | 'error'
type Tab = 'intent' | 'filters' | 'banlist'

// ─── Sub-section: Intent & Terms ─────────────────────────────────────────────

function IntentTab(): React.ReactElement {
    const [intent, setIntent] = useState('')
    const [terms, setTerms] = useState<SearchTerm[]>([])
    const [generating, setGenerating] = useState(false)
    const [newTerm, setNewTerm] = useState('')
    const [scrapeState, setScrapeState] = useState<ScrapeState>('idle')
    const [summary, setSummary] = useState<ScrapeSummary | null>(null)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [committing, setCommitting] = useState(false)
    const intentRef = useRef(intent)
    intentRef.current = intent

    useEffect(() => {
        window.api.getSearchConfig().then((cfg) => setIntent(cfg.intent ?? ''))
        window.api.getSearchTerms().then(setTerms)
    }, [])

    function handleIntentBlur(): void {
        window.api.updateSearchConfig({ intent: intentRef.current || null }).catch(console.error)
    }

    async function handleGenerate(): Promise<void> {
        setGenerating(true)
        setErrorMsg(null)
        try {
            const generated = await window.api.generateSearchTerms()
            setTerms(generated)
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : String(err))
        } finally {
            setGenerating(false)
        }
    }

    async function handleToggle(id: string, enabled: boolean): Promise<void> {
        await window.api.updateSearchTerm(id, { enabled })
        setTerms((prev) => prev.map((t) => (t.id === id ? { ...t, enabled } : t)))
    }

    async function handleDelete(id: string): Promise<void> {
        await window.api.deleteSearchTerm(id)
        setTerms((prev) => prev.filter((t) => t.id !== id))
    }

    async function handleAddTerm(): Promise<void> {
        if (!newTerm.trim()) return
        const added = await window.api.addSearchTerm('mock', newTerm.trim())
        setTerms((prev) => [...prev, added])
        setNewTerm('')
    }

    async function handleRunScrape(): Promise<void> {
        setScrapeState('running')
        setErrorMsg(null)
        setSummary(null)
        try {
            const result = await window.api.runScrape()
            setSummary(result)
            setScrapeState('pending_commit')
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : String(err))
            setScrapeState('error')
        }
    }

    async function handleCommit(): Promise<void> {
        setCommitting(true)
        try {
            await window.api.commitScrape()
            setScrapeState('idle')
            setSummary(null)
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : String(err))
            setScrapeState('error')
        } finally {
            setCommitting(false)
        }
    }

    async function handleDiscard(): Promise<void> {
        await window.api.discardScrape()
        setScrapeState('idle')
        setSummary(null)
    }

    return (
        <div>
            {/* Intent */}
            <section style={{ marginBottom: '28px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
                    Search Intent
                </label>
                <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#6b7280' }}>
                    Describe the role you're targeting. Used to generate search terms and rank results.
                </p>
                <textarea
                    data-testid="search-intent-input"
                    value={intent}
                    onChange={(e) => setIntent(e.target.value)}
                    onBlur={handleIntentBlur}
                    placeholder="e.g. Senior backend engineer, fintech or B2B SaaS, remote, Go or TypeScript"
                    rows={3}
                    style={{
                        display: 'block',
                        width: '100%',
                        boxSizing: 'border-box',
                        fontFamily: 'inherit',
                        fontSize: '0.875rem',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        resize: 'vertical',
                    }}
                />
            </section>

            {/* Search Terms */}
            <section style={{ marginBottom: '28px' }}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '10px',
                    }}
                >
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>Search Terms</h3>
                    <button
                        data-testid="search-generate-btn"
                        onClick={handleGenerate}
                        disabled={generating}
                        style={{ padding: '6px 14px', fontWeight: 600, cursor: 'pointer' }}
                    >
                        {generating ? 'Generating…' : 'Generate via AI'}
                    </button>
                </div>

                {terms.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                        No terms yet. Generate some from your intent or add them manually.
                    </p>
                ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
                        {terms.map((t) => (
                            <li
                                key={t.id}
                                data-testid={`search-term-item-${t.id}`}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '5px 0',
                                    borderBottom: '1px solid #f3f4f6',
                                }}
                            >
                                <input
                                    data-testid={`search-term-toggle-${t.id}`}
                                    type="checkbox"
                                    checked={t.enabled}
                                    onChange={(e) => handleToggle(t.id, e.target.checked)}
                                />
                                <span
                                    style={{
                                        flex: 1,
                                        fontSize: '0.875rem',
                                        textDecoration: t.enabled ? 'none' : 'line-through',
                                        color: t.enabled ? undefined : '#9ca3af',
                                    }}
                                >
                                    {t.term}
                                </span>
                                <span
                                    style={{
                                        fontSize: '0.7rem',
                                        color: '#9ca3af',
                                        background: '#f3f4f6',
                                        padding: '1px 6px',
                                        borderRadius: '999px',
                                    }}
                                >
                                    {t.source === 'llm_generated' ? 'AI' : 'manual'}
                                </span>
                                <button
                                    data-testid={`search-term-delete-${t.id}`}
                                    onClick={() => handleDelete(t.id)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#6b7280',
                                        padding: '0 4px',
                                        fontSize: '0.85rem',
                                    }}
                                    title="Delete"
                                >
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        data-testid="search-add-input"
                        value={newTerm}
                        onChange={(e) => setNewTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTerm()}
                        placeholder="Add a term manually…"
                        style={{
                            flex: 1,
                            padding: '6px 8px',
                            fontSize: '0.875rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontFamily: 'inherit',
                        }}
                    />
                    <button
                        data-testid="search-add-btn"
                        onClick={handleAddTerm}
                        style={{ padding: '6px 14px', cursor: 'pointer' }}
                    >
                        Add
                    </button>
                </div>
            </section>

            {/* Adapter + scrape */}
            <section>
                <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '1rem' }}>Run Scrape</h3>
                <div
                    style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                    }}
                >
                    <div>
                        <div style={{ fontWeight: 600 }}>Mock Adapter</div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>
                            Returns hardcoded sample postings — for development and testing
                        </div>
                    </div>
                    <button
                        data-testid="search-run-scrape-btn"
                        onClick={handleRunScrape}
                        disabled={scrapeState === 'running' || scrapeState === 'pending_commit'}
                        style={{ padding: '8px 16px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                        {scrapeState === 'running' ? 'Running…' : 'Run Scrape'}
                    </button>
                </div>

                {scrapeState === 'error' && errorMsg && (
                    <div data-testid="search-error" style={{ marginTop: '12px', color: 'crimson', fontSize: '0.85rem' }}>
                        {errorMsg}
                    </div>
                )}

                {scrapeState === 'pending_commit' && summary && (
                    <div
                        data-testid="search-summary"
                        style={{
                            marginTop: '16px',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            padding: '20px',
                            background: '#f9fafb',
                        }}
                    >
                        <h4 style={{ margin: '0 0 10px', fontSize: '0.95rem' }}>Scrape Complete</h4>
                        <table style={{ borderCollapse: 'collapse', fontSize: '0.875rem', width: '100%' }}>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '3px 12px 3px 0', color: '#6b7280' }}>Fetched</td>
                                    <td style={{ fontWeight: 600 }}>{summary.fetched}</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '3px 12px 3px 0', color: '#6b7280' }}>Duplicates skipped</td>
                                    <td>{summary.dupes}</td>
                                </tr>
                                {summary.ban_excluded > 0 && (
                                    <tr>
                                        <td style={{ padding: '3px 12px 3px 0', color: '#6b7280' }}>Ban list excluded</td>
                                        <td>{summary.ban_excluded}</td>
                                    </tr>
                                )}
                                {summary.keyword_filtered > 0 && (
                                    <tr>
                                        <td style={{ padding: '3px 12px 3px 0', color: '#6b7280' }}>Keyword filtered</td>
                                        <td>{summary.keyword_filtered}</td>
                                    </tr>
                                )}
                                <tr>
                                    <td style={{ padding: '3px 12px 3px 0', color: '#6b7280' }}>Net new to commit</td>
                                    <td
                                        style={{
                                            fontWeight: 600,
                                            color: summary.netNew > 0 ? '#16a34a' : '#6b7280',
                                        }}
                                    >
                                        {summary.netNew}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
                            <button
                                data-testid="search-commit-btn"
                                onClick={handleCommit}
                                disabled={committing || summary.netNew === 0}
                                style={{ padding: '8px 20px', fontWeight: 600, cursor: 'pointer' }}
                            >
                                {committing ? 'Committing…' : `Commit ${summary.netNew} postings`}
                            </button>
                            <button
                                data-testid="search-discard-btn"
                                onClick={handleDiscard}
                                disabled={committing}
                                style={{ padding: '8px 16px', cursor: 'pointer' }}
                            >
                                Discard
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    )
}

// ─── Sub-section: Filters ─────────────────────────────────────────────────────

function FiltersTab(): React.ReactElement {
    const [config, setConfig] = useState<Partial<SearchConfigRow>>({})
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        window.api.getSearchConfig().then(setConfig)
    }, [])

    function parseArray(val: unknown): string[] {
        if (Array.isArray(val)) return val
        if (typeof val === 'string') {
            try {
                const parsed = JSON.parse(val)
                return Array.isArray(parsed) ? parsed : []
            } catch {
                return []
            }
        }
        return []
    }

    function arrayToField(val: unknown): string {
        return parseArray(val).join('\n')
    }

    function fieldToArray(text: string): string {
        return JSON.stringify(
            text
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean),
        )
    }

    async function save(updates: Partial<SearchConfigRow>): Promise<void> {
        await window.api.updateSearchConfig(updates)
        setConfig((prev) => ({ ...prev, ...updates }))
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    function handleKeywordsBlur(
        field: 'required_keywords' | 'excluded_keywords',
        text: string,
    ): void {
        save({ [field]: fieldToArray(text) }).catch(console.error)
    }

    function handleStackBlur(text: string): void {
        save({ excluded_stack: fieldToArray(text) }).catch(console.error)
    }

    function handleThresholdBlur(text: string): void {
        const n = parseInt(text, 10)
        if (!isNaN(n) && n >= 0) {
            save({ affinity_skip_threshold: n }).catch(console.error)
        }
    }

    const textareaStyle: React.CSSProperties = {
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        fontFamily: 'monospace',
        fontSize: '0.825rem',
        padding: '8px',
        borderRadius: '4px',
        border: '1px solid #d1d5db',
        resize: 'vertical',
    }

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontWeight: 600,
        marginBottom: '4px',
        fontSize: '0.875rem',
    }

    const hintStyle: React.CSSProperties = {
        fontSize: '0.8rem',
        color: '#6b7280',
        marginBottom: '6px',
        margin: '2px 0 6px',
    }

    return (
        <div>
            {saved && (
                <div
                    style={{
                        background: '#dcfce7',
                        color: '#166534',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        marginBottom: '16px',
                        fontSize: '0.85rem',
                    }}
                >
                    Saved
                </div>
            )}

            <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>Required Keywords (OR — one per line)</label>
                <p style={hintStyle}>
                    At least one must match in title or tech stack. Prefix with <code>re:</code> for regex.
                </p>
                <textarea
                    rows={4}
                    defaultValue={arrayToField(config.required_keywords)}
                    key={`req-${JSON.stringify(config.required_keywords)}`}
                    onBlur={(e) => handleKeywordsBlur('required_keywords', e.target.value)}
                    style={textareaStyle}
                    placeholder="e.g. TypeScript&#10;Go&#10;re:rust|zig"
                />
            </div>

            <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>Excluded Keywords (one per line)</label>
                <p style={hintStyle}>
                    Drop postings matching any of these. Prefix with <code>re:</code> for regex.
                </p>
                <textarea
                    rows={4}
                    defaultValue={arrayToField(config.excluded_keywords)}
                    key={`exc-${JSON.stringify(config.excluded_keywords)}`}
                    onBlur={(e) => handleKeywordsBlur('excluded_keywords', e.target.value)}
                    style={textareaStyle}
                    placeholder="e.g. internship&#10;re:junior|entry.level"
                />
            </div>

            <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>Excluded Tech Stack (one per line)</label>
                <p style={hintStyle}>
                    Drop postings where tech_stack contains any of these terms.
                </p>
                <textarea
                    rows={4}
                    defaultValue={arrayToField(config.excluded_stack)}
                    key={`stack-${JSON.stringify(config.excluded_stack)}`}
                    onBlur={(e) => handleStackBlur(e.target.value)}
                    style={textareaStyle}
                    placeholder="e.g. PHP&#10;Ruby on Rails"
                />
            </div>

            <div>
                <label style={labelStyle}>Affinity Scoring Skip Threshold</label>
                <p style={hintStyle}>
                    When fewer than this many postings need scoring, skip LLM scoring and mark them as
                    skipped. 0 = always score.
                </p>
                <input
                    type="number"
                    min={0}
                    defaultValue={config.affinity_skip_threshold ?? 15}
                    key={`thresh-${config.affinity_skip_threshold}`}
                    onBlur={(e) => handleThresholdBlur(e.target.value)}
                    style={{
                        width: '80px',
                        padding: '6px 8px',
                        fontSize: '0.875rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontFamily: 'inherit',
                    }}
                />
            </div>
        </div>
    )
}

// ─── Sub-section: Ban List ────────────────────────────────────────────────────

function BanListTab(): React.ReactElement {
    const [banList, setBanList] = useState<BanListEntry[]>([])
    const [type, setType] = useState<'company' | 'domain'>('company')
    const [value, setValue] = useState('')
    const [reason, setReason] = useState('')
    const [previewCount, setPreviewCount] = useState<number | null>(null)
    const [previewing, setPreviewing] = useState(false)
    const [adding, setAdding] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        window.api.getBanList().then(setBanList)
    }, [])

    const handlePreview = useCallback(async (): Promise<void> => {
        if (!value.trim()) return
        setPreviewing(true)
        try {
            const count = await window.api.previewBanMatch(type, value.trim())
            setPreviewCount(count)
        } finally {
            setPreviewing(false)
        }
    }, [type, value])

    async function handleAdd(): Promise<void> {
        if (!value.trim()) return
        setAdding(true)
        setError(null)
        try {
            const { entry, deletedCount } = await window.api.addBanEntry({
                type,
                value: value.trim(),
                reason: reason.trim() || undefined,
            })
            setBanList((prev) => [entry, ...prev])
            setValue('')
            setReason('')
            setPreviewCount(null)
            if (deletedCount > 0) {
                // Notify user via a brief inline message
                setError(`✓ Added. ${deletedCount} matching posting(s) deleted from board.`)
                setTimeout(() => setError(null), 4000)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setAdding(false)
        }
    }

    async function handleRemove(id: string): Promise<void> {
        await window.api.removeBanEntry(id)
        setBanList((prev) => prev.filter((b) => b.id !== id))
    }

    return (
        <div>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: 0 }}>
                Ban list entries permanently exclude companies or domains. Existing matching postings are
                deleted immediately when you add an entry.
            </p>

            {/* Add form */}
            <div
                style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '20px',
                    background: '#f9fafb',
                }}
            >
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <select
                        value={type}
                        onChange={(e) => {
                            setType(e.target.value as 'company' | 'domain')
                            setPreviewCount(null)
                        }}
                        style={{
                            padding: '6px 8px',
                            fontSize: '0.875rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontFamily: 'inherit',
                        }}
                    >
                        <option value="company">Company (regex)</option>
                        <option value="domain">Domain (exact)</option>
                    </select>
                    <input
                        value={value}
                        onChange={(e) => {
                            setValue(e.target.value)
                            setPreviewCount(null)
                        }}
                        placeholder={type === 'company' ? 'e.g. Megacorp|BigTech' : 'e.g. megacorp.com'}
                        style={{
                            flex: 1,
                            padding: '6px 8px',
                            fontSize: '0.875rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontFamily: 'inherit',
                        }}
                    />
                </div>
                <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason (optional)"
                    style={{
                        display: 'block',
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '6px 8px',
                        fontSize: '0.875rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontFamily: 'inherit',
                        marginBottom: '10px',
                    }}
                />
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        onClick={handlePreview}
                        disabled={previewing || !value.trim()}
                        style={{ padding: '6px 14px', cursor: 'pointer' }}
                    >
                        {previewing ? 'Checking…' : 'Preview'}
                    </button>
                    {previewCount !== null && (
                        <span style={{ fontSize: '0.85rem', color: previewCount > 0 ? '#b91c1c' : '#16a34a' }}>
                            {previewCount > 0
                                ? `${previewCount} posting(s) will be deleted`
                                : 'No existing postings match'}
                        </span>
                    )}
                    <button
                        onClick={handleAdd}
                        disabled={adding || !value.trim()}
                        style={{
                            marginLeft: 'auto',
                            padding: '6px 16px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                        }}
                    >
                        {adding ? 'Adding…' : 'Add to Ban List'}
                    </button>
                </div>
                {error && (
                    <div
                        style={{
                            marginTop: '10px',
                            fontSize: '0.85rem',
                            color: error.startsWith('✓') ? '#166534' : 'crimson',
                        }}
                    >
                        {error}
                    </div>
                )}
            </div>

            {/* Existing entries */}
            {banList.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>No ban list entries yet.</p>
            ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {banList.map((entry) => (
                        <li
                            key={entry.id}
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '10px',
                                padding: '10px 0',
                                borderBottom: '1px solid #f3f4f6',
                            }}
                        >
                            <span
                                style={{
                                    fontSize: '0.7rem',
                                    background: entry.type === 'domain' ? '#dbeafe' : '#fce7f3',
                                    color: entry.type === 'domain' ? '#1d4ed8' : '#9d174d',
                                    padding: '2px 6px',
                                    borderRadius: '999px',
                                    whiteSpace: 'nowrap',
                                    marginTop: '2px',
                                }}
                            >
                                {entry.type}
                            </span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{entry.value}</div>
                                {entry.reason && (
                                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{entry.reason}</div>
                                )}
                            </div>
                            <button
                                onClick={() => handleRemove(entry.id)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#6b7280',
                                    padding: '0 4px',
                                    fontSize: '1rem',
                                }}
                                title="Remove"
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function SearchConfig(): React.ReactElement {
    const [tab, setTab] = useState<Tab>('intent')

    const tabStyle = (t: Tab): React.CSSProperties => ({
        padding: '8px 20px',
        cursor: 'pointer',
        fontWeight: tab === t ? 700 : 400,
        background: 'none',
        border: 'none',
        borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent',
        color: tab === t ? '#2563eb' : '#374151',
        fontSize: '0.9rem',
    })

    return (
        <div style={{ padding: '24px', maxWidth: '700px' }}>
            <h2 style={{ marginTop: 0 }}>Search Configuration</h2>

            <div
                style={{
                    display: 'flex',
                    borderBottom: '1px solid #e5e7eb',
                    marginBottom: '24px',
                }}
            >
                <button style={tabStyle('intent')} onClick={() => setTab('intent')}>
                    Intent &amp; Terms
                </button>
                <button style={tabStyle('filters')} onClick={() => setTab('filters')}>
                    Filters
                </button>
                <button style={tabStyle('banlist')} onClick={() => setTab('banlist')}>
                    Ban List
                </button>
            </div>

            {tab === 'intent' && <IntentTab />}
            {tab === 'filters' && <FiltersTab />}
            {tab === 'banlist' && <BanListTab />}
        </div>
    )
}

