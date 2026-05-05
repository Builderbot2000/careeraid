import { describe, it, expect } from 'vitest'
import {
  buildSearchUrl,
  cleanJobUrl,
  parsePostedAt,
  parseSalary,
  parseRating,
} from './index'

// ─── buildSearchUrl ───────────────────────────────────────────────────────────

describe('buildSearchUrl', () => {
  it('includes sc.keyword for the search term', () => {
    const url = buildSearchUrl('typescript engineer', {}, 0)
    expect(url).toContain('sc.keyword=typescript+engineer')
  })

  it('includes locKeyword when location is provided', () => {
    const url = buildSearchUrl('engineer', { location: 'San Francisco' }, 0)
    expect(url).toContain('locKeyword=San+Francisco')
  })

  it('includes fromAge=1 for day recency', () => {
    const url = buildSearchUrl('engineer', { recency: 'day' }, 0)
    expect(url).toContain('fromAge=1')
  })

  it('includes fromAge=7 for week recency', () => {
    const url = buildSearchUrl('engineer', { recency: 'week' }, 0)
    expect(url).toContain('fromAge=7')
  })

  it('includes fromAge=30 for month recency', () => {
    const url = buildSearchUrl('engineer', { recency: 'month' }, 0)
    expect(url).toContain('fromAge=30')
  })

  it('includes remoteWorkType=1 when remote is in workTypes', () => {
    const url = buildSearchUrl('engineer', { workTypes: ['remote'] }, 0)
    expect(url).toContain('remoteWorkType=1')
  })

  it('does not include remoteWorkType when workTypes does not contain remote', () => {
    const url = buildSearchUrl('engineer', { workTypes: ['onsite', 'hybrid'] }, 0)
    expect(url).not.toContain('remoteWorkType')
  })

  it('includes seniorityType=senior for single senior seniority', () => {
    const url = buildSearchUrl('engineer', { seniorities: ['senior'] }, 0)
    expect(url).toContain('seniorityType=senior')
  })

  it('includes seniorityType=entrylevel for single junior seniority', () => {
    const url = buildSearchUrl('engineer', { seniorities: ['junior'] }, 0)
    expect(url).toContain('seniorityType=entrylevel')
  })

  it('includes seniorityType=internship for intern seniority', () => {
    const url = buildSearchUrl('engineer', { seniorities: ['intern'] }, 0)
    expect(url).toContain('seniorityType=internship')
  })

  it('includes seniorityType=director for staff seniority', () => {
    const url = buildSearchUrl('engineer', { seniorities: ['staff'] }, 0)
    expect(url).toContain('seniorityType=director')
  })

  it('picks median seniority when multiple are provided', () => {
    // [junior, mid, senior] sorted → median = mid → midseniorlevel
    const url = buildSearchUrl('engineer', { seniorities: ['junior', 'mid', 'senior'] }, 0)
    expect(url).toContain('seniorityType=midseniorlevel')
  })

  it('does not include p param on page 0', () => {
    const url = buildSearchUrl('engineer', {}, 0)
    expect(url).not.toContain('&p=')
  })

  it('includes p=2 for page index 1', () => {
    const url = buildSearchUrl('engineer', {}, 1)
    expect(url).toContain('p=2')
  })

  it('omits seniorityType when seniorities list is empty', () => {
    const url = buildSearchUrl('engineer', { seniorities: [] }, 0)
    expect(url).not.toContain('seniorityType')
  })

  it('includes all filters together', () => {
    const url = buildSearchUrl('backend engineer', {
      location: 'NYC',
      recency: 'week',
      workTypes: ['remote'],
      seniorities: ['senior'],
    }, 0)
    expect(url).toContain('sc.keyword=backend+engineer')
    expect(url).toContain('locKeyword=NYC')
    expect(url).toContain('fromAge=7')
    expect(url).toContain('remoteWorkType=1')
    expect(url).toContain('seniorityType=senior')
  })
})

// ─── cleanJobUrl ──────────────────────────────────────────────────────────────

describe('cleanJobUrl', () => {
  it('strips tracking params but keeps jl from a full Glassdoor job URL', () => {
    const href = 'https://www.glassdoor.com/job-listing/senior-engineer-JBCD1234.htm?jl=1234&pos=1&ao=1'
    expect(cleanJobUrl(href)).toBe('https://www.glassdoor.com/job-listing/senior-engineer-JBCD1234.htm?jl=1234')
  })

  it('handles relative href and preserves jl', () => {
    const href = '/job-listing/senior-engineer-JBCD1234.htm?jl=1234'
    expect(cleanJobUrl(href)).toBe('https://www.glassdoor.com/job-listing/senior-engineer-JBCD1234.htm?jl=1234')
  })

  it('normalises glassdoor.ca TLD to glassdoor.com and keeps jl', () => {
    const href = 'https://www.glassdoor.ca/job-listing/accounting-manager-JV_IC3708260.htm?jl=1010012741864&src=GD_JOB_AD&ao=1'
    expect(cleanJobUrl(href)).toBe('https://www.glassdoor.com/job-listing/accounting-manager-JV_IC3708260.htm?jl=1010012741864')
  })

  it('works when jl param is absent', () => {
    const href = 'https://www.glassdoor.com/job-listing/senior-engineer-JBCD1234.htm?pos=1&ao=1'
    expect(cleanJobUrl(href)).toBe('https://www.glassdoor.com/job-listing/senior-engineer-JBCD1234.htm')
  })

  it('converts partner URL to canonical form with jl param', () => {
    const href = '/partner/jobListing?jobListingId=5678&src=GD'
    expect(cleanJobUrl(href)).toBe('https://www.glassdoor.com/job-listing/-JL5678.htm?jl=5678')
  })

  it('returns href unchanged for unparseable input', () => {
    expect(cleanJobUrl('not-a-url')).toBe('not-a-url')
  })
})

// ─── parsePostedAt ────────────────────────────────────────────────────────────

describe('parsePostedAt', () => {
  const today = new Date().toISOString().slice(0, 10)

  it('returns today for "Just now"', () => {
    expect(parsePostedAt('Just now')).toBe(today)
  })

  it('returns today for "Today"', () => {
    expect(parsePostedAt('Today')).toBe(today)
  })

  it('returns today for "Just posted"', () => {
    expect(parsePostedAt('Just posted')).toBe(today)
  })

  it('returns null for "30+ days ago"', () => {
    expect(parsePostedAt('30+ days ago')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parsePostedAt('')).toBeNull()
  })

  it('offsets by the correct number of days', () => {
    const result = parsePostedAt('3 days ago')
    const expected = new Date()
    expected.setDate(expected.getDate() - 3)
    expect(result).toBe(expected.toISOString().slice(0, 10))
  })

  it('offsets by the correct number of weeks', () => {
    const result = parsePostedAt('2 weeks ago')
    const expected = new Date()
    expected.setDate(expected.getDate() - 14)
    expect(result).toBe(expected.toISOString().slice(0, 10))
  })
})

// ─── parseSalary ──────────────────────────────────────────────────────────────

describe('parseSalary', () => {
  it('parses annual K range: "$80K–$120K/yr"', () => {
    expect(parseSalary('$80K–$120K/yr')).toEqual({ salary_min: 80000, salary_max: 120000 })
  })

  it('parses "Est. $90K/yr" as min-only', () => {
    expect(parseSalary('Est. $90K/yr')).toEqual({ salary_min: 90000, salary_max: null })
  })

  it('parses "Employer est.: $100K–$150K/yr"', () => {
    expect(parseSalary('Employer est.: $100K–$150K/yr')).toEqual({
      salary_min: 100000,
      salary_max: 150000,
    })
  })

  it('converts hourly range to annual: "$45–$65/hr" (×2080)', () => {
    expect(parseSalary('$45–$65/hr')).toEqual({ salary_min: 93600, salary_max: 135200 })
  })

  it('parses single annual figure: "$120K/yr"', () => {
    expect(parseSalary('$120K/yr')).toEqual({ salary_min: 120000, salary_max: null })
  })

  it('returns nulls for empty string', () => {
    expect(parseSalary('')).toEqual({ salary_min: null, salary_max: null })
  })

  it('returns nulls for unrecognised text', () => {
    expect(parseSalary('N/A')).toEqual({ salary_min: null, salary_max: null })
  })

  it('parses plain dollar amounts without K suffix', () => {
    expect(parseSalary('$80000–$100000/yr')).toEqual({ salary_min: 80000, salary_max: 100000 })
  })
})

// ─── parseRating ─────────────────────────────────────────────────────────────

describe('parseRating', () => {
  it('parses "4.2" as 4.2', () => {
    expect(parseRating('4.2')).toBe(4.2)
  })

  it('parses "3.5 ★" stripping non-numeric suffix', () => {
    expect(parseRating('3.5 ★')).toBe(3.5)
  })

  it('parses integer rating "4"', () => {
    expect(parseRating('4')).toBe(4)
  })

  it('returns null for empty string', () => {
    expect(parseRating('')).toBeNull()
  })

  it('returns null for out-of-range value 0.5', () => {
    expect(parseRating('0.5')).toBeNull()
  })

  it('returns null for out-of-range value 5.5', () => {
    expect(parseRating('5.5')).toBeNull()
  })

  it('returns null for non-numeric text', () => {
    expect(parseRating('Not rated')).toBeNull()
  })
})
