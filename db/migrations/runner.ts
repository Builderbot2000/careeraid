import Database from 'better-sqlite3'
import sql001 from './001_initial.sql?raw'

interface MigrationRecord {
  filename: string
}

const MIGRATIONS: ReadonlyArray<{ filename: string; sql: string }> = [
  { filename: '001_initial.sql', sql: sql001 },
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
