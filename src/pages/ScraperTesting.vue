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
            <div class="split-layout">
                <!-- ── Left: Player ────────────────────────────────── -->
                <div class="split-layout__player">
                    <div class="search-bar">
                        <input
                            v-model="searchTitle"
                            type="text"
                            placeholder="Search title…"
                            class="search-bar__input"
                            @keydown.enter="search"
                        />
                        <div class="search-bar__opts">
                            <label class="search-bar__opt">
                                <span>S</span>
                                <input v-model.number="season" type="number" min="0" placeholder="0" />
                            </label>
                            <label class="search-bar__opt">
                                <span>E</span>
                                <input v-model.number="episode" type="number" min="0" placeholder="0" />
                            </label>
                            <label class="search-bar__opt" title="Fast mode (API providers only)">
                                <span>⚡</span>
                                <input v-model.number="fast" type="checkbox" true-value="1" false-value="0" />
                            </label>
                        </div>
                        <button type="button" class="search-bar__go" :disabled="loading" @click="search">
                            {{ loading ? '…' : 'Go' }}
                        </button>
                    </div>

                    <div ref="bloomRef" class="player-frame" :class="{ 'has-error': error }">
                        <div v-if="activeStreamUrl" class="player-frame__bloom" aria-hidden="true" />
                        <div
                            v-if="activeStreamUrl"
                            ref="artContainer"
                            class="player-frame__art"
                        />

                        <div v-if="loading" class="player-frame__overlay">
                            <div class="player-frame__skeleton" aria-hidden="true" />
                            <div class="player-frame__loader">
                                <div class="player-frame__spinner" aria-hidden="true" />
                                <p class="meta">{{ loadingLabel }}</p>
                            </div>
                        </div>

                        <div v-if="!activeStreamUrl && !loading && !error" class="player-frame__overlay">
                            <p class="eyebrow">Search a title</p>
                            <h3>Scraper Proxy</h3>
                            <p class="meta">hahaevilcraft.site/api/scrape</p>
                        </div>

                        <div v-if="error && !loading" class="player-frame__overlay player-frame__overlay--error">
                            <p class="eyebrow">Scrape failed</p>
                            <h3>{{ error }}</h3>
                            <button type="button" class="search-bar__go" @click="search">Retry</button>
                        </div>
                    </div>
                </div>

                <!-- ── Right: Providers + Results ──────────────────── -->
                <div class="split-layout__side">
                    <!-- Provider selector -->
                    <section class="side-section">
                        <div class="side-section__head">
                            <p class="eyebrow">Providers</p>
                            <div class="side-section__actions">
                                <button type="button" class="pill-btn" @click="selectAllProviders">All</button>
                                <button type="button" class="pill-btn" @click="selectFastProviders">Fast</button>
                                <button type="button" class="pill-btn" @click="selectNoneProviders">None</button>
                            </div>
                        </div>
                        <div class="provider-grid">
                            <button
                                v-for="provider in allProviders"
                                :key="provider.name"
                                type="button"
                                class="provider-chip"
                                :class="{
                                    'is-selected': selectedProviders.has(provider.name),
                                    'is-fast': provider.fast,
                                    'has-result': result && result[provider.name],
                                    'has-error': result && !result[provider.name],
                                }"
                                @click="toggleProvider(provider.name)"
                            >
                                <span class="provider-chip__dot">{{ selectedProviders.has(provider.name) ? '✓' : '' }}</span>
                                <span class="provider-chip__name">{{ provider.name }}</span>
                                <span class="provider-chip__count">
                                    <template v-if="result && result[provider.name]">{{ result[provider.name].length }}</template>
                                    <template v-else-if="result && !result[provider.name]">✗</template>
                                </span>
                            </button>
                        </div>
                    </section>

                    <!-- Results -->
                    <section v-if="result && numProviders > 0" class="side-section side-section--results">
                        <div class="side-section__head">
                            <p class="eyebrow">Streams · {{ numStreams }} total</p>
                            <span v-if="timing" class="side-section__timing">{{ timing }}ms</span>
                        </div>
                        <div class="stream-list">
                            <div v-for="(urls, provider) in filteredResult" :key="provider" class="stream-group">
                                <div class="stream-group__head">
                                    <span class="stream-group__name">{{ provider }}</span>
                                    <div class="stream-group__actions">
                                        <button type="button" class="pill-btn pill-btn--xs" @click="copyAll(urls)">copy</button>
                                        <button type="button" class="pill-btn pill-btn--xs" @click="playAll(provider)">play</button>
                                    </div>
                                </div>
                                <div v-for="(url, i) in urls" :key="i" class="stream-row">
                                    <button type="button" class="stream-row__play" :class="{ 'is-active': activeStreamUrl === url }" @click="setActive(provider, i)">
                                        ▶ {{ i + 1 }}
                                    </button>
                                    <code class="stream-row__url">{{ truncate(url, 40) }}</code>
                                    <button type="button" class="stream-row__copy" title="Copy" @click="copy(url)">📋</button>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- Debug -->
                    <section class="side-section">
                        <button type="button" class="debug-toggle" @click="showDebug = !showDebug">
                            {{ showDebug ? 'Hide' : 'Show' }} JSON
                        </button>
                        <pre v-if="showDebug">{{ JSON.stringify(result, null, 2) }}</pre>
                    </section>
                </div>
            </div>
        </main>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

const API_BASE = 'https://hahaevilcraft.site';

const LOG = '[ScraperTest]';

const LOADING_MESSAGES = [
    'Probing providers…',
    'Firing up scrapers…',
    'Checking mirrors…',
    'Resolving streams…',
];

function dbg(label: string, data?: unknown) {
    if (data !== undefined) {
        console.debug(`${LOG} ${label}`, data);
    } else {
        console.debug(`${LOG} ${label}`);
    }
}

function log(label: string, data?: unknown) {
    if (data !== undefined) {
        console.log(`${LOG} ${label}`, data);
    } else {
        console.log(`${LOG} ${label}`);
    }
}

function warn(label: string, data?: unknown) {
    if (data !== undefined) {
        console.warn(`${LOG} ${label}`, data);
    } else {
        console.warn(`${LOG} ${label}`);
    }
}

function err(label: string, data?: unknown) {
    if (data !== undefined) {
        console.error(`${LOG} ${label}`, data);
    } else {
        console.error(`${LOG} ${label}`);
    }
}

const ALL_PROVIDERS: { name: string; fast: boolean }[] = [
    { name: 'VidLink', fast: true },
    { name: 'VidFast', fast: true },
    { name: 'Hexa', fast: true },
    { name: 'Onetouchtv', fast: false },
    { name: 'Lordflix', fast: true },
    { name: 'Kisskh', fast: true },
    { name: 'DahmerMovies', fast: false },
    { name: 'Akwam', fast: false },
    { name: 'VegaMovies', fast: false },
    { name: 'Bollyflix', fast: false },
    { name: 'Moviesmod', fast: false },
    { name: 'MoviesDrive', fast: false },
    { name: 'OnlineMoviesHindi', fast: false },
    { name: 'Animepahe', fast: true },
    { name: 'Levidia', fast: false },
    { name: 'Desicinemas', fast: false },
    { name: 'Goojara', fast: false },
    { name: 'UHDmovies', fast: false },
    { name: 'NetMirror', fast: true },
    { name: 'Peachify', fast: true },
    { name: 'ShowBox', fast: false },
];

const FAST_NAMES = new Set(ALL_PROVIDERS.filter(p => p.fast).map(p => p.name));

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
        const providersOpen = ref(true);
        const selectedProviders = ref(new Set(ALL_PROVIDERS.map(p => p.name)));
        let artInstance: any = null;
        let msgInterval: number | null = null;
        let hlsInstance: any = null;

        const allProviders = ALL_PROVIDERS;

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

        const allStreamsFlat = computed(() => {
            const out: { provider: string; index: number; url: string }[] = [];
            if (!result.value) return out;
            for (const [provider, urls] of Object.entries(result.value)) {
                urls.forEach((url, i) => out.push({ provider, index: i, url }));
            }
            return out;
        });

        const filteredResult = computed(() => {
            if (!result.value) return null;
            const out: Record<string, string[]> = {};
            const sortedEntries = Object.entries(result.value).sort(([keyA], [keyB]) => {
                const isSpiderA = keyA.toLowerCase().includes('spider');
                const isSpiderB = keyB.toLowerCase().includes('spider');
                if (isSpiderA && !isSpiderB) return -1;
                if (!isSpiderA && isSpiderB) return 1;
                return keyA.localeCompare(keyB);
            });
            for (const [provider, urls] of sortedEntries) {
                const baseProvider = provider.split(' ·')[0];
                if (selectedProviders.value.has(baseProvider)) {
                    out[provider] = urls;
                }
            }
            return out;
        });

        function toggleProvider(name: string) {
            const s = new Set(selectedProviders.value);
            if (s.has(name)) s.delete(name);
            else s.add(name);
            selectedProviders.value = s;
        }

        function selectAllProviders() {
            selectedProviders.value = new Set(ALL_PROVIDERS.map(p => p.name));
        }

        function selectFastProviders() {
            selectedProviders.value = new Set(FAST_NAMES);
            fast.value = 1;
        }

        function selectNoneProviders() {
            selectedProviders.value = new Set();
        }

        function playAll(provider: string) {
            const urls = result.value?.[provider];
            if (urls?.length) setActive(provider, 0);
        }

        function copyAll(urls: string[]) {
            copy(urls.join('\n'));
        }

        function inspectUrl(u: string) {
            try {
                const parsed = new URL(u);
                return {
                    protocol: parsed.protocol,
                    hostname: parsed.hostname,
                    port: parsed.port,
                    pathname: parsed.pathname,
                    pathLength: parsed.pathname.length,
                    search: parsed.search,
                    searchParams: Object.fromEntries(parsed.searchParams.entries()),
                    hash: parsed.hash,
                };
            } catch {
                return { error: 'invalid URL', raw: u };
            }
        }

        const loadHls = (() => {
            let promise: Promise<void> | null = null;
            return () => {
                if ((window as any).Hls) {
                    dbg('hls.js:already-loaded');
                    return Promise.resolve();
                }
                if (promise) {
                    dbg('hls.js:awaiting-existing-load');
                    return promise;
                }
                dbg('hls.js:starting-asset-load');
                promise = new Promise((resolve) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';
                    script.onload = () => {
                        log('hls.js:script-loaded', { version: (window as any).Hls?.version || 'unknown' });
                        resolve();
                    };
                    script.onerror = () => {
                        warn('hls.js:script-failed, continuing without hls.js');
                        resolve();
                    };
                    document.head.appendChild(script);
                });
                return promise;
            };
        })();

        function destroyArt() {
            if (artInstance) {
                log('plyr:destroy', { hasInstance: true });
                try {
                    artInstance.destroy();
                } catch (e) {
                    warn('plyr:destroy-error', e);
                }
                artInstance = null;
            }
            if (hlsInstance) {
                dbg('hls.js:destroy');
                try { hlsInstance.destroy(); } catch { /* */ }
                hlsInstance = null;
            }
            if (artContainer.value) {
                artContainer.value.innerHTML = '';
            }
        }

        async function mountPlayer(url: string) {
            log('plyr:mount-start', { url, urlInspect: inspectUrl(url) });

            await loadHls();
            const container = artContainer.value;
            if (!container) {
                warn('plyr:mount-skipped-no-container');
                return;
            }
            destroyArt();

            const HlsCtor = (window as any).Hls;
            const isM3u8 = url.includes('.m3u8') || url.includes('m3u8') || url.includes('.m3u');

            const video = document.createElement('video');
            video.controls = false;
            video.playsInline = true;
            video.autoplay = true;
            video.className = 'plyr-video-element';
            container.appendChild(video);

            if (isM3u8 && HlsCtor) {
                log('plyr:mount-hls-config', {
                    hlsJsAvailable: Boolean(HlsCtor),
                    hlsJsSupported: HlsCtor.isSupported(),
                });

                if (HlsCtor.isSupported()) {
                    hlsInstance = new HlsCtor({
                        enableWorker: true,
                        debug: true,
                        maxBufferLength: 30,
                        maxMaxBufferLength: 60,
                    });

                    hlsInstance.on(HlsCtor.Events.ERROR, (_event: any, data: any) => {
                        if (data.fatal) {
                            err('hls.js:fatal-error', {
                                type: data.type,
                                details: data.details,
                                reason: data.reason,
                            });
                        }
                    });

                    hlsInstance.loadSource(url);
                    hlsInstance.attachMedia(video);
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = url;
                }
            } else {
                video.src = url;
            }

            artInstance = new Plyr(video, {
                autoplay: true,
                controls: [
                    'play-large',
                    'play',
                    'progress',
                    'current-time',
                    'duration',
                    'mute',
                    'volume',
                    'settings',
                    'pip',
                    'airplay',
                    'fullscreen',
                ],
                settings: ['quality', 'speed', 'loop'],
                tooltips: { controls: true, seek: true },
            });

            log('plyr:mounted', { url });
        }

        const setActive = (provider: string, index: number) => {
            const url = result.value?.[provider]?.[index];
            if (url) {
                log('stream:set-active', { provider, index, url, urlInspect: inspectUrl(url) });
                activeStreamUrl.value = url;
                mountPlayer(url);
            } else {
                warn('stream:set-active-invalid', { provider, index });
            }
        };

        const truncate = (s: string, n: number) =>
            s.length > n ? s.slice(0, n) + '…' : s;

        const copy = async (url: string) => {
            try {
                await navigator.clipboard.writeText(url);
                log('clipboard:copied', { url: url.slice(0, 80) });
            } catch (e) {
                warn('clipboard:copy-failed', e);
            }
        };

        const goBack = () => {
            router.push('/');
        };

        const search = async () => {
            const q = searchTitle.value.trim();
            if (!q) return;

            log('scrape:start', {
                title: q,
                season: season.value,
                episode: episode.value,
                fast: Boolean(fast.value),
                timestamp: new Date().toISOString(),
            });

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

            const requestedProviders = Array.from(selectedProviders.value);
            if (!requestedProviders.length) {
                error.value = 'Select at least one provider to test';
                loading.value = false;
                if (msgInterval) clearInterval(msgInterval);
                msgInterval = null;
                return;
            }

            const params: Record<string, string> = {
                title: q,
                providers: requestedProviders.join(','),
            };
            if (season.value > 0) params.season = String(season.value);
            if (episode.value > 0) params.episode = String(episode.value);
            if (fast.value) params.fast = '1';

            const qs = new URLSearchParams(params).toString();
            const url = `${API_BASE}/api/search?${qs}`;

            log('scrape:request', {
                url,
                params,
                apiBase: API_BASE,
            });

            const startedAt = performance.now();

            try {
                const resp = await fetch(url);
                const elapsed = Math.round(performance.now() - startedAt);
                timing.value = elapsed;

                const headers: Record<string, string> = {};
                resp.headers.forEach((v, k) => { headers[k] = v; });

                dbg('scrape:response-headers', {
                    status: resp.status,
                    statusText: resp.statusText,
                    ok: resp.ok,
                    contentType: resp.headers.get('content-type'),
                    contentLength: resp.headers.get('content-length'),
                    cacheControl: resp.headers.get('cache-control'),
                    date: resp.headers.get('date'),
                    elapsed,
                    headers,
                });

                if (!resp.ok) {
                    const body = await resp.text();
                    err('scrape:http-error', { status: resp.status, body: body.slice(0, 500) });
                    throw new Error(`HTTP ${resp.status}: ${body.slice(0, 200)}`);
                }

                const payload = await resp.json();
                const rawData: Record<string, string[]> = {};
                for (const item of payload.results || []) {
                    const displayName = item.providerName || item.provider || 'Unknown';
                    const requestedName = requestedProviders.find((name) => {
                        const left = name.trim().toLowerCase();
                        const right = displayName.trim().toLowerCase();
                        return left === right || left.replace(/\s+/g, '') === right.replace(/\s+/g, '');
                    });
                    const resultName = requestedName || displayName;
                    const urls = (item.streams || [])
                        .map((stream: any) => stream.proxyUrl || stream.url || stream.playlist)
                        .filter(Boolean)
                        .map((streamUrl: string) => streamUrl.startsWith('/') ? `${API_BASE}${streamUrl}` : streamUrl);
                    if (urls.length) rawData[resultName] = urls;
                }
                log('scrape:response-parsed', {
                    elapsed,
                    providerCount: Object.keys(rawData).length,
                    totalStreams: Object.values(rawData).reduce((acc: number, v: any) => acc + (Array.isArray(v) ? v.length : 0), 0),
                    providers: Object.entries(rawData).map(([name, urls]) => ({
                        name,
                        count: (urls as any[]).length,
                    })),
                    backendErrors: payload.errors || [],
                });

                // Deep inspect each stream URL
                for (const [provider, urls] of Object.entries(rawData)) {
                    dbg(`scrape:provider:${provider}`, {
                        count: (urls as any[]).length,
                        urls: (urls as any[]).map((u: string) => inspectUrl(u)),
                        raw: urls,
                    });
                }

                result.value = rawData;

                // Auto-play first playable stream (M3U8 > MP4 > WebM)
                const playableExts = ['.m3u8', '.mp4', '.webm'];
                function targetExt(url: string): string {
                    const m = url.match(/[?&]url=([^&]+)/);
                    if (m) {
                        try {
                            const decoded = atob(decodeURIComponent(m[1]));
                            return decoded.split('?')[0].split('#')[0].toLowerCase();
                        } catch { /* fall through */ }
                    }
                    return url.split('?')[0].split('#')[0].toLowerCase();
                }
                let autoPlayed = false;
                const sortedEntries = (Object.entries(rawData) as [string, string[]][]).sort(([keyA], [keyB]) => {
                    const isSpiderA = keyA.toLowerCase().includes('spider');
                    const isSpiderB = keyB.toLowerCase().includes('spider');
                    if (isSpiderA && !isSpiderB) return -1;
                    if (!isSpiderA && isSpiderB) return 1;
                    return keyA.localeCompare(keyB);
                });
                for (const [prov, urls] of sortedEntries) {
                    for (let i = 0; i < urls.length; i++) {
                        const ext = targetExt(urls[i]);
                        if (playableExts.some(e => ext.endsWith(e))) {
                            log('scrape:auto-play', { provider: prov, index: i, url: urls[i] });
                            setActive(prov, i);
                            autoPlayed = true;
                            break;
                        }
                    }
                    if (autoPlayed) break;
                }
                if (!autoPlayed && Object.keys(rawData).length > 0) {
                    const firstProv = Object.keys(rawData)[0];
                    log('scrape:auto-play-fallback', { provider: firstProv, url: rawData[firstProv][0] });
                    setActive(firstProv, 0);
                }
            } catch (e: any) {
                const elapsed = timing.value !== null ? timing.value : Math.round(performance.now() - startedAt);
                err('scrape:failed', {
                    message: e.message,
                    stack: e.stack?.split('\n').slice(0, 6).join('\n'),
                    elapsed,
                });
                error.value = e.message || 'Request failed';
            } finally {
                loading.value = false;
                if (msgInterval) clearInterval(msgInterval);
                msgInterval = null;
                log('scrape:end', {
                    elapsed: timing.value,
                    totalStreams: numStreams.value,
                    providers: numProviders.value,
                });
            }
        };

        // Expose debug state to window for console inspection
        onMounted(() => {
            (window as any).__scraperDebug = {
                state: () => ({
                    searchTitle: searchTitle.value,
                    season: season.value,
                    episode: episode.value,
                    fast: fast.value,
                    loading: loading.value,
                    error: error.value,
                    result: result.value,
                    timing: timing.value,
                    activeStreamUrl: activeStreamUrl.value,
                    numProviders: numProviders.value,
                    numStreams: numStreams.value,
                    artInstance: artInstance ? {
                        url: artInstance.url,
                        playing: !artInstance.paused,
                    } : null,
                    hlsInstance: hlsInstance ? { alive: true } : null,
                    allStreams: allStreamsFlat.value,
                }),
                inspect: (url: string) => inspectUrl(url),
                search: search,
                play: setActive,
                result: result,
                apiBase: API_BASE,
                version: '1.0.0',
            };
            log('debug:exposed', { hint: 'Use window.__scraperDebug in console' });
            dbg('debug:exposed-full', { api: Object.keys((window as any).__scraperDebug) });
        });

        onUnmounted(() => {
            destroyArt();
            if (msgInterval) clearInterval(msgInterval);
            delete (window as any).__scraperDebug;
        });

        return {
            searchTitle, season, episode, fast,
            loading, error, result, timing, showDebug,
            numProviders, numStreams, title,
            activeStreamUrl, artContainer, bloomRef, loadingLabel,
            allProviders, selectedProviders, providersOpen, filteredResult,
            search, setActive, truncate, copy, goBack,
            toggleProvider, selectAllProviders, selectFastProviders, selectNoneProviders, copyAll, playAll,
        };
    },
});
</script>

<style scoped lang="scss">
.watch-stage {
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    &__chrome {
        position: sticky;
        top: 0;
        z-index: var(--z-header);
        background: transparent;
        background-color: transparent;
        backdrop-filter: none;

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

        @media (min-width: 768px) { padding: var(--s-4) var(--s-5); }
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
        @media (max-width: 1023px) { gap: var(--s-2); .eyebrow { display: none !important; } }
    }

    &__back {
        all: unset;
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        border-radius: 50%;
        background: transparent;
        background-color: transparent;
        box-shadow: none;
        cursor: pointer;
        color: var(--bone-100);
        transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
        @media (max-width: 640px) { width: 36px; height: 36px; }

        &:hover { background: var(--ember); color: var(--ink-900); transform: translateX(-2px); }
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
}

// ── Scraper badge ────────────────────────────────────────────────
.scraper-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.75rem;
    border-radius: var(--r-pill);
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    font-size: var(--fs-xs);
    font-family: var(--font-mono);
    &__time { color: var(--ember); }
    &__providers { color: var(--bone-400); }
}

// ── Side-by-side layout ─────────────────────────────────────────
.split-layout {
    display: flex;
    gap: var(--s-3);
    max-width: var(--container-max);
    width: 100%;
    margin: 0 auto;
    padding: var(--s-1) var(--s-3) calc(var(--s-9) + env(safe-area-inset-bottom, 0px));
    box-sizing: border-box;

    @media (min-width: 1024px) {
        padding: 72px var(--s-4) var(--s-4);
        min-height: 100dvh;
    }

    @media (max-width: 1023px) {
        flex-direction: column;
        padding: var(--s-2);
    }

    &__player {
        flex: 0 0 55%;
        min-width: 0;

        @media (min-width: 1024px) {
            position: sticky;
            top: 72px;
            align-self: start;
        }

        @media (max-width: 1023px) {
            flex: none;
            width: 100%;
        }
    }

    &__side {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--s-2);
        max-height: calc(100dvh - 80px);
        overflow-y: auto;

        @media (max-width: 1023px) {
            max-height: none;
            overflow-y: visible;
        }

        &::-webkit-scrollbar { width: 4px; }
        &::-webkit-scrollbar-track { background: transparent; }
        &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: var(--r-pill); }
    }
}

// ── Search bar ──────────────────────────────────────────────────
.search-bar {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    margin-bottom: var(--s-2);
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--rule);
    border-radius: var(--r-lg);
    padding: var(--s-1) var(--s-2);

    &:focus-within { border-color: var(--ember); }

    &__input {
        flex: 1;
        background: transparent;
        border: 0;
        padding: var(--s-1);
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        outline: none;
        &::placeholder { color: var(--bone-400); }
    }

    &__opts {
        display: flex;
        align-items: center;
        gap: 2px;
    }

    &__opt {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        font-size: 10px;
        color: var(--bone-400);
        span { font-family: var(--font-mono); }

        input[type='number'] {
            width: 28px;
            background: rgba(255,255,255,0.06);
            border: 1px solid var(--rule);
            border-radius: 4px;
            padding: 0.15rem 0.2rem;
            color: var(--bone-50);
            font-size: 10px;
            text-align: center;
            outline: none;
            &:focus { border-color: var(--ember); }
        }
        input[type='checkbox'] { width: 14px; height: 14px; accent-color: var(--ember); }
    }

    &__go {
        padding: 0.25rem 0.7rem;
        border: 0;
        border-radius: var(--r-pill);
        background: var(--ember);
        color: var(--ink-900);
        font-family: var(--font-ui);
        font-weight: 600;
        font-size: 11px;
        cursor: pointer;
        white-space: nowrap;
        transition: background-color var(--dur-fast);
        &:hover { background: var(--ember-600); }
        &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
}

// ── Player frame ────────────────────────────────────────────────
.player-frame {
    position: relative;
    aspect-ratio: 16 / 9;
    background: #000;
    border-radius: var(--r-lg);
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px var(--rule);

    &__bloom {
        position: absolute;
        inset: -10% -5%;
        background: radial-gradient(ellipse at center, rgba(255, 255, 255,0.08) 0%, transparent 70%);
        filter: blur(60px);
        opacity: 0.5;
        z-index: -1;
        pointer-events: none;
        &::after {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(ellipse at center, transparent 0%, var(--ink-900) 78%);
        }
    }

    &__art {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
    }

    &__overlay {
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
            font-size: var(--fs-base);
            color: var(--bone-50);
            margin: 0;
        }

        &--error h3 { color: #ff8f8f; }
    }

    &__skeleton {
        position: absolute;
        inset: 0;
        background: linear-gradient(100deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0) 70%) var(--ink-800);
        background-size: 220% 100%;
        animation: shimmer 2.4s infinite ease-in-out;
    }

    &__loader {
        position: relative;
        z-index: 1;
        display: grid;
        gap: var(--s-2);
        justify-items: center;
        color: var(--bone-200);
    }

    &__spinner {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 2px solid var(--rule-strong);
        border-top-color: var(--ember);
        animation: spin 1.1s linear infinite;
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
    .player-frame__skeleton,
    .player-frame__spinner { animation: none !important; }
}

.meta {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin: 0;
}

.eyebrow {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--bone-400);
    margin: 0;
}

// ── Side sections ───────────────────────────────────────────────
.side-section {
    background: rgba(10, 16, 28, 0.6);
    border: 1px solid var(--rule);
    border-radius: var(--r-lg);
    padding: var(--s-2) var(--s-2);

    &__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-2);
        margin-bottom: var(--s-2);
        padding: 0 var(--s-1);
    }

    &__actions {
        display: flex;
        gap: 4px;
    }

    &__timing {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--ember);
    }

    &--results {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;

        .side-section__head { flex-shrink: 0; }
    }
}

.pill-btn {
    all: unset;
    cursor: pointer;
    padding: 0.15rem 0.5rem;
    border-radius: var(--r-pill);
    background: rgba(255,255,255,0.06);
    border: 1px solid var(--rule);
    color: var(--bone-300);
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    transition: all var(--dur-fast);
    white-space: nowrap;

    &:hover { background: rgba(255,255,255,0.1); border-color: var(--bone-400); }

    &--xs {
        padding: 0.1rem 0.35rem;
        font-size: 8px;
    }
}

// ── Provider grid chips ─────────────────────────────────────────
.provider-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 4px;
}

.provider-chip {
    all: unset;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px;
    border-radius: 6px;
    background: rgba(255,255,255,0.02);
    border: 1px solid var(--rule);
    cursor: pointer;
    transition: all var(--dur-fast);
    min-width: 0;

    &:hover { background: rgba(255,255,255,0.06); border-color: var(--bone-400); }

    &.is-selected {
        border-color: var(--ember);
        background: rgba(255, 255, 255, 0.06);
    }

    &.has-result {
        border-color: rgba(78, 255, 120, 0.25);
        &.is-selected { border-color: #4eff78; }
    }

    &.has-error { opacity: 0.4; }

    &__dot {
        width: 14px;
        height: 14px;
        border-radius: 3px;
        border: 1px solid var(--rule-strong);
        display: grid;
        place-items: center;
        font-size: 8px;
        font-weight: 700;
        flex-shrink: 0;
        color: transparent;
        transition: all var(--dur-fast);
    }

    &.is-selected &__dot {
        border-color: var(--ember);
        background: rgba(255, 255, 255, 0.15);
        color: var(--ember);
    }

    &__name {
        font-family: var(--font-ui);
        font-weight: 600;
        font-size: 10px;
        color: var(--bone-50);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
        min-width: 0;
    }

    &__count {
        font-family: var(--font-mono);
        font-size: 8px;
        color: var(--bone-400);
        flex-shrink: 0;
    }

    &.is-fast &__name { color: var(--ember); }
    &.has-result &__count { color: #4eff78; }
}

// ── Stream results list ─────────────────────────────────────────
.stream-list {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    overflow-y: auto;
    flex: 1;
    min-height: 0;

    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: var(--r-pill); }
}

.stream-group {
    border: 1px solid var(--rule);
    border-radius: var(--r-md);
    overflow: hidden;

    &__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 8px;
        background: rgba(255,255,255,0.04);
        border-bottom: 1px solid var(--rule);
    }

    &__name {
        font-family: var(--font-ui);
        font-weight: 600;
        font-size: 11px;
        color: var(--ember);
    }

    &__actions {
        display: flex;
        gap: 4px;
    }
}

.stream-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-bottom: 1px solid rgba(255,255,255,0.03);

    &:last-child { border-bottom: 0; }

    &__play {
        all: unset;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(255,255,255,0.04);
        border: 1px solid var(--rule);
        color: var(--bone-300);
        font-family: var(--font-mono);
        font-size: 9px;
        white-space: nowrap;
        transition: all var(--dur-fast);
        flex-shrink: 0;

        &:hover { background: rgba(255, 255, 255,0.1); border-color: var(--ember); color: var(--ember); }
        &.is-active { background: rgba(255, 255, 255,0.15); border-color: var(--ember); color: var(--ember); }
    }

    &__url {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 9px;
        color: rgba(244, 247, 251, 0.45);
        font-family: var(--font-mono);
    }

    &__copy {
        all: unset;
        cursor: pointer;
        font-size: 12px;
        padding: 2px;
        border-radius: 4px;
        flex-shrink: 0;
        transition: background-color var(--dur-fast);
        &:hover { background: rgba(255,255,255,0.08); }
    }
}

// ── Debug ───────────────────────────────────────────────────────
.debug-toggle {
    all: unset;
    cursor: pointer;
    color: var(--bone-400);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    transition: color var(--dur-fast);
    &:hover { color: var(--bone-50); }
}

pre {
    margin: var(--s-2) 0 0;
    padding: var(--s-2);
    border-radius: var(--r-md);
    background: rgba(0,0,0,0.45);
    border: 1px solid var(--rule);
    overflow: auto;
    font-size: 9px;
    line-height: 1.4;
    max-height: 300px;
    color: var(--bone-200);
}

/* ── Plyr Custom Styling & Sleek Overrides ── */
.player-frame__art {
    --plyr-color-main: var(--ember, #ffffff);
    --plyr-video-background: #000;
    --plyr-menu-background: rgba(21, 20, 26, 0.95);
    --plyr-menu-color: rgba(245, 242, 235, 0.8);
    --plyr-control-radius: 10px;
    --plyr-tooltip-background: rgba(11, 10, 8, 0.9);
    --plyr-tooltip-color: #fff;
    --plyr-range-track-height: 4px;
    --plyr-range-thumb-height: 12px;

    width: 100%;
    height: 100%;

    :deep(.plyr) {
        height: 100%;
        width: 100%;
        border-radius: inherit;
        background: #000;
    }

    :deep(.plyr__video-wrapper) {
        height: 100%;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    :deep(video) {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }

    /* Floating control bar logic for Plyr controls */
    :deep(.plyr__controls) {
        background: rgba(11, 10, 8, 0.8) !important;
        backdrop-filter: blur(14px) saturate(1.2) !important;
        -webkit-backdrop-filter: blur(14px) saturate(1.2) !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        border-radius: 10px !important;
        margin: 24px !important; /* Float 24px inside from all edges */
        padding: 10px 16px !important;
        position: absolute !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 10 !important;
        transition: opacity 0.3s ease, transform 0.3s ease !important;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5) !important;
    }

    /* Style Plyr buttons to be warm/orange desaturated */
    :deep(.plyr__control) {
        color: rgba(255, 255, 255, 0.8) !important;
        transition: color 0.2s ease, transform 0.15s ease !important;

        &:hover, &[aria-expanded="true"] {
            background: rgba(255, 255, 255, 0.1) !important;
            color: #ff723f !important;
            filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.6)) !important;
        }
    }

    /* Plyr progress bar slider overrides */
    :deep(.plyr__progress input[type='range']) {
        color: var(--plyr-color-main) !important;
    }
}
</style>
