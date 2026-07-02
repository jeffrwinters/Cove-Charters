-- Cove D1 schema v1
-- Designed around the charter workflow: booking -> trip -> settlement.

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'string',
  description TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  payout_notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS boats (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  lifecycle_status TEXT DEFAULT 'draft',
  booking_enabled INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  home_port TEXT,
  length_ft REAL,
  capacity INTEGER,
  bedrooms INTEGER DEFAULT 0,
  bathrooms INTEGER DEFAULT 0,
  make TEXT,
  model TEXT,
  model_year INTEGER,
  boat_type TEXT,
  short_description TEXT,
  source_listing_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES owners(id)
);

CREATE TABLE IF NOT EXISTS boat_pricing (
  id TEXT PRIMARY KEY,
  boat_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  duration_hours REAL NOT NULL,
  base_fee REAL NOT NULL DEFAULT 0,
  cleaning_fee REAL NOT NULL DEFAULT 75,
  fuel_deposit REAL NOT NULL DEFAULT 500,
  tax_rate REAL NOT NULL DEFAULT 0.08225,
  captain_hourly_rate REAL NOT NULL DEFAULT 125,
  owner_split REAL NOT NULL DEFAULT 0.85,
  cove_split REAL NOT NULL DEFAULT 0.15,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (boat_id) REFERENCES boats(id)
);

CREATE TABLE IF NOT EXISTS captains (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  credential TEXT,
  email TEXT,
  phone TEXT,
  bio TEXT,
  home_port TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS boat_captains (
  boat_id TEXT NOT NULL,
  captain_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved',
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (boat_id, captain_id),
  FOREIGN KEY (boat_id) REFERENCES boats(id),
  FOREIGN KEY (captain_id) REFERENCES captains(id)
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  favorite_boat TEXT,
  favorite_captain TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  boat_id TEXT NOT NULL,
  captain_id TEXT,
  pricing_id TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  paid_status TEXT NOT NULL DEFAULT 'unpaid',
  charter_date TEXT,
  start_time TEXT,
  duration_hours REAL,
  base_fee REAL NOT NULL DEFAULT 0,
  cleaning_fee REAL NOT NULL DEFAULT 0,
  fuel_deposit REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0.08225,
  mileage_rate REAL NOT NULL DEFAULT 14,
  tax_amount REAL NOT NULL DEFAULT 0,
  total_collected REAL NOT NULL DEFAULT 0,
  office_notes TEXT,
  agreement_status TEXT NOT NULL DEFAULT 'not started',
  agreement_sent_at TEXT,
  agreement_signed_at TEXT,
  signing_url TEXT,
  signing_token TEXT,
  signing_completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (boat_id) REFERENCES boats(id),
  FOREIGN KEY (captain_id) REFERENCES captains(id),
  FOREIGN KEY (pricing_id) REFERENCES boat_pricing(id)
);

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

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'open',
  start_miles REAL,
  end_miles REAL,
  billable_miles REAL,
  mileage_rate REAL NOT NULL DEFAULT 14,
  mileage_charge REAL NOT NULL DEFAULT 0,
  fuel_paid_by TEXT,
  fuel_amount REAL NOT NULL DEFAULT 0,
  cleaning_fee_charged INTEGER NOT NULL DEFAULT 0,
  damage_reported INTEGER NOT NULL DEFAULT 0,
  damage_notes TEXT,
  captain_notes TEXT,
  office_notes TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  trip_id TEXT,
  captain_pay REAL NOT NULL DEFAULT 0,
  owner_payout REAL NOT NULL DEFAULT 0,
  cove_commission REAL NOT NULL DEFAULT 0,
  cleaning_fee REAL NOT NULL DEFAULT 0,
  tax_collected REAL NOT NULL DEFAULT 0,
  fuel_deposit REAL NOT NULL DEFAULT 0,
  fuel_deposit_refund REAL NOT NULL DEFAULT 0,
  mileage_charge REAL NOT NULL DEFAULT 0,
  additional_charges REAL NOT NULL DEFAULT 0,
  owner_paid_status TEXT NOT NULL DEFAULT 'unpaid',
  captain_paid_status TEXT NOT NULL DEFAULT 'unpaid',
  customer_paid_status TEXT NOT NULL DEFAULT 'unpaid',
  office_status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (trip_id) REFERENCES trips(id)
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  media_type TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  alt TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_cover INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS availability (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  signed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  booking_id TEXT,
  settlement_id TEXT,
  payer_type TEXT,
  payer_id TEXT,
  payee_type TEXT,
  payee_id TEXT,
  amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  method TEXT,
  external_reference TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (settlement_id) REFERENCES settlements(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_boats_status ON boats(status);
CREATE INDEX IF NOT EXISTS idx_boat_pricing_boat ON boat_pricing(boat_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(charter_date);
CREATE INDEX IF NOT EXISTS idx_bookings_boat ON bookings(boat_id);
CREATE INDEX IF NOT EXISTS idx_booking_documents_booking ON booking_documents(booking_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_signing_token ON bookings(signing_token);
CREATE INDEX IF NOT EXISTS idx_booking_signatures_booking ON booking_signatures(booking_id);
CREATE INDEX IF NOT EXISTS idx_trips_booking ON trips(booking_id);
CREATE INDEX IF NOT EXISTS idx_settlements_booking ON settlements(booking_id);
CREATE INDEX IF NOT EXISTS idx_media_entity ON media(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_availability_entity ON availability(entity_type, entity_id, start_at, end_at);

INSERT OR IGNORE INTO settings (key, value, value_type, description) VALUES
  ('mileage_rate', '14', 'number', 'Default billable mileage rate per mile. Snapshot onto bookings/trips.'),
  ('sales_tax_rate', '0.08225', 'number', 'Default Missouri sales tax rate used in current spreadsheet.'),
  ('cleaning_fee', '75', 'number', 'Default cleaning fee.'),
  ('fuel_deposit', '500', 'number', 'Default fuel deposit collected at booking.'),
  ('captain_hourly_rate', '125', 'number', 'Default captain/first mate hourly payout rate.'),
  ('owner_split', '0.85', 'number', 'Default owner share after captain pay.'),
  ('cove_split', '0.15', 'number', 'Default Cove share after captain pay.');
