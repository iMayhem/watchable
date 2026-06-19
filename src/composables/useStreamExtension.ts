import { onBeforeUnmount, onMounted, readonly, ref } from 'vue';
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

/** Shared across ExtensionPrompt + player — one listener set, one poll loop. */
const extensionActive = ref(false);
const extensionInfo = ref<StreamExtensionInfo | null>(null);
let subscriberCount = 0;
let intervalId: number | null = null;
let listenersBound = false;

const applyDetection = (info: StreamExtensionInfo | null, source: string) => {
    const active = Boolean(info?.active);
    if (!active && extensionActive.value && source === 'window-flag') {
        return;
    }
    if (active !== extensionActive.value) {
        nfDebug('extension:detected', { active, source, version: info?.version, mode: info?.mode });
        extensionActive.value = active;
        extensionInfo.value = info;
        if (active && intervalId !== null) {
            window.clearInterval(intervalId);
            intervalId = null;
        }
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
    if (detail?.active) {
        applyDetection(detail, 'ready-event');
        return;
    }
    checkExtension();
};

const onExtensionPong = (event: MessageEvent) => {
    if (event.source !== window || event.data?.type !== 'MOOVIE_EXT_PONG') return;
    const detail = event.data.detail as StreamExtensionInfo | undefined;
    if (detail?.active) {
        applyDetection(detail, 'pong');
    }
};

const pingExtension = () => {
    window.postMessage({ type: 'MOOVIE_EXT_PING' }, '*');
};

function bindGlobalListeners() {
    if (listenersBound) return;
    listenersBound = true;
    nfDebug('extension:init');
    window.addEventListener('moovie-stream-ext-ready', onExtensionReady);
    window.addEventListener('message', onExtensionPong);
    intervalId = window.setInterval(() => {
        checkExtension();
        if (!extensionActive.value) pingExtension();
    }, 5000);
}

function unbindGlobalListeners() {
    if (subscriberCount > 0 || !listenersBound) return;
    window.removeEventListener('moovie-stream-ext-ready', onExtensionReady);
    window.removeEventListener('message', onExtensionPong);
    if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
    }
    listenersBound = false;
}

export function useStreamExtension() {
    onMounted(() => {
        subscriberCount++;
        bindGlobalListeners();
        checkExtension();
        pingExtension();
    });

    onBeforeUnmount(() => {
        subscriberCount = Math.max(0, subscriberCount - 1);
        unbindGlobalListeners();
    });

    return {
        extensionActive: readonly(extensionActive),
        extensionInfo: readonly(extensionInfo),
        checkExtension,
        pingExtension
    };
}