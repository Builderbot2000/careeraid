---
layout: default
title: Ban List
nav_order: 7
parent: Architecture
---

# Module 7 — Ban List

{: .no_toc }

Permanently suppress postings from companies or destination domains that are known to be unreliable, unresponsive, or otherwise undesirable. Applied before any other filtering or LLM call.

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## The Domain Ban Problem

Job boards like LinkedIn and Indeed frequently aggregate postings from third-party boards (Lever, Greenhouse, Workable, random obscure aggregators). The posting's `url` field as scraped may be a redirect — the actual destination domain is only known after following the redirect chain. A domain ban must operate on the **resolved destination domain**, not the raw scraped URL.

**Redirect resolution:** At ingest time, each scraper mod performs a lightweight HTTP HEAD request (with a short timeout, no JS execution) to resolve the final URL and stores the extracted domain in `resolved_domain` on the `JobPosting`. If resolution fails or times out, `resolved_domain` falls back to the domain parsed from the raw `url`. This adds a small per-posting cost at scrape time but is far cheaper than a full page fetch.

---

## Schema

```
BanListEntry
  id          UUID
  type        Enum(company | domain)
  value       str          # company: case-insensitive regex matched against JobPosting.company
                           # domain: normalized lowercase; exact match against JobPosting.resolved_domain
  reason      str | None   # Optional user note
  created_at  datetime
```

- `domain` entries match `resolved_domain` exactly (e.g. `"jobs.lever.co"`, `"recruit.net"`)
- `company` entries are matched against `JobPosting.company` as a case-insensitive regex (e.g. `"acme"` matches both `"Acme Corp"` and `"Acme Corporation"`)

---

## Filtering Integration

Ban list filtering is enforced at two points:

| Point | Behaviour |
|---|---|
| **Pre-commit** | Applied during `PRE_COMMIT_FILTER` — matching staged postings are dropped and never written to the DB |
| **On ban entry creation** | All matching postings already in the DB are immediately **hard-deleted** — no soft-exclusion or retention |

Unbanning removes the ban entry only. Hard-deleted postings do not restore; they will reappear on the next crawl if the ban entry is no longer present.

---

## UI — `SearchConfig.tsx` (Ban List tab)

- Two sorted lists: **Companies** and **Domains**, with inline add/remove controls
- Adding a company pattern triggers a live regex preview of currently-stored postings that would be matched — the user must confirm before the entry is saved and matching postings are hard-deleted
- Adding a domain shows a count of postings with that resolved domain before confirming
