-- 010_search_terms_drop_adapter_id.sql
-- Search terms are now adapter-global; each adapter receives all enabled terms
-- and maps conditions to its own query syntax.

ALTER TABLE search_terms DROP COLUMN adapter_id;
