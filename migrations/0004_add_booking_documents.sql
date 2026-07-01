ALTER TABLE bookings ADD COLUMN agreement_status TEXT NOT NULL DEFAULT 'not started';
ALTER TABLE bookings ADD COLUMN agreement_sent_at TEXT;
ALTER TABLE bookings ADD COLUMN agreement_signed_at TEXT;
ALTER TABLE bookings ADD COLUMN signing_url TEXT;

CREATE TABLE IF NOT EXISTS booking_documents (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'agreement',
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  filename TEXT,
  content_type TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  audience TEXT NOT NULL DEFAULT 'office',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

CREATE INDEX IF NOT EXISTS idx_booking_documents_booking ON booking_documents(booking_id);
