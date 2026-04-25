---
layout: default
title: Application Workflow
nav_order: 6
parent: Architecture
---

# Module 6 — Application Workflow & Settings

{: .no_toc }

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Application Workflow

1. User selects a posting from the ranked job board view
2. Hits **Tailor Resume** — triggers the full [resume engine pipeline](resume-engine) for that job description (via IPC to main process)
3. PDF renders in-app via Electron's native Chromium PDF renderer
4. User reviews, optionally requests re-tailor, hits **Apply**
5. App opens the posting URL in the default browser via `shell.openExternal`
6. `job_postings.status` updated to `applied`; an `Application` artifact record (tex path, JSON snapshot) is written to SQLite

Auto-filling application forms via Playwright is explicitly deferred to a future version.

---

## Tracker View (`Tracker.tsx`)

Sortable, filterable table view.

| Column | Notes |
|---|---|
| Company | |
| Role | |
| Date applied | Derived from `Application.applied_at` |
| Status | Inline dropdown — editable from `applied` onward |
| Source | Adapter mod id |
| Link | Opens posting URL in default browser |

Statuses available from `applied` onward: `interviewing`, `offer`, `rejected`, `ghosted`. Page-number-based pagination with a configurable page size (default: 50).

---

## Settings Module (`Settings.tsx` + `electron/settings.ts`)

### API Key Storage

The Anthropic API key is stored in the OS keychain via `keytar` (Windows Credential Manager, macOS Keychain, Linux Secret Service). It is **never** written to disk as plaintext, never stored in SQLite, and accessed exclusively from the main process — the renderer requests it via IPC.

```typescript
// electron/settings.ts
import keytar from 'keytar';

const SERVICE = 'jobhunt';

export const saveApiKey = (key: string) =>
  keytar.setPassword(SERVICE, 'anthropic_api_key', key);

export const getApiKey = () =>
  keytar.getPassword(SERVICE, 'anthropic_api_key');
```

### Other Settings

Non-sensitive settings are stored in a single-row `settings` table in SQLite:

```
Settings
  id                           INTEGER  PRIMARY KEY  (always 1)
  tex_binary_path              TEXT | NULL          -- path to xelatex executable
  pdf_export_path              TEXT | NULL          -- default save location for exported PDFs
  crawl_delay_ms               INTEGER              -- default: 3000
  posting_retention_days       INTEGER              -- default: 14
  profile_entry_word_limit     INTEGER              -- default: 200
  log_retention_days           INTEGER              -- default: 30
  parse_error_abort_threshold  INTEGER              -- consecutive parse failures before mod abort; default: 5
  affinity_token_budget        INTEGER              -- max input tokens per affinity scoring batch; default: 80000
  log_level                    TEXT                 -- 'error'|'warn'|'info'|'debug'; default: 'info'
```

### One-Click Backup

Settings → **Backup** exports the SQLite file, browser contexts, and resume files as a single archive to a user-chosen location via `dialog.showSaveDialog`. This is a raw binary backup, distinct from the structured [JSON export](data-export-import).
