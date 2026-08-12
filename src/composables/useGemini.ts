import { ref } from 'vue'
import useAxios from './useAxios'
import { getSyncClient } from '../lib/syncClient'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

const recentTitles: string[] = []
const MAX_RECENT = 25

let cachedKeys: string[] = [];
let keysLoaded = false;

export async function loadGroqKeys(): Promise<string[]> {
    if (keysLoaded) return cachedKeys;
    try {
        const sync = await getSyncClient();
        const { data } = await sync
            .from('app_settings')
            .select('value')
            .eq('key', 'groq_keys')
            .single();
        if (data && data.value) {
            const parsed = JSON.parse(data.value);
            if (Array.isArray(parsed) && parsed.length > 0) {
                cachedKeys = parsed;
                keysLoaded = true;
                return cachedKeys;
            }
        }
    } catch (err) {
        console.warn('[AI] Error fetching keys from Sync:', err);
    }
    const fallbackKey = import.meta.env.VITE_GROQ_API_KEY || '';
    return [fallbackKey];
}

export async function updateKeyUsage(
    keyIndex: number,
    status: 'active' | 'quota_exceeded' | 'rate_limited' | 'invalid' | 'unknown',
    headers: Headers | null,
    errorMessage = ''
) {
    try {
        const sync = await getSyncClient();
        const { data: existing } = await sync
            .from('app_settings')
            .select('value')
            .eq('key', 'groq_keys_status')
            .single();

        let stats: any[] = Array.from({ length: 3 }, (_, i) => ({
            key_index: i,
            status: 'unknown',
            requests_count: 0,
            error_message: '',
            remaining_requests: null,
            limit_requests: null,
            reset_time_seconds: null,
            last_used: null
        }));

        if (existing && existing.value) {
            try {
                stats = JSON.parse(existing.value);
            } catch {}
        }

        if (!stats[keyIndex]) {
            stats[keyIndex] = { key_index: keyIndex };
        }

        const stat = stats[keyIndex];
        stat.status = status;
        stat.last_used = new Date().toISOString();
        if (errorMessage) {
            stat.error_message = errorMessage;
        } else {
            stat.error_message = '';
        }
        stat.requests_count = (stat.requests_count || 0) + 1;

        if (headers) {
            const rem = headers.get('x-ratelimit-remaining-requests');
            const lim = headers.get('x-ratelimit-limit-requests');
            const resVal = headers.get('x-ratelimit-reset-requests');

            if (rem !== null) stat.remaining_requests = parseInt(rem, 10);
            if (lim !== null) stat.limit_requests = parseInt(lim, 10);
            if (resVal !== null) stat.reset_time_seconds = resVal;
        }

        await sync
            .from('app_settings')
            .upsert({
                key: 'groq_keys_status',
                value: JSON.stringify(stats),
                updated_at: new Date()
            }, { onConflict: 'key' });
    } catch (err) {
        console.error('[AI] Error updating key usage in Sync:', err);
    }
}

export interface GeminiSuggestion {
    id: number
    title: string
    type: 'movie' | 'tv'
    reason: string
    posterPath: string | null
}

const suggestion = ref<GeminiSuggestion | null>(null)
const suggestions = ref<GeminiSuggestion[]>([])
const loading = ref(false)
const error = ref('')

const FALLBACKS: Array<{ title: string; type: 'movie' | 'tv' }> = [
    { title: 'The Shawshank Redemption', type: 'movie' },
    { title: 'Inception', type: 'movie' },
    { title: 'The Dark Knight', type: 'movie' },
    { title: 'Interstellar', type: 'movie' },
    { title: 'Parasite', type: 'movie' },
    { title: 'Pulp Fiction', type: 'movie' },
    { title: 'Fight Club', type: 'movie' },
    { title: 'The Matrix', type: 'movie' },
    { title: 'Breaking Bad', type: 'tv' },
    { title: 'Stranger Things', type: 'tv' },
    { title: 'Game of Thrones', type: 'tv' },
    { title: 'The Office', type: 'tv' }
]


async function pickFallback() {
    const excludeLower = recentTitles.map(t => t.toLowerCase())
    const available = FALLBACKS.filter(f => !excludeLower.includes(f.title.toLowerCase()))
    const pool = available.length > 0 ? available : FALLBACKS
    
    // Pick 3 unique fallbacks
    const shuffled = [...pool].sort(() => 0.5 - Math.random())
    const chosen = shuffled.slice(0, 3)
    
    const resolved = await Promise.all(chosen.map(async (pick) => {
        try {
            const searchRes = await useAxios().get('search/multi', {
                params: { query: pick.title, page: 1 }
            })
            const results = searchRes.data?.results ?? []
            const match = results.find((r: any) => r.media_type === pick.type)
            if (match) {
                return {
                    id: match.id,
                    title: match.title || match.name,
                    type: match.media_type,
                    reason: 'A popular pick you might enjoy!',
                    posterPath: match.poster_path || null
                }
            }
        } catch {}
        return {
            id: 0,
            title: pick.title,
            type: pick.type,
            reason: 'A popular pick you might enjoy!',
            posterPath: null
        }
    }))
    
    suggestions.value = resolved
    if (resolved.length > 0) {
        suggestion.value = resolved[0]
        resolved.forEach(r => {
            recentTitles.push(r.title)
        })
        while (recentTitles.length > MAX_RECENT) recentTitles.shift()
    }
    loading.value = false
}

function extractJson(text: string): string {
    text = text.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim()
    const arrayStart = text.indexOf('[')
    const braceStart = text.indexOf('{')
    
    // We prefer array format
    const startIdx = (arrayStart !== -1 && (braceStart === -1 || arrayStart < braceStart)) ? arrayStart : braceStart
    if (startIdx === -1) {
        throw new Error('No JSON content found in response')
    }
    
    let depth = 0
    let endIdx = -1
    const openChar = text[startIdx]
    const closeChar = openChar === '[' ? ']' : '}'
    
    for (let i = startIdx; i < text.length; i++) {
        if (text[i] === openChar) depth++
        else if (text[i] === closeChar) {
            depth--
            if (depth === 0) { endIdx = i; break }
        }
    }
    
    if (endIdx === -1) throw new Error('Unbalanced braces or brackets in response')
    return text.slice(startIdx, endIdx + 1)
}

async function logSearchToSync(query: string) {
    try {
        const sync = await getSyncClient();
        await sync.from('movora_ai_searches').insert([{
            query: query.trim(),
            created_at: new Date().toISOString()
        }]);
    } catch (e) {
        console.error("Failed to log AI search query to Sync:", e);
    }
}

export function useGemini() {
    const getSuggestion = async (moodOrKind?: string) => {
        loading.value = true
        error.value = ''
        if (moodOrKind && moodOrKind.trim()) {
            void logSearchToSync(moodOrKind);
        }

        try {
            const excludeList = recentTitles.length > 0
                ? ` CRITICAL: You MUST NOT recommend any of the following titles under any circumstances (they have already been seen or rejected by the user): ${recentTitles.join(', ')}.`
                : ''

            const prompt = `You are a movie and TV recommender. Recommend THREE titles the user might enjoy based on this request/mood: "${moodOrKind || 'any popular vibe'}". Return ONLY a valid JSON array of objects with no other text:
[
  {"title": "...", "type": "movie or tv", "reason": "Short 1-sentence reason why it matches the request"}
]
Pick different, interesting titles. CRITICAL: All nested quotes within property values (like in the 'reason' or 'title' fields) MUST be escaped with a backslash (e.g., \\\"must-watch\\\") or replaced with single quotes so that the JSON is fully valid and parseable.${excludeList}`

            const keys = await loadGroqKeys();
            let stats: any[] = [];
            try {
                const sync = await getSyncClient();
                const { data: statusData } = await sync
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'groq_keys_status')
                    .single();
                if (statusData && statusData.value) {
                    stats = JSON.parse(statusData.value);
                }
            } catch (err) {
                console.warn('[AI] Could not fetch key statuses for rate limit bypass:', err);
            }

            let viableKeys = keys.map((key, index) => {
                const keyStat = stats.find((s: any) => s.key_index === index);
                if (keyStat) {
                    const isLimitStatus = keyStat.status === 'rate_limited' || keyStat.status === 'quota_exceeded';
                    const hasNoRemaining = keyStat.remaining_requests === 0;
                    if (isLimitStatus || hasNoRemaining) {
                        return { key, index, viable: false };
                    }
                }
                return { key, index, viable: true };
            });

            if (!viableKeys.some(vk => vk.viable)) {
                viableKeys = viableKeys.map(vk => ({ ...vk, viable: true }));
            }

            let lastError: Error | null = null;
            let responseData: any = null;

            for (const vk of viableKeys) {
                if (!vk.viable) {
                    console.log(`[AI] Automatically bypassing rate-limited/exhausted key index ${vk.index}`);
                    continue;
                }
                const currentKey = vk.key;
                const i = vk.index;
                try {
                    console.log(`[AI] Attempting Groq request with key index ${i}`);
                    const res = await fetch(GROQ_API_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${currentKey}`
                        },
                        body: JSON.stringify({
                            model: MODEL,
                            messages: [
                                { role: 'system', content: 'You respond only with valid JSON objects or arrays and nothing else.' },
                                { role: 'user', content: prompt }
                            ],
                            max_tokens: 400,
                            temperature: 1.0
                        })
                    });

                    if (!res.ok) {
                        const errText = await res.text();
                        let status: 'quota_exceeded' | 'rate_limited' | 'invalid' = 'invalid';
                        if (res.status === 429 || errText.toLowerCase().includes('quota') || errText.toLowerCase().includes('rate limit')) {
                            status = res.status === 429 ? 'rate_limited' : 'quota_exceeded';
                        }
                        void updateKeyUsage(i, status, res.headers, `HTTP ${res.status}: ${errText}`);
                        throw new Error(`HTTP ${res.status}: ${errText}`);
                    }

                    void updateKeyUsage(i, 'active', res.headers);
                    responseData = await res.json();
                    lastError = null;
                    break;
                } catch (err: any) {
                    console.warn(`[AI] Key index ${i} failed:`, err.message);
                    lastError = err;
                }
            }

            if (lastError || !responseData) {
                throw lastError || new Error('All Groq keys failed.');
            }

            const text = responseData?.choices?.[0]?.message?.content || ''

            if (!text.trim()) {
                console.warn('[AI] Empty response, using fallback')
                return pickFallback()
            }

            const json = extractJson(text)
            let parsed
            try {
                parsed = JSON.parse(json)
            } catch (err) {
                console.warn('[AI] JSON.parse failed, attempting simple regex recovery:', err)
                const matches = [...json.matchAll(/\{\s*"title"\s*:\s*"([\s\S]*?)"\s*,\s*"type"\s*:\s*"([\s\S]*?)"\s*,\s*"reason"\s*:\s*"([\s\S]*?)"\s*\}/g)]
                if (matches.length > 0) {
                    parsed = matches.map(m => ({
                        title: m[1],
                        type: m[2],
                        reason: m[3]
                    }))
                } else {
                    throw err
                }
            }
            const rawItems = Array.isArray(parsed) ? parsed : [parsed]

            const resolvedItems = await Promise.all(
                rawItems.slice(0, 3).map(async (item: any) => {
                    try {
                        const searchRes = await useAxios().get('search/multi', {
                            params: { query: item.title, page: 1 }
                        })
                        const results = searchRes.data?.results ?? []
                        
                        let match = null;
                        let bestScore = -1;

                        for (const r of results) {
                            if (r.media_type !== 'movie' && r.media_type !== 'tv') continue;
                            
                            let score = 0;
                            const rTitle = (r.title || r.name || '').toLowerCase();
                            const itemTitle = (item.title || '').toLowerCase();

                            // 1. Media type matches LLM recommendation
                            const targetType = String(item.type).toLowerCase() === 'tv' ? 'tv' : 'movie';
                            if (r.media_type === targetType) {
                                score += 10;
                            }

                            // 2. Title matching
                            if (rTitle === itemTitle) {
                                score += 100;
                            } else if (rTitle.includes(itemTitle) || itemTitle.includes(rTitle)) {
                                score += 50;
                            }

                            // 3. Add popularity scaling (capped to avoid overriding matches)
                            score += Math.min((r.popularity || 0) / 50, 20);

                            if (score > bestScore) {
                                bestScore = score;
                                match = r;
                            }
                        }

                        if (match) {
                            return {
                                id: match.id,
                                title: match.title || match.name,
                                type: match.media_type,
                                reason: item.reason,
                                posterPath: match.poster_path || null
                            }
                        }
                    } catch {}
                    return {
                        id: 0,
                        title: item.title,
                        type: item.type === 'tv' ? 'tv' as const : 'movie' as const,
                        reason: item.reason,
                        posterPath: null
                    }
                })
            )

            suggestions.value = resolvedItems
            if (resolvedItems.length > 0) {
                suggestion.value = resolvedItems[0]
                resolvedItems.forEach(item => {
                    recentTitles.push(item.title)
                })
                while (recentTitles.length > MAX_RECENT) recentTitles.shift()
            }
        } catch (err: any) {
            console.error('[AI] Failed to get suggestions:', err)
            error.value = err.message || 'Failed to get suggestions'
            suggestions.value = []
            suggestion.value = null
        } finally {
            loading.value = false
        }
    }

    const clearSuggestion = () => {
        suggestion.value = null
        suggestions.value = []
        error.value = ''
    }

    return {
        suggestion,
        suggestions,
        loading,
        error,
        getSuggestion,
        clearSuggestion
    }
}
