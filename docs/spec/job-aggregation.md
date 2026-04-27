---
layout: default
title: Job Aggregation
nav_order: 3
parent: Specifications
---

# Job Aggregation Module

{: .no_toc }

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Search Term Creation

- Users can hard-define a search term via a structured form with the following fields: role (text), locations (multi-select with autocomplete suggestions), seniorities (multi-select: intern / junior / mid / senior / staff), work type (multi-select: remote / hybrid / onsite), recency (day / week / month), and max results.
- The location input offers debounced autocomplete suggestions fetched from the backend as the user types.
- AI generation is available in two modes:
  - **Generate from Intent** — uses the saved free-text intent to produce terms via Claude.
  - **Generate from Profile** — reads the user's experience and skill entries and infers appropriate search terms via Claude without requiring a manually written intent.
- Both generation modes replace all existing LLM-generated terms immediately; generated terms are committed to the term bank directly without a separate confirmation step.
- AI calls for search term generation are tracked.

---

## Search Term Management

- Users can view, enable/disable, edit, and delete individual terms in their term bank.
- Each term records whether it was hand-defined (`user_added`) or AI-generated (`llm_generated`).
- Search terms are **adapter-global** — there is no per-term adapter binding; every enabled adapter receives all enabled terms and maps the canonical fields to its own query syntax.
- Editing a term opens the same structured form used for creation; all fields (role, locations, seniorities, work type, recency, max results) can be updated.

---

## Adapters

- Each source adapter is a self-contained module with a standardized search interface.
- Adapters are queried at startup via `listAdapters()`; each reports an id, display name, description, and whether it is currently available.
- Each adapter declares an inter-request delay and the set of signals it can provide (e.g. recency, applicant count).
- The **mock adapter** is always available and returns deterministic postings for development and testing.
- The **LinkedIn adapter** scrapes LinkedIn Jobs using Playwright (headless Chromium), applying the full structured search term (location, seniority, work type, recency, max results) to the query URL. It fires a progress callback after each successfully parsed posting.
- Unavailable adapters are shown in the adapter selection list but cannot be selected for a scrape run.

---

## Scrape Execution

- Users initiate a crawl from the Search Configuration view after reviewing and confirming their search terms.
- Before running, the user selects which adapters to include; unavailable adapters and the mock adapter are excluded from the default selection.
- Scraping runs with a configurable inter-request delay per adapter (default for LinkedIn: 3000 ms) to avoid rate-limiting.
- If a `max_results` value is set on a search term, the adapter stops fetching once that many postings have been collected for that term.
- The UI displays a live crawl progress panel with per-adapter status (`running`, `done`, `error`) and a running count of postings fetched so far, updated in real time per posting via push events.
- All postings fetched by all adapters are accumulated in a staging buffer; no database writes occur during scraping.
- Each posting is validated at the aggregator boundary.
- A posting failing validation is logged and skipped; it is never written to the database, but the failure is displayed in the UI.
- If a single adapter produces 5 or more consecutive validation failures, that adapter's crawl is aborted; the failure is noted in the commit summary. Other adapters continue unaffected. The threshold is configurable in settings.
- The user can interrupt a crawl in progress; partially collected postings are passed through pre-commit filtering and offered for commit.

---

## Deduplication

- Deduplication is applied to staged postings against all existing records and other staged postings in the same run:
  - Exact URL match.
  - A composite match on company, title, and date to catch re-listed postings under different URLs.
- Duplicate count is reported in the commit summary.

---

## Pre-commit Filtering

- Before the commit dialog is shown, the staging buffer is synchronously filtered by:
  1. **Ban list** — postings matching a banned company pattern or banned resolved domain are dropped.
  2. **Keyword filter** — postings failing the configured required/excluded keyword rules are dropped.
- The counts of ban-excluded and keyword-filtered postings are shown in the commit summary.
- No pre-commit-filtered posting is ever written to the database.

---

## Commit / Discard

- The commit summary dialog shows: total fetched, deduplicated, parse errors, ban-excluded, keyword-filtered, adapter aborts, and net new postings offered.
- The user can commit all net-new postings atomically, or discard them entirely.
- After commit or discard the staging buffer is cleared.

---

## Retention Policy

- Non-favorited postings are soft-deleted after N days (configurable via settings, default: 14 days).
- Soft-delete removes the full text content; all other metadata is retained for analytics.
- Favorited postings are exempt from soft-delete; their full content is retained indefinitely.
- The retention policy runs at application startup.
