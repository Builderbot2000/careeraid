import { app, BrowserWindow, ipcMain, shell, dialog, session } from 'electron'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import { initLogger, logger, setLogLevel, type LogLevel } from './logger'
import { initConnectionManager, closeDb } from './connection-manager'
import { getDb } from '../db/database'
import { runMigrations } from '../db/migrations/runner'
import {
  getSettings,
  updateSetting,
  getApiKeyPresent,
  getApiKey,
  saveApiKey,
  deleteApiKey,
} from './settings'
import type { FeatureLocks, Settings, SettingKey, BanListEntry, SearchTerm } from '../src/shared/ipc-types'
import {
  getAllEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  getUserProfile,
  setUserYoe,
  exportToMarkdown,
  importFromMarkdown,
  countWords,
} from '../core/profile/repository'
import { CreateProfileEntrySchema, UpdateProfileEntrySchema } from '../core/profile/models'
import { tailorResume } from '../core/resume/agent'
import { renderTex } from '../core/resume/renderer'
import { compileTex, recompileFromSnapshot } from '../core/resume/compiler'
import { pdfPathToUrl } from '../core/resume/previewer'
import type { Application } from '../src/shared/ipc-types'
import { MockAdapter } from '../core/jobs/adapters/mock'
import { runScrape, commitScrape, discardScrape } from '../core/jobs/aggregator'
import { getRankedPostings } from '../core/jobs/ranker'
import { generateSearchTerms } from '../core/jobs/searchTermGen'
import { writeLLMUsage } from '../core/jobs/llmUsage'
import { getTrackerPostings, updatePostingStatus } from '../core/tracker/repository'
import {
  getFunnelSummary,
  getBySource,
  getBySeniority,
  getWeeklyTimeSeries,
  getLLMCostSummary,
  getLLMCostByType,
} from '../core/tracker/analytics'
import type { PostingStatus } from '../core/tracker/models'

const isDev = process.env.NODE_ENV === 'development'

// ─── Window ───────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 920,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  win.once('ready-to-show', () => win.show())

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}

// ─── Content Security Policy ──────────────────────────────────────────────────

function applyCSP(): void {
  if (isDev) return // CSP too strict breaks Vite HMR in dev
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' file:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: file:; font-src 'self' data:; frame-src file:",
        ],
      },
    })
  })
}

// ─── Startup Validation ───────────────────────────────────────────────────────

async function runStartupValidation(): Promise<{
  hardBlock: false
  featureLocks: FeatureLocks
} | {
  hardBlock: true
  reason: string
}> {
  // Hard block 1: userData writable
  try {
    const userData = app.getPath('userData')
    fs.mkdirSync(userData, { recursive: true })
    const probe = path.join(userData, '.write-probe')
    fs.writeFileSync(probe, '')
    fs.unlinkSync(probe)
  } catch (e) {
    return { hardBlock: true, reason: `User data directory is not writable: ${e}` }
  }

  // Hard block 2: SQLite + migrations
  try {
    initConnectionManager()
    runMigrations(getDb(), (msg) => logger.info(msg))
  } catch (e) {
    return { hardBlock: true, reason: `Cannot open database: ${e}` }
  }

  // Retention policy: clear raw_text from stale non-favorited postings
  try {
    const settings = getSettings()
    const retentionDays = settings.posting_retention_days ?? 60
    getDb()
      .prepare(
        `UPDATE job_postings SET raw_text = NULL
         WHERE status NOT IN ('favorited')
           AND last_seen_at < date('now', '-' || ? || ' days')`,
      )
      .run(retentionDays)
  } catch (e) {
    logger.warn('Retention policy failed (non-fatal)', { error: String(e) })
  }

  // Apply persisted log level now that settings are readable
  try {
    const settings = getSettings()
    setLogLevel(settings.log_level)
  } catch {
    // Non-fatal — keep default log level
  }

  const featureLocks: FeatureLocks = {
    claudeApiKey: false,
    claudeConnectivity: false,
    xelatex: false,
    playwrightChromium: false,
    profileEmpty: false,
  }

  // Feature lock: Claude API key
  try {
    featureLocks.claudeApiKey = !getApiKeyPresent()
  } catch {
    featureLocks.claudeApiKey = true
  }

  // Feature lock: xelatex
  try {
    const settings = getSettings()
    if (settings.tex_binary_path) {
      featureLocks.xelatex = !fs.existsSync(settings.tex_binary_path)
    } else {
      const candidates = [
        '/usr/bin/xelatex',
        '/usr/local/bin/xelatex',
        'C:\\texlive\\2024\\bin\\windows\\xelatex.exe',
        'C:\\Program Files\\MiKTeX\\miktex\\bin\\x64\\xelatex.exe',
      ]
      featureLocks.xelatex = !candidates.some((p) => fs.existsSync(p))
    }
  } catch {
    featureLocks.xelatex = true
  }

  // Feature lock: Playwright Chromium
  const playwrightDir = path.join(app.getPath('userData'), 'ms-playwright')
  featureLocks.playwrightChromium = !fs.existsSync(playwrightDir)

  // Feature lock: profile empty (table may not exist until Phase 2)
  try {
    const count = (
      getDb().prepare('SELECT COUNT(*) AS count FROM profile_entries').get() as {
        count: number
      }
    ).count
    featureLocks.profileEmpty = count === 0
  } catch {
    featureLocks.profileEmpty = true
  }

  logger.info('Startup validation complete', featureLocks)
  return { hardBlock: false, featureLocks }
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  // Settings
  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:update', (_event, { key, value }: { key: SettingKey; value: unknown }) => {
    updateSetting(key, value as Settings[SettingKey])
    if (key === 'log_level') setLogLevel(value as LogLevel)
  })

  ipcMain.handle('settings:api-key-present', () => getApiKeyPresent())

  ipcMain.handle('settings:set-api-key', (_event, key: string) => {
    if (typeof key !== 'string' || key.trim().length === 0) {
      throw new Error('API key must be a non-empty string')
    }
    saveApiKey(key.trim())
  })

  ipcMain.handle('settings:delete-api-key', () => deleteApiKey())

  // Shell — only allow https:// URLs
  ipcMain.handle('shell:open-external', (_event, url: string) => {
    if (typeof url !== 'string' || !url.startsWith('https://')) {
      logger.warn(`Blocked non-https URL in openExternal: ${url}`)
      throw new Error('Only https:// URLs are permitted')
    }
    return shell.openExternal(url)
  })

  // ─── Profile ─────────────────────────────────────────────────────────────

  ipcMain.handle('profile:get-all', () => getAllEntries(getDb()))

  ipcMain.handle('profile:create', (_event, input: unknown) => {
    const parsed = CreateProfileEntrySchema.safeParse(input)
    if (!parsed.success) throw new Error(parsed.error.message)
    const settings = getSettings()
    const wc = countWords(parsed.data.content)
    if (wc > settings.profile_entry_word_limit) {
      throw new Error(
        `Content exceeds word limit of ${settings.profile_entry_word_limit} words (${wc} found)`,
      )
    }
    return createEntry(getDb(), parsed.data)
  })

  ipcMain.handle(
    'profile:update',
    (_event, { id, updates }: { id: string; updates: unknown }) => {
      const parsed = UpdateProfileEntrySchema.safeParse(updates)
      if (!parsed.success) throw new Error(parsed.error.message)
      if (parsed.data.content !== undefined) {
        const settings = getSettings()
        const wc = countWords(parsed.data.content)
        if (wc > settings.profile_entry_word_limit) {
          throw new Error(
            `Content exceeds word limit of ${settings.profile_entry_word_limit} words (${wc} found)`,
          )
        }
      }
      return updateEntry(getDb(), id, parsed.data)
    },
  )

  ipcMain.handle('profile:delete', (_event, id: string) => {
    deleteEntry(getDb(), id)
  })

  ipcMain.handle('profile:get-user', () => getUserProfile(getDb()))

  ipcMain.handle('profile:set-yoe', (_event, yoe: unknown) => {
    const val = yoe === null ? null : typeof yoe === 'number' ? Math.floor(yoe) : null
    setUserYoe(getDb(), val)
  })

  ipcMain.handle('profile:export', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: 'profile.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (canceled || !filePath) return null
    const markdown = exportToMarkdown(getDb())
    fs.writeFileSync(filePath, markdown, 'utf-8')
    logger.info('Profile exported', { filePath })
    return filePath
  })

  ipcMain.handle('profile:import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      properties: ['openFile'],
    })
    if (canceled || !filePaths[0]) return null
    const markdown = fs.readFileSync(filePaths[0], 'utf-8')
    const result = importFromMarkdown(getDb(), markdown)
    logger.info('Profile imported', result)
    return result
  })

  // ─── Resume ───────────────────────────────────────────────────────────────

  ipcMain.handle(
    'resume:tailor',
    async (
      _event,
      payload: unknown,
    ) => {
      const { jobDescription, templateName, postingId } = payload as {
        jobDescription: string
        templateName: string
        postingId?: string
      }
      if (typeof jobDescription !== 'string' || !jobDescription.trim()) {
        throw new Error('jobDescription must be a non-empty string')
      }
      if (typeof templateName !== 'string' || !templateName.trim()) {
        throw new Error('templateName must be a non-empty string')
      }

      if (!getApiKeyPresent()) throw new Error('No API key stored — set one in Settings first')

      const key = getApiKey()
      if (!key) throw new Error('API key not retrievable')

      const entries = getAllEntries(getDb())
      if (entries.length === 0) throw new Error('Profile is empty — add entries first')

      const resumeData = await tailorResume(
        key,
        entries,
        jobDescription,
        templateName,
        postingId ?? null,
        getDb(),
      )

      const applicationId = crypto.randomUUID()
      const userData = app.getPath('userData')
      const texDir = path.join(userData, 'resumes', applicationId)
      const texPath = path.join(texDir, 'resume.tex')

      renderTex(templateName, resumeData, texPath)

      const settings = getSettings()
      const xelatexBin =
        settings.tex_binary_path ??
        [
          '/usr/bin/xelatex',
          '/usr/local/bin/xelatex',
          'C:\\texlive\\2024\\bin\\windows\\xelatex.exe',
          'C:\\Program Files\\MiKTeX\\miktex\\bin\\x64\\xelatex.exe',
        ].find((p) => fs.existsSync(p)) ??
        'xelatex'

      const outcome = await compileTex(texPath, xelatexBin)
      if (!outcome.success) {
        throw new Error(`xelatex compilation failed: ${outcome.errorLine}`)
      }

      const application: Application = {
        id: applicationId,
        posting_id: postingId ?? null,
        tex_path: texPath,
        resume_json: JSON.stringify(resumeData),
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

      logger.info('Resume tailored', { applicationId, templateName })
      return { application, pdfUrl: pdfPathToUrl(outcome.pdfPath) }
    },
  )

  ipcMain.handle('resume:get-applications', () => {
    return getDb().prepare('SELECT * FROM applications ORDER BY rowid DESC').all()
  })

  ipcMain.handle('resume:get-templates', () => {
    const templateDir = path.join(__dirname, '..', '..', 'templates', 'resume')
    if (!fs.existsSync(templateDir)) return []
    return fs
      .readdirSync(templateDir)
      .filter((f) => f.endsWith('.tex.njk'))
      .map((f) => f.replace('.tex.njk', ''))
  })

  ipcMain.handle('resume:recompile', async (_event, applicationId: string) => {
    const row = getDb()
      .prepare('SELECT * FROM applications WHERE id = ?')
      .get(applicationId) as Application | undefined

    if (!row) throw new Error(`Application ${applicationId} not found`)

    const settings = getSettings()
    const xelatexBin =
      settings.tex_binary_path ??
      [
        '/usr/bin/xelatex',
        '/usr/local/bin/xelatex',
        'C:\\texlive\\2024\\bin\\windows\\xelatex.exe',
        'C:\\Program Files\\MiKTeX\\miktex\\bin\\x64\\xelatex.exe',
      ].find((p) => fs.existsSync(p)) ??
      'xelatex'

    // Detect which template was used from stored tex path directory
    const templateGuess = 'classic'

    const outcome = await recompileFromSnapshot(
      row.resume_json,
      templateGuess,
      row.tex_path,
      xelatexBin,
    )

    if (!outcome.success) {
      throw new Error(`Recompile failed: ${outcome.errorLine}`)
    }

    return pdfPathToUrl(outcome.pdfPath)
  })

  // ─── Search Config ────────────────────────────────────────────────────────

  ipcMain.handle('search:get-config', () => {
    return (
      getDb()
        .prepare('SELECT * FROM search_config WHERE id = 1')
        .get() ?? {
        intent: null,
        term_generation_hash: null,
        ranking_weights: '{}',
        affinity_skip_threshold: 15,
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
      'affinity_skip_threshold',
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

  // ─── Search Terms ─────────────────────────────────────────────────────────

  ipcMain.handle('search-terms:get', () => {
    const rows = getDb()
      .prepare('SELECT * FROM search_terms ORDER BY adapter_id, created_at')
      .all() as Array<Omit<SearchTerm, 'enabled'> & { enabled: number }>
    return rows.map((r) => ({ ...r, enabled: r.enabled === 1 }))
  })

  ipcMain.handle('search-terms:generate', async () => {
    const key = getApiKey()
    if (!key) throw new Error('No API key stored — set one in Settings first')
    const config = getDb()
      .prepare('SELECT intent FROM search_config WHERE id = 1')
      .get() as { intent: string | null } | undefined
    const intent = config?.intent ?? ''
    if (!intent.trim()) throw new Error('Set a search intent before generating terms')
    return generateSearchTerms(getDb(), key, intent)
  })

  ipcMain.handle(
    'search-terms:update',
    (_event, { id, updates }: { id: string; updates: { term?: string; enabled?: boolean } }) => {
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
    },
  )

  ipcMain.handle(
    'search-terms:add',
    (_event, { adapterId, term }: { adapterId: string; term: string }) => {
      if (!term.trim()) throw new Error('Term cannot be empty')
      const id = randomUUID()
      const now = new Date().toISOString()
      getDb()
        .prepare(
          `INSERT INTO search_terms (id, adapter_id, term, enabled, source, created_at)
           VALUES (?, ?, ?, 1, 'user_added', ?)`,
        )
        .run(id, adapterId, term.trim(), now)
      const newTerm: SearchTerm = {
        id,
        adapter_id: adapterId,
        term: term.trim(),
        enabled: true,
        source: 'user_added',
        created_at: now,
      }
      return newTerm
    },
  )

  ipcMain.handle('search-terms:delete', (_event, id: string) => {
    getDb().prepare('DELETE FROM search_terms WHERE id = ?').run(id)
  })

  // ─── Ban List ─────────────────────────────────────────────────────────────

  ipcMain.handle('ban-list:get', () => {
    return getDb().prepare('SELECT * FROM ban_list ORDER BY type, value').all()
  })

  ipcMain.handle(
    'ban-list:preview',
    (_event, { type, value }: { type: 'company' | 'domain'; value: string }) => {
      const db = getDb()
      if (type === 'domain') {
        const row = db
          .prepare('SELECT COUNT(*) AS count FROM job_postings WHERE resolved_domain = ?')
          .get(value) as { count: number }
        return row.count
      }
      // Company — test regex against all company names
      const companies = db
        .prepare('SELECT DISTINCT company FROM job_postings')
        .all() as { company: string }[]
      let pattern: RegExp
      try {
        pattern = new RegExp(value, 'i')
      } catch {
        pattern = new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      }
      return companies.filter((r) => pattern.test(r.company)).length
    },
  )

  ipcMain.handle(
    'ban-list:add',
    (
      _event,
      { type, value, reason }: { type: 'company' | 'domain'; value: string; reason?: string },
    ) => {
      if (!value.trim()) throw new Error('Value cannot be empty')
      const db = getDb()
      const id = randomUUID()
      const now = new Date().toISOString()
      db.prepare(
        'INSERT INTO ban_list (id, type, value, reason, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(id, type, value.trim(), reason ?? null, now)

      // Hard-delete matching postings
      let deletedCount = 0
      if (type === 'domain') {
        const result = db
          .prepare('DELETE FROM job_postings WHERE resolved_domain = ?')
          .run(value.trim())
        deletedCount = result.changes
      } else {
        const all = db.prepare('SELECT id, company FROM job_postings').all() as {
          id: string
          company: string
        }[]
        let pattern: RegExp
        try {
          pattern = new RegExp(value.trim(), 'i')
        } catch {
          pattern = new RegExp(value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        }
        const toDelete = all.filter((r) => pattern.test(r.company)).map((r) => r.id)
        if (toDelete.length > 0) {
          const placeholders = toDelete.map(() => '?').join(',')
          db.prepare(`DELETE FROM job_postings WHERE id IN (${placeholders})`).run(toDelete)
          deletedCount = toDelete.length
        }
      }

      const entry: BanListEntry = { id, type, value: value.trim(), reason: reason ?? null, created_at: now }
      logger.info('Ban entry added', { type, value, deletedCount })
      return { entry, deletedCount }
    },
  )

  ipcMain.handle('ban-list:remove', (_event, id: string) => {
    getDb().prepare('DELETE FROM ban_list WHERE id = ?').run(id)
  })

  // ─── Jobs ─────────────────────────────────────────────────────────────────

  ipcMain.handle('jobs:run-scrape', async () => {
    const adapters = [new MockAdapter()]
    return runScrape(getDb(), adapters)
  })

  ipcMain.handle('jobs:commit-scrape', () => {
    commitScrape(getDb())
    mainWindow?.webContents.send('jobs:scrape-committed')
    logger.info('Scrape committed')
  })

  ipcMain.handle('jobs:discard-scrape', () => {
    discardScrape()
    logger.info('Scrape discarded')
  })

  ipcMain.handle('jobs:get-postings', () => {
    const key = getApiKeyPresent() ? getApiKey() : null
    return getRankedPostings(getDb(), key)
  })

  ipcMain.handle('jobs:update-status', (_event, { id, status }: { id: string; status: string }) => {
    updatePostingStatus(getDb(), id, status as PostingStatus)
  })

  // ─── Tracker ──────────────────────────────────────────────────────────────

  ipcMain.handle('tracker:get-postings', () => {
    return getTrackerPostings(getDb())
  })

  // ─── Analytics ────────────────────────────────────────────────────────────

  ipcMain.handle('analytics:funnel', () => getFunnelSummary(getDb()))
  ipcMain.handle('analytics:by-source', () => getBySource(getDb()))
  ipcMain.handle('analytics:by-seniority', () => getBySeniority(getDb()))
  ipcMain.handle('analytics:weekly', () => getWeeklyTimeSeries(getDb()))
  ipcMain.handle('analytics:llm-cost', () => getLLMCostSummary(getDb()))
  ipcMain.handle('analytics:llm-cost-by-type', () => getLLMCostByType(getDb()))

  // ─── Backup ───────────────────────────────────────────────────────────────

  ipcMain.handle('backup:create', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `careeraid-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    })
    if (canceled || !filePath) return null
    const dbPath = path.join(app.getPath('userData'), 'jobhunt.db')
    fs.copyFileSync(dbPath, filePath)
    logger.info('Backup created', { filePath })
    return filePath
  })

  // ─── Data Export ──────────────────────────────────────────────────────────

  ipcMain.handle('data:export', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `careeraid-export-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (canceled || !filePath) return null

    const db = getDb()
    const payload = {
      version: 1,
      exported_at: new Date().toISOString(),
      profile_entries: db.prepare('SELECT * FROM profile_entries').all(),
      search_config: db.prepare('SELECT * FROM search_config WHERE id = 1').get(),
      search_terms: db.prepare('SELECT * FROM search_terms').all(),
      ban_list: db.prepare('SELECT * FROM ban_list').all(),
    }

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')
    logger.info('Data exported', { filePath })
    return filePath
  })

  // ─── Data Import ──────────────────────────────────────────────────────────

  ipcMain.handle('data:import', async (_event, mode: 'merge' | 'replace') => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (canceled || !filePaths[0]) return null

    const raw = fs.readFileSync(filePaths[0], 'utf-8')
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
      }

      // Profile entries
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

      // Search terms
      if (Array.isArray(payload.search_terms)) {
        const stmt = db.prepare(
          `INSERT OR IGNORE INTO search_terms (id, adapter_id, term, enabled, source, created_at)
           VALUES (@id, @adapter_id, @term, @enabled, @source, @created_at)`,
        )
        for (const t of payload.search_terms as Record<string, unknown>[]) {
          if (t.id && t.adapter_id && t.term) {
            stmt.run(t)
            imported++
          }
        }
      }

      // Ban list
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
    })()

    logger.info('Data imported', { mode, imported })
    return { imported }
  })
}

// On Linux without a Secret Service daemon (e.g. WSL, minimal desktops),
// force safeStorage into "basic" mode so encryption is always available.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('password-store', 'basic')
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Logger needs userData path — initialize first
  initLogger('info')
  logger.info('App starting', { version: app.getVersion(), isDev })

  if (process.platform === 'linux') {
    logger.info(
      'Linux detected — D-Bus errors from Chromium (dbus/bus.cc, dbus/object_proxy.cc) ' +
      'are harmless noise from the notification/tray layer; they do not affect app function.',
    )
  }

  applyCSP()
  registerIpcHandlers()

  const result = await runStartupValidation()

  if (result.hardBlock) {
    logger.error('Hard block on startup', { reason: result.reason })
    dialog.showErrorBox('Career Index — Cannot Start', result.reason)
    app.quit()
    return
  }

  mainWindow = createWindow()

  // Push feature lock state to renderer once its IPC listener is ready
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow?.webContents.send('startup:feature-locks', result.featureLocks)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDb()
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow()
  }
})

app.on('before-quit', () => {
  closeDb()
})
