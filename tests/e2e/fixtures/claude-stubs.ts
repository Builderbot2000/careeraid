/**
 * Fixture payloads returned by Claude stub handlers when CAREERAID_TEST=1.
 * These are imported by tests/stubs-main.ts which runs inside the main process.
 */

import type { SearchTerm } from '../../../src/shared/ipc-types'

// ─── Search term generation stub ─────────────────────────────────────────────

export const STUB_SEARCH_TERMS: Omit<SearchTerm, 'id' | 'created_at'>[] = [
  { term: 'senior backend engineer remote', enabled: true, source: 'llm_generated', locations: null, seniorities: null, work_type: null, recency: null, max_results: null },
  { term: 'staff engineer typescript', enabled: true, source: 'llm_generated', locations: null, seniorities: null, work_type: null, recency: null, max_results: null },
  { term: 'platform engineer go kubernetes', enabled: true, source: 'llm_generated', locations: null, seniorities: null, work_type: null, recency: null, max_results: null },
]

// ─── Resume tailor stub ───────────────────────────────────────────────────────

export const STUB_RESUME_DATA = {
  summary: 'Experienced software engineer with a strong background in distributed systems.',
  experience: [
    {
      company: 'Acme Corp',
      role: 'Senior Software Engineer',
      start_date: '2021-01',
      end_date: 'present',
      bullets: [
        'Designed and shipped high-throughput data pipelines.',
        'Led a team of four engineers to deliver a major product launch.',
      ],
    },
  ],
  skills: {
    languages: ['TypeScript', 'Go'],
    frameworks: ['React', 'Express'],
    tools: ['Docker', 'Kubernetes', 'PostgreSQL'],
  },
  education: [
    {
      institution: 'State University',
      degree: 'B.Sc. Computer Science',
      year: '2018',
    },
  ],
  credentials: ['AWS Certified Solutions Architect'],
}

// ─── Resume PDF import stub ───────────────────────────────────────────────────

export const STUB_PDF_IMPORT_ENTRIES: Omit<import('../../../src/shared/ipc-types').ProfileEntry, 'id' | 'created_at'>[] = [
  {
    type: 'experience',
    title: 'Senior Software Engineer at Acme Corp',
    content: 'Led backend development using TypeScript and PostgreSQL. Designed high-throughput data pipelines processing 1M events/day.',
    tags: ['typescript', 'postgresql', 'backend'],
    start_date: '2021-01-01',
    end_date: null,
  },
  {
    type: 'education',
    title: 'B.Sc. Computer Science — State University',
    content: 'Bachelor of Science in Computer Science. Graduated with honours.',
    tags: ['computer science'],
    start_date: '2014-09-01',
    end_date: '2018-06-01',
  },
  {
    type: 'skill',
    title: 'Programming Languages',
    content: 'Proficient in TypeScript, Go, and Python. Familiar with Rust.',
    tags: ['typescript', 'go', 'python'],
    start_date: null,
    end_date: null,
  },
]

// ─── Affinity scoring stub ────────────────────────────────────────────────────
// Returns a scoring result for every posting ID passed in.
// Callers should map their posting IDs over this to produce the response array.

export function stubAffinityScore(postingId: string): {
  posting_id: string
  affinity_score: number
  reasoning: string
} {
  return {
    posting_id: postingId,
    affinity_score: 0.82,
    reasoning: 'Strong match on backend systems experience and required tech stack.',
  }
}
