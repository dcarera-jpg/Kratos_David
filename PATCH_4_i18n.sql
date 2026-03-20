-- PATCH 4: Multilingual support — add preferred_language to profiles
-- Run this in Supabase SQL editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'en';
  -- Allowed values: 'en' | 'it' | 'es'

-- Optional: add a check constraint
ALTER TABLE profiles
  ADD CONSTRAINT IF NOT EXISTS profiles_lang_check
    CHECK (preferred_language IN ('en', 'it', 'es'));
