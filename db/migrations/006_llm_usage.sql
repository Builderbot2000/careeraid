-- 006_llm_usage.sql
-- Phase 6: LLM call log for cost tracking and analytics

CREATE TABLE IF NOT EXISTS llm_usage (
  id              TEXT PRIMARY KEY,  -- UUID
  call_type       TEXT NOT NULL
    CHECK(call_type IN ('search_term_gen', 'affinity_scoring', 'resume_tailoring')),
  model           TEXT NOT NULL,
  input_tokens    INTEGER NOT NULL,
  output_tokens   INTEGER NOT NULL,
  estimated_cost  REAL NOT NULL,
  called_at       TEXT NOT NULL DEFAULT (datetime('now')),
  posting_id      TEXT  -- FK → job_postings.id; NULL for search_term_gen
);
