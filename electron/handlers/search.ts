import { ipcMain } from 'electron'
import { getDb } from '../../db/database'
import { getApiKey } from '../settings'
import { generateSearchTerms, generateSearchTermsFromProfile } from '../../core/jobs/searchTermGen'
import type { SearchTerm, AddSearchTermData, SearchTermSeniority, WorkType, Recency, GenConstraints } from '../../src/shared/ipc-types'
import { randomUUID } from 'crypto'

export function registerSearchHandlers(): void {
  ipcMain.handle('search:get-config', () => {
    return (
      getDb()
        .prepare('SELECT * FROM search_config WHERE id = 1')
        .get() ?? {
        intent: null,
        term_generation_hash: null,
        ranking_weights: '{}',
        excluded_stack: '[]',
        required_keywords: '[]',
        excluded_keywords: '[]',
        keyword_match_fields: '["title","tech_stack"]',
      }
    )
  })

  ipcMain.handle('search:update-config', (_event, updates: Record<string, unknown>) => {
    const allowed = new Set([
      'intent',
      'ranking_weights',
      'excluded_stack',
      'required_keywords',
      'excluded_keywords',
      'keyword_match_fields',
      'term_generation_hash',
    ])
    const db = getDb()
    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.has(key)) continue
      db.prepare(`UPDATE search_config SET "${key}" = ? WHERE id = 1`).run(
        value === null || value === undefined ? null : typeof value === 'string' ? value : String(value),
      )
    }
  })

  ipcMain.handle('search-terms:get', () => {
    const rows = getDb()
      .prepare('SELECT * FROM search_terms ORDER BY created_at')
      .all() as Array<Omit<SearchTerm, 'enabled' | 'locations' | 'seniorities' | 'work_type'> & { enabled: number; locations: string | null; seniorities: string | null; work_type: string | null }>
    return rows.map((r) => ({
      ...r,
      enabled: r.enabled === 1,
      locations: r.locations ? JSON.parse(r.locations) as string[] : null,
      seniorities: r.seniorities ? JSON.parse(r.seniorities) as SearchTermSeniority[] : null,
      work_type: r.work_type ? JSON.parse(r.work_type) as WorkType[] : null,
    }))
  })

  ipcMain.handle('search-terms:generate', async (_event, constraints?: GenConstraints) => {
    const key = getApiKey()
    if (!key) throw new Error('No API key stored — set one in Settings first')
    const config = getDb()
      .prepare('SELECT intent FROM search_config WHERE id = 1')
      .get() as { intent: string | null } | undefined
    const intent = config?.intent ?? ''
    if (!intent.trim()) throw new Error('Set a search intent before generating terms')
    return generateSearchTerms(getDb(), key, intent, constraints)
  })

  ipcMain.handle('search-terms:generate-from-profile', async (_event, constraints?: GenConstraints) => {
    const key = getApiKey()
    if (!key) throw new Error('No API key stored — set one in Settings first')
    return generateSearchTermsFromProfile(getDb(), key, constraints)
  })

  ipcMain.handle(
    'search-terms:update',
    (_event, { id, updates }: {
      id: string
      updates: {
        term?: string
        enabled?: boolean
        locations?: string[] | null
        seniorities?: string[] | null
        work_type?: string[] | null
        recency?: string | null
        max_results?: number | null
      }
    }) => {
      if (typeof id !== 'string' || !id) throw new Error('Invalid id')
      const db = getDb()
      if (updates.term !== undefined) {
        db.prepare('UPDATE search_terms SET term = ? WHERE id = ?').run(updates.term, id)
      }
      if (updates.enabled !== undefined) {
        db.prepare('UPDATE search_terms SET enabled = ? WHERE id = ?').run(
          updates.enabled ? 1 : 0,
          id,
        )
      }
      if ('locations' in updates) {
        db.prepare('UPDATE search_terms SET locations = ? WHERE id = ?').run(
          updates.locations?.length ? JSON.stringify(updates.locations) : null, id)
      }
      if ('seniorities' in updates) {
        db.prepare('UPDATE search_terms SET seniorities = ? WHERE id = ?').run(
          updates.seniorities?.length ? JSON.stringify(updates.seniorities) : null, id)
      }
      if ('work_type' in updates) {
        db.prepare('UPDATE search_terms SET work_type = ? WHERE id = ?').run(
          updates.work_type?.length ? JSON.stringify(updates.work_type) : null, id)
      }
      if ('recency' in updates) {
        db.prepare('UPDATE search_terms SET recency = ? WHERE id = ?').run(updates.recency ?? null, id)
      }
      if ('max_results' in updates) {
        db.prepare('UPDATE search_terms SET max_results = ? WHERE id = ?').run(updates.max_results ?? null, id)
      }
    },
  )

  ipcMain.handle(
    'search-terms:add',
    (_event, { data }: { data: AddSearchTermData }) => {
      if (!data.role.trim()) throw new Error('Role cannot be empty')
      const id = randomUUID()
      const now = new Date().toISOString()
      getDb()
        .prepare(
          `INSERT INTO search_terms
             (id, term, enabled, source, created_at, locations, seniorities, work_type, recency, max_results)
           VALUES (?, ?, 1, 'user_added', ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          data.role.trim(),
          now,
          data.locations?.length ? JSON.stringify(data.locations) : null,
          data.seniorities?.length ? JSON.stringify(data.seniorities) : null,
          data.work_type?.length ? JSON.stringify(data.work_type) : null,
          data.recency ?? null,
          data.max_results ?? null,
        )
      const newTerm: SearchTerm = {
        id,
        term: data.role.trim(),
        enabled: true,
        source: 'user_added',
        created_at: now,
        locations: data.locations ?? null,
        seniorities: data.seniorities ?? null,
        work_type: data.work_type ?? null,
        recency: (data.recency ?? null) as Recency | null,
        max_results: data.max_results ?? null,
      }
      return newTerm
    },
  )

  ipcMain.handle('search-terms:delete', (_event, id: string) => {
    getDb().prepare('DELETE FROM search_terms WHERE id = ?').run(id)
  })

  ipcMain.handle('location:suggest', async (_event, query: string) => {
    if (typeof query !== 'string' || query.trim().length < 2) return []
    const q = query.trim()
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'CareerIndex/1.0' },
        signal: AbortSignal.timeout(4000),
      })
      if (!res.ok) throw new Error(`Nominatim ${res.status}`)
      const data = await res.json() as Array<{ display_name: string }>
      return data.map((r) => r.display_name).filter(Boolean)
    } catch {
      const CITIES = [
        'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'San Francisco, CA',
        'Seattle, WA', 'Austin, TX', 'Boston, MA', 'Denver, CO', 'Atlanta, GA',
        'Miami, FL', 'Portland, OR', 'San Diego, CA', 'Dallas, TX', 'Houston, TX',
        'Phoenix, AZ', 'Minneapolis, MN', 'Washington, DC', 'Philadelphia, PA',
        'London, UK', 'Amsterdam, Netherlands', 'Berlin, Germany', 'Paris, France',
        'Toronto, Canada', 'Vancouver, Canada', 'Montreal, Canada',
        'Sydney, Australia', 'Melbourne, Australia', 'Singapore', 'Tokyo, Japan',
        'Dublin, Ireland', 'Stockholm, Sweden', 'Copenhagen, Denmark',
        'Zurich, Switzerland', 'Barcelona, Spain', 'Madrid, Spain',
        'Warsaw, Poland', 'Prague, Czech Republic', 'Lisbon, Portugal',
        'Remote', 'Worldwide',
      ]
      const lower = q.toLowerCase()
      return CITIES.filter((c) => c.toLowerCase().includes(lower)).slice(0, 6)
    }
  })
}
