import React, { useState, useEffect } from 'react'
import type { JobPosting, PostingStatus } from '../shared/ipc-types'

const PAGE_SIZE = 20

const TRACKER_STATUSES: PostingStatus[] = [
    'favorited',
    'applied',
    'interviewing',
    'offer',
    'rejected',
    'ghosted',
]

const NEXT_STATUS: Partial<Record<PostingStatus, PostingStatus>> = {
    favorited: 'applied',
    applied: 'interviewing',
    interviewing: 'offer',
}

function formatDate(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })
}

function Pagination({
    page,
    totalPages,
    onPage,
}: {
    page: number
    totalPages: number
    onPage: (p: number) => void
}): React.ReactElement | null {
    if (totalPages <= 1) return null
    return (
        <div style={{ display: 'flex', gap: '4px', marginTop: '16px', alignItems: 'center' }}>
            <button
                disabled={page === 1}
                onClick={() => onPage(page - 1)}
                style={{ padding: '4px 10px', cursor: 'pointer', fontSize: '0.85rem' }}
            >
                ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                    key={p}
                    onClick={() => onPage(p)}
                    style={{
                        padding: '4px 10px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: p === page ? 700 : 400,
                        background: p === page ? '#2563eb' : undefined,
                        color: p === page ? 'white' : undefined,
                        border: p === page ? '1px solid #2563eb' : '1px solid #d1d5db',
                        borderRadius: '4px',
                    }}
                >
                    {p}
                </button>
            ))}
            <button
                disabled={page === totalPages}
                onClick={() => onPage(page + 1)}
                style={{ padding: '4px 10px', cursor: 'pointer', fontSize: '0.85rem' }}
            >
                ›
            </button>
        </div>
    )
}

export default function Tracker(): React.ReactElement {
    const [postings, setPostings] = useState<JobPosting[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [page, setPage] = useState(1)
    const [selected, setSelected] = useState<Set<string>>(new Set())

    useEffect(() => {
        window.api
            .getTrackerPostings()
            .then(setPostings)
            .catch((err) => setError(err instanceof Error ? err.message : String(err)))
            .finally(() => setLoading(false))
    }, [])

    async function handleStatusChange(id: string, status: PostingStatus): Promise<void> {
        try {
            await window.api.updatePostingStatus(id, status)
            setPostings((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)))
        } catch (err) {
            console.error('Failed to update status', err)
        }
    }

    function toggleSelect(id: string): void {
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }

    function toggleSelectPage(): void {
        const pageIds = pagePostings?.map((p) => p.id) ?? []
        const allSelected = pageIds.every((id) => selected.has(id))
        setSelected((prev) => {
            const next = new Set(prev)
            if (allSelected) pageIds.forEach((id) => next.delete(id))
            else pageIds.forEach((id) => next.add(id))
            return next
        })
    }

    async function handleDelete(): Promise<void> {
        const ids = [...selected]
        await window.api.deletePostings(ids)
        setPostings((prev) => prev.filter((p) => !selected.has(p.id)))
        setSelected(new Set())
    }

    if (loading) return <div style={{ padding: '24px', color: '#6b7280' }}>Loading…</div>
    if (error) return <div style={{ padding: '24px', color: 'crimson' }}>Error: {error}</div>

    if (postings.length === 0) {
        return (
            <div style={{ padding: '24px', color: '#6b7280' }}>
                No applications tracked yet. Apply to a job from the Resume view to see it here.
            </div>
        )
    }

    const totalPages = Math.max(1, Math.ceil(postings.length / PAGE_SIZE))
    const pagePostings = postings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    const allPageSelected = pagePostings.length > 0 && pagePostings.every((p) => selected.has(p.id))
    const somePageSelected = pagePostings.some((p) => selected.has(p.id))

    return (
        <div style={{ padding: '24px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <h2 style={{ margin: 0 }}>
                    Tracker{' '}
                    <span style={{ fontSize: '0.85rem', fontWeight: 400, color: '#6b7280' }}>
                        ({postings.length})
                    </span>
                </h2>
                {selected.size > 0 && (
                    <button
                        onClick={handleDelete}
                        style={{
                            fontSize: '0.8rem',
                            padding: '4px 12px',
                            cursor: 'pointer',
                            background: '#dc2626',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontWeight: 600,
                        }}
                    >
                        Delete ({selected.size})
                    </button>
                )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ padding: '8px 10px 8px 0', width: '28px' }}>
                            <input
                                type="checkbox"
                                checked={allPageSelected}
                                ref={(el) => { if (el) el.indeterminate = somePageSelected && !allPageSelected }}
                                onChange={toggleSelectPage}
                                style={{ cursor: 'pointer' }}
                            />
                        </th>
                        <th style={{ padding: '8px 12px 8px 0', fontWeight: 600, color: '#374151' }}>Company</th>
                        <th style={{ padding: '8px 12px 8px 0', fontWeight: 600, color: '#374151' }}>Role</th>
                        <th style={{ padding: '8px 12px 8px 0', fontWeight: 600, color: '#374151' }}>Source</th>
                        <th style={{ padding: '8px 12px 8px 0', fontWeight: 600, color: '#374151' }}>Last Updated</th>
                        <th style={{ padding: '8px 12px 8px 0', fontWeight: 600, color: '#374151' }}>Status</th>
                        <th style={{ padding: '8px 0', fontWeight: 600, color: '#374151' }}>Link</th>
                    </tr>
                </thead>
                <tbody>
                    {pagePostings.map((posting) => (
                        <tr key={posting.id} data-testid={`tracker-row-${posting.id}`} style={{ borderBottom: '1px solid #f3f4f6', background: selected.has(posting.id) ? '#eff6ff' : undefined }}>
                            <td style={{ padding: '10px 10px 10px 0' }}>
                                <input
                                    type="checkbox"
                                    checked={selected.has(posting.id)}
                                    onChange={() => toggleSelect(posting.id)}
                                    style={{ cursor: 'pointer' }}
                                />
                            </td>
                            <td style={{ padding: '10px 12px 10px 0', fontWeight: 600 }}>{posting.company}</td>
                            <td
                                style={{
                                    padding: '10px 12px 10px 0',
                                    maxWidth: '220px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {posting.title}
                            </td>
                            <td
                                style={{
                                    padding: '10px 12px 10px 0',
                                    color: '#6b7280',
                                    textTransform: 'capitalize',
                                }}
                            >
                                {posting.source}
                            </td>
                            <td style={{ padding: '10px 12px 10px 0', color: '#6b7280', whiteSpace: 'nowrap' }}>
                                {formatDate(posting.last_seen_at)}
                            </td>
                            <td style={{ padding: '10px 12px 10px 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <select
                                        data-testid={`tracker-status-select-${posting.id}`}
                                        value={posting.status}
                                        onChange={(e) => handleStatusChange(posting.id, e.target.value as PostingStatus)}
                                        style={{
                                            fontSize: '0.8rem',
                                            padding: '3px 6px',
                                            borderRadius: '4px',
                                            border: '1px solid #d1d5db',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {TRACKER_STATUSES.map((s) => (
                                            <option key={s} value={s} style={{ textTransform: 'capitalize' }}>
                                                {s}
                                            </option>
                                        ))}
                                    </select>
                                    {NEXT_STATUS[posting.status] && (
                                        <button
                                            onClick={() => handleStatusChange(posting.id, NEXT_STATUS[posting.status]!)}
                                            style={{ fontSize: '0.7rem', padding: '2px 6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                            title={`Advance to ${NEXT_STATUS[posting.status]}`}
                                        >
                                            → {NEXT_STATUS[posting.status]}
                                        </button>
                                    )}
                                </div>
                            </td>
                            <td style={{ padding: '10px 0' }}>
                                <button
                                    onClick={() => window.api.openExternal(posting.url).catch(console.error)}
                                    style={{ fontSize: '0.78rem', padding: '4px 10px', cursor: 'pointer' }}
                                >
                                    Open ↗
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <Pagination page={page} totalPages={totalPages} onPage={(p) => { setPage(p); setSelected(new Set()) }} />
        </div>
    )
}

