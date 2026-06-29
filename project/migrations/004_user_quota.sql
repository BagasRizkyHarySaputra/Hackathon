-- ═══════════════════════════════════════════════════════════
-- Migration 004: User Daily Quota
-- Tracks per-user daily query quota for chatbot
-- ═══════════════════════════════════════════════════════════

-- ── User daily quota table ──
CREATE TABLE IF NOT EXISTS public.user_daily_quota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  queries_remaining INT NOT NULL DEFAULT 50,
  query_limit INT NOT NULL DEFAULT 50,
  reset_at TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('day', now()) + interval '1 day'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT queries_remaining_non_negative CHECK (queries_remaining >= 0),
  CONSTRAINT query_limit_positive CHECK (query_limit > 0)
);

-- ── Index ──
CREATE INDEX IF NOT EXISTS idx_user_daily_quota_user_id ON public.user_daily_quota(user_id);

-- ── Enable RLS ──
ALTER TABLE public.user_daily_quota ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ──
CREATE POLICY "Users can view own quota" ON public.user_daily_quota
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quota" ON public.user_daily_quota
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own quota" ON public.user_daily_quota
  FOR UPDATE USING (auth.uid() = user_id);

-- ── Auto-update updated_at ──
CREATE OR REPLACE FUNCTION public.update_quota_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_daily_quota_updated_at
  BEFORE UPDATE ON public.user_daily_quota
  FOR EACH ROW
  EXECUTE FUNCTION public.update_quota_timestamp();

-- ── Atomic decrement function (safe from race conditions) ──
CREATE OR REPLACE FUNCTION public.decrement_quota(p_user_id UUID)
RETURNS TABLE (
  queries_remaining INT,
  query_limit INT,
  reset_at TIMESTAMPTZ
) AS $$
DECLARE
  v_quota public.user_daily_quota%ROWTYPE;
BEGIN
  -- Enforce that the caller can only decrement their own quota
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT * INTO v_quota
  FROM public.user_daily_quota
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quota not found for user %', p_user_id;
  END IF;

  -- Check if quota expired, reset if needed
  IF now() >= v_quota.reset_at THEN
    UPDATE public.user_daily_quota
    SET queries_remaining = 50,
        reset_at = date_trunc('day', now()) + interval '1 day'
    WHERE user_id = p_user_id;
  ELSIF v_quota.queries_remaining > 0 THEN
    UPDATE public.user_daily_quota
    SET queries_remaining = queries_remaining - 1
    WHERE user_id = p_user_id;
  END IF;

  RETURN QUERY
  SELECT q.queries_remaining, q.query_limit, q.reset_at
  FROM public.user_daily_quota q
  WHERE q.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.decrement_quota TO authenticated;