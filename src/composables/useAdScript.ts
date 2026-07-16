import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getSupabaseClient } from '../lib/supabase'

const SCRIPT_ID = 'adsterra-ad-script'
const AD_DOMAIN = 'chewsever.com'

let pollingId: ReturnType<typeof setInterval> | null = null
let pollCount = 0
let originalOpen: typeof window.open | null = null

// Initialize window.open interceptor to prevent popups when ads are turned off
if (typeof window !== 'undefined') {
    (window as any).adsAllowed = false;
    originalOpen = window.open;
    window.open = function () {
        if (!(window as any).adsAllowed) {
            console.log('[🛡️ AdBlocker] Blocked ad popup window.open');
            return null;
        }
        return originalOpen ? originalOpen.apply(this, arguments as any) : null;
    };
}

function injectAd() {
    if (document.getElementById(SCRIPT_ID)) return
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = `https://${AD_DOMAIN}/1a/26/00/1a260038e7b9a9e1d5c9855789406aec.js`
    document.head.appendChild(script)
}

function removeAd() {
    const wrapper = document.getElementById(SCRIPT_ID)
    if (wrapper) wrapper.remove()
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
        const isAllowedPage = route.path === '/' || route.path.includes('/search')
        const locallyDisabled = typeof localStorage !== 'undefined' && localStorage.getItem('ads_hidden') === 'true'
        
        // Update global window variable for interceptor
        if (typeof window !== 'undefined') {
            (window as any).adsAllowed = isSettingEnabled && isAllowedPage && !locallyDisabled;
        }

        if (isSettingEnabled && isAllowedPage && !locallyDisabled) {
            if (!enabled.value) {
                injectAd()
                enabled.value = true
            }
        } else {
            // If it was enabled before but is now disabled (e.g. toggled off or navigated away)
            if (enabled.value) {
                removeAd()
                enabled.value = false
                
                // If the setting itself was turned off in the admin panel, reload the page to clear listeners
                if (!isSettingEnabled) {
                    console.log('[🛡️ AdBlocker] Ads toggled off in admin, reloading page to clean up...');
                    window.location.reload()
                }
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
