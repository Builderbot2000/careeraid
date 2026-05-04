import React from 'react'
import type { FeatureLocks } from '../shared/ipc-types'
import type { View } from '../App'

interface Props {
    featureLocks: FeatureLocks
    onClose: () => void
    onNavigate: (view: View) => void
}

const ISSUES = [
    { key: 'claudeApiKey' as const, label: 'No Claude API key configured.', view: 'settings' as View, cta: 'Go to Settings' },
    { key: 'typst' as const,        label: 'Typst PDF compiler not found.',  view: 'settings' as View, cta: 'Go to Settings' },
    { key: 'profileEmpty' as const, label: 'Profile has no entries.',        view: 'profile'  as View, cta: 'Go to Profile'  },
]

export function ResumeLockedModal({ featureLocks, onClose, onNavigate }: Props): React.ReactElement {
    const active = ISSUES.filter((i) => featureLocks[i.key])

    return (
        <div
            style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1000,
            }}
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="resume-locked-modal-title"
                style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '28px 32px',
                    maxWidth: 440,
                    width: '100%',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <h2
                    id="resume-locked-modal-title"
                    style={{ marginTop: 0, fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}
                >
                    Resume Unavailable
                </h2>
                <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 16, color: 'var(--text)' }}>
                    The following requirements must be met before you can tailor a resume:
                </p>

                <ul style={{ margin: '0 0 20px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {active.map((issue) => (
                        <li
                            key={issue.key}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                gap: 12, padding: '8px 12px',
                                background: 'var(--surface-raised, rgba(255,255,255,0.04))',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius)',
                            }}
                        >
                            <span style={{ fontSize: 13, color: 'var(--text)' }}>{issue.label}</span>
                            <button
                                onClick={() => onNavigate(issue.view)}
                                style={{
                                    padding: '5px 12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                                    background: 'var(--accent)', border: 'none', color: '#000',
                                    borderRadius: 'var(--radius)', fontSize: 12,
                                }}
                            >
                                {issue.cta}
                            </button>
                        </li>
                    ))}
                </ul>

                <button
                    onClick={onClose}
                    style={{
                        padding: '7px 16px', cursor: 'pointer', fontSize: 13,
                        background: 'none', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)', color: 'var(--text)',
                    }}
                >
                    Close
                </button>
            </div>
        </div>
    )
}
