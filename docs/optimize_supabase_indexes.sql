-- Migration: Optimize Supabase indexes for zero CPU load on page views
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Index app_settings by key (eliminates full table scans on settings queries)
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- 2. Index notifications by created_at DESC (fast notification feed)
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- 3. Index polls by created_at DESC and is_active (fast poll checks)
CREATE INDEX IF NOT EXISTS idx_polls_active_created ON polls(is_active, created_at DESC);

-- 4. Index movora_comments by media_id and media_type (fast comment lookups)
CREATE INDEX IF NOT EXISTS idx_movora_comments_media ON movora_comments(media_type, media_id);

-- 5. Index party rooms by code and is_active
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code) WHERE is_active = true;
