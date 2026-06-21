-- ============================================================
-- FILE: migrations/002_scan_results_telegram.sql
-- ============================================================
-- FEATURE: Telegram cloud storage for original scan photos
--
-- PURPOSE:
--   Stores the Telegram file_id returned after uploading the
--   original captured photo to the Telegram Bot API. This allows
--   retrieval of unlimited cloud-stored photos later.
-- ============================================================

-- Add telegram_file_id column
ALTER TABLE public.scan_results
  ADD COLUMN IF NOT EXISTS telegram_file_id TEXT;

-- Add telegram_message_id for message reference
ALTER TABLE public.scan_results
  ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;

COMMENT ON COLUMN public.scan_results.telegram_file_id IS 'Telegram Bot API file_id for the original captured photo';
COMMENT ON COLUMN public.scan_results.telegram_message_id IS 'Telegram message_id containing the photo';
