-- ============================================================================
-- Migration: 0001_initial_schema
-- Description: Initial database schema for LICIN skincare app
-- Based on base-db.txt with Supabase best practices applied
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES (linked to Supabase Auth)
-- ============================================================================
-- Supabase provides auth.users (built-in) for authentication.
-- We create a profiles table that extends auth.users with app-specific data.
-- No password column needed — Supabase Auth handles that.

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    profile_image_url TEXT DEFAULT '',
    skin_type TEXT DEFAULT 'normal' CHECK (
        skin_type IN ('normal', 'dry', 'oily', 'combination', 'sensitive')
    ),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create a profile row when a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, name, profile_image_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- User Settings
-- ============================================================================

CREATE TABLE public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    push_notification BOOLEAN DEFAULT true,
    email_notification BOOLEAN DEFAULT true,
    privacy_1 BOOLEAN DEFAULT false,
    privacy_2 BOOLEAN DEFAULT false,
    privacy_3 BOOLEAN DEFAULT false,
    privacy_4 BOOLEAN DEFAULT false,
    privacy_5 BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create settings row when profile is created
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_settings (user_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();

-- ============================================================================
-- 2. SKIN SCAN & 21-DAY DIARY
-- ============================================================================

CREATE TABLE public.skin_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '21 days'),
    status TEXT DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_skin_cycles_user ON public.skin_cycles(user_id);
CREATE INDEX idx_skin_cycles_status ON public.skin_cycles(status);

CREATE TABLE public.scan_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL REFERENCES public.skin_cycles(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL CHECK (week_number IN (1, 2, 3)),
    scan_image_url TEXT NOT NULL,
    -- JSONB stores percentage + severity for each of 6 skin conditions.
    -- Structure example:
    -- {
    --   "blackheads":  {"percentage": 35.5, "severity": 2.1},
    --   "dark_spot":   {"percentage": 12.0, "severity": 0.8},
    --   "nodules":     {"percentage":  5.0, "severity": 0.3},
    --   "papules":     {"percentage": 18.0, "severity": 1.2},
    --   "pustules":    {"percentage":  8.0, "severity": 0.5},
    --   "whiteheads":  {"percentage": 22.0, "severity": 1.5}
    -- }
    scan_results JSONB NOT NULL DEFAULT '{}',
    scan_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scan_records_cycle ON public.scan_records(cycle_id);
CREATE INDEX idx_scan_records_date ON public.scan_records(scan_date);

-- ============================================================================
-- 3. COMMUNITY & REAL-TIME CHAT
-- ============================================================================

CREATE TABLE public.channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    icon TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_topics_channel ON public.topics(channel_id);

CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chat_message_has_content CHECK (message IS NOT NULL OR image_url IS NOT NULL)
);

CREATE INDEX idx_chat_messages_topic ON public.chat_messages(topic_id);
CREATE INDEX idx_chat_messages_created ON public.chat_messages(created_at);

-- Polls (voting feature in chat)
CREATE TABLE public.polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    votes_count INTEGER DEFAULT 0
);

CREATE INDEX idx_poll_options_poll ON public.poll_options(poll_id);

-- Track individual votes to prevent double-voting
CREATE TABLE public.poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, poll_id)  -- one vote per user per poll
);

CREATE INDEX idx_poll_votes_poll ON public.poll_votes(poll_id);

-- Trigger: increment/decrement votes_count when a vote is added/removed
CREATE OR REPLACE FUNCTION public.update_vote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.poll_options SET votes_count = votes_count + 1 WHERE id = NEW.option_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.poll_options SET votes_count = votes_count - 1 WHERE id = OLD.option_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER on_poll_vote_change
    AFTER INSERT OR DELETE ON public.poll_votes
    FOR EACH ROW EXECUTE FUNCTION public.update_vote_count();

-- ============================================================================
-- 4. AI CHATBOT
-- ============================================================================

CREATE TABLE public.ai_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_name TEXT DEFAULT 'New Chat',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_sessions_user ON public.ai_sessions(user_id);

CREATE TABLE public.ai_chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.ai_sessions(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'ai')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_chat_history_session ON public.ai_chat_history(session_id);
CREATE INDEX idx_ai_chat_history_created ON public.ai_chat_history(created_at);

-- ============================================================================
-- 5. CONTENT (Articles & Products)
-- ============================================================================

CREATE TABLE public.articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT DEFAULT '',
    image_url TEXT,
    category TEXT DEFAULT 'general',
    published_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_articles_published ON public.articles(published_at DESC);

CREATE TABLE public.skincare_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    product_link TEXT,
    category TEXT DEFAULT 'general',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- RLS is enabled on all tables. Policies define who can read/write.

-- Enable RLS on all tables
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skin_cycles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skincare_products  ENABLE ROW LEVEL SECURITY;

-- ---- Profiles ----
CREATE POLICY "profiles_select_all"    ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own"    ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own"    ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ---- User Settings ----
CREATE POLICY "settings_select_own"    ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "settings_insert_own"    ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "settings_update_own"    ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "settings_delete_own"    ON public.user_settings FOR DELETE USING (auth.uid() = user_id);

-- ---- Skin Cycles ----
CREATE POLICY "cycles_select_own"      ON public.skin_cycles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cycles_insert_own"      ON public.skin_cycles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cycles_update_own"      ON public.skin_cycles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "cycles_delete_own"      ON public.skin_cycles FOR DELETE USING (auth.uid() = user_id);

-- ---- Scan Records (ownership via cycle) ----
CREATE POLICY "scans_select_own"       ON public.scan_records FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.skin_cycles sc WHERE sc.id = scan_records.cycle_id AND sc.user_id = auth.uid())
);
CREATE POLICY "scans_insert_own"       ON public.scan_records FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.skin_cycles sc WHERE sc.id = scan_records.cycle_id AND sc.user_id = auth.uid())
);
CREATE POLICY "scans_delete_own"       ON public.scan_records FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.skin_cycles sc WHERE sc.id = scan_records.cycle_id AND sc.user_id = auth.uid())
);

-- ---- Channels (public read, auth write) ----
CREATE POLICY "channels_select_all"    ON public.channels FOR SELECT USING (true);
CREATE POLICY "channels_insert_auth"   ON public.channels FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "channels_update_auth"   ON public.channels FOR UPDATE USING (auth.role() = 'authenticated');

-- ---- Topics (public read, auth write) ----
CREATE POLICY "topics_select_all"      ON public.topics FOR SELECT USING (true);
CREATE POLICY "topics_insert_auth"     ON public.topics FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ---- Chat Messages (public read, auth insert own, delete own) ----
CREATE POLICY "messages_select_all"    ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "messages_insert_own"    ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "messages_delete_own"    ON public.chat_messages FOR DELETE USING (auth.uid() = user_id);

-- ---- Polls (public read, message owner creates) ----
CREATE POLICY "polls_select_all"       ON public.polls FOR SELECT USING (true);
CREATE POLICY "polls_insert_own"       ON public.polls FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.chat_messages cm WHERE cm.id = polls.message_id AND cm.user_id = auth.uid())
);

-- ---- Poll Options (public read, poll owner creates) ----
CREATE POLICY "poll_options_select"    ON public.poll_options FOR SELECT USING (true);
CREATE POLICY "poll_options_insert"    ON public.poll_options FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.polls p
        JOIN public.chat_messages cm ON cm.id = p.message_id
        WHERE p.id = poll_options.poll_id AND cm.user_id = auth.uid()
    )
);

-- ---- Poll Votes (public read, auth vote once, delete own) ----
CREATE POLICY "votes_select_all"       ON public.poll_votes FOR SELECT USING (true);
CREATE POLICY "votes_insert_own"       ON public.poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "votes_delete_own"       ON public.poll_votes FOR DELETE USING (auth.uid() = user_id);

-- ---- AI Sessions (owner only) ----
CREATE POLICY "ai_sessions_select"     ON public.ai_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ai_sessions_insert"     ON public.ai_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_sessions_update"     ON public.ai_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ai_sessions_delete"     ON public.ai_sessions FOR DELETE USING (auth.uid() = user_id);

-- ---- AI Chat History (owner via session) ----
CREATE POLICY "ai_history_select"      ON public.ai_chat_history FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.ai_sessions s WHERE s.id = ai_chat_history.session_id AND s.user_id = auth.uid())
);
CREATE POLICY "ai_history_insert"      ON public.ai_chat_history FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.ai_sessions s WHERE s.id = ai_chat_history.session_id AND s.user_id = auth.uid())
);

-- ---- Articles (public read, auth write) ----
CREATE POLICY "articles_select_all"    ON public.articles FOR SELECT USING (true);
CREATE POLICY "articles_insert_auth"   ON public.articles FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "articles_update_auth"   ON public.articles FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "articles_delete_auth"   ON public.articles FOR DELETE USING (auth.role() = 'authenticated');

-- ---- Skincare Products (public read, auth write) ----
CREATE POLICY "products_select_all"    ON public.skincare_products FOR SELECT USING (true);
CREATE POLICY "products_insert_auth"   ON public.skincare_products FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "products_update_auth"   ON public.skincare_products FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "products_delete_auth"   ON public.skincare_products FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================================
-- UTILITY: updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER ai_sessions_updated_at
    BEFORE UPDATE ON public.ai_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- REALTIME: Enable realtime for chat-related tables
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_options;
