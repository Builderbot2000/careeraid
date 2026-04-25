---
layout: default
title: Specifications
nav_order: 4
has_children: true
---

# Product Specifications

{: .no_toc }

CareerAid is a local-first desktop application for managing a professional profile, aggregating job postings from multiple sources that match to said profile, and generating tailored LaTeX resumes for application to these postings. All user data lives on the local machine. The only external network calls are to the Anthropic Claude API and to job board sources during a scrape.

---

## Modules

| Module | Description |
|---|---|
| [Profile](profile) | Manage career facts used as the sole source material for resume generation |
| [Resume](resume) | Tailor and compile LaTeX resumes against job descriptions using Claude |
| [Job Aggregation](job-aggregation) | Search term management, adapters, scrape execution, deduplication, and commit |
| [Job Board & Ranking](job-board-ranking) | Hard filters, affinity scoring, composite scoring, and job board view |
| [Job Filtering](job-filtering) | Ban list and keyword filtering for pre-commit and retroactive exclusion |
| [Application Tracking](application-tracking) | Status lifecycle for favorited postings through to offer or rejection |
| [Analytics](analytics) | Funnel metrics, source breakdown, time-series volume, and LLM cost tracking |
| [Settings](settings) | All user-configurable application settings |
| [Data Management](data-management) | Backup, export, and import |
| [Platform](platform) | Startup, feature locking, security, and logging |
