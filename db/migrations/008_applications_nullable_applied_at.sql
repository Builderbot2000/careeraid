-- 008_applications_nullable_applied_at.sql
-- Drop NOT NULL constraint on applied_at: tailoring a resume does not imply applying.
-- SQLite cannot ALTER COLUMN, so we recreate the table preserving all data.

CREATE TABLE applications_new (
  id              TEXT PRIMARY KEY,
  posting_id      TEXT,
  tex_path        TEXT NOT NULL,
  resume_json     TEXT NOT NULL,
  schema_version  INTEGER NOT NULL DEFAULT 1,
  applied_at      TEXT,
  notes           TEXT
);

INSERT INTO applications_new SELECT id, posting_id, tex_path, resume_json, schema_version, applied_at, notes FROM applications;

DROP TABLE applications;

ALTER TABLE applications_new RENAME TO applications;
