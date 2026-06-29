-- Migration: Restore Telegram photo storage
-- Created: 2026-06-28
-- Author: LICIN Team
--
-- This migration re-adds the telegram_file_id column that was dropped
-- by migration 006. We're switching back to Telegram Bot API for
-- photo storage after Google Drive service account approach failed
-- (403 storage quota error on personal Drive).

-- Step 1: Re-add telegram_file_id column
ALTER TABLE public.scan_results
  ADD COLUMN IF NOT EXISTS telegram_file_id TEXT;

COMMENT ON COLUMN public.scan_results.telegram_file_id IS 'Telegram Bot API file_id for the original captured photo';

-- Step 2: Create index on telegram_file_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_scan_results_telegram_file_id
  ON public.scan_results(telegram_file_id)
  WHERE telegram_file_id IS NOT NULL;
