ALTER TABLE boats ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

UPDATE boats
SET sort_order = (
  SELECT COUNT(*)
  FROM boats b2
  WHERE b2.featured > boats.featured
     OR (b2.featured = boats.featured AND lower(b2.name) <= lower(boats.name))
) - 1;
