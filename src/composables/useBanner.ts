import { ref } from 'vue'
import { getSupabaseClient } from '../lib/supabase'

export interface Banner {
    id: number
    message: string
    link: string
    bg_color: string
    text_color: string
    is_active: boolean
    created_at: string
    updated_at: string
}

const activeBanner = ref<Banner | null>(null)
const loading = ref(false)

export function useBanner() {
    async function fetchActiveBanner() {
        loading.value = true
        try {
            const supabase = await getSupabaseClient()
            const { data } = await supabase
                .from('banners')
                .select('id, message, link, bg_color, text_color, is_active, created_at')
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            activeBanner.value = data || null
        } catch (e) {
            console.error('Failed to fetch banner:', e)
            activeBanner.value = null
        } finally {
            loading.value = false
        }
    }

    return {
        activeBanner,
        loading,
        fetchActiveBanner
    }
}
