-- 009_search_term_conditions.sql
-- Add structured condition columns to search_terms

ALTER TABLE search_terms ADD COLUMN location    TEXT;
ALTER TABLE search_terms ADD COLUMN seniority   TEXT
  CHECK(seniority IN ('intern', 'junior', 'mid', 'senior', 'staff'));
ALTER TABLE search_terms ADD COLUMN remote      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE search_terms ADD COLUMN recency     TEXT
  CHECK(recency IN ('day', 'week', 'month'));
ALTER TABLE search_terms ADD COLUMN max_results INTEGER;
