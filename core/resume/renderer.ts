import nunjucks from 'nunjucks'
import fs from 'fs'
import path from 'path'
import type { ResumeData } from './validator'

let env: nunjucks.Environment | null = null

function getEnv(): nunjucks.Environment {
  if (env) return env
  const templateDir = path.join(__dirname, '..', '..', 'templates', 'resume')
  env = nunjucks.configure(templateDir, {
    autoescape: false,
    throwOnUndefined: true,
    trimBlocks: true,
    lstripBlocks: true,
  })
  return env
}

// Escape characters that are special in LaTeX.
// Backslash must be replaced first to avoid double-escaping.
function escapeLatex(s: string): string {
  return s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/#/g, '\\#')
    .replace(/\$/g, '\\$')
    .replace(/%/g, '\\%')
    .replace(/&/g, '\\&')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\^/g, '\\^{}')
    .replace(/~/g, '\\~{}')
}

// Walk the data tree and escape every string leaf.
function escapeData(value: unknown): unknown {
  if (typeof value === 'string') return escapeLatex(value)
  if (Array.isArray(value)) return value.map(escapeData)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, escapeData(v)]),
    )
  }
  return value
}

export function renderTex(
  templateName: string,
  data: ResumeData,
  outPath: string,
): void {
  const e = getEnv()
  const tex = e.render(`${templateName}.tex.njk`, escapeData(data) as ResumeData)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, tex, 'utf-8')
}
