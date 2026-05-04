import React from 'react'

type HardReqsClass = 'overqualified' | 'fully_qualified' | 'minimally_qualified' | 'underqualified'
type NiceToHavesClass = 'fully_met' | 'partially_met' | 'not_met'

const LABEL: Record<HardReqsClass, string> = {
  overqualified:       'Overqualified',
  fully_qualified:     'Fully Qualified',
  minimally_qualified: 'Minimally Qualified',
  underqualified:      'Underqualified',
}

const COLORS: Record<HardReqsClass, { bg: string; fg: string }> = {
  overqualified:       { bg: '#ede9fe', fg: '#5b21b6' },
  fully_qualified:     { bg: '#dcfce7', fg: '#166534' },
  minimally_qualified: { bg: '#fef9c3', fg: '#854d0e' },
  underqualified:      { bg: '#fee2e2', fg: '#991b1b' },
}

const baseStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 6px',
  borderRadius: '4px',
  fontSize: '0.72rem',
  fontWeight: 600,
}

export function AffinityBadge({
  score,
  hardReqsClass,
  niceToHavesClass,
}: {
  score: number | null
  hardReqsClass: HardReqsClass | null
  niceToHavesClass: NiceToHavesClass | null
}): React.ReactElement {
  if (!hardReqsClass) {
    return (
      <span
        style={{ ...baseStyle, background: '#f3f4f6', color: '#9ca3af', fontWeight: 400 }}
        title="Not yet scored"
      >
        ?
      </span>
    )
  }

  const { bg, fg } = COLORS[hardReqsClass]
  const niceSuffix =
    niceToHavesClass === 'fully_met' ? ' ★' : niceToHavesClass === 'not_met' ? ' ☆' : ''
  const niceLabel = niceToHavesClass ? niceToHavesClass.replace(/_/g, ' ') : ''
  const scorePct = score !== null ? ` · ${Math.round(score * 100)}%` : ''
  const tooltip = `${LABEL[hardReqsClass]}${niceLabel ? ` · Nice-to-haves: ${niceLabel}` : ''}${scorePct}`

  return (
    <span style={{ ...baseStyle, background: bg, color: fg }} title={tooltip}>
      {LABEL[hardReqsClass]}{niceSuffix}
    </span>
  )
}
