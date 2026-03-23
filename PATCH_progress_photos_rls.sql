-- Fix: add WITH CHECK to the INSERT/ALL policy
-- The original policy used only USING which doesn't cover INSERT in Supabase
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/tzkokgpxqjeyuvyvmqtt/sql/new

DROP POLICY IF EXISTS "athlete manages own photos" ON public.progress_photos;

CREATE POLICY "athlete manages own photos" ON public.progress_photos
  FOR ALL
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());
