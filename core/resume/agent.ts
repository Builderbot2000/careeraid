import Anthropic from '@anthropic-ai/sdk'
import type { ProfileEntry } from '../../src/shared/ipc-types'
import { ResumeDataSchema, type ResumeData } from './validator'

// Token cost table (USD per 1M tokens) — stub; wired to llm_usage in Phase 8
const PRICE_TABLE: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5': { input: 3.0, output: 15.0 },
  'claude-opus-4-5': { input: 15.0, output: 75.0 },
}
const DEFAULT_MODEL = 'claude-sonnet-4-5'
const MAX_RETRIES = 2

// ─── Prompt construction ──────────────────────────────────────────────────────

function serializeProfile(entries: ProfileEntry[]): string {
  return entries
    .map((e) => {
      const dateRange =
        e.start_date || e.end_date
          ? ` (${e.start_date ?? '?'} – ${e.end_date ?? 'present'})`
          : ''
      const tags = e.tags.length ? `\nTags: ${e.tags.join(', ')}` : ''
      return `[${e.type.toUpperCase()}] ${e.title}${dateRange}${tags}\n${e.content}`
    })
    .join('\n\n---\n\n')
}

function buildPrompt(entries: ProfileEntry[], jobDescription: string, templateName: string): string {
  const profileBlock = serializeProfile(entries)

  // Truncate JD if it would push the payload too large (simple char limit)
  const maxJdChars = 8000
  const jd =
    jobDescription.length > maxJdChars
      ? jobDescription.slice(0, maxJdChars) + '\n[truncated]'
      : jobDescription

  return `You are a professional resume writer. Given a candidate's profile and a job description, produce a tailored resume as a strict JSON object. Output ONLY valid JSON — no markdown fences, no commentary, no trailing text.

Template: ${templateName}

## Candidate Profile
${profileBlock}

## Job Description
${jd}

## Required JSON Schema
Return an object with exactly these fields:
{
  "summary": "2-3 sentence professional summary tailored to this role",
  "experience": [
    {
      "company": "Company name",
      "role": "Job title",
      "start_date": "Month YYYY",
      "end_date": "Month YYYY or Present",
      "bullets": ["Achievement-oriented bullet using numbers where possible"]
    }
  ],
  "skills": {
    "languages": ["string"],
    "frameworks": ["string"],
    "tools": ["string"]
  },
  "education": [
    {
      "institution": "School name",
      "degree": "Degree and field",
      "year": "YYYY"
    }
  ],
  "credentials": ["string"]
}

Rules:
- Include only experience entries directly relevant to the role
- Each experience must have 2-4 bullets maximum
- Bullets must be under 120 characters each
- Draw only from the provided profile — do not invent facts
- At least one experience entry is required
- Output ONLY the JSON object`
}

// ─── LLM call ────────────────────────────────────────────────────────────────

/** Stub: replaced with real write in Phase 8 */
function recordLlmUsageStub(
  _model: string,
  _inputTokens: number,
  _outputTokens: number,
  _postingId: string | null,
): void {
  // no-op until llm_usage table is created in Phase 6
}

export async function tailorResume(
  apiKey: string,
  entries: ProfileEntry[],
  jobDescription: string,
  templateName: string,
  postingId: string | null = null,
): Promise<ResumeData> {
  const client = new Anthropic({ apiKey })
  const prompt = buildPrompt(entries, jobDescription, templateName)
  const model = DEFAULT_MODEL

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: prompt },
    ]

    // On retry, append the previous error so the model can self-correct
    if (attempt > 0 && lastError) {
      messages.push({ role: 'assistant', content: '' })
      messages.push({
        role: 'user',
        content: `Your previous response failed validation. Errors:\n${lastError.message}\n\nPlease return ONLY the corrected JSON object.`,
      })
    }

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      messages,
    })

    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens
    const priceEntry = PRICE_TABLE[model] ?? { input: 0, output: 0 }
    const _cost =
      (inputTokens * priceEntry.input + outputTokens * priceEntry.output) / 1_000_000

    recordLlmUsageStub(model, inputTokens, outputTokens, postingId)

    const raw = response.content.find((b) => b.type === 'text')?.text ?? ''

    let parsed: unknown
    try {
      // Strip accidental markdown fences if the model disobeyed
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      lastError = new Error(`Response was not valid JSON: ${raw.slice(0, 200)}`)
      continue
    }

    const validated = ResumeDataSchema.safeParse(parsed)
    if (validated.success) return validated.data

    lastError = new Error(validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  }

  throw new Error(`Resume tailoring failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`)
}
