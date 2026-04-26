import React, { useState, useEffect, useRef } from 'react'
import type {
    ScrapeSummary,
    SearchTerm,
    BanListEntry,
    SearchConfigRow,
    AdapterInfo,
    AdapterProgress,
} from '../shared/ipc-types'

type ScrapeState = 'idle' | 'running' | 'pending_commit' | 'error'
type Tab = 'intent' | 'filters' | 'banlist'

// ─── Adapter progress badge ───────────────────────────────────────────────────

function AdapterStatusBadge({
    progress,
    available,
}: {
    progress?: AdapterProgress
    available: boolean
}): React.ReactElement | null {
    if (!available) {
        return <span style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>Unavailable</span>
    }
    if (!progress) return null
    if (progress.status === 'running') {
        return (
            <span style={{ fontSize: '0.75rem', color: '#4dabf7', whiteSpace: 'nowrap' }}>
                {progress.fetched != null && progress.fetched > 0
                    ? `Running… (${progress.fetched})`
                    : 'Running…'}
            </span>
        )
    }
    if (progress.status === 'done') {
        return (
            <span style={{ fontSize: '0.75rem', color: '#16a34a', whiteSpace: 'nowrap' }}>
                ✓ {progress.fetched} fetched
            </span>
        )
    }
    if (progress.status === 'error') {
        return (
            <span
                style={{
                    fontSize: '0.75rem',
                    color: '#fa5252',
                    whiteSpace: 'nowrap',
                    maxWidth: '160px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'inline-block',
                }}
                title={progress.error}
            >
                ✗ Error
            </span>
        )
    }
    return null
}

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
    const [adapters, setAdapters] = useState<AdapterInfo[]>([])
    const [selectedAdapters, setSelectedAdapters] = useState<Set<string>>(new Set())
    const [adapterProgress, setAdapterProgress] = useState<Record<string, AdapterProgress>>({})
    const intentRef = useRef(intent)
    intentRef.current = intent

    useEffect(() => {
        window.api.getSearchConfig().then((cfg) => setIntent(cfg.intent ?? ''))
        window.api.getSearchTerms().then(setTerms)
        window.api.listAdapters().then((list) => {
            setAdapters(list)
            setSelectedAdapters(new Set(list.filter((a) => a.available).map((a) => a.id)))
        })
        window.api.onAdapterProgress((p) => {
            setAdapterProgress((prev) => ({ ...prev, [p.adapterId]: p }))
        })
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
        setTerms((prev) => prev.map((t) => (t.id === id ? { ...t, enabled } : t)))
        await window.api.updateSearchTerm(id, { enabled })
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
        setAdapterProgress({})
        try {
            const result = await window.api.runScrape(Array.from(selectedAdapters))
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    {adapters.map((adapter) => (
                        <div
                            key={adapter.id}
                            style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '12px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                opacity: adapter.available ? 1 : 0.5,
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={selectedAdapters.has(adapter.id)}
                                disabled={
                                    !adapter.available ||
                                    scrapeState === 'running' ||
                                    scrapeState === 'pending_commit'
                                }
                                onChange={(e) => {
                                    setSelectedAdapters((prev) => {
                                        const next = new Set(prev)
                                        if (e.target.checked) next.add(adapter.id)
                                        else next.delete(adapter.id)
                                        return next
                                    })
                                }}
                                style={{ cursor: adapter.available ? 'pointer' : 'not-allowed', flexShrink: 0 }}
                            />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>{adapter.name}</div>
                                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>
                                    {adapter.description}
                                </div>
                            </div>
                            <AdapterStatusBadge
                                progress={adapterProgress[adapter.id]}
                                available={adapter.available}
                            />
                        </div>
                    ))}
                </div>
                <button
                    data-testid="search-run-scrape-btn"
                    onClick={handleRunScrape}
                    disabled={
                        scrapeState === 'running' ||
                        scrapeState === 'pending_commit' ||
                        selectedAdapters.size === 0
                    }
                    style={{ padding: '8px 16px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                    {scrapeState === 'running' ? 'Running…' : 'Run Scrape'}
                </button>

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
    const [excludedStack, setExcludedStack] = useState('')
    const [requiredKeywords, setRequiredKeywords] = useState('')
    const [excludedKeywords, setExcludedKeywords] = useState('')
    const [threshold, setThreshold] = useState('')

    useEffect(() => {
        window.api.getSearchConfig().then((cfg) => {
            setConfig(cfg)
            setExcludedStack(arrayToField(cfg.excluded_stack))
            setRequiredKeywords(arrayToField(cfg.required_keywords))
            setExcludedKeywords(arrayToField(cfg.excluded_keywords))
            setThreshold(String(cfg.affinity_skip_threshold ?? 15))
        })
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

    async function handleSaveAll(): Promise<void> {
        const n = parseInt(threshold, 10)
        await save({
            required_keywords: fieldToArray(requiredKeywords),
            excluded_keywords: fieldToArray(excludedKeywords),
            excluded_stack: fieldToArray(excludedStack),
            ...((!isNaN(n) && n >= 0) ? { affinity_skip_threshold: n } : {}),
        })
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
                <label htmlFor="filters-required-keywords" style={labelStyle}>Required Keywords (OR — one per line)</label>
                <p style={hintStyle}>
                    At least one must match in title or tech stack. Prefix with <code>re:</code> for regex.
                </p>
                <textarea
                    id="filters-required-keywords"
                    rows={4}
                    value={requiredKeywords}
                    onChange={(e) => setRequiredKeywords(e.target.value)}
                    onBlur={(e) => handleKeywordsBlur('required_keywords', e.target.value)}
                    style={textareaStyle}
                    placeholder="e.g. TypeScript&#10;Go&#10;re:rust|zig"
                />
            </div>

            <div style={{ marginBottom: '24px' }}>
                <label htmlFor="filters-excluded-keywords" style={labelStyle}>Excluded Keywords (one per line)</label>
                <p style={hintStyle}>
                    Drop postings matching any of these. Prefix with <code>re:</code> for regex.
                </p>
                <textarea
                    id="filters-excluded-keywords"
                    rows={4}
                    value={excludedKeywords}
                    onChange={(e) => setExcludedKeywords(e.target.value)}
                    onBlur={(e) => handleKeywordsBlur('excluded_keywords', e.target.value)}
                    style={textareaStyle}
                    placeholder="e.g. internship&#10;re:junior|entry.level"
                />
            </div>

            <div style={{ marginBottom: '24px' }}>
                <label htmlFor="filters-excluded-stack" style={labelStyle}>Excluded Tech Stack (one per line)</label>
                <p style={hintStyle}>
                    Drop postings where tech_stack contains any of these terms.
                </p>
                <textarea
                    id="filters-excluded-stack"
                    rows={4}
                    value={excludedStack}
                    onChange={(e) => setExcludedStack(e.target.value)}
                    onBlur={(e) => handleStackBlur(e.target.value)}
                    style={textareaStyle}
                    placeholder="e.g. PHP&#10;Ruby on Rails"
                />
            </div>

            <div style={{ marginBottom: '24px' }}>
                <label htmlFor="filters-threshold" style={labelStyle}>Affinity Scoring Skip Threshold</label>
                <p style={hintStyle}>
                    When fewer than this many postings need scoring, skip LLM scoring and mark them as
                    skipped. 0 = always score.
                </p>
                <input
                    id="filters-threshold"
                    type="number"
                    min={0}
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
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

            <button
                onClick={handleSaveAll}
                style={{ padding: '8px 20px', fontWeight: 600, cursor: 'pointer' }}
            >
                Save
            </button>
        </div>
    )
}

// ─── Sub-section: Ban List ────────────────────────────────────────────────────

function BanListTab(): React.ReactElement {
    const [banList, setBanList] = useState<BanListEntry[]>([])
    const [companyValue, setCompanyValue] = useState('')
    const [domainValue, setDomainValue] = useState('')
    const [companyPreview, setCompanyPreview] = useState<number | null>(null)
    const [domainPreview, setDomainPreview] = useState<number | null>(null)
    const [adding, setAdding] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        window.api.getBanList().then(setBanList)
    }, [])

    // Auto-preview company bans with debounce
    useEffect(() => {
        if (!companyValue.trim()) { setCompanyPreview(null); return }
        const timer = setTimeout(async () => {
            const count = await window.api.previewBanMatch('company', companyValue.trim())
            setCompanyPreview(count)
        }, 400)
        return () => clearTimeout(timer)
    }, [companyValue])

    // Auto-preview domain bans with debounce
    useEffect(() => {
        if (!domainValue.trim()) { setDomainPreview(null); return }
        const timer = setTimeout(async () => {
            const count = await window.api.previewBanMatch('domain', domainValue.trim())
            setDomainPreview(count)
        }, 400)
        return () => clearTimeout(timer)
    }, [domainValue])

    async function handleAdd(): Promise<void> {
        // Submit company ban if filled; otherwise domain ban
        const type: 'company' | 'domain' = companyValue.trim() ? 'company' : 'domain'
        const val = type === 'company' ? companyValue : domainValue
        if (!val.trim()) return
        setAdding(true)
        setError(null)
        try {
            const { entry, deletedCount } = await window.api.addBanEntry({ type, value: val.trim() })
            setBanList((prev) => [entry, ...prev])
            if (type === 'company') { setCompanyValue(''); setCompanyPreview(null) }
            else { setDomainValue(''); setDomainPreview(null) }            if (deletedCount > 0) {
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

    const inputStyle: React.CSSProperties = {
        flex: 1,
        padding: '6px 8px',
        fontSize: '0.875rem',
        border: '1px solid #d1d5db',
        borderRadius: '4px',
        fontFamily: 'inherit',
    }
    const labelStyle: React.CSSProperties = {
        fontSize: '0.8rem',
        fontWeight: 600,
        color: '#374151',
        minWidth: '60px',
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
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                }}
            >
                {/* Company row */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label htmlFor="ban-company" style={labelStyle}>Company</label>
                    <input
                        id="ban-company"
                        value={companyValue}
                        onChange={(e) => setCompanyValue(e.target.value)}
                        placeholder="Company name pattern (e.g. Megacorp|BigTech)"
                        style={inputStyle}
                    />
                    {companyPreview !== null && (
                        <span style={{ fontSize: '0.8rem', color: companyPreview > 0 ? '#b91c1c' : '#16a34a', whiteSpace: 'nowrap' }}>
                            {companyPreview > 0 ? `${companyPreview} posting(s) will be deleted` : 'No matches'}
                        </span>
                    )}
                </div>

                {/* Domain row */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label htmlFor="ban-domain" style={labelStyle}>Domain</label>
                    <input
                        id="ban-domain"
                        value={domainValue}
                        onChange={(e) => setDomainValue(e.target.value)}
                        placeholder="Domain to ban (e.g. megacorp.com)"
                        style={inputStyle}
                    />
                    {domainPreview !== null && (
                        <span style={{ fontSize: '0.8rem', color: domainPreview > 0 ? '#b91c1c' : '#16a34a', whiteSpace: 'nowrap' }}>
                            {domainPreview > 0 ? `${domainPreview} posting(s) will be deleted` : 'No matches'}
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleAdd}
                        disabled={adding || (!companyValue.trim() && !domainValue.trim())}
                        style={{ padding: '6px 16px', fontWeight: 600, cursor: 'pointer', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px' }}
                    >
                        {adding ? 'Adding…' : 'Add ban'}
                    </button>
                </div>

                {error && (
                    <div style={{ fontSize: '0.85rem', color: error.startsWith('✓') ? '#166534' : 'crimson' }}>
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

