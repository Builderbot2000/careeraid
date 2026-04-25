---
layout: default
title: Data Export & Import
nav_order: 10
parent: Architecture
---

# Module 11 — Data Export & Import

{: .no_toc }

Portable export and import of user data for cross-machine migration and manual editing. Distinct from the one-click backup in Settings, which copies the raw SQLite binary.

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Export

Accessible from `Settings.tsx`. The user selects which categories to include:

| Category | Source table |
|---|---|
| Profile entries | `profile_entries` |
| Search configuration | `search_config` (intent, weights, keyword filters, `excluded_stack`, affinity skip threshold) |
| Search terms | `search_terms` (confirmed per-adapter term lists — both `llm_generated` and `user_added`) |
| Ban list | `ban_list` (company and domain entries) |

Output is a single structured JSON file written to a user-chosen path via `dialog.showSaveDialog`.

---

## Import

Reads a previously exported JSON file via `dialog.showOpenDialog`. Two merge modes:

| Mode | Behaviour |
|---|---|
| **Merge** | Adds entries not already present (matched by `id` for profile entries; by `value` for ban list and search terms). Existing records are **not** overwritten. |
| **Replace** | Clears the selected categories and inserts all entries from the file. |

The user selects categories and confirms the merge mode before proceeding. The entire import runs in a **single SQLite transaction** and is rolled back on any error.

---

## Relationship to One-Click Backup

| | One-Click Backup | JSON Export/Import |
|---|---|---|
| Format | Raw SQLite binary + file archive | Structured JSON |
| Scope | Everything (DB, browser contexts, resume files) | Selected data categories only |
| Portability | Machine-level restore | Cross-machine migration, manual editing |
| Granularity | All-or-nothing | Per-category, with merge mode |
