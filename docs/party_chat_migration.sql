-- Ephemeral Watch Together chat (per active session, no history for late joiners)
-- Run once in Supabase → SQL Editor (after rooms_media_migration.sql)

CREATE TABLE IF NOT EXISTS public.party_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_party_chat_messages_room_id
    ON public.party_chat_messages (room_id);

CREATE INDEX IF NOT EXISTS idx_party_chat_messages_room_created
    ON public.party_chat_messages (room_id, created_at DESC);

ALTER TABLE public.party_chat_messages ENABLE ROW LEVEL SECURITY;

-- Clients write messages while in a room; they never read history back.
DROP POLICY IF EXISTS "party_chat_public_insert" ON public.party_chat_messages;
CREATE POLICY "party_chat_public_insert" ON public.party_chat_messages
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Last guest or hourly room cleanup removes rows for empty parties.
DROP POLICY IF EXISTS "party_chat_public_delete" ON public.party_chat_messages;
CREATE POLICY "party_chat_public_delete" ON public.party_chat_messages
    FOR DELETE
    TO anon, authenticated
    USING (true);

NOTIFY pgrst, 'reload schema';