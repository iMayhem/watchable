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

let domObserver: MutationObserver | null = null;
let listenersBound = false;

const applyDetection = (info: StreamExtensionInfo | null, source: string) => {
    const active = Boolean(info?.active);
    if (active !== extensionActive.value) {
        nfDebug('extension:detected', { active, source, version: info?.version, mode: info?.mode });
        extensionActive.value = active;
        extensionInfo.value = info;
    } else if (active && info) {
        extensionInfo.value = info;
    }
};

function extensionRoots(): HTMLElement[] {
    const roots: HTMLElement[] = [];
    const add = (doc: Document | null | undefined) => {
        if (doc?.documentElement) roots.push(doc.documentElement);
    };

    add(document);
    try {
        if (window.parent && window.parent !== window) add(window.parent.document);
        if (window.top && window.top !== window) add(window.top.document);
    } catch {
        /* cross-origin parent */
    }

    return roots;
}

const readDomMarker = (): StreamExtensionInfo | null => {
    for (const root of extensionRoots()) {
        const active =
            root.getAttribute('data-moovie-ext') === 'active' ||
            root.dataset.moovieExt === 'active';

        if (!active) continue;

        return {
            active: true,
            version:
                root.getAttribute('data-moovie-ext-version') ||
                root.dataset.moovieExtVersion ||
                undefined,
            mode: 'direct-cdn'
        };
    }

    return null;
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
    try {
        if (window.parent && window.parent !== window) {
            window.parent.dispatchEvent(new CustomEvent('moovie-ext-ping'));
        }
    } catch {
        /* cross-origin parent */
    }
};

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
    // Single immediate check — no polling
    pingExtension();
}

function unbindGlobalListeners() {
    if (subscriberCount > 0 || !listenersBound) return;
    window.removeEventListener('moovie-stream-ext-ready', onExtensionReady);
    window.removeEventListener('moovie-stream-ext-pong', onExtensionPong);
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