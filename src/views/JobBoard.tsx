import React, { useState, useEffect, useCallback } from 'react'
import type { JobPosting } from '../shared/ipc-types'

const PAGE_SIZE = 50

interface JobBoardProps {
    onNavigateToResume: (posting: JobPosting) => void
}

function formatPostedAt(posted_at: string | null, fetched_at: string): string {
    const dateStr = posted_at ?? fetched_at
    const date = new Date(dateStr)
    const diffMs = Date.now() - date.getTime()
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffDays === 0) return 'today'
    if (diffDays === 1) return '1d ago'
    return `${diffDays}d ago`
}

function StatusBadge({ status }: { status: JobPosting['status'] }): React.ReactElement {
    const colors: Record<string, string> = {
        new: '#3b82f6',
        viewed: '#6b7280',
        favorited: '#f59e0b',
        applied: '#8b5cf6',
        interviewing: '#0891b2',
        offer: '#16a34a',
        rejected: '#dc2626',
        ghosted: '#9ca3af',
    }
    return (
        <span
            style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#fff',
                background: colors[status] ?? '#6b7280',
                textTransform: 'capitalize',
            }}
        >
            {status}
        </span>
    )
}

function AffinityBadge({
    score,
    skipped,
}: {
    score: number | null
    skipped: boolean
}): React.ReactElement {
    if (skipped) {
        return (
            <span
                style={{
                    display: 'inline-block',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    background: '#f3f4f6',
                    color: '#9ca3af',
                }}
                title="Affinity scoring skipped (below threshold)"
            >
                –
            </span>
        )
    }
    if (score === null) {
        return (
            <span
                style={{
                    display: 'inline-block',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    background: '#f3f4f6',
                    color: '#9ca3af',
                }}
                title="Not yet scored"
            >
                ?
            </span>
        )
    }
    const pct = Math.round(score * 100)
    const bg =
        pct >= 75 ? '#dcfce7' : pct >= 50 ? '#fef9c3' : pct >= 25 ? '#ffedd5' : '#fee2e2'
    const fg =
        pct >= 75 ? '#166534' : pct >= 50 ? '#854d0e' : pct >= 25 ? '#9a3412' : '#991b1b'
    return (
        <span
            style={{
                display: 'inline-block',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '0.72rem',
                fontWeight: 700,
                background: bg,
                color: fg,
            }}
            title={`Affinity score: ${pct}%`}
        >
            {pct}%
        </span>
    )
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
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    return (
        <div style={{ display: 'flex', gap: '4px', marginTop: '16px', alignItems: 'center' }}>
            <button
                disabled={page === 1}
                onClick={() => onPage(page - 1)}
                style={{ padding: '4px 10px', cursor: 'pointer', fontSize: '0.85rem' }}
            >
                ‹
            </button>
            {pages.map((p) => (
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

export default function JobBoard({ onNavigateToResume }: JobBoardProps): React.ReactElement {
    const [postings, setPostings] = useState<JobPosting[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [page, setPage] = useState(1)

    const loadPostings = useCallback(async () => {
        try {
            const data = await window.api.getPostings()
            setPostings(data)
            setPage(1)
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadPostings()
        window.api.onScrapingCommitted(() => {
            setLoading(true)
            loadPostings()
        })
    }, [loadPostings])

    async function handleTailorResume(posting: JobPosting): Promise<void> {
        if (posting.status === 'new') {
            await window.api.updatePostingStatus(posting.id, 'viewed').catch(console.error)
        }
        onNavigateToResume(posting)
    }

    async function handleOpen(posting: JobPosting): Promise<void> {
        if (posting.status === 'new') {
            await window.api.updatePostingStatus(posting.id, 'viewed').catch(console.error)
            setPostings((prev) =>
                prev.map((p) => (p.id === posting.id ? { ...p, status: 'viewed' } : p)),
            )
        }
        await window.api.openExternal(posting.url).catch(console.error)
    }

    if (loading) return <div style={{ padding: '24px', color: '#6b7280' }}>Loading postings…</div>
    if (error) return <div style={{ padding: '24px', color: 'crimson' }}>Error: {error}</div>
    if (postings.length === 0)
        return (
            <div style={{ padding: '24px', color: '#6b7280' }}>
                No postings yet. Run a scrape from Search Config to populate the board.
            </div>
        )

    const totalPages = Math.max(1, Math.ceil(postings.length / PAGE_SIZE))
    const pagePostings = postings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    return (
        <div style={{ padding: '24px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
            <h2 style={{ marginTop: 0, marginBottom: '16px' }}>
                Job Board{' '}
                <span style={{ fontSize: '0.85rem', fontWeight: 400, color: '#6b7280' }}>
                    ({postings.length})
                </span>
            </h2>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ padding: '8px 12px 8px 0', fontWeight: 600, color: '#374151' }}>Company</th>
                        <th style={{ padding: '8px 12px 8px 0', fontWeight: 600, color: '#374151' }}>Role</th>
                        <th style={{ padding: '8px 12px 8px 0', fontWeight: 600, color: '#374151' }}>Level</th>
                        <th style={{ padding: '8px 12px 8px 0', fontWeight: 600, color: '#374151' }}>Location</th>
                        <th style={{ padding: '8px 12px 8px 0', fontWeight: 600, color: '#374151' }}>Posted</th>
                        <th style={{ padding: '8px 12px 8px 0', fontWeight: 600, color: '#374151' }}>Fit</th>
                        <th style={{ padding: '8px 12px 8px 0', fontWeight: 600, color: '#374151' }}>Status</th>
                        <th style={{ padding: '8px 0', fontWeight: 600, color: '#374151' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {pagePostings.map((posting) => (
                        <tr key={posting.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '10px 12px 10px 0', fontWeight: 600 }}>{posting.company}</td>
                            <td
                                style={{
                                    padding: '10px 12px 10px 0',
                                    maxWidth: '200px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                                title={posting.title}
                            >
                                {posting.title}
                            </td>
                            <td
                                style={{
                                    padding: '10px 12px 10px 0',
                                    textTransform: 'capitalize',
                                    color: '#374151',
                                }}
                            >
                                {posting.seniority !== 'any' ? posting.seniority : '—'}
                            </td>
                            <td style={{ padding: '10px 12px 10px 0', color: '#6b7280' }}>{posting.location}</td>
                            <td style={{ padding: '10px 12px 10px 0', color: '#6b7280', whiteSpace: 'nowrap' }}>
                                {formatPostedAt(posting.posted_at, posting.fetched_at)}
                            </td>
                            <td style={{ padding: '10px 12px 10px 0' }}>
                                <AffinityBadge
                                    score={posting.affinity_score}
                                    skipped={posting.affinity_skipped}
                                />
                            </td>
                            <td style={{ padding: '10px 12px 10px 0' }}>
                                <StatusBadge status={posting.status} />
                            </td>
                            <td
                                style={{
                                    padding: '10px 0',
                                    whiteSpace: 'nowrap',
                                    display: 'flex',
                                    gap: '6px',
                                }}
                            >
                                <button
                                    onClick={() => handleTailorResume(posting)}
                                    style={{ fontSize: '0.78rem', padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}
                                >
                                    Tailor Resume
                                </button>
                                <button
                                    onClick={() => handleOpen(posting)}
                                    style={{ fontSize: '0.78rem', padding: '4px 10px', cursor: 'pointer' }}
                                >
                                    Open ↗
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </div>
    )
}

