-- YouTube Watch Party rooms
-- Run once in Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS youtube_rooms (
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

CREATE INDEX IF NOT EXISTS idx_youtube_rooms_created_at
    ON youtube_rooms (created_at DESC);

ALTER TABLE youtube_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "youtube_rooms_public_select" ON youtube_rooms;
CREATE POLICY "youtube_rooms_public_select" ON youtube_rooms
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "youtube_rooms_public_insert" ON youtube_rooms;
CREATE POLICY "youtube_rooms_public_insert" ON youtube_rooms
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "youtube_rooms_public_update" ON youtube_rooms;
CREATE POLICY "youtube_rooms_public_update" ON youtube_rooms
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "youtube_rooms_public_delete" ON youtube_rooms;
CREATE POLICY "youtube_rooms_public_delete" ON youtube_rooms
    FOR DELETE
    TO anon, authenticated
    USING (true);

ALTER TABLE youtube_rooms ADD COLUMN IF NOT EXISTS queue JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE youtube_rooms ADD COLUMN IF NOT EXISTS skip_votes JSONB NOT NULL DEFAULT '[]'::jsonb;

-- YouTube Party chat messages (separate from regular Watcha Party)
CREATE TABLE IF NOT EXISTS yt_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES youtube_rooms(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_yt_chat_messages_room_id
    ON yt_chat_messages (room_id);

CREATE INDEX IF NOT EXISTS idx_yt_chat_messages_room_created
    ON yt_chat_messages (room_id, created_at DESC);

ALTER TABLE yt_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "yt_chat_public_insert" ON yt_chat_messages;
CREATE POLICY "yt_chat_public_insert" ON yt_chat_messages
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "yt_chat_public_select" ON yt_chat_messages;
CREATE POLICY "yt_chat_public_select" ON yt_chat_messages
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "yt_chat_public_delete" ON yt_chat_messages;
CREATE POLICY "yt_chat_public_delete" ON yt_chat_messages
    FOR DELETE
    TO anon, authenticated
    USING (true);

NOTIFY pgrst, 'reload schema';
