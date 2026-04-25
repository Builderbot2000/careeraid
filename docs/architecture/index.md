---
layout: default
title: Architecture
nav_order: 3
has_children: true
---

# Architecture

{: .no_toc }

CareerAid is a local-first Electron desktop app. All business logic runs in the Electron main process; the renderer (React) communicates exclusively via IPC through a context-bridge preload. SQLite (WAL mode) is the single source of truth for all persistent data.

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

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
| DB migrations | Custom versioned migration runner |
| Resume templating | Nunjucks + xelatex |
| PDF preview | Electron's native Chromium PDF renderer |
| Credential storage | keytar (OS keychain) |
| Packaging + distribution | electron-builder (auto-update via electron-updater) |

---

## Repository Structure

```
/
├── electron/
│   ├── main.ts                  # Electron main process entry + IPC handlers + startup validation
│   ├── preload.ts               # Context bridge — exposes safe IPC API to renderer
│   └── connection-manager.ts   # better-sqlite3 instance, WAL setup, write-lock state, IPC event bus
│
├── src/                         # Renderer process (React + TypeScript)
│   ├── App.tsx                  # Root component + view routing
│   └── views/
│       ├── Profile.tsx          # Profile editor
│       ├── SearchConfig.tsx     # Search intent + term review + ban list + keyword filters + ranking weights
│       ├── JobBoard.tsx         # Aggregated postings view + favorites
│       ├── ResumePreview.tsx    # Resume tailoring + PDF preview
│       ├── Tracker.tsx          # Application history (sortable table)
│       ├── Analytics.tsx        # BI metrics dashboard
│       └── Settings.tsx         # API key + preferences + backup
│
├── core/                        # Main-process business logic (TypeScript)
│   ├── profile/
│   │   ├── repository.ts        # CRUD — SQLite is the single source of truth
│   │   └── models.ts            # Zod schemas + inferred types
│   ├── resume/
│   │   ├── agent.ts             # Claude API call + prompt construction
│   │   ├── validator.ts         # Zod schema for structured LLM response
│   │   ├── renderer.ts          # Nunjucks → .tex file
│   │   ├── compiler.ts          # child_process xelatex + error handling + recompile-from-snapshot
│   │   └── previewer.ts         # PDF path → Electron BrowserWindow PDF display
│   ├── jobs/
│   │   ├── aggregator.ts        # Orchestrates scraper mods, owns scrape state machine + staging + pre-commit filtering
│   │   ├── searchTermGen.ts     # Claude-generated per-adapter search term lists from global user intent
│   │   ├── scorer.ts            # Sequential LLM affinity scoring + cache logic + skip threshold
│   │   ├── ranker.ts            # Post-commit filtering (ban list, keywords, YOE) + composite score assembly
│   │   └── adapters/
│   │       ├── base.ts          # Abstract adapter interface + available_signals declaration
│   │       ├── linkedin.ts      # Playwright-based scraper + hardcoded normalization
│   │       ├── indeed.ts        # Playwright-based scraper + hardcoded normalization
│   │       ├── hackernews.ts    # node-fetch + Algolia API + hardcoded normalization
│   │       └── rss.ts           # rss-parser generic feed adapter + hardcoded normalization
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
└── templates/resume/
    ├── classic.tex.njk
    └── modern.tex.njk
```

---

## Process Boundary

```
Renderer (React)  ──IPC──►  Main process  ──direct──►  SQLite (WAL)
                                  │
                             Worker thread
                             (scraper mods)
                                  │
                        postMessage → main
                        (staged results)
```

The renderer **never** touches SQLite directly. All Node.js access goes through the context bridge in `preload.ts`.

---

## End-to-End Data Flow

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
    └──► JobPostings (normalized per-mod) ──► Zod contract check
                                                         │
                                               parse_failed? → log + skip
                                               5 consecutive? → abort mod
                                                         │
                                             dedup (URL hash + composite hash)
                                                         │
                                         In-memory staging buffer (Worker)
                                         postMessage → main process
                                                         │
                                         PRE_COMMIT_FILTER (main, synchronous)
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
                                         (batched by token budget, cached per posting)
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

---

## Modules

| Module | Page |
|---|---|
| 1 — Profile Repository | [Profile](profile) |
| 2 — Resume Engine | [Resume Engine](resume-engine) |
| 3 — Job Aggregation Pipeline | [Job Aggregation](job-aggregation) |
| 4 — Matching & Ranking | [Matching & Ranking](matching-ranking) |
| 5 — Concurrency Model | [Concurrency](concurrency) |
| 6 — Application Workflow | [Application Workflow](application-workflow) |
| 7 — Ban List | [Ban List](ban-list) |
| 8 — Keyword Filtering | [Keyword Filtering](keyword-filtering) |
| 9 — Affinity Score Skip Threshold | [Matching & Ranking § Skip Threshold](matching-ranking#affinity-score-skip-threshold) |
| 10 — Analytics Dashboard | [Analytics](analytics) |
| 11 — Data Export / Import | [Data Export & Import](data-export-import) |
| Platform (Startup, Logging, Security, Packaging) | [Platform](platform) |
