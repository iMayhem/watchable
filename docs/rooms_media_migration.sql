-- Separate movie/catalog id from unique party room id
-- Run once in Supabase → SQL Editor (after rooms_private_migration.sql)

ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS media_id TEXT;

-- Backfill existing rows: embed_sources held the catalog key for movie parties
UPDATE rooms
SET media_id = embed_sources
WHERE media_id IS NULL AND embed_sources IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rooms_media_id ON rooms (media_id);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- Each Watch Together host inserts their own row (unique id, same media_id is OK)
DROP POLICY IF EXISTS "rooms_public_insert" ON rooms;
CREATE POLICY "rooms_public_insert" ON rooms
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "rooms_public_update" ON rooms;
CREATE POLICY "rooms_public_update" ON rooms
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

NOTIFY pgrst, 'reload schema';