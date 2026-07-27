-- Add is_hidden column to movora_comments for auto-hiding toxic comments
ALTER TABLE movora_comments ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- Add index for filtering out hidden comments efficiently
CREATE INDEX IF NOT EXISTS idx_movora_comments_is_hidden ON movora_comments (is_hidden);

-- Run this to mark existing hate comments as hidden:
-- UPDATE movora_comments SET is_hidden = TRUE WHERE content ~* 'n[i1l]gg[ea3]r|f[a4]gg[o0]t|r[ e]t[a4r]rd';
