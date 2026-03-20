-- PATCH 1: Payments table for coach payment history
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id            uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  athlete_id          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  stripe_payment_intent_id text,
  amount_cents        integer NOT NULL DEFAULT 0,   -- gross charge in cents
  fee_cents           integer NOT NULL DEFAULT 0,   -- Kratos platform fee
  coach_payout_cents  integer NOT NULL DEFAULT 0,   -- net to coach (amount - fee)
  status              text NOT NULL DEFAULT 'pending', -- pending | succeeded | failed | refunded
  description         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Index for fast coach queries
CREATE INDEX IF NOT EXISTS payments_coach_id_idx ON payments(coach_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_athlete_id_idx ON payments(athlete_id);

-- RLS: coaches can only read their own payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches read own payments"
  ON payments FOR SELECT
  USING (coach_id = auth.uid());

-- Service role can insert/update (called from Worker)
CREATE POLICY "Service can manage payments"
  ON payments FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
