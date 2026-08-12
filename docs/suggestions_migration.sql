-- Suggestions & Engagement Feature Migration
-- Creates tables for admin-managed suggestion prompts and user responses

-- ============================================================================
-- Table: suggestions
-- Stores admin-created suggestion prompts that appear to users
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.suggestions (
    id BIGSERIAL PRIMARY KEY,
    prompt TEXT NOT NULL,
    placeholder TEXT DEFAULT 'Write your feedback here…',
    max_length INTEGER DEFAULT 500,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fetching active suggestions
CREATE INDEX IF NOT EXISTS idx_suggestions_is_active ON public.suggestions (is_active);
CREATE INDEX IF NOT EXISTS idx_suggestions_created_at ON public.suggestions (created_at DESC);

-- ============================================================================
-- Table: suggestion_responses
-- Stores user responses to suggestion prompts
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.suggestion_responses (
    id BIGSERIAL PRIMARY KEY,
    suggestion_id BIGINT NOT NULL REFERENCES public.suggestions(id) ON DELETE CASCADE,
    response_text TEXT NOT NULL,
    user_fingerprint TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fetching responses by suggestion
CREATE INDEX IF NOT EXISTS idx_suggestion_responses_suggestion_id ON public.suggestion_responses (suggestion_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_responses_created_at ON public.suggestion_responses (created_at DESC);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestion_responses ENABLE ROW LEVEL SECURITY;

-- Suggestions: Anyone can read active suggestions
CREATE POLICY "Anyone can view active suggestions"
    ON public.suggestions
    FOR SELECT
    USING (is_active = true);

-- Suggestions: Service role can do everything (for admin panel)
CREATE POLICY "Service role can manage suggestions"
    ON public.suggestions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Suggestion Responses: Anyone can insert (anonymous submissions)
CREATE POLICY "Anyone can submit responses"
    ON public.suggestion_responses
    FOR INSERT
    WITH CHECK (true);

-- Suggestion Responses: Service role can read all (for admin panel)
CREATE POLICY "Service role can view all responses"
    ON public.suggestion_responses
    FOR SELECT
    USING (true);

-- Suggestion Responses: Service role can delete (for admin panel)
CREATE POLICY "Service role can delete responses"
    ON public.suggestion_responses
    FOR DELETE
    USING (true);

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE public.suggestions IS 'Admin-created engagement prompts shown to users';
COMMENT ON TABLE public.suggestion_responses IS 'User responses to suggestion prompts';

COMMENT ON COLUMN public.suggestions.prompt IS 'The question/prompt shown to users';
COMMENT ON COLUMN public.suggestions.placeholder IS 'Placeholder text for the response textarea';
COMMENT ON COLUMN public.suggestions.max_length IS 'Maximum character length for responses';
COMMENT ON COLUMN public.suggestions.is_active IS 'Only one suggestion should be active at a time';

COMMENT ON COLUMN public.suggestion_responses.user_fingerprint IS 'Optional anonymous user identifier';
