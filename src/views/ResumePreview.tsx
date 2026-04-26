import React, { useState, useEffect, useRef } from 'react'
import type { Application, JobPosting } from '../shared/ipc-types'

interface ResumePreviewProps {
    initialPosting?: JobPosting | null
}

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function ResumePreview({ initialPosting }: ResumePreviewProps): React.ReactElement {
    const [jdText, setJdText] = useState('')
    const [template, setTemplate] = useState('classic')
    const [templates, setTemplates] = useState<string[]>(['classic', 'modern'])
    const [status, setStatus] = useState<Status>('idle')
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)
    const [currentApp, setCurrentApp] = useState<Application | null>(null)
    const [applications, setApplications] = useState<Application[]>([])
    const [recompiling, setRecompiling] = useState(false)
    const [postingId, setPostingId] = useState<string | undefined>(initialPosting?.id)
    const [applied, setApplied] = useState(false)
    const iframeRef = useRef<HTMLIFrameElement>(null)

    // When a posting is navigated in from the Job Board, pre-fill the JD textarea
    useEffect(() => {
        if (initialPosting) {
            setJdText(initialPosting.raw_text ?? '')
            setPostingId(initialPosting.id)
            setCurrentApp(null)
            setPdfUrl(null)
            setStatus('idle')
            setErrorMsg(null)
            setApplied(false)
        }
    }, [initialPosting?.id]) // re-run only when the posting changes

    useEffect(() => {
        window.api.getAvailableTemplates().then((t) => {
            if (t.length > 0) setTemplates(t)
        })
        window.api.getApplications().then(setApplications)
    }, [])

    async function handleTailor(): Promise<void> {
        if (!jdText.trim()) return
        setStatus('loading')
        setErrorMsg(null)
        setPdfUrl(null)
        setCurrentApp(null)
        try {
            const result = await window.api.tailorResume(jdText, template, postingId)
            setPdfUrl(result.pdfUrl)
            setCurrentApp(result.application)
            setApplications((prev) => [result.application, ...prev])
            setStatus('success')
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : String(err))
            setStatus('error')
        }
    }

    async function handleRecompile(applicationId: string): Promise<void> {
        setRecompiling(true)
        setErrorMsg(null)
        try {
            const url = await window.api.recompileResume(applicationId)
            setPdfUrl(url)
            setStatus('success')
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : String(err))
        } finally {
            setRecompiling(false)
        }
    }

    function handleSelectApplication(app: Application): void {
        setCurrentApp(app)
        // Try to open the PDF if it was compiled; offer recompile otherwise
        setStatus('idle')
        setPdfUrl(null)
        setErrorMsg(null)
        setApplied(false)
    }

    async function handleApply(): Promise<void> {
        if (!postingId || !initialPosting) return
        try {
            await window.api.updatePostingStatus(postingId, 'applied')
            await window.api.openExternal(initialPosting.url)
            setApplied(true)
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : String(err))
        }
    }

    return (
        <div style={{ display: 'flex', height: '100%', gap: '16px', padding: '16px' }}>
            {/* ── Left panel ── */}
            <div style={{ width: '360px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h2 style={{ margin: 0 }}>Resume Tailoring</h2>

                {/* JD input */}
                <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Job Description
                    <textarea
                        value={jdText}
                        onChange={(e) => setJdText(e.target.value)}
                        placeholder="Paste the full job description here…"
                        rows={12}
                        style={{ display: 'block', width: '100%', marginTop: '4px', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.8rem' }}
                    />
                </label>

                {/* Template selector */}
                <label htmlFor="resume-template" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Template
                    <select
                        id="resume-template"
                        value={template}
                        onChange={(e) => setTemplate(e.target.value)}
                        style={{ display: 'block', width: '100%', marginTop: '4px' }}
                    >
                        {templates.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </label>

                <button
                    onClick={handleTailor}
                    disabled={status === 'loading' || !jdText.trim()}
                    style={{ padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}
                >
                    {status === 'loading' ? 'Tailoring…' : 'Tailor Resume'}
                </button>

                {status === 'success' && (
                    <button
                        onClick={() => {
                            setStatus('idle')
                            setPdfUrl(null)
                            setCurrentApp(null)
                        }}
                        style={{ padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}
                    >
                        Re-tailor
                    </button>
                )}

                {currentApp && postingId && initialPosting && !applied && (
                    <button
                        onClick={handleApply}
                        style={{ padding: '8px 16px', fontWeight: 600, cursor: 'pointer', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px' }}
                    >
                        Apply ↗
                    </button>
                )}

                {applied && (
                    <div style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>
                        ✓ Marked as applied — check Tracker
                    </div>
                )}

                {status === 'error' && errorMsg && (
                    <div style={{ color: 'crimson', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
                        {errorMsg}
                    </div>
                )}

                {/* Previous applications */}
                {applications.length > 0 && (
                    <div>
                        <h3 style={{ fontSize: '0.85rem', margin: '8px 0 4px' }}>Previous Resumes</h3>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.8rem' }}>
                            {applications.map((app) => (
                                <li
                                    key={app.id}
                                    data-testid="application-entry"
                                    onClick={() => handleSelectApplication(app)}
                                    style={{
                                        padding: '6px 8px',
                                        cursor: 'pointer',
                                        borderRadius: '4px',
                                        background: currentApp?.id === app.id ? '#e0e7ff' : 'transparent',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                    }}
                                >
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {app.id.slice(0, 8)}… {app.applied_at ? `• Applied ${app.applied_at.slice(0, 10)}` : ''}
                                    </span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRecompile(app.id) }}
                                        disabled={recompiling}
                                        style={{ fontSize: '0.7rem', padding: '2px 6px', cursor: 'pointer' }}
                                    >
                                        {recompiling && currentApp?.id === app.id ? '…' : 'PDF'}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* ── Right panel: PDF preview ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {status === 'loading' && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#6b7280' }}>
                        Calling Claude and compiling PDF…
                    </div>
                )}

                {pdfUrl && status === 'success' && (
                    <iframe
                        ref={iframeRef}
                        src={pdfUrl}
                        style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '6px' }}
                        title="Resume PDF Preview"
                    />
                )}

                {status === 'idle' && !pdfUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#9ca3af', fontSize: '0.9rem' }}>
                        Paste a job description and click "Tailor Resume" to generate a PDF.
                    </div>
                )}
            </div>
        </div>
    )
}

