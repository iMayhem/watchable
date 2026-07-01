<template>
    <div class="moovie-stage">
        <!-- Ambient bloom -->
        <div v-if="activeUrl" class="moovie-stage__bloom" aria-hidden="true" />

        <!-- Player -->
        <div ref="playerContainer" class="moovie-stage__player" />

        <!-- Loading overlay -->
        <div v-if="loading" class="moovie-stage__overlay">
            <div class="moovie-stage__spinner" />
            <p class="moovie-stage__label">{{ loadingLabel }}</p>
        </div>

        <!-- Gulab Jamun fallback iframe -->
        <iframe
            v-if="gulabjamunUrl"
            :src="gulabjamunUrl"
            class="moovie-stage__fallback"
            allowfullscreen
            frameborder="0"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        />

        <!-- Empty state -->
        <div v-if="!activeUrl && !loading && !error" class="moovie-stage__overlay">
            <div class="moovie-stage__spinner moovie-stage__spinner--idle" />
            <p class="moovie-stage__label">Resolving stream…</p>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

const API_BASE = 'https://proxy.moovie.fun';
const LOADING_MESSAGES = [
    'Threading the reel…',
    'Striking the print…',
    'Rolling film…',
    'Cueing the projector…',
];

export default defineComponent({
    name: 'MooviePlayer',
    setup() {
        const route = useRoute();

        const playerContainer = ref<HTMLElement | null>(null);
        const gulabjamunUrl  = ref('');
        const activeUrl = ref('');
        const loading = ref(false);
        const error = ref('');
        const loadingLabel = ref(LOADING_MESSAGES[0]);

        let plyrInstance: any = null;
        let hlsInstance: any = null;
        let msgInterval: number | null = null;

        // ── Load HLS.js from CDN if not already present ──────────────
        function loadHls(): Promise<void> {
            return new Promise((resolve) => {
                if ((window as any).Hls) { resolve(); return; }
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';
                script.onload = () => resolve();
                script.onerror = () => resolve();
                document.head.appendChild(script);
            });
        }

        // ── Destroy instances ────────────────────────────────────────────────
        function destroyPlayer() {
            if (plyrInstance) {
                try { plyrInstance.destroy(); } catch { /* */ }
                plyrInstance = null;
            }
            if (hlsInstance) {
                try { hlsInstance.destroy(); } catch { /* */ }
                hlsInstance = null;
            }
            if (playerContainer.value) {
                playerContainer.value.innerHTML = '';
            }
        }

        // ── Mount Plyr ───────────────────────────────────────────────────────
        async function mountPlayer(url: string) {
            await loadHls();
            const container = playerContainer.value;
            if (!container) return;
            destroyPlayer();

            const HlsCtor = (window as any).Hls;
            const isM3u8 = url.includes('.m3u8') || url.includes('m3u8') || url.includes('.m3u');

            const video = document.createElement('video');
            video.controls = false;
            video.playsInline = true;
            video.autoplay = true;
            video.className = 'plyr-video-element';
            container.appendChild(video);

            if (isM3u8 && HlsCtor && HlsCtor.isSupported()) {
                hlsInstance = new HlsCtor({
                    enableWorker: true,
                    maxBufferLength: 30,
                    maxMaxBufferLength: 60,
                });
                hlsInstance.loadSource(url);
                hlsInstance.attachMedia(video);
            } else {
                video.src = url;
            }

            plyrInstance = new Plyr(video, {
                autoplay: true,
                controls: [
                    'play-large', 'play', 'progress',
                    'current-time', 'duration', 'mute',
                    'volume', 'settings', 'pip', 'airplay', 'fullscreen',
                ],
                settings: ['quality', 'speed', 'loop'],
                tooltips: { controls: true, seek: true },
            });
        }

        // ── Fetch + auto-play ────────────────────────────────────────────────
        async function resolve() {
            const tmdbId = String(route.query.tmdb_id || '');
            const title   = String(route.query.title   || '');
            const season  = String(route.query.season  || '');
            const episode = String(route.query.episode || '');

            if (!tmdbId) {
                error.value = 'No TMDB ID provided.';
                return;
            }

            loading.value = true;
            error.value = '';

            let i = 0;
            loadingLabel.value = LOADING_MESSAGES[0];
            msgInterval = window.setInterval(() => {
                i = (i + 1) % LOADING_MESSAGES.length;
                loadingLabel.value = LOADING_MESSAGES[i];
            }, 1800);

            const params: Record<string, string> = { tmdb_id: tmdbId };
            if (title)   params.title   = title;
            if (season)  params.season  = season;
            if (episode) params.episode = episode;

            try {
                const qs  = new URLSearchParams(params).toString();
                const res = await fetch(`${API_BASE}/api/scrape?${qs}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const data: Record<string, string[]> = await res.json();
                const flat = Object.values(data).flat();

                if (!flat.length) throw new Error('No streams found');

                // prefer M3U8
                const playable = flat.find(u =>
                    u.includes('.m3u8') || u.includes('m3u8')
                ) || flat[0];

                activeUrl.value = playable;
                loading.value = false;
                if (msgInterval) clearInterval(msgInterval);
                await mountPlayer(playable);
            } catch (e: any) {
                // ── Fallback: switch to Gulab Jamun embed ─────────────────
                loading.value = false;
                if (msgInterval) clearInterval(msgInterval);

                const isTv = season && episode;
                if (isTv) {
                    gulabjamunUrl.value = `https://cinemaos.live/player/${tmdbId}/${season}/${episode}`;
                } else {
                    gulabjamunUrl.value = `https://cinemaos.live/player/${tmdbId}`;
                }
            }
        }

        onMounted(resolve);
        onUnmounted(() => {
            destroyPlayer();
            if (msgInterval) clearInterval(msgInterval);
        });

        return { playerContainer, activeUrl, loading, error, loadingLabel, gulabjamunUrl };
    },
});
</script>

<style scoped lang="scss">
.moovie-stage {
    position: relative;
    width: 100vw;
    height: 100vh;
    background: #0b0a08;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;

    &__fallback {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: none;
        z-index: 2;
        background: #000;
    }

    &__bloom {
        position: absolute;
        inset: 0;
        background: radial-gradient(ellipse 70% 50% at 50% 60%, rgba(255, 90, 31, 0.08) 0%, transparent 70%);
        pointer-events: none;
        z-index: 0;
    }

    &__player {
        position: absolute;
        inset: 0;
        z-index: 1;

        :deep(.plyr) {
            width: 100% !important;
            height: 100% !important;
            background: #000 !important;
            --plyr-color-main: #ff5a1f !important;
            --plyr-range-fill-background: #ff5a1f !important;
            --plyr-video-control-color: rgba(255, 90, 31, 0.85) !important;
            --plyr-video-control-color-hover: #ff723f !important;
        }

        :deep(.plyr__video-wrapper) {
            height: 100% !important;
        }

        :deep(.plyr-video-element) {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain !important;
        }

        /* Floating glassmorphic control bar */
        :deep(.plyr__controls) {
            background: rgba(11, 10, 8, 0.82) !important;
            backdrop-filter: blur(14px) saturate(1.2) !important;
            -webkit-backdrop-filter: blur(14px) saturate(1.2) !important;
            border: 1px solid rgba(255, 255, 255, 0.08) !important;
            border-radius: 10px !important;
            margin: 24px !important;
            padding: 10px 16px !important;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5) !important;
        }

        :deep(.plyr__control) {
            color: rgba(255, 90, 31, 0.8) !important;
            transition: color 0.2s, transform 0.15s !important;

            &:hover {
                background: rgba(255, 90, 31, 0.1) !important;
                color: #ff723f !important;
                filter: drop-shadow(0 0 4px rgba(255, 90, 31, 0.6)) !important;
            }
        }

        :deep(.plyr__progress input[type='range']) {
            color: #ff5a1f !important;
        }
    }

    &__overlay {
        position: absolute;
        inset: 0;
        z-index: 5;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;

        &--error {
            background: rgba(11, 10, 8, 0.9);
        }
    }

    &__spinner {
        width: 44px;
        height: 44px;
        border: 3px solid rgba(255, 90, 31, 0.15);
        border-top-color: #ff5a1f;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;

        &--idle {
            border-top-color: rgba(255, 90, 31, 0.4);
        }
    }

    &__label {
        font-size: 0.9rem;
        color: #9ca3af;
        font-family: system-ui, sans-serif;
        margin: 0;
    }

    &__error-icon {
        font-size: 2.5rem;
    }

    &__error-title {
        font-size: 1.2rem;
        font-weight: 600;
        color: #f5efe4;
        font-family: system-ui, sans-serif;
        margin: 0;
    }

    &__error-sub {
        font-size: 0.85rem;
        color: #9ca3af;
        font-family: system-ui, sans-serif;
        margin: 0;
        max-width: 380px;
        text-align: center;
    }
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
</style>
