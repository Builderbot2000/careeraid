---
layout: default
title: Keyword Filtering
nav_order: 8
parent: Architecture
---

# Module 8 — Keyword Filtering

{: .no_toc }

Filter postings containing undesirable or wholly unfamiliar content, and surface postings containing desired signals. Runs as a pre-commit in-memory pass on staged postings, and again post-commit in the ranker when live config changes.

{: .note }
Keyword filtering is a **filtering concern only** — it does not influence search term generation. Search terms are driven by global intent via `searchTermGen.ts`.

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Relationship to `excluded_stack`

`excluded_stack` (defined in `search_config`) operates narrowly on the normalized `tech_stack[]` array. Keyword filters operate on a broader configurable field set and support both exclusion and requirement. Both are retained as complementary mechanisms — `excluded_stack` for precise stack-level blocks, keyword filters for everything else.

---

## Configuration

Stored in `search_config`:

```
required_keywords    list[KeywordEntry]  # Posting must match ≥1 (OR logic)
excluded_keywords    list[KeywordEntry]  # Posting is dropped if any match
keyword_match_fields list[str]           # Configurable: ["title", "tech_stack", "raw_text"]
                                         #   default: ["title", "tech_stack"]
```

```
KeywordEntry
  value   str   # plain string, or prefixed with "re:" for regex
```

---

## Matching Logic

- Case-insensitive matching
- Partial matches are intentional (e.g. `"cobol"` matches `"COBOL"`)
- Prefix a keyword with `"re:"` to interpret it as a regex pattern

---

## Filtering Integration

| Point | Behaviour |
|---|---|
| **Pre-commit** | Applied to in-memory staged postings during `PRE_COMMIT_FILTER`. Filtered counts appear in the commit summary. |
| **Post-commit (ranker)** | Re-applied dynamically from live config on every job board load — adding/removing keywords after a commit takes effect on already-stored postings without a re-scrape. |

Order within Stage 1 of the ranker:

```
1a. Keyword filter (required / excluded)
1b. YOE filter
1c. excluded_stack filter
```

---

## UI — `SearchConfig.tsx`

- Tag-input fields for required and excluded keywords
- Toggle to enable `raw_text` matching (broader but slower)
- Live count of postings currently in the DB that would survive each filter pass
