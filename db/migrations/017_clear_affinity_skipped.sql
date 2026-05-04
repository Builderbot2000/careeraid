-- Reset any postings previously skipped due to the small-batch threshold so they
-- get re-scored on next run now that the threshold feature is removed.
UPDATE job_postings SET affinity_skipped = 0 WHERE affinity_skipped = 1;
