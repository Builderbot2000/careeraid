import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

const LEVEL_RANK: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 }

let logDir = ''
let currentLevel: LogLevel = 'info'
const isDev = process.env.NODE_ENV === 'development'

function logFilePath(): string {
  const date = new Date().toISOString().slice(0, 10)
  return path.join(logDir, `jobhunt-${date}.log`)
}

function write(level: LogLevel, msg: string, ...meta: unknown[]): void {
  if (LEVEL_RANK[level] > LEVEL_RANK[currentLevel]) return

  const ts = new Date().toISOString()
  const suffix = meta.length ? ' ' + JSON.stringify(meta) : ''
  const line = `[${ts}] [${level.toUpperCase().padEnd(5)}] ${msg}${suffix}\n`

  if (isDev) {
    // eslint-disable-next-line no-console
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    fn(line.trim())
  }

  if (logDir) {
    try {
      fs.appendFileSync(logFilePath(), line, 'utf-8')
    } catch {
      // Non-fatal: if we can't write the log file, don't crash the app
    }
  }
}

function pruneOldLogs(retentionDays: number): void {
  try {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
    for (const file of fs.readdirSync(logDir)) {
      if (!/^jobhunt-\d{4}-\d{2}-\d{2}\.log$/.test(file)) continue
      const p = path.join(logDir, file)
      if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p)
    }
  } catch {
    // Non-fatal
  }
}

export function initLogger(level: LogLevel = 'info', retentionDays = 30): void {
  logDir = path.join(app.getPath('userData'), 'logs')
  fs.mkdirSync(logDir, { recursive: true })
  currentLevel = level
  pruneOldLogs(retentionDays)
}

export function setLogLevel(level: LogLevel): void {
  currentLevel = level
}

export const logger = {
  error: (msg: string, ...meta: unknown[]) => write('error', msg, ...meta),
  warn:  (msg: string, ...meta: unknown[]) => write('warn',  msg, ...meta),
  info:  (msg: string, ...meta: unknown[]) => write('info',  msg, ...meta),
  debug: (msg: string, ...meta: unknown[]) => write('debug', msg, ...meta),
}
