import React, { useState, useEffect, useCallback } from 'react'
import type {
    ProfileEntry,
    ProfileEntryType,
    UserProfile,
    CreateProfileEntryInput,
    UpdateProfileEntryInput,
} from '../shared/ipc-types'

// ─── Constants ────────────────────────────────────────────────────────────────

const ENTRY_TYPES: ProfileEntryType[] = [
    'experience',
    'credential',
    'accomplishment',
    'skill',
    'education',
]

const TYPE_LABELS: Record<ProfileEntryType, string> = {
    experience: 'Experience',
    credential: 'Credential',
    accomplishment: 'Accomplishment',
    skill: 'Skill',
    education: 'Education',
}

const TYPE_COLORS: Record<ProfileEntryType, string> = {
    experience: '#2563eb',
    credential: '#7c3aed',
    accomplishment: '#059669',
    skill: '#d97706',
    education: '#dc2626',
}

type FilterType = ProfileEntryType | 'all'

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
    type: ProfileEntryType
    title: string
    content: string
    tagsRaw: string
    start_date: string
    end_date: string
}

function blankForm(type: ProfileEntryType = 'experience'): FormState {
    return { type, title: '', content: '', tagsRaw: '', start_date: '', end_date: '' }
}

function countWords(text: string): number {
    const t = text.trim()
    return t ? t.split(/\s+/).length : 0
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Profile(): React.ReactElement {
    const [entries, setEntries] = useState<ProfileEntry[]>([])
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
    const [filter, setFilter] = useState<FilterType>('all')
    const [mode, setMode] = useState<'list' | 'form'>('list')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState<FormState>(blankForm())
    const [formError, setFormError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [yoeInput, setYoeInput] = useState('')
    const [statusMsg, setStatusMsg] = useState<string | null>(null)

    function flash(msg: string): void {
        setStatusMsg(msg)
        setTimeout(() => setStatusMsg(null), 3500)
    }

    const load = useCallback(async () => {
        const [ents, profile] = await Promise.all([
            window.api.getProfileEntries(),
            window.api.getUserProfile(),
        ])
        setEntries(ents)
        setUserProfile(profile)
        setYoeInput(profile.yoe !== null ? String(profile.yoe) : '')
    }, [])

    useEffect(() => { load() }, [load])

    // ─── Navigation ─────────────────────────────────────────────────────────────

    function openAdd(): void {
        const defaultType: ProfileEntryType = filter !== 'all' ? filter : 'experience'
        setForm(blankForm(defaultType))
        setEditingId(null)
        setFormError(null)
        setMode('form')
    }

    function openEdit(entry: ProfileEntry): void {
        setForm({
            type: entry.type,
            title: entry.title,
            content: entry.content,
            tagsRaw: entry.tags.join(', '),
            start_date: entry.start_date ?? '',
            end_date: entry.end_date ?? '',
        })
        setEditingId(entry.id)
        setFormError(null)
        setMode('form')
    }

    function cancelForm(): void {
        setMode('list')
        setEditingId(null)
        setFormError(null)
    }

    function setField<K extends keyof FormState>(key: K, value: FormState[K]): void {
        setForm((prev) => ({ ...prev, [key]: value }))
        if (formError) setFormError(null)
    }

    // ─── Actions ─────────────────────────────────────────────────────────────────

    async function handleSave(): Promise<void> {
        if (!form.title.trim()) { setFormError('Title is required.'); return }
        if (!form.content.trim()) { setFormError('Content is required.'); return }

        setBusy(true)
        setFormError(null)

        const tags = form.tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
        const payload: CreateProfileEntryInput | UpdateProfileEntryInput = {
            type: form.type,
            title: form.title.trim(),
            content: form.content.trim(),
            tags,
            start_date: form.start_date || null,
            end_date: form.end_date || null,
        }

        try {
            if (editingId) {
                const updated = await window.api.updateProfileEntry(editingId, payload as UpdateProfileEntryInput)
                setEntries((prev) => prev.map((e) => (e.id === editingId ? updated : e)))
                flash('Entry updated.')
            } else {
                const created = await window.api.createProfileEntry(payload as CreateProfileEntryInput)
                setEntries((prev) => [created, ...prev])
                flash('Entry added.')
            }
            setMode('list')
            setEditingId(null)
        } catch (e) {
            setFormError(String(e))
        } finally {
            setBusy(false)
        }
    }

    async function handleDelete(id: string): Promise<void> {
        if (!window.confirm('Delete this entry? This cannot be undone.')) return
        await window.api.deleteProfileEntry(id)
        setEntries((prev) => prev.filter((e) => e.id !== id))
        if (editingId === id) { setMode('list'); setEditingId(null) }
        flash('Entry deleted.')
    }

    async function handleSaveYoe(): Promise<void> {
        const trimmed = yoeInput.trim()
        const val = trimmed === '' ? null : parseInt(trimmed, 10)
        if (trimmed !== '' && (isNaN(val as number) || (val as number) < 0)) {
            flash('Years of experience must be a non-negative integer.')
            return
        }
        await window.api.setUserYoe(val)
        setUserProfile((prev) => prev ? { ...prev, yoe: val } : prev)
        flash('YOE saved.')
    }

    async function handleExport(): Promise<void> {
        const filePath = await window.api.exportProfileMarkdown()
        if (filePath) flash(`Exported to ${filePath}`)
    }

    async function handleImport(): Promise<void> {
        const result = await window.api.importProfileMarkdown()
        if (result) {
            flash(`Import complete — ${result.added} added, ${result.skipped} skipped.`)
            await load()
        }
    }

    // ─── Derived state ────────────────────────────────────────────────────────

    const filtered = filter === 'all' ? entries : entries.filter((e) => e.type === filter)
    const wordCount = countWords(form.content)

    // ─── Form view ────────────────────────────────────────────────────────────

    if (mode === 'form') {
        return (
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <button className="btn" onClick={cancelForm}>← Back</button>
                    <h1 style={{ margin: 0 }}>{editingId ? 'Edit Entry' : 'New Entry'}</h1>
                </div>

                <div className="card">
                    <div className="form-row">
                        <label>Type</label>
                        <select
                            value={form.type}
                            onChange={(e) => setField('type', e.target.value as ProfileEntryType)}
                        >
                            {ENTRY_TYPES.map((t) => (
                                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-row">
                        <label>Title</label>
                        <input
                            type="text"
                            value={form.title}
                            placeholder="e.g. Senior Software Engineer at Acme Corp"
                            onChange={(e) => setField('title', e.target.value)}
                        />
                    </div>

                    <div className="form-row">
                        <label>Content</label>
                        <textarea
                            value={form.content}
                            rows={8}
                            placeholder="Describe this entry…"
                            onChange={(e) => setField('content', e.target.value)}
                            style={{ resize: 'vertical', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
                        />
                        <div className="form-hint">{wordCount} word{wordCount !== 1 ? 's' : ''}</div>
                    </div>

                    <div className="form-row">
                        <label>Tags</label>
                        <input
                            type="text"
                            value={form.tagsRaw}
                            placeholder="typescript, node.js, leadership"
                            onChange={(e) => setField('tagsRaw', e.target.value)}
                        />
                        <div className="form-hint">Comma-separated</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="form-row">
                            <label>Start date</label>
                            <input
                                type="date"
                                value={form.start_date}
                                onChange={(e) => setField('start_date', e.target.value)}
                            />
                        </div>
                        <div className="form-row">
                            <label>End date</label>
                            <input
                                type="date"
                                value={form.end_date}
                                onChange={(e) => setField('end_date', e.target.value)}
                            />
                            <div className="form-hint">Leave blank if current / ongoing</div>
                        </div>
                    </div>

                    {formError && (
                        <div style={{ marginTop: 8, fontSize: 13, color: '#dc2626' }}>{formError}</div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                        <button className="btn btn-primary" onClick={handleSave} disabled={busy}>
                            {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add entry'}
                        </button>
                        <button className="btn" onClick={cancelForm} disabled={busy}>Cancel</button>
                    </div>
                </div>
            </div>
        )
    }

    // ─── List view ────────────────────────────────────────────────────────────

    return (
        <div>
            <h1>Profile</h1>

            {/* YOE + data management row */}
            <div className="card">
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 200px' }}>
                        <div className="form-row" style={{ marginBottom: 0 }}>
                            <label>Years of experience</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    type="number"
                                    min={0}
                                    max={60}
                                    value={yoeInput}
                                    placeholder="e.g. 5"
                                    onChange={(e) => setYoeInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveYoe() }}
                                    style={{ width: 90 }}
                                />
                                <button className="btn btn-primary" onClick={handleSaveYoe}>Save</button>
                            </div>
                            <div className="form-hint">Used for YOE hard filter in job matching.</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, paddingBottom: 20 }}>
                        <button className="btn" onClick={handleExport}>Export Markdown</button>
                        <button className="btn" onClick={handleImport}>Import Markdown</button>
                    </div>
                </div>
                {statusMsg && (
                    <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-dim, #6b7280)' }}>
                        {statusMsg}
                    </div>
                )}
            </div>

            {/* Filter tabs + Add button */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                {(['all', ...ENTRY_TYPES] as FilterType[]).map((t) => {
                    const count = t === 'all' ? entries.length : entries.filter((e) => e.type === t).length
                    return (
                        <button
                            key={t}
                            className={`btn${filter === t ? ' btn-primary' : ''}`}
                            onClick={() => setFilter(t)}
                        >
                            {t === 'all' ? 'All' : TYPE_LABELS[t]} ({count})
                        </button>
                    )
                })}
                <button
                    className="btn btn-primary"
                    onClick={openAdd}
                    style={{ marginLeft: 'auto' }}
                >
                    + Add Entry
                </button>
            </div>

            {/* Entry list */}
            {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-dim, #6b7280)' }}>
                    No entries yet.{' '}
                    <button className="btn btn-primary" onClick={openAdd}>Add one</button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filtered.map((entry) => (
                        <div key={entry.id} className="card" style={{ margin: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                {/* Type badge */}
                                <span style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    background: TYPE_COLORS[entry.type],
                                    color: '#fff',
                                    flexShrink: 0,
                                    marginTop: 2,
                                    whiteSpace: 'nowrap',
                                }}>
                                    {TYPE_LABELS[entry.type]}
                                </span>

                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{entry.title}</div>

                                    {(entry.start_date || entry.end_date) && (
                                        <div style={{ fontSize: 12, color: 'var(--text-dim, #6b7280)', marginTop: 2 }}>
                                            {entry.start_date ?? '?'} → {entry.end_date ?? 'present'}
                                        </div>
                                    )}

                                    <div style={{
                                        fontSize: 13,
                                        color: 'var(--text-dim, #6b7280)',
                                        marginTop: 4,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {entry.content.slice(0, 130)}{entry.content.length > 130 ? '…' : ''}
                                    </div>

                                    {entry.tags.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                                            {entry.tags.map((tag) => (
                                                <span key={tag} style={{
                                                    fontSize: 11,
                                                    padding: '1px 6px',
                                                    borderRadius: 3,
                                                    background: 'var(--surface-2, #f3f4f6)',
                                                    color: 'var(--text-dim, #6b7280)',
                                                }}>
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                    <button
                                        className="btn"
                                        style={{ fontSize: 12, padding: '3px 10px' }}
                                        onClick={() => openEdit(entry)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        className="btn btn-danger"
                                        style={{ fontSize: 12, padding: '3px 10px' }}
                                        onClick={() => handleDelete(entry.id)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

