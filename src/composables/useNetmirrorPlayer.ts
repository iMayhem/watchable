import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useStreamExtension } from './useStreamExtension';

export type PlayerSkin = 'default' | 'netflix';

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

export function formatPlayerTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
}

export function useNetmirrorPlayer(options: { skin?: PlayerSkin } = {}) {
    const skin = options.skin ?? 'default';
    const { extensionActive, checkExtension, pingExtension } = useStreamExtension();
    const loading = ref(false);
    const playbackError = ref('');
    const resolved = ref<NetmirrorResolve | null>(null);
    const selectedStreamIndex = ref(0);
    const artReady = ref(false);
    const artContainer = ref<HTMLElement | null>(null);
    const isPlaying = ref(false);
    const currentTime = ref(0);
    const duration = ref(0);
    const buffered = ref(0);
    const isMuted = ref(false);

    let artInstance: any = null;
    let prepareToken = 0;
    let refreshInFlight: Promise<NetmirrorResolve | null> | null = null;
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
        isPlaying.value = false;
        currentTime.value = 0;
        duration.value = 0;
        buffered.value = 0;
    };

    const bindPlaybackEvents = () => {
        if (!artInstance) return;

        const syncTime = () => {
            const video = artInstance.video as HTMLVideoElement | undefined;
            if (!video) return;
            currentTime.value = video.currentTime || 0;
            duration.value = video.duration || 0;
            isMuted.value = video.muted;
            if (video.buffered.length > 0) {
                buffered.value = video.buffered.end(video.buffered.length - 1);
            }
        };

        artInstance.on('video:timeupdate', syncTime);
        artInstance.on('video:loadedmetadata', () => {
            playbackError.value = '';
            syncTime();
        });
        artInstance.on('video:play', () => {
            isPlaying.value = true;
        });
        artInstance.on('video:pause', () => {
            isPlaying.value = false;
        });
        artInstance.on('video:volumechange', syncTime);
        artInstance.on('error', () => {
            playbackError.value = 'Playback failed — try another quality or reload.';
        });
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

    const waitForContainer = async (timeoutMs = 4000) => {
        if (artContainer.value) return;
        const started = Date.now();
        while (!artContainer.value && Date.now() - started < timeoutMs) {
            await nextTick();
            await new Promise((r) => window.setTimeout(r, 40));
        }
        if (!artContainer.value) {
            throw new Error('Player container missing');
        }
    };

    const waitForExtension = async (timeoutMs = 1000) => {
        pingExtension();
        checkExtension();
        if (extensionActive.value) return;

        await new Promise<void>((resolve) => {
            const started = Date.now();
            const timer = window.setInterval(() => {
                checkExtension();
                pingExtension();
                if (extensionActive.value || Date.now() - started >= timeoutMs) {
                    window.clearInterval(timer);
                    resolve();
                }
            }, 120);
        });
    };

    const mountArtplayer = async (stream: NetmirrorStream) => {
        await loadArtplayerAssets();
        const container = artContainer.value;
        if (!container) throw new Error('Player container missing');

        destroyArt();
        const playUrl = resolvePlaybackUrl(stream);
        const ArtplayerCtor = (window as any).Artplayer;
        const isNetflix = skin === 'netflix';

        artInstance = new ArtplayerCtor({
            container,
            url: playUrl,
            type: 'mp4',
            autoplay: true,
            preload: 'auto',
            theme: isNetflix ? '#e50914' : '#4eb5ff',
            playbackRate: !isNetflix,
            aspectRatio: !isNetflix,
            fullscreen: !isNetflix,
            fullscreenWeb: !isNetflix,
            miniProgressBar: !isNetflix,
            fastForward: !isNetflix,
            setting: !isNetflix,
            autoSize: isNetflix,
            autoMini: false,
            pip: false,
            controls: isNetflix ? [] : undefined
        });

        bindPlaybackEvents();
        artReady.value = true;
    };

    const togglePlay = () => {
        if (!artInstance) return;
        artInstance.toggle();
    };

    const seekTo = (time: number) => {
        if (!artInstance) return;
        artInstance.seek = Math.max(0, Math.min(time, duration.value || time));
        currentTime.value = artInstance.currentTime;
    };

    const skipBack = (seconds = 10) => {
        seekTo((currentTime.value || 0) - seconds);
    };

    const toggleMute = () => {
        if (!artInstance?.video) return;
        artInstance.video.muted = !artInstance.video.muted;
        isMuted.value = artInstance.video.muted;
    };

    const progress = computed(() => {
        if (!duration.value) return 0;
        return Math.min(100, (currentTime.value / duration.value) * 100);
    });

    const bufferProgress = computed(() => {
        if (!duration.value) return 0;
        return Math.min(100, (buffered.value / duration.value) * 100);
    });

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
            await waitForContainer();
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
            await waitForContainer();
            await waitForExtension();
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

    watch(extensionActive, async (active) => {
        if (!active || !artInstance || !resolved.value?.streams?.length) return;
        const stream = resolved.value.streams[selectedStreamIndex.value];
        if (!stream) return;
        try {
            await artInstance.switchUrl(resolvePlaybackUrl(stream));
            playbackError.value = '';
        } catch {
            /* keep current stream */
        }
    });

    onBeforeUnmount(() => {
        destroyArt();
    });

    return {
        extensionActive,
        loading,
        playbackError,
        resolved,
        selectedStreamIndex,
        artReady,
        artContainer,
        isPlaying,
        currentTime,
        duration,
        buffered,
        isMuted,
        progress,
        bufferProgress,
        resolveAndPlay,
        switchQuality,
        togglePlay,
        seekTo,
        skipBack,
        toggleMute,
        destroyArt,
        pickDefaultStreamIndex
    };
}