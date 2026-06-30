import { ref, onMounted, onBeforeUnmount } from 'vue'
import { getSupabaseClient } from '../lib/supabase'

const AD_SRC = 'https://pl30115432.effectivecpmnetwork.com/1a/26/00/1a260038e7b9a9e1d5c9855789406aec.js'
const SCRIPT_ID = 'adsterra-ad-script'

let pollingId: ReturnType<typeof setInterval> | null = null
let pollCount = 0

function injectAd() {
    if (document.getElementById(SCRIPT_ID)) return
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = AD_SRC
    script.async = true
    document.head.appendChild(script)
}

function removeAd() {
    const el = document.getElementById(SCRIPT_ID)
    if (el) el.remove()
}

async function fetchAdSetting(key: string): Promise<boolean> {
    try {
        const client = await getSupabaseClient()
        const { data } = await client.from('app_settings').select('value').eq('key', key).single()
        return data?.value === 'true'
    } catch {
        return false
    }
}

export function useAdScript(type: 'pc' | 'mobile') {
    const key = type === 'pc' ? 'ads_pc_enabled' : 'ads_mobile_enabled'
    const enabled = ref(false)

    async function refresh() {
        const newVal = await fetchAdSetting(key)
        if (newVal && !enabled.value) {
            injectAd()
        } else if (!newVal && enabled.value) {
            removeAd()
        }
        enabled.value = newVal
    }

    onMounted(() => {
        refresh()
        if (!pollingId) {
            pollingId = setInterval(() => {
                pollCount++
                refresh()
                if (pollCount > 120) {
                    clearInterval(pollingId!)
                    pollingId = null
                }
            }, 30000)
        }
        document.addEventListener('visibilitychange', onVisibility)
    })

    onBeforeUnmount(() => {
        document.removeEventListener('visibilitychange', onVisibility)
    })

    function onVisibility() {
        if (document.visibilityState === 'visible') refresh()
    }

    return { enabled, refresh }
}
