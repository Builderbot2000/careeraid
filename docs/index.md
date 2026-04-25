---
layout: default
title: Home
nav_order: 1
description: CareerAid — local-first desktop app for job search, resume tailoring, and application tracking.
permalink: /
---

# CareerAid

A local-first desktop application for managing a career profile, generating tailored LaTeX resumes, aggregating job postings, and tracking applications.

**All data stays on your machine.** The only external calls are to the [Anthropic Claude API](https://www.anthropic.com/) and to job board sources during a scrape.

---

## What it does

| Feature | Description |
|---|---|
| **Profile** | Structured career facts (experience, education, skills, accomplishments) used as source material for every resume |
| **Resume tailoring** | Claude reads a job description alongside your profile and writes a tailored resume, rendered via LaTeX to PDF |
| **Job aggregation** | Multi-source scraper (LinkedIn, Indeed, Hacker News, RSS) with search term management, deduplication, and pre-commit filtering |
| **Ranking** | Hard filters (YOE, excluded stack, keywords) + batched LLM affinity scoring + configurable composite score |
| **Application tracking** | Status lifecycle from `new` through `offer`/`rejected`/`ghosted` with sortable tracker view |
| **Analytics** | Funnel metrics, source breakdown, time-series volume, LLM API cost tracking |
| **Data export/import** | Portable JSON export and merge/replace import for cross-machine migration |

---

## Tech stack

| Concern | Library |
|---|---|
| Runtime | Electron (main process) + Chromium (renderer) |
| UI | React + TypeScript |
| Browser scraping | Playwright |
| Light scraping / HTTP | node-fetch + cheerio |
| RSS feeds | rss-parser |
| LLM calls | Anthropic TypeScript SDK |
| Structured LLM output | Zod |
| Storage | better-sqlite3 (WAL mode) |
| Resume templating | Nunjucks + xelatex |
| PDF preview | Electron native Chromium PDF renderer |
| Credential storage | keytar (OS keychain) |
| Distribution | electron-builder + electron-updater |

---

## Where to go next

- [Getting Started](getting-started) — installation, first launch, data locations
- [Architecture](architecture/) — how all the modules fit together
- [Specifications](spec/) — full product requirements and acceptance criteria, organized by module
- [Testing](testing) — two-layer test strategy (Vitest + Playwright)
- [Development Process](development-process) — AI-native development loop
