-- PATCH: Athlete Trial & Pilot access
-- Run this in Supabase SQL editor

-- Add trial and pilot columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at  timestamptz,
  ADD COLUMN IF NOT EXISTS is_pilot       boolean NOT NULL DEFAULT false;

-- Index for quick expiry checks
CREATE INDEX IF NOT EXISTS profiles_trial_ends_idx
  ON profiles(trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;

-- RLS: athletes can read their own trial/pilot status (already covered by existing SELECT policy)
-- Coaches can update trial/pilot for athletes they own
-- (service_role used by coach actions via client with coach's session — coach_id check handles auth)
