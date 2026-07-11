<template>
    <div ref="rootRef" class="moovie-frame" :class="{ 'has-error': error }">
        <div v-if="ambientImage" class="moovie-frame__bloom" :style="{ backgroundImage: `url(${ambientImage})` }" aria-hidden="true" />

        <div class="moovie-frame__stage">
            <div class="moovie-frame__player">
                <div ref="artContainer" class="moovie-frame__art" />

                <div v-if="loading" class="moovie-frame__overlay">
                    <div class="moovie-frame__skeleton" aria-hidden="true" />
                    <div class="moovie-frame__loader">
                        <div class="moovie-frame__spinner" aria-hidden="true" />
                        <p class="meta">{{ loadingLabel }}</p>
                    </div>
                </div>

                <div v-if="error && !loading" class="moovie-frame__overlay moovie-frame__overlay--error">
                    <p class="eyebrow">Hub Error</p>
                    <h3>{{ error }}</h3>
                    <button type="button" class="moovie-frame__retry" @click="retry">Retry</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'
import { useWebImage } from '../../utils/useWebImage'
import { useAmbientColor } from '../../composables/useAmbientColor'
import { startProgressTracking } from '../../composables/useProgress'

const HUB_DIRECT = 'https://proxy.peestream.in/api/search'
const HUB_DIRECT2 = 'https://providers.peestream.in/api/search'
const HUB_PROXY = '/api/moovie-hub'

interface HubStream {
    name: string
    url: string
    proxyUrl: string
    quality: string
    type: string
}

interface HubSearchResult {
    provider: string
    providerName: string
    streams: HubStream[]
}

interface HubSearchResponse {
    results: HubSearchResult[]
    totalStreams: number
}

export default defineComponent({
    name: 'MoovieFrame',
    props: {
        mediaId: { type: [String, Number], default: '' },
        mediaType: { type: String as () => 'movie' | 'tv', default: 'movie' },
        season: { type: Number, default: 0 },
        episode: { type: Number, default: 0 },
        title: { type: String, default: 'Stream' },
        backdropPath: { type: String, default: '' },
        posterPath: { type: String, default: '' },
    },
    setup(props) {
        const rootRef = ref<HTMLElement | null>(null)
        const artContainer = ref<HTMLElement | null>(null)
        const loading = ref(false)
        const error = ref('')
        const loadingLabel = ref('Resolving stream…')
        let plyrInstance: Plyr | null = null
        let hlsInstance: any = null
        let stopTracking: (() => void) | null = null

        useAmbientColor(computed(() => props.backdropPath || props.posterPath || null), rootRef)

        const ambientImage = ref('')
        const computeAmbient = () => {
            const path = props.backdropPath || props.posterPath
            ambientImage.value = path ? useWebImage(path, 'large') : ''
        }

        const loadingMessages = [
            'Resolving stream…',
            'Contacting hub…',
            'Fetching sources…',
            'Preparing player…',
        ]
        let messageTimer: number | null = null

        const startMessages = () => {
            if (messageTimer) clearInterval(messageTimer)
            let i = 0
            loadingLabel.value = loadingMessages[0]
            messageTimer = window.setInterval(() => {
                i = (i + 1) % loadingMessages.length
                loadingLabel.value = loadingMessages[i]
            }, 2000)
        }

        const stopMessages = () => {
            if (messageTimer) { clearInterval(messageTimer); messageTimer = null }
        }

        const loadHlsJs = (() => {
            let promise: Promise<void> | null = null
            return () => {
                if ((window as any).Hls) return Promise.resolve()
                if (promise) return promise
                promise = new Promise((resolve) => {
                    const s = document.createElement('script')
                    s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js'
                    s.onload = () => resolve()
                    s.onerror = () => resolve()
                    document.head.appendChild(s)
                })
                return promise
            }
        })()

        function destroyPlayer() {
            if (plyrInstance) {
                try { plyrInstance.destroy() } catch {}; plyrInstance = null
            }
            if (hlsInstance) { try { hlsInstance.destroy() } catch {}; hlsInstance = null }
            if (artContainer.value) artContainer.value.innerHTML = ''
            stopMessages()
        }

        async function mountPlayer(url: string) {
            console.debug('[MoovieFrame] mountPlayer url:', url)
            const container = artContainer.value
            if (!container) {
                console.debug('[MoovieFrame] mountPlayer no container')
                return
            }
            destroyPlayer()

            await loadHlsJs()
            const HlsCtor = (window as any).Hls
            const isHls = url.includes('.m3u8') || url.includes('m3u8')

            const video = document.createElement('video')
            video.controls = false
            video.playsInline = true
            video.autoplay = true
            video.style.width = '100%'
            video.style.height = '100%'
            video.style.objectFit = 'contain'
            video.className = 'plyr-video-element'
            container.appendChild(video)

            if (isHls && HlsCtor && HlsCtor.isSupported()) {
                hlsInstance = new HlsCtor({
                    enableWorker: true,
                    maxBufferLength: 30,
                    maxMaxBufferLength: 60,
                })
                hlsInstance.loadSource(url)
                hlsInstance.attachMedia(video)
            } else {
                video.src = url
            }

            const isNarrow = window.matchMedia('(max-width: 1023px)').matches
            plyrInstance = new Plyr(video, {
                autoplay: true,
                controls: isNarrow
                    ? ['play-large', 'play', 'progress', 'current-time', 'duration', 'settings', 'pip', 'fullscreen']
                    : ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'fullscreen'],
                settings: ['speed'],
            })
        }

        async function fetchStreams() {
            const id = String(props.mediaId)
            if (!id) return []
            const type = props.mediaType
            const qs = `q=${encodeURIComponent(id)}&type=${type}${type === 'tv' && props.season > 0 ? `&season=${props.season}` : ''}${type === 'tv' && props.episode > 0 ? `&episode=${props.episode}` : ''}`
            let res: Response | null = null
            let usedUrl = ''
            for (const base of [HUB_DIRECT, HUB_DIRECT2, HUB_PROXY]) {
                usedUrl = `${base}?${qs}`
                console.debug('[MoovieFrame] fetchStreams trying:', usedUrl)
                try {
                    res = await fetch(usedUrl)
                    if (!res.ok) {
                        console.debug('[MoovieFrame] fetchStreams', base, 'status:', res.status)
                        continue
                    }
                    break
                } catch (e) {
                    console.debug('[MoovieFrame] fetchStreams', base, 'failed:', (e as Error).message)
                    res = null
                }
            }
            if (!res) throw new Error('All hub endpoints failed')
            console.debug('[MoovieFrame] fetchStreams resolved:', usedUrl, 'status:', res.status)
            const text = await res.text()
            console.debug('[MoovieFrame] fetchStreams raw response (first 500):', text.slice(0, 500))
            let data: HubSearchResponse
            try {
                data = JSON.parse(text)
            } catch {
                console.debug('[MoovieFrame] fetchStreams JSON parse failed, response starts with:', text.slice(0, 100))
                throw new Error('Hub returned non-JSON response')
            }
            const all: HubStream[] = []
            for (const group of data.results || []) {
                for (const stream of group.streams || []) {
                    if (stream.proxyUrl?.startsWith('/')) stream.proxyUrl = 'https://providers.peestream.in' + stream.proxyUrl
                    all.push(stream)
                }
            }
            console.debug('[MoovieFrame] fetchStreams parsed streams:', all.length)
            return all
        }

        function pickBest(streams: HubStream[]): HubStream | null {
            if (!streams.length) return null
            return streams.find(s => s.type === 'm3u8' || s.url.includes('.m3u8'))
                || streams.find(s => s.type === 'mp4' || s.url.includes('.mp4'))
                || streams[0]
        }

        async function doLoad() {
            console.debug('[MoovieFrame] doLoad start')
            destroyPlayer(); loading.value = true; error.value = ''; startMessages()
            try {
                const streams = await fetchStreams()
                const best = pickBest(streams)
                if (!best) throw new Error('No streamable sources found')
                console.debug('[MoovieFrame] doLoad best stream:', best.name, best.proxyUrl || best.url)
                await mountPlayer(best.proxyUrl || best.url)
                loading.value = false
                console.debug('[MoovieFrame] doLoad done')
            } catch (e: any) {
                console.debug('[MoovieFrame] doLoad error:', e.message)
                error.value = e.message || 'Failed to load stream'
                loading.value = false; stopMessages()
            }
        }

        function retry() { void doLoad() }

        const startTrackingIfNeeded = () => {
            if (stopTracking) { stopTracking(); stopTracking = null }
            if (props.mediaId) {
                stopTracking = startProgressTracking(props.mediaId, props.mediaType, props.mediaType === 'tv' ? props.season : undefined, props.mediaType === 'tv' ? props.episode : undefined)
            }
        }

        watch(() => [props.mediaId, props.mediaType, props.season, props.episode], () => { if (props.mediaId) { void doLoad(); startTrackingIfNeeded() } })
        watch(() => [props.backdropPath, props.posterPath], () => computeAmbient(), { immediate: true })

        onMounted(() => { computeAmbient(); startTrackingIfNeeded(); void doLoad() })
        onUnmounted(() => { destroyPlayer(); if (stopTracking) { stopTracking(); stopTracking = null } })

        return { rootRef, artContainer, loading, error, loadingLabel, ambientImage, retry }
    },
})
</script>

<style scoped lang="scss">
.moovie-frame {
    position: relative;
    width: 100%;
    isolation: isolate;

    &__bloom {
        position: absolute;
        inset: -10% -5%;
        width: fit-content;
        background-size: cover;
        background-position: center;
        filter: blur(80px) saturate(1.4) brightness(0.55);
        opacity: 0.55;
        z-index: -1;
        pointer-events: none;
        &::after {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(ellipse at center, transparent 0%, var(--ink-900) 78%);
        }
    }

    &__stage {
        position: relative;
        width: 100%;
        max-width: 100%;
        margin: 0 auto;
        padding: 0 var(--s-4) var(--s-5) var(--s-4);
        @media (min-width: 768px) and (max-width: 1023px) { padding: 0 var(--s-5) var(--s-6) var(--s-5); }
        @media (min-width: 1024px) { padding: 0; }
    }

    &__player {
        position: relative;
        aspect-ratio: 16 / 9;
        background: #000;
        border-radius: var(--r-lg);
        overflow: hidden;
        box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--rule);
    }

    &__art {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        :deep(video) { width: 100%; height: 100%; object-fit: contain; }
        :deep(.plyr) {
            width: 100%;
            height: 100%;
            --plyr-color-main: #ff5a1f;
            --plyr-video-control-background-hover: rgba(255, 90, 31, 0.15);
            --plyr-range-fill-background: #ff5a1f;
            --plyr-progress-loading-background: rgba(255, 90, 31, 0.35);
            --plyr-tooltip-background: rgba(0, 0, 0, 0.92);
            --plyr-tooltip-color: #f0eee3;
            --plyr-menu-color: #f0eee3;
            --plyr-menu-background: rgba(15, 15, 15, 0.98);
            --plyr-menu-back-arrow-color: rgba(255, 255, 255, 0.6);
        }
    }

    &__overlay {
        position: absolute; inset: 0;
        display: grid; place-content: center; gap: var(--s-3);
        text-align: center; background: var(--ink-900); z-index: 5;
        h3 { font-family: var(--font-display); font-size: var(--fs-2xl); color: var(--bone-50); margin: 0; letter-spacing: var(--ls-tight); }
        &--error h3 { color: #ff8f8f; }
    }

    &__skeleton {
        position: absolute; inset: 0;
        background: linear-gradient(100deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0) 70%) var(--ink-800);
        background-size: 220% 100%;
        animation: shimmer 2.4s infinite ease-in-out;
    }

    &__loader { position: relative; z-index: 1; display: grid; gap: var(--s-3); justify-items: center; color: var(--bone-200); }
    &__spinner { width: 44px; height: 44px; border-radius: 50%; border: 2px solid var(--rule-strong); border-top-color: var(--ember); animation: spin 1.1s linear infinite; }

    &__retry {
        margin-top: var(--s-2); padding: 0.65rem 1.4rem;
        background: var(--ember); color: var(--ink-900); border: 0;
        border-radius: var(--r-pill); font-family: var(--font-ui); font-weight: 600; cursor: pointer;
        transition: background-color 0.15s, transform 0.15s;
        &:hover { background: var(--ember-600); transform: translateY(-1px); }
    }

    .meta { font-family: var(--font-mono); font-size: var(--fs-xs); letter-spacing: 0.06em; text-transform: uppercase; margin: 0; }
    .eyebrow { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--bone-400); margin: 0; }
}

@media (hover: hover) and (pointer: fine) {
    :deep(.plyr__volume) {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%) scaleY(0);
        transform-origin: bottom center;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 10px 4px;
        background: rgba(0, 0, 0, 0.9);
        border-radius: 6px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.15s ease, transform 0.15s ease;
        margin-bottom: 8px;

        input[data-plyr="volume"] {
            transform: rotate(-90deg);
            width: 80px;
            height: 4px;
            min-width: auto;
            max-width: none;
            margin: -38px 0;
            cursor: pointer;
        }
    }

    :deep([data-plyr="mute"]:hover + .plyr__volume),
    :deep(.plyr__volume:hover),
    :deep([data-plyr="mute"]:focus-visible + .plyr__volume) {
        opacity: 1;
        pointer-events: auto;
        transform: translateX(-50%) scaleY(1);
    }

    :deep(.plyr--video) {
        overflow: visible;
    }
}

:deep(.plyr__tooltip) {
    background: var(--plyr-tooltip-background);
    color: var(--plyr-tooltip-color);
    font-size: 12px;
    padding: 0.4em 0.7em;
    border: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
    letter-spacing: 0.02em;
    &::before { border-top-color: var(--plyr-tooltip-background); }
}

:deep(.plyr__preview-thumb) {
    background: var(--plyr-tooltip-background);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    .plyr__preview-thumb__time-container {
        background: transparent;
        color: var(--plyr-tooltip-color);
        font-size: 11px;
        padding: 4px 6px 6px;
        letter-spacing: 0.02em;
    }
}

:deep(.plyr__progress__buffer) {
    background: rgba(255, 255, 255, 0.08);
}

:deep(.plyr__progress__container .plyr__progress__buffer) {
    background: rgba(255, 255, 255, 0.1);
}

:deep(.plyr__controls) {
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.7) 40%, rgba(0, 0, 0, 0.9));
}

:deep(.plyr__menu__container) {
    .plyr__control[role="menuitemradio"] {
        &[aria-checked="true"]::before { background: #ff5a1f; }
    }
    .plyr__control--forward:hover { background: rgba(255, 90, 31, 0.15); }
}

@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
    .moovie-frame__skeleton, .moovie-frame__spinner { animation: none !important; }
}
</style>
