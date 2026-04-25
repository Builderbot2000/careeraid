---
layout: default
title: Analytics
nav_order: 9
parent: Architecture
---

# Module 10 — Analytics Dashboard

{: .no_toc }

Surface BI metrics derived from the application tracker and LLM usage log so the user can identify what sources, roles, and strategies are working, and monitor API spend.

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Data Sources

- **Application metrics** — derived from `job_postings` (status, source, seniority, tech_stack, applied_at, status change timestamps)
- **LLM cost metrics** — derived from `llm_usage` table

`analytics.ts` is a pure query layer over existing data — no new write paths are introduced.

---

## LLM Usage Tracking

Every Claude API call is recorded in `llm_usage`:

```
LLMUsage
  id              TEXT (UUID)
  call_type       TEXT  CHECK(call_type IN ('search_term_gen','affinity_scoring','resume_tailoring'))
  model           TEXT              -- e.g. "claude-sonnet-4-20250514"
  input_tokens    INTEGER
  output_tokens   INTEGER
  estimated_cost  REAL              -- USD, computed at write time from known token prices
  called_at       TEXT (ISO datetime)
  posting_id      TEXT | NULL       -- FK → job_postings.id; set for affinity_scoring and resume_tailoring
```

Each call site (`searchTermGen.ts`, `scorer.ts`, `agent.ts`) writes a record after a successful API response using token counts from the response object. `estimated_cost` is computed from a hardcoded price table keyed on model name. Costs are estimates — the user is reminded of this in the UI.

---

## Application Metrics

### Funnel

- Total applications by status (`applied`, `interviewing`, `offer`, `rejected`, `ghosted`)
- Response rate: `(interviewing + offer + rejected) / applied` (ghosted excluded — no response received)
- Conversion rate: `offer / applied`

### By Source

- Application count per source adapter
- Response rate per source
- Average days from `applied_at` to `first_response_at`

### By Role / Keywords

- Application count grouped by normalized seniority level
- Response rate by seniority
- Tech stack terms most correlated with `interviewing` or `offer` outcomes vs. `rejected` or `ghosted` (gated at ≥3 data points to suppress noise)

### Over Time

- Weekly application volume
- Rolling 4-week response rate trend

---

## LLM Cost Metrics

- Total estimated spend (all-time and current month)
- Spend by call type (`search_term_gen`, `affinity_scoring`, `resume_tailoring`)
- Per-session cost for the most recent scrape
- Cost-per-application (total LLM spend / total applications submitted)

---

## Implementation

```typescript
// core/tracker/analytics.ts
export function getFunnelSummary(db: Database): FunnelSummary { ... }
export function getBySource(db: Database): SourceMetric[] { ... }
export function getBySeniority(db: Database): SeniorityMetric[] { ... }
export function getTimeSeries(db: Database, weeks = 12): WeeklyMetric[] { ... }
export function getLLMCostSummary(db: Database): LLMCostSummary { ... }
export function getLLMCostByType(db: Database): LLMCostByType[] { ... }
```

All return typed objects (Zod-inferred interfaces). No raw untyped objects are passed to the renderer — data is serialized cleanly over IPC.

---

## UI — `Analytics.tsx`

The view is read-only with two sections:

**Applications**
- Top row: stat cards (Applications, Response Rate, Interviews, Offers)
- Source breakdown: sortable table with per-source counts and response rates
- Time series: sparkline chart of weekly application volume + 4-week rolling response rate
- Stack signal table: tech terms ranked by conditional response rate (gated at ≥3 data points)

**LLM Cost**
- Total spend card (all-time + current month)
- Spend breakdown by call type (bar chart or table)
- Cost-per-application metric

Charts are implemented with **Recharts** (ships with React, no additional native dependency).
