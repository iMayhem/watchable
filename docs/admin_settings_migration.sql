-- SQL Migration for Global Default Server and Admin Passcode
-- Run this in your Supabase SQL Editor to create the app_settings table and set up RLS policies.

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow anonymous (public) and authenticated read access
CREATE POLICY "Allow public read access" ON app_settings
    FOR SELECT USING (true);

-- Allow anonymous (public) and authenticated insert/update/delete access
-- This ensures the admin panel can update settings directly from the client.
CREATE POLICY "Allow public insert/update access" ON app_settings
    FOR ALL USING (true) WITH CHECK (true);

-- Insert default value for default_provider
INSERT INTO app_settings (key, value)
VALUES ('default_provider', 'rasmalai')
ON CONFLICT (key) DO NOTHING;

-- Insert default value for admin_passcode (default: admin123)
INSERT INTO app_settings (key, value)
VALUES ('admin_passcode', 'admin123')
ON CONFLICT (key) DO NOTHING;
