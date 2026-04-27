-- Replace single-value location/seniority/remote with JSON array columns
-- for multiselect support in the search term conditions form.

ALTER TABLE search_terms ADD COLUMN locations TEXT;    -- JSON array of city/region strings
ALTER TABLE search_terms ADD COLUMN seniorities TEXT;  -- JSON array of SearchTermSeniority values
ALTER TABLE search_terms ADD COLUMN work_type TEXT;    -- JSON array of 'remote'|'hybrid'|'onsite'

-- Migrate existing rows
UPDATE search_terms SET locations   = json_array(location)  WHERE location  IS NOT NULL;
UPDATE search_terms SET seniorities = json_array(seniority) WHERE seniority IS NOT NULL;
-- remote = 1 → ['remote'];  remote = 0 → NULL (no preference)
UPDATE search_terms SET work_type   = json_array('remote')  WHERE remote    = 1;

-- Remove old single-value columns
ALTER TABLE search_terms DROP COLUMN location;
ALTER TABLE search_terms DROP COLUMN seniority;
ALTER TABLE search_terms DROP COLUMN remote;
