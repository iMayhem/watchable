-- Add private-room support for Watch Together
-- Run this in your Supabase SQL Editor

ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;