---
layout: default
title: Settings
nav_order: 8
parent: Specifications
---

# Settings Module

{: .no_toc }

---

## Configurable Settings

| Setting | Default | Notes |
|---|---|---|
| API key | — | Stored in OS keychain; never written to disk as plaintext |
| PDF compiler path | (system PATH) | Path to the xelatex executable |
| PDF export path | — | Default save location for exported PDFs |
| Crawl delay | 3000 ms | Inter-request delay |
| Posting retention days | 14 | Days before non-favorited postings are soft-deleted |
| Profile entry word limit | 200 | Cap enforced at save time |
| Log retention days | 30 | Days before old log files are deleted |
| Parse error abort threshold | 5 | Consecutive parse failures before an adapter's crawl is aborted |
| Affinity token budget | 80,000 | Maximum estimated input tokens per affinity scoring batch |
| Log level | `info` | One of `error`, `warn`, `info`, `debug` |
