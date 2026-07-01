<template>
    <div class="watch-stage">
        <header class="watch-stage__chrome">
            <div class="watch-stage__chrome-inner">
                <div class="watch-stage__crumb">
                    <button
                        type="button"
                        class="watch-stage__back"
                        aria-label="Back"
                        @click="goBack"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 12H5m7-7l-7 7 7 7" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <p class="eyebrow">Scraper Lab</p>
                </div>

                <h1 v-if="title" class="watch-stage__title">{{ title }}</h1>
                <span v-else class="watch-stage__title-skeleton" aria-hidden="true" />

                <div class="watch-stage__actions">
                    <div class="scraper-badge">
                        <span v-if="timing" class="scraper-badge__time">{{ timing }}ms</span>
                        <span v-if="numProviders" class="scraper-badge__providers">{{ numProviders }}p</span>
                    </div>
                </div>
            </div>
        </header>

        <main class="watch-stage__main">
            <div class="watch-stage__theater">
                <div ref="bloomRef" class="stream-frame" :class="{ 'has-error': error }">
                    <div
                        v-if="activeStreamUrl"
                        class="stream-frame__bloom"
                        aria-hidden="true"
                    />

                    <div class="stream-frame__stage">
                        <div class="stream-frame__controls">
                            <div class="stream-frame__search">
                                <input
                                    v-model="searchTitle"
                                    type="text"
                                    placeholder="Search title…"
                                    class="stream-frame__input"
                                    @keydown.enter="search"
                                />
                                <div class="stream-frame__opts">
                                    <label class="stream-frame__opt">
                                        <span>S</span>
                                        <input v-model.number="season" type="number" min="0" placeholder="0" />
                                    </label>
                                    <label class="stream-frame__opt">
                                        <span>E</span>
                                        <input v-model.number="episode" type="number" min="0" placeholder="0" />
                                    </label>
                                    <label class="stream-frame__opt" title="Fast mode (API providers only)">
                                        <span>⚡</span>
                                        <input v-model.number="fast" type="checkbox" true-value="1" false-value="0" />
                                    </label>
                                </div>
                                <button type="button" class="stream-frame__go" :disabled="loading" @click="search">
                                    {{ loading ? 'Scraping…' : 'Go' }}
                                </button>
                            </div>
                        </div>

                        <div class="stream-frame__player">
                            <div
                                v-if="activeStreamUrl"
                                ref="artContainer"
                                class="stream-frame__art"
                            />

                            <div v-if="loading" class="stream-frame__loading" role="status">
                                <div class="stream-frame__skeleton" aria-hidden="true" />
                                <div class="stream-frame__loader">
                                    <div class="stream-frame__spinner" aria-hidden="true" />
                                    <p class="meta">{{ loadingLabel }}</p>
                                </div>
                            </div>

                            <div v-if="!activeStreamUrl && !loading && !error" class="stream-frame__empty">
                                <p class="eyebrow">Search a title to begin</p>
                                <h3>Scraper Proxy</h3>
                                <p class="meta">proxy.moovie.fun/api/scrape</p>
                            </div>

                            <div v-if="error && !loading" class="stream-frame__error" role="alert">
                                <p class="eyebrow">Scrape failed</p>
                                <h3>{{ error }}</h3>
                                <button type="button" class="stream-frame__retry" @click="search">Retry</button>
                            </div>
                        </div>
                    </div>
                </div>

                <section v-if="result && numProviders > 0" class="server-accordion">
                    <div class="server-accordion__head">
                        <div class="server-accordion__heading">
                            <p class="eyebrow">Sources</p>
                            <h3 class="server-accordion__title">{{ numStreams }} stream{{ numStreams === 1 ? '' : 's' }} from {{ numProviders }} provider{{ numProviders === 1 ? '' : 's' }}</h3>
                        </div>
                    </div>

                    <div class="server-accordion__body">
                        <ul class="server-accordion__grid" role="listbox">
                            <li v-for="(urls, provider) in result" :key="provider">
                                <div class="server-card server-card--group">
                                    <span class="server-card__body">
                                        <span class="server-card__name">{{ provider }}</span>
                                        <span class="server-card__hint meta">{{ urls.length }} URL{{ urls.length === 1 ? '' : 's' }}</span>
                                    </span>
                                </div>
                                <div v-for="(url, i) in urls" :key="i" class="server-card server-card--url">
                                    <button
                                        type="button"
                                        class="server-card__body"
                                        :class="{ 'is-active': activeStreamUrl === url }"
                                        @click="setActive(provider, i)"
                                    >
                                        <span class="server-card__name">#{{ i + 1 }}</span>
                                        <span class="server-card__hint meta">{{ truncate(url, 70) }}</span>
                                    </button>
                                    <span class="server-card__actions">
                                        <button type="button" class="server-card__copy" title="Copy URL" @click="copy(url)">📋</button>
                                    </span>
                                </div>
                            </li>
                        </ul>
                        <p class="server-accordion__tip meta">
                            Click a stream to play. Copy URL to inspect.
                        </p>
                    </div>
                </section>

                <section v-if="result" class="watch-stage__rack">
                    <button type="button" class="debug-toggle" @click="showDebug = !showDebug">
                        {{ showDebug ? 'Hide' : 'Show' }} raw JSON
                    </button>
                    <pre v-if="showDebug">{{ JSON.stringify(result, null, 2) }}</pre>
                </section>
            </div>
        </main>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const API_BASE = 'https://proxy.moovie.fun';

const LOADING_MESSAGES = [
    'Probing providers…',
    'Firing up scrapers…',
    'Checking mirrors…',
    'Resolving streams…',
];

export default defineComponent({
    name: 'ScraperTesting',
    setup() {
        const router = useRouter();
        const searchTitle = ref('Interstellar');
        const season = ref(0);
        const episode = ref(0);
        const fast = ref(0);
        const loading = ref(false);
        const error = ref('');
        const result = ref<Record<string, string[]> | null>(null);
        const timing = ref<number | null>(null);
        const showDebug = ref(false);
        const activeStreamUrl = ref('');
        const artContainer = ref<HTMLElement | null>(null);
        const bloomRef = ref<HTMLElement | null>(null);
        const loadingLabel = ref(LOADING_MESSAGES[0]);
        let artInstance: any = null;
        let msgInterval: number | null = null;

        const title = computed(() => searchTitle.value.trim() || '');

        const numProviders = computed(() => {
            if (!result.value) return 0;
            return Object.keys(result.value).length;
        });

        const numStreams = computed(() => {
            if (!result.value) return 0;
            let count = 0;
            for (const urls of Object.values(result.value)) {
                count += urls.length;
            }
            return count;
        });

        const loadArtplayerAssets = (() => {
            let promise: Promise<void> | null = null;
            return () => {
                if ((window as any).Artplayer) return Promise.resolve();
                if (promise) return promise;
                promise = new Promise((resolve, reject) => {
                    if (!document.querySelector('link[data-stest-art-css]')) {
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = 'https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.css';
                        link.setAttribute('data-stest-art-css', '1');
                        document.head.appendChild(link);
                    }
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.min.js';
                    script.onload = () => {
                        const hlsScript = document.createElement('script');
                        hlsScript.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';
                        hlsScript.onload = () => resolve();
                        hlsScript.onerror = () => resolve();
                        document.head.appendChild(hlsScript);
                    };
                    script.onerror = () => reject(new Error('ArtPlayer failed to load'));
                    document.head.appendChild(script);
                });
                return promise;
            };
        })();

        const destroyArt = () => {
            if (artInstance) {
                try { artInstance.destroy(false); } catch { /* ignore */ }
                artInstance = null;
            }
        };

        const mountArtplayer = async (url: string) => {
            await loadArtplayerAssets();
            const container = artContainer.value;
            if (!container) return;
            destroyArt();

            const ArtplayerCtor = (window as any).Artplayer;
            const HlsCtor = (window as any).Hls;
            const isM3u8 = url.includes('.m3u8') || url.includes('m3u8');

            artInstance = new ArtplayerCtor({
                container,
                url,
                type: isM3u8 ? 'm3u8' : 'mp4',
                autoplay: true,
                preload: 'auto',
                playbackRate: true,
                aspectRatio: true,
                fullscreen: true,
                fullscreenWeb: true,
                miniProgressBar: true,
                fastForward: true,
                setting: true,
                theme: '#ff5a1f',
                customType: isM3u8 ? {
                    m3u8(video: HTMLVideoElement, src: string) {
                        if (HlsCtor?.isSupported()) {
                            const hls = new HlsCtor({ enableWorker: true });
                            hls.loadSource(src);
                            hls.attachMedia(video);
                        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                            video.src = src;
                        }
                    },
                } : undefined,
            });
        };

        const setActive = (provider: string, index: number) => {
            const url = result.value?.[provider]?.[index];
            if (url) {
                activeStreamUrl.value = url;
                mountArtplayer(url);
            }
        };

        const truncate = (s: string, n: number) =>
            s.length > n ? s.slice(0, n) + '…' : s;

        const copy = async (url: string) => {
            try {
                await navigator.clipboard.writeText(url);
            } catch { /* ignore */ }
        };

        const goBack = () => {
            router.push('/');
        };

        const search = async () => {
            const q = searchTitle.value.trim();
            if (!q) return;
            loading.value = true;
            error.value = '';
            result.value = null;
            activeStreamUrl.value = '';
            timing.value = null;
            destroyArt();

            let i = 0;
            loadingLabel.value = LOADING_MESSAGES[0];
            msgInterval = window.setInterval(() => {
                i = (i + 1) % LOADING_MESSAGES.length;
                loadingLabel.value = LOADING_MESSAGES[i];
            }, 1800);

            const params: Record<string, string> = { title: q };
            if (season.value > 0) params.season = String(season.value);
            if (episode.value > 0) params.episode = String(episode.value);
            if (fast.value) params.fast = '1';

            const qs = new URLSearchParams(params).toString();
            const url = `${API_BASE}/api/scrape?${qs}`;
            const startedAt = performance.now();

            try {
                const resp = await fetch(url);
                timing.value = Math.round(performance.now() - startedAt);
                if (!resp.ok) {
                    throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
                }
                result.value = await resp.json();
                if (numStreams.value > 0) {
                    const firstProvider = Object.keys(result.value!)[0];
                    setActive(firstProvider, 0);
                }
            } catch (err: any) {
                error.value = err.message || 'Request failed';
            } finally {
                loading.value = false;
                if (msgInterval) clearInterval(msgInterval);
                msgInterval = null;
            }
        };

        onUnmounted(() => {
            destroyArt();
            if (msgInterval) clearInterval(msgInterval);
        });

        return {
            searchTitle, season, episode, fast,
            loading, error, result, timing, showDebug,
            numProviders, numStreams, title,
            activeStreamUrl, artContainer, bloomRef, loadingLabel,
            search, setActive, truncate, copy, goBack,
        };
    },
});
</script>

<style scoped lang="scss">
.watch-stage {
    min-height: 100dvh;
    height: auto;
    overflow-x: clip;
    overflow-y: visible;
    background: var(--ink-900);
    color: var(--bone-50);

    &__chrome {
        position: sticky;
        top: 0;
        z-index: var(--z-header);
        background: linear-gradient(
            180deg,
            rgba(11, 10, 8, 0.95),
            rgba(11, 10, 8, 0.6) 70%,
            rgba(11, 10, 8, 0)
        );
        backdrop-filter: blur(14px);

        @media (min-width: 1024px) {
            position: fixed;
            left: 0;
            right: 0;
        }
    }

    &__chrome-inner {
        max-width: var(--container-max);
        margin: 0 auto;
        padding: var(--s-3) var(--s-4);
        display: grid;
        grid-template-columns: auto 1fr auto;
        grid-template-areas: 'crumb title actions';
        align-items: center;
        gap: var(--s-3) var(--s-4);

        @media (min-width: 768px) {
            padding: var(--s-4) var(--s-5);
        }

        @media (max-width: 640px) {
            grid-template-columns: auto 1fr;
            grid-template-areas: 'crumb actions';
            padding: var(--s-2) var(--s-3);
            gap: var(--s-2);
        }
    }

    &__crumb {
        grid-area: crumb;
        display: inline-flex;
        align-items: center;
        gap: var(--s-3);
        min-width: 0;

        @media (max-width: 1023px) {
            gap: var(--s-2);
            .eyebrow { display: none !important; }
        }
    }

    &__back {
        all: unset;
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        border-radius: 50%;
        background: var(--surface-tint);
        cursor: pointer;
        color: var(--bone-100);
        transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);

        @media (max-width: 640px) {
            width: 36px;
            height: 36px;
        }

        &:hover {
            background: var(--ember);
            color: var(--ink-900);
            transform: translateX(-2px);
        }

        &:focus-visible {
            outline: 2px solid var(--ember);
            outline-offset: 2px;
        }

        svg { width: 18px; height: 18px; }
    }

    &__title {
        grid-area: title;
        margin: 0;
        font-family: var(--font-display);
        font-weight: 500;
        font-size: var(--fs-lg);
        letter-spacing: var(--ls-tight);
        color: var(--bone-50);
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;

        @media (min-width: 768px) { font-size: var(--fs-xl); }
        @media (max-width: 1023px) { display: none !important; }
    }

    &__title-skeleton {
        grid-area: title;
        display: block;
        height: 18px;
        max-width: 280px;
        margin: 0 auto;
        background: var(--surface-tint);
        border-radius: var(--r-pill);
        @media (max-width: 1023px) { display: none !important; }
    }

    &__actions {
        grid-area: actions;
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        justify-content: flex-end;
    }

    &__main {
        display: grid;
        gap: 0;
    }

    &__theater {
        display: grid;
        gap: var(--s-5);
        max-width: var(--container-max);
        width: 100%;
        margin: 0 auto;
        box-sizing: border-box;

        @media (max-width: 1023px) {
            display: flex;
            flex-direction: column;
            gap: var(--s-4);
            padding: var(--s-3);
            height: auto;
            min-height: 0;
        }

        @media (min-width: 1024px) {
            min-height: 100dvh;
            padding: 72px var(--s-5) var(--s-2) var(--s-5);
            grid-template-columns: 1fr;
            align-items: stretch;
        }
    }

    &__rack {
        max-width: var(--container-max);
        width: 100%;
        margin: 0 auto;
        padding: 0 var(--s-4) calc(var(--s-9) + env(safe-area-inset-bottom, 0px));
        box-sizing: border-box;

        @media (min-width: 768px) {
            padding: 0 var(--s-5) calc(var(--s-9) + env(safe-area-inset-bottom, 0px));
        }
    }
}

// ── Scraper badge in chrome ──────────────────────────────────────
.scraper-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.75rem;
    border-radius: var(--r-pill);
    background: rgba(255, 90, 31, 0.1);
    border: 1px solid rgba(255, 90, 31, 0.2);
    font-size: var(--fs-xs);
    font-family: var(--font-mono);

    &__time { color: var(--ember); }
    &__providers { color: var(--bone-400); }
}

// ── Stream frame (player area) ───────────────────────────────────
.stream-frame {
    position: relative;
    width: 100%;
    isolation: isolate;

    &__bloom {
        position: absolute;
        inset: -10% -5%;
        width: fit-content;
        background: radial-gradient(ellipse at center, rgba(255, 90, 31, 0.08) 0%, transparent 70%);
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

        @media (min-width: 768px) and (max-width: 1023px) {
            padding: 0 var(--s-5) var(--s-6) var(--s-5);
        }
        @media (min-width: 1024px) { padding: 0; }
    }

    &__controls {
        display: flex;
        gap: var(--s-2);
        margin-bottom: var(--s-3);

        @media (min-width: 1024px) {
            padding: var(--s-3) 0 0;
        }
    }

    &__search {
        display: flex;
        align-items: center;
        gap: var(--s-2);
        width: 100%;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--rule);
        border-radius: var(--r-lg);
        padding: var(--s-1) var(--s-2);
        transition: border-color var(--dur-fast);

        &:focus-within {
            border-color: var(--ember);
        }
    }

    &__input {
        flex: 1;
        background: transparent;
        border: 0;
        padding: var(--s-2);
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        outline: none;

        &::placeholder { color: var(--bone-400); }
    }

    &__opts {
        display: flex;
        align-items: center;
        gap: var(--s-1);
    }

    &__opt {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        font-size: var(--fs-xs);
        color: var(--bone-400);

        span { font-family: var(--font-mono); }

        input[type='number'] {
            width: 36px;
            background: rgba(255,255,255,0.06);
            border: 1px solid var(--rule);
            border-radius: var(--r-sm);
            padding: 0.2rem 0.3rem;
            color: var(--bone-50);
            font-size: var(--fs-xs);
            text-align: center;
            outline: none;

            &:focus { border-color: var(--ember); }
        }

        input[type='checkbox'] {
            width: 16px;
            height: 16px;
            accent-color: var(--ember);
        }
    }

    &__go {
        padding: var(--s-1) var(--s-3);
        border: 0;
        border-radius: var(--r-pill);
        background: var(--ember);
        color: var(--ink-900);
        font-family: var(--font-ui);
        font-weight: 600;
        font-size: var(--fs-sm);
        cursor: pointer;
        transition: background-color var(--dur-fast), transform var(--dur-fast);
        white-space: nowrap;

        &:hover {
            background: var(--ember-600);
            transform: translateY(-1px);
        }
        &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
    }

    &__player {
        position: relative;
        aspect-ratio: 16 / 9;
        background: #000;
        border-radius: var(--r-lg);
        overflow: hidden;
        box-shadow:
            0 32px 80px rgba(0, 0, 0, 0.6),
            0 0 0 1px var(--rule);
        transition: box-shadow var(--dur-slow) var(--ease-out);
    }

    &__art {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
    }

    &__loading {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background: var(--ink-900);
        z-index: 5;
    }

    &__skeleton {
        position: absolute;
        inset: 0;
        background:
            linear-gradient(
                100deg,
                rgba(255, 255, 255, 0) 30%,
                rgba(255, 255, 255, 0.04) 50%,
                rgba(255, 255, 255, 0) 70%
            ) var(--ink-800);
        background-size: 220% 100%;
        animation: shimmer 2.4s infinite ease-in-out;
    }

    &__loader {
        position: relative;
        z-index: 1;
        display: grid;
        gap: var(--s-3);
        justify-items: center;
        color: var(--bone-200);
    }

    &__spinner {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 2px solid var(--rule-strong);
        border-top-color: var(--ember);
        animation: spin 1.1s linear infinite;
    }

    &__empty {
        position: absolute;
        inset: 0;
        display: grid;
        place-content: center;
        gap: var(--s-2);
        text-align: center;
        background: var(--ink-900);
        z-index: 5;

        h3 {
            font-family: var(--font-display);
            font-size: var(--fs-xl);
            color: var(--bone-50);
            margin: 0;
        }
    }

    &__error {
        position: absolute;
        inset: 0;
        display: grid;
        place-content: center;
        gap: var(--s-3);
        text-align: center;
        padding: var(--s-6);
        background: var(--ink-900);
        z-index: 5;

        h3 {
            font-family: var(--font-display);
            font-size: var(--fs-lg);
            color: var(--bone-50);
            margin: 0;
        }
    }

    &__retry {
        margin-top: var(--s-2);
        padding: 0.65rem 1.4rem;
        background: var(--ember);
        color: var(--ink-900);
        border: 0;
        border-radius: var(--r-pill);
        font-family: var(--font-ui);
        font-weight: 600;
        cursor: pointer;
        transition: background-color var(--dur-fast), transform var(--dur-fast);
        justify-self: center;

        &:hover {
            background: var(--ember-600);
            transform: translateY(-1px);
        }
    }
}

@keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
    .stream-frame__skeleton,
    .stream-frame__spinner {
        animation: none !important;
    }
}

.meta {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin: 0;
}

.eyebrow {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--bone-400);
    margin: 0;
}

// ── Server accordion (provider list) ─────────────────────────────
.server-accordion {
    background: var(--ink-850);
    box-shadow: inset 0 0 0 1px var(--rule);
    border-radius: var(--r-lg);
    overflow: hidden;

    &__head {
        padding: var(--s-4);
        border-bottom: 1px solid var(--rule);
    }

    &__heading {
        .eyebrow { margin-bottom: var(--s-1); }
    }

    &__title {
        margin: 0;
        font-family: var(--font-display);
        font-weight: 500;
        font-size: var(--fs-base);
        color: var(--bone-50);
        letter-spacing: var(--ls-tight);
    }

    &__body {
        padding: var(--s-3) var(--s-4) var(--s-4);
    }

    &__grid {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: var(--s-2);
    }

    &__tip {
        margin-top: var(--s-3);
        color: var(--bone-400);
        text-align: center;
    }
}

.server-card {
    border-radius: var(--r-md);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--rule);
    overflow: hidden;

    &--group {
        padding: var(--s-2) var(--s-3);
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(255, 255, 255, 0.08);
        .server-card__name { color: var(--bone-50); }
    }

    &--url {
        display: flex;
        align-items: center;
        border-radius: 0;
        border: 0;
        border-top: 1px solid var(--rule);

        &:first-of-type { border-top: 0; }
    }

    &__body {
        all: unset;
        display: flex;
        align-items: center;
        gap: var(--s-2);
        flex: 1;
        padding: var(--s-2) var(--s-3);
        cursor: pointer;
        transition: background-color var(--dur-fast);
        min-width: 0;

        &:hover { background: rgba(255, 255, 255, 0.04); }
        &.is-active { background: rgba(255, 90, 31, 0.08); }
    }

    &__name {
        font-family: var(--font-ui);
        font-weight: 600;
        font-size: var(--fs-sm);
        color: var(--ember);
        white-space: nowrap;
    }

    &__hint {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--bone-400);
    }

    &__actions {
        display: flex;
        align-items: center;
        padding-right: var(--s-2);
    }

    &__copy {
        all: unset;
        cursor: pointer;
        font-size: 14px;
        padding: var(--s-1);
        border-radius: var(--r-sm);
        transition: background-color var(--dur-fast);

        &:hover { background: rgba(255, 255, 255, 0.08); }
    }
}

.debug-toggle {
    all: unset;
    cursor: pointer;
    color: var(--bone-400);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    transition: color var(--dur-fast);

    &:hover { color: var(--bone-50); }
}

pre {
    margin: var(--s-3) 0 0;
    padding: var(--s-4);
    border-radius: var(--r-md);
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid var(--rule);
    overflow: auto;
    font-size: var(--fs-xs);
    line-height: 1.5;
    max-height: 400px;
    color: var(--bone-200);
}
</style>
