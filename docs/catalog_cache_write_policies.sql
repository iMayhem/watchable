-- Allow cache sync scripts to upsert public poster audio metadata.
-- Run once in Supabase SQL Editor if Python sync gets RLS errors.

DROP POLICY IF EXISTS "Service upsert catalog audio cache" ON catalog_audio_cache;
CREATE POLICY "Service upsert catalog audio cache"
    ON catalog_audio_cache
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service upsert anime catalog cache" ON anime_catalog_cache;
CREATE POLICY "Service upsert anime catalog cache"
    ON anime_catalog_cache
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);