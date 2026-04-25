---
layout: default
title: Profile
nav_order: 1
parent: Specifications
---

# Profile Module

{: .no_toc }

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Overview

The profile is the sole source of content for resume generation; no other data source feeds into the resume.

---

## Entries

- Users can create, edit, and delete entries in a professional profile.
- A professional profile contains editable entries for basic info (name, address, YOE, visa status, etc.) and details (experience, education, awards, etc.).
- Basic info entries can be used for hard filtering by the job posting ranker.
- There is no cap on the number of detail entries, but each user only has one profile and one set of basic info entries.
- The profile is initialized with generic defaults and is configured in the UI.

---

## Word Limit

- A configurable per-entry word limit (default: 200) is enforced at save time.
- A visible word count indicator is shown in the editor and updates as the user types.

---

## Tag Filtering

- The profile view supports filtering entries by type tag to assist with managing a large profile.
