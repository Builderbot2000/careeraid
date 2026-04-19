# Job Hunting App — Full Architecture (v7)

## Overview

A local-first desktop application for managing a personal career profile, generating tailored LaTeX resumes, aggregating and ranking job postings, and tracking applications. Everything runs on the user's machine with no hosted backend. The only external calls are to the Anthropic Claude API and job board sources during scraping.

---

## Tech Stack

| Concern | Library |
|---|---|
| Runtime | Electron (main process) + Chromium (renderer) |
| UI framework | React + TypeScript (renderer process) |
| Browser scraping | Playwright (Node.js) |
| Light scraping / HTTP | node-fetch + cheerio |
| RSS feeds | rss-parser |
| LLM calls | Anthropic TypeScript SDK |
| Structured LLM output validation | Zod |
| Relational storage | better-sqlite3 (WAL mode) |
| DB migrations | db-migrate or custom versioned migration runner |
| Resume templating | Nunjucks + xelatex |
| PDF preview | Electron's native Chromium PDF renderer |
| Credential storage | keytar (OS keychain) |
| Packaging + distribution | electron-builder (auto-update via electron-updater) |

---

## Repository Structure

```
/
├── electron/
│   ├── main.ts                  # Electron main process entry point + IPC handlers + startup validation
│   ├── preload.ts               # Context bridge — exposes safe IPC API to renderer
│   └── connection-manager.ts   # better-sqlite3 instance, WAL setup, write-lock state, IPC event bus
│
├── src/                         # Renderer process (React + TypeScript)
│   ├── App.tsx                  # Root component + view routing
│   ├── views/
│   │   ├── Profile.tsx          # Profile editor
│   │   ├── SearchConfig.tsx     # Search intent + term review + ban list + keyword filters + ranking weights
│   │   ├── JobBoard.tsx         # Aggregated postings view + favorites
│   │   ├── ResumePreview.tsx    # Resume tailoring + PDF preview
│   │   ├── Tracker.tsx          # Application history (sortable table)
│   │   ├── Analytics.tsx        # BI metrics dashboard
│   │   └── Settings.tsx         # API key + preferences + backup
│   └── components/              # Reusable React UI components
│
├── core/                        # Main-process business logic (TypeScript)
│   ├── profile/
│   │   ├── repository.ts        # CRUD — SQLite is the single source of truth
│   │   └── models.ts            # Zod schemas + inferred types
│   │
│   ├── resume/
│   │   ├── agent.ts             # Claude API call + prompt construction
│   │   ├── validator.ts         # Zod schema for structured LLM response
│   │   ├── renderer.ts          # Nunjucks → .tex file
│   │   ├── compiler.ts          # child_process xelatex + error handling + recompile-from-snapshot
│   │   └── previewer.ts         # PDF path → Electron BrowserWindow PDF display
│   │
│   ├── jobs/
│   │   ├── aggregator.ts        # Orchestrates scraper mods, owns scrape state machine + in-memory staging + pre-commit filtering
│   │   ├── searchTermGen.ts     # Claude-generated per-adapter search term lists from global user intent
│   │   ├── scorer.ts            # Sequential LLM affinity scoring + cache logic + skip threshold
│   │   ├── ranker.ts            # Post-commit filtering (ban list, keywords, YOE) + composite score assembly
│   │   └── adapters/
│   │       ├── base.ts          # Abstract adapter interface + available_signals declaration
│   │       ├── linkedin.ts      # Playwright-based scraper + hardcoded normalization
│   │       ├── indeed.ts        # Playwright-based scraper + hardcoded normalization
│   │       ├── hackernews.ts    # node-fetch + Algolia API + hardcoded normalization
│   │       └── rss.ts           # rss-parser generic feed adapter + hardcoded normalization
│   │
│   └── tracker/
│       ├── repository.ts        # CRUD for application records
│       ├── analytics.ts         # Aggregated BI queries over application history
│       └── models.ts
│
├── db/
│   ├── database.ts              # better-sqlite3 instance factory, WAL mode setup
│   ├── migrations/              # Versioned migration scripts (plain SQL + metadata)
│   └── schema.sql               # Human-readable schema reference
│
├── templates/
│   └── resume/
│       ├── classic.tex.njk
│       └── modern.tex.njk
│
└── scripts/
    └── postInstall.ts           # Post-install: Playwright browser download for packaged app
```

---

## Module 1 — Profile Repository

**Purpose:** A structured store of the user's career facts that the resume engine and job matcher draw from.

**Single source of truth: SQLite.** The UI reads from and writes to it directly via IPC calls to the main process. Markdown is an export/import format only — users can export to `profile.md` for manual backup or editing, and re-import to sync back.

**SQLite is opened in WAL mode** at startup to support concurrent reads from the renderer-facing IPC handlers while the background scraper worker writes job postings simultaneously:

```typescript
// db/database.ts
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

const dbPath = path.join(app.getPath('userData'), 'jobhunt.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;
```

**Profile entry schema:**
```
ProfileEntry
  id          TEXT (UUID)
  type        TEXT  CHECK(type IN ('experience','credential','accomplishment','skill','education'))
  title       TEXT
  content     TEXT              -- word count enforced at IPC boundary per profile_entry_word_limit setting
  tags        TEXT  (JSON array)
  start_date  TEXT | NULL  (ISO date)
  end_date    TEXT | NULL
  created_at  TEXT  (ISO datetime)
```

User-level metadata is stored in a single-row `user_profile` table:
```
UserProfile
  id    INTEGER  PRIMARY KEY  (always 1)
  yoe   INTEGER | NULL        -- years of experience; used by the YOE hard filter in Module 4
```

`profile_entry_word_limit` is a configurable integer in the `settings` table (default: 200 words). Enforced at the IPC validation boundary before any DB write.

Zod is used for runtime validation at the IPC boundary — the renderer sends plain objects over IPC, the main process validates them before any DB write:

```typescript
// core/profile/models.ts
import { z } from 'zod';

export const ProfileEntrySchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['experience', 'credential', 'accomplishment', 'skill', 'education']),
  title: z.string().min(1),
  content: z.string(),
  tags: z.array(z.string()),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  created_at: z.string(),
});

export type ProfileEntry = z.infer<typeof ProfileEntrySchema>;
```

**UI (Profile.tsx):** Form-based editor for adding, editing, and tagging entries. Includes one-click export to markdown and an import/merge flow for re-ingesting an edited markdown file.

---

## Module 2 — Resume Engine

**Purpose:** Takes a job description and the full profile repository, uses Claude to select and tailor content, validates the response, renders LaTeX, compiles to PDF, and displays a preview.

### Pipeline Steps

**Step 1 — Prompt Construction (`agent.ts`)**

Profile entries are fetched from SQLite and serialized to a structured text block. The Claude prompt is assembled from:
- Serialized profile entries
- Raw job description text
- Target template schema (field names, constraints, max bullets per role)

Total profile size is bounded by `profile_entry_word_limit` across entries. If the combined payload still approaches the model's context limit, the job description is truncated to fit — profile content is never dropped, as it is the authoritative source material.

**Step 2 — Structured LLM Response**

Claude is instructed to return a strict JSON object only. No LaTeX is generated at this stage:

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

**Step 3 — Validation (`validator.ts`)**

Zod validates against a versioned schema. Constraints enforced:
- Required fields present and non-empty
- Bullet strings within configured character limit
- Date strings match expected format
- At least one experience entry

On validation failure, error messages are fed back into a retry call (max 2 retries). After retries are exhausted the posting is marked `parse_failed` in the UI with the option to retry manually.

**Step 4 — Nunjucks Rendering (`renderer.ts`)**

The validated object is passed to the selected `.tex.njk` template via Nunjucks. Template syntax is nearly identical to Jinja2 — `{% for %}`, `{% if %}`, `{{ var }}` all behave the same way. Output is a `.tex` file written to `<userData>/resumes/<application_id>/resume.tex`.

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

**Step 5 — xelatex Compilation (`compiler.ts`)**

`child_process.spawn` call to xelatex with `--no-shell-escape` explicitly enforced. stdout/stderr captured. On failure, the LaTeX error log is parsed for the most actionable line and surfaced to the renderer via IPC.

**Recompile from snapshot:** If the `.tex` file is missing (e.g. after reinstall), `compiler.ts` regenerates it from the JSON snapshot stored in the `applications` table before compiling. The stored artifact is the `.tex` file — the PDF is always reconstructable.

**Step 6 — PDF Preview (`previewer.ts`)**

Electron's Chromium renderer displays PDFs natively. The compiled PDF path is sent to the renderer process, which loads it in an `<iframe>` or `<webview>` with `src="file://..."`. No image conversion needed — the PDF renders at full fidelity without an intermediate rasterization step.

### Resume Schema Versioning

```
Application
  id              TEXT (UUID)
  posting_id      TEXT  FK → job_postings.id
  tex_path        TEXT             -- Relative path: resumes/<application_id>/resume.tex
  resume_json     TEXT (JSON)      -- Point-in-time snapshot for recompile-from-snapshot
  schema_version  INTEGER          -- Incremented when Zod schema changes
  applied_at      TEXT (ISO datetime)
  notes           TEXT | NULL
```

`Application` is a resume artifact record only. All status tracking lives on `job_postings`. The `applied_at` timestamp is used by the analytics module as the definitive application date.

When the schema is updated, a migration handles re-serializing or flagging old snapshots. Old resumes that cannot be re-parsed against the current schema are marked legacy-only (PDF still accessible via recompile, JSON not re-parseable).

---

## Module 3 — Job Aggregation Pipeline

**Purpose:** Accepts a global search intent, generates per-adapter search term lists, presents them for user confirmation, crawls enabled scraper mods, validates output against the `JobPosting` contract, filters in memory, and presents results for user commit.

### Search Term Generation (`searchTermGen.ts`)

Search configuration follows a deliberate multi-step flow before any crawl starts:

```
1. User enters global intent (free text, e.g. "senior backend engineer, fintech, remote")
2. Claude generates a list of search terms for each enabled adapter
3. Terms are written to the search_terms table, keyed by adapter mod id
4. UI presents the per-adapter term lists for review and editing
5. User confirms → crawl starts using the confirmed terms
```

Terms are stored in a dedicated `search_terms` table, replacing the opaque cached blob previously in `search_config`:

```
SearchTerm
  id          UUID
  adapter_id  str        # matches adapter mod manifest id
  term        str        # the search string as it will be submitted to that adapter
  enabled     bool       # user can disable individual terms without deleting
  source      Enum(llm_generated, user_added)
  created_at  datetime
```

All other search and filter configuration is stored in a single-row `search_config` table:
```
SearchConfig
  id                      INTEGER  PRIMARY KEY  (always 1)
  intent                  TEXT | NULL          -- global search intent free text
  term_generation_hash    TEXT | NULL          -- hash of (intent + config state) for staleness check
  ranking_weights         TEXT (JSON)          -- weight per signal, normalized to 1.0
  affinity_skip_threshold INTEGER              -- default: 15
  excluded_stack          TEXT (JSON array)    -- tech stack terms; hard-filtered in Stage 1
  required_keywords       TEXT (JSON array)    -- KeywordEntry list; posting must match ≥1
  excluded_keywords       TEXT (JSON array)    -- KeywordEntry list; matching postings dropped
  keyword_match_fields    TEXT (JSON array)    -- default: ["title", "tech_stack"]
```

The UI shows terms grouped by adapter (e.g. "LinkedIn — 8 terms", "Hacker News — 3 terms") with inline edit, add, and disable controls. The user can regenerate all terms from intent (replaces all `llm_generated` terms; preserves `user_added`) or regenerate for a specific adapter only.

Confirmed terms are versioned against a hash of `(intent + config state)` stored in `search_config`. If the intent or config changes before the next crawl, the user is prompted to regenerate or proceed with stale terms.

**Excluded keywords do not feed into search term generation.** Search terms are semantic intent-driven. Exclusion is handled downstream as a filtering concern. See Module 8.

### Adapter Interface (`base.ts`)

```typescript
// core/jobs/adapters/base.ts
export interface SearchFilters {
  location?: string;
  remote?: boolean;
}

export abstract class BaseAdapter {
  readonly delayMs: number = 3000;
  readonly availableSignals: Set<string> = new Set();

  abstract search(term: string, filters: SearchFilters): Promise<JobPosting[]>;
}
```

Each adapter returns fully normalized `JobPosting` objects directly. Field extraction, YOE parsing, tech stack detection, and seniority inference are all hardcoded per-adapter. Each mod is responsible for the quality of its own output; the core pipeline enforces only the interface contract via Zod validation at the aggregator boundary.

**`JobPosting` — the interface contract:**
```
JobPosting
  id                  UUID             # generated at ingest
  source              str              # adapter mod id
  url                 str              # raw URL as scraped
  resolved_domain     str | None       # domain after redirect resolution (see Module 7)
  title               str
  company             str
  location            str | "remote"
  yoe_min             int | None
  yoe_max             int | None
  seniority           Enum(intern, junior, mid, senior, staff, any)
  tech_stack          list[str]
  posted_at           date | None
  applicant_count     int | None
  raw_text            str              # full scraped text; nulled on soft-delete of unfavorited posts
  fetched_at          datetime
  scraper_mod_version str              # from adapter manifest, debug traceability only
  status              Enum(new, viewed, favorited, applied, interviewing, offer, rejected, ghosted)
  affinity_score      float | None
  affinity_skipped    bool
  affinity_scored_at  datetime | None
  first_response_at   datetime | NULL  -- set once on first status transition out of 'applied'
  last_seen_at        datetime
```

### Scraper Mod System

Scraper mods are self-contained plugins discovered at startup by scanning the `adapters/` directory. Each mod ships with a `manifest.json`:

```json
{
  "id": "linkedin",
  "display_name": "LinkedIn",
  "version": "1.2.0",
  "requires_auth": true,
  "available_signals": ["applicant_count", "recency"],
  "scrape_method": "playwright"
}
```

Postings produced by a mod are stored with the **app's current schema version**, not the mod's version. The mod version is recorded on the posting (`scraper_mod_version`) for debugging traceability but has no runtime effect on how the posting is processed. If a mod is replaced or updated, the app must be restarted to load the new adapter class.

### Parse Contract and Error Handling

At the aggregator boundary, each `JobPosting` returned by a mod is validated against the Zod schema. On failure:

- The posting is logged as `parse_failed` with the validation error and mod id
- Processing continues with the next posting
- If a single mod produces **5 or more consecutive `parse_failed`** results, that mod's crawl is aborted with an error surfaced in the commit summary (the threshold is configurable in settings)
- Other enabled mods continue unaffected
- `parse_failed` postings are never written to SQLite, even on commit

The consecutive-error threshold catches broken mods (e.g. site redesign broke the scraper's DOM selectors) without silently discarding individual bad postings that may just be edge cases.

### Source Adapters

**LinkedIn (`linkedin.ts`) and Indeed (`indeed.ts`):**
Playwright (Node.js). Sessionless first — no stored auth attempted. If an auth wall or captcha is detected mid-crawl, the crawl is blocked and the main process opens a dedicated `BrowserWindow` for the user to authenticate. On success, the browser context is saved to `<userData>/browser_contexts/<adapter>/` and reused on subsequent runs.

**Hacker News (`hackernews.ts`):** node-fetch call to the public Algolia HN API. No auth, no scraping.

**RSS/Generic (`rss.ts`):** rss-parser for RemoteOK, Wellfound, and any board with RSS or JSON feeds.

**ToS:** Automated scraping of LinkedIn and Indeed violates their terms of service. This app is a personal, non-commercial tool. The user is informed of this before initiating their first crawl and accepts responsibility.

### Rate Limiting

Per-domain configurable delay (default 2–4 seconds between page fetches). Runs on the background scraper thread. Configurable in settings.

### Deduplication

Two-pass on ingest into the in-memory staging buffer:
1. **URL hash** — exact URL match against existing DB rows and other staged postings
2. **Composite hash** of `(company + normalized_title + posted_at)` — catches same posting re-listed under a different URL

### Pre-Commit Filtering and Staging

Scraped postings are accumulated in memory in `aggregator.ts`. **No DB writes occur during scraping.** When the scrape completes (or the user interrupts), ban list and keyword filters are applied to the staged results in memory. The state machine then transitions to `PENDING_COMMIT`. See Module 5 for state machine details.

This is the **authoritative filter pass for new postings**. The ranker post-commit re-applies filters dynamically from live config so that subsequent config changes (e.g. adding a new domain ban after commit) take effect on already-stored postings — but the pre-commit pass determines what enters the DB in the first place.

### Retention Policy

Non-favorited postings are soft-deleted after N days (configurable in settings, default 14). At soft-delete time, `raw_text` is nulled on the row rather than deleting it — the rest of the posting metadata is retained for analytics queries. Favorited postings are exempt from auto-expiry; their `raw_text` is retained indefinitely until the posting is manually removed.

---

## Module 4 — Matching & Ranking

**Purpose:** Filters and ranks stored job postings against the user's search profile. The ranker runs each time the job board view is loaded or manually refreshed.

### Posting Status Lifecycle

```
new → viewed → favorited → applied ──► interviewing ──► offer
                                  ↘               ↘
                               ghosted          rejected
                               rejected
```

`ghosted` and `rejected` are reachable from both `applied` (no response after applying) and `interviewing` (dropped mid-process). `offer` is only reachable from `interviewing`. All three terminal states (`offer`, `rejected`, `ghosted`) are considered closed. Status is updated manually from the tracker view via inline dropdown.

### Stage 1 — Hard Filtering (local, free)

Applied before any LLM call:
- Drop postings where `yoe_min > user.yoe` or `yoe_max < user.yoe` (when fields present; `user.yoe` from `user_profile.yoe`)
- Drop postings containing any `excluded_stack` item (from `search_config.excluded_stack`)

Location filtering is handled upstream by search term generation, not here.

### Stage 2 — Batched LLM Affinity Scoring (`scorer.ts`)

Filtered candidates are batched by token budget rather than fixed count. Postings are accumulated into a batch until the estimated input token count reaches a configurable cap (default: 80,000 tokens — well within Claude's effective attention range for scoring tasks); then the batch is sent and a new one started. Token estimation uses a character-count approximation over each posting's `raw_text` plus fixed prompt overhead. Calls are **intentionally sequential** — no async concurrency — to avoid Claude API rate limit complexity. Claude returns a parallel JSON array:

```json
[
  {
    "posting_id": "uuid",
    "affinity_score": 0.87,
    "reasoning": "Strong React and Node.js overlap, seniority matches, remote-friendly"
  }
]
```

Each response item is Zod-validated. Items failing validation receive a neutral fallback score of 0.5 with a visual flag in the UI indicating the score is unverified.

Affinity scores are cached in `job_postings` with `affinity_scored_at`. Unchanged postings reuse the cached score on subsequent refreshes.

### Stage 3 — Composite Score Assembly

```
final_score = Σ (weight_<signal> × signal_score) / Σ active_weights
```

Each adapter declares `available_signals: set[str]`. Only signals present for a given posting contribute to the denominator — missing signals do not drag the score down via neutral fallbacks. `applicant_count` is an optional signal available only on adapters that surface it.

Universal signals: `affinity` (LLM), `recency` (days since posting).
Adapter-specific optional signals: `applicant_count`, others declared per adapter.

Weights are user-configurable sliders in `SearchConfig.tsx`, normalized to sum to 1.0 automatically.

### Job Board View (`JobBoard.tsx`)

Displays ranked postings sorted by `final_score` descending. Page-number-based pagination (previous / next + page number display) with a configurable page size (default: 50). Score badges, affinity reasoning, and status controls are available inline per row.

---

## Module 5 — Concurrency Model

**better-sqlite3 is synchronous by design.** All DB calls are blocking but fast. The concurrency split is between the Electron main process (all DB and core logic) and a Node.js `worker_threads` Worker (scraping). The renderer process never touches SQLite directly — it communicates via IPC with the main process.

```
Renderer (React)  ──IPC──►  Main process  ──direct──►  SQLite (WAL)
                                  │
                             Worker thread
                             (scraper mods)
                                  │
                        postMessage → main
                        (staged results)
```

WAL mode allows the main process to read SQLite freely while the worker is building its in-memory staging buffer. The only write contention point is the bulk insert at commit time, which is a single synchronous transaction on the main process — safe because better-sqlite3 is used exclusively from the main process.

The worker communicates progress and staged results back to the main process via `worker.postMessage`. The main process owns all state transitions and fires `webContents.send` to push UI updates to the renderer.

### State Machine

```
IDLE (UI = read-write)
  │
  ▼ user confirms search terms → Worker spawned
SCRAPING (UI = read-only, no DB writes — results held in Worker memory)
  │                        │
  ▼ all mods complete      ▼ user interrupts
  │                    STOPPING
  │                    (current posting finishes, remainder discarded)
  │                        │
  ▼─────────────────────────▼
PRE_COMMIT_FILTER
  (ban list + keyword filters applied to staged in-memory results, main process)
  │
  ▼
PENDING_COMMIT
  (UI shows commit summary dialog)
  ├─ user confirms → bulk insert (synchronous transaction) → Worker terminated → IDLE
  └─ user discards → staged results dropped → Worker terminated → IDLE
```

**Worker crash:** If the worker exits unexpectedly during `SCRAPING`, the main process detects it, forwards any partial staged results through `PRE_COMMIT_FILTER`, and transitions to `PENDING_COMMIT` with an error note in the commit summary. The state machine proceeds normally from that point.

**`PRE_COMMIT_FILTER`** is a brief synchronous pass on the main process that applies ban list and keyword filters to the staged postings before computing the commit summary. This is the authoritative filter pass for new postings.

```
Scrape complete
─────────────────────────────────────────────
  Postings fetched:                      142
  Deduplicated (skipped):                 18
  Parse errors:                            3  (mod: linkedin ×3)
  Ban-excluded:                            6
  Keyword-filtered:                       23
  Net new offered for commit:             92
  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
  Mod aborts:                              0
─────────────────────────────────────────────
  [Commit 92 postings]   [Discard]
```

The ranker re-applies keyword filters on every job board load, so config changes take retroactive effect on already-stored postings without a re-scrape. Interrupt (STOPPING) also flows through `PRE_COMMIT_FILTER` — partial results are still offered for commit.

---

## Module 6 — Application Workflow

1. User selects a posting from the ranked job board view
2. Hits **Tailor Resume** — triggers the full resume engine pipeline for that JD (via IPC to main process)
3. PDF renders in-app via Electron's native Chromium PDF renderer
4. User reviews, optionally requests re-tailor, hits **Apply**
5. App opens the posting URL in the default browser via `shell.openExternal`
6. `job_postings.status` updated to `applied`; an `Application` artifact record (tex path, JSON snapshot) is written to SQLite

Auto-filling application forms via Playwright is explicitly deferred to a future version.

### Tracker View (`Tracker.tsx`)

Sortable, filterable table view. Columns: company, role, date applied, status, source, link to posting. Status updated manually via inline dropdown directly on `job_postings.status`. Statuses available from `applied` onward: `interviewing`, `offer`, `rejected`, `ghosted`. Page-number-based pagination with a configurable page size (default: 50).

---

## Settings Module (`Settings.tsx` + `electron/settings.ts`)

**API key:** Stored in OS keychain via `keytar` (Windows Credential Manager, macOS Keychain, Linux Secret Service). Never written to disk as plaintext, never stored in SQLite. Accessed exclusively from the main process; the renderer requests it via IPC.

```typescript
// electron/settings.ts
import keytar from 'keytar';

const SERVICE = 'jobhunt';

export const saveApiKey = (key: string) =>
  keytar.setPassword(SERVICE, 'anthropic_api_key', key);

export const getApiKey = () =>
  keytar.getPassword(SERVICE, 'anthropic_api_key');
```

**Other settings:** Stored in a single-row `settings` table in SQLite — non-sensitive, no keychain needed:
```
Settings
  id                           INTEGER  PRIMARY KEY  (always 1)
  tex_binary_path              TEXT | NULL          -- path to xelatex executable
  pdf_export_path              TEXT | NULL          -- default save location for exported PDFs
  crawl_delay_ms               INTEGER              -- default: 3000
  posting_retention_days       INTEGER              -- default: 14
  profile_entry_word_limit     INTEGER              -- default: 200
  log_retention_days           INTEGER              -- default: 30
  parse_error_abort_threshold  INTEGER              -- consecutive parse failures before mod abort; default: 5
  affinity_token_budget        INTEGER              -- max input tokens per affinity scoring batch; default: 80000
  log_level                    TEXT                 -- 'error'|'warn'|'info'|'debug'; default: 'info'
```

**One-click backup:** Exports the SQLite file + browser contexts + resume files as a single archive to a user-chosen location (via `dialog.showSaveDialog`).

---

## Startup Validation

On every launch the main process runs two tiers of checks before showing the main window:

**Hard blockers** (window does not open):
- `<userData>/` directory inaccessible or not writable
- SQLite DB cannot be opened

**Feature locks** (window opens; affected features show a locked banner with a remediation action):
- Claude API key absent from keychain → Claude-dependent features locked (search term generation, affinity scoring, resume tailoring)
- Claude API unreachable → same Claude-dependent features locked; all local features remain accessible
- xelatex not found at configured path → resume compilation locked
- Playwright Chromium binary absent → Playwright-based scrapers locked
- No profile entries in SQLite → resume tailoring locked

Claude connectivity is checked once at startup. If locked due to connectivity, the user restarts to re-check. No cryptic mid-flow failures.

---

## Logging

Log files are written to `<userData>/logs/` by the main process. The worker thread forwards errors to the main process for logging — it does not write log files directly.

**Log files:** One file per day (`jobhunt-YYYY-MM-DD.log`), retained for 30 days (configurable in the `settings` table).

**Log levels:** `error`, `warn`, `info`, `debug`. Default: `info` in production, `debug` in development.

**What is logged:**
- Startup validation results (all checks, pass or fail)
- IPC handler errors
- Scrape errors: parse failures (with mod id and validation message), mod aborts, redirect resolution timeouts
- LLM call failures and retry attempts
- xelatex compilation errors (actionable line extracted from stderr)
- DB migration outcomes

---

## Electron Security

`BrowserWindow` is configured with `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`. All Node.js access from the renderer goes through the context bridge in `preload.ts`.

`shell.openExternal` validates that the target URL scheme is `https://` before invoking, preventing scraped URLs from triggering `file://` or `javascript:` navigation in the default browser.

The PDF preview `<iframe>` uses `sandbox="allow-same-origin"` with a `file://` src. No scripts execute during PDF display.

A Content Security Policy restricts renderer content to `'self'` and `file:`.

---

## Packaging

**electron-builder** handles all target platforms from a single `electron-builder.yml` config:

- **macOS:** `.dmg` with code signing + notarization via Apple Developer ID
- **Windows:** NSIS installer (`.exe`) with optional code signing
- **Linux:** `.AppImage` (universal) and `.deb`

**Auto-update** is handled by `electron-updater`. The app checks for updates on launch, downloads in the background, and prompts the user to restart on completion. Update feed is a static JSON manifest hosted wherever releases are published (GitHub Releases works out of the box).

**Playwright browsers** are downloaded to `<userData>/ms-playwright/` at first launch, not bundled in the installer (they're ~150MB). `scripts/postInstall.ts` runs via Electron's `app.on('ready')` on first launch if the directory is absent, calls `playwright.chromium.launch()` which triggers the download automatically.

**App data directory:** `app.getPath('userData')` resolves to the platform-appropriate location (`~/Library/Application Support/jobhunt` on macOS, `%APPDATA%/jobhunt` on Windows, `~/.config/jobhunt` on Linux). All persistent data lives here — SQLite DB, browser contexts, resume files.

Validated as part of the build process.

**Note:** Bundling Chromium adds ~150–200MB to the distributable. macOS notarization requires an Apple Developer ID certificate — electron-builder handles the `codesign` and `notarytool` calls automatically when credentials are configured in the build environment.

---

## External Dependencies (User-Installed)

- **TeX distribution** — MiKTeX (Windows), MacTeX (macOS), texlive (Linux)
- **Playwright browsers** — handled automatically by post-build script; on dev machines `playwright install chromium`

---

## Local Storage

Single SQLite file at `<userData>/jobhunt.db` (resolves to `~/Library/Application Support/jobhunt` on macOS, `%APPDATA%/jobhunt` on Windows, `~/.config/jobhunt` on Linux). Tables:

- `profile_entries` — single source of truth for all career data
- `settings` — all non-sensitive app settings (TeX binary path, crawl delay, retention policy, etc.); API key remains in OS keychain only
- `search_config` — global intent text, ranking weights, affinity skip threshold, term generation input hash
- `search_terms` — per-adapter search term list (llm_generated or user_added, with enabled flag)
- `ban_list` — blocked companies and resolved domains
- `job_postings` — normalized postings with full status lifecycle, scraper_mod_version, affinity score + skipped flag, score timestamps, `first_response_at`, `last_seen_at`; `raw_text` nulled on soft-delete of unfavorited posts
- `applications` — resume artifact records only (tex path, JSON snapshot, schema version, applied_at); status lives on `job_postings`
- `llm_usage` — per-call log of token counts and estimated cost, keyed by call type

Resume `.tex` files stored at `<userData>/resumes/<application_id>/resume.tex`.
Browser contexts stored at `<userData>/browser_contexts/<adapter>/`.

---

## Module 7 — Ban List

**Purpose:** Permanently suppress postings from companies or destination domains that are known to be unreliable, unresponsive, or otherwise undesirable. Applied before any other filtering or LLM call.

### The Domain Ban Problem

Job boards like LinkedIn and Indeed frequently aggregate postings from third-party boards (Lever, Greenhouse, Workable, random obscure aggregators). The posting's `url` field as scraped may be a redirect — the actual destination domain is only known after following the redirect chain. A domain ban must operate on the **resolved destination domain**, not the raw scraped URL.

**Redirect resolution:** At ingest time, each scraper mod performs a lightweight HTTP HEAD request (with a short timeout, no JS execution) to resolve the final URL and stores the extracted domain in `resolved_domain` on the `JobPosting`. If resolution fails or times out, `resolved_domain` falls back to the domain parsed from the raw `url`. This adds a small per-posting cost at scrape time but is far cheaper than a full page fetch.

### Schema

```
BanListEntry
  id          UUID
  type        Enum(company | domain)
  value       str          # company: case-insensitive regex matched against JobPosting.company
                           # domain: normalized lowercase; exact match against JobPosting.resolved_domain
  reason      str | None   # Optional user note
  created_at  datetime
```

`domain` entries match `resolved_domain` exactly (e.g. `"jobs.lever.co"`, `"recruit.net"`). `company` entries are matched against `JobPosting.company` as a case-insensitive regex (e.g. `"acme"` matches both `"Acme Corp"` and `"Acme Corporation"`).

### Filtering Integration

Ban list filtering is enforced at two points:

- **Pre-commit:** Applied during `PRE_COMMIT_FILTER` — matching staged postings are dropped and never written to the DB.
- **On ban entry creation:** When the user adds a new ban entry, all matching postings already in the DB are immediately hard-deleted. There is no soft-exclusion or retention.

Unbanning removes the ban entry only. Hard-deleted postings do not restore; they will reappear on the next crawl if the ban entry is no longer present.

### UI (`SearchConfig.tsx`)

A dedicated **Ban List** tab within `SearchConfig.tsx`. Displays two sorted lists (Companies, Domains) with inline add/remove controls. Adding a company pattern triggers a live regex preview of currently-stored postings that would be matched — the user must confirm before the entry is saved and matching postings are hard-deleted. Adding a domain shows a count of postings with that resolved domain before confirming.

---

## Module 8 — Keyword Filtering

**Purpose:** Filter postings containing undesirable or wholly unfamiliar content, and surface postings containing desired signals. Runs as a pre-commit in-memory pass on staged postings, and again post-commit in the ranker when live config changes.

Keyword filtering is a **filtering concern only** and does not influence search term generation. Search terms are driven by global intent via `searchTermGen.ts`.

### Relationship to `excluded_stack`

`excluded_stack` (defined in `search_config`) operates narrowly on the normalized `tech_stack[]` array. Keyword filters operate on a broader configurable field set and support both exclusion and requirement. Both are retained as complementary mechanisms — `excluded_stack` for precise stack-level blocks, keyword filters for everything else.

### Configuration (stored in `search_config`)

```
required_keywords    list[KeywordEntry]  # Posting must match ≥1 (OR logic)
excluded_keywords    list[KeywordEntry]  # Posting is dropped if any match
keyword_match_fields list[str]           # Configurable: ["title", "tech_stack", "raw_text"]
                                         #   default: ["title", "tech_stack"]
```

```
KeywordEntry
  value   str
```

### Matching Logic

Keywords are matched case-insensitively. Partial matches are intentional (e.g. `"cobol"` matches `"COBOL"`). Each keyword can optionally be prefixed with `"re:"` to be interpreted as a regex pattern for power users.

### Filtering Integration

Runs in two places:
1. **Pre-commit** — applied to in-memory staged postings during `PRE_COMMIT_FILTER` state. Filtered counts appear in the commit summary.
2. **Post-commit (ranker)** — re-applied dynamically from live config so that adding/removing keywords after a commit takes effect on already-stored postings without requiring a re-scrape.

Order within Stage 1 of the ranker:
```
1a. Keyword filter (required / excluded)
1b. YOE filter
1c. excluded_stack filter
```

### UI (`SearchConfig.tsx`)

Tag-input fields for required and excluded keywords, with a toggle to enable `raw_text` matching. A live count of postings currently in the DB that would survive each filter pass is shown to give immediate feedback.

---

## Module 9 — Affinity Score Skip Threshold

**Purpose:** Avoid unnecessary LLM API calls when the filtered candidate pool is already small enough that manual review is practical.

### Configuration (stored in `search_config`)

```
affinity_skip_threshold   INTEGER   -- default: 15
```

### Logic in `scorer.ts`

Before initiating any batch LLM call, `scorer.ts` checks the post-filter candidate count:

```typescript
// core/jobs/scorer.ts
if (candidates.length <= settings.affinitySkipThreshold) {
  for (const posting of candidates) {
    posting.affinityScore = null;
    posting.affinitySkipped = true;
    posting.affinityScored_at = null;
  }
  return;
}
```

Skipped postings participate in composite score assembly without an affinity component — the denominator excludes the affinity weight, consistent with how other missing signals are handled. The job board view renders a `"Not scored (small batch)"` badge on these postings, visually distinct from the `"Score unverified"` badge used for Zod validation fallbacks.

The threshold is user-configurable in `SearchConfig.tsx` with a note explaining the tradeoff. Setting it to `0` effectively disables the skip behavior.

---

## Module 10 — Analytics Dashboard

**Purpose:** Surface BI metrics derived from the application tracker and LLM usage log so the user can identify what sources, roles, and strategies are working, and monitor API spend.

### Data Sources

- Application metrics: derived from `job_postings` (status, source, seniority, tech_stack, applied_at, status change timestamps)
- LLM cost metrics: derived from `llm_usage` table (new — see below)

No new writes are required for application metrics — `analytics.ts` is a pure query layer over existing data.

### LLM Usage Tracking

A new `llm_usage` table records every Claude API call made by the app:

```
LLMUsage
  id              TEXT (UUID)
  call_type       TEXT  CHECK(call_type IN ('search_term_gen','affinity_scoring','resume_tailoring'))
  model           TEXT              -- e.g. "claude-sonnet-4-20250514"
  input_tokens    INTEGER
  output_tokens   INTEGER
  estimated_cost  REAL              -- USD, computed at write time from known token prices
  called_at       TEXT (ISO datetime)
  posting_id      TEXT | NULL       -- FK → job_postings.id; set for affinity_scoring and resume_tailoring
```

Each call site (`searchTermGen.ts`, `scorer.ts`, `agent.ts`) writes a record after a successful API response using token counts from the response object. `estimated_cost` is computed from a hardcoded price table keyed on model name, updated via settings if prices change. Costs are estimates — the user is reminded of this in the UI.

### Application Metrics

**Funnel**
- Total applications by status (`applied`, `interviewing`, `offer`, `rejected`, `ghosted`)
- Response rate: `(interviewing + offer + rejected) / applied` (ghosted excluded — no response received)
- Conversion rate: `offer / applied`

**By Source**
- Application count per source adapter
- Response rate per source
- Average days from `applied_at` to `first_response_at`

**By Role / Keywords**
- Application count grouped by normalized seniority level
- Response rate by seniority
- Tech stack terms most correlated with `interviewing` or `offer` outcomes vs. `rejected` or `ghosted` (gated at ≥3 data points to suppress noise)

**Over Time**
- Weekly application volume
- Rolling 4-week response rate trend

### LLM Cost Metrics

- Total estimated spend: all-time and current month
- Spend by call type (search_term_gen, affinity_scoring, resume_tailoring)
- Per-session cost for the most recent scrape
- Cost-per-application (total LLM spend / total applications submitted)

### Implementation

```typescript
// core/tracker/analytics.ts
export function getFunnelSummary(db: Database): FunnelSummary { ... }
export function getBySource(db: Database): SourceMetric[] { ... }
export function getBySeniority(db: Database): SeniorityMetric[] { ... }
export function getTimeSeries(db: Database, weeks = 12): WeeklyMetric[] { ... }
export function getLLMCostSummary(db: Database): LLMCostSummary { ... }
export function getLLMCostByType(db: Database): LLMCostByType[] { ... }
```

All return typed objects (Zod-inferred interfaces). No raw untyped objects passed to the renderer — data is serialized cleanly over IPC.

### UI (`Analytics.tsx`)

A dedicated Analytics tab with two sections:

**Applications section:**
- Top row: stat cards (Applications, Response Rate, Interviews, Offers)
- Source breakdown: sortable table with per-source counts and response rates
- Time series: sparkline chart of weekly application volume + 4-week rolling response rate
- Stack signal table: tech terms ranked by conditional response rate (gated at ≥3 data points)

**LLM Cost section:**
- Total spend card (all-time + current month)
- Spend breakdown by call type (bar chart or table)
- Cost-per-application metric

Charts implemented with Recharts (ships with React, no additional native dependency). The view is read-only.

---

## Module 11 — Data Export / Import

**Purpose:** Portable export and import of user data for cross-machine migration and manual editing. Distinct from the one-click backup, which copies the raw SQLite binary.

### Export

Accessible from `Settings.tsx`. The user selects which categories to include:

- **Profile entries** — all `profile_entries` rows
- **Search configuration** — intent, weights, keyword filters, `excluded_stack`, affinity skip threshold
- **Search terms** — confirmed per-adapter term lists (llm_generated and user_added)
- **Ban list** — company and domain entries

Output is a single structured JSON file written to a user-chosen path via `dialog.showSaveDialog`.

### Import

Reads a previously exported JSON file via `dialog.showOpenDialog`. Two merge modes:

- **Merge** — adds entries not already present (matched by id for profile entries; by value for ban list and search terms). Existing records are not overwritten.
- **Replace** — clears the selected categories and inserts all entries from the file.

The user selects categories and confirms the merge mode before proceeding. The entire import runs in a single SQLite transaction and is rolled back on any error.

---

```
SQLite (profile_entries)
    └──► Resume Engine (main process)
              └──► Claude API ──► Zod validation ──► Nunjucks
                       │                                  │
                   llm_usage                          xelatex (child_process)
                                                          │
                                                     .tex + PDF
                                                          │
                                          IPC → Renderer (React)
                                          PDF displayed via Chromium native renderer
                                          User hits Apply
                                          └──► shell.openExternal(url)
                                          └──► job_postings.status = applied

User enters global intent (Renderer)
    └──► IPC ──► main process ──► Claude API ──► per-adapter SearchTerm lists
                                       │                  │
                                   llm_usage       search_terms table
                                                          │
                                          IPC → Renderer: user reviews + edits
                                          User confirms → crawl starts

Worker thread (scraper mods, rate-limited)
    └──► JobPostings (fully normalized per-mod) ──► Zod contract check
                                                         │
                                               parse_failed? → log + skip
                                               5 consecutive? → abort mod
                                                         │
                                             dedup (URL hash + composite hash)
                                                         │
                                         In-memory staging buffer (Worker)
                                         postMessage → main process
                                                         │
                                         PRE_COMMIT_FILTER (main process, synchronous)
                                           1a. Ban list
                                           1b. Keyword filter
                                                         │
                                         PENDING_COMMIT: IPC → Renderer shows summary
                                         [Commit] → better-sqlite3 bulk insert
                                         [Discard] → staged results dropped
                                                         │
                                    Ranker (main process, runs on every job board load)
                                         Stage 1: Hard Filter
                                           1a. Keyword filter
                                           1b. YOE filter
                                           1c. excluded_stack filter
                                                         │
                                    Stage 2: Conditional LLM Affinity Scoring
                                         Skip if candidates ≤ affinitySkipThreshold
                                         (25/batch, cached per posting)
                                                    │
                                                llm_usage
                                                         │
                                    Stage 3: Composite Score Assembly
                                         (adapter-declared signals only;
                                          affinity weight excluded if skipped)
                                                         │
                                    IPC → Renderer: Job Board view (React)
                                         (score + reasoning + badges)
```
