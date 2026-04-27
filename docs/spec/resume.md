---
layout: default
title: Resume
nav_order: 2
parent: Specifications
---

# Resume Module

{: .no_toc }

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Tailoring

- Users can initiate resume tailoring from any job posting in the job board by clicking **Tailor Resume**.
- The resume engine uses the Anthropic Claude API to read profile entries and rewrite a resume of set format to fit the posting's job description.
- The tailored resume data is validated before being rendered to PDF.
- Resume tailoring will use placeholder content if no user-created profile entries exist.
- Resume tailoring is locked if the Claude API key is absent or unreachable.
- Every AI call made during tailoring is tracked with token counts and estimated cost.
- The user can request a fresh tailor pass on a posting they have already tailored, generating a new resume variant (**Re-tailor**).

---

## Templates

- The validated data is rendered into a source file using a user-selected named template.
- At least two templates are shipped: `classic` and `modern`.

---

## Compilation

- The source file is compiled to PDF using the configured PDF compiler.
- Resume compilation is locked if the PDF compiler is not found.
- On compilation failure, the most actionable error is surfaced to the user.

---

## Preview and Snapshot

- The compiled PDF is displayed natively inside the app.
- A snapshot of the resume data is stored alongside the source file.
- If the source file is lost, the PDF can be recompiled from the stored snapshot (**Recompile from snapshot**).

---

## Resume Naming

- Each tailored resume record has a user-editable display name (`name`), separate from the posting title.
- The name is edited inline in the resume list sidebar: clicking the current name switches it to a text input; pressing Enter or blurring commits the change; pressing Escape cancels.
- The name defaults to empty; the sidebar falls back to displaying the posting title when no name is set.
- Tailoring a resume does not record an applied date; `applied_at` is nullable and is set only when the user explicitly marks the posting as applied.
