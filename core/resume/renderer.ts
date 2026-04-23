import nunjucks from 'nunjucks'
import fs from 'fs'
import path from 'path'
import type { ResumeData } from './validator'

let env: nunjucks.Environment | null = null

function getEnv(): nunjucks.Environment {
  if (env) return env
  // __dirname is core/resume — templates are at project root /templates/resume
  const templateDir = path.join(__dirname, '..', '..', 'templates', 'resume')
  env = nunjucks.configure(templateDir, {
    autoescape: false, // LaTeX content must not be HTML-escaped
    throwOnUndefined: true,
    trimBlocks: true,
    lstripBlocks: true,
  })
  return env
}

export function renderTex(
  templateName: string,
  data: ResumeData,
  outPath: string,
): void {
  const e = getEnv()
  const tex = e.render(`${templateName}.tex.njk`, data)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, tex, 'utf-8')
}
