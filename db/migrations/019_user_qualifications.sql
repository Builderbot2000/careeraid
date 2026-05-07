-- 019_user_qualifications.sql
-- Add structured ground-truth qualifications to user_profile

ALTER TABLE user_profile ADD COLUMN yoe_industry   TEXT;
ALTER TABLE user_profile ADD COLUMN languages       TEXT;   -- JSON array of strings
ALTER TABLE user_profile ADD COLUMN citizenship     TEXT;
ALTER TABLE user_profile ADD COLUMN drivers_license INTEGER NOT NULL DEFAULT 0;
