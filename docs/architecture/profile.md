---
layout: default
title: Profile Repository
nav_order: 1
parent: Architecture
---

# Module 1 — Profile Repository

{: .no_toc }

A structured store of the user's career facts that the resume engine and job matcher draw from.

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Overview

**Single source of truth: SQLite.** The UI reads from and writes to it directly via IPC calls to the main process. Markdown is an export/import format only — users can export to `profile.md` for manual backup or editing, and re-import to sync back.

SQLite is opened in WAL mode at startup to support concurrent reads from the renderer-facing IPC handlers while the background scraper worker writes job postings simultaneously:

```typescript
// db/database.ts
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

const dbPath = path.join(app.getPath('userData'), 'jobhunt.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;
```

---

## Schema

**Profile entry** — one row per career fact:

```
ProfileEntry
  id          TEXT (UUID)
  type        TEXT  CHECK(type IN ('experience','credential','accomplishment','skill','education'))
  title       TEXT
  content     TEXT              -- word count enforced at IPC boundary per profile_entry_word_limit setting
  tags        TEXT  (JSON array)
  start_date  TEXT | NULL  (ISO date)
  end_date    TEXT | NULL
  created_at  TEXT  (ISO datetime)
```

**User metadata** — single-row table:

```
UserProfile
  id    INTEGER  PRIMARY KEY  (always 1)
  yoe   INTEGER | NULL        -- years of experience; used by the YOE hard filter in the ranker
```

`profile_entry_word_limit` is a configurable integer in the `settings` table (default: 200 words). Enforced at the IPC validation boundary before any DB write.

---

## Validation

Zod validates at the IPC boundary — the renderer sends plain objects over IPC, the main process validates them before any DB write:

```typescript
// core/profile/models.ts
import { z } from 'zod';

export const ProfileEntrySchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['experience', 'credential', 'accomplishment', 'skill', 'education']),
  title: z.string().min(1),
  content: z.string(),
  tags: z.array(z.string()),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  created_at: z.string(),
});

export type ProfileEntry = z.infer<typeof ProfileEntrySchema>;
```

---

## UI — `Profile.tsx`

Form-based editor for adding, editing, and tagging entries. Features:

- Visible character count against the configured word limit
- One-click export to Markdown
- Import/merge flow for re-ingesting an edited Markdown file
- Default placeholder content pre-populated on first launch so resume tailoring is available immediately
