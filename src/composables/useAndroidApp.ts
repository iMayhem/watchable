import { ref, computed } from 'vue';
import { ANDROID_APP_CONFIG } from '../constants/androidApp';
import { useToast } from './useToast';

const isAppModalOpen = ref(false);
const STORAGE_KEY = 'streamly_app_modal_dismissed';
let autoPromptTimer: ReturnType<typeof setTimeout> | null = null;

export function useAndroidApp() {
    const { addToast } = useToast();

    const hasDownloadUrl = computed(() => {
        return Boolean(
            ANDROID_APP_CONFIG.apkDownloadUrl &&
            ANDROID_APP_CONFIG.apkDownloadUrl.trim() !== '#' &&
            ANDROID_APP_CONFIG.apkDownloadUrl.trim() !== ''
        );
    });

    const isPromptDismissed = (): boolean => {
        try {
            return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true';
        } catch {
            return false;
        }
    };

    const openAppModal = () => {
        isAppModalOpen.value = true;
    };

    const closeAppModal = () => {
        isAppModalOpen.value = false;
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, 'true');
            }
        } catch {
            // Ignore quota or private-browsing storage restrictions
        }
    };

    const initAutoPrompt = (delayMs: number = 10000) => {
        if (typeof window === 'undefined' || isPromptDismissed()) return;

        if (autoPromptTimer) {
            clearTimeout(autoPromptTimer);
        }

        autoPromptTimer = setTimeout(() => {
            if (isPromptDismissed() || isAppModalOpen.value) return;

            // Don't interrupt if the user navigated to an active video player / stream / party embed
            const path = (window.location.pathname || '').toLowerCase();
            const isStreaming = path.startsWith('/stream') || path.includes('/stream/') || path.includes('party');
            if (!isStreaming) {
                isAppModalOpen.value = true;
            }
        }, delayMs);
    };

    const triggerApkDownload = () => {
        const url = ANDROID_APP_CONFIG.apkDownloadUrl?.trim();
        if (url && url !== '#') {
            addToast(`Starting download: ${ANDROID_APP_CONFIG.appName} v${ANDROID_APP_CONFIG.version}...`, 'info', 4000);

            // Initiate silent download via hidden iframe without opening any new tab
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.top = '-9999px';
            iframe.style.left = '-9999px';
            iframe.style.width = '1px';
            iframe.style.height = '1px';
            iframe.style.opacity = '0';
            iframe.style.pointerEvents = 'none';
            iframe.src = url;
            document.body.appendChild(iframe);
            setTimeout(() => {
                if (iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe);
                }
            }, 60000);
        } else {
            addToast('APK download link will be available soon! Check back shortly.', 'info', 5000);
        }

        // Mark as dismissed so users who downloaded aren't prompted again
        closeAppModal();
    };

    return {
        isAppModalOpen,
        hasDownloadUrl,
        isPromptDismissed,
        openAppModal,
        closeAppModal,
        initAutoPrompt,
        triggerApkDownload,
        config: ANDROID_APP_CONFIG
    };
}
