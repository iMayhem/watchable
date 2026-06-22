-- Add private-room support for Watch Together
-- Run this in your Supabase SQL Editor, then wait ~1 min for schema cache refresh.

ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

-- Rooms already allow client updates (scheduled_start_time, embed_sources).
-- If privacy updates still fail, ensure your rooms UPDATE policy permits anon updates:
--
-- CREATE POLICY "Allow public update access on rooms" ON rooms
--     FOR UPDATE USING (true) WITH CHECK (true);