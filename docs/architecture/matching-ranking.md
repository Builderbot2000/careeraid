---
layout: default
title: Matching & Ranking
nav_order: 4
parent: Architecture
---

# Module 4 — Matching & Ranking

{: .no_toc }

Filters and ranks stored job postings against the user's search profile. The ranker runs each time the job board view is loaded or manually refreshed.

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Posting Status Lifecycle

```
new → viewed → favorited → applied ──► interviewing ──► offer
                                  ↘               ↘
                               ghosted          rejected
                               rejected
```

`ghosted` and `rejected` are reachable from both `applied` (no response after applying) and `interviewing` (dropped mid-process). `offer` is only reachable from `interviewing`. All three terminal states (`offer`, `rejected`, `ghosted`) are considered closed. Status is updated manually from the tracker view via inline dropdown.

---

## Stage 1 — Hard Filtering (local, free)

Applied before any LLM call:

- Drop postings where `yoe_min > user.yoe` or `yoe_max < user.yoe` (when fields present; `user.yoe` from `user_profile.yoe`)
- Drop postings containing any `excluded_stack` item (from `search_config.excluded_stack`)

Order within Stage 1:

```
1a. Keyword filter (required / excluded)
1b. YOE filter
1c. excluded_stack filter
```

Location filtering is handled upstream by search term generation, not here.

---

## Stage 2 — Batched LLM Affinity Scoring (`scorer.ts`)

Filtered candidates are batched by token budget rather than fixed count. Postings accumulate into a batch until the estimated input token count reaches a configurable cap (default: 80,000 tokens); then the batch is sent and a new one started. Token estimation uses a character-count approximation over each posting's `raw_text` plus fixed prompt overhead.

Calls are **intentionally sequential** — no async concurrency — to avoid Claude API rate limit complexity. Claude returns a parallel JSON array:

```json
[
  {
    "posting_id": "uuid",
    "affinity_score": 0.87,
    "reasoning": "Strong React and Node.js overlap, seniority matches, remote-friendly"
  }
]
```

Each response item is Zod-validated. Items failing validation receive a neutral fallback score of 0.5 with a visual flag in the UI indicating the score is unverified.

Affinity scores are cached in `job_postings` with `affinity_scored_at`. Unchanged postings reuse the cached score on subsequent refreshes.

---

## Stage 3 — Composite Score Assembly

$$\text{final\_score} = \frac{\sum (\text{weight}_{\text{signal}} \times \text{signal\_score})}{\sum \text{active\_weights}}$$

Each adapter declares `available_signals: set[str]`. Only signals present for a given posting contribute to the denominator — missing signals do not drag the score down via neutral fallbacks.

| Signal | Type | Notes |
|---|---|---|
| `affinity` | Universal | LLM-derived semantic match score |
| `recency` | Universal | Days since posting date |
| `applicant_count` | Adapter-specific | Available only on adapters that surface it (e.g. LinkedIn) |

Weights are user-configurable sliders in `SearchConfig.tsx`, normalized to sum to 1.0 automatically.

---

## Affinity Score Skip Threshold

**Purpose:** Avoid unnecessary LLM API calls when the filtered candidate pool is already small enough that manual review is practical.

### Configuration

```
affinity_skip_threshold   INTEGER   -- default: 15 (stored in search_config)
```

### Logic in `scorer.ts`

Before initiating any batch LLM call, `scorer.ts` checks the post-filter candidate count:

```typescript
// core/jobs/scorer.ts
if (candidates.length <= settings.affinitySkipThreshold) {
  for (const posting of candidates) {
    posting.affinityScore = null;
    posting.affinitySkipped = true;
    posting.affinityScored_at = null;
  }
  return;
}
```

Skipped postings participate in composite score assembly without an affinity component — the denominator excludes the affinity weight, consistent with how other missing signals are handled. The job board view renders a `"Not scored (small batch)"` badge on these postings, visually distinct from the `"Score unverified"` badge used for Zod validation fallbacks.

Setting the threshold to `0` effectively disables the skip behavior.

---

## Job Board View (`JobBoard.tsx`)

Displays ranked postings sorted by `final_score` descending. Features:

- Page-number-based pagination with configurable page size (default: 50)
- Score badges per posting
- Affinity reasoning tooltip (the `reasoning` string returned by Claude)
- Status controls inline per row
- Favorites filter
