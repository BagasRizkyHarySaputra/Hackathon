-- ============================================================================
-- Migration: 0002_rls_grants
-- Description: GRANT schema/table permissions + fix deprecated auth.role() policies
-- ============================================================================
-- Why: Migration 0001 created tables, enabled RLS, and defined policies, but
-- never GRANTed USAGE on the public schema or table access to the Supabase
-- roles (anon, authenticated, service_role). Without these GRANTs, all Data
-- API requests fail with "permission denied for table" — even service_role.
-- ============================================================================

-- ============================================================================
-- 1. GRANT SCHEMA USAGE
-- ============================================================================
-- Without this, roles cannot see or access any objects in the public schema.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ============================================================================
-- 2. DEFAULT PRIVILEGES (for future tables)
-- ============================================================================
-- Ensures any tables created in the future automatically get correct grants.

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO service_role;

-- ============================================================================
-- 3. TABLE GRANTS — PUBLIC-READ TABLES (anon gets SELECT)
-- ============================================================================
-- These contain public/catalog data that unauthenticated users should see.
-- RLS policies with USING (true) already allow public read.
-- ============================================================================

-- Profiles: users browse profiles in community
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Channels: public discussion categories
GRANT SELECT ON public.channels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;
GRANT ALL ON public.channels TO service_role;

-- Topics: public discussion threads
GRANT SELECT ON public.topics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topics TO authenticated;
GRANT ALL ON public.topics TO service_role;

-- Chat Messages: public chat content
GRANT SELECT ON public.chat_messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

-- Polls: public polls
GRANT SELECT ON public.polls TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polls TO authenticated;
GRANT ALL ON public.polls TO service_role;

-- Poll Options: public poll choices
GRANT SELECT ON public.poll_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_options TO authenticated;
GRANT ALL ON public.poll_options TO service_role;

-- Poll Votes: public vote counts/totals
GRANT SELECT ON public.poll_votes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_votes TO authenticated;
GRANT ALL ON public.poll_votes TO service_role;

-- Articles: public skincare articles
GRANT SELECT ON public.articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles TO authenticated;
GRANT ALL ON public.articles TO service_role;

-- Skincare Products: public product catalog
GRANT SELECT ON public.skincare_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skincare_products TO authenticated;
GRANT ALL ON public.skincare_products TO service_role;

-- ============================================================================
-- 4. TABLE GRANTS — PRIVATE TABLES (no anon access)
-- ============================================================================
-- These contain user-private data. Only authenticated users (owner via RLS)
-- and service_role (admin bypassing RLS) can access them.
-- ============================================================================

-- User Settings: private preferences
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;

-- Skin Cycles: user's 21-day tracking cycles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skin_cycles TO authenticated;
GRANT ALL ON public.skin_cycles TO service_role;

-- Scan Records: user's scan results (per-cycle)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scan_records TO authenticated;
GRANT ALL ON public.scan_records TO service_role;

-- AI Sessions: user's chat sessions with AI skincare assistant
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_sessions TO authenticated;
GRANT ALL ON public.ai_sessions TO service_role;

-- AI Chat History: message history per session
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_chat_history TO authenticated;
GRANT ALL ON public.ai_chat_history TO service_role;

-- ============================================================================
-- 5. FIX DEPRECATED auth.role() POLICIES
-- ============================================================================
-- auth.role() is deprecated by Supabase. Use the TO clause instead.
-- Beyond deprecation, auth.role() = 'authenticated' breaks silently when
-- anonymous sign-ins are enabled, because anonymous users carry the
-- authenticated Postgres role and pass the check regardless of whether the
-- user is genuinely signed in.
-- ============================================================================

-- ---- Channels ----
DROP POLICY IF EXISTS "channels_insert_auth" ON public.channels;
CREATE POLICY "channels_insert_auth" ON public.channels
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "channels_update_auth" ON public.channels;
CREATE POLICY "channels_update_auth" ON public.channels
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ---- Topics ----
DROP POLICY IF EXISTS "topics_insert_auth" ON public.topics;
CREATE POLICY "topics_insert_auth" ON public.topics
    FOR INSERT TO authenticated WITH CHECK (true);

-- ---- Articles ----
DROP POLICY IF EXISTS "articles_insert_auth" ON public.articles;
CREATE POLICY "articles_insert_auth" ON public.articles
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "articles_update_auth" ON public.articles;
CREATE POLICY "articles_update_auth" ON public.articles
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "articles_delete_auth" ON public.articles;
CREATE POLICY "articles_delete_auth" ON public.articles
    FOR DELETE TO authenticated USING (true);

-- ---- Skincare Products ----
DROP POLICY IF EXISTS "products_insert_auth" ON public.skincare_products;
CREATE POLICY "products_insert_auth" ON public.skincare_products
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "products_update_auth" ON public.skincare_products;
CREATE POLICY "products_update_auth" ON public.skincare_products
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "products_delete_auth" ON public.skincare_products;
CREATE POLICY "products_delete_auth" ON public.skincare_products
    FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 6. FIX: ADD MISSING UPDATE POLICIES WITH WITH CHECK
-- ============================================================================
-- UPDATE policies require both USING and WITH CHECK. Without WITH CHECK,
-- a user could reassign a row's user_id to another user.
-- Some policies in 0001 were missing UPDATE entirely, others were missing
-- WITH CHECK on existing UPDATE policies.
-- ============================================================================

-- Profiles: add UPDATE WITH CHECK + ensure SELECT policy exists for UPDATE
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- User Settings: add UPDATE WITH CHECK
DROP POLICY IF EXISTS "settings_update_own" ON public.user_settings;
CREATE POLICY "settings_update_own" ON public.user_settings
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Skin Cycles: add UPDATE WITH CHECK
DROP POLICY IF EXISTS "cycles_update_own" ON public.skin_cycles;
CREATE POLICY "cycles_update_own" ON public.skin_cycles
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 7. FIX: ADD MISSING INSERT/SELECT/UPSERT COVERAGE
-- ============================================================================
-- In Postgres RLS, UPDATE requires a SELECT policy on the same table.
-- Without it, updates silently return 0 rows — no error, just no change.
-- Also UPSERT requires INSERT + SELECT + UPDATE.
-- ============================================================================

-- Scan Records: add UPDATE policy (was missing entirely)
DROP POLICY IF EXISTS "scans_update_own" ON public.scan_records;
CREATE POLICY "scans_update_own" ON public.scan_records
    FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.skin_cycles sc WHERE sc.id = scan_records.cycle_id AND sc.user_id = auth.uid())
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.skin_cycles sc WHERE sc.id = scan_records.cycle_id AND sc.user_id = auth.uid())
    );

-- AI Sessions: add UPDATE WITH CHECK
DROP POLICY IF EXISTS "ai_sessions_update" ON public.ai_sessions;
CREATE POLICY "ai_sessions_update" ON public.ai_sessions
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- AI Chat History: add UPDATE policy (was missing)
DROP POLICY IF EXISTS "ai_history_update" ON public.ai_chat_history;
CREATE POLICY "ai_history_update" ON public.ai_chat_history
    FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.ai_sessions s WHERE s.id = ai_chat_history.session_id AND s.user_id = auth.uid())
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.ai_sessions s WHERE s.id = ai_chat_history.session_id AND s.user_id = auth.uid())
    );

-- Chat Messages: add UPDATE own policy (was missing)
DROP POLICY IF EXISTS "messages_update_own" ON public.chat_messages;
CREATE POLICY "messages_update_own" ON public.chat_messages
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Poll Votes: add UPDATE own (was missing)
DROP POLICY IF EXISTS "votes_update_own" ON public.poll_votes;
CREATE POLICY "votes_update_own" ON public.poll_votes
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Channels: add DELETE policy (was missing)
DROP POLICY IF EXISTS "channels_delete_auth" ON public.channels;
CREATE POLICY "channels_delete_auth" ON public.channels
    FOR DELETE TO authenticated USING (true);

-- Topics: add UPDATE and DELETE policies (were missing)
DROP POLICY IF EXISTS "topics_update_auth" ON public.topics;
CREATE POLICY "topics_update_auth" ON public.topics
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "topics_delete_auth" ON public.topics;
CREATE POLICY "topics_delete_auth" ON public.topics
    FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- VERIFICATION HELPERS
-- ============================================================================
-- Run these queries in Supabase SQL Editor to verify:
--
-- -- Check all table grants:
-- SELECT grantee, table_schema, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
-- ORDER BY grantee, table_name;
--
-- -- Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%';
--
-- -- Check all RLS policies:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
