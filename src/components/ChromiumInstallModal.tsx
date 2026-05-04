import React, { useState } from 'react'

interface Props {
  onClose: () => void
  onInstalled?: () => void
}

type State = 'idle' | 'downloading' | 'success' | 'error'

export function ChromiumInstallModal({ onClose, onInstalled }: Props): React.ReactElement {
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleInstall(): Promise<void> {
    setState('downloading')
    setError(null)
    try {
      await window.api.installChromium()
      onInstalled?.()
      setState('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setState('error')
    }
  }

  const dismissable = state === 'success' || state === 'error'

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={dismissable ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chromium-modal-title"
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
          id="chromium-modal-title"
          style={{ marginTop: 0, fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}
        >
          Chromium Required
        </h2>
        <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 20, color: 'var(--text)' }}>
          The LinkedIn, Glassdoor, and Indeed scrapers use an embedded Chromium browser to
          navigate job search pages. It isn't bundled with the app and needs to be downloaded
          once (~150 MB).
        </p>

        {state === 'idle' && (
          <button
            onClick={handleInstall}
            style={{
              padding: '8px 18px', fontWeight: 600, cursor: 'pointer',
              background: 'var(--accent)', border: 'none', color: '#000',
              borderRadius: 'var(--radius)', fontSize: 13,
            }}
          >
            Download Chromium
          </button>
        )}

        {state === 'downloading' && (
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            Downloading… this may take a few minutes.
          </p>
        )}

        {state === 'success' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--success)', marginBottom: 16 }}>
              Chromium installed — you can now use Search.
            </p>
            <button
              onClick={onClose}
              style={{
                padding: '8px 18px', cursor: 'pointer', fontSize: 13,
                background: 'none', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', color: 'var(--text)',
              }}
            >
              Go to Search
            </button>
          </>
        )}

        {state === 'error' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>
              Download failed: {error}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleInstall}
                style={{
                  padding: '8px 18px', fontWeight: 600, cursor: 'pointer',
                  background: 'var(--accent)', border: 'none', color: '#000',
                  borderRadius: 'var(--radius)', fontSize: 13,
                }}
              >
                Retry
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '8px 16px', cursor: 'pointer', fontSize: 13,
                  background: 'none', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', color: 'var(--text)',
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
