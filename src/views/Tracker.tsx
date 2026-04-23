import React, { useState, useEffect } from 'react'
import type { JobPosting, PostingStatus } from '../shared/ipc-types'

const TRACKER_STATUSES: PostingStatus[] = [
    'favorited',
    'applied',
    'interviewing',
    'offer',
    'rejected',
    'ghosted',
]

function formatDate(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function Tracker(): React.ReactElement {
    const [postings, setPostings] = useState<JobPosting[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

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

    if (loading) return <div style={{ padding: '24px', color: '#6b7280' }}>Loading…</div>
    if (error) return <div style={{ padding: '24px', color: 'crimson' }}>Error: {error}</div>

    if (postings.length === 0) {
        return (
            <div style={{ padding: '24px', color: '#6b7280' }}>
                No applications tracked yet. Apply to a job from the Resume view to see it here.
            </div>
        )
    }

    return (
        <div style={{ padding: '24px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
            <h2 style={{ marginTop: 0, marginBottom: '16px' }}>
                Tracker <span style={{ fontSize: '0.85rem', fontWeight: 400, color: '#6b7280' }}>({postings.length})</span>
            </h2>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ padding: '8px 12px 8px 0', fontWeight: 600, color: '#374151' }}>Company</th>
                        <th style={{ padding: '8px 12px 8px 0', fontWeight: 600, color: '#374151' }}>Role</th>
                        <th style={{ padding: '8px 12px 8px 0', fontWeight: 600, color: '#374151' }}>Source</th>
                        <th style={{ padding: '8px 12px 8px 0', fontWeight: 600, color: '#374151' }}>Last Updated</th>
                        <th style={{ padding: '8px 12px 8px 0', fontWeight: 600, color: '#374151' }}>Status</th>
                        <th style={{ padding: '8px 0', fontWeight: 600, color: '#374151' }}>Link</th>
                    </tr>
                </thead>
                <tbody>
                    {postings.map((posting) => (
                        <tr key={posting.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '10px 12px 10px 0', fontWeight: 600 }}>{posting.company}</td>
                            <td style={{ padding: '10px 12px 10px 0', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {posting.title}
                            </td>
                            <td style={{ padding: '10px 12px 10px 0', color: '#6b7280', textTransform: 'capitalize' }}>
                                {posting.source}
                            </td>
                            <td style={{ padding: '10px 12px 10px 0', color: '#6b7280', whiteSpace: 'nowrap' }}>
                                {formatDate(posting.last_seen_at)}
                            </td>
                            <td style={{ padding: '10px 12px 10px 0' }}>
                                <select
                                    value={posting.status}
                                    onChange={(e) =>
                                        handleStatusChange(posting.id, e.target.value as PostingStatus)
                                    }
                                    style={{ fontSize: '0.8rem', padding: '3px 6px', borderRadius: '4px', border: '1px solid #d1d5db', cursor: 'pointer' }}
                                >
                                    {TRACKER_STATUSES.map((s) => (
                                        <option key={s} value={s} style={{ textTransform: 'capitalize' }}>
                                            {s}
                                        </option>
                                    ))}
                                </select>
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
        </div>
    )
}

