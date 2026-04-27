import React, { useState, useEffect } from 'react'
import type { FeatureLocks, JobPosting, ScrapeSummary, AdapterProgress } from './shared/ipc-types'
import Settings from './views/Settings'
import Profile from './views/Profile'
import SearchConfig from './views/SearchConfig'
import JobBoard from './views/JobBoard'
import ResumePreview from './views/ResumePreview'
import Tracker from './views/Tracker'
import Analytics from './views/Analytics'

export type ScrapeState = 'idle' | 'running' | 'pending_commit' | 'error'

type View = 'profile' | 'search' | 'jobs' | 'resume' | 'tracker' | 'analytics' | 'settings'

interface NavItem {
    id: View
    label: string
    lockedBy?: (keyof FeatureLocks)[]
}

const NAV: NavItem[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'search', label: 'Search' },
    { id: 'jobs', label: 'Jobs' },
    { id: 'resume', label: 'Resume', lockedBy: ['xelatex', 'claudeApiKey', 'profileEmpty'] },
    { id: 'tracker', label: 'Tracker' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'settings', label: 'Settings' },
]

export default function App(): React.ReactElement {
    const [view, setView] = useState<View>('settings')
    const [featureLocks, setFeatureLocks] = useState<FeatureLocks>({
        claudeApiKey: false,
        claudeConnectivity: false,
        xelatex: false,
        playwrightChromium: false,
        profileEmpty: false,
    })
    const [pendingNavPosting, setPendingNavPosting] = useState<JobPosting | null>(null)
    const [searchNavKey, setSearchNavKey] = useState(0)
    const [scrapeState, setScrapeState] = useState<ScrapeState>('idle')
    const [scrapeSummary, setScrapeSummary] = useState<ScrapeSummary | null>(null)
    const [adapterProgress, setAdapterProgress] = useState<Record<string, AdapterProgress>>({})
    const [scrapeError, setScrapeError] = useState<string | null>(null)
    const [scrapeCommitting, setScrapeCommitting] = useState(false)

    useEffect(() => {
        window.api.onFeatureLocks((locks) => setFeatureLocks(locks))
        window.api.onAdapterProgress((p) => {
            setAdapterProgress((prev) => ({ ...prev, [p.adapterId]: p }))
        })
    }, [])

    async function runScrape(adapterIds: string[]): Promise<void> {
        setScrapeState('running')
        setScrapeError(null)
        setScrapeSummary(null)
        setAdapterProgress({})
        try {
            const result = await window.api.runScrape(adapterIds)
            setScrapeSummary(result)
            setScrapeState('pending_commit')
        } catch (err) {
            setScrapeError(err instanceof Error ? err.message : String(err))
            setScrapeState('error')
        }
    }

    async function commitScrape(): Promise<void> {
        setScrapeCommitting(true)
        try {
            await window.api.commitScrape()
            setScrapeState('idle')
            setScrapeSummary(null)
        } catch (err) {
            setScrapeError(err instanceof Error ? err.message : String(err))
            setScrapeState('error')
        } finally {
            setScrapeCommitting(false)
        }
    }

    async function discardScrape(): Promise<void> {
        await window.api.discardScrape()
        setScrapeState('idle')
        setScrapeSummary(null)
    }

    function isLocked(item: NavItem): boolean {
        if (!item.lockedBy) return false
        return item.lockedBy.some((k) => featureLocks[k])
    }

    function navigate(id: View, posting?: JobPosting): void {
        const item = NAV.find((n) => n.id === id)
        if (item && isLocked(item)) return
        setPendingNavPosting(posting ?? null)
        if (id === 'search') setSearchNavKey((k) => k + 1)
        setView(id)
    }

    return (
        <div className="app-shell">
            <nav className="sidebar">
                <div className="sidebar-title">careeraid</div>
                {NAV.map((item) => {
                    const locked = isLocked(item)
                    return (
                        <button
                            key={item.id}
                            data-testid={`nav-${item.id}`}
                            className={`nav-btn${view === item.id ? ' active' : ''}${locked ? ' locked' : ''}`}
                            onClick={() => navigate(item.id)}
                            title={locked ? 'Feature locked — check Settings' : item.label}
                        >
                            {item.label}
                            {locked && <span className="lock-badge">locked</span>}
                            {item.id === 'search' && scrapeState === 'pending_commit' && (
                                <span className="pending-badge" title="Scrape results ready to commit" />
                            )}
                        </button>
                    )
                })}
            </nav>

            <main className="content">
                {view === 'profile' && <Profile />}
                {view === 'search' && (
                    <SearchConfig
                        key={searchNavKey}
                        scrapeState={scrapeState}
                        summary={scrapeSummary}
                        adapterProgress={adapterProgress}
                        errorMsg={scrapeError}
                        committing={scrapeCommitting}
                        onRunScrape={(ids) => { runScrape(ids).catch(console.error) }}
                        onCommit={() => { commitScrape().catch(console.error) }}
                        onDiscard={() => { discardScrape().catch(console.error) }}
                    />
                )}
                {view === 'jobs' && <JobBoard onNavigateToResume={(posting) => {
                    setPendingNavPosting(posting)
                    setView('resume')
                }} />}
                {view === 'resume' && <ResumePreview initialPosting={pendingNavPosting} />}
                {view === 'tracker' && <Tracker />}
                {view === 'analytics' && <Analytics />}
                {view === 'settings' && <Settings featureLocks={featureLocks} />}
            </main>
        </div>
    )
}
