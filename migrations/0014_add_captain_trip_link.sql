ALTER TABLE bookings ADD COLUMN captain_trip_token TEXT;
ALTER TABLE bookings ADD COLUMN captain_trip_url TEXT;
ALTER TABLE bookings ADD COLUMN captain_trip_sent_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_captain_trip_token ON bookings(captain_trip_token);
