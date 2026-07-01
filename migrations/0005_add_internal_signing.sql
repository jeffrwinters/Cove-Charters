ALTER TABLE bookings ADD COLUMN signing_token TEXT;
ALTER TABLE bookings ADD COLUMN signing_completed_at TEXT;

CREATE TABLE IF NOT EXISTS booking_signatures (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  signer_name TEXT NOT NULL,
  signer_email TEXT,
  signer_ip TEXT,
  user_agent TEXT,
  accepted_json TEXT NOT NULL,
  signature_text TEXT NOT NULL,
  signed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_signing_token ON bookings(signing_token);
CREATE INDEX IF NOT EXISTS idx_booking_signatures_booking ON booking_signatures(booking_id);
