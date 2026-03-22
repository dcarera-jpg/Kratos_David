-- ElevenLabs voice cloning: add voice ID column to coach_profiles
-- Run in Supabase SQL Editor

ALTER TABLE coach_profiles
  ADD COLUMN IF NOT EXISTS elevenlabs_voice_id text;
