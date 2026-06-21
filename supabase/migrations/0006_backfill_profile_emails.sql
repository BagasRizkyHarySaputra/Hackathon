-- ============================================================
-- MIGRATION: 0006_backfill_profile_emails.sql
-- FEATURE: Backfill email for existing profiles
-- ============================================================
-- After adding the email column (0005), existing profiles have
-- NULL email. This migration backfills them from auth.users.
-- ============================================================

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND p.email IS NULL;
