-- ====================================================================
-- SUPABASE DATABASE HARDENING & SECURITY LOCKDOWN SCRIPT
-- ====================================================================
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/eeyiragtylotiwozbgqp/sql
-- ====================================================================

-- 1. ENABLE RLS ON ALL PUBLIC TABLES
ALTER TABLE IF EXISTS public.movora_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.anime_catalog_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.catalog_audio_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.catalog_enrichment_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.movora_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.movora_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.party_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.youtube_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.yt_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.poster_cache ENABLE ROW LEVEL SECURITY;

-- 2. LOCK DOWN APP SETTINGS (PUBLIC READ-ONLY, SERVICE WRITE-ONLY)
DROP POLICY IF EXISTS "Service write app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Public read app settings" ON public.app_settings;

CREATE POLICY "Public read app settings" ON public.app_settings
    FOR SELECT TO anon, authenticated, service_role USING (true);

CREATE POLICY "Service role write app settings" ON public.app_settings
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. LOCK DOWN NOTIFICATIONS & BANNERS (PUBLIC READ-ONLY, SERVICE WRITE-ONLY)
DROP POLICY IF EXISTS "Service upsert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Public read notifications" ON public.notifications;

CREATE POLICY "Public read notifications" ON public.notifications
    FOR SELECT TO anon, authenticated, service_role USING (true);

CREATE POLICY "Service write notifications" ON public.notifications
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service upsert banners" ON public.banners;
DROP POLICY IF EXISTS "Public read banners" ON public.banners;

CREATE POLICY "Public read banners" ON public.banners
    FOR SELECT TO anon, authenticated, service_role USING (true);

CREATE POLICY "Service write banners" ON public.banners
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. LOCK DOWN POLLS (PUBLIC READ-ONLY, SERVICE WRITE-ONLY)
DROP POLICY IF EXISTS "Service upsert polls" ON public.polls;
DROP POLICY IF EXISTS "Public read polls" ON public.polls;

CREATE POLICY "Public read polls" ON public.polls
    FOR SELECT TO anon, authenticated, service_role USING (true);

CREATE POLICY "Service write polls" ON public.polls
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. LOCK DOWN CATALOG CACHE TABLES (PUBLIC READ-ONLY, SERVICE WRITE-ONLY)
DROP POLICY IF EXISTS "Service upsert anime catalog cache" ON public.anime_catalog_cache;
CREATE POLICY "Service write anime catalog cache" ON public.anime_catalog_cache
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service upsert catalog audio cache" ON public.catalog_audio_cache;
CREATE POLICY "Service write catalog audio cache" ON public.catalog_audio_cache
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service upsert catalog enrichment cache" ON public.catalog_enrichment_cache;
CREATE POLICY "Service write catalog enrichment cache" ON public.catalog_enrichment_cache
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service upsert poster cache" ON public.poster_cache;
CREATE POLICY "Service write poster cache" ON public.poster_cache
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. PROTECT ROOMS & PARTY CHAT (PREVENT BLANKET MASS-DELETE BY ANONYMOUS USERS)
DROP POLICY IF EXISTS "rooms_public_delete" ON public.rooms;
CREATE POLICY "rooms_service_delete" ON public.rooms
    FOR DELETE TO service_role USING (true);

DROP POLICY IF EXISTS "party_chat_public_delete" ON public.party_chat_messages;
CREATE POLICY "party_chat_service_delete" ON public.party_chat_messages
    FOR DELETE TO service_role USING (true);

DROP POLICY IF EXISTS "youtube_rooms_public_delete" ON public.youtube_rooms;
CREATE POLICY "youtube_rooms_service_delete" ON public.youtube_rooms
    FOR DELETE TO service_role USING (true);

DROP POLICY IF EXISTS "yt_chat_public_delete" ON public.yt_chat_messages;
CREATE POLICY "yt_chat_service_delete" ON public.yt_chat_messages
    FOR DELETE TO service_role USING (true);

-- 7. NOTIFY POSTGREST TO RELOAD SCHEMA IMMEDIATELY
NOTIFY pgrst, 'reload schema';
