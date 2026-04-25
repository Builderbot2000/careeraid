---
layout: default
title: Job Filtering
nav_order: 5
parent: Specifications
---

# Job Filtering Module

{: .no_toc }

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Ban List

- Users can add company bans and domain bans from the Ban List tab in Search Configuration.
- Company ban values are case-insensitive regex patterns matched against the posting's company name.
- Domain ban values are exact lowercase matches against the resolved destination domain after redirect resolution.
- Each entry has an optional reason note.
- A live preview of how many currently-stored postings would be matched is shown before the user confirms a new ban entry.
- Adding a ban entry immediately hard-deletes all matching postings already in the database; there is no undo or soft-exclusion path.
- Removing a ban entry removes only the rule; hard-deleted postings do not restore.
- Banned postings are also dropped at pre-commit filter time and never written to the database.

---

## Keyword Filtering

- Users can configure required keywords (posting must match at least one) and excluded keywords (posting is dropped on any match).
- Each keyword can be prefixed with `re:` to be interpreted as a case-insensitive regex pattern.
- The set of fields to match against is configurable: title, tech stack, and/or full text (default: title + tech stack).
- Excluded stack is a separate, narrower filter that operates only on the tech stack field.
- Keyword filtering runs at pre-commit time on staged postings and again on every job board load, so adding or modifying keywords after a commit takes retroactive effect without a re-scrape.
- Keyword filtering does not influence search term generation.
