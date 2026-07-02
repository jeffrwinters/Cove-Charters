CREATE TABLE IF NOT EXISTS accounting_records (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  trip_id TEXT,
  settlement_id TEXT NOT NULL,
  party_type TEXT NOT NULL,
  party_id TEXT,
  direction TEXT NOT NULL,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft',
  source TEXT NOT NULL DEFAULT 'settlement_calculation',
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (trip_id) REFERENCES trips(id),
  FOREIGN KEY (settlement_id) REFERENCES settlements(id)
);

CREATE INDEX IF NOT EXISTS idx_accounting_records_booking ON accounting_records(booking_id);
CREATE INDEX IF NOT EXISTS idx_accounting_records_settlement ON accounting_records(settlement_id);
CREATE INDEX IF NOT EXISTS idx_accounting_records_party ON accounting_records(party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_accounting_records_category ON accounting_records(category);
CREATE INDEX IF NOT EXISTS idx_accounting_records_status ON accounting_records(status);
