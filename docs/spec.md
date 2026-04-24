# Product Requirements

## Scope

Career Index is a local-first desktop application for managing a professional profile, aggregating job postings from multiple sources that is matching to said profile, and generating tailored LaTeX resumes for application to these postings. All user data lives on the local machine. The only external network calls are to the Anthropic Claude API and to job board sources during a scrape.

---

## 1. Profile Management

- Users can create, edit, and delete entries in a professional profile.
- Professional profile contains editable entries for basic info (name, address, yoe, visa status, etc.) and details (experience, education, awards, etc.)
- The basic info entries can be used for hard filtering by the job posting ranker
- There is no cap on the number of detail entries, but each user only has one profile and one set of basic info entries 
- The profile is the sole source of content for resume generation; no other data source feeds into the resume.
- A configurable per-entry word limit (default: 200) is enforced at save time with a visible character count in the editor.
- The profile is initialized with generic defaults and is configured in UI.

---

## 2. Resume Generation

- Users can initiate resume tailoring from any job posting in the job board by clicking **Tailor Resume** in the UI card of the job posting.
- The resume engine uses the Anthropic Claude API to read profile entries and rewrite a resume of set format to fit the posting's job description.
- The tailored resume data is validated before being rendered to PDF.
- The validated data is rendered into a source file using a user-selected named template.
- At least two templates are shipped (`classic`, `modern`).
- The source file is compiled to PDF.
- The compiled PDF is displayed natively inside the app.
- On compilation failure, the most actionable error is surfaced to the user.
- A snapshot of the resume data is stored alongside the source file so the PDF can be recompiled if the source file is lost.
- Resume tailoring will use the placeholder content in professional profile if no user created profile entries exist.
- Resume tailoring is locked if the Claude API key is absent or unreachable.
- Resume compilation is locked if the PDF compiler is not found.
- Every AI call made during tailoring is tracked with token counts and estimated cost.

---

## 3. Job Aggregation Pipeline

### 3a. Search Term Creation

- Users can hard-define a search term by selecting each field (e.g. role, location, seniority) via structured UI controls and submitting it directly to their term bank.
- Users can optionally enter a free-text soft intent and click **Suggest** to generate a list of recommended terms derived from their profile and the intent (or profile alone if no intent is provided).
- Clicking a suggested term adds it to the term bank; suggestions are not added automatically.
- AI calls for suggestion generation are tracked.

### 3b. Search Term Management

- Users can view, enable/disable, edit, and delete individual terms in their term bank.
- Each term records whether it was hand-defined or AI-suggested.
- Search terms are stored in a canonical format (role, location, seniority, and any additional structured fields); each adapter maps this format to its own query syntax via a required interface method.

### 3c. Adapters

- Each source adapter is a self-contained module with a standardized search interface.
- Adapters are discovered at startup.
- Each adapter declares an inter-request delay and the set of signals it can provide (e.g. recency, applicant count).
- The mock adapter is always available and returns deterministic postings for development and testing.
- some adapters based on need can handle authentication walls by opening a dedicated browser window for the user to complete authentication; the session is saved and reused on future crawls.
- HackerNews is scraped via its public API without authentication.
- RSS-based sources (RemoteOK, Wellfound, and generic job feeds) are supported.

### 3d. Scrape Execution

- Users initiate a crawl from the Search Configuration view after reviewing and confirming their search terms.
- Scraping runs with a configurable inter-request delay (default: 3000 ms) to avoid rate-limiting.
- The UI displays a live crawl progress panel showing each adapter's status (e.g. pending, running, done, aborted), postings collected so far, and any per-adapter errors or abort reasons.
- All postings fetched by all adapters are accumulated in a staging buffer; no database writes occur during scraping.
- Each posting is validated at the aggregator boundary.
- A posting failing validation is logged and skipped; it is never written to the database. But the failure is displayed on the UI and logged.
- If a single adapter produces 5 or more consecutive validation failures, that adapter's crawl is aborted; the failure is noted in the commit summary. Other adapters continue unaffected. The threshold is configurable in settings.
- The user can interrupt a crawl in progress; partially collected postings are passed through pre-commit filtering and offered for commit.

### 3e. Deduplication

- Deduplication is applied to staged postings against all existing records and other staged postings in the same run:
  - Exact URL match.
  - A composite match on company, title, and date to catch re-listed postings under different URLs.
- Duplicate count is reported in the commit summary.

### 3f. Pre-commit Filtering

- Before the commit dialog is shown, the staging buffer is synchronously filtered by:
  1. **Ban list** — postings matching a banned company pattern or banned resolved domain are dropped.
  2. **Keyword filter** — postings failing the configured required/excluded keyword rules are dropped.
- The counts of ban-excluded and keyword-filtered postings are shown in the commit summary.
- No pre-commit-filtered posting is ever written to the database.

### 3g. Commit / Discard

- The commit summary dialog shows: total fetched, deduped, parse errors, ban-excluded, keyword-filtered, mod aborts, and net new postings offered.
- The user can commit all net-new postings atomically, or discard them entirely.
- After commit or discard the staging buffer is cleared.

### 3h. Retention Policy

- Non-favorited postings are soft-deleted after N days (configurable via settings, default: 14 days).
- Soft-delete removes the full text content; all other metadata is retained for analytics.
- Favorited postings are exempt from soft-delete; their full content is retained indefinitely.
- The retention policy runs at application startup.

---

## 4. Ban List

- Users can add company bans and domain bans from the Ban List tab in Search Configuration.
- Company ban values are case-insensitive regex patterns matched against the posting's company name.
- Domain ban values are exact lowercase matches against the resolved destination domain after redirect resolution.
- Each entry has an optional reason note.
- A live preview of how many currently-stored postings would be matched is shown before the user confirms a new ban entry.
- Adding a ban entry immediately hard-deletes all matching postings already in the database; there is no undo or soft-exclusion path.
- Removing a ban entry removes only the rule; hard-deleted postings do not restore.
- Banned postings are also dropped at pre-commit filter time and never written to the database.

---

## 5. Keyword Filtering

- Users can configure required keywords (posting must match at least one) and excluded keywords (posting is dropped on any match).
- Each keyword can be prefixed with `re:` to be interpreted as a case-insensitive regex pattern.
- The set of fields to match against is configurable: title, tech stack, and/or full text (default: title + tech stack).
- Excluded stack is a separate, narrower filter that operates only on the tech stack field.
- Keyword filtering runs at pre-commit time on staged postings and again on every job board load, so adding or modifying keywords after a commit takes retroactive effect without a re-scrape.
- Keyword filtering does not influence search term generation.

---

## 6. Ranking and the Job Board

### 6a. Hard Filtering (Stage 1)

- Applied before any AI scoring call on every job board load.
- Postings outside the user's stated years of experience range are excluded (when the range is present on the posting).
- Postings containing any excluded stack item are excluded.
- Required and excluded keyword rules are re-applied from live config.

### 6b. Affinity Scoring (Stage 2)

- Ranking of job postings by affinity score to user professional profile occurs after crawl and initial filtering, this feature may be toggled via settings in UI
- Postings passing hard filters that have not yet been scored are sent to Claude in batches for affinity scoring.
- Batches are assembled based on a configurable token budget (default: 80,000 tokens).
- Scoring calls are sequential; no concurrent AI requests are made.
- The AI returns an affinity score (0–1) and reasoning per posting.
- Items failing validation receive a fallback score of 0.5 and a visual "score unverified" badge.
- Scores are cached; already-scored postings are not re-scored on refresh.
- If the total aggregate filtered candidate count after all search terms and adapters is at or below the configurable skip threshold (default: 15), scoring is skipped entirely and all candidates show a "not scored (small batch)" badge.
- Every affinity scoring AI call is tracked for LLM token usage and cost.

### 6c. Composite Score Assembly (Stage 3)

- Each posting receives a final composite score: the weighted sum of active signal scores, normalized by the sum of weights for signals present on that posting.
- Universal signals: affinity (AI score) and recency (days since posting).
- Optional adapter-declared signal: applicant count.
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

- Users can update a favorited posting's status inline from the application management view.
- Once a posting is favorited, it enters application tracking and can be viewed under application management, a posting that is not at least favorited will not be shown under that UI.
- The status lifecycle is: `favorited → applied → interviewing → offer` (or `→ rejected` / `→ ghosted` from both `applied` and `interviewing`).
- The first response date is recorded once on the first status transition out of applied.
- The application management view is a paginated table (default page size: 50) showing all postings in applied-or-later states.
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
- All metrics are computed from existing data; no additional writes are required.

---

## 9. LLM Usage Tracking

- Every AI call made by the app (search term generation, affinity scoring, resume tailoring) is recorded.
- Each record stores: call type, model name, input token count, output token count, estimated cost in USD, and timestamp.
- Estimated cost is computed from a price table keyed on model name.

---

## 10. Settings

- **API key:** Stored encrypted; never written to disk as plaintext. Falls back to the `ANTHROPIC_API_KEY` environment variable for development.
- **PDF compiler path:** Path to the PDF compiler executable; if absent, the app searches system PATH.
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

- **Backup:** A one-click action copies the database file to a user-chosen path via the native save dialog.
- **Export:** Serializes profile entries, search configuration, search terms, and ban list to a structured JSON file written to a user-chosen path.
- **Import:** Reads a previously exported JSON file via the native open dialog. Two merge modes:
  - **Merge** — adds entries not already present (matched by id for profile entries; by value for ban list and search terms); existing records are not overwritten.
  - **Replace** — clears the selected categories and inserts all entries from the file.
- The entire import operation is atomic and rolled back on any error.

---

## 12. Startup and Feature Locking

- The database is created at first launch and set up automatically.
- If the user data directory is inaccessible or the database cannot be opened, the application does not start.
- The UI indicates what is missing at the moment.
- The following features are individually locked with an in-UI banner and remediation prompt if their dependency is missing:
  - **Claude-dependent features** (search term generation, affinity scoring, resume tailoring): locked if the API key is absent or Claude is unreachable at startup.
  - **Resume compilation:** locked if the PDF compiler is not found.
  - **Browser-based scrapers:** locked if the browser automation component is absent (downloaded automatically on first launch).
- **Resume tailoring:** note that resume tailoring is not locked if no profile entries exist, it will simply be placeheld with default content
- Claude connectivity is checked once at startup; re-checking requires an app restart.

---

## 13. Security

- The UI process is fully sandboxed with no direct access to OS APIs.
- All backend APIs are exposed to the UI exclusively through a typed, controlled interface.
- External URLs are validated to use `https://` before opening in the browser.
- The PDF preview is sandboxed; no scripts execute during PDF display.
- A Content Security Policy restricts UI content to trusted local sources.
- The PDF compiler is always invoked in restricted mode to prevent arbitrary shell command execution from document source.

---

## 14. Logging

- Log files are written to the user data directory, one file per day.
- Log files older than the configured retention period are deleted at startup.
- Logged events include: startup validation outcomes, handler errors, scrape failures and aborts, AI call failures, PDF compilation errors, and database migration outcomes.

---

## 15. Quality of Life

- **Affinity reasoning tooltip:** the AI's one-line reasoning for a posting's affinity score is visible on hover over the job title in the job board.
- **Live regex preview for ban entries:** before confirming a new company ban, the UI shows a count of currently-stored postings that the pattern would match.
- **Interrupt and partial commit:** a scrape in progress can be interrupted; partially collected postings are still offered for commit.
- **Affinity skip badge:** postings skipped by the skip threshold show a "not scored (small batch)" badge visually distinct from unverified-score postings.
- **Re-tailor:** the user can request a fresh tailor pass on a posting they have already tailored, generating a new resume variant.
- **Recompile from snapshot:** if the source file is missing, the resume can be recompiled from the stored snapshot.
- **Per-entry tag filtering** in the profile view allows the user to filter entries by tag when managing a large profile.
- **Posting age display:** job board rows display a human-readable age ("today", "3d ago").
- **Keyboard shortcut to open posting URL** from the job board row without navigating away.
- **Auto-update:** the app checks for updates on launch, downloads in the background, and prompts the user to restart on completion.
- **Native save/open dialogs** are used for all file operations (backup, export, import, PDF save) rather than manual path entry.
