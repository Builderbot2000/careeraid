---
layout: default
title: Platform
nav_order: 10
parent: Specifications
---

# Platform Module

{: .no_toc }

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Startup and Feature Locking

- The database is created at first launch and set up automatically.
- If the user data directory is inaccessible or the database cannot be opened, the application does not start.
- The following features are individually locked with an in-UI banner and remediation prompt if their dependency is missing:
  - **Claude-dependent features** (search term generation, affinity scoring, resume tailoring): locked if the API key is absent or Claude is unreachable at startup.
  - **Resume compilation:** locked if the PDF compiler is not found.
  - **Browser-based scrapers:** locked if the browser automation component is absent.
- Claude connectivity is checked once at startup; re-checking requires an app restart.

---

## Security

- The UI process is fully sandboxed with no direct access to OS APIs.
- All backend APIs are exposed to the UI exclusively through a typed, controlled interface.
- External URLs are validated to use `https://` before opening in the browser.
- The PDF preview is sandboxed; no scripts execute during PDF display.
- A Content Security Policy restricts UI content to trusted local sources.
- The PDF compiler is always invoked in restricted mode to prevent arbitrary shell command execution from document source.

---

## Logging

- Log files are written to the user data directory, one file per day.
- Log files older than the configured retention period are deleted at startup.
- Logged events include: startup validation outcomes, handler errors, scrape failures and aborts, AI call failures, PDF compilation errors, and database migration outcomes.

---

## Auto-Update

- The app checks for updates on launch, downloads the update in the background, and prompts the user to restart on completion.
