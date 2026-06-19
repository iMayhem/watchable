<template>
    <div class="nm-test">
        <header class="nm-test__header">
            <p class="nm-test__badge">Internal · Hidden</p>
            <h1>NetMirror Lab</h1>
            <p class="nm-test__sub">
                Test stream resolution through moovie proxy. Not linked anywhere on the site.
            </p>
            <p class="nm-test__ext" :class="{ 'is-active': extensionActive }">
                Extension: {{ extensionActive ? 'active · direct CDN' : 'not detected · using /api/proxy' }}
            </p>
        </header>

        <section class="nm-test__panel">
            <div class="nm-test__row">
                <label>
                    <span>NetMirror ID</span>
                    <input v-model="mediaId" type="text" placeholder="111489" @change="onFieldChange('mediaId', mediaId)" />
                </label>
                <label>
                    <span>Type</span>
                    <select v-model="mediaType" @change="onFieldChange('mediaType', mediaType)">
                        <option value="movie">movie</option>
                        <option value="tv">tv</option>
                    </select>
                </label>
                <label>
                    <span>Season</span>
                    <input v-model.number="season" type="number" min="0" @change="onFieldChange('season', season)" />
                </label>
                <label>
                    <span>Episode</span>
                    <input v-model.number="episode" type="number" min="0" @change="onFieldChange('episode', episode)" />
                </label>
                <label>
                    <span>Server mirror</span>
                    <select v-model.number="server" @change="onFieldChange('server', server)">
                        <option :value="1">1 · spedostream2</option>
                        <option :value="2">2 · watch22</option>
                        <option :value="3">3 · watch21</option>
                        <option :value="5">5 · test.watch22</option>
                    </select>
                </label>
            </div>

            <div class="nm-test__row">
                <label class="nm-test__search">
                    <span>Search NetMirror</span>
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Disclosure Day"
                        @keydown.enter="onSearchEnter"
                    />
                </label>
                <button type="button" class="nm-test__btn nm-test__btn--ghost" :disabled="loading" @click="runSearch">
                    Search
                </button>
                <button type="button" class="nm-test__btn" :disabled="loading" @click="resolve">
                    {{ loading ? 'Resolving…' : 'Resolve & Play' }}
                </button>
            </div>

            <div v-if="searchResults.length" class="nm-test__search-results">
                <button
                    v-for="item in searchResults"
                    :key="item.id"
                    type="button"
                    class="nm-test__chip"
                    @click="applySearchResult(item)"
                >
                    {{ item.title?.trim() }} · {{ item.media_type }} · #{{ item.id }}
                </button>
            </div>

            <p v-if="error" class="nm-test__error" role="alert">{{ error }}</p>
        </section>

        <section v-if="resolved" class="nm-test__panel">
            <div class="nm-test__meta">
                <h2>{{ resolved.meta.title }}</h2>
                <p>
                    subjectid {{ resolved.meta.subjectid }} ·
                    {{ streams.length }} stream{{ streams.length === 1 ? '' : 's' }} found
                </p>
            </div>

            <div class="nm-test__mode">
                <button
                    type="button"
                    class="nm-test__mode-btn"
                    :class="{ 'is-active': playerMode === 'direct' }"
                    :disabled="!activeStream"
                    @click="setPlayerMode('direct')"
                >
                    {{ extensionActive ? 'ArtPlayer · direct CDN' : 'ArtPlayer · proxy' }}
                </button>
                <button
                    type="button"
                    class="nm-test__mode-btn"
                    :class="{ 'is-active': playerMode === 'iframe' }"
                    @click="setPlayerMode('iframe')"
                >
                    NetMirror iframe
                </button>
            </div>

            <div class="nm-test__player">
                <div
                    v-if="playerMode === 'direct'"
                    ref="artContainer"
                    class="nm-artplayer"
                />
                <iframe
                    v-if="playerMode === 'iframe' && playerProxyUrl"
                    :key="playerProxyUrl"
                    :src="playerProxyUrl"
                    title="NetMirror player"
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                    frameborder="0"
                />
                <div
                    v-if="playerMode === 'direct' && !artReady"
                    class="nm-test__player-empty"
                >
                    {{ loading ? 'Resolving…' : 'Click Resolve & Play' }}
                </div>
            </div>

            <p v-if="playbackError" class="nm-test__error" role="alert">{{ playbackError }}</p>
            <p v-if="activeStream && playerMode === 'direct'" class="nm-test__stream-url">
                {{ activeStream.quality }} ·
                {{ extensionActive ? 'direct CDN + ArtPlayer (NetMirror path)' : 'proxied via /api/proxy' }}
            </p>

            <div v-if="streams.length" class="nm-test__qualities">
                <button
                    v-for="(stream, index) in streams"
                    :key="stream.url"
                    type="button"
                    class="nm-test__quality"
                    :class="{ 'is-active': selectedStreamIndex === index }"
                    @click="selectStream(index)"
                >
                    {{ stream.quality }}
                </button>
            </div>
        </section>

        <section v-if="resolved" class="nm-test__panel nm-test__debug">
            <button type="button" class="nm-test__debug-toggle" @click="toggleDebug">
                {{ showDebug ? 'Hide' : 'Show' }} debug JSON
            </button>
            <pre v-if="showDebug">{{ debugJson }}</pre>
        </section>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, onUnmounted, ref, watch } from 'vue';
import { useSeo } from '../composables/useSeo';

const LOG_PREFIX = '[NetMirror Test]';

interface NetmirrorStream {
    quality: string;
    url: string;
    proxiedUrl: string;
}

interface NetmirrorResolve {
    meta: {
        id: string;
        title: string;
        subjectid: string;
        media_type: string;
        season: unknown;
        trailer: string | null;
        backdrop_path: string | null;
    };
    auth: { timestamp: number; signature: string };
    watchboxUrl: string;
    playerProxyUrl: string;
    streams: NetmirrorStream[];
    defaultStream: NetmirrorStream | null;
}

interface SearchResult {
    id: string;
    title: string;
    media_type: string;
}

export default defineComponent({
    name: 'TestNetmirror',
    setup() {
        const { updateSeo } = useSeo();

        const debug = (action: string, detail?: unknown) => {
            // console.warn survives production terser (log/info/debug are stripped)
            if (detail !== undefined) {
                console.warn(`${LOG_PREFIX} ${action}`, detail);
            } else {
                console.warn(`${LOG_PREFIX} ${action}`);
            }
        };

        const debugWarn = (action: string, detail?: unknown) => {
            if (detail !== undefined) {
                console.warn(`${LOG_PREFIX} ${action}`, detail);
            } else {
                console.warn(`${LOG_PREFIX} ${action}`);
            }
        };

        const debugError = (action: string, detail?: unknown) => {
            if (detail !== undefined) {
                console.error(`${LOG_PREFIX} ${action}`, detail);
            } else {
                console.error(`${LOG_PREFIX} ${action}`);
            }
        };

        const mediaId = ref('111489');
        const mediaType = ref<'movie' | 'tv'>('movie');
        const season = ref(0);
        const episode = ref(0);
        const server = ref(1);
        const searchQuery = ref('');

        const loading = ref(false);
        const error = ref('');
        const resolved = ref<NetmirrorResolve | null>(null);
        const searchResults = ref<SearchResult[]>([]);

        const playerMode = ref<'iframe' | 'direct'>('direct');
        const selectedStreamIndex = ref(0);
        const showDebug = ref(false);
        const playbackError = ref('');
        const extensionActive = ref(false);
        const artReady = ref(false);
        const artContainer = ref<HTMLElement | null>(null);
        let prepareToken = 0;
        let artInstance: any = null;
        let refreshInFlight: Promise<NetmirrorResolve | null> | null = null;

        const streamUrlAgeSec = (rawUrl: string) => {
            try {
                const t = Number(new URL(rawUrl).searchParams.get('t') || '0');
                if (!t) return null;
                return Math.max(0, Math.floor(Date.now() / 1000 - t));
            } catch {
                return null;
            }
        };

        const toAbsoluteUrl = (path: string) => {
            if (!path) return '';
            if (/^https?:\/\//i.test(path)) return path;
            return `${window.location.origin}${path}`;
        };

        const checkExtension = () => {
            const ext = (window as any).__MOOVIE_STREAM_EXT__;
            const active = Boolean(ext?.active);
            if (active !== extensionActive.value) {
                extensionActive.value = active;
                debug('extension:status', { active, version: ext?.version, mode: ext?.mode });
            }
            return active;
        };

        const probeDirectStream = async (rawUrl: string) => {
            debug('cdn:probe-start', { url: rawUrl });
            const startedAt = performance.now();
            const resp = await fetch(rawUrl, {
                method: 'GET',
                headers: { Range: 'bytes=0-65535' },
            });
            const result = {
                elapsedMs: Math.round(performance.now() - startedAt),
                status: resp.status,
                ok: resp.ok,
                contentRange: resp.headers.get('content-range'),
            };
            if (resp.ok || resp.status === 206) {
                debug('cdn:probe-ok', result);
                return rawUrl;
            }
            debugError('cdn:probe-failed', result);
            const err = new Error(`Direct CDN probe failed (${resp.status})`) as Error & { status?: number };
            err.status = resp.status;
            throw err;
        };

        const probeProxiedStream = async (proxiedUrl: string) => {
            const abs = toAbsoluteUrl(proxiedUrl);
            debug('proxy:probe-start', { url: abs });
            const startedAt = performance.now();

            const resp = await fetch(abs, {
                method: 'GET',
                headers: { Range: 'bytes=0-65535' },
            });

            const result = {
                elapsedMs: Math.round(performance.now() - startedAt),
                status: resp.status,
                ok: resp.ok,
                contentType: resp.headers.get('content-type'),
                contentRange: resp.headers.get('content-range'),
                acceptRanges: resp.headers.get('accept-ranges'),
            };

            if (resp.ok || resp.status === 206) {
                debug('proxy:probe-ok', result);
                return abs;
            }

            debugError('proxy:probe-failed', result);
            const err = new Error(`Proxy probe failed (${resp.status})`) as Error & { status?: number };
            err.status = resp.status;
            throw err;
        };

        const withPlaybackCacheBuster = (absUrl: string) => {
            const sep = absUrl.includes('?') ? '&' : '?';
            return `${absUrl}${sep}_cb=${Date.now()}`;
        };

        const loadArtplayerAssets = (() => {
            let promise: Promise<void> | null = null;
            return () => {
                if ((window as any).Artplayer) return Promise.resolve();
                if (promise) return promise;
                promise = new Promise((resolve, reject) => {
                    if (!document.querySelector('link[data-nm-art-css]')) {
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = 'https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.css';
                        link.setAttribute('data-nm-art-css', '1');
                        document.head.appendChild(link);
                    }
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.min.js';
                    script.onload = () => resolve();
                    script.onerror = () => reject(new Error('ArtPlayer script failed to load'));
                    document.head.appendChild(script);
                });
                return promise;
            };
        })();

        const destroyArt = () => {
            if (artInstance) {
                try {
                    artInstance.destroy(false);
                } catch {
                    /* ignore */
                }
                artInstance = null;
            }
            artReady.value = false;
        };

        const resolvePlaybackUrl = (stream: NetmirrorStream) => {
            if (extensionActive.value) {
                return withPlaybackCacheBuster(stream.url);
            }
            return withPlaybackCacheBuster(toAbsoluteUrl(stream.proxiedUrl));
        };

        const mountArtplayer = async (stream: NetmirrorStream) => {
            await loadArtplayerAssets();
            const container = artContainer.value;
            if (!container) {
                throw new Error('ArtPlayer container missing');
            }

            destroyArt();
            const playUrl = resolvePlaybackUrl(stream);
            debug('art:mount', {
                quality: stream.quality,
                direct: extensionActive.value,
                url: playUrl,
            });

            const ArtplayerCtor = (window as any).Artplayer;
            artInstance = new ArtplayerCtor({
                container,
                url: playUrl,
                type: 'mp4',
                autoplay: true,
                preload: 'auto',
                playbackRate: true,
                aspectRatio: true,
                fullscreen: true,
                fullscreenWeb: true,
                miniProgressBar: true,
                fastForward: true,
                setting: true,
                theme: '#4eb5ff',
            });

            artInstance.on('video:loadedmetadata', () => {
                playbackError.value = '';
                debug('art:loadedmetadata', {
                    quality: stream.quality,
                    duration: artInstance?.video?.duration,
                });
            });
            artInstance.on('video:canplay', () => debug('art:canplay', { quality: stream.quality }));
            artInstance.on('video:playing', () => debug('art:playing', { quality: stream.quality }));
            artInstance.on('video:waiting', () => debug('art:waiting', { quality: stream.quality }));
            artInstance.on('video:stalled', () => debugWarn('art:stalled', { quality: stream.quality }));
            artInstance.on('error', () => {
                playbackError.value = 'ArtPlayer failed — try Resolve again or toggle quality.';
                debugError('art:error', { quality: stream.quality, url: playUrl });
            });

            artReady.value = true;
        };

        const switchArtQuality = async (stream: NetmirrorStream) => {
            const playUrl = resolvePlaybackUrl(stream);
            if (!artInstance) {
                await mountArtplayer(stream);
                return;
            }
            debug('art:switch', { quality: stream.quality, url: playUrl });
            await artInstance.switchUrl(playUrl);
        };

        const fetchResolveData = async () => {
            const resp = await fetch(buildApiUrl('resolve'));
            const data = await parseApiResponse(resp, 'resolve');
            if (!resp.ok) {
                throw new Error(data.error || `Request failed (${resp.status})`);
            }
            return data as NetmirrorResolve;
        };

        const refreshResolve = async (reason: string) => {
            if (refreshInFlight) {
                debug('resolve:refresh-wait', { reason });
                return refreshInFlight;
            }

            debug('resolve:refresh-start', { reason });
            refreshInFlight = (async () => {
                try {
                    const data = await fetchResolveData();
                    resolved.value = data;
                    debug('resolve:refresh-ok', {
                        reason,
                        streamCount: data.streams?.length || 0,
                        ages: (data.streams || []).map((s) => ({
                            quality: s.quality,
                            ageSec: streamUrlAgeSec(s.url),
                        })),
                    });
                    return data;
                } catch (err: any) {
                    debugError('resolve:refresh-failed', { reason, message: err?.message });
                    return null;
                } finally {
                    refreshInFlight = null;
                }
            })();

            return refreshInFlight;
        };

        const prepareArtPlayback = async (
            stream: NetmirrorStream | null,
            options: { allowRefresh?: boolean } = {}
        ): Promise<void> => {
            const { allowRefresh = true } = options;
            const token = ++prepareToken;
            destroyArt();

            if (!stream || playerMode.value !== 'direct') {
                debug('art:prepare-skipped', {
                    hasStream: Boolean(stream),
                    playerMode: playerMode.value,
                });
                return;
            }

            const ageSec = streamUrlAgeSec(stream.url);
            debug('art:prepare-start', {
                quality: stream.quality,
                direct: extensionActive.value,
                urlAgeSec: ageSec,
            });

            if (ageSec !== null && ageSec > 120 && allowRefresh) {
                debugWarn('art:prepare-stale-url', { urlAgeSec: ageSec });
                const fresh = await refreshResolve('signed-url-age');
                if (token !== prepareToken) return;
                if (fresh?.streams?.length) {
                    const idx = Math.min(selectedStreamIndex.value, fresh.streams.length - 1);
                    selectedStreamIndex.value = idx;
                    return prepareArtPlayback(fresh.streams[idx], { allowRefresh: false });
                }
            }

            try {
                if (extensionActive.value) {
                    await probeDirectStream(stream.url);
                } else {
                    await probeProxiedStream(stream.proxiedUrl);
                }
                if (token !== prepareToken) return;
                await mountArtplayer(stream);
                playbackError.value = '';
            } catch (err: any) {
                if (token !== prepareToken) return;

                if (allowRefresh && err?.status === 403) {
                    debugWarn('art:prepare-403-refresh', { quality: stream.quality });
                    const fresh = await refreshResolve('playback-403');
                    if (token !== prepareToken) return;
                    if (fresh?.streams?.length) {
                        const idx = Math.min(selectedStreamIndex.value, fresh.streams.length - 1);
                        selectedStreamIndex.value = idx;
                        return prepareArtPlayback(fresh.streams[idx], { allowRefresh: false });
                    }
                }

                playbackError.value =
                    err?.message ||
                    'Playback failed. Install/reload extension for direct CDN, or Resolve again.';
                debugError('art:prepare-failed', {
                    quality: stream.quality,
                    message: playbackError.value,
                    urlAgeSec: ageSec,
                });
            }
        };

        const qualityRank: Record<string, number> = {
            '360P': 0,
            '480P': 1,
            '720P': 2,
            '1080P': 3,
            unknown: 4,
        };

        const pickDefaultStreamIndex = (streamList: NetmirrorStream[]) => {
            if (!streamList.length) return 0;
            let bestIndex = 0;
            let bestRank = qualityRank[streamList[0].quality] ?? 99;
            for (let i = 1; i < streamList.length; i++) {
                const rank = qualityRank[streamList[i].quality] ?? 99;
                if (rank < bestRank) {
                    bestRank = rank;
                    bestIndex = i;
                }
            }
            return bestIndex;
        };

        const streams = computed(() => resolved.value?.streams || []);
        const activeStream = computed(() => streams.value[selectedStreamIndex.value] || null);
        const playerProxyUrl = computed(() => {
            const base = resolved.value?.playerProxyUrl || '';
            if (!base) return '';
            const url = new URL(base, window.location.origin);
            if (extensionActive.value) {
                url.searchParams.set('exten', 'true');
            } else {
                url.searchParams.set('proxy', '1');
            }
            return `${url.pathname}${url.search}`;
        });
        const debugJson = computed(() => JSON.stringify(resolved.value, null, 2));

        const buildApiUrl = (action = 'resolve') => {
            const params = new URLSearchParams({
                action,
                type: mediaType.value,
                id: mediaId.value,
                se: String(season.value),
                ep: String(episode.value),
                server: String(server.value),
            });
            return `/api/netmirror?${params.toString()}`;
        };

        const parseApiResponse = async (resp: Response, context: string) => {
            const contentType = resp.headers.get('content-type') || '';
            debug(`${context}:response`, {
                status: resp.status,
                ok: resp.ok,
                contentType,
            });

            const text = await resp.text();
            const looksLikeHtml =
                text.trimStart().startsWith('<') || /<!doctype/i.test(text.slice(0, 200));

            if (!contentType.includes('application/json') && looksLikeHtml) {
                debugError(`${context}:html-fallback`, { preview: text.slice(0, 120) });
                throw new Error(
                    'API returned HTML instead of JSON. Deploy /api/netmirror to Cloudflare Pages, or run npm run dev locally (functions middleware is enabled).'
                );
            }

            try {
                const data = JSON.parse(text);
                debug(`${context}:parsed`, {
                    keys: data && typeof data === 'object' ? Object.keys(data) : [],
                });
                return data;
            } catch (parseErr) {
                debugError(`${context}:parse-failed`, { preview: text.slice(0, 160) });
                throw new Error(`Invalid API response (${resp.status}): ${text.slice(0, 160)}`);
            }
        };

        const onFieldChange = (field: string, value: unknown) => {
            debug(`field:${field}`, { value });
        };

        const onSearchEnter = () => {
            debug('search:enter-key');
            runSearch();
        };

        const toggleDebug = () => {
            showDebug.value = !showDebug.value;
            debug('debug:toggle', { visible: showDebug.value });
        };

        const resolve = async () => {
            const url = buildApiUrl('resolve');
            debug('resolve:start', {
                url,
                mediaId: mediaId.value,
                mediaType: mediaType.value,
                season: season.value,
                episode: episode.value,
                server: server.value,
            });

            loading.value = true;
            error.value = '';
            const startedAt = performance.now();

            try {
                const data = await fetchResolveData();

                resolved.value = data;
                playbackError.value = '';

                const streamIndex = data.streams?.length
                    ? pickDefaultStreamIndex(data.streams)
                    : 0;

                if (data.streams?.length) {
                    selectedStreamIndex.value = streamIndex;
                    playerMode.value = 'direct';
                    await prepareArtPlayback(data.streams[streamIndex]);
                } else {
                    playerMode.value = 'iframe';
                    destroyArt();
                }

                debug('resolve:success', {
                    elapsedMs: Math.round(performance.now() - startedAt),
                    title: data.meta?.title,
                    subjectid: data.meta?.subjectid,
                    streamCount: data.streams?.length || 0,
                    qualities: (data.streams || []).map((s: NetmirrorStream) => s.quality),
                    defaultQuality: data.streams?.[streamIndex]?.quality || null,
                    playerMode: playerMode.value,
                    watchboxUrl: data.watchboxUrl,
                    defaultProxiedUrl: data.streams?.[streamIndex]?.proxiedUrl || null,
                });
            } catch (err: any) {
                error.value = err?.message || 'Failed to resolve stream';
                resolved.value = null;
                debugError('resolve:failed', {
                    elapsedMs: Math.round(performance.now() - startedAt),
                    message: error.value,
                });
            } finally {
                loading.value = false;
                debug('resolve:done', { loading: loading.value });
            }
        };

        const runSearch = async () => {
            const query = searchQuery.value.trim();
            if (!query) {
                debugWarn('search:skipped', { reason: 'empty query' });
                return;
            }

            const url = `/api/netmirror?${new URLSearchParams({ action: 'search', q: query }).toString()}`;
            debug('search:start', { query, url });

            loading.value = true;
            error.value = '';
            const startedAt = performance.now();

            try {
                const resp = await fetch(url);
                const data = await parseApiResponse(resp, 'search');
                if (!resp.ok) {
                    throw new Error(data.error || `Search failed (${resp.status})`);
                }
                searchResults.value = data.results || [];
                debug('search:success', {
                    elapsedMs: Math.round(performance.now() - startedAt),
                    resultCount: searchResults.value.length,
                    results: searchResults.value.map((r) => ({
                        id: r.id,
                        title: r.title?.trim(),
                        media_type: r.media_type,
                    })),
                });
            } catch (err: any) {
                error.value = err?.message || 'Search failed';
                searchResults.value = [];
                debugError('search:failed', {
                    elapsedMs: Math.round(performance.now() - startedAt),
                    message: error.value,
                });
            } finally {
                loading.value = false;
                debug('search:done', { loading: loading.value });
            }
        };

        const applySearchResult = (item: SearchResult) => {
            debug('search:apply-result', {
                id: item.id,
                title: item.title?.trim(),
                media_type: item.media_type,
            });
            mediaId.value = item.id;
            mediaType.value = item.media_type === 'tv' ? 'tv' : 'movie';
            season.value = 0;
            episode.value = 0;
            resolve();
        };

        const selectStream = (index: number) => {
            const stream = streams.value[index];
            debug('stream:select', {
                index,
                quality: stream?.quality,
                rawUrl: stream?.url,
                proxiedUrl: stream?.proxiedUrl,
            });
            selectedStreamIndex.value = index;
            playerMode.value = 'direct';
            playbackError.value = '';
            if (artInstance && stream) {
                switchArtQuality(stream);
            } else {
                prepareArtPlayback(stream || null);
            }
        };

        const setPlayerMode = (mode: 'iframe' | 'direct') => {
            debug('player:mode-change', {
                from: playerMode.value,
                to: mode,
                activeStream: activeStream.value?.quality || null,
            });
            playerMode.value = mode;
            if (mode === 'direct') {
                prepareArtPlayback(activeStream.value);
            } else {
                prepareToken++;
                destroyArt();
            }
        };

        watch(activeStream, (stream, prev) => {
            if (!stream && !prev) return;
            debug('stream:active-changed', {
                from: prev?.quality || null,
                to: stream?.quality || null,
                proxiedUrl: stream?.proxiedUrl || null,
            });
        });

        watch(playerProxyUrl, (url) => {
            if (!url) return;
            debug('player:iframe-url', { url });
        });

        const onExtensionReady = () => checkExtension();

        const onExtensionPong = (event: MessageEvent) => {
            if (event.source !== window || event.data?.type !== 'MOOVIE_EXT_PONG') return;
            extensionActive.value = true;
            debug('extension:pong', event.data.detail);
        };

        onMounted(() => {
            checkExtension();
            window.addEventListener('moovie-stream-ext-ready', onExtensionReady);
            window.addEventListener('message', onExtensionPong);
            window.postMessage({ type: 'MOOVIE_EXT_PING' }, '*');

            debug('page:mounted', {
                preset: {
                    mediaId: mediaId.value,
                    mediaType: mediaType.value,
                    season: season.value,
                    episode: episode.value,
                    server: server.value,
                    playerMode: playerMode.value,
                },
                extensionActive: extensionActive.value,
            });
            updateSeo({
                title: 'Test',
                canonical: 'https://moovie.fun/test',
                image: 'https://moovie.fun/og-image.png',
            });

            let robotsMeta = document.querySelector('meta[name="robots"]');
            if (!robotsMeta) {
                robotsMeta = document.createElement('meta');
                robotsMeta.setAttribute('name', 'robots');
                document.head.appendChild(robotsMeta);
            }
            robotsMeta.setAttribute('content', 'noindex, nofollow');
        });

        onUnmounted(() => {
            window.removeEventListener('moovie-stream-ext-ready', onExtensionReady);
            window.removeEventListener('message', onExtensionPong);
            destroyArt();
        });

        watch(extensionActive, (active) => {
            if (active && activeStream.value && playerMode.value === 'direct') {
                prepareArtPlayback(activeStream.value, { allowRefresh: false });
            }
        });

        return {
            mediaId,
            mediaType,
            season,
            episode,
            server,
            searchQuery,
            loading,
            error,
            resolved,
            searchResults,
            playerMode,
            selectedStreamIndex,
            showDebug,
            playbackError,
            extensionActive,
            artReady,
            artContainer,
            streams,
            activeStream,
            playerProxyUrl,
            debugJson,
            onFieldChange,
            onSearchEnter,
            setPlayerMode,
            toggleDebug,
            resolve,
            runSearch,
            applySearchResult,
            selectStream,
        };
    },
});
</script>

<style scoped lang="scss">
.nm-test {
    min-height: 100vh;
    padding: 2rem 1.25rem 3rem;
    background:
        radial-gradient(circle at top, rgba(78, 181, 255, 0.12), transparent 40%),
        #070b12;
    color: #f4f7fb;
}

.nm-test__header {
    max-width: 1100px;
    margin: 0 auto 1.5rem;
}

.nm-test__badge {
    display: inline-block;
    margin: 0 0 0.5rem;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    background: rgba(255, 193, 7, 0.15);
    color: #ffd76a;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.nm-test__header h1 {
    margin: 0;
    font-size: clamp(1.8rem, 4vw, 2.6rem);
}

.nm-test__sub {
    margin: 0.5rem 0 0;
    color: rgba(244, 247, 251, 0.65);
    max-width: 52ch;
}

.nm-test__ext {
    margin: 0.65rem 0 0;
    font-size: 0.78rem;
    color: rgba(255, 143, 143, 0.85);

    &.is-active {
        color: #7dffb0;
    }
}

.nm-test__panel {
    max-width: 1100px;
    margin: 0 auto 1rem;
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    background: rgba(10, 16, 28, 0.82);
    backdrop-filter: blur(10px);
}

.nm-test__row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem;
    align-items: end;
}

.nm-test__row + .nm-test__row {
    margin-top: 0.75rem;
}

label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.78rem;
    color: rgba(244, 247, 251, 0.7);
}

input,
select {
    width: 100%;
    padding: 0.65rem 0.75rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(0, 0, 0, 0.35);
    color: #fff;
}

.nm-test__search {
    grid-column: span 2;
}

.nm-test__btn {
    padding: 0.7rem 1rem;
    border: 0;
    border-radius: 10px;
    background: linear-gradient(135deg, #4eb5ff, #2d79ff);
    color: #fff;
    font-weight: 600;
    cursor: pointer;

    &:disabled {
        opacity: 0.55;
        cursor: not-allowed;
    }
}

.nm-test__btn--ghost {
    background: rgba(255, 255, 255, 0.08);
}

.nm-test__search-results {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
}

.nm-test__chip {
    border: 1px solid rgba(78, 181, 255, 0.35);
    background: rgba(78, 181, 255, 0.08);
    color: #d8ecff;
    border-radius: 999px;
    padding: 0.35rem 0.7rem;
    cursor: pointer;
    font-size: 0.82rem;
}

.nm-test__error {
    margin: 0.75rem 0 0;
    color: #ff8f8f;
}

.nm-test__meta h2 {
    margin: 0 0 0.35rem;
    font-size: 1.35rem;
}

.nm-test__meta p {
    margin: 0;
    color: rgba(244, 247, 251, 0.6);
    font-size: 0.9rem;
}

.nm-test__stream-url {
    margin: 0.5rem 0 0;
    color: rgba(244, 247, 251, 0.45);
    font-size: 0.78rem;
}

.nm-test__mode {
    display: flex;
    gap: 0.5rem;
    margin: 1rem 0 0.75rem;
}

.nm-test__mode-btn {
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: transparent;
    color: rgba(244, 247, 251, 0.75);
    border-radius: 999px;
    padding: 0.45rem 0.9rem;
    cursor: pointer;

    &.is-active {
        border-color: rgba(78, 181, 255, 0.7);
        background: rgba(78, 181, 255, 0.15);
        color: #fff;
    }

    &:disabled {
        opacity: 0.45;
        cursor: not-allowed;
    }
}

.nm-test__player {
    aspect-ratio: 16 / 9;
    border-radius: 14px;
    overflow: hidden;
    background: #000;
    border: 1px solid rgba(255, 255, 255, 0.08);

    iframe,
    .nm-artplayer {
        width: 100%;
        height: 100%;
        display: block;
        border: 0;
    }
}

.nm-artplayer :deep(.art-video-player) {
    width: 100%;
    height: 100%;
}

.nm-test__player-empty {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    color: rgba(244, 247, 251, 0.45);
}

.nm-test__qualities {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
}

.nm-test__quality {
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: #fff;
    border-radius: 8px;
    padding: 0.4rem 0.75rem;
    cursor: pointer;

    &.is-active {
        border-color: #4eb5ff;
        background: rgba(78, 181, 255, 0.18);
    }
}

.nm-test__debug-toggle {
    border: 0;
    background: transparent;
    color: #9ecfff;
    cursor: pointer;
    padding: 0;
    font-size: 0.9rem;
}

.nm-test__debug pre {
    margin: 0.75rem 0 0;
    padding: 0.85rem;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.45);
    overflow: auto;
    font-size: 0.75rem;
    line-height: 1.45;
    max-height: 320px;
}
</style>