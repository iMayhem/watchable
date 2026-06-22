-- Private rooms for Watch Together
-- Run once in Supabase → SQL Editor

ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

-- Anonymous party clients must be able to UPDATE rooms (privacy, activity, embed sync).
-- Without this policy, PATCH returns 204 but changes are silently blocked by RLS.
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rooms_public_update" ON rooms;
CREATE POLICY "rooms_public_update" ON rooms
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

NOTIFY pgrst, 'reload schema';