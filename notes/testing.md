# Testing Methodology

## Overview

The app has grown to a point where the main process logic — the scrape pipeline, pre-commit filters, ranker, analytics queries — needs automated coverage. Manual testing each flow after every change is not viable, and many of the regressions that matter most (a keyword filter silently accepting everything, a composite score weight being inverted) produce no visible error; they just return wrong results.

The strategy here is two-layered. The inner layer uses **Vitest** to cover all core Node.js logic as integration tests: these run fast, in-process, against a real in-memory SQLite database bootstrapped with the same migration runner the app uses in production. The outer layer uses **Playwright** (already a dependency) to drive the compiled Electron app for end-to-end scenarios that verify the full IPC path from renderer action to database write. The mock adapter is the fixture engine for both layers — its 15 deterministic postings make it possible to write assertions without random or time-varying data.

---

## Tooling

### Inner layer — Vitest

Vitest runs in a Node.js environment and can import `better-sqlite3`, `core/jobs/**`, `core/tracker/**`, `db/migrations/runner.ts`, and everything else that lives in the main process without any Electron dependency. It supports TypeScript natively via the same tsconfig paths the project already uses.

Add to `devDependencies`:

```
vitest
```

Configuration in `vitest.config.ts` at project root:

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
})
```

Add scripts to `package.json`:

```json
"test:integration": "vitest run",
"test:integration:watch": "vitest"
```

### Outer layer — Playwright Electron

Playwright's `_electron` API lets a test process launch the compiled Electron app, get a reference to the `BrowserWindow`, and drive it like a normal browser. Since we already have `playwright` in `dependencies`, we need only:

```
@playwright/test
```

in `devDependencies`, plus:

```json
"test:e2e": "playwright test --config tests/e2e/playwright.config.ts"
```

For e2e tests to run, the app must be built first (`npm run build`). The Playwright config should point `executablePath` at the electron binary and `args` at `out/main/index.js`.

---

## Test Database Strategy

Every integration test suite creates its own in-memory SQLite database at the start of the suite (using `new Database(':memory:')`), runs the full migration sequence via `runMigrations(db)`, and inserts only the fixture rows it needs. This means:

- Tests are completely isolated from each other and from the user's real database file.
- The migration runner is itself exercised on every test run.
- There is no cleanup step required — the DB is garbage-collected when the suite exits.

A shared `tests/integration/helpers/db.ts` helper exports a `makeTestDb()` function that returns a migrated in-memory database with sensible defaults already written to `search_config` and `settings`. Individual test files import this and add their own rows.

---

## Handling LLM Calls

All functions that call Claude (`scorePostings`, `generateSearchTerms`, `tailorResume`) accept an `apiKey: string | null`. When `apiKey` is `null`, `scorePostings` assigns a fallback score and `tailorResume` throws early. This provides a natural seam: integration tests pass `null` as the API key and assert the fallback path. Tests that specifically cover the Claude response-parsing logic (JSON schema validation, Zod coercion) should use Vitest's `vi.mock` to stub `@anthropic-ai/sdk` and return a controlled `TextBlock` payload. This keeps CI free of real API calls and makes response-shape validation deterministic.

---

## Core Workflows to Cover

### 1. Scrape pipeline — `aggregator.ts`

The mock adapter returns all 15 postings on every call regardless of search terms. The pipeline tests should verify the boundary conditions of each pre-commit filter independently.

**URL deduplication.** After `runScrape` with the mock adapter, call `runScrape` again without committing. The second run should return `dupes: 15` (all postings already staged) and `netNew: 0`.

**Ban list — company.** Insert a company ban entry matching `"Stripe"` (or a regex `"^Str"`) before running the scrape. Assert `ban_excluded >= 1` and that the committed postings contain no Stripe posting.

**Ban list — domain.** Insert a domain ban on `"news.ycombinator.com"` (the resolved domain for mock postings that have one). The count of excluded postings should reflect all postings where `resolved_domain` matches.

**Keyword filter — required.** Set `required_keywords` to `["Rust"]` and `keyword_match_fields` to `["tech_stack","raw_text"]`. Only postings mentioning Rust should survive. The mock set contains Vercel (Rust), Fly.io (no — wait, that is Go/Rust/Nix), Deno (Rust), Discord (Rust), Supabase (Rust) — assert that exactly those pass.

**Keyword filter — excluded.** Set `excluded_keywords` to `["Kafka"]`. The Airbnb posting includes Kafka in its raw_text; it should be excluded. Assert `keyword_filtered: 1`.

**`commitScrape`.** After a `runScrape`, call `commitScrape`. Assert the database row count in `job_postings` equals `netNew` from the summary. Call `runScrape` again — all previously committed URLs should now be counted as dupes.

**`discardScrape`.** After a `runScrape`, call `discardScrape`. Assert `job_postings` remains empty. Assert a subsequent `runScrape` produces the same `netNew` count (nothing was committed so nothing is a dupe).

### 2. Ranker — `ranker.ts`

The ranker is async. With `apiKey: null`, scoring is skipped and `affinity_skipped` is set; the ranker still runs and returns results sorted by composite score (recency + applicant_count signals only).

**Recency ordering.** Insert three postings with `posted_at` values of today, 5 days ago, and 30 days ago, all with identical applicant_count. With `apiKey: null`, assert the order returned is newest-first.

**Hard filter — YOE.** Set `user.yoe = 4` in `user_profile`. Insert two postings: one with `yoe_min: 5` (should be filtered) and one with `yoe_min: 3` (should pass). Assert only one posting is returned.

**Hard filter — excluded_stack.** Set `excluded_stack` to `["Java"]`. Insert the Airbnb posting (tech_stack includes Java). Assert it is excluded from results.

**Hard filter — required keywords with re: prefix.** Set `required_keywords` to `["re:kubernetes"]` with `keyword_match_fields: ["raw_text"]`. Assert only postings whose raw_text contains "kubernetes" (case-insensitive) are returned.

**Affinity skip threshold.** Set `affinity_skip_threshold` to 5. Insert 10 postings. With a valid API key (stubbed), assert that `scorePostings` is called only for postings with `affinity_score IS NULL` and `affinity_skipped = 0`. Insert a posting with `affinity_score` already set and assert it is not re-scored.

### 3. Analytics — `core/tracker/analytics.ts`

All analytics functions are pure SQL queries over controlled data, making them easy to verify exactly.

**Funnel summary.** Insert 10 postings with statuses: 4 `new`, 2 `applied`, 2 `interviewing`, 1 `offer`, 1 `rejected`. Assert `getFunnelSummary` returns `{ applied: 2, interviewing: 2, offer: 1, rejected: 1 }`. Assert `response_rate` equals `(2+1+1)/2 = 2.0` and `conversion_rate` equals `1/2 = 0.5`.

**By source.** Insert postings from two sources (`mock` and a synthetic `linkedin`) with known status distributions. Assert `getBySource` returns one row per source with correct counts.

**Weekly time series.** Insert applications (set `status` to `applied` with known `fetched_at` dates spanning 4 weeks). Assert `getWeeklyTimeSeries(db, 4)` returns exactly 4 entries. Assert the week containing the most applications has the highest count.

**LLM cost summary.** Insert three `llm_usage` rows with known `estimated_cost` values, one from last month and two from the current month. Assert `getLLMCostSummary` reports `all_time` as the sum of all three and `current_month` as the sum of the two recent ones.

**LLM cost by type.** Insert usage rows with different `call_type` values. Assert `getLLMCostByType` groups correctly and the `call_count` and `total_cost` per group are accurate.

### 4. Search term generation — `core/jobs/searchTermGen.ts`

With a stubbed Anthropic SDK returning a known JSON array, assert that:

- Existing `llm_generated` terms for the adapter are deleted before insertion.
- The returned `SearchTerm[]` array matches what the stub returned.
- A `llm_usage` row is written to the database after the call.
- `user_added` terms for the same adapter are not deleted.

### 5. Export / Import round-trip

The export serialises `profile_entries`, `search_config`, `search_terms`, and `ban_list` to JSON. The import reads that JSON back and merges or replaces. This is testable without Electron by calling the underlying logic directly.

**Round-trip fidelity.** Insert known profile entries and ban list entries, export to a JS object (bypass the file dialog), import in `replace` mode into a fresh database, and assert that each row is present and field values are byte-identical.

**Merge mode.** In merge mode, existing rows with the same `id` should be skipped. Insert one profile entry in the target DB before importing. Assert the entry is not overwritten and the import result reports the correct imported count.

---

## E2E Scenarios (Playwright)

These tests launch the full built app and drive the renderer. They should cover the critical paths where IPC wiring is the most likely source of regression.

**Scrape → commit → JobBoard visible.** Click "Run Scrape" in SearchConfig, wait for the commit dialog to appear, click "Commit". Navigate to the JobBoard view and assert that at least one row is visible in the table.

**Ban list add → posting disappears.** After committing a scrape, note the company of the first posting in the JobBoard. Navigate to SearchConfig → Ban List tab, add a company ban matching that company, return to JobBoard, and assert the posting is no longer in the list.

**Status update persists.** In JobBoard, change a posting's status to `applied`. Kill and relaunch the app. Navigate to JobBoard and assert the same posting is still `applied`.

**Analytics loads without error.** After committing a scrape and updating one posting to `applied`, navigate to the Analytics view. Assert that the stat cards render with numeric content and the weekly chart is present.

**Settings backup round-trip.** Click "Create Backup" and verify the dialog receives a file path (Playwright can intercept the dialog). This confirms the IPC handler reaches the `showSaveDialog` branch without throwing.

---

## File Layout

```
tests/
  integration/
    helpers/
      db.ts          # makeTestDb() — migrated in-memory DB
      stubs.ts       # vi.mock helpers for Anthropic SDK
    aggregator.test.ts
    ranker.test.ts
    analytics.test.ts
    searchTermGen.test.ts
    exportImport.test.ts
  e2e/
    playwright.config.ts
    fixtures/
      app.ts         # electronApp fixture (launch + teardown)
    scrape.spec.ts
    jobboard.spec.ts
    analytics.spec.ts
    settings.spec.ts
```

---

## What Is Deliberately Not Covered

The LaTex compilation pipeline (`core/resume/compiler.ts`, `previewer.ts`) requires a working `xelatex` binary and is an integration concern with the system environment rather than the application logic. It should be tested manually or in a dedicated CI environment that provisions TeX Live. Similarly, the `safeStorage` API is Electron-native and cannot be exercised outside a running Electron context, so key storage is verified only via the e2e layer. Real adapter network requests are never made in CI; the mock adapter is the only source of fixture data.
