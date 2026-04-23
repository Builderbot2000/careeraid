-- 004_jobs.sql
-- Phase 4: search_config, search_terms, ban_list, job_postings

CREATE TABLE IF NOT EXISTS search_config (
  id                      INTEGER PRIMARY KEY CHECK(id = 1),
  intent                  TEXT,
  term_generation_hash    TEXT,
  ranking_weights         TEXT NOT NULL DEFAULT '{}',
  affinity_skip_threshold INTEGER NOT NULL DEFAULT 15,
  excluded_stack          TEXT NOT NULL DEFAULT '[]',
  required_keywords       TEXT NOT NULL DEFAULT '[]',
  excluded_keywords       TEXT NOT NULL DEFAULT '[]',
  keyword_match_fields    TEXT NOT NULL DEFAULT '["title","tech_stack"]'
);

INSERT OR IGNORE INTO search_config (id) VALUES (1);

CREATE TABLE IF NOT EXISTS search_terms (
  id          TEXT PRIMARY KEY,  -- UUID
  adapter_id  TEXT NOT NULL,
  term        TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  source      TEXT NOT NULL CHECK(source IN ('llm_generated', 'user_added')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ban_list (
  id          TEXT PRIMARY KEY,  -- UUID
  type        TEXT NOT NULL CHECK(type IN ('company', 'domain')),
  value       TEXT NOT NULL,
  reason      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS job_postings (
  id                  TEXT PRIMARY KEY,  -- UUID
  source              TEXT NOT NULL,
  url                 TEXT NOT NULL,
  resolved_domain     TEXT,
  title               TEXT NOT NULL,
  company             TEXT NOT NULL,
  location            TEXT NOT NULL DEFAULT '',
  yoe_min             INTEGER,
  yoe_max             INTEGER,
  seniority           TEXT NOT NULL DEFAULT 'any'
    CHECK(seniority IN ('intern', 'junior', 'mid', 'senior', 'staff', 'any')),
  tech_stack          TEXT NOT NULL DEFAULT '[]',  -- JSON array
  posted_at           TEXT,
  applicant_count     INTEGER,
  raw_text            TEXT,
  fetched_at          TEXT NOT NULL,
  scraper_mod_version TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'new'
    CHECK(status IN ('new', 'viewed', 'favorited', 'applied', 'interviewing', 'offer', 'rejected', 'ghosted')),
  affinity_score      REAL,
  affinity_skipped    INTEGER NOT NULL DEFAULT 0,
  affinity_scored_at  TEXT,
  first_response_at   TEXT,
  last_seen_at        TEXT NOT NULL
);
