-- PATCH: Athlete training view mode preference
-- Run this in Supabase SQL editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS view_mode text NOT NULL DEFAULT 'simple';

-- Optional: constrain to valid values
-- ALTER TABLE profiles ADD CONSTRAINT profiles_view_mode_check
--   CHECK (view_mode IN ('simple', 'pro'));
