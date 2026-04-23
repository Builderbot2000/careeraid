-- 003_resume.sql
-- Phase 3: applications table

CREATE TABLE IF NOT EXISTS applications (
  id              TEXT PRIMARY KEY,  -- UUID
  posting_id      TEXT,              -- FK → job_postings.id (table created in Phase 4)
  tex_path        TEXT NOT NULL,     -- Relative: resumes/<id>/resume.tex
  resume_json     TEXT NOT NULL,     -- JSON snapshot for recompile-from-snapshot
  schema_version  INTEGER NOT NULL DEFAULT 1,
  applied_at      TEXT NOT NULL,
  notes           TEXT
);
