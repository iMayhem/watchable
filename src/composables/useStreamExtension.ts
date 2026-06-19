import { onBeforeUnmount, onMounted, readonly, ref } from 'vue';
import { nfDebug } from './useNetflixDebug';

export interface StreamExtensionInfo {
    active: boolean;
    version?: string;
    mode?: string;
}

/** Shared across ExtensionPrompt + player — one listener set, one poll loop. */
const extensionActive = ref(false);
const extensionInfo = ref<StreamExtensionInfo | null>(null);
let subscriberCount = 0;
let intervalId: number | null = null;
let bootstrapIntervalId: number | null = null;
let domObserver: MutationObserver | null = null;
let listenersBound = false;

const applyDetection = (info: StreamExtensionInfo | null, source: string) => {
    const active = Boolean(info?.active);
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

const readDomMarker = (): StreamExtensionInfo | null => {
    const root = document.documentElement;
    if (!root) return null;

    const active =
        root.getAttribute('data-moovie-ext') === 'active' ||
        root.dataset.moovieExt === 'active';

    if (!active) return null;

    return {
        active: true,
        version: root.getAttribute('data-moovie-ext-version') || root.dataset.moovieExtVersion || undefined,
        mode: 'direct-cdn'
    };
};

const onExtensionReady = (event: Event) => {
    const detail = (event as CustomEvent<StreamExtensionInfo>).detail;
    if (detail?.active) {
        applyDetection(detail, 'ready-event');
    }
};

const onExtensionPong = (event: Event) => {
    const detail = (event as CustomEvent<StreamExtensionInfo>).detail;
    if (detail?.active) {
        applyDetection(detail, 'pong-event');
    }
};

const pingExtension = () => {
    const marker = readDomMarker();
    if (marker?.active) {
        applyDetection(marker, 'dom-marker');
    }
    window.dispatchEvent(new CustomEvent('moovie-ext-ping'));
};

function stopBootstrapPoll() {
    if (bootstrapIntervalId !== null) {
        window.clearInterval(bootstrapIntervalId);
        bootstrapIntervalId = null;
    }
}

function bindDomObserver() {
    if (domObserver || typeof MutationObserver === 'undefined') return;

    domObserver = new MutationObserver(() => {
        const marker = readDomMarker();
        if (marker?.active) {
            applyDetection(marker, 'dom-observer');
        }
    });

    domObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-moovie-ext', 'data-moovie-ext-version']
    });
}

function bindGlobalListeners() {
    if (listenersBound) return;
    listenersBound = true;
    nfDebug('extension:init');
    window.addEventListener('moovie-stream-ext-ready', onExtensionReady);
    window.addEventListener('moovie-stream-ext-pong', onExtensionPong);
    bindDomObserver();

    let bootstrapAttempts = 0;
    bootstrapIntervalId = window.setInterval(() => {
        bootstrapAttempts += 1;
        pingExtension();
        if (extensionActive.value || bootstrapAttempts >= 20) {
            stopBootstrapPoll();
        }
    }, 250);

    intervalId = window.setInterval(() => {
        if (!extensionActive.value) pingExtension();
    }, 5000);
}

function unbindGlobalListeners() {
    if (subscriberCount > 0 || !listenersBound) return;
    window.removeEventListener('moovie-stream-ext-ready', onExtensionReady);
    window.removeEventListener('moovie-stream-ext-pong', onExtensionPong);
    stopBootstrapPoll();
    if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
    }
    domObserver?.disconnect();
    domObserver = null;
    listenersBound = false;
}

export function useStreamExtension() {
    onMounted(() => {
        subscriberCount++;
        bindGlobalListeners();
        pingExtension();
    });

    onBeforeUnmount(() => {
        subscriberCount = Math.max(0, subscriberCount - 1);
        unbindGlobalListeners();
    });

    return {
        extensionActive: readonly(extensionActive),
        extensionInfo: readonly(extensionInfo),
        checkExtension: pingExtension,
        pingExtension
    };
}