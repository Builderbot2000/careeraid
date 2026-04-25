---
layout: default
title: Analytics
nav_order: 7
parent: Specifications
---

# Analytics Module

{: .no_toc }

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Analytics Dashboard

- A dedicated Analytics view surfaces read-only BI metrics derived from stored data.
- All metrics are computed from existing data; no additional writes are required.

### Funnel Metrics

- Counts per status.
- Response rate: `(interviewing + offer + rejected) / applied`.
- Conversion rate: `offer / applied`.

### By Source

- Posting count, response rate, and average days from application to first response, per source adapter.

### By Seniority

- Posting count and response rate grouped by seniority level.

### Weekly Time Series

- Application volume per calendar week over the past 12 weeks.

---

## LLM Usage Tracking

- Every AI call made by the app (search term generation, affinity scoring, resume tailoring) is recorded.
- Each record stores: call type, model name, input token count, output token count, estimated cost in USD, and timestamp.
- Estimated cost is computed from a price table keyed on model name.

### LLM Cost Dashboard

- **Summary:** all-time estimated spend and current-month estimated spend.
- **By type:** call count and total estimated cost broken down by call type (`search_term_gen`, `affinity_scoring`, `resume_tailoring`).
