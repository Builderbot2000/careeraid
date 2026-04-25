/**
 * Test stubs for IPC handlers that invoke Claude.
 * This module is imported by electron/main.ts when CAREERAID_TEST=1.
 * It replaces Claude-dependent handlers with deterministic fixture responses.
 */

import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs'
import { getDb } from '../db/database'
import { STUB_SEARCH_TERMS, STUB_RESUME_DATA, stubAffinityScore } from '../tests/e2e/fixtures/claude-stubs'
import type { SearchTerm } from '../src/shared/ipc-types'
import { renderTex } from '../core/resume/renderer'
import { compileTex } from '../core/resume/compiler'
import { pdfPathToUrl } from '../core/resume/previewer'
import { app } from 'electron'
import { runScrape } from '../core/jobs/aggregator'
import { MockAdapter } from '../core/jobs/adapters/mock'
import { getRankedPostings } from '../core/jobs/ranker'

export function registerTestStubs(): void {
  // ─── Scrape — add a small delay so the 'Running…' UI state is observable ────
  ipcMain.removeHandler('jobs:run-scrape')
  ipcMain.handle('jobs:run-scrape', async () => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    return runScrape(getDb(), [new MockAdapter()])
  })

  // ─── Search term generation ─────────────────────────────────────────────────
  // Override: return deterministic AI-suggested terms without calling Claude.
  ipcMain.removeHandler('search-terms:generate')
  ipcMain.handle('search-terms:generate', () => {
    const db = getDb()
    const now = new Date().toISOString()

    // Clear existing llm_generated terms (same behaviour as real handler)
    db.prepare("DELETE FROM search_terms WHERE source = 'llm_generated'").run()

    const inserted: SearchTerm[] = []
    for (const t of STUB_SEARCH_TERMS) {
      const id = randomUUID()
      db.prepare(
        `INSERT INTO search_terms (id, adapter_id, term, enabled, source, created_at)
         VALUES (?, ?, ?, 1, 'llm_generated', ?)`,
      ).run(id, t.adapter_id, t.term, now)
      inserted.push({ ...t, id, created_at: now })
    }
    return inserted
  })

  // ─── Affinity scoring (ranker) ──────────────────────────────────────────────
  // The ranker calls Claude internally. In test mode, pre-populate affinity
  // scores directly in the DB so the ranker skips the Claude call entirely.
  // We do this by overriding `jobs:run-scrape` post-processing to stamp scores.
  // Simpler approach: after a scrape commit, a one-off IPC to seed scores.
  // The cleanest seam: override jobs:get-postings to stamp scores if absent.
  ipcMain.removeHandler('jobs:get-postings')
  ipcMain.handle('jobs:get-postings', () => {
    const db = getDb()
    // Stamp stub affinity scores for any unscored postings
    const unscored = db
      .prepare("SELECT id FROM job_postings WHERE affinity_score IS NULL AND status != 'archived'")
      .all() as { id: string }[]

    if (unscored.length > 0) {
      const now = new Date().toISOString()
      const update = db.prepare(
        'UPDATE job_postings SET affinity_score = ?, affinity_scored_at = ? WHERE id = ?',
      )
      for (const { id } of unscored) {
        const scored = stubAffinityScore(id)
        update.run(scored.affinity_score, now, id)
      }
    }

    // Now delegate to the real ranking logic.
    // Since we've already stamped scores, the ranker won't call Claude.
    return getRankedPostings(db, null)
  })

  // ─── Resume tailoring ───────────────────────────────────────────────────────
  // Override: return a pre-built resume without calling Claude.
  ipcMain.removeHandler('resume:tailor')
  ipcMain.handle('resume:tailor', async (_event, payload: unknown) => {
    const { templateName, postingId } = payload as {
      templateName: string
      postingId?: string
    }

    const applicationId = randomUUID()
    const userData = app.getPath('userData')
    const texDir = path.join(userData, 'resumes', applicationId)
    const texPath = path.join(texDir, 'resume.tex')

    renderTex(templateName ?? 'classic', STUB_RESUME_DATA as never, texPath)

    // Attempt real compilation; if xelatex absent, return a placeholder PDF URL
    let pdfUrl = `file://${texPath.replace('.tex', '.pdf')}`
    try {
      const outcome = await compileTex(texPath, 'xelatex')
      if (outcome.success) pdfUrl = pdfPathToUrl(outcome.pdfPath)
    } catch {
      // xelatex not available in CI — return stub path; preview test checks iframe src
    }

    const application = {
      id: applicationId,
      posting_id: postingId ?? null,
      tex_path: texPath,
      resume_json: JSON.stringify(STUB_RESUME_DATA),
      schema_version: 1,
      applied_at: null,
      notes: '',
    }

    getDb()
      .prepare(
        `INSERT INTO applications (id, posting_id, tex_path, resume_json, schema_version, applied_at, notes)
         VALUES (@id, @posting_id, @tex_path, @resume_json, @schema_version, @applied_at, @notes)`,
      )
      .run(application)

    return { application, pdfUrl }
  })

  // ─── Dialog stubs for file operations ──────────────────────────────────────
  // Override backup and data export to write to a predictable temp path
  // so tests can assert a file was created without OS dialog interaction.
  const tmpDir = app.getPath('temp')

  ipcMain.removeHandler('backup:create')
  ipcMain.handle('backup:create', () => {
    const dbPath = path.join(app.getPath('userData'), 'jobhunt.db')
    const dest = path.join(tmpDir, `careeraid-test-backup-${Date.now()}.db`)
    if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, dest)
    return dest
  })

  // ─── Direct-path import (test-only) ───────────────────────────────────────
  // Allows tests to import from a specific file path without the OS open dialog.
  ipcMain.handle('data:import-file', (_event, { mode, filePath }: { mode: 'merge' | 'replace'; filePath: string }) => {
    const db = getDb()
    const raw = fs.readFileSync(filePath, 'utf-8')
    let payload: Record<string, unknown>
    try { payload = JSON.parse(raw) } catch { throw new Error('Invalid JSON file') }
    let imported = 0
    db.transaction(() => {
      if (mode === 'replace') {
        db.prepare('DELETE FROM profile_entries').run()
        db.prepare('DELETE FROM search_terms').run()
        db.prepare('DELETE FROM ban_list').run()
      }
      if (Array.isArray(payload.profile_entries)) {
        const stmt = db.prepare(
          `INSERT OR IGNORE INTO profile_entries (id, type, title, content, tags, start_date, end_date, created_at)
           VALUES (@id, @type, @title, @content, @tags, @start_date, @end_date, @created_at)`,
        )
        for (const e of payload.profile_entries as Record<string, unknown>[]) {
          if (e.id && e.type && e.title && e.content) { stmt.run(e); imported++ }
        }
      }
    })()
    return { imported }
  })

  ipcMain.removeHandler('data:export')
  ipcMain.handle('data:export', () => {
    const db = getDb()
    const payload = {
      version: 1,
      exported_at: new Date().toISOString(),
      profile_entries: db.prepare('SELECT * FROM profile_entries').all(),
      search_config: db.prepare('SELECT * FROM search_config WHERE id = 1').get(),
      search_terms: db.prepare('SELECT * FROM search_terms').all(),
      ban_list: db.prepare('SELECT * FROM ban_list').all(),
    }
    const dest = path.join(tmpDir, `careeraid-test-export-${Date.now()}.json`)
    fs.writeFileSync(dest, JSON.stringify(payload, null, 2), 'utf-8')
    return dest
  })
}
