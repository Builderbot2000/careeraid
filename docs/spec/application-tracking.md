---
layout: default
title: Application Tracking
nav_order: 6
parent: Specifications
---

# Application Tracking Module

{: .no_toc }

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Overview

Application tracking is limited to favorited postings. Postings that have not been at least favorited will not appear in the tracker.

---

## Status Lifecycle

- Once a posting is favorited, it enters application tracking.
- Status lifecycle: `favorited → applied → interviewing → offer` (or `→ rejected` / `→ ghosted` from both `applied` and `interviewing`).
- Users can update a favorited posting's status inline from the application management view.
- The first response date is recorded once on the first status transition out of `applied`.

---

## Tracker View

- The application management view is a paginated table (default page size: 50) showing all postings in `applied`-or-later states.
- Columns: company, role, date applied, status, source, link to original posting.
