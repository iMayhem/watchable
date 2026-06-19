import { onBeforeUnmount, onMounted, ref } from 'vue';
import { nfDebug } from './useNetflixDebug';

export interface StreamExtensionInfo {
    active: boolean;
    version?: string;
    mode?: string;
}

function readWindowFlag(): StreamExtensionInfo | null {
    const ext = (window as any).__MOOVIE_STREAM_EXT__;
    if (ext?.active) return ext as StreamExtensionInfo;
    return null;
}

export function useStreamExtension() {
    const extensionActive = ref(false);
    const extensionInfo = ref<StreamExtensionInfo | null>(null);

    const applyDetection = (info: StreamExtensionInfo | null, source: string) => {
        const active = Boolean(info?.active);
        // Window-flag reads can be null in the page JS world; never downgrade a
        // confirmed pong/ready detection — that was flipping extension off every 1.5s.
        if (!active && extensionActive.value && source === 'window-flag') {
            return;
        }
        if (active !== extensionActive.value) {
            nfDebug('extension:detected', { active, source, version: info?.version, mode: info?.mode });
            extensionActive.value = active;
            extensionInfo.value = info;
        } else if (active && info) {
            extensionInfo.value = info;
        }
    };

    const checkExtension = () => {
        const info = readWindowFlag();
        if (info?.active) {
            applyDetection(info, 'window-flag');
        }
    };

    const onExtensionReady = (event: Event) => {
        const detail = (event as CustomEvent<StreamExtensionInfo>).detail;
        nfDebug('extension:ready-event', { active: detail?.active, version: detail?.version });
        if (detail?.active) {
            applyDetection(detail, 'ready-event');
            return;
        }
        checkExtension();
    };

    const onExtensionPong = (event: MessageEvent) => {
        if (event.source !== window || event.data?.type !== 'MOOVIE_EXT_PONG') return;
        const detail = event.data.detail as StreamExtensionInfo | undefined;
        nfDebug('extension:pong', { active: detail?.active, version: detail?.version });
        if (detail?.active) {
            applyDetection(detail, 'pong');
        }
    };

    const pingExtension = () => {
        window.postMessage({ type: 'MOOVIE_EXT_PING' }, '*');
    };

    let intervalId: number | null = null;

    onMounted(() => {
        nfDebug('extension:init');
        checkExtension();
        pingExtension();
        window.addEventListener('moovie-stream-ext-ready', onExtensionReady);
        window.addEventListener('message', onExtensionPong);
        intervalId = window.setInterval(() => {
            checkExtension();
            if (!extensionActive.value) pingExtension();
        }, 1500);
    });

    onBeforeUnmount(() => {
        window.removeEventListener('moovie-stream-ext-ready', onExtensionReady);
        window.removeEventListener('message', onExtensionPong);
        if (intervalId !== null) window.clearInterval(intervalId);
    });

    return {
        extensionActive,
        extensionInfo,
        checkExtension,
        pingExtension
    };
}