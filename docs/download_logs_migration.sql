-- Migration to create download_logs table for tracking download events
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS download_logs (
  id BIGSERIAL PRIMARY KEY,
  tmdb_id TEXT NOT NULL,
  type TEXT NOT NULL,
  quality TEXT NOT NULL,
  title TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster counts per media
CREATE INDEX IF NOT EXISTS idx_download_logs_tmdb_id ON download_logs (tmdb_id);

-- RLS: allow public inserts (logging) and reads (counting)
ALTER TABLE download_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public insert download_logs" ON download_logs;
CREATE POLICY "Public insert download_logs" ON download_logs
    FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Public read download_logs" ON download_logs;
CREATE POLICY "Public read download_logs" ON download_logs
    FOR SELECT
    USING (true);
