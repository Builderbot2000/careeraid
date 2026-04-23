-- 002_profile.sql
-- Phase 2: user_profile + profile_entries tables

CREATE TABLE IF NOT EXISTS user_profile (
  id   INTEGER PRIMARY KEY CHECK(id = 1),
  yoe  INTEGER
);

INSERT OR IGNORE INTO user_profile (id) VALUES (1);

CREATE TABLE IF NOT EXISTS profile_entries (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL
    CHECK(type IN ('experience','credential','accomplishment','skill','education')),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  tags        TEXT NOT NULL DEFAULT '[]',
  start_date  TEXT,
  end_date    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
