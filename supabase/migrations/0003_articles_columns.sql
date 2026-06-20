-- ============================================================================
-- Migration: 0003_articles_columns
-- Description: Add columns to articles table to match local JSON data structure
-- ============================================================================
-- Why: The artikel page's local JSON files have richer data (slug, tags, 
-- sections, tips, source) than the current articles table schema. These 
-- columns are needed before migrating all article data to Supabase.
-- ============================================================================

-- 1. Add slug for SEO-friendly URL IDs (e.g., "retinol-pemula")
--    Unique constraint ensures no duplicate slug conflicts.
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.articles ADD CONSTRAINT articles_slug_unique UNIQUE (slug);

-- 2. Add tags for filtering (acne, dry, oily, sensitive, combination)
--    Using TEXT[] array for efficient indexing and filtering.
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_articles_tags ON public.articles USING GIN (tags);

-- 3. Add source attribution (e.g., "Parapuan.co")
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS source TEXT DEFAULT '';

-- 4. Add sections (structured article body with headings)
--    Array of {heading, text} objects stored as JSONB for flexibility.
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS sections JSONB DEFAULT '[]'::jsonb;

-- 5. Add tips (key takeaways shown at end of article)
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS tips JSONB DEFAULT '[]'::jsonb;

-- 6. Add simple_desc for card excerpt (separate from full content)
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS simple_desc TEXT DEFAULT '';

-- ============================================================================
-- VERIFY
-- ============================================================================
-- Run in SQL Editor to confirm columns added:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'articles'
-- ORDER BY ordinal_position;
