-- ═══════════════════════════════════════════════════════════════
-- KRATOS v4 — SCHEMA COMPLETO
-- Esegui TUTTO in Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── PULIZIA (se stai aggiornando da v3) ─────────────────────
drop table if exists public.week_days         cascade;
drop table if exists public.week_templates    cascade;
drop table if exists public.blocks            cascade;
drop table if exists public.session_exercises cascade;
drop table if exists public.sessions          cascade;
drop table if exists public.exercises         cascade;
drop table if exists public.logbook           cascade;
drop table if exists public.messages          cascade;
drop table if exists public.training_programs cascade;
drop table if exists public.athlete_weeks     cascade;

-- ─── EXERCISES — Libreria esercizi ───────────────────────────
create table public.exercises (
  id          bigserial primary key,
  name        text not null,
  tag         text default 'mec' check (tag in ('mec','met','pre','str')),
  tag_label   text default 'Meccanico',
  notes       text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz default now()
);

-- ─── SESSIONS — Sessioni di allenamento ──────────────────────
-- Una sessione è un template (es. "Petto+Tricipiti")
-- Gli esercizi dentro possono variare per settimana tramite overrides
create table public.sessions (
  id           bigserial primary key,
  name         text not null,
  session_type text default 'gym' check (session_type in ('gym','bike','rest')),
  created_by   uuid references public.profiles(id),
  created_at   timestamptz default now()
);

-- ─── SESSION_EXERCISES — Esercizi base di una sessione ───────
create table public.session_exercises (
  id          bigserial primary key,
  session_id  bigint references public.sessions(id) on delete cascade,
  exercise_id bigint references public.exercises(id) on delete cascade,
  sort_order  integer default 0,
  sets        text default '3',
  reps        text default '8-10',
  rest_sec    integer default 120,
  notes       text,
  created_at  timestamptz default now()
);

-- ─── BLOCKS — Blocchi del programma ──────────────────────────
create table public.blocks (
  id          bigserial primary key,
  name        text not null,
  description text,
  sort_order  integer default 0,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz default now()
);

-- ─── WEEK_TEMPLATES — Settimane tipo dentro un blocco ────────
create table public.week_templates (
  id          bigserial primary key,
  block_id    bigint references public.blocks(id) on delete cascade,
  name        text not null,           -- es. "Settimana Blast", "Deload"
  week_type   text default 'blast' check (week_type in ('blast','deload','taper','test')),
  sort_order  integer default 0,
  notes       text,
  created_at  timestamptz default now()
);

-- ─── WEEK_DAYS — Giorni della settimana tipo ─────────────────
create table public.week_days (
  id               bigserial primary key,
  week_template_id bigint references public.week_templates(id) on delete cascade,
  day_of_week      integer not null check (day_of_week between 1 and 7), -- 1=Lun, 7=Dom
  session_id       bigint references public.sessions(id) on delete set null,
  -- Override esercizi per questa settimana (JSON array of session_exercise ids + overrides)
  exercise_overrides jsonb default '[]',
  notes            text,
  created_at       timestamptz default now(),
  unique(week_template_id, day_of_week)
);

-- ─── ATHLETE_PROGRAM — Programmazione per atleta ─────────────
-- Traccia a quale blocco/settimana è l'atleta
alter table public.profiles
  add column if not exists current_block_id    bigint references public.blocks(id),
  add column if not exists current_week_id     bigint references public.week_templates(id),
  add column if not exists program_start_date  date,
  add column if not exists training_notes      text;

-- ─── LOGBOOK — Registro allenamenti ──────────────────────────
create table public.logbook (
  id                   bigserial primary key,
  athlete_id           uuid references public.profiles(id) on delete cascade,
  session_exercise_id  bigint references public.session_exercises(id) on delete cascade,
  week_template_id     bigint references public.week_templates(id),
  logged_date          date not null default current_date,
  set1_kg              numeric,
  set1_reps            integer,
  set2_kg              numeric,
  set2_reps            integer,
  set3_kg              numeric,
  set3_reps            integer,
  done                 boolean default false,
  notes                text,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  unique(athlete_id, session_exercise_id, week_template_id, logged_date)
);

-- ─── MESSAGES ─────────────────────────────────────────────────
create table public.messages (
  id          bigserial primary key,
  athlete_id  uuid references public.profiles(id),
  sender_id   uuid references public.profiles(id),
  sender_role text check (sender_role in ('admin','athlete')),
  text        text not null,
  created_at  timestamptz default now()
);

-- ─── RLS ──────────────────────────────────────────────────────
alter table public.exercises         enable row level security;
alter table public.sessions          enable row level security;
alter table public.session_exercises enable row level security;
alter table public.blocks            enable row level security;
alter table public.week_templates    enable row level security;
alter table public.week_days         enable row level security;
alter table public.logbook           enable row level security;
alter table public.messages          enable row level security;

-- Tutti gli autenticati leggono la struttura del programma
create policy "read_exercises"         on public.exercises         for select using (auth.role() = 'authenticated');
create policy "read_sessions"          on public.sessions          for select using (auth.role() = 'authenticated');
create policy "read_session_exercises" on public.session_exercises for select using (auth.role() = 'authenticated');
create policy "read_blocks"            on public.blocks            for select using (auth.role() = 'authenticated');
create policy "read_week_templates"    on public.week_templates    for select using (auth.role() = 'authenticated');
create policy "read_week_days"         on public.week_days         for select using (auth.role() = 'authenticated');

-- Solo admin scrive struttura programma
create policy "admin_write_exercises"         on public.exercises         for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "admin_write_sessions"          on public.sessions          for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "admin_write_session_exercises" on public.session_exercises for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "admin_write_blocks"            on public.blocks            for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "admin_write_week_templates"    on public.week_templates    for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "admin_write_week_days"         on public.week_days         for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Logbook: atleta vede/scrive il suo, admin vede tutti
create policy "logbook_athlete" on public.logbook for all using (athlete_id = auth.uid());
create policy "logbook_admin"   on public.logbook for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "logbook_admin_w" on public.logbook for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Messaggi
create policy "messages_own"   on public.messages for all using (athlete_id = auth.uid() or sender_id = auth.uid());
create policy "messages_admin" on public.messages for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ─── DATI INIZIALI — Esercizi Kratos ──────────────────────────
insert into public.exercises (name, tag, tag_label, notes) values
  ('Smith Incline Press',              'mec', 'Meccanico',     'Top set a cedimento. Scendi 2 sec, esplodi su. Backoff -20%.'),
  ('Distensioni Manubri 15-30 gradi',  'mec', 'Meccanico',     'Top set esplosivo. Non rimbalzare in basso. Backoff -20%.'),
  ('Machine Flyes 3sec squeeze',       'met', 'Metabolico',    '3 sec squeeze in chiusura. Pump puro. Carico leggero.'),
  ('Smith Super Incline Press 85°',    'mec', 'Meccanico',     'Inclinazione quasi verticale. Backoff: 5 sec eccentrica.'),
  ('Single Delts Muscle Round',        'mec', 'Meccanico',     '15RM. 6 cluster x 4 reps, 10 sec recupero. Un braccio.'),
  ('Cross Incline Laterals',           'met', 'Metabolico',    'Carichi diversi S1/S2/S3. Cedimento ogni set.'),
  ('Curl ai Cavi Alti',                'met', 'Metabolico',    'Squeeze in concentrica. Backoff -20%.'),
  ('Pulley Unilaterale Schiena',       'pre', 'Pre-Attivazione','Inclinato lateralmente. 1 sec squeeze.'),
  ('RDL Stacco Romeno',                'mec', 'Meccanico',     'Eccentrica 2-3 sec. Fino a metà tibia. Femorali in stretch.'),
  ('Stretchers al Pulley',             'mec', 'Meccanico',     'Backoff: Myo Reps. 12 - 10 sec - 5 x 3.'),
  ('Leg Curl Seduto Drop',             'pre', 'Pre-Affaticamento','S2: 12 - 20% - 12 - 20% - 12.'),
  ('Pressa',                           'mec', 'Meccanico',     'Backoff: max reps con 5 sec eccentrica.'),
  ('Smith Squat',                      'mec', 'Meccanico',     'S1 con elastici. S2 carico maggiore.'),
  ('Lat Machine Presa Larga',          'mec', 'Meccanico',     'Eccentrica controllata 3 sec.'),
  ('Rematore Bilanciere',              'mec', 'Meccanico',     'Busto parallelo al suolo. Gomiti larghi.'),
  ('Face Pull',                        'pre', 'Pre-Attivazione','Apertura esterna in fondo. 2 sec squeeze.'),
  ('Tricipiti ai Cavi',                'met', 'Metabolico',    'Full extension. Squeeze finale.'),
  ('Dip alle Parallele',               'mec', 'Meccanico',     'Busto leggermente inclinato per petto.'),
  ('Curl Manubri Alternato',           'met', 'Metabolico',    'Supina in cima. Eccentrica lenta.'),
  ('Hip Thrust',                       'mec', 'Meccanico',     'Pieno estensione in cima. Squeeze glutei.'),
  ('Leg Extension',                    'pre', 'Pre-Attivazione','Squeeze 1 sec in cima.'),
  ('Calf in Piedi',                    'met', 'Metabolico',    'Range pieno. Pausa in basso 2 sec.');
