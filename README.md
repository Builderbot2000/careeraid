# Career Index

Local-first desktop app for managing a career profile, generating tailored LaTeX resumes, aggregating job postings, and tracking applications. All data stays on your machine; the only external calls are to the Anthropic Claude API.

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js ≥ 20 | Required |
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
