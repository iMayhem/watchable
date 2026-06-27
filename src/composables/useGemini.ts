import { ref } from 'vue'
import useAxios from './useAxios'

const GEMINI_API_KEY = 'AQ.Ab8RN6KgcyH2_vO2ypghUvPKXO-tg-soP2ODRS0X2NOzZixTzQ'
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent'

export interface GeminiSuggestion {
    id: number
    title: string
    type: 'movie' | 'tv'
    reason: string
    posterPath: string | null
}

const suggestion = ref<GeminiSuggestion | null>(null)
const loading = ref(false)
const error = ref('')

export function useGemini() {
    const getSuggestion = async () => {
        loading.value = true
        error.value = ''

        try {
            const prompt = `You are a movie and TV show recommender. Suggest ONE random title the user might enjoy. Return ONLY valid JSON (no markdown, no backticks) with this exact structure:
{
  "title": "Movie or TV Show Title",
  "type": "movie or tv",
  "reason": "A short 1-sentence reason why they'd enjoy it"
}
Pick something popular and well-known. Do not include any text before or after the JSON.`

            const res = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                })
            })

            if (!res.ok) {
                const errText = await res.text()
                throw new Error(`Gemini API error: ${res.status} ${errText}`)
            }

            const data = await res.json()
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
            const parsed = JSON.parse(text)

            const searchRes = await useAxios().get('search/multi', {
                params: {
                    query: parsed.title,
                    page: 1
                }
            })

            const results = searchRes.data?.results ?? []
            const match = results.find((r: any) =>
                (r.media_type === 'movie' || r.media_type === 'tv') &&
                r.title?.toLowerCase() === parsed.title.toLowerCase()
            ) || results.find((r: any) =>
                r.media_type === 'movie' || r.media_type === 'tv'
            )

            if (match) {
                suggestion.value = {
                    id: match.id,
                    title: match.title || match.name,
                    type: match.media_type,
                    reason: parsed.reason,
                    posterPath: match.poster_path || null
                }
            } else {
                suggestion.value = {
                    id: 0,
                    title: parsed.title,
                    type: parsed.type,
                    reason: parsed.reason,
                    posterPath: null
                }
            }
        } catch (err: any) {
            console.error('[🤖 Gemini] Failed to get suggestion:', err)
            error.value = err.message || 'Failed to get suggestion'
            suggestion.value = null
        } finally {
            loading.value = false
        }
    }

    const clearSuggestion = () => {
        suggestion.value = null
        error.value = ''
    }

    return {
        suggestion,
        loading,
        error,
        getSuggestion,
        clearSuggestion
    }
}
