-- Add structured salary range and company rating columns to job_postings.
-- All columns are nullable; existing rows (LinkedIn, Indeed, Mock) receive NULLs.
-- Glassdoor adapter populates salary_min/salary_max and optionally company_rating.

ALTER TABLE job_postings ADD COLUMN salary_min INTEGER;    -- annual USD, e.g. 80000
ALTER TABLE job_postings ADD COLUMN salary_max INTEGER;    -- annual USD, e.g. 120000
ALTER TABLE job_postings ADD COLUMN company_rating REAL;   -- 1.0–5.0 Glassdoor star rating
