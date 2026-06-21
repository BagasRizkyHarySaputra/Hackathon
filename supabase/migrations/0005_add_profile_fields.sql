-- ============================================================
-- Migration: Add email, gender, birth_date to profiles table
-- ============================================================
-- Run this in Supabase Dashboard → SQL Editor
-- Or via: supabase db query < this file
-- ============================================================

ALTER TABLE IF EXISTS profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Enable RLS (idempotent)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Ensure RLS policies exist for the new columns
-- Users can read their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING ( (select auth.uid()) = id );

-- Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK ( (select auth.uid()) = id );

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING ( (select auth.uid()) = id )
  WITH CHECK ( (select auth.uid()) = id );
