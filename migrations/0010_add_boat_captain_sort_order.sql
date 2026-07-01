ALTER TABLE boat_captains ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

UPDATE boat_captains
SET sort_order = (
  SELECT COUNT(*)
  FROM boat_captains bc2
  WHERE bc2.boat_id = boat_captains.boat_id
    AND bc2.status = 'approved'
    AND (
      lower(bc2.captain_id) <= lower(boat_captains.captain_id)
    )
) - 1
WHERE status = 'approved';
