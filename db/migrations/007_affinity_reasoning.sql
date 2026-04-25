-- 007_affinity_reasoning.sql
-- Add affinity_reasoning column to store Claude's one-sentence explanation

ALTER TABLE job_postings ADD COLUMN affinity_reasoning TEXT;
