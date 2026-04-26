import { describe, it, expect } from 'vitest'
import {
  cleanJobUrl,
  buildSearchUrl,
  parsePostedAt,
  parseApplicantCount,
  extractYoe,
  extractSeniority,
  extractTechStack,
} from './linkedin'

// ─── cleanJobUrl ──────────────────────────────────────────────────────────────

describe('cleanJobUrl', () => {
  it('strips tracking query params from a full URL', () => {
    const result = cleanJobUrl(
      'https://www.linkedin.com/jobs/view/123/?refId=abc&trackingId=xyz',
    )
    expect(result).toBe('https://www.linkedin.com/jobs/view/123/')
  })

  it('expands a relative path to a full linkedin.com URL', () => {
    const result = cleanJobUrl('/jobs/view/123/')
    expect(result).toBe('https://www.linkedin.com/jobs/view/123/')
  })

  it('leaves an already-clean URL unchanged', () => {
    const url = 'https://www.linkedin.com/jobs/view/123/'
    expect(cleanJobUrl(url)).toBe(url)
  })

  it('returns an unparseable string as-is', () => {
    expect(cleanJobUrl('not-a-url')).toBe('not-a-url')
  })
})

// ─── buildSearchUrl ───────────────────────────────────────────────────────────

describe('buildSearchUrl', () => {
  it('includes keywords param for a term', () => {
    const url = buildSearchUrl('typescript engineer', {}, 0)
    expect(url).toContain('keywords=typescript+engineer')
  })

  it('includes location param when provided', () => {
    const url = buildSearchUrl('engineer', { location: 'San Francisco' }, 0)
    expect(url).toContain('location=San+Francisco')
  })

  it('includes f_WT=2 for remote filter', () => {
    const url = buildSearchUrl('engineer', { remote: true }, 0)
    expect(url).toContain('f_WT=2')
  })

  it('reflects pagination start offset', () => {
    const url = buildSearchUrl('engineer', {}, 25)
    expect(url).toContain('start=25')
  })

  it('includes all params when all filters are set', () => {
    const url = buildSearchUrl('engineer', { location: 'NYC', remote: true }, 50)
    expect(url).toContain('keywords=engineer')
    expect(url).toContain('location=NYC')
    expect(url).toContain('f_WT=2')
    expect(url).toContain('start=50')
  })
})

// ─── parsePostedAt ────────────────────────────────────────────────────────────

describe('parsePostedAt', () => {
  const today = new Date().toISOString().slice(0, 10)

  it('returns ISO date from a valid datetime attribute', () => {
    expect(parsePostedAt('2024-03-15', 'anything')).toBe('2024-03-15')
  })

  it('falls back to relative text when datetime attr is null', () => {
    const result = parsePostedAt(null, '3 days ago')
    const expected = new Date()
    expected.setDate(expected.getDate() - 3)
    expect(result).toBe(expected.toISOString().slice(0, 10))
  })

  it('parses "2 weeks ago"', () => {
    const result = parsePostedAt(null, '2 weeks ago')
    const expected = new Date()
    expected.setDate(expected.getDate() - 14)
    expect(result).toBe(expected.toISOString().slice(0, 10))
  })

  it('parses "1 month ago"', () => {
    const result = parsePostedAt(null, '1 month ago')
    const expected = new Date()
    expected.setMonth(expected.getMonth() - 1)
    expect(result).toBe(expected.toISOString().slice(0, 10))
  })

  it('parses "2 years ago"', () => {
    const result = parsePostedAt(null, '2 years ago')
    const expected = new Date()
    expected.setFullYear(expected.getFullYear() - 2)
    expect(result).toBe(expected.toISOString().slice(0, 10))
  })

  it('returns null when both attr and text are empty', () => {
    expect(parsePostedAt(null, '')).toBeNull()
  })

  it('falls back to text when datetime attr is invalid', () => {
    const result = parsePostedAt('invalid-date', '1 hour ago')
    // Should be today's date (1 hour ago rounds to today)
    expect(result).toBe(today)
  })
})

// ─── parseApplicantCount ──────────────────────────────────────────────────────

describe('parseApplicantCount', () => {
  it('parses "Over 200 applicants"', () => {
    expect(parseApplicantCount('Over 200 applicants')).toBe(200)
  })

  it('parses "Be among the first 25 applicants"', () => {
    expect(parseApplicantCount('Be among the first 25 applicants')).toBe(25)
  })

  it('parses comma-formatted "1,234 applicants"', () => {
    expect(parseApplicantCount('1,234 applicants')).toBe(1234)
  })

  it('is case-insensitive for "over"', () => {
    expect(parseApplicantCount('over 500 applicants')).toBe(500)
  })

  it('returns null when no match', () => {
    expect(parseApplicantCount('No applicant info')).toBeNull()
  })
})

// ─── extractYoe ───────────────────────────────────────────────────────────────

describe('extractYoe', () => {
  it('parses "5+ years"', () => {
    expect(extractYoe('5+ years experience')).toEqual({ yoe_min: 5, yoe_max: null })
  })

  it('parses "5 or more years"', () => {
    expect(extractYoe('5 or more years required')).toEqual({ yoe_min: 5, yoe_max: null })
  })

  it('parses hyphen range "3-5 years"', () => {
    expect(extractYoe('3-5 years of experience')).toEqual({ yoe_min: 3, yoe_max: 5 })
  })

  it('parses "3 to 5 years"', () => {
    expect(extractYoe('3 to 5 years')).toEqual({ yoe_min: 3, yoe_max: 5 })
  })

  it('parses em-dash range "3–5 years"', () => {
    expect(extractYoe('3–5 years')).toEqual({ yoe_min: 3, yoe_max: 5 })
  })

  it('parses "at least 3 years"', () => {
    expect(extractYoe('at least 3 years of experience')).toEqual({ yoe_min: 3, yoe_max: null })
  })

  it('returns nulls when no YOE pattern found', () => {
    expect(extractYoe('great communication skills')).toEqual({ yoe_min: null, yoe_max: null })
  })
})

// ─── extractSeniority ─────────────────────────────────────────────────────────

describe('extractSeniority', () => {
  it('detects intern', () => {
    expect(extractSeniority('Software Intern', '')).toBe('intern')
  })

  it('detects junior from title', () => {
    expect(extractSeniority('Junior Engineer', '')).toBe('junior')
  })

  it('detects junior from "entry-level" in raw text', () => {
    expect(extractSeniority('Software Engineer', 'entry-level role')).toBe('junior')
  })

  it('detects staff from title', () => {
    expect(extractSeniority('Staff Engineer', '')).toBe('staff')
  })

  it('detects staff from "principal" in raw text', () => {
    expect(extractSeniority('Engineer', 'principal engineer track')).toBe('staff')
  })

  it('detects senior from title', () => {
    expect(extractSeniority('Senior Software Engineer', '')).toBe('senior')
  })

  it('detects senior from "Sr." abbreviation', () => {
    expect(extractSeniority('Sr. Engineer', '')).toBe('senior')
  })

  it('detects mid from "mid-level" in raw text', () => {
    expect(extractSeniority('Software Engineer', 'mid-level position')).toBe('mid')
  })

  it('detects mid from "intermediate" in raw text', () => {
    expect(extractSeniority('Engineer', 'intermediate experience required')).toBe('mid')
  })

  it('returns "any" when no seniority signal present', () => {
    expect(extractSeniority('Software Engineer', '')).toBe('any')
  })

  it('intern takes priority over senior when both present', () => {
    expect(extractSeniority('Senior Intern Program', '')).toBe('intern')
  })
})

// ─── extractTechStack ─────────────────────────────────────────────────────────

describe('extractTechStack', () => {
  it('extracts multiple techs from a description', () => {
    const result = extractTechStack('Experience with TypeScript and React')
    expect(result).toContain('TypeScript')
    expect(result).toContain('React')
  })

  it('matches "Next.js" without also matching bare "JS"', () => {
    const result = extractTechStack('Built with Next.js')
    expect(result).toContain('Next.js')
    expect(result).not.toContain('JavaScript')
  })

  it('matches "Go" as a standalone word', () => {
    const result = extractTechStack('We use Go for backend services')
    expect(result).toContain('Go')
  })

  it('does not match "Rust" inside "robust"', () => {
    const result = extractTechStack('robust systems and reliable code')
    expect(result).not.toContain('Rust')
  })

  it('is case-insensitive and preserves canonical casing', () => {
    const result = extractTechStack('experience with typescript and mongodb')
    expect(result).toContain('TypeScript')
    expect(result).toContain('MongoDB')
  })

  it('returns an empty array for empty input', () => {
    expect(extractTechStack('')).toEqual([])
  })

  it('extracts Node.js and PostgreSQL correctly', () => {
    const result = extractTechStack('Node.js and PostgreSQL required')
    expect(result).toContain('Node.js')
    expect(result).toContain('PostgreSQL')
  })
})
