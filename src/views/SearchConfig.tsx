import React, { useState, useEffect, useRef } from 'react'
import type { ScrapeSummary } from '../shared/ipc-types'

type ScrapeState = 'idle' | 'running' | 'pending_commit' | 'error'

export default function SearchConfig(): React.ReactElement {
    const [intent, setIntent] = useState('')
    const [scrapeState, setScrapeState] = useState<ScrapeState>('idle')
    const [summary, setSummary] = useState<ScrapeSummary | null>(null)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [committing, setCommitting] = useState(false)
    const intentRef = useRef(intent)
    intentRef.current = intent

    useEffect(() => {
        window.api.getSearchConfig().then((cfg) => {
            setIntent(cfg.intent ?? '')
        })
    }, [])

    function handleIntentBlur(): void {
        window.api.updateSearchConfig({ intent: intentRef.current || null }).catch(console.error)
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
        <div style={{ padding: '24px', maxWidth: '680px' }}>
            <h2 style={{ marginTop: 0 }}>Search Configuration</h2>

            {/* ── Intent ── */}
            <section style={{ marginBottom: '32px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
                    Search Intent
                </label>
                <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#6b7280' }}>
                    Describe what you're looking for. This guides search term generation and helps rank results.
                </p>
                <textarea
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

            {/* ── Adapters ── */}
            <section>
                <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '1rem' }}>Adapters</h3>

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
                        onClick={handleRunScrape}
                        disabled={scrapeState === 'running' || scrapeState === 'pending_commit'}
                        style={{ padding: '8px 16px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                        {scrapeState === 'running' ? 'Running…' : 'Run Scrape'}
                    </button>
                </div>

                {scrapeState === 'error' && errorMsg && (
                    <div style={{ marginTop: '12px', color: 'crimson', fontSize: '0.85rem' }}>
                        {errorMsg}
                    </div>
                )}
            </section>

            {/* ── Commit dialog ── */}
            {scrapeState === 'pending_commit' && summary && (
                <div
                    style={{
                        marginTop: '24px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        padding: '20px',
                        background: '#f9fafb',
                    }}
                >
                    <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem' }}>Scrape Complete</h4>
                    <table style={{ borderCollapse: 'collapse', fontSize: '0.875rem', width: '100%' }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '3px 12px 3px 0', color: '#6b7280' }}>Postings fetched</td>
                                <td style={{ padding: '3px 0', fontWeight: 600 }}>{summary.fetched}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '3px 12px 3px 0', color: '#6b7280' }}>Duplicates skipped</td>
                                <td style={{ padding: '3px 0' }}>{summary.dupes}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '3px 12px 3px 0', color: '#6b7280' }}>Net new to commit</td>
                                <td style={{ padding: '3px 0', fontWeight: 600, color: summary.netNew > 0 ? '#16a34a' : '#6b7280' }}>
                                    {summary.netNew}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                        <button
                            onClick={handleCommit}
                            disabled={committing || summary.netNew === 0}
                            style={{ padding: '8px 20px', fontWeight: 600, cursor: 'pointer' }}
                        >
                            {committing ? 'Committing…' : `Commit ${summary.netNew} postings`}
                        </button>
                        <button
                            onClick={handleDiscard}
                            disabled={committing}
                            style={{ padding: '8px 16px', cursor: 'pointer' }}
                        >
                            Discard
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

