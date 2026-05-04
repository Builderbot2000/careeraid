import React, { useState, useEffect } from 'react'
import type { SearchConfigRow } from '../../shared/ipc-types'

export function FiltersTab(): React.ReactElement {
    const [config, setConfig] = useState<Partial<SearchConfigRow>>({})
    const [saved, setSaved] = useState(false)
    const [excludedStack, setExcludedStack] = useState('')
    const [requiredKeywords, setRequiredKeywords] = useState('')
    const [excludedKeywords, setExcludedKeywords] = useState('')
    useEffect(() => {
        window.api.getSearchConfig().then((cfg) => {
            setConfig(cfg)
            setExcludedStack(arrayToField(cfg.excluded_stack))
            setRequiredKeywords(arrayToField(cfg.required_keywords))
            setExcludedKeywords(arrayToField(cfg.excluded_keywords))
        })
    }, [])

    function parseArray(val: unknown): string[] {
        if (Array.isArray(val)) return val
        if (typeof val === 'string') {
            try {
                const parsed = JSON.parse(val)
                return Array.isArray(parsed) ? parsed : []
            } catch {
                return []
            }
        }
        return []
    }

    function arrayToField(val: unknown): string {
        return parseArray(val).join('\n')
    }

    function fieldToArray(text: string): string {
        return JSON.stringify(
            text
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean),
        )
    }

    async function save(updates: Partial<SearchConfigRow>): Promise<void> {
        await window.api.updateSearchConfig(updates)
        setConfig((prev) => ({ ...prev, ...updates }))
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    function handleKeywordsBlur(
        field: 'required_keywords' | 'excluded_keywords',
        text: string,
    ): void {
        save({ [field]: fieldToArray(text) }).catch(console.error)
    }

    function handleStackBlur(text: string): void {
        save({ excluded_stack: fieldToArray(text) }).catch(console.error)
    }

    async function handleSaveAll(): Promise<void> {
        await save({
            required_keywords: fieldToArray(requiredKeywords),
            excluded_keywords: fieldToArray(excludedKeywords),
            excluded_stack: fieldToArray(excludedStack),
        })
    }

    const textareaStyle: React.CSSProperties = {
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        fontFamily: 'monospace',
        fontSize: '0.825rem',
        padding: '8px',
        borderRadius: '4px',
        border: '1px solid #d1d5db',
        resize: 'vertical',
    }

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontWeight: 600,
        marginBottom: '4px',
        fontSize: '0.875rem',
    }

    const hintStyle: React.CSSProperties = {
        fontSize: '0.8rem',
        color: '#6b7280',
        marginBottom: '6px',
        margin: '2px 0 6px',
    }

    return (
        <div>
            {saved && (
                <div
                    style={{
                        background: '#dcfce7',
                        color: '#166534',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        marginBottom: '16px',
                        fontSize: '0.85rem',
                    }}
                >
                    Saved
                </div>
            )}

            <div style={{ marginBottom: '24px' }}>
                <label htmlFor="filters-required-keywords" style={labelStyle}>Required Keywords (OR — one per line)</label>
                <p style={hintStyle}>
                    At least one must match in title or tech stack. Prefix with <code>re:</code> for regex.
                </p>
                <textarea
                    id="filters-required-keywords"
                    rows={4}
                    value={requiredKeywords}
                    onChange={(e) => setRequiredKeywords(e.target.value)}
                    onBlur={(e) => handleKeywordsBlur('required_keywords', e.target.value)}
                    style={textareaStyle}
                    placeholder="e.g. TypeScript&#10;Go&#10;re:rust|zig"
                />
            </div>

            <div style={{ marginBottom: '24px' }}>
                <label htmlFor="filters-excluded-keywords" style={labelStyle}>Excluded Keywords (one per line)</label>
                <p style={hintStyle}>
                    Drop postings matching any of these. Prefix with <code>re:</code> for regex.
                </p>
                <textarea
                    id="filters-excluded-keywords"
                    rows={4}
                    value={excludedKeywords}
                    onChange={(e) => setExcludedKeywords(e.target.value)}
                    onBlur={(e) => handleKeywordsBlur('excluded_keywords', e.target.value)}
                    style={textareaStyle}
                    placeholder="e.g. internship&#10;re:junior|entry.level"
                />
            </div>

            <div style={{ marginBottom: '24px' }}>
                <label htmlFor="filters-excluded-stack" style={labelStyle}>Excluded Tech Stack (one per line)</label>
                <p style={hintStyle}>
                    Drop postings where tech_stack contains any of these terms.
                </p>
                <textarea
                    id="filters-excluded-stack"
                    rows={4}
                    value={excludedStack}
                    onChange={(e) => setExcludedStack(e.target.value)}
                    onBlur={(e) => handleStackBlur(e.target.value)}
                    style={textareaStyle}
                    placeholder="e.g. PHP&#10;Ruby on Rails"
                />
            </div>

            <button
                onClick={handleSaveAll}
                style={{ padding: '8px 20px', fontWeight: 600, cursor: 'pointer' }}
            >
                Save
            </button>
        </div>
    )
}
