import { ref, computed } from 'vue';
import { ANDROID_APP_CONFIG } from '../constants/androidApp';
import { useToast } from './useToast';

const isAppModalOpen = ref(false);

export function useAndroidApp() {
    const { addToast } = useToast();

    const hasDownloadUrl = computed(() => {
        return Boolean(ANDROID_APP_CONFIG.apkDownloadUrl && ANDROID_APP_CONFIG.apkDownloadUrl.trim() !== '#' && ANDROID_APP_CONFIG.apkDownloadUrl.trim() !== '');
    });

    const openAppModal = () => {
        isAppModalOpen.value = true;
    };

    const closeAppModal = () => {
        isAppModalOpen.value = false;
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
    };

    return {
        isAppModalOpen,
        hasDownloadUrl,
        openAppModal,
        closeAppModal,
        triggerApkDownload,
        config: ANDROID_APP_CONFIG
    };
}
