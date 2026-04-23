-- schema.sql — Human-readable schema reference
-- Source of truth is the migration files in db/migrations/
-- This file is updated manually to reflect the current full schema.

-- Migration tracking (internal)
CREATE TABLE IF NOT EXISTS _migrations (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  filename  TEXT    NOT NULL UNIQUE,
  run_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Phase 1 ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
  id                           INTEGER PRIMARY KEY CHECK(id = 1),
  tex_binary_path              TEXT,
  pdf_export_path              TEXT,
  crawl_delay_ms               INTEGER NOT NULL DEFAULT 3000,
  posting_retention_days       INTEGER NOT NULL DEFAULT 14,
  profile_entry_word_limit     INTEGER NOT NULL DEFAULT 200,
  log_retention_days           INTEGER NOT NULL DEFAULT 30,
  parse_error_abort_threshold  INTEGER NOT NULL DEFAULT 5,
  affinity_token_budget        INTEGER NOT NULL DEFAULT 80000,
  log_level                    TEXT NOT NULL DEFAULT 'info'
    CHECK(log_level IN ('error', 'warn', 'info', 'debug'))
);

-- ─── Phase 2 ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_profile (
  id   INTEGER PRIMARY KEY CHECK(id = 1),
  yoe  INTEGER
);

CREATE TABLE IF NOT EXISTS profile_entries (
  id          TEXT PRIMARY KEY,  -- UUID
  type        TEXT NOT NULL
    CHECK(type IN ('experience','credential','accomplishment','skill','education')),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  tags        TEXT NOT NULL DEFAULT '[]',  -- JSON array
  start_date  TEXT,
  end_date    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Phase 3 ─────────────────────────────────────────────────────────────────

-- CREATE TABLE IF NOT EXISTS applications (
--   id              TEXT PRIMARY KEY,  -- UUID
--   posting_id      TEXT REFERENCES job_postings(id),
--   tex_path        TEXT NOT NULL,
--   resume_json     TEXT NOT NULL,     -- JSON snapshot for recompile
--   schema_version  INTEGER NOT NULL,
--   applied_at      TEXT NOT NULL,
--   notes           TEXT
-- );

-- ─── Phase 4 ─────────────────────────────────────────────────────────────────

-- CREATE TABLE IF NOT EXISTS search_config ( ... );
-- CREATE TABLE IF NOT EXISTS search_terms ( ... );
-- CREATE TABLE IF NOT EXISTS ban_list ( ... );
-- CREATE TABLE IF NOT EXISTS job_postings ( ... );

-- ─── Phase 6 ─────────────────────────────────────────────────────────────────

-- CREATE TABLE IF NOT EXISTS llm_usage ( ... );
