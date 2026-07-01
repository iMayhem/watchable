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

                <!-- Provider selector accordion -->
                <section class="provider-selector">
                    <div class="server-accordion__head" @click="providersOpen = !providersOpen">
                        <div class="server-accordion__heading">
                            <p class="eyebrow">Provider selector</p>
                            <h3 class="server-accordion__title">
                                {{ selectedProviders.size === allProviders.length ? 'All providers' : `${selectedProviders.size} / ${allProviders.length} selected` }}
                                <span class="provider-selector__chev">{{ providersOpen ? '▲' : '▼' }}</span>
                            </h3>
                        </div>
                        <div class="provider-selector__actions">
                            <button type="button" class="provider-selector__action" @click.stop="selectAllProviders">All</button>
                            <button type="button" class="provider-selector__action" @click.stop="selectFastProviders">Fast</button>
                            <button type="button" class="provider-selector__action" @click.stop="selectedProviders.clear(); selectedProviders = new Set(selectedProviders)">None</button>
                        </div>
                    </div>

                    <div v-if="providersOpen" class="server-accordion__body">
                        <ul class="server-accordion__grid provider-selector__grid">
                            <li v-for="provider in allProviders" :key="provider.name">
                                <button
                                    type="button"
                                    class="provider-card"
                                    :class="{
                                        'is-selected': selectedProviders.has(provider.name),
                                        'is-fast': provider.fast,
                                        'has-result': result && result[provider.name],
                                        'has-error': result && !result[provider.name],
                                    }"
                                    @click="toggleProvider(provider.name)"
                                >
                                    <span class="provider-card__check">{{ selectedProviders.has(provider.name) ? '✓' : '' }}</span>
                                    <span class="provider-card__body">
                                        <span class="provider-card__name">{{ provider.name }}</span>
                                        <span class="provider-card__hint meta">
                                            {{ provider.fast ? 'fast' : 'full' }}
                                            <template v-if="result && result[provider.name]">
                                                · {{ result[provider.name].length }} URL{{ result[provider.name].length === 1 ? '' : 's' }}
                                            </template>
                                            <template v-else-if="result && !result[provider.name]">
                                                · no streams
                                            </template>
                                        </span>
                                    </span>
                                    <span class="provider-card__badge" :class="{ 'is-live': result && result[provider.name] }">
                                        {{ result && result[provider.name] ? '✓' : result ? '✗' : '' }}
                                    </span>
                                </button>
                            </li>
                        </ul>
                    </div>
                </section>

                <!-- Results per provider -->
                <section v-if="result && numProviders > 0" class="server-accordion">
                    <div class="server-accordion__head">
                        <div class="server-accordion__heading">
                            <p class="eyebrow">Sources</p>
                            <h3 class="server-accordion__title">{{ numStreams }} stream{{ numStreams === 1 ? '' : 's' }} from {{ numProviders }} provider{{ numProviders === 1 ? '' : 's' }}</h3>
                        </div>
                    </div>

                    <div class="server-accordion__body">
                        <ul class="server-accordion__grid" role="listbox">
                            <li v-for="(urls, provider) in filteredResult" :key="provider">
                                <div class="server-card server-card--group">
                                    <span class="server-card__body">
                                        <span class="server-card__name">{{ provider }}</span>
                                        <span class="server-card__hint meta">{{ urls.length }} URL{{ urls.length === 1 ? '' : 's' }}</span>
                                    </span>
                                    <span class="server-card__actions">
                                        <button type="button" class="server-card__copy" title="Copy all URLs" @click="copyAll(urls)">📋 all</button>
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
import { computed, defineComponent, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const API_BASE = 'https://proxy.moovie.fun';

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
            for (const [provider, urls] of Object.entries(result.value)) {
                if (selectedProviders.value.has(provider)) {
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

        const loadArtplayerAssets = (() => {
            let promise: Promise<void> | null = null;
            return () => {
                if ((window as any).Artplayer) {
                    dbg('artplayer:already-loaded');
                    return Promise.resolve();
                }
                if (promise) {
                    dbg('artplayer:awaiting-existing-load');
                    return promise;
                }
                dbg('artplayer:starting-asset-load');
                promise = new Promise((resolve, reject) => {
                    if (!document.querySelector('link[data-stest-art-css]')) {
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = 'https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.css';
                        link.setAttribute('data-stest-art-css', '1');
                        document.head.appendChild(link);
                        dbg('artplayer:css-link-appended');
                    }
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.min.js';
                    script.onload = () => {
                        log('artplayer:script-loaded', { version: (window as any).Artplayer?.version || 'unknown' });
                        const hlsScript = document.createElement('script');
                        hlsScript.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';
                        hlsScript.onload = () => {
                            log('hls.js:script-loaded', { version: (window as any).Hls?.version || 'unknown' });
                            resolve();
                        };
                        hlsScript.onerror = () => {
                            warn('hls.js:script-failed, continuing without hls.js');
                            resolve();
                        };
                        document.head.appendChild(hlsScript);
                        dbg('hls.js:script-tag-appended');
                    };
                    script.onerror = () => {
                        err('artplayer:script-load-failed');
                        reject(new Error('ArtPlayer failed to load'));
                    };
                    document.head.appendChild(script);
                    dbg('artplayer:script-tag-appended');
                });
                return promise;
            };
        })();

        function destroyArt() {
            if (artInstance) {
                log('artplayer:destroy', {
                    hasInstance: true,
                    currentUrl: artInstance?.url,
                });
                try {
                    artInstance.destroy(false);
                    dbg('artplayer:destroy-ok');
                } catch (e) {
                    warn('artplayer:destroy-error', e);
                }
                artInstance = null;
            }
            if (hlsInstance) {
                dbg('hls.js:destroy');
                try { hlsInstance.destroy(); } catch { /* */ }
                hlsInstance = null;
            }
        }

        function setupArtplayerEvents(art: any, url: string) {
            const events = [
                'video:loadedmetadata',
                'video:canplay',
                'video:playing',
                'video:pause',
                'video:waiting',
                'video:stalled',
                'video:error',
                'video:ended',
                'video:timeupdate',
                'video:seeking',
                'video:seeked',
                'ready',
                'pause',
                'play',
                'error',
                'destroy',
            ] as const;

            const meta = { url, mountedAt: Date.now() };

            art.on('ready', () => log('artplayer:ready', meta));
            art.on('play', () => log('artplayer:play', meta));
            art.on('pause', () => dbg('artplayer:pause', meta));
            art.on('error', (e: any) => err('artplayer:error', { ...meta, error: e }));
            art.on('destroy', () => log('artplayer:destroy-event', meta));

            art.on('video:loadedmetadata', () => {
                const v = art.video;
                log('artplayer:video:loadedmetadata', {
                    ...meta,
                    duration: v?.duration,
                    videoWidth: v?.videoWidth,
                    videoHeight: v?.videoHeight,
                    readyState: v?.readyState,
                });
            });

            art.on('video:canplay', () => dbg('artplayer:video:canplay', meta));
            art.on('video:playing', () => log('artplayer:video:playing', meta));
            art.on('video:waiting', () => warn('artplayer:video:waiting', meta));
            art.on('video:stalled', () => warn('artplayer:video:stalled', meta));
            art.on('video:ended', () => log('artplayer:video:ended', meta));
            art.on('video:error', (e: any) => err('artplayer:video:error', { ...meta, error: e }));
        }

        async function mountArtplayer(url: string) {
            log('artplayer:mount-start', { url, urlInspect: inspectUrl(url) });

            await loadArtplayerAssets();
            const container = artContainer.value;
            if (!container) {
                warn('artplayer:mount-skipped-no-container');
                return;
            }
            destroyArt();

            const ArtplayerCtor = (window as any).Artplayer;
            const HlsCtor = (window as any).Hls;
            const isM3u8 = url.includes('.m3u8') || url.includes('m3u8') || url.includes('.m3u');

            log('artplayer:mount-config', {
                type: isM3u8 ? 'm3u8' : 'mp4',
                hlsJsAvailable: Boolean(HlsCtor),
                hlsJsSupported: HlsCtor?.isSupported?.() ?? false,
            });

            const config: Record<string, any> = {
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
            };

            if (isM3u8 && HlsCtor) {
                config.customType = {
                    m3u8(video: HTMLVideoElement, src: string) {
                        log('hls.js:customType-invoked', { src });
                        if (HlsCtor.isSupported()) {
                            hlsInstance = new HlsCtor({
                                enableWorker: true,
                                debug: true,
                                maxBufferLength: 30,
                                maxMaxBufferLength: 60,
                            });

                            hlsInstance.on(HlsCtor.Events.MANIFEST_PARSED, (_event: any, data: any) => {
                                log('hls.js:manifest-parsed', {
                                    levels: data.levels?.length,
                                    levels_detail: data.levels?.map((l: any) => ({
                                        height: l.height,
                                        width: l.width,
                                        bitrate: l.bitrate,
                                        codec: l.codec,
                                    })),
                                    audioTracks: data.audioTracks?.length,
                                });
                            });

                            hlsInstance.on(HlsCtor.Events.LEVEL_SWITCHED, (_event: any, data: any) => {
                                dbg('hls.js:level-switched', { level: data.level });
                            });

                            hlsInstance.on(HlsCtor.Events.ERROR, (_event: any, data: any) => {
                                if (data.fatal) {
                                    err('hls.js:fatal-error', {
                                        type: data.type,
                                        details: data.details,
                                        reason: data.reason,
                                    });
                                } else {
                                    dbg('hls.js:recoverable-error', {
                                        type: data.type,
                                        details: data.details,
                                    });
                                }
                            });

                            hlsInstance.on(HlsCtor.Events.FRAG_LOADED, (_event: any, data: any) => {
                                dbg('hls.js:frag-loaded', {
                                    frag: data.frag?.url,
                                    size: data.frag?.size,
                                    duration: data.frag?.duration,
                                });
                            });

                            hlsInstance.on(HlsCtor.Events.BUFFER_APPENDED, (_event: any, data: any) => {
                                dbg('hls.js:buffer-appended', {
                                    pending: data?.pending,
                                    time: data?.time,
                                });
                            });

                            hlsInstance.loadSource(src);
                            hlsInstance.attachMedia(video);

                            log('hls.js:attached', { src });
                        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                            warn('hls.js:not-supported-using-native-hls');
                            video.src = src;
                        } else {
                            err('hls.js:not-supported-and-no-native-hls');
                        }
                    },
                };
            }

            artInstance = new ArtplayerCtor(config);
            log('artplayer:mounted', {
                url,
                constructorVersion: ArtplayerCtor.version,
            });
            setupArtplayerEvents(artInstance, url);
        }

        const setActive = (provider: string, index: number) => {
            const url = result.value?.[provider]?.[index];
            if (url) {
                log('stream:set-active', { provider, index, url, urlInspect: inspectUrl(url) });
                activeStreamUrl.value = url;
                mountArtplayer(url);
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

            const params: Record<string, string> = { title: q };
            if (season.value > 0) params.season = String(season.value);
            if (episode.value > 0) params.episode = String(episode.value);
            if (fast.value) params.fast = '1';

            const qs = new URLSearchParams(params).toString();
            const url = `${API_BASE}/api/scrape?${qs}`;

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

                const rawData = await resp.json();
                log('scrape:response-parsed', {
                    elapsed,
                    providerCount: Object.keys(rawData).length,
                    totalStreams: Object.values(rawData).reduce((acc: number, v: any) => acc + (Array.isArray(v) ? v.length : 0), 0),
                    providers: Object.entries(rawData).map(([name, urls]) => ({
                        name,
                        count: (urls as any[]).length,
                    })),
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

                // Auto-play first stream
                const allProviders = Object.keys(rawData);
                if (allProviders.length > 0) {
                    const firstProv = allProviders[0];
                    const firstUrls = rawData[firstProv];
                    if (firstUrls?.length > 0) {
                        log('scrape:auto-play', { provider: firstProv, index: 0, url: firstUrls[0] });
                        setActive(firstProv, 0);
                    }
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
            toggleProvider, selectAllProviders, selectFastProviders, copyAll,
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

// ── Provider selector ──────────────────────────────────────────
.provider-selector {
    background: var(--ink-850);
    box-shadow: inset 0 0 0 1px var(--rule);
    border-radius: var(--r-lg);
    overflow: hidden;

    &__chev {
        margin-left: var(--s-2);
        font-size: 10px;
        color: var(--bone-400);
    }

    &__actions {
        display: flex;
        gap: var(--s-1);
        margin-top: var(--s-2);
    }

    &__action {
        all: unset;
        cursor: pointer;
        padding: 0.2rem 0.6rem;
        border-radius: var(--r-pill);
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid var(--rule);
        color: var(--bone-300);
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        transition: background-color var(--dur-fast), border-color var(--dur-fast);

        &:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: var(--bone-400);
        }
    }

    &__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: var(--s-1);
    }
}

.provider-card {
    all: unset;
    display: flex;
    align-items: center;
    gap: var(--s-2);
    padding: var(--s-2) var(--s-2);
    border-radius: var(--r-md);
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--rule);
    cursor: pointer;
    transition: all var(--dur-fast);

    &:hover {
        background: rgba(255, 255, 255, 0.06);
        border-color: var(--bone-400);
    }

    &.is-selected {
        border-color: var(--ember);
        background: rgba(255, 90, 31, 0.06);
    }

    &.has-result {
        border-color: rgba(78, 255, 120, 0.3);
        &.is-selected { border-color: #4eff78; }
    }

    &.has-error {
        opacity: 0.5;
    }

    &.is-fast {
        .provider-card__hint { color: var(--ember); }
    }

    &__check {
        width: 18px;
        height: 18px;
        border-radius: 4px;
        border: 1px solid var(--rule-strong);
        display: grid;
        place-items: center;
        font-size: 11px;
        font-weight: 700;
        flex-shrink: 0;
        color: var(--ember);
        transition: all var(--dur-fast);
    }

    &.is-selected &__check {
        border-color: var(--ember);
        background: rgba(255, 90, 31, 0.15);
    }

    &__body {
        display: grid;
        gap: 1px;
        min-width: 0;
        flex: 1;
    }

    &__name {
        font-family: var(--font-ui);
        font-weight: 600;
        font-size: var(--fs-sm);
        color: var(--bone-50);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__hint {
        font-size: 10px;
        color: var(--bone-400);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    &__badge {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-size: 11px;
        font-weight: 700;
        flex-shrink: 0;
        color: rgba(255, 255, 255, 0.15);

        &.is-live {
            color: #4eff78;
            background: rgba(78, 255, 120, 0.1);
        }
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
