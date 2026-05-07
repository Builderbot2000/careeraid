import React from 'react'
import type { ProfileEntry } from '../../shared/ipc-types'
import { ENTRY_TYPES, TYPE_LABELS, TYPE_COLORS } from './constants'
import type { FilterType } from './constants'

interface EntryListProps {
    entries: ProfileEntry[]
    filter: FilterType
    statusMsg: string | null
    yoeInput: string
    qualsIndustry: string
    qualsLanguages: string
    qualsCitizenship: string
    qualsDriversLicense: boolean
    pdfImporting: boolean
    setFilter: (f: FilterType) => void
    setYoeInput: (v: string) => void
    setQualsIndustry: (v: string) => void
    setQualsLanguages: (v: string) => void
    setQualsCitizenship: (v: string) => void
    setQualsDriversLicense: (v: boolean) => void
    onSaveYoe: () => void
    onSaveQualifications: () => void
    onAdd: () => void
    onEdit: (entry: ProfileEntry) => void
    onDelete: (id: string) => void
    onExport: () => void
    onImport: () => void
    onImportPdf: () => void
}

export function EntryList({
    entries,
    filter,
    statusMsg,
    yoeInput,
    qualsIndustry,
    qualsLanguages,
    qualsCitizenship,
    qualsDriversLicense,
    pdfImporting,
    setFilter,
    setYoeInput,
    setQualsIndustry,
    setQualsLanguages,
    setQualsCitizenship,
    setQualsDriversLicense,
    onSaveYoe,
    onSaveQualifications,
    onAdd,
    onEdit,
    onDelete,
    onExport,
    onImport,
    onImportPdf,
}: EntryListProps): React.ReactElement {
    const filtered = filter === 'all' ? entries : entries.filter((e) => e.type === filter)

    return (
        <div>
            <h1>Profile</h1>

            {/* YOE + data management row */}
            <div className="card">
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 200px' }}>
                        <div className="form-row" style={{ marginBottom: 0 }}>
                            <label htmlFor="profile-yoe">Years of experience</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    id="profile-yoe"
                                    data-testid="profile-yoe-input"
                                    type="number"
                                    min={0}
                                    max={60}
                                    value={yoeInput}
                                    placeholder="e.g. 5"
                                    onChange={(e) => setYoeInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') onSaveYoe() }}
                                    style={{ width: 90 }}
                                />
                                <button data-testid="profile-yoe-save" className="btn btn-primary" onClick={onSaveYoe}>Save</button>
                            </div>
                            <div className="form-hint">Used for YOE hard filter in job matching.</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, paddingBottom: 20 }}>
                        <button className="btn" onClick={onExport}>Export Markdown</button>
                        <button className="btn" onClick={onImport}>Import Markdown</button>
                        <button
                            data-testid="profile-import-pdf-btn"
                            className="btn"
                            onClick={onImportPdf}
                            disabled={pdfImporting}
                            title="Upload a resume PDF and let AI populate your profile"
                        >
                            {pdfImporting ? 'Importing…' : 'Import from Resume PDF'}
                        </button>
                    </div>
                </div>
                {statusMsg && (
                    <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-dim, #6b7280)' }}>
                        {statusMsg}
                    </div>
                )}
            </div>

            {/* Fixed qualifications card */}
            <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 12 }}>Fixed Qualifications</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim, #6b7280)', marginBottom: 12 }}>
                    Authoritative facts fed directly to the job evaluator — overrides inferences from your experience text.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', alignItems: 'end' }}>
                    <div className="form-row" style={{ marginBottom: 0 }}>
                        <label htmlFor="quals-industry">Industry (for YOE context)</label>
                        <input
                            id="quals-industry"
                            type="text"
                            value={qualsIndustry}
                            placeholder="e.g. fintech, SaaS, healthcare"
                            onChange={(e) => setQualsIndustry(e.target.value)}
                        />
                    </div>
                    <div className="form-row" style={{ marginBottom: 0 }}>
                        <label htmlFor="quals-languages">Spoken languages</label>
                        <input
                            id="quals-languages"
                            type="text"
                            value={qualsLanguages}
                            placeholder="e.g. English, French"
                            onChange={(e) => setQualsLanguages(e.target.value)}
                        />
                    </div>
                    <div className="form-row" style={{ marginBottom: 0 }}>
                        <label htmlFor="quals-citizenship">Citizenship / visa status</label>
                        <input
                            id="quals-citizenship"
                            type="text"
                            value={qualsCitizenship}
                            placeholder="e.g. EU citizen — no sponsorship needed"
                            onChange={(e) => setQualsCitizenship(e.target.value)}
                        />
                    </div>
                    <div className="form-row" style={{ marginBottom: 0 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={qualsDriversLicense}
                                onChange={(e) => setQualsDriversLicense(e.target.checked)}
                            />
                            Has driver&apos;s licence
                        </label>
                    </div>
                </div>
                <div style={{ marginTop: 12 }}>
                    <button className="btn btn-primary" onClick={onSaveQualifications}>Save Qualifications</button>
                </div>
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
                    data-testid="profile-add-btn"
                    className="btn btn-primary"
                    onClick={onAdd}
                    style={{ marginLeft: 'auto' }}
                >
                    + Add Entry
                </button>
            </div>

            {/* Entry list */}
            {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-dim, #6b7280)' }}>
                    No entries yet.{' '}
                    <button className="btn btn-primary" onClick={onAdd}>Add one</button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filtered.map((entry) => (
                        <div key={entry.id} data-testid={`profile-entry-${entry.id}`} className="card" style={{ margin: 0 }}>
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
                                    <div style={{ fontWeight: 600, fontSize: 14, cursor: 'pointer' }} onClick={() => onEdit(entry)}>{entry.title}</div>

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
                                        data-testid={`profile-entry-edit-${entry.id}`}
                                        className="btn"
                                        style={{ fontSize: 12, padding: '3px 10px' }}
                                        onClick={() => onEdit(entry)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        data-testid={`profile-entry-delete-${entry.id}`}
                                        className="btn btn-danger"
                                        style={{ fontSize: 12, padding: '3px 10px' }}
                                        onClick={() => onDelete(entry.id)}
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
