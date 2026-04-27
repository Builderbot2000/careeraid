import React, { useState, useEffect, useRef, useCallback } from 'react'
import type {
    ScrapeSummary,
    SearchTerm,
    BanListEntry,
    SearchConfigRow,
    AdapterInfo,
    AdapterProgress,
    AddSearchTermData,
    SearchTermSeniority,
    WorkType,
    Recency,
} from '../shared/ipc-types'
import type { ScrapeState } from '../App'

type Tab = 'intent' | 'filters' | 'banlist'

interface ScrapeProps {
    scrapeState: ScrapeState
    summary: ScrapeSummary | null
    adapterProgress: Record<string, AdapterProgress>
    errorMsg: string | null
    committing: boolean
    onRunScrape: (adapterIds: string[]) => void
    onCommit: () => void
    onDiscard: () => void
}

// ─── Condition chip ───────────────────────────────────────────────────────────

function ConditionChip({ label, color = '#f3f4f6' }: { label: string | undefined; color?: string }): React.ReactElement | null {
    if (!label) return null
    return (
        <span
            style={{
                fontSize: '0.68rem',
                color: '#374151',
                background: color,
                padding: '1px 6px',
                borderRadius: '999px',
                whiteSpace: 'nowrap',
            }}
        >
            {label}
        </span>
    )
}

// ─── Location tag input with autocomplete ────────────────────────────────────

function LocationTagInput({
    values,
    onChange,
}: {
    values: string[]
    onChange: (tags: string[]) => void
}): React.ReactElement {
    const [inputValue, setInputValue] = useState('')
    const [suggestions, setSuggestions] = useState<string[]>([])
    const [showDropdown, setShowDropdown] = useState(false)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const fetchSuggestions = useCallback((q: string) => {
        if (q.trim().length < 2) { setSuggestions([]); setShowDropdown(false); return }
        window.api.suggestLocations(q.trim()).then((results) => {
            setSuggestions(results)
            setShowDropdown(results.length > 0)
        }).catch(() => { setSuggestions([]); setShowDropdown(false) })
    }, [])

    function handleInput(e: React.ChangeEvent<HTMLInputElement>): void {
        const val = e.target.value
        setInputValue(val)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
    }

    function addTag(tag: string): void {
        const trimmed = tag.trim()
        if (!trimmed || values.includes(trimmed)) return
        onChange([...values, trimmed])
        setInputValue('')
        setSuggestions([])
        setShowDropdown(false)
    }

    function removeTag(tag: string): void {
        onChange(values.filter((v) => v !== tag))
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
        if ((e.key === 'Enter' || e.key === ',') && inputValue.trim()) {
            e.preventDefault()
            addTag(inputValue)
        } else if (e.key === 'Backspace' && !inputValue && values.length > 0) {
            onChange(values.slice(0, -1))
        } else if (e.key === 'Escape') {
            setShowDropdown(false)
        }
    }

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '4px',
                    padding: '4px 6px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    background: 'white',
                    minHeight: '32px',
                    alignItems: 'center',
                    cursor: 'text',
                }}
                onClick={() => containerRef.current?.querySelector('input')?.focus()}
            >
                {values.map((v) => (
                    <span
                        key={v}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: '#dbeafe',
                            color: '#1e40af',
                            borderRadius: '999px',
                            padding: '1px 8px',
                            fontSize: '0.75rem',
                        }}
                    >
                        {v}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeTag(v) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#1e40af', fontSize: '0.85rem', lineHeight: 1 }}
                        >×</button>
                    </span>
                ))}
                <input
                    value={inputValue}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    onFocus={() => inputValue.trim().length >= 2 && setShowDropdown(suggestions.length > 0)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    placeholder={values.length === 0 ? 'e.g. San Francisco, CA' : ''}
                    style={{
                        border: 'none',
                        outline: 'none',
                        flex: 1,
                        minWidth: '120px',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit',
                        padding: 0,
                        background: 'transparent',
                    }}
                />
            </div>
            {showDropdown && suggestions.length > 0 && (
                <ul
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 50,
                        background: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        margin: '2px 0 0',
                        padding: 0,
                        listStyle: 'none',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                        maxHeight: '180px',
                        overflowY: 'auto',
                    }}
                >
                    {suggestions.map((s) => (
                        <li
                            key={s}
                            onMouseDown={(e) => { e.preventDefault(); addTag(s) }}
                            style={{
                                padding: '6px 10px',
                                cursor: 'pointer',
                                fontSize: '0.825rem',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                        >
                            {s}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

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

function IntentTab({
    scrapeState,
    summary,
    adapterProgress,
    errorMsg,
    committing,
    onRunScrape,
    onCommit,
    onDiscard,
}: ScrapeProps): React.ReactElement {
    const [intent, setIntent] = useState('')
    const [terms, setTerms] = useState<SearchTerm[]>([])
    const [generating, setGenerating] = useState(false)
    const [generateError, setGenerateError] = useState<string | null>(null)
    const [adapters, setAdapters] = useState<AdapterInfo[]>([])
    const [selectedAdapters, setSelectedAdapters] = useState<Set<string>>(new Set())

    const emptyTermData: AddSearchTermData = { role: '', locations: null, seniorities: null, work_type: null, recency: null, max_results: null }
    const [newTermData, setNewTermData] = useState<AddSearchTermData>(emptyTermData)
    const [editingId, setEditingId] = useState<string | null>(null)
    const intentRef = useRef(intent)
    intentRef.current = intent

    useEffect(() => {
        window.api.getSearchConfig().then((cfg) => setIntent(cfg.intent ?? ''))
        window.api.getSearchTerms().then(setTerms)
        window.api.listAdapters().then((list) => {
            setAdapters(list)
            setSelectedAdapters(new Set(list.filter((a) => a.available && a.id !== 'mock').map((a) => a.id)))
        })
    }, [])

    function handleIntentBlur(): void {
        window.api.updateSearchConfig({ intent: intentRef.current || null }).catch(console.error)
    }

    async function handleGenerate(): Promise<void> {
        setGenerating(true)
        setGenerateError(null)
        try {
            const generated = await window.api.generateSearchTerms()
            setTerms(generated)
        } catch (err) {
            setGenerateError(err instanceof Error ? err.message : String(err))
        } finally {
            setGenerating(false)
        }
    }

    async function handleGenerateFromProfile(): Promise<void> {
        setGenerating(true)
        setGenerateError(null)
        try {
            const generated = await window.api.generateSearchTermsFromProfile()
            setTerms(generated)
        } catch (err) {
            setGenerateError(err instanceof Error ? err.message : String(err))
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

    function openEdit(t: SearchTerm): void {
        setEditingId(t.id)
        setNewTermData({ role: t.term, locations: t.locations, seniorities: t.seniorities, work_type: t.work_type, recency: t.recency, max_results: t.max_results })
    }

    function cancelEdit(): void {
        setEditingId(null)
        setNewTermData(emptyTermData)
    }

    async function handleAddTerm(): Promise<void> {
        if (!newTermData.role.trim()) return
        if (editingId) {
            await window.api.updateSearchTerm(editingId, {
                term: newTermData.role,
                locations: newTermData.locations,
                seniorities: newTermData.seniorities,
                work_type: newTermData.work_type,
                recency: newTermData.recency,
                max_results: newTermData.max_results,
            })
            setTerms((prev) =>
                prev.map((t) =>
                    t.id === editingId
                        ? { ...t, term: newTermData.role, locations: newTermData.locations ?? null, seniorities: newTermData.seniorities ?? null, work_type: newTermData.work_type ?? null, recency: newTermData.recency ?? null, max_results: newTermData.max_results ?? null }
                        : t
                )
            )
            setEditingId(null)
            setNewTermData(emptyTermData)
        } else {
            const added = await window.api.addSearchTerm(newTermData)
            setTerms((prev) => [...prev, added])
            setNewTermData(emptyTermData)
        }
    }

    function handleRunScrape(): void {
        onRunScrape(Array.from(selectedAdapters))
    }

    function handleCommit(): void {
        onCommit()
    }

    function handleDiscard(): void {
        onDiscard()
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
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            data-testid="search-generate-btn"
                            onClick={handleGenerate}
                            disabled={generating}
                            style={{ padding: '6px 14px', fontWeight: 600, cursor: 'pointer' }}
                        >
                            {generating ? 'Generating…' : 'Generate from Intent'}
                        </button>
                        <button
                            data-testid="search-generate-from-profile-btn"
                            onClick={handleGenerateFromProfile}
                            disabled={generating}
                            style={{ padding: '6px 14px', fontWeight: 600, cursor: 'pointer' }}
                        >
                            {generating ? 'Generating…' : 'Generate from Profile'}
                        </button>
                    </div>
                </div>

                {generateError && (
                    <div style={{ marginBottom: '8px', color: 'crimson', fontSize: '0.85rem' }}>
                        {generateError}
                    </div>
                )}

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
                                    alignItems: 'flex-start',
                                    gap: '8px',
                                    padding: '6px 0',
                                    borderBottom: '1px solid #f3f4f6',
                                }}
                            >
                                <input
                                    data-testid={`search-term-toggle-${t.id}`}
                                    type="checkbox"
                                    checked={t.enabled}
                                    style={{ marginTop: '2px' }}
                                    onChange={(e) => handleToggle(t.id, e.target.checked)}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <span
                                        style={{
                                            fontSize: '0.875rem',
                                            textDecoration: t.enabled ? 'none' : 'line-through',
                                            color: t.enabled ? undefined : '#9ca3af',
                                        }}
                                    >
                                        {t.term}
                                    </span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                        {t.locations?.map((loc) => <ConditionChip key={loc} label={loc} />)}
                                        {t.seniorities?.map((s) => <ConditionChip key={s} label={s} />)}
                                        {t.work_type?.map((w) => <ConditionChip key={w} label={w} color="#dbeafe" />)}
                                        {t.recency && <ConditionChip label={{ day: 'past day', week: 'past week', month: 'past month' }[t.recency]} />}
                                        {t.max_results != null && <ConditionChip label={`max ${t.max_results}`} />}
                                    </div>
                                </div>
                                <span
                                    style={{
                                        fontSize: '0.7rem',
                                        color: '#9ca3af',
                                        background: '#f3f4f6',
                                        padding: '1px 6px',
                                        borderRadius: '999px',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                    }}
                                >
                                    {t.source === 'llm_generated' ? 'AI' : 'manual'}
                                </span>
                                <button
                                    data-testid={`search-term-edit-${t.id}`}
                                    onClick={() => openEdit(t)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#6b7280',
                                        padding: '0 4px',
                                        fontSize: '0.85rem',
                                        flexShrink: 0,
                                    }}
                                    title="Edit"
                                >
                                    ✎
                                </button>
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
                                        flexShrink: 0,
                                    }}
                                    title="Delete"
                                >
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                {/* Structured add form */}
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px', background: '#f9fafb' }}>
                    <p style={{ margin: '0 0 10px', fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>{editingId ? 'Edit term' : 'Add term manually'}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '3px' }}>Role *</label>
                            <input
                                data-testid="search-add-role"
                                value={newTermData.role}
                                onChange={(e) => setNewTermData((p) => ({ ...p, role: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddTerm()}
                                placeholder="e.g. senior backend engineer"
                                style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: '4px', fontFamily: 'inherit' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '3px' }}>Recency</label>
                            <select
                                data-testid="search-add-recency"
                                value={newTermData.recency ?? ''}
                                onChange={(e) => setNewTermData((p) => ({ ...p, recency: (e.target.value || null) as Recency | null }))}
                                style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: '4px', fontFamily: 'inherit', background: 'white' }}
                            >
                                <option value="">Any time</option>
                                <option value="day">Past day</option>
                                <option value="week">Past week</option>
                                <option value="month">Past month</option>
                            </select>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '3px' }}>Location(s)</label>
                            <LocationTagInput
                                values={newTermData.locations ?? []}
                                onChange={(tags) => setNewTermData((p) => ({ ...p, locations: tags.length ? tags : null }))}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '5px' }}>Seniority</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {(['intern', 'junior', 'mid', 'senior', 'staff'] as SearchTermSeniority[]).map((level) => (
                                    <label key={level} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.825rem', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={(newTermData.seniorities ?? []).includes(level)}
                                            onChange={(e) => {
                                                setNewTermData((p) => {
                                                    const cur = p.seniorities ?? []
                                                    const next = e.target.checked ? [...cur, level] : cur.filter((s) => s !== level)
                                                    return { ...p, seniorities: next.length ? next : null }
                                                })
                                            }}
                                        />
                                        {level.charAt(0).toUpperCase() + level.slice(1)}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '5px' }}>Work Type</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {(['remote', 'hybrid', 'onsite'] as WorkType[]).map((wt) => (
                                    <label key={wt} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.825rem', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={(newTermData.work_type ?? []).includes(wt)}
                                            onChange={(e) => {
                                                setNewTermData((p) => {
                                                    const cur = p.work_type ?? []
                                                    const next = e.target.checked ? [...cur, wt] : cur.filter((w) => w !== wt)
                                                    return { ...p, work_type: next.length ? next : null }
                                                })
                                            }}
                                        />
                                        {wt.charAt(0).toUpperCase() + wt.slice(1)}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '3px' }}>Max results</label>
                            <input
                                data-testid="search-add-max-results"
                                type="number"
                                min={1}
                                value={newTermData.max_results ?? ''}
                                onChange={(e) => setNewTermData((p) => ({ ...p, max_results: e.target.value ? parseInt(e.target.value, 10) : null }))}
                                placeholder="75"
                                style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: '4px', fontFamily: 'inherit' }}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            data-testid="search-add-btn"
                            onClick={handleAddTerm}
                            disabled={!newTermData.role.trim()}
                            style={{ padding: '6px 16px', cursor: 'pointer', fontWeight: 600 }}
                        >
                            {editingId ? 'Save' : 'Add'}
                        </button>
                        {editingId && (
                            <button
                                data-testid="search-edit-cancel-btn"
                                onClick={cancelEdit}
                                style={{ padding: '6px 16px', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
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
            else { setDomainValue(''); setDomainPreview(null) } if (deletedCount > 0) {
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

export default function SearchConfig(props: ScrapeProps): React.ReactElement {
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

            {tab === 'intent' && <IntentTab {...props} />}
            {tab === 'filters' && <FiltersTab />}
            {tab === 'banlist' && <BanListTab />}
        </div>
    )
}

