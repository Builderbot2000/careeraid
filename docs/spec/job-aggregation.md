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

- Users can hard-define a search term by selecting each field (role, location, seniority) via structured UI controls and submitting it directly to their term bank.
- Users can optionally enter a free-text soft intent and click **Suggest** to generate a list of recommended terms derived from their profile and the intent.
- Clicking a suggested term adds it to the term bank; suggestions are not added automatically.
- AI calls for suggestion generation are tracked.

---

## Search Term Management

- Users can view, enable/disable, edit, and delete individual terms in their term bank.
- Each term records whether it was hand-defined or AI-suggested.
- Search terms are stored in a canonical format (role, location, seniority, and any additional structured fields); each adapter maps this format to its own query syntax via a required interface method.

---

## Adapters

- Each source adapter is a self-contained module with a standardized search interface.
- Adapters are discovered at startup.
- Each adapter declares an inter-request delay and the set of signals it can provide (e.g. recency, applicant count).
- The mock adapter is always available and returns deterministic postings for development and testing.
- Some adapters can handle authentication walls by opening a dedicated browser window for the user to complete authentication; the session is saved and reused on future crawls.
- HackerNews is scraped via its public API without authentication.
- RSS-based sources (RemoteOK, Wellfound, and generic job feeds) are supported.

---

## Scrape Execution

- Users initiate a crawl from the Search Configuration view after reviewing and confirming their search terms.
- Scraping runs with a configurable inter-request delay (default: 3000 ms) to avoid rate-limiting.
- The UI displays a live crawl progress panel showing each adapter's status (pending, running, done, aborted), postings collected so far, and any per-adapter errors or abort reasons.
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
