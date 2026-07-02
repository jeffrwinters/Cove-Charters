ALTER TABLE payments ADD COLUMN provider TEXT NOT NULL DEFAULT 'stripe';
ALTER TABLE payments ADD COLUMN provider_session_id TEXT;
ALTER TABLE payments ADD COLUMN provider_payment_intent_id TEXT;
ALTER TABLE payments ADD COLUMN purpose TEXT NOT NULL DEFAULT 'custom';
ALTER TABLE payments ADD COLUMN currency TEXT NOT NULL DEFAULT 'usd';
ALTER TABLE payments ADD COLUMN checkout_url TEXT;
ALTER TABLE payments ADD COLUMN metadata_json TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_settlement ON payments(settlement_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_session ON payments(provider, provider_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

