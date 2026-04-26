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

---

## Resume PDF Import

- A dedicated "Import from Resume PDF" button is available on the Profile view for testing and onboarding purposes.
- The user selects a PDF file via the system file dialog; the file is read locally and never transmitted outside the Claude API call.
- The app sends the PDF to the configured Claude AI model using the document message format and asks it to extract structured profile entries.
- The AI response is parsed into typed profile entries (`experience`, `education`, `skill`, `credential`, `accomplishment`) and bulk-inserted into the profile.
- A progress indicator is shown while the AI call is in-flight.
- On success, a flash message reports the number of entries added and the entry list refreshes automatically.
- If the API key is absent or the AI call fails, a descriptive error is shown and no entries are written.
- Existing entries are preserved; the PDF import only adds new entries (no deduplication or replacement of existing ones).
- This feature requires the Claude API key to be configured; the button is disabled when the key is absent.
