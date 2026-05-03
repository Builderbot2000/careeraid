import Database from 'better-sqlite3'
import { rowToPosting } from '../jobs/adapters/base'
import type { JobPosting, JobPostingRow } from '../jobs/adapters/base'
import type { PostingStatus } from './models'

export interface TrackerPosting extends JobPosting {
  applied_at: string | null
}

interface TrackerPostingRow extends JobPostingRow {
  applied_at: string | null
}

/** Returns all postings that have progressed past new/viewed — i.e. the tracker rows. */
export function getTrackerPostings(db: Database.Database): TrackerPosting[] {
  const rows = db
    .prepare(
      `SELECT jp.*
       FROM job_postings jp
       WHERE jp.status NOT IN ('new', 'viewed')
       ORDER BY jp.last_seen_at DESC`,
    )
    .all() as TrackerPostingRow[]

  return rows.map((row) => ({ ...rowToPosting(row), applied_at: row.applied_at ?? null }))
}

export function deletePostings(db: Database.Database, ids: string[]): void {
  if (ids.length === 0) return
  const placeholders = ids.map(() => '?').join(',')
  db.prepare(`DELETE FROM job_postings WHERE id IN (${placeholders})`).run(...ids)
}

/**
 * Updates a posting's status. Sets first_response_at when first transitioning
 * out of 'applied' (interviewing, offer, rejected, ghosted).
 */
export function updatePostingStatus(
  db: Database.Database,
  id: string,
  status: PostingStatus,
): void {
  const now = new Date().toISOString()
  const isFirstResponse = ['interviewing', 'offer', 'rejected', 'ghosted'].includes(status)

  if (status === 'applied') {
    db.prepare(
      `UPDATE job_postings SET status = ?, last_seen_at = ?,
       applied_at = CASE WHEN applied_at IS NULL THEN ? ELSE applied_at END
       WHERE id = ?`,
    ).run(status, now, now, id)
  } else if (isFirstResponse) {
    db.prepare(
      `UPDATE job_postings
       SET status = ?, last_seen_at = ?,
           first_response_at = CASE WHEN first_response_at IS NULL THEN ? ELSE first_response_at END
       WHERE id = ?`,
    ).run(status, now, now, id)
  } else {
    db.prepare(`UPDATE job_postings SET status = ?, last_seen_at = ? WHERE id = ?`).run(
      status,
      now,
      id,
    )
  }
}
