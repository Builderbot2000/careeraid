import { ipcMain, dialog } from 'electron'
import fs from 'fs'
import { getDb } from '../../db/database'
import { logger } from '../logger'

export function registerBackupHandlers(): void {
  ipcMain.handle('backup:create', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `careerindex-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    })
    if (canceled || !filePath) return null
    await getDb().backup(filePath)
    logger.info('Backup created', { filePath })
    return filePath
  })

  ipcMain.handle('data:export', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `careerindex-export-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (canceled || !filePath) return null

    const db = getDb()
    const payload = {
      version: 1,
      exported_at: new Date().toISOString(),
      user_profile: db.prepare('SELECT * FROM user_profile WHERE id = 1').get(),
      profile_entries: db.prepare('SELECT * FROM profile_entries').all(),
      search_config: db.prepare('SELECT * FROM search_config WHERE id = 1').get(),
      search_terms: db.prepare('SELECT * FROM search_terms').all(),
      ban_list: db.prepare('SELECT * FROM ban_list').all(),
    }

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')
    logger.info('Data exported', { filePath })
    return filePath
  })

  ipcMain.handle('data:import', async (_event, mode: 'merge' | 'replace') => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (canceled || !filePaths[0]) return null
    return runImport(filePaths[0], mode)
  })

  // Used by e2e tests to import from a known path without a file dialog
  ipcMain.handle('data:import-file', async (_event, { mode, filePath }: { mode: 'merge' | 'replace'; filePath: string }) => {
    return runImport(filePath, mode)
  })
}

function runImport(filePath: string, mode: 'merge' | 'replace'): { imported: number } {
  const raw = fs.readFileSync(filePath, 'utf-8')
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new Error('Invalid JSON file')
  }

  const db = getDb()
  let imported = 0

  db.transaction(() => {
    if (mode === 'replace') {
      db.prepare('DELETE FROM profile_entries').run()
      db.prepare('DELETE FROM search_terms').run()
      db.prepare('DELETE FROM ban_list').run()
      db.prepare(
        `UPDATE user_profile SET yoe = NULL, yoe_industry = '[]', languages = '[]', citizenship = '[]', drivers_license = 0 WHERE id = 1`,
      ).run()
    }

    if (Array.isArray(payload.profile_entries)) {
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO profile_entries (id, type, title, content, tags, start_date, end_date, created_at)
         VALUES (@id, @type, @title, @content, @tags, @start_date, @end_date, @created_at)`,
      )
      for (const e of payload.profile_entries as Record<string, unknown>[]) {
        if (e.id && e.type && e.title && e.content) {
          stmt.run(e)
          imported++
        }
      }
    }

    if (Array.isArray(payload.search_terms)) {
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO search_terms (id, term, enabled, source, created_at, locations, seniorities, work_type, recency, max_results)
         VALUES (@id, @term, @enabled, @source, @created_at, @locations, @seniorities, @work_type, @recency, @max_results)`,
      )
      for (const t of payload.search_terms as Record<string, unknown>[]) {
        if (t.id && t.term) {
          stmt.run({
            id: t.id,
            term: t.term,
            enabled: t.enabled ?? 1,
            source: t.source ?? 'user_added',
            created_at: t.created_at ?? new Date().toISOString(),
            locations: t.locations ?? null,
            seniorities: t.seniorities ?? null,
            work_type: t.work_type ?? null,
            recency: t.recency ?? null,
            max_results: t.max_results ?? null,
          })
          imported++
        }
      }
    }

    if (Array.isArray(payload.ban_list)) {
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO ban_list (id, type, value, reason, created_at)
         VALUES (@id, @type, @value, @reason, @created_at)`,
      )
      for (const b of payload.ban_list as Record<string, unknown>[]) {
        if (b.id && b.type && b.value) {
          stmt.run(b)
          imported++
        }
      }
    }

    if (payload.user_profile && typeof payload.user_profile === 'object') {
      const up = payload.user_profile as Record<string, unknown>
      db.prepare(
        `UPDATE user_profile SET yoe = ?, yoe_industry = ?, languages = ?, citizenship = ?, drivers_license = ? WHERE id = 1`,
      ).run(
        up.yoe ?? null,
        typeof up.yoe_industry === 'string' ? up.yoe_industry : '[]',
        typeof up.languages === 'string' ? up.languages : '[]',
        typeof up.citizenship === 'string' ? up.citizenship : '[]',
        up.drivers_license ?? 0,
      )
    }
  })()

  logger.info('Data imported', { mode, imported })
  return { imported }
}
