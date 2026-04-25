---
layout: default
title: Job Board & Ranking
nav_order: 4
parent: Specifications
---

# Job Board & Ranking Module

{: .no_toc }

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Hard Filtering (Stage 1)

- Applied before any AI scoring call on every job board load.
- Postings outside the user's stated years of experience range are excluded (when the range is present on the posting).
- Postings containing any excluded stack item are excluded.
- Required and excluded keyword rules are re-applied from live config.

---

## Affinity Scoring (Stage 2)

- Postings passing hard filters that have not yet been scored are sent to Claude in batches for affinity scoring.
- Batches are assembled based on a configurable token budget (default: 80,000 tokens).
- Scoring calls are sequential; no concurrent AI requests are made.
- The AI returns an affinity score (0–1) and a one-line reasoning per posting.
- Items failing validation receive a fallback score of 0.5 and a visual "score unverified" badge.
- Scores are cached; already-scored postings are not re-scored on refresh.
- If the total filtered candidate count is at or below the configurable skip threshold (default: 15), scoring is skipped entirely and all candidates show a **"not scored (small batch)"** badge — visually distinct from unverified-score postings.
- Every affinity scoring AI call is tracked for LLM token usage and cost.

---

## Composite Score Assembly (Stage 3)

- Each posting receives a final composite score: the weighted sum of active signal scores, normalized by the sum of weights for signals present on that posting.
- Universal signals: affinity (AI score) and recency (days since posting).
- Optional adapter-declared signal: applicant count.
- Signals not available for a given posting are excluded from both numerator and denominator; missing signals do not drag the score down.
- Ranking weights are user-configurable in Search Configuration and automatically normalized to sum to 1.0.

---

## Job Board View

- Postings are displayed sorted by composite score descending.
- Page-number-based pagination with a default page size of 50.
- Each row shows: company, title, location, seniority, tech stack, a human-readable posting age ("today", "3d ago"), an affinity score badge (color-coded by score tier), and status controls.
- Affinity badge color tiers: green (≥ 75%), yellow (≥ 50%), orange (≥ 25%), red (< 25%), "–" if skipped, "?" if unscored.
- The AI's one-line reasoning for a posting's affinity score is visible on hover over the job title (**affinity reasoning tooltip**).
- Clicking a posting's title opens the original URL in the default browser and marks the posting as `viewed` if it was `new`.
- A keyboard shortcut is available to open the posting URL from the job board row without navigating away.
- **Tailor Resume** action is available per posting.
