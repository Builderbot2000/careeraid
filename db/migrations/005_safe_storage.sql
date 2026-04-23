-- 005_safe_storage.sql
-- Phase 5: add encrypted_api_key column to settings for safeStorage-based key persistence

ALTER TABLE settings ADD COLUMN encrypted_api_key TEXT;
