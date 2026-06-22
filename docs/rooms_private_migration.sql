-- Private rooms for Watch Together (required — run once in Supabase SQL Editor)

ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

-- Refresh PostgREST schema cache so the API sees is_private immediately
NOTIFY pgrst, 'reload schema';