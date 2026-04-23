import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { renderTex } from './renderer'
import { ResumeDataSchema, type ResumeData } from './validator'

export interface CompileResult {
  success: true
  pdfPath: string
}

export interface CompileError {
  success: false
  errorLine: string
  fullLog: string
}

export type CompileOutcome = CompileResult | CompileError

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract the most actionable error line from xelatex stderr/stdout */
function extractActionableError(log: string): string {
  const lines = log.split('\n')
  // xelatex errors start with '!' or contain 'Error'
  const errorLine =
    lines.find((l) => l.startsWith('!')) ??
    lines.find((l) => /error/i.test(l)) ??
    lines.find((l) => l.trim().length > 0) ??
    'Unknown compilation error'
  return errorLine.trim()
}

// ─── Compile ──────────────────────────────────────────────────────────────────

export function compileTex(
  texPath: string,
  xelatexBin: string,
): Promise<CompileOutcome> {
  return new Promise((resolve) => {
    const dir = path.dirname(texPath)
    const args = [
      '--no-shell-escape',
      '--interaction=nonstopmode',
      '--output-directory',
      dir,
      texPath,
    ]

    let output = ''
    const proc = spawn(xelatexBin, args, { cwd: dir })

    proc.stdout.on('data', (d: Buffer) => { output += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { output += d.toString() })

    proc.on('close', (code) => {
      const pdfPath = texPath.replace(/\.tex$/, '.pdf')
      if (code === 0 && fs.existsSync(pdfPath)) {
        resolve({ success: true, pdfPath })
      } else {
        resolve({
          success: false,
          errorLine: extractActionableError(output),
          fullLog: output,
        })
      }
    })

    proc.on('error', (err) => {
      resolve({
        success: false,
        errorLine: err.message,
        fullLog: err.message,
      })
    })
  })
}

// ─── Recompile from snapshot ──────────────────────────────────────────────────

/**
 * Regenerates the .tex file from the stored JSON snapshot and recompiles.
 * Used when the .tex file is missing (e.g. after reinstall).
 */
export async function recompileFromSnapshot(
  resumeJson: string,
  templateName: string,
  texPath: string,
  xelatexBin: string,
): Promise<CompileOutcome> {
  const parsed = ResumeDataSchema.safeParse(JSON.parse(resumeJson))
  if (!parsed.success) {
    return {
      success: false,
      errorLine: 'Stored snapshot failed schema validation — cannot recompile',
      fullLog: parsed.error.message,
    }
  }
  renderTex(templateName, parsed.data as ResumeData, texPath)
  return compileTex(texPath, xelatexBin)
}
