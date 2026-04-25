---
layout: default
title: Resume Engine
nav_order: 2
parent: Architecture
---

# Module 2 — Resume Engine

{: .no_toc }

Takes a job description and the full profile repository, uses Claude to select and tailor content, validates the response, renders LaTeX, compiles to PDF, and displays a preview.

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Pipeline Overview

```
Profile (SQLite) + Job Description
        │
        ▼
  Step 1: Prompt Construction (agent.ts)
        │
        ▼
  Step 2: Claude API → structured JSON
        │
        ▼
  Step 3: Zod Validation (validator.ts)
        │  on failure → retry (max 2) → mark parse_failed
        ▼
  Step 4: Nunjucks Rendering (renderer.ts) → .tex file
        │
        ▼
  Step 5: xelatex Compilation (compiler.ts) → PDF
        │  on failure → actionable error surfaced via IPC
        ▼
  Step 6: PDF Preview (previewer.ts) → Electron Chromium renderer
```

---

## Step 1 — Prompt Construction (`agent.ts`)

Profile entries are fetched from SQLite and serialized to a structured text block. The Claude prompt is assembled from:

- Serialized profile entries
- Raw job description text
- Target template schema (field names, constraints, max bullets per role)

Total profile size is bounded by `profile_entry_word_limit` across entries. If the combined payload still approaches the model's context limit, the job description is truncated to fit — profile content is never dropped, as it is the authoritative source material.

---

## Step 2 — Structured LLM Response

Claude returns a strict JSON object only. No LaTeX is generated at this stage:

```json
{
  "summary": "string",
  "experience": [
    {
      "company": "string",
      "role": "string",
      "start_date": "string",
      "end_date": "string",
      "bullets": ["string"]
    }
  ],
  "skills": {
    "languages": ["string"],
    "frameworks": ["string"],
    "tools": ["string"]
  },
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "year": "string"
    }
  ],
  "credentials": ["string"]
}
```

---

## Step 3 — Validation (`validator.ts`)

Zod validates against a versioned schema. Constraints enforced:

- Required fields present and non-empty
- Bullet strings within configured character limit
- Date strings match expected format
- At least one experience entry

On validation failure, error messages are fed back into a retry call (max 2 retries). After retries are exhausted the posting is marked `parse_failed` in the UI with the option to retry manually.

---

## Step 4 — Nunjucks Rendering (`renderer.ts`)

The validated object is passed to the selected `.tex.njk` template via Nunjucks. Template syntax is nearly identical to Jinja2 — {% raw %}`{% for %}`, `{% if %}`, `{{ var }}`{% endraw %} all behave the same way. Output is a `.tex` file written to `<userData>/resumes/<application_id>/resume.tex`.

```typescript
// core/resume/renderer.ts
import nunjucks from 'nunjucks';
import fs from 'fs';
import path from 'path';

const env = nunjucks.configure(path.join(__dirname, '../../templates/resume'), {
  autoescape: false, // LaTeX content must not be HTML-escaped
});

export function renderTex(templateName: string, data: ResumeData, outPath: string): void {
  const tex = env.render(`${templateName}.tex.njk`, data);
  fs.writeFileSync(outPath, tex, 'utf-8');
}
```

---

## Step 5 — xelatex Compilation (`compiler.ts`)

`child_process.spawn` call to `xelatex` with `--no-shell-escape` explicitly enforced. stdout/stderr are captured. On failure, the LaTeX error log is parsed for the most actionable line and surfaced to the renderer via IPC.

**Recompile from snapshot:** If the `.tex` file is missing (e.g. after reinstall), `compiler.ts` regenerates it from the JSON snapshot stored in the `applications` table before compiling. The stored artifact is the `.tex` file — the PDF is always reconstructable.

---

## Step 6 — PDF Preview (`previewer.ts`)

Electron's Chromium renderer displays PDFs natively. The compiled PDF path is sent to the renderer process, which loads it in an `<iframe>` with `src="file://..."`. No image conversion needed — the PDF renders at full fidelity.

---

## Schema Versioning

```
Application
  id              TEXT (UUID)
  posting_id      TEXT  FK → job_postings.id
  tex_path        TEXT             -- Relative: resumes/<application_id>/resume.tex
  resume_json     TEXT (JSON)      -- Point-in-time snapshot for recompile-from-snapshot
  schema_version  INTEGER          -- Incremented when Zod schema changes
  applied_at      TEXT (ISO datetime)
  notes           TEXT | NULL
```

`Application` is a resume artifact record only. All status tracking lives on `job_postings`.

When the schema is updated, a migration handles re-serializing or flagging old snapshots. Old resumes that cannot be re-parsed against the current schema are marked legacy-only — the PDF is still accessible via recompile, but the JSON is not re-parseable.

---

## Templates

Two templates ship with the app:

| Template | File |
|---|---|
| `classic` | `templates/resume/classic.tex.njk` |
| `modern` | `templates/resume/modern.tex.njk` |

The user selects a template before initiating tailoring. The template name is passed to `renderer.ts` which loads the corresponding `.tex.njk` file via Nunjucks.
