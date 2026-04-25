---
layout: default
title: Data Management
nav_order: 9
parent: Specifications
---

# Data Management Module

{: .no_toc }

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Backup

- A one-click action copies the database file and associated data to a user-chosen path via the native save dialog.

---

## Export

- Serializes profile entries, search configuration, search terms, and ban list to a structured JSON file.

---

## Import

- Reads a previously exported JSON file. Two merge modes:
  - **Merge** — adds entries not already present; existing records are not overwritten.
  - **Replace** — clears the selected categories and inserts all entries from the file.
- The entire import operation is atomic and rolled back on any error.

---

## File Operations

- Native save/open dialogs are used for all file operations: backup, export, import, and PDF save.
