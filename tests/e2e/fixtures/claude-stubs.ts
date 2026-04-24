/**
 * Fixture payloads returned by Claude stub handlers when CAREERAID_TEST=1.
 * These are imported by tests/stubs-main.ts which runs inside the main process.
 */

import type { SearchTerm } from '../../../src/shared/ipc-types'

// ─── Search term generation stub ─────────────────────────────────────────────

export const STUB_SEARCH_TERMS: Omit<SearchTerm, 'id' | 'created_at'>[] = [
  { adapter_id: 'mock', term: 'senior backend engineer remote', enabled: true, source: 'llm_generated' },
  { adapter_id: 'mock', term: 'staff engineer typescript', enabled: true, source: 'llm_generated' },
  { adapter_id: 'mock', term: 'platform engineer go kubernetes', enabled: true, source: 'llm_generated' },
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
