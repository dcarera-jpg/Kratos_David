-- ============================================================
-- Progress Photos — Kratos
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/tzkokgpxqjeyuvyvmqtt/sql/new
-- ============================================================

-- 1. Table
CREATE TABLE IF NOT EXISTS public.progress_photos (
  id          bigserial primary key,
  athlete_id  uuid not null references public.profiles(id) on delete cascade,
  coach_id    uuid references public.profiles(id),
  position    text not null check (position in ('front','back','left','right')),
  photo_url   text not null,   -- storage path, NOT a public URL
  thumb_url   text,            -- storage path for thumbnail
  taken_at    date not null default current_date,
  notes       text,
  ai_analysis text,
  weight_kg   numeric(5,2),
  created_at  timestamptz default now()
);

-- 2. RLS
alter table public.progress_photos enable row level security;

create policy "athlete sees own photos" on public.progress_photos
  for select using (athlete_id = auth.uid());

create policy "coach sees athlete photos" on public.progress_photos
  for select using (
    exists (
      select 1 from public.profiles
      where id = progress_photos.athlete_id
      and coach_id = auth.uid()
    )
  );

create policy "athlete manages own photos" on public.progress_photos
  for all using (athlete_id = auth.uid());

-- 3. Index for fast athlete queries
create index if not exists idx_progress_photos_athlete_date
  on public.progress_photos(athlete_id, taken_at desc);

-- ============================================================
-- STORAGE BUCKET — run AFTER the SQL above
-- Go to: Storage > New Bucket in the Supabase dashboard
-- https://supabase.com/dashboard/project/tzkokgpxqjeyuvyvmqtt/storage/buckets
--
-- Name:        progress-photos
-- Public:      OFF  (private bucket)
-- File limit:  10 MB
-- MIME types:  image/jpeg, image/png, image/webp
--
-- Then add these policies under Storage > Policies:
--
-- Policy 1 — Athletes can upload their own photos
--   Operation: INSERT
--   Expression:
--     (bucket_id = 'progress-photos')
--     AND (auth.uid()::text = (string_to_array(name, '/'))[1])
--
-- Policy 2 — Athletes and coaches can view photos
--   Operation: SELECT
--   Expression:
--     (bucket_id = 'progress-photos')
--     AND (
--       auth.uid()::text = (string_to_array(name, '/'))[1]
--       OR exists (
--         select 1 from public.profiles
--         where id::text = (string_to_array(name, '/'))[1]
--         and coach_id = auth.uid()
--       )
--     )
--
-- Policy 3 — Athletes can delete their own photos
--   Operation: DELETE
--   Expression:
--     (bucket_id = 'progress-photos')
--     AND (auth.uid()::text = (string_to_array(name, '/'))[1])
-- ============================================================
