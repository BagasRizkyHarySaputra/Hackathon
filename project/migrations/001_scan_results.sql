-- ============================================================
-- FILE: migrations/001_scan_results.sql
-- ============================================================
-- FEATURE: Scan Results Table — stores Skin Health Score Profile
--
-- PURPOSE:
--   Persists the YOLO analysis result for each scan session.
--   Stores the full health score breakdown (clear_skin % and
--   per-acne-type weighted percentages) so the user's scan
--   history can be displayed on the profile page later.
--
-- RLS:
--   Enabled — users can only SELECT/INSERT their own rows.
-- ============================================================

-- Create scan_results table
CREATE TABLE IF NOT EXISTS public.scan_results (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    clear_skin  NUMERIC(5,1) NOT NULL DEFAULT 0,
    nodules     NUMERIC(5,1) NOT NULL DEFAULT 0,
    pustules    NUMERIC(5,1) NOT NULL DEFAULT 0,
    papules     NUMERIC(5,1) NOT NULL DEFAULT 0,
    dark_spot   NUMERIC(5,1) NOT NULL DEFAULT 0,
    blackheads  NUMERIC(5,1) NOT NULL DEFAULT 0,
    whiteheads  NUMERIC(5,1) NOT NULL DEFAULT 0,
    acne_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    issues_found TEXT[] NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.scan_results ENABLE ROW LEVEL SECURITY;

-- DROP existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "scan_results_select_own" ON public.scan_results;
DROP POLICY IF EXISTS "scan_results_insert_own" ON public.scan_results;
DROP POLICY IF EXISTS "scan_results_update_own" ON public.scan_results;
DROP POLICY IF EXISTS "scan_results_delete_own" ON public.scan_results;

-- SELECT: users can only read their own scan results
CREATE POLICY "scan_results_select_own"
    ON public.scan_results
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- INSERT: users can only insert their own scan results
CREATE POLICY "scan_results_insert_own"
    ON public.scan_results
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- UPDATE: users can only update their own scan results
CREATE POLICY "scan_results_update_own"
    ON public.scan_results
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- DELETE: users can only delete their own scan results
CREATE POLICY "scan_results_delete_own"
    ON public.scan_results
    FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- Grant access to authenticated role (required for Data API access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scan_results TO authenticated;

-- Index for fast lookups by user_id
CREATE INDEX IF NOT EXISTS idx_scan_results_user_id
    ON public.scan_results (user_id);

-- Index for sorting by most recent first
CREATE INDEX IF NOT EXISTS idx_scan_results_created_at
    ON public.scan_results (created_at DESC);

-- Add helpful comment
COMMENT ON TABLE public.scan_results IS 'Stores Skin Health Score Profile (%) from YOLO analysis for each scan session';
