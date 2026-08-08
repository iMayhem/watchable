import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getSupabaseClient } from '../lib/supabase'

const SCRIPT_ID = 'cf-ad-script'
const FLOATER_SCRIPT_ID = 'cf-ad-floater'
const AD_DOMAIN = 'dc9xwpjprguup.cloudfront.net'

let pollingId: ReturnType<typeof setInterval> | null = null
let pollCount = 0

function injectAd() {
    if (document.getElementById(SCRIPT_ID)) return
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.setAttribute('data-cfasync', 'false')
    script.src = `https://${AD_DOMAIN}/?pwxcd=1436467`
    document.head.appendChild(script)
}

function injectFloater() {
    if (document.getElementById(FLOATER_SCRIPT_ID)) return
    const script = document.createElement('script')
    script.id = FLOATER_SCRIPT_ID
    script.setAttribute('data-cfasync', 'false')
    script.src = `https://${AD_DOMAIN}/?pwxcd=1448933`
    document.head.appendChild(script)
}

function removeAd() {
    ;[SCRIPT_ID, FLOATER_SCRIPT_ID].forEach(id => {
        const el = document.getElementById(id)
        if (el) el.remove()
    })
    document.querySelectorAll(`script[src*="${AD_DOMAIN}"]`).forEach(el => el.remove())
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
        const locallyDisabled = typeof localStorage !== 'undefined' && localStorage.getItem('ads_hidden') === 'true'

        // Ads run on every page (front, browse, detail, player, ...).
        if (isSettingEnabled && !locallyDisabled) {
            if (!enabled.value) {
                injectAd()
                injectFloater()
                enabled.value = true
            }
        } else {
            // If it was enabled before but is now disabled (navigated away from /stream player page)
            if (enabled.value) {
                removeAd()
                enabled.value = false
                
                // Reload page when leaving /stream to completely purge any global window click listeners registered by ad scripts!
                console.log('[Ads] Navigated away from player page, reloading page to clean up ad listeners...')
                window.location.reload()
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
