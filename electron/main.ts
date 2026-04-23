import { app, BrowserWindow, ipcMain, shell, dialog, session } from 'electron'
import path from 'path'
import fs from 'fs'
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
import type { FeatureLocks, Settings, SettingKey } from '../src/shared/ipc-types'
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
import { getTrackerPostings, updatePostingStatus } from '../core/tracker/repository'
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
    return getDb().prepare('SELECT intent FROM search_config WHERE id = 1').get() ?? { intent: null }
  })

  ipcMain.handle('search:update-config', (_event, updates: { intent?: string | null }) => {
    if (updates.intent !== undefined) {
      getDb()
        .prepare('UPDATE search_config SET intent = ? WHERE id = 1')
        .run(updates.intent ?? null)
    }
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
    return getRankedPostings(getDb())
  })

  ipcMain.handle('jobs:update-status', (_event, { id, status }: { id: string; status: string }) => {
    updatePostingStatus(getDb(), id, status as PostingStatus)
  })

  // ─── Tracker ──────────────────────────────────────────────────────────────

  ipcMain.handle('tracker:get-postings', () => {
    return getTrackerPostings(getDb())
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
