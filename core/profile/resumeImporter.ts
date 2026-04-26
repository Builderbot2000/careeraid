import Anthropic from '@anthropic-ai/sdk'
import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type { ProfileEntry } from '../../src/shared/ipc-types'

const DEFAULT_MODEL = 'claude-sonnet-4-5'

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(): string {
  return `You are a professional resume parser. Extract all structured profile information from the resume document. Output ONLY valid JSON — no markdown fences, no commentary, no trailing text.

Return an object with exactly this shape:
{
  "entries": [
    {
      "type": "experience" | "credential" | "accomplishment" | "skill" | "education",
      "title": "Short descriptive title (e.g. 'Senior Software Engineer at Acme Corp')",
      "content": "Full description of this entry, preserving key details",
      "tags": ["relevant", "lowercase", "keywords"],
      "start_date": "YYYY-MM-DD or null",
      "end_date": "YYYY-MM-DD or null"
    }
  ]
}

Extraction rules:
- Create one entry per job / position (type: "experience")
- Create one entry per educational qualification (type: "education")
- Create one entry per distinct skill group or technology cluster (type: "skill")
- Create one entry per certification or professional credential (type: "credential")
- Create one entry per notable award or accomplishment (type: "accomplishment")
- Dates: use YYYY-MM-DD, fill in January 1st (e.g. "2021-01-01") when only year is given; use null when unknown
- For a current/ongoing position end_date must be null
- Output ONLY the JSON object`
}

// ─── AI call ─────────────────────────────────────────────────────────────────

interface RawEntry {
  type: string
  title: string
  content: string
  tags: string[]
  start_date: string | null
  end_date: string | null
}

const VALID_TYPES = new Set(['experience', 'credential', 'accomplishment', 'skill', 'education'])

function normaliseType(raw: string): ProfileEntry['type'] {
  const lower = String(raw).toLowerCase()
  return VALID_TYPES.has(lower) ? (lower as ProfileEntry['type']) : 'experience'
}

export interface ImportResumeResult {
  added: number
  entries: ProfileEntry[]
}

export async function importProfileFromResumePdf(
  apiKey: string,
  pdfBase64: string,
  db: Database.Database,
): Promise<ImportResumeResult> {
  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            // @ts-expect-error — 'document' content type supported at runtime; SDK typings may lag
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          {
            type: 'text',
            text: buildPrompt(),
          },
        ],
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text content')
  }

  let parsed: { entries: RawEntry[] }
  try {
    const raw = textBlock.text.trim()
    // Strip markdown code fences if present
    const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    parsed = JSON.parse(stripped)
  } catch {
    throw new Error('Claude response was not valid JSON')
  }

  if (!Array.isArray(parsed.entries)) {
    throw new Error('Claude response missing "entries" array')
  }

  const now = new Date().toISOString()
  const insertedEntries: ProfileEntry[] = []

  const stmt = db.prepare(
    `INSERT INTO profile_entries (id, type, title, content, tags, start_date, end_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  db.transaction(() => {
    for (const raw of parsed.entries) {
      if (!raw.title?.trim() || !raw.content?.trim()) continue
      const id = randomUUID()
      const type = normaliseType(raw.type)
      const tags = Array.isArray(raw.tags) ? raw.tags.map(String) : []
      stmt.run(id, type, raw.title.trim(), raw.content.trim(), JSON.stringify(tags), raw.start_date ?? null, raw.end_date ?? null, now)
      insertedEntries.push({
        id,
        type,
        title: raw.title.trim(),
        content: raw.content.trim(),
        tags,
        start_date: raw.start_date ?? null,
        end_date: raw.end_date ?? null,
        created_at: now,
      })
    }
  })()

  return { added: insertedEntries.length, entries: insertedEntries }
}
