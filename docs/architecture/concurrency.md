---
layout: default
title: Concurrency Model
nav_order: 5
parent: Architecture
---

# Module 5 — Concurrency Model

{: .no_toc }

`better-sqlite3` is synchronous by design. All DB calls are blocking but fast. The concurrency split is between the Electron main process (all DB and core logic) and a Node.js `worker_threads` Worker (scraping). The renderer process never touches SQLite directly.

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Process Architecture

```
Renderer (React)  ──IPC──►  Main process  ──direct──►  SQLite (WAL)
                                  │
                             Worker thread
                             (scraper mods)
                                  │
                        postMessage → main
                        (staged results)
```

WAL mode allows the main process to read SQLite freely while the worker is building its in-memory staging buffer. The only write contention point is the bulk insert at commit time, which is a single synchronous transaction on the main process — safe because `better-sqlite3` is used exclusively from the main process.

The worker communicates progress and staged results back to the main process via `worker.postMessage`. The main process owns all state transitions and fires `webContents.send` to push UI updates to the renderer.

---

## Scrape State Machine

```
IDLE (UI = read-write)
  │
  ▼ user confirms search terms → Worker spawned
SCRAPING (UI = read-only, no DB writes — results held in Worker memory)
  │                        │
  ▼ all mods complete      ▼ user interrupts
  │                    STOPPING
  │                    (current posting finishes, remainder discarded)
  │                        │
  ▼─────────────────────────▼
PRE_COMMIT_FILTER
  (ban list + keyword filters applied to staged in-memory results, main process)
  │
  ▼
PENDING_COMMIT
  (UI shows commit summary dialog)
  ├─ user confirms → bulk insert (synchronous transaction) → Worker terminated → IDLE
  └─ user discards → staged results dropped → Worker terminated → IDLE
```

### PRE_COMMIT_FILTER

A brief synchronous pass on the main process that applies ban list and keyword filters to the staged postings before computing the commit summary. This is the **authoritative filter pass** for new postings.

### Interrupt handling

When the user interrupts a crawl in `SCRAPING`, the state transitions to `STOPPING`. The current posting finishes and the remainder is discarded. Partial results flow through `PRE_COMMIT_FILTER` and are offered for commit — the user still gets to decide whether to keep them.

### Worker crash

If the worker exits unexpectedly during `SCRAPING`, the main process detects it, forwards any partial staged results through `PRE_COMMIT_FILTER`, and transitions to `PENDING_COMMIT` with an error note in the commit summary. The state machine proceeds normally from that point.
