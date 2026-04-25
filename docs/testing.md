---
layout: default
title: Testing
nav_order: 5
---

# Testing Methodology

{: .no_toc }

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Overview

The strategy is two-layered. The inner layer uses **Vitest** to cover all core Node.js logic as integration tests — these run fast, in-process, against a real in-memory SQLite database bootstrapped with the same migration runner the app uses in production. The outer layer uses **Playwright** (already a dependency) to drive the compiled Electron app for end-to-end scenarios that verify the full IPC path from renderer action to database write.

The mock adapter is the fixture engine for both layers — its 15 deterministic postings make it possible to write assertions without random or time-varying data.

---

## Tooling

### Inner layer — Vitest

Vitest runs in a Node.js environment and can import `better-sqlite3`, `core/jobs/**`, `core/tracker/**`, `db/migrations/runner.ts`, and everything else that lives in the main process without any Electron dependency.

```json
// package.json
"test:integration": "vitest run",
"test:integration:watch": "vitest"
```

```ts
// vitest.config.ts
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

### Outer layer — Playwright Electron

Playwright's `_electron` API launches the compiled Electron app, gets a reference to the `BrowserWindow`, and drives it like a normal browser. The app must be built first (`npm run build`) before e2e tests run.

```json
// package.json
"test:e2e": "playwright test --config tests/e2e/playwright.config.ts"
```

---

## Test Database Strategy

Every integration test suite creates its own in-memory SQLite database at suite start (`new Database(':memory:')`), runs the full migration sequence via `runMigrations(db)`, and inserts only the fixture rows it needs.

- Tests are completely isolated from each other and from the user's real database file.
- The migration runner is itself exercised on every test run.
- No cleanup step is required — the DB is garbage-collected when the suite exits.

A shared `tests/integration/helpers/db.ts` helper exports a `makeTestDb()` function that returns a migrated in-memory database with sensible defaults pre-written to `search_config` and `settings`.

---

## Handling LLM Calls

All functions that call Claude (`scorePostings`, `generateSearchTerms`, `tailorResume`) accept an `apiKey: string | null`. When `apiKey` is `null`, `scorePostings` assigns a fallback score and `tailorResume` throws early — providing a natural seam for integration tests that pass `null` and assert the fallback path.

Tests covering Claude response-parsing logic use Vitest's `vi.mock` to stub `@anthropic-ai/sdk` and return a controlled payload. This keeps CI free of real API calls and makes response-shape validation deterministic.

---

## Core Workflows to Cover

### 1. Scrape pipeline — `aggregator.ts`

The mock adapter returns all 15 postings on every call regardless of search terms. Tests verify the boundary conditions of each pre-commit filter independently.

| Scenario | Assertion |
|---|---|
| URL deduplication | Second `runScrape` without commit returns `dupes: 15`, `netNew: 0` |
| Ban list — company | Stripe ban yields no Stripe posting in committed results |
| Ban list — domain | Domain ban on `news.ycombinator.com` excludes all matching postings |
| Keyword filter — required | `required_keywords: ["Rust"]` passes only Rust-mentioning postings |
| Keyword filter — excluded | `excluded_keywords: ["Kafka"]` excludes the Airbnb posting |
| `commitScrape` | Row count in `job_postings` equals `netNew`; subsequent scrape counts all as dupes |
| `discardScrape` | `job_postings` remains empty; subsequent scrape produces same `netNew` |

### 2. Ranker — `ranker.ts`

With `apiKey: null`, scoring is skipped and `affinity_skipped` is set; the ranker still returns results sorted by composite score (recency + applicant_count signals only).

| Scenario | Assertion |
|---|---|
| Recency ordering | Three postings with known `posted_at` values returned newest-first |
| Hard filter — YOE | `user.yoe = 4`; posting with `yoe_min: 5` excluded, `yoe_min: 3` passes |
| Hard filter — excluded_stack | `excluded_stack: ["Java"]` excludes the Airbnb posting |
| Hard filter — regex keyword | `required_keywords: ["re:kubernetes"]` matches case-insensitively in `raw_text` |
| Affinity skip threshold | With 10 postings and threshold 5, scoring is called; already-scored postings are not re-scored |

### 3. Analytics — `core/tracker/analytics.ts`

All analytics functions are pure SQL queries over controlled data.

| Scenario | Assertion |
|---|---|
| Funnel summary | 4 new, 2 applied, 2 interviewing, 1 offer, 1 rejected → correct rates |
| By source | Two sources with known distributions → one row per source, correct counts |
| Weekly time series | Applications spanning 4 weeks → exactly 4 entries, correct peak week |
| LLM cost summary | Three rows with known costs, one from last month → correct all-time and current-month totals |
| LLM cost by type | Rows with different `call_type` values → correct grouping, counts, and totals |

### 4. Search term generation — `core/jobs/searchTermGen.ts`

With a stubbed Anthropic SDK returning a known JSON array:

- Existing `llm_generated` terms for the adapter are deleted before insertion
- The returned `SearchTerm[]` array matches what the stub returned
- A `llm_usage` row is written to the database after the call
- `user_added` terms for the same adapter are not deleted

### 5. Export / Import round-trip

| Scenario | Assertion |
|---|---|
| Round-trip fidelity | Export → import (`replace` mode) into a fresh DB → all rows present, field values byte-identical |
| Merge mode | Existing row with same `id` is skipped; import result reports correct imported count |

---

## E2E Scenarios (Playwright)

| Scenario | Steps | Assertion |
|---|---|---|
| Scrape → commit → JobBoard | Click Run Scrape, wait for commit dialog, click Commit, navigate to JobBoard | At least one row visible |
| Ban list add → posting disappears | After commit, note a company name, add company ban in SearchConfig, return to JobBoard | Posting no longer in list |
| Status update persists | Change posting status to `applied`, kill and relaunch app | Same posting still `applied` |
| Analytics loads | After commit + one `applied` posting, navigate to Analytics | Stat cards show numeric content, weekly chart present |
| Settings backup | Click Create Backup, verify dialog receives a file path | IPC handler reaches `showSaveDialog` without throwing |

---

## File Layout

```
tests/
  integration/
    helpers/
      db.ts              # makeTestDb() — migrated in-memory DB
      stubs.ts           # vi.mock helpers for Anthropic SDK
    aggregator.test.ts
    ranker.test.ts
    analytics.test.ts
    searchTermGen.test.ts
    exportImport.test.ts
  e2e/
    playwright.config.ts
    fixtures/
      app.ts             # electronApp fixture (launch + teardown)
    scrape.spec.ts
    jobboard.spec.ts
    analytics.spec.ts
    settings.spec.ts
```

---

## What Is Deliberately Not Covered

| Area | Reason |
|---|---|
| LaTeX compilation pipeline (`compiler.ts`, `previewer.ts`) | Requires a working `xelatex` binary; tested manually or in a CI environment that provisions TeX Live |
| `safeStorage` API | Electron-native; cannot be exercised outside a running Electron context — verified only via the e2e layer |
| Real adapter network requests | Never made in CI; the mock adapter is the only source of fixture data |
