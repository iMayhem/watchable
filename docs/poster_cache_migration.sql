-- Poster cache: Cloudflare R2 URLs for medium WebP posters (catalog + anime + TMDB)
-- Run in Supabase SQL Editor, then: python scripts/sync_posters_to_r2.py

CREATE TABLE IF NOT EXISTS poster_cache (
    entity_type TEXT NOT NULL CHECK (entity_type IN ('catalog', 'anime', 'tmdb_movie', 'tmdb_tv')),
    entity_id TEXT NOT NULL,
    size TEXT NOT NULL DEFAULT 'medium' CHECK (size IN ('medium', 'backdrop')),
    source_type TEXT,
    source_url TEXT,
    r2_key TEXT NOT NULL,
    public_url TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    bytes INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (entity_type, entity_id, size)
);

CREATE INDEX IF NOT EXISTS idx_poster_cache_public_url
    ON poster_cache (public_url);

CREATE INDEX IF NOT EXISTS idx_poster_cache_updated
    ON poster_cache (updated_at DESC);

ALTER TABLE poster_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read poster cache" ON poster_cache;
CREATE POLICY "Public read poster cache"
    ON poster_cache
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Service upsert poster cache" ON poster_cache;
CREATE POLICY "Service upsert poster cache"
    ON poster_cache
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);