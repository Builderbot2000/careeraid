-- 016_affinity_classes.sql
-- Add per-dimension qualification class columns and reset existing affinity data
-- so all postings are rescored with the new scheme.

ALTER TABLE job_postings ADD COLUMN hard_reqs_class TEXT
  CHECK(hard_reqs_class IN ('overqualified','fully_qualified','minimally_qualified','underqualified'));

ALTER TABLE job_postings ADD COLUMN nice_to_haves_class TEXT
  CHECK(nice_to_haves_class IN ('fully_met','partially_met','not_met'));

-- Reset all existing scores — old scores used the broken batch scorer
-- (max_tokens truncation) and are not comparable to the new formula.
UPDATE job_postings SET
  affinity_score      = NULL,
  affinity_skipped    = 0,
  affinity_scored_at  = NULL,
  affinity_reasoning  = NULL,
  hard_reqs_class     = NULL,
  nice_to_haves_class = NULL;
