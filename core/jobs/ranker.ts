import Database from 'better-sqlite3'
import { rowToPosting } from './adapters/base'
import type { JobPosting, JobPostingRow } from './adapters/base'

export function getRankedPostings(db: Database.Database): JobPosting[] {
  const rows = db
    .prepare(
      `SELECT * FROM job_postings
       WHERE raw_text IS NOT NULL
       ORDER BY
         CASE WHEN posted_at IS NOT NULL THEN posted_at ELSE fetched_at END DESC`,
    )
    .all() as JobPostingRow[]

  return rows.map(rowToPosting)
}
