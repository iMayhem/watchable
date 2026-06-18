-- SQL Migration for Comments feature
-- Run this in your Supabase SQL Editor to create the movora_comments table and set up RLS policies.

CREATE TABLE IF NOT EXISTS movora_comments (
    id BIGSERIAL PRIMARY KEY,
    media_id TEXT NOT NULL,
    media_type TEXT NOT NULL, -- 'movie', 'tv', or 'anime'
    username TEXT NOT NULL, -- The username or 'Guest Name' for non-signed up users
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE movora_comments ENABLE ROW LEVEL SECURITY;

-- Allow anonymous (public) and authenticated read access
CREATE POLICY "Allow public read access on comments" ON movora_comments
    FOR SELECT USING (true);

-- Allow anonymous (public) and authenticated insert access
CREATE POLICY "Allow public insert access on comments" ON movora_comments
    FOR INSERT WITH CHECK (true);
