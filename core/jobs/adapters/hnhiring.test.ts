import { describe, it, expect } from 'vitest'
import { parseFirstLine, recencyCutoffDate, buildListingUrl } from './hnhiring'

// ─── buildListingUrl ──────────────────────────────────────────────────────────

describe('buildListingUrl', () => {
  it('builds the correct URL from a month slug', () => {
    expect(buildListingUrl('april-2026')).toBe('https://hnhiring.com/april-2026')
  })

  it('works for any arbitrary slug', () => {
    expect(buildListingUrl('january-2025')).toBe('https://hnhiring.com/january-2025')
  })
})

// ─── recencyCutoffDate ────────────────────────────────────────────────────────

describe('recencyCutoffDate', () => {
  it('returns a YYYY-MM-DD string', () => {
    const result = recencyCutoffDate('week')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('day cutoff is 1 day before today', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(recencyCutoffDate('day')).toBe(yesterday.toISOString().slice(0, 10))
  })

  it('week cutoff is 7 days before today', () => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    expect(recencyCutoffDate('week')).toBe(d.toISOString().slice(0, 10))
  })

  it('month cutoff is 1 calendar month before today', () => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    expect(recencyCutoffDate('month')).toBe(d.toISOString().slice(0, 10))
  })
})

// ─── parseFirstLine ───────────────────────────────────────────────────────────

describe('parseFirstLine', () => {
  it('parses company, title, location from a standard 3-segment line', () => {
    const result = parseFirstLine('Apple | SRE | San Diego')
    expect(result).toEqual({ company: 'Apple', title: 'SRE', location: 'San Diego' })
  })

  it('parses extra segments beyond location without error', () => {
    const result = parseFirstLine('Proven Software | QA Analyst | REMOTE (US) | Full-Time | $85k-$110k')
    expect(result.company).toBe('Proven Software')
    expect(result.title).toBe('QA Analyst')
    expect(result.location).toBe('REMOTE (US)')
  })

  it('handles 2-segment line with missing location', () => {
    const result = parseFirstLine('SomeCompany | Engineer')
    expect(result.company).toBe('SomeCompany')
    expect(result.title).toBe('Engineer')
    expect(result.location).toBe('')
  })

  it('handles 1-segment line (no pipes)', () => {
    const result = parseFirstLine('Remote')
    expect(result.company).toBe('Remote')
    expect(result.title).toBe('')
    expect(result.location).toBe('')
  })

  it('trims whitespace around pipe segments', () => {
    const result = parseFirstLine('  Acme Corp  |  Backend Engineer  |  New York  ')
    expect(result.company).toBe('Acme Corp')
    expect(result.title).toBe('Backend Engineer')
    expect(result.location).toBe('New York')
  })

  it('handles pipe-heavy first line preserving first three fields', () => {
    const result = parseFirstLine(
      'Greenhouse Software | Engineering Manager (Analytics Product) | REMOTE (Ontario or BC, Canada) | Full-time',
    )
    expect(result.company).toBe('Greenhouse Software')
    expect(result.title).toBe('Engineering Manager (Analytics Product)')
    expect(result.location).toBe('REMOTE (Ontario or BC, Canada)')
  })
})
