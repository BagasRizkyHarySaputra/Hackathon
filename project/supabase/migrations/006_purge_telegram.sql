-- Migration: Purge Telegram storage and switch fully to Google Drive
-- Created: 2026-06-28
-- Author: LICIN Team
--
-- This migration:
-- 1. Deletes all scan_results rows without a Google Drive file_id (old Telegram-only data)
-- 2. Drops the telegram_file_id and telegram_message_id columns
-- 3. Completes the full migration from Telegram Bot API to Google Drive API
--
-- WARNING: This is a destructive migration. All old photo data stored only in Telegram will be deleted.
-- Make sure you have backed up any critical data before running this migration.

-- Step 1: Delete rows without Google Drive file_id (old Telegram-only data)
-- These rows represent scans where photos were only uploaded to Telegram, not Google Drive.
DELETE FROM public.scan_results 
WHERE gdrive_file_id IS NULL;

-- Step 2: Drop Telegram columns (no longer needed after full GDrive migration)
ALTER TABLE public.scan_results 
DROP COLUMN IF EXISTS telegram_file_id;

ALTER TABLE public.scan_results 
DROP COLUMN IF EXISTS telegram_message_id;

-- Migration complete. All scan_results now use Google Drive storage exclusively.
