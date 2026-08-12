<template>
    <div class="party-shell" :class="{ 'has-native-player': Boolean(nativeMediaId) }">
        <section v-if="nativeMediaId" class="party-shell__player" aria-label="Watch Together player">
            <MoovieFrame
                :media-id="nativeMediaId"
                :media-type="nativeMediaType"
                :season="nativeSeason"
                :episode="nativeEpisode"
                :title="nativeTitle"
            />
        </section>
        <iframe
            class="party-shell__frame"
            :class="{ 'is-loaded': frameReady, 'is-native-chat': Boolean(nativeMediaId) }"
            :src="frameSrc"
            title="Watch Together"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            @load="frameReady = true; syncPartyFooterState()"
        />
        <footer v-if="nativeMediaId" class="party-shell__footer" aria-label="Watch Together room controls">
            <div class="party-shell__footer-title">
                <button type="button" class="party-shell__back" aria-label="Back to home" title="Back to home" @click="goHome">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M19 12H5" />
                        <path d="m12 19-7-7 7-7" />
                    </svg>
                </button>
                <span class="party-shell__footer-dot" aria-hidden="true" />
                <span>Watch Together</span>
            </div>
            <div class="party-shell__footer-actions">
                <button type="button" class="party-shell__footer-btn" @click="runPartyAction('toggleRoomPrivacy')">
                    <span aria-hidden="true">🔒</span>
                    <span>{{ privacyLabel }}</span>
                </button>
                <button type="button" class="party-shell__footer-btn" @click="runPartyAction('toggleCinemaMode')">
                    <span aria-hidden="true">▣</span>
                    <span>{{ cinemaLabel }}</span>
                </button>
                <button type="button" class="party-shell__footer-btn" @click="runPartyAction('copyShareLink')">
                    <span aria-hidden="true">↗</span>
                    <span>Invite</span>
                </button>
                <button type="button" class="party-shell__footer-btn" @click="runPartyAction('showLobbyView')">
                    <span aria-hidden="true">⌂</span>
                    <span>Lobby</span>
                </button>
            </div>
        </footer>
    </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { LocationQuery } from 'vue-router';
import { useSeo } from '../composables/useSeo';
import MoovieFrame from '../components/player/MoovieFrame.vue';

const route = useRoute();
const router = useRouter();
const { updateSeo } = useSeo();

const frameSrc = ref(buildFrameSrc(route.query));
const frameReady = ref(false);
let syncingFromIframe = false;
let stopNativeDiagnostics: (() => void) | null = null;
let nativeDiagnosticsTimer: ReturnType<typeof setTimeout> | null = null;
let partyFooterSyncTimer: number | null = null;
let nativeSyncTimer: ReturnType<typeof setInterval> | null = null;

const preservedMediaKey = ref(String(route.query.media || ''));
const mediaKey = computed(() => preservedMediaKey.value);
const privacyLabel = ref('Make private');
const cinemaLabel = ref('Cinema mode');
const nativeMediaId = computed(() => mediaKey.value.replace(/_s\d+e\d+$/, '') || '');
const nativeMediaType = computed(() => /_s\d+e\d+$/.test(mediaKey.value) ? 'tv' : 'movie');
const nativeSeason = computed(() => Number(mediaKey.value.match(/_s(\d+)e\d+$/)?.[1] || 0));
const nativeEpisode = computed(() => Number(mediaKey.value.match(/_s\d+e(\d+)$/)?.[1] || 0));
const nativeTitle = computed(() => String(route.query.title || 'Watch Together'));

function buildFrameSrc(query: LocationQuery): string {
    const params = new URLSearchParams();
    params.set('embedded', '1');
    // Bust the separately cached legacy party document while iterating locally.
    params.set('_v', '10');
    if (query.media) params.set('native', '1');

    Object.entries(query).forEach(([key, value]) => {
        if (value == null || key === 'embedded') return;
        if (Array.isArray(value)) {
            value.forEach((entry) => params.append(key, String(entry)));
            return;
        }
        params.set(key, String(value));
    });

    return `/party/app.html?${params.toString()}`;
}

function getPartyWindow(): Window | null {
    return document.querySelector('.party-shell__frame')
        ? (document.querySelector('.party-shell__frame') as HTMLIFrameElement).contentWindow
        : null;
}

function syncPartyFooterState() {
    const partyWindow = getPartyWindow() as (Window & {
        document?: Document;
    }) | null;
    const partyDocument = partyWindow?.document;
    if (!partyDocument) return;
    const privacy = partyDocument.getElementById('room-privacy-btn');
    const cinema = partyDocument.getElementById('cinema-mode-btn');
    if (privacy && !privacy.hidden) {
        privacyLabel.value = privacy.getAttribute('aria-pressed') === 'true' ? 'Make public' : 'Make private';
    }
    if (cinema) {
        cinemaLabel.value = cinema.getAttribute('aria-pressed') === 'true' ? 'Exit cinema' : 'Cinema mode';
    }
}

function goHome() {
    void router.push('/');
}

function runPartyAction(action: 'toggleRoomPrivacy' | 'toggleCinemaMode' | 'copyShareLink' | 'showLobbyView') {
    if (action === 'showLobbyView') {
        void router.push('/party');
        return;
    }
    const partyWindow = getPartyWindow() as (Window & Record<string, ((...args: any[]) => any) | undefined>) | null;
    const handler = partyWindow?.[action];
    if (typeof handler !== 'function') {
        console.warn('[Party] Native footer action is not ready:', action);
        return;
    }
    const result = action === 'toggleRoomPrivacy'
        ? handler.call(partyWindow, new Event('click'))
        : handler.call(partyWindow);
    Promise.resolve(result).finally(() => {
        window.setTimeout(syncPartyFooterState, 100);
    });
}

function describeElement(element: Element | null) {
    if (!element) return null;
    const html = element as HTMLElement;
    const style = window.getComputedStyle(html);
    const rect = html.getBoundingClientRect();
    return {
        tag: html.tagName.toLowerCase(),
        id: html.id || undefined,
        className: typeof html.className === 'string' ? html.className : undefined,
        rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        },
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        position: style.position,
        zIndex: style.zIndex,
        overflow: style.overflow
    };
}

function attachNativeDiagnostics() {
    stopNativeDiagnostics?.();
    stopNativeDiagnostics = null;
    if (nativeSyncTimer) clearInterval(nativeSyncTimer);
    nativeSyncTimer = null;
    if (!nativeMediaId.value) return;

    const player = document.querySelector('.party-shell__player');
    const video = player?.querySelector('video') as HTMLVideoElement | null;
    if (!player || !video) {
        // MoovieFrame creates its media surface during the first render/load cycle.
        nativeDiagnosticsTimer = setTimeout(attachNativeDiagnostics, 500);
        return;
    }

    const report = (event: string) => {
        const rect = video.getBoundingClientRect();
        const center = rect.width > 0 && rect.height > 0
            ? document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
                .slice(0, 5)
                .map((element) => describeElement(element))
            : [];
        const mediaError = video.error
            ? { code: video.error.code, message: video.error.message || '' }
            : null;
        console.info('[Party NativePlayer]', {
            event,
            mediaId: nativeMediaId.value,
            mediaType: nativeMediaType.value,
            source: video.currentSrc || video.src || '(no source)',
            readyState: video.readyState,
            networkState: video.networkState,
            paused: video.paused,
            ended: video.ended,
            currentTime: Number(video.currentTime.toFixed(2)),
            duration: Number.isFinite(video.duration) ? Number(video.duration.toFixed(2)) : video.duration,
            videoTrack: { width: video.videoWidth, height: video.videoHeight },
            player: describeElement(player),
            video: describeElement(video),
            topAtVideoCenter: center,
            error: mediaError
        });
    };

    const sendNativeSync = (event: 'play' | 'pause' | 'seek' | 'heartbeat' | 'ready') => {
        const partyFrame = document.querySelector('.party-shell__frame') as HTMLIFrameElement | null;
        partyFrame?.contentWindow?.postMessage({
            type: 'watchable-player-sync',
            event,
            time: video.currentTime || 0,
            playing: !video.paused
        }, window.location.origin);
    };

    const events = ['loadedmetadata', 'loadeddata', 'canplay', 'playing', 'pause', 'seeked', 'stalled', 'waiting', 'error'] as const;
    const handlers = events.map((event) => {
        const handler = () => {
            report(event);
            if (event === 'playing') sendNativeSync('play');
            if (event === 'pause') sendNativeSync('pause');
            if (event === 'seeked') sendNativeSync('seek');
        };
        video.addEventListener(event, handler);
        return [event, handler] as const;
    });
    report('attached');
    sendNativeSync('ready');
    nativeSyncTimer = setInterval(() => {
        if (!video.paused && !video.ended) sendNativeSync('heartbeat');
    }, 2000);

    stopNativeDiagnostics = () => {
        handlers.forEach(([event, handler]) => video.removeEventListener(event, handler));
        if (nativeSyncTimer) clearInterval(nativeSyncTimer);
        nativeSyncTimer = null;
    };
}

function partyPathsEqual(a: string, b: string): boolean {
    const normalize = (path: string) => {
        const url = new URL(path, 'https://moovie.fun');
        let pathname = url.pathname.replace(/\/+$/, '');
        if (!pathname) pathname = '/';
        return `${pathname}${url.search}`;
    };

    return normalize(a) === normalize(b);
}

function onPartyMessage(event: MessageEvent) {
    if (event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'moovie-command-sync') {
        const video = document.querySelector('.party-shell__player video') as HTMLVideoElement | null;
        if (!video) return;
        if (typeof data.time === 'number' && Number.isFinite(data.time)) {
            video.currentTime = Math.max(0, data.time);
        }
        if (data.playing === true && video.paused) {
            void video.play().catch(() => {});
        } else if (data.playing === false && !video.paused) {
            video.pause();
        }
        return;
    }

    // Forward native-player playback events into the room iframe, where the
    // existing realtime channel broadcasts them to everyone else.
    if (data.type === 'watchable-player-sync' && event.source === window) {
        const partyFrame = document.querySelector('.party-shell__frame') as HTMLIFrameElement | null;
        partyFrame?.contentWindow?.postMessage(data, window.location.origin);
        return;
    }

    if (data.type === 'watchable-site-nav') {
        const next = typeof data.path === 'string' ? data.path : '/';
        if (!next.startsWith('/') || next.startsWith('//')) return;
        if (partyPathsEqual(next, route.fullPath)) return;
        void router.push(next);
        return;
    }

    if (data.type !== 'watchable-party-nav') return;

    const next = typeof data.path === 'string' ? data.path : '';
    if (!next.startsWith('/party')) return;

    if (partyPathsEqual(next, route.fullPath)) return;

    syncingFromIframe = true;
    void router.replace(next).finally(() => {
        void nextTick(() => {
            syncingFromIframe = false;
        });
    });
}

watch(
    () => route.query,
    (query) => {
        if (syncingFromIframe) return;
        if (query.media) {
            preservedMediaKey.value = String(query.media);
        } else if (!query.room) {
            preservedMediaKey.value = '';
        }
        const nextSrc = buildFrameSrc(query);
        if (nextSrc === frameSrc.value) return;
        frameReady.value = false;
        frameSrc.value = nextSrc;
    },
    { deep: true }
);

watch(nativeMediaId, () => {
    if (nativeDiagnosticsTimer) clearTimeout(nativeDiagnosticsTimer);
    void nextTick(attachNativeDiagnostics);
}, { immediate: true });

onMounted(() => {
    updateSeo({
        title: 'Watch Together — Moovie',
        canonical: `https://moovie.fun/party`
    });
    window.addEventListener('message', onPartyMessage);
    partyFooterSyncTimer = window.setInterval(syncPartyFooterState, 700);
});

onBeforeUnmount(() => {
    window.removeEventListener('message', onPartyMessage);
    if (nativeDiagnosticsTimer) clearTimeout(nativeDiagnosticsTimer);
    stopNativeDiagnostics?.();
    if (nativeSyncTimer) clearInterval(nativeSyncTimer);
    if (partyFooterSyncTimer) clearInterval(partyFooterSyncTimer);
});
</script>

<style lang="scss" scoped>
.party-shell {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    width: 100%;
    height: 100dvh;
    min-height: 100dvh;
    background: var(--ink-900);
    overflow: hidden;
}

.party-shell.has-native-player {
    grid-template-columns: minmax(0, 1fr) 420px;
    grid-template-rows: minmax(0, 1fr) auto;
}

.party-shell__player {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    z-index: 1;
    min-width: 0;
    min-height: 320px;
    height: 100%;
    align-items: stretch;
    background: #000;
    overflow: hidden;
}

.party-shell__player :deep(.moovie-frame) {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    width: 100%;
    height: 100%;
    min-width: 1px;
    min-height: 1px;
}

.party-shell__player :deep(.moovie-frame__player),
.party-shell__player :deep(.moovie-frame__video) {
    position: relative;
    width: 100% !important;
    height: 100% !important;
    min-width: 0;
    min-height: 1px;
}

.party-shell__player :deep(.moovie-frame__video) {
    position: absolute !important;
    inset: 0 !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    object-fit: contain !important;
    z-index: 2 !important;
}

.party-shell__frame {
    display: block;
    width: 100%;
    border: 0;
    height: 100%;
    min-height: 0;
    background: #0b0a08;
    opacity: 0;
    transition: opacity 180ms ease;
}

.party-shell__frame.is-loaded { opacity: 1; }

.party-shell:not(.has-native-player) .party-shell__frame {
    grid-column: 1 / -1;
}

.party-shell.has-native-player .party-shell__frame {
    grid-column: 2;
    opacity: 1;
    border-left: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: -1px 0 0 rgba(255, 255, 255, 0.05);
}

.party-shell__footer {
    grid-column: 1 / -1;
    grid-row: 2;
    min-height: 54px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.55rem 0.85rem;
    background: #090909;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
}

.party-shell__footer-title,
.party-shell__footer-actions {
    display: flex;
    align-items: center;
}

.party-shell__footer-title {
    gap: 0.5rem;
    color: rgba(255, 255, 255, 0.72);
    font-size: 0.76rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.party-shell__back {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 7px;
    background: #000;
    color: rgba(255, 255, 255, 0.82);
    cursor: pointer;
    transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
}

.party-shell__back svg {
    width: 16px;
    height: 16px;
}

.party-shell__back:hover,
.party-shell__back:focus-visible {
    background: #fff;
    border-color: #fff;
    color: #000;
    outline: none;
}

.party-shell__footer-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.08);
}

.party-shell__back {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.85);
    cursor: pointer;
    flex: 0 0 auto;
    transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
}

.party-shell__back:hover,
.party-shell__back:focus-visible {
    background: #fff;
    border-color: #fff;
    color: #000;
    outline: none;
}

.party-shell__footer-actions {
    gap: 0.4rem;
    flex-wrap: wrap;
    justify-content: flex-end;
}

.party-shell__footer-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 32px;
    padding: 0.35rem 0.65rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 7px;
    background: #000;
    color: rgba(255, 255, 255, 0.82);
    font: inherit;
    font-size: 0.72rem;
    cursor: pointer;
    transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
}

.party-shell__footer-btn:hover,
.party-shell__footer-btn:focus-visible {
    background: #fff;
    border-color: #fff;
    color: #000;
    outline: none;
}

@media (max-width: 1024px) {
    .party-shell,
    .party-shell.has-native-player {
        grid-template-columns: 1fr;
        grid-template-rows: minmax(240px, 56.25vw) minmax(520px, 1fr);
        height: auto;
        overflow-y: auto;
    }

    .party-shell.has-native-player .party-shell__player {
        grid-row: 1;
        min-height: 240px;
        max-height: 70dvh;
    }

    .party-shell.has-native-player .party-shell__frame {
        grid-column: 1;
        grid-row: 2;
        height: 70dvh;
        min-height: 520px;
        border-left: 0;
        border-top: 1px solid rgba(255, 255, 255, 0.2);
    }

    .party-shell__footer {
        grid-column: 1;
        grid-row: 3;
    }
}
</style>
