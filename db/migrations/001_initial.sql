-- 001_initial.sql
-- Phase 1: settings table

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

-- Seed the single settings row
INSERT OR IGNORE INTO settings (id) VALUES (1);
