import { onBeforeUnmount, onMounted, ref } from 'vue';

export interface NetmirrorStream {
    quality: string;
    url: string;
    proxiedUrl: string;
}

export interface NetmirrorResolve {
    meta: {
        id: string;
        title: string;
        subjectid: string;
        media_type: string;
        backdrop_path: string | null;
    };
    streams: NetmirrorStream[];
    playerProxyUrl: string;
}

const qualityRank: Record<string, number> = {
    '360P': 0,
    '480P': 1,
    '720P': 2,
    '1080P': 3,
    unknown: 4
};

function streamUrlAgeSec(rawUrl: string) {
    try {
        const t = Number(new URL(rawUrl).searchParams.get('t') || '0');
        if (!t) return null;
        return Math.max(0, Math.floor(Date.now() / 1000 - t));
    } catch {
        return null;
    }
}

function toAbsoluteUrl(path: string) {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    return `${window.location.origin}${path}`;
}

function withPlaybackCacheBuster(absUrl: string) {
    const sep = absUrl.includes('?') ? '&' : '?';
    return `${absUrl}${sep}_cb=${Date.now()}`;
}

async function parseApiResponse(resp: Response) {
    const text = await resp.text();
    const looksLikeHtml =
        text.trimStart().startsWith('<') || /<!doctype/i.test(text.slice(0, 200));
    if (looksLikeHtml) {
        throw new Error(
            'API returned HTML instead of JSON. Deploy /api/netmirror or run npm run dev locally.'
        );
    }
    return JSON.parse(text);
}

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
            script.onerror = () => reject(new Error('ArtPlayer failed to load'));
            document.head.appendChild(script);
        });
        return promise;
    };
})();

export function useNetmirrorPlayer() {
    const extensionActive = ref(false);
    const loading = ref(false);
    const playbackError = ref('');
    const resolved = ref<NetmirrorResolve | null>(null);
    const selectedStreamIndex = ref(0);
    const artReady = ref(false);
    const artContainer = ref<HTMLElement | null>(null);

    let artInstance: any = null;
    let prepareToken = 0;
    let refreshInFlight: Promise<NetmirrorResolve | null> | null = null;
    let extInterval: number | null = null;

    const checkExtension = () => {
        const ext = (window as any).__MOOVIE_STREAM_EXT__;
        extensionActive.value = Boolean(ext?.active);
    };

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

    const buildResolveUrl = (opts: {
        type: 'movie' | 'tv';
        id: string;
        season: number;
        episode: number;
        server?: number;
    }) => {
        const params = new URLSearchParams({
            action: 'resolve',
            type: opts.type,
            id: opts.id,
            se: String(opts.season),
            ep: String(opts.episode),
            server: String(opts.server ?? 1)
        });
        return `/api/netmirror?${params.toString()}`;
    };

    const fetchResolve = async (url: string) => {
        const resp = await fetch(url);
        const data = await parseApiResponse(resp);
        if (!resp.ok) throw new Error(data.error || `Resolve failed (${resp.status})`);
        return data as NetmirrorResolve;
    };

    const pickDefaultStreamIndex = (streams: NetmirrorStream[]) => {
        if (!streams.length) return 0;
        let bestIndex = 0;
        let bestRank = qualityRank[streams[0].quality] ?? 99;
        for (let i = 1; i < streams.length; i++) {
            const rank = qualityRank[streams[i].quality] ?? 99;
            if (rank < bestRank) {
                bestRank = rank;
                bestIndex = i;
            }
        }
        return bestIndex;
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
        if (!container) throw new Error('Player container missing');

        destroyArt();
        const playUrl = resolvePlaybackUrl(stream);
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
            theme: '#4eb5ff'
        });

        artInstance.on('video:loadedmetadata', () => {
            playbackError.value = '';
        });
        artInstance.on('error', () => {
            playbackError.value = 'Playback failed — try another quality or reload.';
        });

        artReady.value = true;
    };

    const refreshResolve = async (
        resolveUrl: string
    ): Promise<NetmirrorResolve | null> => {
        if (refreshInFlight) return refreshInFlight;
        refreshInFlight = (async () => {
            try {
                const data = await fetchResolve(resolveUrl);
                resolved.value = data;
                return data;
            } catch {
                return null;
            } finally {
                refreshInFlight = null;
            }
        })();
        return refreshInFlight;
    };

    const preparePlayback = async (
        stream: NetmirrorStream | null,
        resolveUrl: string,
        options: { allowRefresh?: boolean } = {}
    ): Promise<void> => {
        const { allowRefresh = true } = options;
        const token = ++prepareToken;
        destroyArt();
        if (!stream) return;

        const ageSec = streamUrlAgeSec(stream.url);
        if (ageSec !== null && ageSec > 120 && allowRefresh) {
            const fresh = await refreshResolve(resolveUrl);
            if (token !== prepareToken || !fresh?.streams?.length) return;
            selectedStreamIndex.value = pickDefaultStreamIndex(fresh.streams);
            return preparePlayback(
                fresh.streams[selectedStreamIndex.value],
                resolveUrl,
                { allowRefresh: false }
            );
        }

        try {
            const probeUrl = extensionActive.value
                ? stream.url
                : toAbsoluteUrl(stream.proxiedUrl);
            const resp = await fetch(probeUrl, {
                method: 'GET',
                headers: { Range: 'bytes=0-65535' }
            });
            if (!resp.ok && resp.status !== 206 && allowRefresh) {
                const fresh = await refreshResolve(resolveUrl);
                if (token !== prepareToken || !fresh?.streams?.length) return;
                selectedStreamIndex.value = pickDefaultStreamIndex(fresh.streams);
                return preparePlayback(
                    fresh.streams[selectedStreamIndex.value],
                    resolveUrl,
                    { allowRefresh: false }
                );
            }
            if (token !== prepareToken) return;
            await mountArtplayer(stream);
            playbackError.value = '';
        } catch (err: any) {
            if (token !== prepareToken) return;
            playbackError.value =
                err?.message || 'Playback failed. Install the Moovie Stream Boost extension.';
        }
    };

    const resolveAndPlay = async (opts: {
        type: 'movie' | 'tv';
        id: string;
        season?: number;
        episode?: number;
        server?: number;
    }) => {
        loading.value = true;
        playbackError.value = '';
        destroyArt();

        try {
            const url = buildResolveUrl({
                type: opts.type,
                id: opts.id,
                season: opts.season ?? 0,
                episode: opts.episode ?? 0,
                server: opts.server
            });
            const data = await fetchResolve(url);
            resolved.value = data;
            selectedStreamIndex.value = pickDefaultStreamIndex(data.streams || []);
            const stream = data.streams?.[selectedStreamIndex.value] || null;
            await preparePlayback(stream, url);
        } catch (err: any) {
            playbackError.value = err?.message || 'Could not resolve stream.';
        } finally {
            loading.value = false;
        }
    };

    const switchQuality = async (index: number, resolveUrl: string) => {
        selectedStreamIndex.value = index;
        const stream = resolved.value?.streams?.[index] || null;
        if (!stream) return;
        if (artInstance) {
            await artInstance.switchUrl(resolvePlaybackUrl(stream));
            return;
        }
        await preparePlayback(stream, resolveUrl);
    };

    onMounted(() => {
        checkExtension();
        extInterval = window.setInterval(checkExtension, 2000);
    });

    onBeforeUnmount(() => {
        destroyArt();
        if (extInterval !== null) window.clearInterval(extInterval);
    });

    return {
        extensionActive,
        loading,
        playbackError,
        resolved,
        selectedStreamIndex,
        artReady,
        artContainer,
        resolveAndPlay,
        switchQuality,
        destroyArt,
        pickDefaultStreamIndex
    };
}