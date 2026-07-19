-- ==========================================
-- COMPLETE UNIFIED SCHEMA FOR WATCHABLE BACKEND
-- ==========================================
-- Copy and run this script entire in your new Supabase SQL Editor.
-- This creates all tables, primary keys, indices, constraints, RLS policies, and PgCron cleanup triggers.

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. TABLE: movora_users
CREATE TABLE IF NOT EXISTS public.movora_users (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    watchlist JSONB NOT NULL DEFAULT '{"version":2,"activeListId":"main","lists":[{"id":"main","name":"Watchlist","items":[],"createdAt":1783411211743,"updatedAt":1783411211743}]}'::jsonb,
    liked_list JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    watch_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    search_history JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_movora_users_watch_history ON public.movora_users USING GIN (watch_history);
CREATE INDEX IF NOT EXISTS idx_movora_users_search_history ON public.movora_users USING GIN (search_history);

ALTER TABLE public.movora_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read movora_users" ON public.movora_users;
CREATE POLICY "Public read movora_users" ON public.movora_users
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public write/upsert movora_users" ON public.movora_users;
CREATE POLICY "Public write/upsert movora_users" ON public.movora_users
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-- 3. TABLE: app_settings
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read app settings" ON public.app_settings;
CREATE POLICY "Public read app settings" ON public.app_settings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service write app settings" ON public.app_settings;
CREATE POLICY "Service write app settings" ON public.app_settings
    FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);


-- 4. TABLE: anime_catalog_cache
CREATE TABLE IF NOT EXISTS public.anime_catalog_cache (
    anilist_id INTEGER PRIMARY KEY,
    title_english TEXT,
    title_romaji TEXT,
    title_native TEXT,
    moovie_catalog_id TEXT,
    catalog_title TEXT,
    language_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    catalog_season INTEGER NOT NULL DEFAULT 1,
    popularity INTEGER,
    average_score NUMERIC(4, 1),
    season_year INTEGER,
    genres JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anime_catalog_cache_popularity ON public.anime_catalog_cache (popularity DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_anime_catalog_cache_moovie ON public.anime_catalog_cache (moovie_catalog_id) WHERE moovie_catalog_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_anime_catalog_cache_updated ON public.anime_catalog_cache (updated_at DESC);

ALTER TABLE public.anime_catalog_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read anime catalog cache" ON public.anime_catalog_cache;
CREATE POLICY "Public read anime catalog cache" ON public.anime_catalog_cache
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service upsert anime catalog cache" ON public.anime_catalog_cache;
CREATE POLICY "Service upsert anime catalog cache" ON public.anime_catalog_cache
    FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);


-- 5. TABLE: catalog_audio_cache
CREATE TABLE IF NOT EXISTS public.catalog_audio_cache (
    catalog_id TEXT PRIMARY KEY,
    media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    display_title TEXT,
    catalog_title TEXT,
    language_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    variant_family_key TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_audio_cache_family ON public.catalog_audio_cache (variant_family_key);
CREATE INDEX IF NOT EXISTS idx_catalog_audio_cache_media ON public.catalog_audio_cache (media_type);
CREATE INDEX IF NOT EXISTS idx_catalog_audio_cache_updated ON public.catalog_audio_cache (updated_at DESC);

ALTER TABLE public.catalog_audio_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read catalog audio cache" ON public.catalog_audio_cache;
CREATE POLICY "Public read catalog audio cache" ON public.catalog_audio_cache
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service upsert catalog audio cache" ON public.catalog_audio_cache;
CREATE POLICY "Service upsert catalog audio cache" ON public.catalog_audio_cache
    FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);


-- 6. TABLE: catalog_enrichment_cache
CREATE TABLE IF NOT EXISTS public.catalog_enrichment_cache (
    catalog_id TEXT PRIMARY KEY,
    media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    display_title TEXT,
    catalog_title TEXT,
    language_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    variant_family_key TEXT,
    tmdb_id INTEGER,
    tmdb_genre_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    tmdb_genre_names JSONB NOT NULL DEFAULT '[]'::jsonb,
    overview TEXT,
    browse_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
    category_sources JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_enrichment_browse_categories ON public.catalog_enrichment_cache USING GIN (browse_categories);
CREATE INDEX IF NOT EXISTS idx_catalog_enrichment_tmdb_genres ON public.catalog_enrichment_cache USING GIN (tmdb_genre_ids);
CREATE INDEX IF NOT EXISTS idx_catalog_enrichment_media ON public.catalog_enrichment_cache (media_type);
CREATE INDEX IF NOT EXISTS idx_catalog_enrichment_updated ON public.catalog_enrichment_cache (updated_at DESC);

ALTER TABLE public.catalog_enrichment_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read catalog enrichment cache" ON public.catalog_enrichment_cache;
CREATE POLICY "Public read catalog enrichment cache" ON public.catalog_enrichment_cache
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service upsert catalog enrichment cache" ON public.catalog_enrichment_cache;
CREATE POLICY "Service upsert catalog enrichment cache" ON public.catalog_enrichment_cache
    FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);


-- 7. TABLE: movora_comments
CREATE TABLE IF NOT EXISTS public.movora_comments (
    id BIGSERIAL PRIMARY KEY,
    media_id TEXT NOT NULL,
    media_type TEXT NOT NULL, -- 'movie', 'tv', or 'anime'
    username TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.movora_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on comments" ON public.movora_comments;
CREATE POLICY "Allow public read access on comments" ON public.movora_comments
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert access on comments" ON public.movora_comments;
CREATE POLICY "Allow public insert access on comments" ON public.movora_comments
    FOR INSERT WITH CHECK (true);


-- 8. TABLE: notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'info',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT DEFAULT 'admin'
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read notifications" ON public.notifications;
CREATE POLICY "Public read notifications" ON public.notifications
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service upsert notifications" ON public.notifications;
CREATE POLICY "Service upsert notifications" ON public.notifications
    FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);


-- 9. TABLE: notification_reads
CREATE TABLE IF NOT EXISTS public.notification_reads (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    notification_id BIGINT REFERENCES public.notifications(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(notification_id, username)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_username ON public.notification_reads (username);

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read/write notification reads" ON public.notification_reads;
CREATE POLICY "Public read/write notification reads" ON public.notification_reads
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-- 10. TABLE: banners
CREATE TABLE IF NOT EXISTS public.banners (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    message TEXT NOT NULL DEFAULT '',
    link TEXT DEFAULT '',
    bg_color TEXT DEFAULT '#ff5a1f',
    text_color TEXT DEFAULT '#ffffff',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read banners" ON public.banners;
CREATE POLICY "Public read banners" ON public.banners
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service upsert banners" ON public.banners;
CREATE POLICY "Service upsert banners" ON public.banners
    FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);


-- 11. TABLE: polls
CREATE TABLE IF NOT EXISTS public.polls (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    question TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read polls" ON public.polls;
CREATE POLICY "Public read polls" ON public.polls
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service upsert polls" ON public.polls;
CREATE POLICY "Service upsert polls" ON public.polls
    FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);


-- 12. TABLE: poll_votes
CREATE TABLE IF NOT EXISTS public.poll_votes (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    poll_id BIGINT REFERENCES public.polls(id) ON DELETE CASCADE,
    selected_option INT NOT NULL,
    voted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON public.poll_votes (poll_id);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read/write poll votes" ON public.poll_votes;
CREATE POLICY "Public read/write poll votes" ON public.poll_votes
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-- 13. TABLE: rooms
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    movie_title TEXT,
    embed_sources TEXT,
    scheduled_start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_private BOOLEAN NOT NULL DEFAULT false,
    media_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_rooms_media_id ON public.rooms (media_id);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rooms_public_select" ON public.rooms;
CREATE POLICY "rooms_public_select" ON public.rooms
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "rooms_public_insert" ON public.rooms;
CREATE POLICY "rooms_public_insert" ON public.rooms
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "rooms_public_update" ON public.rooms;
CREATE POLICY "rooms_public_update" ON public.rooms
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "rooms_public_delete" ON public.rooms;
CREATE POLICY "rooms_public_delete" ON public.rooms
    FOR DELETE TO anon, authenticated USING (true);


-- 14. TABLE: party_chat_messages
CREATE TABLE IF NOT EXISTS public.party_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_party_chat_messages_room_id ON public.party_chat_messages (room_id);
CREATE INDEX IF NOT EXISTS idx_party_chat_messages_room_created ON public.party_chat_messages (room_id, created_at DESC);

ALTER TABLE public.party_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "party_chat_public_select" ON public.party_chat_messages;
CREATE POLICY "party_chat_public_select" ON public.party_chat_messages
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "party_chat_public_insert" ON public.party_chat_messages;
CREATE POLICY "party_chat_public_insert" ON public.party_chat_messages
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "party_chat_public_delete" ON public.party_chat_messages;
CREATE POLICY "party_chat_public_delete" ON public.party_chat_messages
    FOR DELETE TO anon, authenticated USING (true);


-- 15. TABLE: youtube_rooms
CREATE TABLE IF NOT EXISTS public.youtube_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    started_by TEXT NOT NULL DEFAULT 'Guest',
    is_playing BOOLEAN NOT NULL DEFAULT false,
    "current_time" DOUBLE PRECISION NOT NULL DEFAULT 0,
    host_session_id TEXT,
    name TEXT NOT NULL DEFAULT '',
    is_private BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    queue JSONB NOT NULL DEFAULT '[]'::jsonb,
    skip_votes JSONB NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.youtube_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "youtube_rooms_public_select" ON public.youtube_rooms;
CREATE POLICY "youtube_rooms_public_select" ON public.youtube_rooms
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "youtube_rooms_public_insert" ON public.youtube_rooms;
CREATE POLICY "youtube_rooms_public_insert" ON public.youtube_rooms
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "youtube_rooms_public_update" ON public.youtube_rooms;
CREATE POLICY "youtube_rooms_public_update" ON public.youtube_rooms
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "youtube_rooms_public_delete" ON public.youtube_rooms;
CREATE POLICY "youtube_rooms_public_delete" ON public.youtube_rooms
    FOR DELETE TO anon, authenticated USING (true);


-- 16. TABLE: yt_chat_messages
CREATE TABLE IF NOT EXISTS public.yt_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.youtube_rooms(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_yt_chat_messages_room_id ON public.yt_chat_messages (room_id);
CREATE INDEX IF NOT EXISTS idx_yt_chat_messages_room_created ON public.yt_chat_messages (room_id, created_at DESC);

ALTER TABLE public.yt_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "yt_chat_public_select" ON public.yt_chat_messages;
CREATE POLICY "yt_chat_public_select" ON public.yt_chat_messages
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "yt_chat_public_insert" ON public.yt_chat_messages;
CREATE POLICY "yt_chat_public_insert" ON public.yt_chat_messages
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "yt_chat_public_delete" ON public.yt_chat_messages;
CREATE POLICY "yt_chat_public_delete" ON public.yt_chat_messages
    FOR DELETE TO anon, authenticated USING (true);


-- 17. TABLE: poster_cache
CREATE TABLE IF NOT EXISTS public.poster_cache (
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

CREATE INDEX IF NOT EXISTS idx_poster_cache_public_url ON public.poster_cache (public_url);
CREATE INDEX IF NOT EXISTS idx_poster_cache_updated ON public.poster_cache (updated_at DESC);

ALTER TABLE public.poster_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read poster cache" ON public.poster_cache;
CREATE POLICY "Public read poster cache" ON public.poster_cache
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service upsert poster cache" ON public.poster_cache;
CREATE POLICY "Service upsert poster cache" ON public.poster_cache
    FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);


-- 18. FUNCTIONS & CLEANUP JOBS
CREATE OR REPLACE FUNCTION public.cleanup_stale_party_rooms(retention_hours integer DEFAULT 12)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.rooms
  WHERE scheduled_start_time < NOW() - (retention_hours || ' hours')::interval;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_party_rooms(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_party_rooms(integer) TO service_role;

-- Notify schema updates
NOTIFY pgrst, 'reload schema';
