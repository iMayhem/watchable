import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getSupabaseClient } from '../lib/supabase'

const AD_SRC = atob('aHR0cHM6Ly9jaGV3c2V2ZXIuY29tLzFhLzI2LzAwLzFhMjYwMDM4ZTdiOWE5ZTFkNWM5ODU1Nzg5NDA2YWVjLmpz')
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
    const route = useRoute()
    const key = type === 'pc' ? 'ads_pc_enabled' : 'ads_mobile_enabled'
    const enabled = ref(false)

    async function refresh() {
        const isSettingEnabled = await fetchAdSetting(key)
        const isAllowedPage = route.path === '/' || route.path.includes('/search')
        
        if (isSettingEnabled && isAllowedPage) {
            if (!enabled.value) {
                injectAd()
                enabled.value = true
            }
        } else {
            if (enabled.value) {
                removeAd()
                enabled.value = false
            }
        }
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

    watch(() => route.path, () => {
        refresh()
    })

    function onVisibility() {
        if (document.visibilityState === 'visible') refresh()
    }

    return { enabled, refresh }
}
