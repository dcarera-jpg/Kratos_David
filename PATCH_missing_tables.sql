-- PATCH: Create missing tables (athlete_subscriptions, body_measurements)
-- Run this in Supabase SQL editor

-- ── athlete_subscriptions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS athlete_subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id              uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan                    text NOT NULL DEFAULT 'premium',   -- 'premium'
  status                  text NOT NULL DEFAULT 'active',    -- 'active' | 'trialing' | 'canceled' | 'past_due'
  stripe_subscription_id  text,
  stripe_customer_id      text,
  current_period_end      timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Index for fast per-athlete lookups
CREATE INDEX IF NOT EXISTS athlete_subscriptions_athlete_id_idx
  ON athlete_subscriptions(athlete_id);

-- Enable RLS
ALTER TABLE athlete_subscriptions ENABLE ROW LEVEL SECURITY;

-- Athletes can only read their own subscription
CREATE POLICY IF NOT EXISTS "athlete_subscriptions_select"
  ON athlete_subscriptions FOR SELECT
  USING (athlete_id = auth.uid());

-- Service role (Cloudflare Worker via SUPABASE_SK) handles insert/update
CREATE POLICY IF NOT EXISTS "athlete_subscriptions_service_write"
  ON athlete_subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);


-- ── body_measurements ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS body_measurements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  weight_kg     numeric(5,2),
  body_fat_pct  numeric(4,1),
  waist_cm      numeric(5,1),
  arm_cm        numeric(5,1),
  measured_at   date NOT NULL DEFAULT CURRENT_DATE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS body_measurements_athlete_id_idx
  ON body_measurements(athlete_id);

ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

-- Athletes can read/write their own measurements
CREATE POLICY IF NOT EXISTS "body_measurements_own"
  ON body_measurements FOR ALL
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());


-- ── Update view_mode default from 'simple' to 'pro' ───────────────────────
ALTER TABLE profiles
  ALTER COLUMN view_mode SET DEFAULT 'pro';

-- Backfill existing rows that still have the old default
UPDATE profiles SET view_mode = 'pro' WHERE view_mode = 'simple';
