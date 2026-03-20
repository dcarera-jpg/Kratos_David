-- PATCH 2: Plan B Billing — coach subscription columns
-- Run this in Supabase SQL editor

-- Add subscription columns to coach_profiles
ALTER TABLE coach_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id          text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id      text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status  text DEFAULT 'none';
  -- stripe_subscription_status: none | active | trialing | past_due | canceled

-- Index for webhook lookups
CREATE INDEX IF NOT EXISTS coach_profiles_stripe_sub_idx
  ON coach_profiles(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Verify coach_profiles has kratos_plan column (should already exist)
ALTER TABLE coach_profiles
  ADD COLUMN IF NOT EXISTS kratos_plan text NOT NULL DEFAULT 'A';
  -- 'A' = Free + 8% commission
  -- 'B' = $49/mo + 3% commission
