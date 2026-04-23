import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type {
  ProfileEntry,
  UserProfile,
  CreateProfileEntryInput,
  UpdateProfileEntryInput,
} from './models'

// ─── Row shapes from SQLite ───────────────────────────────────────────────────

interface ProfileEntryRow {
  id: string
  type: string
  title: string
  content: string
  tags: string // stored as JSON array string
  start_date: string | null
  end_date: string | null
  created_at: string
}

function rowToEntry(row: ProfileEntryRow): ProfileEntry {
  return {
    ...row,
    type: row.type as ProfileEntry['type'],
    tags: JSON.parse(row.tags) as string[],
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function getAllEntries(db: Database.Database): ProfileEntry[] {
  const rows = db
    .prepare('SELECT * FROM profile_entries ORDER BY created_at DESC')
    .all() as ProfileEntryRow[]
  return rows.map(rowToEntry)
}

export function getEntry(db: Database.Database, id: string): ProfileEntry | null {
  const row = db
    .prepare('SELECT * FROM profile_entries WHERE id = ?')
    .get(id) as ProfileEntryRow | undefined
  return row ? rowToEntry(row) : null
}

export function createEntry(
  db: Database.Database,
  input: CreateProfileEntryInput,
): ProfileEntry {
  const id = randomUUID()
  const created_at = new Date().toISOString()
  const tags = JSON.stringify(input.tags)

  db.prepare(
    `INSERT INTO profile_entries (id, type, title, content, tags, start_date, end_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.type,
    input.title,
    input.content,
    tags,
    input.start_date ?? null,
    input.end_date ?? null,
    created_at,
  )

  return { id, ...input, created_at }
}

export function updateEntry(
  db: Database.Database,
  id: string,
  updates: UpdateProfileEntryInput,
): ProfileEntry {
  const existing = getEntry(db, id)
  if (!existing) throw new Error(`Profile entry not found: ${id}`)

  const merged = { ...existing, ...updates }

  db.prepare(
    `UPDATE profile_entries
     SET type = ?, title = ?, content = ?, tags = ?, start_date = ?, end_date = ?
     WHERE id = ?`,
  ).run(
    merged.type,
    merged.title,
    merged.content,
    JSON.stringify(merged.tags),
    merged.start_date ?? null,
    merged.end_date ?? null,
    id,
  )

  return merged
}

export function deleteEntry(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM profile_entries WHERE id = ?').run(id)
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export function getUserProfile(db: Database.Database): UserProfile {
  return db
    .prepare('SELECT * FROM user_profile WHERE id = 1')
    .get() as UserProfile
}

export function setUserYoe(db: Database.Database, yoe: number | null): void {
  db.prepare('UPDATE user_profile SET yoe = ? WHERE id = 1').run(yoe)
}

// ─── Word Count ───────────────────────────────────────────────────────────────

export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

// ─── Markdown Export / Import ─────────────────────────────────────────────────

/**
 * Exports all profile entries and YOE as a human-readable, re-importable
 * Markdown file.
 *
 * Format per entry:
 *   ---
 *   type: experience
 *   id: <uuid>
 *   title: <title>
 *   tags: tag1, tag2
 *   start_date: YYYY-MM-DD
 *   end_date: YYYY-MM-DD
 *   created_at: <ISO datetime>
 *
 *   <content paragraphs>
 */
export function exportToMarkdown(db: Database.Database): string {
  const profile = getUserProfile(db)
  const entries = getAllEntries(db)

  const lines: string[] = ['# Profile Export', '']

  if (profile.yoe !== null) {
    lines.push(`yoe: ${profile.yoe}`, '')
  }

  for (const entry of entries) {
    lines.push('---', '')
    lines.push(`type: ${entry.type}`)
    lines.push(`id: ${entry.id}`)
    lines.push(`title: ${entry.title}`)
    lines.push(`tags: ${entry.tags.join(', ')}`)
    lines.push(`start_date: ${entry.start_date ?? ''}`)
    lines.push(`end_date: ${entry.end_date ?? ''}`)
    lines.push(`created_at: ${entry.created_at}`)
    lines.push('')
    lines.push(entry.content)
    lines.push('')
  }

  lines.push('---')

  return lines.join('\n')
}

/**
 * Imports entries from a previously exported Markdown file.
 * Merge mode only: entries already present by id are skipped.
 * Returns counts of added and skipped entries.
 */
export function importFromMarkdown(
  db: Database.Database,
  markdown: string,
): { added: number; skipped: number } {
  let added = 0
  let skipped = 0

  // Extract optional yoe line from the header
  const yoeMatch = markdown.match(/^yoe:\s*(\d+)/m)
  if (yoeMatch) {
    setUserYoe(db, parseInt(yoeMatch[1], 10))
  }

  // Split into sections on lines that are exactly '---'
  const sections = markdown.split(/^---$/m).map((s) => s.trim()).filter(Boolean)

  // First section is the header block (# Profile Export + yoe), skip it
  const entrySections = sections.slice(1)

  const validTypes = new Set([
    'experience',
    'credential',
    'accomplishment',
    'skill',
    'education',
  ])

  const importTx = db.transaction(() => {
    for (const section of entrySections) {
      const sectionLines = section.split('\n')
      const meta: Record<string, string> = {}
      let contentStartIdx = 0

      // Read key: value pairs until the first blank line or non-matching line
      for (let i = 0; i < sectionLines.length; i++) {
        const line = sectionLines[i]
        const match = line.match(/^([a-z_]+):\s*(.*)$/)
        if (match) {
          meta[match[1]] = match[2].trim()
          contentStartIdx = i + 1
        } else {
          // Blank line separates metadata from content
          contentStartIdx = line.trim() === '' ? i + 1 : i
          break
        }
      }

      const content = sectionLines.slice(contentStartIdx).join('\n').trim()

      if (!meta['type'] || !meta['title'] || !meta['id']) continue
      if (!validTypes.has(meta['type'])) continue

      // UUID format check (basic)
      if (!/^[0-9a-f-]{36}$/i.test(meta['id'])) continue

      // Skip if already exists
      const existing = getEntry(db, meta['id'])
      if (existing) {
        skipped++
        continue
      }

      const tags = meta['tags']
        ? meta['tags'].split(',').map((t) => t.trim()).filter(Boolean)
        : []

      db.prepare(
        `INSERT INTO profile_entries (id, type, title, content, tags, start_date, end_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        meta['id'],
        meta['type'],
        meta['title'],
        content,
        JSON.stringify(tags),
        meta['start_date'] || null,
        meta['end_date'] || null,
        meta['created_at'] || new Date().toISOString(),
      )

      added++
    }
  })

  importTx()

  return { added, skipped }
}
