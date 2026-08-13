<template>
    <div class="party-shell" :class="{ 'has-native-player': Boolean(nativeMediaId) }">
        <section
            v-if="nativeMediaId"
            class="party-shell__player"
            aria-label="Watch Together player"
            @mouseenter="setClassicPlayerHover(true)"
            @mouseleave="setClassicPlayerHover(false)"
        >
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
            @load="frameReady = true; syncPartyFooterState(); syncNativePlayerBounds()"
        />
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
let nativeRespondingToSync = false;
let nativeBoundsTimer: number | null = null;
let nativeHoverTimer: number | null = null;

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
    if (query.media) params.set('native', '1');
    // Bust the separately cached classic party workspace while iterating locally.
    params.set('_v', '10');

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

function exitCinemaMode(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    const partyWindow = getPartyWindow() as (Window & {
        toggleCinemaMode?: () => void;
        document?: Document;
    }) | null;
    const partyDocument = partyWindow?.document;
    if (!partyDocument?.body.classList.contains('cinema-mode')) return;
    console.info('[Party] Escape pressed: disabling cinema mode');
    partyWindow?.toggleCinemaMode?.();
}

function syncNativePlayerBounds() {
    const player = document.querySelector('.party-shell__player') as HTMLElement | null;
    const frame = document.querySelector('.party-shell__frame') as HTMLIFrameElement | null;
    const stage = frame?.contentDocument?.querySelector('#player-stage') as HTMLElement | null;
    if (!player || !frame || !stage) {
        console.info('[Party NativePlayer] player-stage not ready for bounds sync', {
            player: Boolean(player), frame: Boolean(frame), stage: Boolean(stage)
        });
        return;
    }
    const frameRect = frame.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const left = frameRect.left + stageRect.left;
    const top = frameRect.top + stageRect.top;
    player.style.left = `${Math.max(0, left)}px`;
    player.style.top = `${Math.max(0, top)}px`;
    player.style.width = `${Math.max(1, stageRect.width)}px`;
    player.style.height = `${Math.max(1, stageRect.height)}px`;
    player.style.right = 'auto';
    player.style.bottom = 'auto';
    console.info('[Party NativePlayer] bounds synced to classic player slot', {
        left: Math.round(left), top: Math.round(top),
        width: Math.round(stageRect.width), height: Math.round(stageRect.height)
    });
}

function setClassicPlayerHover(active: boolean) {
    if (nativeHoverTimer) window.clearTimeout(nativeHoverTimer);
    const send = () => {
        const frame = document.querySelector('.party-shell__frame') as HTMLIFrameElement | null;
        frame?.contentWindow?.postMessage({ type: 'watchable-player-hover', active }, window.location.origin);
    };
    // Keep the footer clickable while moving from the player to its controls.
    if (active) send();
    else nativeHoverTimer = window.setTimeout(send, 900);
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
    if (!nativeMediaId.value) {
        console.info('[Party NativePlayer] no media query; native player is intentionally idle');
        return;
    }

    const player = document.querySelector('.party-shell__player');
    const video = player?.querySelector('video') as HTMLVideoElement | null;
    if (!player || !video) {
        console.info('[Party NativePlayer] waiting for MoovieFrame video element', {
            mediaId: nativeMediaId.value,
            playerFound: Boolean(player),
            videoFound: Boolean(video)
        });
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

    const sendNativeSync = (event: 'play' | 'pause' | 'seek' | 'heartbeat' | 'ready' | 'complete') => {
        const partyFrame = document.querySelector('.party-shell__frame') as HTMLIFrameElement | null;
        console.info('[Party NativePlayer] sending sync to room iframe', { event, time: video.currentTime, playing: !video.paused });
        partyFrame?.contentWindow?.postMessage({
            type: 'watchable-player-sync',
            event,
            time: video.currentTime || 0,
            playing: !video.paused
        }, window.location.origin);
    };

    const events = ['loadedmetadata', 'loadeddata', 'canplay', 'playing', 'pause', 'seeked', 'stalled', 'waiting', 'error', 'ended'] as const;
    const handlers = events.map((event) => {
        const handler = () => {
            report(event);
            if (nativeRespondingToSync) return;
            if (event === 'playing') sendNativeSync('play');
            if (event === 'pause') sendNativeSync('pause');
            if (event === 'seeked') sendNativeSync('seek');
            if (event === 'ended') sendNativeSync('complete');
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
        console.info('[Party NativePlayer] received sync command', data);
        const video = document.querySelector('.party-shell__player video') as HTMLVideoElement | null;
        if (!video) {
            console.warn('[Party NativePlayer] cannot apply sync: video element is missing');
            return;
        }
        // Suppress echo reporting while we apply a remote command, otherwise the
        // native player's seeked/playing/pause events re-broadcast the command
        // straight back and create an infinite sync loop (the MoovieFrame iframe
        // path already has an equivalent guard).
        nativeRespondingToSync = true;
        if (typeof data.time === 'number' && Number.isFinite(data.time)) {
            const target = Math.min(Math.max(data.time, 0), Number.isFinite(video.duration) ? video.duration : data.time);
            const diff = Math.abs(video.currentTime - target);
            if (diff > 0.8 || data.force) {
                video.currentTime = target;
            }
        }
        if (data.playing === true && video.paused) {
            void video.play().catch(() => {});
        } else if (data.playing === false && !video.paused) {
            video.pause();
        }
        setTimeout(() => {
            nativeRespondingToSync = false;
        }, 500);
        return;
    }

    // Forward native-player playback events into the room iframe, where the
    // existing realtime channel broadcasts them to everyone else.
    if (data.type === 'watchable-player-sync' && event.source === window) {
        console.info('[Party NativePlayer] forwarding player event to room iframe', data);
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
    window.addEventListener('keydown', exitCinemaMode);
    window.addEventListener('resize', syncNativePlayerBounds);
    partyFooterSyncTimer = window.setInterval(syncPartyFooterState, 700);
    nativeBoundsTimer = window.setInterval(syncNativePlayerBounds, 1000);
});

onBeforeUnmount(() => {
    window.removeEventListener('message', onPartyMessage);
    window.removeEventListener('keydown', exitCinemaMode);
    window.removeEventListener('resize', syncNativePlayerBounds);
    if (nativeDiagnosticsTimer) clearTimeout(nativeDiagnosticsTimer);
    stopNativeDiagnostics?.();
    if (nativeSyncTimer) clearInterval(nativeSyncTimer);
    if (partyFooterSyncTimer) clearInterval(partyFooterSyncTimer);
    if (nativeBoundsTimer) clearInterval(nativeBoundsTimer);
    if (nativeHoverTimer) clearTimeout(nativeHoverTimer);
});
</script>

<style lang="scss" scoped>
.party-shell {
    position: relative;
    display: block;
    width: 100%;
    height: 100dvh;
    min-height: 100dvh;
    background: var(--ink-900);
    overflow: hidden;
}

.party-shell.has-native-player {
    display: block;
}

.party-shell__player {
    position: absolute;
    top: 52px;
    right: clamp(320px, 27.8vw, 420px);
    bottom: 58px;
    left: 0;
    display: flex;
    z-index: 3;
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
    position: absolute;
    inset: 0;
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

.party-shell.has-native-player .party-shell__frame {
    position: absolute;
    inset: 0;
    opacity: 1;
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
    .party-shell {
        height: 100dvh;
        overflow: hidden;
    }

    .party-shell.has-native-player .party-shell__player {
        top: 52px;
        right: 0;
        bottom: 58dvh;
        min-height: 240px;
    }

    .party-shell.has-native-player .party-shell__frame {
        top: 42dvh;
    }

    .party-shell__footer {
        grid-column: 1;
        grid-row: 3;
    }
}
</style>
