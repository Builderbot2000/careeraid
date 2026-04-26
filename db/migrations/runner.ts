import Database from 'better-sqlite3'
import sql001 from './001_initial.sql?raw'
import sql002 from './002_profile.sql?raw'
import sql003 from './003_resume.sql?raw'
import sql004 from './004_jobs.sql?raw'
import sql005 from './005_safe_storage.sql?raw'
import sql006 from './006_llm_usage.sql?raw'
import sql007 from './007_affinity_reasoning.sql?raw'
import sql008 from './008_applications_nullable_applied_at.sql?raw'

interface MigrationRecord {
  filename: string
}

const MIGRATIONS: ReadonlyArray<{ filename: string; sql: string }> = [
  { filename: '001_initial.sql', sql: sql001 },
  { filename: '002_profile.sql', sql: sql002 },
  { filename: '003_resume.sql', sql: sql003 },
  { filename: '004_jobs.sql', sql: sql004 },
  { filename: '005_safe_storage.sql', sql: sql005 },
  { filename: '006_llm_usage.sql', sql: sql006 },
  { filename: '007_affinity_reasoning.sql', sql: sql007 },
  { filename: '008_applications_nullable_applied_at.sql', sql: sql008 },
]

export function runMigrations(
  db: Database.Database,
  log: (msg: string) => void = console.log,
): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      filename  TEXT    NOT NULL UNIQUE,
      run_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const ran = new Set(
    (db.prepare('SELECT filename FROM _migrations').all() as MigrationRecord[]).map(
      (r) => r.filename,
    ),
  )

  for (const { filename, sql } of MIGRATIONS) {
    if (ran.has(filename)) continue

    log(`Running migration: ${filename}`)
    const apply = db.transaction(() => {
      db.exec(sql)
      db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(filename)
    })
    apply()
    log(`Migration complete: ${filename}`)
  }
}
