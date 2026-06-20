-- ============================================================================
-- Migration: 0004_skincare_routines
-- Description: Create skincare_routines table for user morning/night routines
-- ============================================================================
-- Why: The profile page shows skincare routines (morning + night) with
-- products, but there is no routines table yet. This migration creates it
-- with proper RLS, grants, and upsert support.
-- ============================================================================

-- 1. Create skincare_routines table
CREATE TABLE IF NOT EXISTS public.skincare_routines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    routine_type TEXT NOT NULL CHECK (routine_type IN ('morning', 'night')),
    step_order INTEGER NOT NULL CHECK (step_order >= 1),
    product_name TEXT NOT NULL DEFAULT '',
    product_description TEXT DEFAULT '',
    product_image_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, routine_type, step_order)
);

CREATE INDEX IF NOT EXISTS idx_skincare_routines_user_id ON public.skincare_routines(user_id);
CREATE INDEX IF NOT EXISTS idx_skincare_routines_type ON public.skincare_routines(routine_type);

-- 2. Enable RLS
ALTER TABLE public.skincare_routines ENABLE ROW LEVEL SECURITY;

-- 3. GRANT table access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skincare_routines TO authenticated;
GRANT ALL ON public.skincare_routines TO service_role;

-- 4. RLS Policies
-- SELECT: users read their own routines
CREATE POLICY "routines_select_own" ON public.skincare_routines
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- INSERT: users insert their own routines
CREATE POLICY "routines_insert_own" ON public.skincare_routines
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- UPDATE: users update their own routines
CREATE POLICY "routines_update_own" ON public.skincare_routines
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- DELETE: users delete their own routines
CREATE POLICY "routines_delete_own" ON public.skincare_routines
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- ============================================================================
-- VERIFY
-- ============================================================================
-- Run in SQL Editor to confirm:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'skincare_routines'
-- ORDER BY ordinal_position;
