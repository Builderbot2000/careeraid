# Job Hunting App — Full Architecture (v6)

## Overview

A local-first desktop application for managing a personal career profile, generating tailored LaTeX resumes, aggregating and ranking job postings, and tracking applications. Everything runs on the user's machine with no hosted backend. The only external calls are to the Anthropic Claude API and job board sources during scraping.

---

## Tech Stack

| Concern | Library |
|---|---|
| Native UI | Flet |
| Browser scraping | Playwright |
| Light scraping | httpx + BeautifulSoup |
| LLM calls | Anthropic Python SDK |
| Structured LLM output validation | Pydantic |
| Relational storage | SQLite + SQLAlchemy (WAL mode) |
| Resume templating | Jinja2 + xelatex |
| PDF preview | pdf2image + Flet Image control |
| Credential storage | keyring |
| Packaging | PyInstaller + post-build Playwright browser script |

---

## Repository Structure

```
/
├── app/
│   ├── main.py                  # Flet app entry point + startup validation
│   ├── views/
│   │   ├── profile.py           # Profile editor
│   │   ├── search_config.py     # Job search criteria + ranking weights + ban list + keyword filters
│   │   ├── job_board.py         # Aggregated postings view + favorites
│   │   ├── resume_preview.py    # Resume tailoring + PDF preview
│   │   ├── tracker.py           # Application history (sortable table)
│   │   ├── analytics.py         # BI metrics dashboard
│   │   └── settings.py          # API key + preferences + backup
│   └── components/              # Reusable Flet UI components
│
├── core/
│   ├── profile/
│   │   ├── repository.py        # CRUD — SQLite is the single source of truth
│   │   └── models.py            # SQLAlchemy + Pydantic models
│   │
│   ├── resume/
│   │   ├── agent.py             # Claude API call + prompt construction
│   │   ├── validator.py         # Pydantic schema for structured LLM response
│   │   ├── renderer.py          # Jinja2 → .tex file
│   │   ├── compiler.py          # subprocess xelatex + error handling + recompile-from-snapshot
│   │   └── previewer.py         # pdf2image → Flet-displayable image pages
│   │
│   ├── jobs/
│   │   ├── aggregator.py        # Orchestrates scraper mods, owns scrape state machine + in-memory staging + pre-commit filtering
│   │   ├── search_term_gen.py   # Claude-generated per-adapter search term lists from global user intent
│   │   ├── scorer.py            # Sequential LLM affinity scoring + cache logic + skip threshold
│   │   ├── ranker.py            # Post-commit filtering (ban list, keywords, YOE) + composite score assembly
│   │   └── adapters/
│   │       ├── base.py          # Abstract adapter interface + available_signals declaration
│   │       ├── linkedin.py      # Playwright-based scraper + hardcoded normalization
│   │       ├── indeed.py        # Playwright-based scraper + hardcoded normalization
│   │       ├── hackernews.py    # httpx + Algolia API + hardcoded normalization
│   │       └── rss.py           # Generic RSS/JSON feed adapter + hardcoded normalization
│   │
│   └── tracker/
│       ├── repository.py        # CRUD for application records
│       ├── analytics.py         # Aggregated BI queries over application history
│       └── models.py
│
├── db/
│   ├── database.py              # SQLAlchemy engines (WAL mode), session factory
│   ├── connection_manager.py    # Read/write engine swap + scrape state + UI event bus
│   ├── migrations/              # Alembic migration scripts
│   └── schema.sql               # Human-readable schema reference
│
├── templates/
│   └── resume/
│       ├── classic.tex.j2
│       └── modern.tex.j2
│
└── scripts/
    └── post_build_playwright.py # Post-PyInstaller script to bundle Playwright browsers
```

---

## Module 1 — Profile Repository

**Purpose:** A structured store of the user's career facts that the resume engine and job matcher draw from.

**Single source of truth: SQLite.** The UI reads from and writes to it directly. Markdown is an export/import format only — users can export to `profile.md` for manual backup or editing, and re-import to sync back.

**SQLite is opened in WAL mode** at engine initialization to support concurrent reads from the UI thread while the background scraper writes job postings simultaneously:

```python
# database.py
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, scoped_session
from pathlib import Path

db_path = Path.home() / ".jobhunt" / "jobhunt.db"
engine = create_engine(
    f"sqlite:///{db_path}",
    connect_args={"check_same_thread": False}
)

@event.listens_for(engine, "connect")
def set_wal_mode(dbapi_conn, _):
    dbapi_conn.execute("PRAGMA journal_mode=WAL")

SessionFactory = sessionmaker(bind=engine)
Session = scoped_session(SessionFactory)
```

**Profile entry schema:**
```
ProfileEntry
  id          UUID
  type        Enum(experience, credential, accomplishment, skill, education)
  title       str
  content     str
  tags        list[str]
  start_date  date | None
  end_date    date | None
  created_at  datetime
```

**UI (profile.py):** Form-based editor for adding, editing, and tagging entries. Includes one-click export to markdown and an import/merge flow for re-ingesting an edited markdown file.

---

## Module 2 — Resume Engine

**Purpose:** Takes a job description and the full profile repository, uses Claude to select and tailor content, validates the response, renders LaTeX, compiles to PDF, and displays a preview.

### Pipeline Steps

**Step 1 — Prompt Construction (`agent.py`)**

Profile entries are fetched from SQLite and serialized to a structured text block. The Claude prompt is assembled from:
- Serialized profile entries
- Raw job description text
- Target template schema (field names, constraints, max bullets per role)

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

**Step 3 — Validation (`validator.py`)**

Pydantic validates against a versioned schema. Constraints enforced:
- Required fields present and non-empty
- Bullet strings within configured character limit
- Date strings match expected format
- At least one experience entry

On validation failure, error messages are fed back into a retry call (max 2 retries). After retries are exhausted the posting is marked `parse_failed` in the UI with the option to retry manually.

**Step 4 — Jinja2 Rendering (`renderer.py`)**

The validated Pydantic model is passed to the selected `.tex.j2` template. Templates contain no logic beyond iteration and conditionals. Output is a `.tex` file written to `~/.jobhunt/resumes/<application_id>/resume.tex`.

**Step 5 — xelatex Compilation (`compiler.py`)**

Subprocess call to xelatex. stdout/stderr captured. On failure, the LaTeX error log is parsed for the most actionable line and displayed to the user.

**Recompile from snapshot:** If the `.tex` file is missing (e.g. after reinstall), `compiler.py` can regenerate it from the JSON snapshot stored in the `applications` table before compiling. The stored artifact is the `.tex` file — the PDF is always reconstructable.

**Step 6 — PDF Preview (`previewer.py`)**

`pdf2image` converts compiled PDF pages to images. Displayed in-app via Flet's `Image` control in a scrollable column.

### Resume Schema Versioning

```
Application
  id              UUID
  posting_id      FK → JobPosting
  tex_path        str             # Relative path: resumes/<application_id>/resume.tex
  resume_json     JSON            # Point-in-time snapshot for recompile-from-snapshot
  schema_version  int             # Incremented when Pydantic schema changes
  applied_at      datetime
  notes           str | None
```

`Application` is a resume artifact record only. All status tracking (applied, interviewing, offer, rejected, ghosted) lives on `JobPosting`. The `applied_at` timestamp here is used by the analytics module as the definitive application date.

When the schema is updated, an Alembic migration handles re-serializing or flagging old snapshots. Old resumes that cannot be re-parsed are marked legacy-only (PDF still accessible via recompile, JSON not re-parseable against current schema).

---

## Module 3 — Job Aggregation Pipeline

**Purpose:** Accepts a global search intent, generates per-adapter search term lists, presents them for user confirmation, crawls enabled scraper mods, validates output against the `JobPosting` contract, filters in memory, and presents results for user commit.

### Search Term Generation (`search_term_gen.py`)

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

The UI shows terms grouped by adapter (e.g. "LinkedIn — 8 terms", "Hacker News — 3 terms") with inline edit, add, and disable controls. The user can regenerate all terms from intent (replaces all `llm_generated` terms; preserves `user_added`) or regenerate for a specific adapter only.

Confirmed terms are versioned against a hash of `(intent + config state)` stored in `search_config`. If the intent or config changes before the next crawl, the user is prompted to regenerate or proceed with stale terms.

**Excluded keywords do not feed into search term generation.** Search terms are semantic intent-driven. Exclusion is handled downstream as a filtering concern. See Module 8.

### Adapter Interface (`base.py`)

```python
class BaseAdapter:
    delay_seconds: float = 3.0
    available_signals: set[str] = set()

    def search(self, query: str, filters: SearchFilters) -> list[JobPosting]:
        ...
```

Each adapter returns fully normalized `JobPosting` objects directly. Field extraction, YOE parsing, tech stack detection, and seniority inference are all hardcoded per-adapter. Each mod is responsible for the quality of its own output; the core pipeline enforces only the interface contract via Pydantic validation at the aggregator boundary.

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
  ban_excluded        bool
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

At the aggregator boundary, each `JobPosting` returned by a mod is validated against the Pydantic schema. On failure:

- The posting is logged as `parse_failed` with the validation error and mod id
- Processing continues with the next posting
- If a single mod produces **5 or more consecutive `parse_failed`** results, that mod's crawl is aborted with an error surfaced in the commit summary (the threshold is configurable in settings)
- Other enabled mods continue unaffected
- `parse_failed` postings are never written to SQLite, even on commit

The consecutive-error threshold catches broken mods (e.g. site redesign broke the scraper's DOM selectors) without silently discarding individual bad postings that may just be edge cases.

### Source Adapters

**LinkedIn (`linkedin.py`) and Indeed (`indeed.py`):**
Playwright-based. Sessionless first — no stored auth attempted. If an auth wall or captcha is detected mid-crawl, the crawl is blocked and a popup browser window opens for the user to authenticate. On successful auth, a persistent browser context is saved to `~/.jobhunt/browser_contexts/<adapter>/` and reused on subsequent runs.

**Hacker News (`hackernews.py`):** httpx call to the public Algolia HN API. No auth, no scraping.

**RSS/Generic (`rss.py`):** httpx + feedparser for RemoteOK, Wellfound, and any board with RSS or JSON feeds.

**ToS:** Automated scraping of LinkedIn and Indeed violates their terms of service. This app is a personal, non-commercial tool. The user is informed of this before initiating their first crawl and accepts responsibility.

### Rate Limiting

Per-domain configurable delay (default 2–4 seconds between page fetches). Runs on the background scraper thread. Configurable in settings.

### Deduplication

Two-pass on ingest into the in-memory staging buffer:
1. **URL hash** — exact URL match against existing DB rows and other staged postings
2. **Composite hash** of `(company + normalized_title + posted_at)` — catches same posting re-listed under a different URL

### Pre-Commit Filtering and Staging

Scraped postings are accumulated in memory in `aggregator.py`. **No DB writes occur during scraping.** When the scrape completes (or the user interrupts), ban list and keyword filters are applied to the staged results in memory. The state machine then transitions to `PENDING_COMMIT`. See Module 5 for state machine details.

This is the **authoritative filter pass for new postings**. The ranker post-commit re-applies filters dynamically from live config so that subsequent config changes (e.g. adding a new domain ban after commit) take effect on already-stored postings — but the pre-commit pass determines what enters the DB in the first place.

### Retention Policy

Non-favorited postings are soft-deleted after N days (configurable in settings, default 14). At soft-delete time, `raw_text` is nulled on the row rather than deleting it — the rest of the posting metadata is retained for analytics queries. Favorited postings are exempt from auto-expiry; their `raw_text` is retained indefinitely until the posting is manually removed.

---

## Module 4 — Matching & Ranking

**Purpose:** Filters and ranks stored job postings against the user's search profile.

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
- Drop postings where `yoe_min > user.yoe` or `yoe_max < user.yoe` (when fields present)
- Drop postings containing any `excluded_stack` item

Location filtering is handled upstream by search term generation, not here.

### Stage 2 — Batched LLM Affinity Scoring (`scorer.py`)

Filtered candidates are sent to Claude in batches of 25. Calls are **intentionally sequential** — no async concurrency — to avoid Claude API rate limit complexity. Claude returns a parallel JSON array:

```json
[
  {
    "posting_id": "uuid",
    "affinity_score": 0.87,
    "reasoning": "Strong React and Node.js overlap, seniority matches, remote-friendly"
  }
]
```

Each response item is Pydantic-validated. Items failing validation receive a neutral fallback score of 0.5 with a visual flag in the UI indicating the score is unverified.

Affinity scores are cached in `job_postings` with `affinity_scored_at`. Unchanged postings reuse the cached score on subsequent refreshes.

### Stage 3 — Composite Score Assembly

```
final_score = Σ (weight_<signal> × signal_score) / Σ active_weights
```

Each adapter declares `available_signals: set[str]`. Only signals present for a given posting contribute to the denominator — missing signals do not drag the score down via neutral fallbacks. `applicant_count` is an optional signal available only on adapters that surface it.

Universal signals: `affinity` (LLM), `recency` (days since posting).
Adapter-specific optional signals: `applicant_count`, others declared per adapter.

Weights are user-configurable sliders in `search_config.py`, normalized to sum to 1.0 automatically.

---

## Module 5 — Concurrency Model

Two SQLAlchemy engines against the same WAL-mode SQLite file:

```python
# connection_manager.py
read_engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
write_engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})

@event.listens_for(read_engine, "connect")
def set_readonly(dbapi_conn, _):
    dbapi_conn.execute("PRAGMA query_only = ON")
```

`connection_manager.py` owns the active state, exposes `acquire_write()` / `release_write()`, and fires Flet events the UI subscribes to for enabling/disabling write-capable controls.

### State Machine

```
IDLE (UI = read-write)
  │
  ▼ user confirms search terms → crawl starts
SCRAPING (UI = read-only, no DB writes — results held in memory)
  │                        │
  ▼ all mods complete      ▼ user interrupts
  │                    STOPPING
  │                    (current posting finishes, remainder discarded)
  │                        │
  ▼─────────────────────────▼
PRE_COMMIT_FILTER
  (ban list + keyword filters applied to staged in-memory results)
  │
  ▼
PENDING_COMMIT
  (UI shows commit summary dialog)
  ├─ user confirms → write_engine acquired → bulk insert → release → IDLE
  └─ user discards → staged results dropped → IDLE
```

**`PRE_COMMIT_FILTER`** is a brief synchronous pass that runs ban list and keyword filters on the staged in-memory postings before the summary is computed. This is the authoritative filter pass for new postings — it determines what is offered for commit. The summary shown in `PENDING_COMMIT` reflects post-filter counts:

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

The ranker also applies ban/keyword filters post-commit from live config, so config changes made after a commit (e.g. adding a new domain ban) take effect on already-stored postings without requiring a re-scrape.

Interrupt (STOPPING) also flows through `PRE_COMMIT_FILTER` — partial results from completed batches are still offered for commit.

---

## Module 6 — Application Workflow

1. User selects a posting from the ranked job board view
2. Hits **Tailor Resume** — triggers the full resume engine pipeline for that JD
3. PDF renders in-app via pdf2image preview
4. User reviews, optionally requests re-tailor, hits **Apply**
5. App opens the posting URL in the default browser
6. `job_postings.status` updated to `applied`; an `Application` artifact record (tex path, JSON snapshot) is written to SQLite

Auto-filling application forms via Playwright is explicitly deferred to a future version.

### Tracker View (`tracker.py`)

Sortable, filterable table view. Columns: company, role, date applied, status, source, link to posting. Status updated manually via inline dropdown directly on `job_postings.status`. Statuses available from `applied` onward: `interviewing`, `offer`, `rejected`, `ghosted`.

---

## Settings Module (`settings.py`)

**API key:** Stored in OS keychain via `keyring` (Windows Credential Manager, macOS Keychain, Linux Secret Service). Never written to disk as plaintext, never stored in SQLite.

```python
import keyring

SERVICE = "jobhunt"

def save_api_key(key: str):
    keyring.set_password(SERVICE, "anthropic_api_key", key)

def get_api_key() -> str | None:
    return keyring.get_password(SERVICE, "anthropic_api_key")
```

**Other settings:** TeX binary path, Playwright browser path, default PDF export location, crawl delay, posting retention days (default 14).

**One-click backup:** Exports the SQLite file + browser contexts + resume files as a single archive to a user-chosen location.

---

## Startup Validation

On every launch, before the main UI is shown, the app checks:
- Claude API key present in keychain
- TeX distribution (xelatex) reachable at configured path
- Playwright Chromium binary present
- `~/.jobhunt/` directory accessible and writable
- At least one profile entry exists

Any missing item blocks launch and prints a clear remediation message per item. The user resolves each before proceeding. No cryptic mid-flow failures.

---

## Packaging

**PyInstaller** bundles the Python app and all pip dependencies. `scripts/post_build_playwright.py` runs post-build and:
1. Calls `playwright install chromium` targeting the output `_MEIPASS` directory
2. Sets `PLAYWRIGHT_BROWSERS_PATH` to point inside the bundle at runtime

Validated as part of the build process.

**Note:** Bundling Chromium adds ~150–200MB to the distributable. Expect Windows Defender false positives and macOS notarization friction with PyInstaller builds — both are known issues with this toolchain.

---

## External Dependencies (User-Installed)

- **TeX distribution** — MiKTeX (Windows), MacTeX (macOS), texlive (Linux)
- **Playwright browsers** — handled automatically by post-build script; on dev machines `playwright install chromium`

Everything else is pip-installable.

---

## Local Storage

Single SQLite file at `~/.jobhunt/jobhunt.db`. Tables:

- `profile_entries` — single source of truth for all career data
- `search_config` — global intent text, ranking weights, affinity skip threshold, term generation input hash
- `search_terms` — per-adapter search term list (llm_generated or user_added, with enabled flag)
- `ban_list` — blocked companies and resolved domains
- `job_postings` — normalized postings with full status lifecycle, scraper_mod_version, ban_excluded flag, affinity score + skipped flag, score timestamps, `last_seen_at`; `raw_text` nulled on soft-delete of unfavorited posts
- `applications` — resume artifact records only (tex path, JSON snapshot, schema version, applied_at); status lives on `job_postings`
- `llm_usage` — per-call log of token counts and estimated cost, keyed by call type

Resume `.tex` files stored at `~/.jobhunt/resumes/<application_id>/resume.tex`.
Browser contexts stored at `~/.jobhunt/browser_contexts/<adapter>/`.

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
  value       str          # Normalized lowercase.
                           # company: matched against JobPosting.company (fuzzy)
                           # domain: matched against JobPosting.resolved_domain (exact)
  reason      str | None   # Optional user note
  created_at  datetime
```

`domain` entries match `resolved_domain` exactly (e.g. `"jobs.lever.co"`, `"recruit.net"`). `company` entries match the normalized `company` field (case-insensitive, fuzzy to handle minor variations like `"Acme Corp"` vs `"Acme Corporation"`).

### Filtering Integration

Ban list filtering runs as the first sub-pass of Stage 1 in `ranker.py`. Banned postings are **soft-excluded**: their `ban_excluded` flag is set to `true`. They are not deleted — the user can review and un-ban.

### UI (`search_config.py`)

A dedicated **Ban List** tab within `search_config.py`. Displays two sorted lists (Companies, Domains) with inline add/remove controls. Adding a company name triggers a fuzzy preview of currently-stored postings that would be matched before confirming. Adding a domain shows a count of postings with that resolved domain.

---

## Module 8 — Keyword Filtering

**Purpose:** Filter postings containing undesirable or wholly unfamiliar content, and surface postings containing desired signals. Runs as a pre-commit in-memory pass on staged postings, and again post-commit in the ranker when live config changes.

Keyword filtering is a **filtering concern only** and does not influence search term generation. Search terms are driven by global intent via `search_term_gen.py`.

### Relationship to `excluded_stack`

`excluded_stack` (existing) operates narrowly on the normalized `tech_stack[]` array. Keyword filters operate on a broader configurable field set and support both exclusion and requirement. Both are retained as complementary mechanisms — `excluded_stack` for precise stack-level blocks, keyword filters for everything else.

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
1a. Ban list (company + resolved domain)
1b. Keyword filter (required / excluded)
1c. YOE filter
1d. excluded_stack filter
```

### UI (`search_config.py`)

Tag-input fields for required and excluded keywords, with a toggle to enable `raw_text` matching. A live count of postings currently in the DB that would survive each filter pass is shown to give immediate feedback.

---

## Module 9 — Affinity Score Skip Threshold

**Purpose:** Avoid unnecessary LLM API calls when the filtered candidate pool is already small enough that manual review is practical.

### Configuration (stored in `search_config`)

```
affinity_skip_threshold   int   # default: 15
```

### Logic in `scorer.py`

Before initiating any batch LLM call, `scorer.py` checks the post-filter candidate count:

```python
if len(candidates) <= settings.affinity_skip_threshold:
    for posting in candidates:
        posting.affinity_score = None
        posting.affinity_skipped = True
        posting.affinity_scored_at = None
    return
```

Skipped postings participate in composite score assembly without an affinity component — the denominator excludes the affinity weight, consistent with how other missing signals are handled. The job board view renders a `"Not scored (small batch)"` badge on these postings, visually distinct from the `"Score unverified"` badge used for Pydantic validation fallbacks.

The threshold is user-configurable in `search_config.py` with a note explaining the tradeoff. Setting it to `0` effectively disables the skip behavior.

---

## Module 10 — Analytics Dashboard

**Purpose:** Surface BI metrics derived from the application tracker and LLM usage log so the user can identify what sources, roles, and strategies are working, and monitor API spend.

### Data Sources

- Application metrics: derived from `job_postings` (status, source, seniority, tech_stack, applied_at, status change timestamps)
- LLM cost metrics: derived from `llm_usage` table (new — see below)

No new writes are required for application metrics — `analytics.py` is a pure query layer over existing data.

### LLM Usage Tracking

A new `llm_usage` table records every Claude API call made by the app:

```
LLMUsage
  id              UUID
  call_type       Enum(search_term_gen, affinity_scoring, resume_tailoring)
  model           str              # e.g. "claude-sonnet-4-20250514"
  input_tokens    int
  output_tokens   int
  estimated_cost  float            # USD, computed at write time from known token prices
  called_at       datetime
  posting_id      FK → JobPosting | None   # set for affinity_scoring and resume_tailoring
```

Each call site (search_term_gen.py, scorer.py, agent.py) writes a record after a successful API response using token counts from the response object. `estimated_cost` is computed from a hardcoded price table keyed on model name, updated via settings if prices change. Costs are estimates — the user is reminded of this in the UI.

### Application Metrics

**Funnel**
- Total applications by status (`applied`, `interviewing`, `offer`, `rejected`, `ghosted`)
- Response rate: `(interviewing + offer + rejected) / applied` (ghosted excluded — no response received)
- Conversion rate: `offer / applied`

**By Source**
- Application count per source adapter
- Response rate per source
- Average days from `applied_at` to first status change past `applied`

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

```python
# core/tracker/analytics.py

def get_funnel_summary(session) -> FunnelSummary: ...
def get_by_source(session) -> list[SourceMetric]: ...
def get_by_seniority(session) -> list[SeniorityMetric]: ...
def get_time_series(session, weeks: int = 12) -> list[WeeklyMetric]: ...
def get_llm_cost_summary(session) -> LLMCostSummary: ...
def get_llm_cost_by_type(session) -> list[LLMCostByType]: ...
```

All return Pydantic models. No raw dicts passed to the UI layer.

### UI (`app/views/analytics.py`)

A dedicated Analytics tab with two sections:

**Applications section:**
- Top row: stat cards (Applications, Response Rate, Interviews, Offers)
- Source breakdown: sortable table with per-source counts and response rates
- Time series: sparkline chart of weekly application volume + 4-week rolling response rate
- Stack signal table: tech terms ranked by conditional response rate

**LLM Cost section:**
- Total spend card (all-time + current month)
- Spend breakdown by call type (bar chart or table)
- Cost-per-application metric

Flet's built-in charting primitives are used. No external charting dependency introduced. The view is read-only.

---

```
SQLite (profile_entries)
    └──► Resume Engine ──► Claude API ──► Pydantic validation ──► Jinja2
                               │                                      │
                           llm_usage                              xelatex
                                                                      │
                                                               .tex + PDF
                                                                      │
                                                               pdf2image
                                                                      │
                                                    Flet preview ──► Apply ──► job_postings.status = applied

User enters global intent
    └──► Claude API ──► per-adapter SearchTerm lists ──► search_terms table
               │
           llm_usage
                └──► UI: user reviews + edits per-adapter terms ──► confirm

Scraper Mods (background thread, rate-limited)
    └──► JobPostings (fully normalized per-mod) ──► Pydantic contract check
                                                         │
                                               parse_failed? → log + skip
                                               5 consecutive? → abort mod
                                                         │
                                             dedup (URL hash + composite hash)
                                                         │
                                         In-memory staging buffer
                                                         │
                                         PRE_COMMIT_FILTER (in memory)
                                           1a. Ban list
                                           1b. Keyword filter
                                                         │
                                         PENDING_COMMIT: user sees summary
                                         [Commit] → SQLite  |  [Discard] → drop
                                                         │
                                    Post-commit ranker (live config, on demand)
                                         Stage 1: Hard Filter
                                           1a. Ban list
                                           1b. Keyword filter
                                           1c. YOE filter
                                           1d. excluded_stack filter
                                                         │
                                    Stage 2: Conditional LLM Affinity Scoring
                                         Skip if candidates ≤ affinity_skip_threshold
                                         (25/batch, cached per posting)
                                                    │
                                                llm_usage
                                                         │
                                    Stage 3: Composite Score Assembly
                                         (adapter-declared signals only;
                                          affinity weight excluded if skipped)
                                                         │
                                    Flet Job Board View (score + reasoning + badges)
```
