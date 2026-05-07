-- Reset quals columns to new JSON array formats
-- yoe_industry: was TEXT (string|null), now JSON string[]
-- languages:    was JSON string[], now JSON {name,proficiency}[]
-- citizenship:  was TEXT (string|null), now JSON {country,status}[]
UPDATE user_profile SET yoe_industry = '[]', languages = '[]', citizenship = '[]';
