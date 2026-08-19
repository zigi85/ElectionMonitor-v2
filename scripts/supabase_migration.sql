-- Migration: add editor tables for draft/publish workflow
-- Run this in Supabase SQL Editor

-- 1. Add status + model columns to daily_digests
ALTER TABLE daily_digests ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published';
ALTER TABLE daily_digests ADD COLUMN IF NOT EXISTS model text;

CREATE INDEX IF NOT EXISTS idx_daily_digests_status ON daily_digests(status);

-- 2. Editorial notes table
CREATE TABLE IF NOT EXISTS editorial_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date text NOT NULL,
  notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- Keep only latest row per date
CREATE UNIQUE INDEX IF NOT EXISTS idx_editorial_notes_date ON editorial_notes(date);

-- 3. RLS policies (optional - service role bypasses RLS)
-- If you want anon read access to published digests:
-- ALTER TABLE daily_digests ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "public can read published" ON daily_digests
--   FOR SELECT USING (status = 'published');
