# Career Index

> **Pre-alpha** — expect rough edges and breaking changes between releases.

Career Index is a local-first desktop app that keeps your entire job search in one place. It aggregates postings from LinkedIn, Indeed, and RSS feeds; scores them against your profile using Claude; generates tailored LaTeX resumes; and tracks every application through to offer or rejection. **All data lives on your machine.** The only external calls are to the Anthropic Claude API and to job board sources during a scrape.

## Features

- **Profile** — maintain a structured career profile (work history, skills, education) that feeds every resume.
- **Job Aggregation** — define search terms, scrape multiple boards concurrently, deduplicate, and review before committing postings to your board.
- **AI Ranking** — Claude scores each posting for affinity to your profile and generates a plain-English reasoning note; configurable weighting lets you emphasise salary, recency, or company rating.
- **Resume Engine** — pick a posting, tailor your profile content with Claude, and compile a PDF via XeLaTeX using the included templates.
- **Application Tracker** — move favorites through a status lifecycle (Applied → Interview → Offer / Rejected) with timestamped history.
- **Analytics** — funnel metrics, source breakdown, volume over time, and Claude API cost tracking.
- **Data Management** — one-click backup, JSON export, and full import.
- **Local-first & private** — SQLite database, no cloud sync, no telemetry.

## Quick Start (pre-built release)

1. Download the installer for your platform from the [Releases](../../releases) page.
2. Install and launch Career Index.
3. Open **Settings** and paste your [Anthropic API key](https://console.anthropic.com/). Claude-powered features unlock immediately.
4. *(Optional)* Install a TeX distribution if you want PDF resume compilation (see [Prerequisites](#prerequisites)).
5. Go to **Profile** and fill in your work history, skills, and education.
6. Go to **Search Config**, add search terms, and run your first scrape.
7. Review the incoming postings on the **Job Board**, favorite the ones worth applying to, and generate a tailored resume from **Resume Preview**.

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js ≥ 20 | For building from source only |
| TeX distribution | MiKTeX (Windows), MacTeX (macOS), texlive (Linux) — needed for PDF compilation |

## Setup

```sh
npm install
```

`postinstall` runs automatically and rebuilds `better-sqlite3` against the Electron headers.

## Development

```sh
npm run dev
```

Starts the Electron app with Vite HMR. The renderer reloads on save; changes to main-process files require an app restart. DevTools open automatically.

## Typecheck

```sh
npm run typecheck
```

Runs `tsc --noEmit` over both the Node and web tsconfigs. No build artifacts are produced.

## Production Build

```sh
npm run build:dist
```

1. `electron-vite build` — compiles main, preload, and renderer into `out/`
2. `electron-builder` — packages into a platform installer under `dist/`

Outputs by platform:

| Platform | Output |
|---|---|
| macOS | `dist/*.dmg` (requires Apple Developer ID for notarization) |
| Windows | `dist/*-Setup.exe` (NSIS installer) |
| Linux | `dist/*.AppImage`, `dist/*.deb` |

To build only (no installer):

```sh
npm run build
```

## First Launch

On the first run the app will:

1. Create the SQLite database at the platform user-data directory and run all migrations automatically.
2. Show all Claude-dependent features as **locked** until an Anthropic API key is entered in Settings.
3. Show resume compilation as **locked** if `xelatex` is not found on `PATH` or at the path configured in Settings.

Playwright Chromium (for LinkedIn/Indeed scrapers) is downloaded to `<userData>/ms-playwright/` on first launch if absent.

## Data Location

| Platform | Path |
|---|---|
| macOS | `~/Library/Application Support/career-index/` |
| Windows | `%APPDATA%\career-index\` |
| Linux | `~/.config/career-index/` |

The SQLite database (`jobhunt.db`), browser contexts, resume files, and logs all live here. Use the one-click backup in Settings to archive the full data directory.
