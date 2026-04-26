import React, { useState, useEffect } from 'react'
import type { FeatureLocks, JobPosting } from './shared/ipc-types'
import Settings from './views/Settings'
import Profile from './views/Profile'
import SearchConfig from './views/SearchConfig'
import JobBoard from './views/JobBoard'
import ResumePreview from './views/ResumePreview'
import Tracker from './views/Tracker'
import Analytics from './views/Analytics'

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

    useEffect(() => {
        window.api.onFeatureLocks((locks) => setFeatureLocks(locks))
    }, [])

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
                <div className="sidebar-title">Career Index</div>
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
                        </button>
                    )
                })}
            </nav>

            <main className="content">
                {view === 'profile' && <Profile />}
                {view === 'search' && <SearchConfig key={searchNavKey} />}
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
