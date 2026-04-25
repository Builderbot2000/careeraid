---
layout: default
title: Getting Started
nav_order: 2
---

# Getting Started

{: .no_toc }

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js ≥ 20 | Required |
| TeX distribution | MiKTeX (Windows), MacTeX (macOS), texlive (Linux) — needed for PDF compilation |

Playwright Chromium (for LinkedIn/Indeed scrapers) is downloaded to `<userData>/ms-playwright/` automatically on first launch if absent.

---

## Installation

```sh
npm install
```

`postinstall` runs automatically and rebuilds `better-sqlite3` against the Electron headers.

---

## Development

```sh
npm run dev
```

Starts the Electron app with Vite HMR. The renderer reloads on save; changes to main-process files require an app restart. DevTools open automatically.

---

## Typecheck

```sh
npm run typecheck
```

Runs `tsc --noEmit` over both the Node and web tsconfigs. No build artifacts are produced.

---

## Production Build

```sh
npm run build:dist
```

1. `electron-vite build` — compiles main, preload, and renderer into `out/`
2. `electron-builder` — packages into a platform installer under `dist/`

| Platform | Output |
|---|---|
| macOS | `dist/*.dmg` (requires Apple Developer ID for notarization) |
| Windows | `dist/*-Setup.exe` (NSIS installer) |
| Linux | `dist/*.AppImage`, `dist/*.deb` |

To build without an installer:

```sh
npm run build
```

---

## First Launch

On the first run the app will:

1. Create the SQLite database at the platform user-data directory and run all migrations automatically.
2. Show all Claude-dependent features as **locked** until an Anthropic API key is entered in Settings.
3. Show resume compilation as **locked** if `xelatex` is not found on `PATH` or at the path configured in Settings.

Once an API key is saved in Settings, Claude-dependent features unlock immediately — no restart required.

---

## Data Location

| Platform | Path |
|---|---|
| macOS | `~/Library/Application Support/career-index/` |
| Windows | `%APPDATA%\career-index\` |
| Linux | `~/.config/career-index/` |

The SQLite database (`jobhunt.db`), browser contexts, resume files, and logs all live here. Use the one-click backup in Settings to archive the full data directory.

---

## One-Click Backup

Settings → **Backup** exports the SQLite file, browser contexts, and resume files as a single archive to a user-chosen location. This is distinct from the JSON export available in the Data section, which is a portable structured export for selective migration.
