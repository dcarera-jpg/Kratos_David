-- PATCH 3: Athlete Premium Tier
-- Run this in Supabase SQL editor

-- Athlete premium subscriptions table
CREATE TABLE IF NOT EXISTS athlete_subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id              uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan                    text NOT NULL DEFAULT 'premium', -- 'premium'
  status                  text NOT NULL DEFAULT 'pending', -- pending | active | canceled | past_due
  stripe_subscription_id  text,
  stripe_customer_id      text,
  amount_cents            integer DEFAULT 999,  -- $9.99
  current_period_end      timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE(athlete_id, plan)
);

CREATE INDEX IF NOT EXISTS athlete_sub_athlete_idx ON athlete_subscriptions(athlete_id);
CREATE INDEX IF NOT EXISTS athlete_sub_stripe_idx  ON athlete_subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

ALTER TABLE athlete_subscriptions ENABLE ROW LEVEL SECURITY;

-- Athletes can read their own subscriptions
CREATE POLICY "Athletes read own sub"
  ON athlete_subscriptions FOR SELECT
  USING (athlete_id = auth.uid());

-- Service role can manage all
CREATE POLICY "Service manages athlete subs"
  ON athlete_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- Body measurements table (Premium feature)
CREATE TABLE IF NOT EXISTS body_measurements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  weight_kg    numeric(5,2),
  body_fat_pct numeric(4,1),
  waist_cm     numeric(5,1),
  arm_cm       numeric(5,1),
  chest_cm     numeric(5,1),
  hip_cm       numeric(5,1),
  thigh_cm     numeric(5,1),
  measured_at  date NOT NULL DEFAULT CURRENT_DATE,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS body_meas_athlete_idx ON body_measurements(athlete_id, measured_at DESC);

ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes manage own measurements"
  ON body_measurements FOR ALL
  USING (athlete_id = auth.uid());

CREATE POLICY "Service manages measurements"
  ON body_measurements FOR ALL
  USING (auth.role() = 'service_role');
