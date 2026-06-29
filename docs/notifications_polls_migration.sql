-- SQL Migration for Notifications, Banners, and Polls
-- Run this in your Supabase SQL Editor after the app_settings migration.

-- ── Notifications ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'info',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT DEFAULT 'admin'
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON notifications
    FOR SELECT USING (true);

CREATE POLICY "Allow all for notifications" ON notifications
    FOR ALL USING (true) WITH CHECK (true);

-- ── Notification Reads (track per-user read status) ────────────────────────────
CREATE TABLE IF NOT EXISTS notification_reads (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    notification_id BIGINT REFERENCES notifications(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(notification_id, username)
);

ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read/write notification_reads" ON notification_reads
    FOR ALL USING (true) WITH CHECK (true);

-- ── Banners ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS banners (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message TEXT NOT NULL DEFAULT '',
    link TEXT DEFAULT '',
    bg_color TEXT DEFAULT '#ff5a1f',
    text_color TEXT DEFAULT '#ffffff',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON banners
    FOR SELECT USING (true);

CREATE POLICY "Allow all for banners" ON banners
    FOR ALL USING (true) WITH CHECK (true);

INSERT INTO banners (message, link, is_active)
VALUES ('', '', false)
ON CONFLICT DO NOTHING;

-- ── Polls ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS polls (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    question TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON polls
    FOR SELECT USING (true);

CREATE POLICY "Allow all for polls" ON polls
    FOR ALL USING (true) WITH CHECK (true);

-- ── Poll Votes (anonymous — no username tracking) ──────────────────────────────
CREATE TABLE IF NOT EXISTS poll_votes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    poll_id BIGINT REFERENCES polls(id) ON DELETE CASCADE,
    selected_option INT NOT NULL,
    voted_at TIMESTAMPTZ DEFAULT NOW()
);

-- If you already ran the previous migration with username/unique constraint, run:
--   ALTER TABLE poll_votes DROP CONSTRAINT IF EXISTS poll_votes_poll_id_username_key;
--   ALTER TABLE poll_votes DROP COLUMN IF EXISTS username;

ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read/write poll_votes" ON poll_votes
    FOR ALL USING (true) WITH CHECK (true);
