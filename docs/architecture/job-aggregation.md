---
layout: default
title: Job Aggregation
nav_order: 3
parent: Architecture
---

# Module 3 — Job Aggregation Pipeline

{: .no_toc }

Accepts a global search intent, generates per-adapter search term lists, presents them for user confirmation, crawls enabled adapters, validates output against the `JobPosting` contract, filters in memory, and presents results for user commit.

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Search Term Generation (`searchTermGen.ts`)

Search configuration follows a deliberate multi-step flow before any crawl starts:

```
1. User enters global intent (free text, e.g. "senior backend engineer, fintech, remote")
2. Claude generates a list of search terms for each enabled adapter
3. Terms are written to the search_terms table, keyed by adapter mod id
4. UI presents the per-adapter term lists for review and editing
5. User confirms → crawl starts using the confirmed terms
```

Terms are stored in a dedicated `search_terms` table:

```
SearchTerm
  id          UUID
  adapter_id  str        # matches adapter mod manifest id
  term        str        # the search string submitted to that adapter
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

Confirmed terms are versioned against a hash of `(intent + config state)`. If the intent or config changes before the next crawl, the user is prompted to regenerate or proceed with stale terms.

{: .note }
**Excluded keywords do not feed into search term generation.** Search terms are semantic intent-driven. Exclusion is handled downstream as a filtering concern. See [Keyword Filtering](keyword-filtering).

---

## Adapter Interface (`base.ts`)

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

Each adapter returns fully normalized `JobPosting` objects directly. Field extraction, YOE parsing, tech stack detection, and seniority inference are all hardcoded per-adapter. The core pipeline enforces only the interface contract via Zod validation at the aggregator boundary.

---

## `JobPosting` — the Interface Contract

```
JobPosting
  id                  UUID             # generated at ingest
  source              str              # adapter mod id
  url                 str              # raw URL as scraped
  resolved_domain     str | None       # domain after redirect resolution (see Ban List)
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
  first_response_at   datetime | NULL  # set once on first status transition out of 'applied'
  last_seen_at        datetime
```

---

## Scraper Mod System

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

Postings are stored with the **app's current schema version**, not the mod's version. The mod version is recorded on the posting (`scraper_mod_version`) for debugging traceability but has no runtime effect. If a mod is replaced or updated, the app must be restarted to load the new adapter class.

---

## Source Adapters

| Adapter | Method | Auth |
|---|---|---|
| LinkedIn (`linkedin.ts`) | Playwright | Sessionless first; auth wall triggers in-app login browser |
| Indeed (`indeed.ts`) | Playwright | Sessionless first; auth wall triggers in-app login browser |
| Hacker News (`hackernews.ts`) | node-fetch → Algolia API | None |
| RSS/Generic (`rss.ts`) | rss-parser | None |

LinkedIn and Indeed: if an auth wall or captcha is detected mid-crawl, the crawl is blocked and the main process opens a dedicated `BrowserWindow` for the user to authenticate. On success, the browser context is saved to `<userData>/browser_contexts/<adapter>/` and reused on subsequent runs.

{: .warning }
Automated scraping of LinkedIn and Indeed violates their terms of service. This app is a personal, non-commercial tool. The user is informed before initiating their first crawl and accepts responsibility.

---

## Parse Contract and Error Handling

At the aggregator boundary each `JobPosting` is validated against the Zod schema. On failure:

- The posting is logged as `parse_failed` with the validation error and mod id
- Processing continues with the next posting
- If a single mod produces **5 or more consecutive `parse_failed`** results, that mod's crawl is aborted with an error surfaced in the commit summary (threshold is configurable in settings)
- Other enabled mods continue unaffected
- `parse_failed` postings are **never written to SQLite**, even on commit

---

## Rate Limiting

Per-domain configurable delay (default: 2–4 seconds between page fetches). Runs on the background scraper thread. Configurable in Settings.

---

## Deduplication

Two-pass on ingest into the in-memory staging buffer:

1. **URL hash** — exact URL match against existing DB rows and other staged postings
2. **Composite hash** of `(company + normalized_title + posted_at)` — catches the same posting re-listed under a different URL

---

## Pre-Commit Filtering and Staging

Scraped postings are accumulated in memory in `aggregator.ts`. **No DB writes occur during scraping.** When the scrape completes (or the user interrupts), ban list and keyword filters are applied to the staged results in memory. The state machine then transitions to `PENDING_COMMIT`.

This is the **authoritative filter pass for new postings**. The ranker re-applies filters dynamically from live config after commit so that subsequent config changes take effect on already-stored postings — but the pre-commit pass determines what enters the DB.

---

## Retention Policy

Non-favorited postings are soft-deleted after N days (configurable, default: 14). At soft-delete time, `raw_text` is nulled on the row rather than deleting it — the rest of the posting metadata is retained for analytics queries. Favorited postings are exempt from auto-expiry; their `raw_text` is retained indefinitely until manually removed.

---

## Commit Summary

When the scrape completes and filtering is applied, the user sees a summary before committing:

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
