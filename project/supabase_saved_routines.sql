-- ============================================
-- Table: saved_routines
-- Purpose: Store user's saved skincare routines from scan results
-- ============================================

create table if not exists saved_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  morning_products jsonb not null default '[]'::jsonb,
  night_products jsonb not null default '[]'::jsonb,
  health_score jsonb,
  scan_result_id uuid references scan_results(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Unique constraint: Each user can only have ONE saved routine
-- This enables UPSERT behavior (update if exists, insert if new)
alter table saved_routines 
  add constraint saved_routines_user_id_unique unique (user_id);

-- Index for faster queries by user_id
create index if not exists idx_saved_routines_user_id 
  on saved_routines(user_id);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

alter table saved_routines enable row level security;

-- Policy: Users can view only their own routines
create policy "Users can view own routines"
  on saved_routines for select
  using (auth.uid() = user_id);

-- Policy: Users can insert their own routines
create policy "Users can insert own routines"
  on saved_routines for insert
  with check (auth.uid() = user_id);

-- Policy: Users can update their own routines
create policy "Users can update own routines"
  on saved_routines for update
  using (auth.uid() = user_id);

-- Policy: Users can delete their own routines
create policy "Users can delete own routines"
  on saved_routines for delete
  using (auth.uid() = user_id);

-- ============================================
-- Comments for documentation
-- ============================================

comment on table saved_routines is 'Stores user skincare routines generated from scan results';
comment on column saved_routines.morning_products is 'Array of recommended morning skincare products (JSONB)';
comment on column saved_routines.night_products is 'Array of recommended night skincare products (JSONB)';
comment on column saved_routines.health_score is 'Health score data from scan analysis (JSONB)';
comment on column saved_routines.scan_result_id is 'Reference to the scan that generated this routine (nullable)';
