# Product Requirements

## Scope

Career Index is a local-first desktop application for managing a career profile, aggregating job postings from multiple sources, and generating tailored LaTeX resumes. All user data lives on the local machine. The only external network calls are to the Anthropic Claude API and to job board sources during a scrape.

---

## 1. Profile Management

- Users can create, edit, and delete career profile entries.
- Each entry has a type drawn from a fixed set: `experience`, `credential`, `accomplishment`, `skill`, `education`.
- Each entry has a title, body content, optional date range, and a list of tags.
- The profile stores a top-level `yoe` (years of experience) integer used by the ranker's YOE hard filter.
- Tags are free-form strings; no predefined taxonomy is enforced.
- There is no cap on the number of profile entries.
- Profile entries are the sole source of content for resume generation; no other data source feeds into the resume.
- A configurable per-entry word limit (default: 200) is enforced at save time with a visible character count in the editor.

---

## 2. Resume Generation

- Users can initiate resume tailoring from any job posting in the job board by clicking **Tailor Resume**.
- The resume engine uses the Anthropic Claude API to select and rewrite profile entries to best match the posting's job description.
- The tailored resume data is validated through a Zod schema before being passed to the renderer.
- Nunjucks renders the validated data into a `.tex` file using a user-selected named template.
- Templates live in `templates/resume/` as `.tex.njk` files; at least two are shipped (`classic`, `modern`).
- `xelatex` is invoked via `child_process.spawn` with `--no-shell-escape` enforced to compile the `.tex` to PDF.
- The compiled PDF is displayed natively inside the app using Electron's Chromium PDF renderer in an `<iframe>`.
- xelatex stdout/stderr is captured; on failure the most actionable error line from the log is surfaced to the user.
- A JSON snapshot of the resume data is written to the `applications` table alongside the `.tex` path so the PDF can be recompiled from snapshot if the `.tex` file is lost.
- Resume tailoring is locked and unavailable if no profile entries exist.
- Resume tailoring is locked if the Claude API key is absent or unreachable.
- Resume compilation is locked if `xelatex` is not found at the configured path or on `PATH`.
- Every Claude call made during tailoring writes an `llm_usage` record with token counts and estimated cost.

---

## 3. Job Aggregation Pipeline

### 3a. Search Configuration

- Users enter a free-text global search intent describing their job target (e.g. "senior backend engineer, fintech, remote").
- The intent is stored in `search_config` and persists across sessions.
- A hash of the current intent and filter configuration is stored; if it changes before the next crawl, the user is warned that the stored search terms may be stale.

### 3b. Search Term Generation

- Clicking **Generate via AI** invokes Claude to produce a list of per-adapter search terms from the stored intent.
- All existing `llm_generated` terms for each adapter are replaced; `user_added` terms are preserved.
- Users can view, enable/disable, edit, and delete individual terms before running a crawl.
- Users can add terms manually; manually added terms are tagged as `user_added`.
- A Claude call for term generation writes an `llm_usage` record.

### 3c. Adapters

- Each source adapter is a self-contained module conforming to the `BaseAdapter` interface (`search(term, filters): Promise<JobPosting[]>`).
- Adapters are discovered at startup by scanning the `adapters/` directory.
- Each adapter declares a `delayMs` inter-request delay and the set of signals it can provide (e.g. `recency`, `applicant_count`).
- The mock adapter is always available and returns 15 deterministic postings for development and testing.
- Playwright-based adapters (LinkedIn, Indeed) handle auth walls by opening a dedicated `BrowserWindow` for the user to complete authentication; the resulting browser context is saved and reused on future crawls.
- HackerNews is scraped via the public Algolia API without authentication.
- RSS-based sources (RemoteOK, Wellfound, and generic job feeds) are parsed via rss-parser.

### 3d. Scrape Execution

- Users initiate a crawl from the Search Configuration view after reviewing and confirming their search terms.
- Scraping runs with a configurable inter-request delay (default: 3000 ms) to avoid rate-limiting.
- All postings fetched by all adapters are accumulated in an in-memory staging buffer; no database writes occur during scraping.
- Each posting returned by an adapter is validated against the `JobPosting` Zod schema at the aggregator boundary.
- A posting failing schema validation is logged as `parse_failed` and skipped; it is never written to the database.
- If a single adapter produces 5 or more consecutive `parse_failed` results, that adapter's crawl is aborted; the failure is noted in the commit summary. Other adapters continue unaffected. The threshold is configurable in settings.
- The user can interrupt a crawl in progress; partially collected postings are passed through pre-commit filtering and offered for commit.

### 3e. Deduplication

- Two-pass deduplication is applied to staged postings against all existing database rows and other staged postings in the same run:
  - Exact URL match.
  - Composite key of `(company + normalized_title + posted_at)` to catch re-listed postings under different URLs.
- Duplicate count is reported in the commit summary.

### 3f. Pre-commit Filtering

- Before the commit dialog is shown, the staging buffer is synchronously filtered by:
  1. **Ban list** — postings matching a banned company pattern or banned resolved domain are dropped.
  2. **Keyword filter** — postings failing the configured required/excluded keyword rules are dropped.
- The counts of ban-excluded and keyword-filtered postings are shown in the commit summary.
- No pre-commit-filtered posting is ever written to the database.

### 3g. Commit / Discard

- The commit summary dialog shows: total fetched, deduped, parse errors, ban-excluded, keyword-filtered, mod aborts, and net new postings offered.
- The user can commit all net-new postings in a single SQLite transaction, or discard them entirely.
- After commit or discard the staging buffer is cleared.

### 3h. Retention Policy

- Non-favorited postings are soft-deleted after N days (configurable, default: 14 days).
- Soft-delete nulls the `raw_text` column; all other metadata is retained for analytics queries.
- Favorited postings are exempt from soft-delete; their `raw_text` is retained indefinitely.
- The retention policy runs at application startup.

---

## 4. Ban List

- Users can add company bans and domain bans from the Ban List tab in Search Configuration.
- Company ban values are case-insensitive regex patterns matched against `JobPosting.company`.
- Domain ban values are exact lowercase matches against `JobPosting.resolved_domain` (the destination domain after HTTP redirect resolution).
- Each entry has an optional reason note.
- A live preview of how many currently-stored postings would be matched is shown before the user confirms a new ban entry.
- Adding a ban entry immediately hard-deletes all matching postings already in the database; there is no undo or soft-exclusion path.
- Removing a ban entry removes only the rule; hard-deleted postings do not restore.
- Banned postings are also dropped at pre-commit filter time and never written to the database.

---

## 5. Keyword Filtering

- Users can configure required keywords (posting must match at least one) and excluded keywords (posting is dropped on any match).
- Each keyword can be prefixed with `re:` to be interpreted as a case-insensitive regex pattern.
- The set of fields to match against is configurable: `title`, `tech_stack`, and/or `raw_text` (default: `title` + `tech_stack`).
- `excluded_stack` is a separate, narrower filter that operates only on the normalized `tech_stack[]` array.
- Keyword filtering runs at pre-commit time on staged postings and again at ranker time on every job board load, so adding or modifying keywords after a commit takes retroactive effect without a re-scrape.
- Keyword filtering does not influence search term generation.

---

## 6. Ranking and the Job Board

### 6a. Hard Filtering (Stage 1)

- Applied before any LLM call on every job board load.
- Postings where `yoe_min > user.yoe` or `yoe_max < user.yoe` are excluded (when the fields are present).
- Postings containing any `excluded_stack` item are excluded.
- Required and excluded keyword rules are re-applied from live config.

### 6b. Affinity Scoring (Stage 2)

- Postings passing hard filters that have not yet been scored are sent to Claude in batches for affinity scoring.
- Batches are assembled by estimated input token count rather than fixed posting count; a configurable token budget cap (default: 80,000 tokens) determines batch size.
- Calls are sequential; no concurrent Claude API requests are made.
- Claude returns a JSON array with `posting_id`, `affinity_score` (0–1), and `reasoning` per posting.
- Each item in the response is Zod-validated; items failing validation receive a fallback score of 0.5 and a visual "score unverified" badge.
- Scores and timestamps are cached in the `job_postings` table; already-scored postings are not re-scored on refresh.
- If the filtered candidate count is at or below the configurable skip threshold (default: 15), scoring is skipped entirely and all candidates receive `affinity_skipped = true`. The job board shows a "not scored (small batch)" badge on these postings.
- Every affinity scoring Claude call writes an `llm_usage` record.

### 6c. Composite Score Assembly (Stage 3)

- Each posting receives a final composite score: the weighted sum of active signal scores, normalized by the sum of weights for signals present on that posting.
- Universal signals: `affinity` (LLM score), `recency` (days since posting).
- Optional adapter-declared signal: `applicant_count`.
- Signals not available for a given posting are excluded from both numerator and denominator; missing signals do not drag the score down.
- Ranking weights are user-configurable in Search Configuration and automatically normalized to sum to 1.0.

### 6d. Job Board View

- Postings are displayed sorted by composite score descending.
- Page-number-based pagination with a default page size of 50.
- Each row shows: company, title (with affinity reasoning in tooltip), location, seniority, tech stack, age of posting, an affinity score badge (color-coded by score tier), and status controls.
- Affinity badge color tiers: green (≥ 75%), yellow (≥ 50%), orange (≥ 25%), red (< 25%), "–" if skipped, "?" if unscored.
- Clicking a posting's title opens the original URL in the default browser and marks the posting as `viewed` if it was `new`.
- **Tailor Resume** action is available per posting.

---

## 7. Application Tracking

- Users can update a posting's status inline from the tracker view.
- The status lifecycle is: `new → viewed → favorited → applied → interviewing → offer` (or `→ rejected` / `→ ghosted` from both `applied` and `interviewing`).
- `first_response_at` is set once on the first status transition out of `applied`.
- The tracker view is a paginated table (default page size: 50) showing all postings in applied-or-later states.
- Columns: company, role, date applied, status, source, link to original posting.

---

## 8. Analytics Dashboard

- A dedicated Analytics view surfaces read-only BI metrics derived from stored data.
- **Funnel metrics:** counts per status (`applied`, `interviewing`, `offer`, `rejected`, `ghosted`), response rate (`(interviewing + offer + rejected) / applied`), conversion rate (`offer / applied`).
- **By source:** posting count, response rate, and average days from application to first response, per source adapter.
- **By seniority:** posting count and response rate grouped by seniority level.
- **Weekly time series:** application volume per calendar week over the past 12 weeks, displayed as a bar chart.
- **LLM cost — summary:** all-time estimated spend and current-month estimated spend.
- **LLM cost — by type:** call count and total estimated cost broken down by call type (`search_term_gen`, `affinity_scoring`, `resume_tailoring`).
- All metrics are computed as pure SQL queries over existing data; no additional writes are required.
- Charts use Recharts.

---

## 9. LLM Usage Tracking

- Every Claude API call made by the app (search term generation, affinity scoring, resume tailoring) writes a record to the `llm_usage` table.
- Each record stores: call type, model name, input token count, output token count, estimated cost in USD, timestamp, and optionally the posting id.
- Estimated cost is computed at write time from a hardcoded price table keyed on model name.
- The `llm_usage` table is the sole data source for the analytics LLM Cost section.

---

## 10. Settings

- **API key:** Stored encrypted via Electron's `safeStorage` API; never written to disk as plaintext or to SQLite. Accessible only from the main process. Falls back to the `ANTHROPIC_API_KEY` environment variable for development.
- **TeX binary path:** Path to the `xelatex` executable; if absent, the app searches `PATH`.
- **PDF export path:** Default save location for exported PDFs.
- **Crawl delay:** Per-request inter-page delay in milliseconds (default: 3000).
- **Posting retention days:** Days before non-favorited postings are soft-deleted (default: 14).
- **Profile entry word limit:** Character cap enforced at profile entry save time (default: 200).
- **Log retention days:** Days before old log files are deleted (default: 30).
- **Parse error abort threshold:** Consecutive parse failures before an adapter's crawl is aborted (default: 5).
- **Affinity token budget:** Maximum estimated input tokens per affinity scoring batch (default: 80,000).
- **Log level:** One of `error`, `warn`, `info`, `debug` (default in production: `info`).

---

## 11. Backup, Export, and Import

- **Backup:** A one-click action copies the raw SQLite database file to a user-chosen path via the native save dialog.
- **Export:** Serializes profile entries, search configuration, search terms, and ban list to a structured JSON file written to a user-chosen path.
- **Import:** Reads a previously exported JSON file via the native open dialog. Two merge modes:
  - **Merge** — adds entries not already present (matched by id for profile entries; by value for ban list and search terms); existing records are not overwritten.
  - **Replace** — clears the selected categories and inserts all entries from the file.
- The entire import operation runs in a single SQLite transaction and is rolled back on any error.

---

## 12. Startup and Feature Locking

- The database is created at `<userData>/jobhunt.db` on first launch; all migrations run automatically.
- If the user-data directory is inaccessible or the database cannot be opened, the application does not start.
- The following features are individually locked with an in-UI banner and remediation prompt if their dependency is missing:
  - **Claude-dependent features** (search term generation, affinity scoring, resume tailoring): locked if the API key is absent or Claude is unreachable at startup.
  - **Resume compilation:** locked if `xelatex` is not found.
  - **Playwright-based scrapers:** locked if the Playwright Chromium binary is absent (downloaded automatically on first launch).
  - **Resume tailoring:** additionally locked if no profile entries exist.
- Claude connectivity is checked once at startup; re-checking requires an app restart.

---

## 13. Security

- `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true` are set on all `BrowserWindow` instances.
- All main-process APIs are exposed to the renderer exclusively through the typed context bridge in `preload.ts`.
- `shell.openExternal` validates that the target URL scheme is `https://` before invoking.
- PDF preview `<iframe>` uses `sandbox="allow-same-origin"` with a `file://` src; no scripts execute during PDF display.
- A Content Security Policy restricts renderer content to `'self'` and `file:`.
- `xelatex` is always invoked with `--no-shell-escape` to prevent arbitrary shell command execution from LaTeX source.

---

## 14. Logging

- Log files are written by the main process to `<userData>/logs/`, one file per day (`jobhunt-YYYY-MM-DD.log`).
- Log files older than the configured retention period are deleted at startup.
- Logged events include: startup validation outcomes, IPC handler errors, scrape parse failures and mod aborts, LLM call failures, xelatex compilation errors, and database migration outcomes.
- The scraper worker thread forwards errors to the main process for logging; it does not write log files directly.

---

## 15. Quality of Life

- **Affinity reasoning tooltip:** the LLM's one-line reasoning string for a posting's affinity score is visible on hover over the job title in the job board.
- **Live regex preview for ban entries:** before confirming a new company ban, the UI shows a count of currently-stored postings that the pattern would match.
- **Stale search term warning:** the UI warns the user if their stored search terms were generated from a different intent or config state than the current one.
- **Interrupt and partial commit:** a scrape in progress can be interrupted; partially collected postings are still offered for commit.
- **Affinity skip badge:** postings skipped by the skip threshold show a "not scored (small batch)" badge visually distinct from unverified-score postings.
- **Re-tailor:** the user can request a fresh tailor pass on a posting they have already tailored, generating a new resume variant.
- **Recompile from snapshot:** if the `.tex` file is missing, the resume can be recompiled from the JSON snapshot stored in the `applications` table.
- **Per-entry tag filtering** in the profile view allows the user to filter entries by tag when managing a large profile.
- **Posting age display:** job board rows display a human-readable age ("today", "3d ago") computed from `posted_at` or `fetched_at`.
- **Keyboard shortcut to open posting URL** from the job board row without navigating away.
- **Auto-update:** the app checks for updates on launch, downloads in the background, and prompts the user to restart on completion.
- **Native save/open dialogs** are used for all file operations (backup, export, import, PDF save) rather than manual path entry.
