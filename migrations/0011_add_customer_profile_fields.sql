ALTER TABLE customers ADD COLUMN status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE customers ADD COLUMN favorite_boat TEXT;
ALTER TABLE customers ADD COLUMN favorite_captain TEXT;

UPDATE customers
SET status = 'repeat'
WHERE id IN (
  SELECT customer_id
  FROM bookings
  WHERE customer_id IS NOT NULL
  GROUP BY customer_id
  HAVING COUNT(*) > 1
);
