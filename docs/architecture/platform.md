---
layout: default
title: Platform
nav_order: 11
parent: Architecture
---

# Platform — Startup, Logging, Security & Packaging

{: .no_toc }

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Startup Validation

On every launch the main process runs two tiers of checks before showing the main window.

**Hard blockers** — window does not open:

- `<userData>/` directory inaccessible or not writable
- SQLite DB cannot be opened

**Feature locks** — window opens; affected features show a locked banner with a remediation action:

| Condition | Locked features |
|---|---|
| Claude API key absent from keychain | Search term generation, affinity scoring, resume tailoring |
| Claude API unreachable | Same Claude-dependent features; all local features remain accessible |
| xelatex not found at configured path | Resume compilation |
| Playwright Chromium binary absent | Playwright-based scrapers (LinkedIn, Indeed) |
| No profile entries in SQLite | Resume tailoring |

Claude connectivity is checked once at startup. If locked due to connectivity, the user restarts to re-check — no cryptic mid-flow failures.

---

## Logging

Log files are written to `<userData>/logs/` by the main process. The worker thread forwards errors to the main process for logging — it does not write log files directly.

- **Files:** One file per day (`jobhunt-YYYY-MM-DD.log`), retained for 30 days (configurable in `settings`)
- **Levels:** `error`, `warn`, `info`, `debug`. Default: `info` in production, `debug` in development

**What is logged:**

- Startup validation results (all checks, pass or fail)
- IPC handler errors
- Scrape errors: parse failures (with mod id and validation message), mod aborts, redirect resolution timeouts
- LLM call failures and retry attempts
- xelatex compilation errors (actionable line extracted from stderr)
- DB migration outcomes

---

## Electron Security

| Setting | Value |
|---|---|
| `nodeIntegration` | `false` |
| `contextIsolation` | `true` |
| `sandbox` | `true` |

All Node.js access from the renderer goes through the context bridge in `preload.ts`.

`shell.openExternal` validates that the target URL scheme is `https://` before invoking, preventing scraped URLs from triggering `file://` or `javascript:` navigation in the default browser.

The PDF preview `<iframe>` uses `sandbox="allow-same-origin"` with a `file://` src. No scripts execute during PDF display.

A Content Security Policy restricts renderer content to `'self'` and `file:`.

---

## Packaging

**electron-builder** handles all target platforms from a single `electron-builder.yml` config:

| Platform | Output | Notes |
|---|---|---|
| macOS | `.dmg` | Code signing + notarization via Apple Developer ID |
| Windows | `.exe` (NSIS installer) | Optional code signing |
| Linux | `.AppImage` + `.deb` | Universal AppImage |

**Auto-update** is handled by `electron-updater`. The app checks for updates on launch, downloads in the background, and prompts the user to restart on completion. The update feed is a static JSON manifest — GitHub Releases works out of the box.

**Playwright browsers** are downloaded to `<userData>/ms-playwright/` at first launch, not bundled in the installer (they're ~150 MB). `scripts/postInstall.ts` runs via `app.on('ready')` on first launch if the directory is absent.

{: .note }
Bundling Chromium adds ~150–200 MB to the distributable. macOS notarization requires an Apple Developer ID certificate — electron-builder handles the `codesign` and `notarytool` calls automatically when credentials are configured in the build environment.

---

## Local Storage Schema

Single SQLite file at `<userData>/jobhunt.db`.

| Table | Purpose |
|---|---|
| `profile_entries` | Single source of truth for all career data |
| `settings` | Non-sensitive app settings; API key stays in OS keychain only |
| `search_config` | Global intent text, ranking weights, affinity skip threshold, term generation hash |
| `search_terms` | Per-adapter search term list (`llm_generated` or `user_added`, with enabled flag) |
| `ban_list` | Blocked companies and resolved domains |
| `job_postings` | Normalized postings with full status lifecycle, affinity score + skipped flag, `first_response_at`, `last_seen_at`; `raw_text` nulled on soft-delete of unfavorited posts |
| `applications` | Resume artifact records only (tex path, JSON snapshot, schema version, `applied_at`); status lives on `job_postings` |
| `llm_usage` | Per-call log of token counts and estimated cost, keyed by call type |

**File paths:**
- Resume `.tex` files: `<userData>/resumes/<application_id>/resume.tex`
- Browser contexts: `<userData>/browser_contexts/<adapter>/`
- Logs: `<userData>/logs/jobhunt-YYYY-MM-DD.log`

---

## External Dependencies (User-Installed)

| Dependency | Platform | Notes |
|---|---|---|
| MiKTeX | Windows | TeX distribution for xelatex |
| MacTeX | macOS | TeX distribution for xelatex |
| texlive | Linux | TeX distribution for xelatex |
| Playwright Chromium | All | Downloaded automatically on first launch |
