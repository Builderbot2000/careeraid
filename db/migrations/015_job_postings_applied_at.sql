-- 015_job_postings_applied_at.sql
-- Adds applied_at column to job_postings so the tracker can display the date
-- the user explicitly set status to applied (without requiring a resume/application record).

ALTER TABLE job_postings ADD COLUMN applied_at TEXT;
