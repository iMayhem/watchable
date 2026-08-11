import { ref } from 'vue'
import { getSupabaseClient } from '../lib/supabase'
import { getCurrentUser } from '../lib/auth'

export interface Suggestion {
    id: number
    prompt: string
    placeholder: string
    max_length: number
    is_active: boolean
    created_at: string
    updated_at: string
}

const activeSuggestion = ref<Suggestion | null>(null)
const loading = ref(false)
const submitting = ref(false)

const SUGGESTION_SUBMITTED_PREFIX = 'suggestion_submitted_'
const SUGGESTION_DISMISSED_PREFIX = 'suggestion_dismissed_'

export function useSuggestions() {
    async function fetchActiveSuggestion() {
        loading.value = true
        try {
            const supabase = await getSupabaseClient()
            const { data } = await supabase
                .from('suggestions')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            activeSuggestion.value = data ?? null
        } catch (e) {
            console.error('Failed to fetch suggestion:', e)
            activeSuggestion.value = null
        } finally {
            loading.value = false
        }
    }

    async function submitResponse(suggestionId: number, text: string): Promise<boolean> {
        const storageKey = SUGGESTION_SUBMITTED_PREFIX + suggestionId
        if (localStorage.getItem(storageKey)) return false

        submitting.value = true
        try {
            const supabase = await getSupabaseClient()
            const username = getCurrentUser()
            await supabase.from('suggestion_responses').insert({
                suggestion_id: suggestionId,
                text: text.trim(),
                username: username || null,
                submitted_at: new Date().toISOString()
            })
            localStorage.setItem(storageKey, 'true')
            return true
        } catch (e) {
            console.error('Failed to submit suggestion response:', e)
            return false
        } finally {
            submitting.value = false
        }
    }

    function hasSubmitted(suggestionId: number): boolean {
        return localStorage.getItem(SUGGESTION_SUBMITTED_PREFIX + suggestionId) === 'true'
    }

    function hasDismissed(suggestionId: number): boolean {
        return localStorage.getItem(SUGGESTION_DISMISSED_PREFIX + suggestionId) === 'true'
    }

    function dismiss(suggestionId: number) {
        localStorage.setItem(SUGGESTION_DISMISSED_PREFIX + suggestionId, 'true')
    }

    return {
        activeSuggestion,
        loading,
        submitting,
        fetchActiveSuggestion,
        submitResponse,
        hasSubmitted,
        hasDismissed,
        dismiss,
    }
}
