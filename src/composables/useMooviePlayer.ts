import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useStreamExtension } from './useStreamExtension';
import { nfDebug, nfDebugError } from './useNetflixDebug';

export type PlayerSkin = 'default' | 'netflix';

export interface MoovieStream {
    quality: string;
    url: string;
    proxiedUrl: string;
}

export interface MoovieResolve {
    meta: {
        id: string;
        title: string;
        subjectid: string;
        media_type: string;
        backdrop_path: string | null;
    };
    streams: MoovieStream[];
    playerProxyUrl: string;
    streamWarning?: string | null;
    resolveType?: string;
    resolveSeason?: number;
    resolveEpisode?: number;
}

function titleSuggestsAnime(title: string) {
    const t = title.toLowerCase();
    return /\banime\b|kimetsu|naruto|one piece|demon slayer|gachiakuta|jujutsu|solo leveling|dragon ball|bleach\b|hunter x hunter|attack on titan/.test(
        t
    );
}

export function streamsLookCorrupt(title: string, streams: MoovieStream[]) {
    if (!streams.length) return false;
    const allAnimeCdn = streams.every((s) => /\/animekai\//i.test(s.url));
    if (!allAnimeCdn) return false;
    return !titleSuggestsAnime(title);
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
            'API returned HTML instead of JSON. Deploy /api/moovie-catalog or run npm run dev locally.'
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
            if (!document.querySelector('link[data-moovie-art-css]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.css';
                link.setAttribute('data-moovie-art-css', '1');
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

export interface PlaybackResumeOptions {
    resumeAt?: number;
    resumePlaying?: boolean;
}

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

export function useMooviePlayer(options: { skin?: PlayerSkin } = {}) {
    const skin = options.skin ?? 'default';
    const dbg = (step: string, detail?: unknown) => {
        if (skin === 'netflix') nfDebug(step, detail);
    };
    const dbgError = (step: string, detail?: unknown) => {
        if (skin === 'netflix') nfDebugError(step, detail);
    };
    const { extensionActive, checkExtension, pingExtension } = useStreamExtension();
    const loading = ref(false);
    const playbackError = ref('');
    const streamWarning = ref('');
    const resolved = ref<MoovieResolve | null>(null);
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
    let refreshInFlight: Promise<MoovieResolve | null> | null = null;
    let videoClickHandler: ((event: MouseEvent) => void) | null = null;

    const clearArtInstance = () => {
        const video = artInstance?.video as HTMLVideoElement | undefined;
        if (video && videoClickHandler) {
            video.removeEventListener('click', videoClickHandler);
            videoClickHandler = null;
        }
        if (video) {
            try {
                video.pause();
                video.removeAttribute('src');
                video.load();
            } catch {
                /* ignore */
            }
        }
        if (artInstance) {
            dbg('player:destroy');
            try {
                artInstance.destroy(true);
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

    const destroyArt = () => {
        prepareToken++;
        clearArtInstance();
        loading.value = false;
    };

    const bindVideoClickToggle = () => {
        const video = artInstance?.video as HTMLVideoElement | undefined;
        if (!video || videoClickHandler) return;

        videoClickHandler = (event: MouseEvent) => {
            event.stopPropagation();
            if (!artInstance) return;
            dbg('player:video-click');
            artInstance.toggle();
        };
        video.addEventListener('click', videoClickHandler);
    };

    const switchStreamUrl = async (
        stream: MoovieStream,
        opts: PlaybackResumeOptions = {}
    ) => {
        if (!artInstance) return false;

        const resumeAt =
            opts.resumeAt ?? artInstance.currentTime ?? currentTime.value ?? 0;
        const resumePlaying = opts.resumePlaying ?? isPlaying.value;
        const playUrl = resolvePlaybackUrl(stream);

        artInstance.pause();
        isPlaying.value = false;

        dbg('player:switch-url', {
            quality: stream.quality,
            resumeAt,
            resumePlaying
        });

        return new Promise<boolean>((resolve) => {
            let settled = false;
            const finish = (ok: boolean) => {
                if (settled) return;
                settled = true;
                artInstance.off('video:canplay', onReady);
                resolve(ok);
            };

            const onReady = () => {
                try {
                    if (resumeAt > 0) {
                        artInstance.seek = resumeAt;
                        currentTime.value = resumeAt;
                    }
                    if (resumePlaying) {
                        void artInstance.play()?.catch(() => artInstance.play());
                    } else {
                        artInstance.pause();
                    }
                    playbackError.value = '';
                    finish(true);
                } catch (err) {
                    dbgError('player:switch-url:resume-fail', err);
                    finish(false);
                }
            };

            artInstance.on('video:canplay', onReady);
            void artInstance.switchUrl(playUrl).catch((err: unknown) => {
                dbgError('player:switch-url:fail', err);
                finish(false);
            });
        });
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
            dbg('player:metadata', { duration: artInstance.video?.duration });
            playbackError.value = '';
            syncTime();
        });
        artInstance.on('video:play', () => {
            dbg('player:play');
            isPlaying.value = true;
        });
        artInstance.on('video:pause', () => {
            dbg('player:pause');
            isPlaying.value = false;
        });
        artInstance.on('video:volumechange', syncTime);
        artInstance.on('error', () => {
            dbgError('player:error');
            playbackError.value = 'Playback failed — try another quality or reload.';
        });

        bindVideoClickToggle();
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
        return `/api/moovie-catalog?${params.toString()}`;
    };

    const fetchResolve = async (url: string) => {
        const resp = await fetch(url);
        const data = await parseApiResponse(resp);
        if (!resp.ok) throw new Error(data.error || `Resolve failed (${resp.status})`);
        return data as MoovieResolve;
    };

    const pickDefaultStreamIndex = (streams: MoovieStream[]) => {
        if (!streams.length) return 0;
        let bestIndex = 0;
        let bestRank = qualityRank[streams[0].quality] ?? -1;
        for (let i = 1; i < streams.length; i++) {
            const rank = qualityRank[streams[i].quality] ?? -1;
            if (rank > bestRank) {
                bestRank = rank;
                bestIndex = i;
            }
        }
        return bestIndex;
    };

    const resolvePlaybackUrl = (stream: MoovieStream) => {
        if (extensionActive.value) {
            return withPlaybackCacheBuster(stream.url);
        }
        return withPlaybackCacheBuster(toAbsoluteUrl(stream.proxiedUrl));
    };

    const waitForContainer = async (timeoutMs = 4000) => {
        dbg('player:wait-container');
        if (artContainer.value) return;
        const started = Date.now();
        while (!artContainer.value && Date.now() - started < timeoutMs) {
            await nextTick();
            await new Promise((r) => window.setTimeout(r, 40));
        }
        if (!artContainer.value) {
            dbgError('player:container-missing', { waitedMs: Date.now() - started });
            throw new Error('Player container missing');
        }
        dbg('player:container-ready', { waitedMs: Date.now() - started });
    };

    const waitForExtension = async (timeoutMs = 1000) => {
        dbg('player:wait-extension', { timeoutMs });
        pingExtension();
        checkExtension();
        if (extensionActive.value) {
            dbg('player:extension-active');
            return;
        }

        await new Promise<void>((resolve) => {
            const started = Date.now();
            const timer = window.setInterval(() => {
                checkExtension();
                pingExtension();
                if (extensionActive.value || Date.now() - started >= timeoutMs) {
                    window.clearInterval(timer);
                    dbg('player:extension-wait-done', {
                        active: extensionActive.value,
                        waitedMs: Date.now() - started
                    });
                    resolve();
                }
            }, 120);
        });
    };

    const mountArtplayer = async (
        stream: MoovieStream,
        resume: PlaybackResumeOptions = {}
    ) => {
        dbg('player:mount:start', { quality: stream.quality, extension: extensionActive.value });
        await loadArtplayerAssets();
        const container = artContainer.value;
        if (!container) throw new Error('Player container missing');

        clearArtInstance();
        const playUrl = resolvePlaybackUrl(stream);
        const resumeAt = resume.resumeAt ?? 0;
        const resumePlaying = resume.resumePlaying ?? true;
        dbg('player:mount:url', {
            quality: stream.quality,
            viaExtension: extensionActive.value,
            resumeAt,
            resumePlaying
        });
        const ArtplayerCtor = (window as any).Artplayer;
        const isNetflix = skin === 'netflix';

        artInstance = new ArtplayerCtor({
            container,
            url: playUrl,
            type: 'mp4',
            autoplay: resumePlaying,
            preload: 'auto',
            theme: '#4eb5ff',
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

        if (resumeAt > 0 || resumePlaying === false) {
            let resumed = false;
            const applyResume = () => {
                if (resumed || !artInstance) return;
                resumed = true;
                if (resumeAt > 0) {
                    artInstance.seek = resumeAt;
                    currentTime.value = resumeAt;
                }
                if (!resumePlaying) {
                    artInstance.pause();
                }
            };
            artInstance.on('video:loadedmetadata', applyResume);
            artInstance.on('video:canplay', applyResume);
        }

        artReady.value = true;
        dbg('player:mount:ready', { quality: stream.quality });
    };

    const togglePlay = () => {
        if (!artInstance) return;
        artInstance.toggle();
    };

    const pausePlayback = () => {
        if (!artInstance) return;
        artInstance.pause();
        isPlaying.value = false;
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
    ): Promise<MoovieResolve | null> => {
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
        stream: MoovieStream | null,
        resolveUrl: string,
        options: { allowRefresh?: boolean; resume?: PlaybackResumeOptions } = {}
    ): Promise<void> => {
        const { allowRefresh = true, resume } = options;
        const token = ++prepareToken;
        clearArtInstance();
        if (!stream) return;

        dbg('player:prepare', { quality: stream?.quality, allowRefresh });
        const ageSec = streamUrlAgeSec(stream.url);
        if (ageSec !== null && ageSec > 120 && allowRefresh) {
            dbg('player:prepare:stale-url', { ageSec });
            const fresh = await refreshResolve(resolveUrl);
            if (token !== prepareToken || !fresh?.streams?.length) return;
            selectedStreamIndex.value = pickDefaultStreamIndex(fresh.streams);
            return preparePlayback(
                fresh.streams[selectedStreamIndex.value],
                resolveUrl,
                { allowRefresh: false, resume }
            );
        }

        try {
            if (!extensionActive.value) {
                const probeUrl = toAbsoluteUrl(stream.proxiedUrl);
                const resp = await fetch(probeUrl, {
                    method: 'GET',
                    headers: { Range: 'bytes=0-65535' }
                });
                if (!resp.ok && resp.status !== 206 && allowRefresh) {
                    dbg('player:prepare:probe-fail', { status: resp.status });
                    const fresh = await refreshResolve(resolveUrl);
                    if (token !== prepareToken || !fresh?.streams?.length) return;
                    selectedStreamIndex.value = pickDefaultStreamIndex(fresh.streams);
                    return preparePlayback(
                        fresh.streams[selectedStreamIndex.value],
                        resolveUrl,
                        { allowRefresh: false, resume }
                    );
                }
            }
            if (token !== prepareToken) return;
            await waitForContainer();
            await mountArtplayer(stream, resume);
            playbackError.value = '';
        } catch (err: any) {
            if (token !== prepareToken) return;
            dbgError('player:prepare:fail', err);
            playbackError.value =
                err?.message || 'Playback failed. Install the Moovie Stream Boost extension.';
        }
    };

    const resolveAndPlay = async (
        opts: {
            type: 'movie' | 'tv';
            id: string;
            season?: number;
            episode?: number;
            server?: number;
        },
        resume: PlaybackResumeOptions = {}
    ) => {
        dbg('player:resolve:start', { ...opts, resume });
        loading.value = true;
        playbackError.value = '';
        streamWarning.value = '';
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
            let data = await fetchResolve(url);
            const title = data.meta?.title || '';

            if (data.streamWarning) {
                const altType = opts.type === 'tv' ? 'movie' : 'tv';
                const altUrl = buildResolveUrl({
                    type: altType,
                    id: opts.id,
                    season: altType === 'movie' ? 0 : opts.season ?? 0,
                    episode: altType === 'movie' ? 0 : opts.episode ?? 0,
                    server: opts.server
                });
                try {
                    const altData = await fetchResolve(altUrl);
                    if (!altData.streamWarning && (altData.streams?.length || 0) > 0) {
                        dbg('player:resolve:fallback-type', {
                            from: opts.type,
                            to: altType,
                            title: altData.meta?.title
                        });
                        data = altData;
                    }
                } catch {
                    /* keep original resolve */
                }
            }

            if (streamsLookCorrupt(title, data.streams || [])) {
                throw new Error(
                    'Stream mismatch — the catalogue returned the wrong video for this title. Try another entry or search again.'
                );
            }
            resolved.value = data;
            streamWarning.value = data.streamWarning || '';
            selectedStreamIndex.value = pickDefaultStreamIndex(data.streams || []);
            dbg('player:resolve:ok', {
                title: data.meta?.title,
                streamCount: data.streams?.length ?? 0,
                quality: data.streams?.[selectedStreamIndex.value]?.quality
            });
            const stream = data.streams?.[selectedStreamIndex.value] || null;
            await preparePlayback(stream, url, { resume });
        } catch (err: any) {
            dbgError('player:resolve:fail', err);
            playbackError.value = err?.message || 'Could not resolve stream.';
        } finally {
            loading.value = false;
        }
    };

    const pickStreamIndexPreservingQuality = (
        streams: MoovieStream[],
        preferredQuality?: string
    ) => {
        if (!streams.length) return 0;
        if (preferredQuality) {
            const idx = streams.findIndex((s) => s.quality === preferredQuality);
            if (idx >= 0) return idx;
        }
        return pickDefaultStreamIndex(streams);
    };

    const switchResolveEntry = async (
        opts: {
            type: 'movie' | 'tv';
            id: string;
            season?: number;
            episode?: number;
            server?: number;
        },
        resume: PlaybackResumeOptions = {}
    ) => {
        dbg('player:switch-entry:start', { ...opts, resume });
        playbackError.value = '';
        const url = buildResolveUrl({
            type: opts.type,
            id: opts.id,
            season: opts.season ?? 0,
            episode: opts.episode ?? 0,
            server: opts.server
        });

        const preferredQuality =
            resolved.value?.streams?.[selectedStreamIndex.value]?.quality;
        const data = await fetchResolve(url);
        const title = data.meta?.title || '';

        if (streamsLookCorrupt(title, data.streams || [])) {
            throw new Error(
                'Stream mismatch — the catalogue returned the wrong video for this title.'
            );
        }

        resolved.value = data;
        streamWarning.value = data.streamWarning || '';
        selectedStreamIndex.value = pickStreamIndexPreservingQuality(
            data.streams || [],
            preferredQuality
        );

        const stream = data.streams?.[selectedStreamIndex.value] || null;
        if (!stream) throw new Error('No stream available for this audio.');

        if (artInstance) {
            const ok = await switchStreamUrl(stream, resume);
            if (!ok) throw new Error('Could not switch audio track.');
            playbackError.value = '';
            return;
        }

        await preparePlayback(stream, url, { resume });
    };

    const switchQuality = async (index: number, resolveUrl: string) => {
        const resumeAt = currentTime.value;
        const resumePlaying = isPlaying.value;
        dbg('player:quality:switch', {
            index,
            quality: resolved.value?.streams?.[index]?.quality,
            resumeAt,
            resumePlaying
        });
        selectedStreamIndex.value = index;
        const stream = resolved.value?.streams?.[index] || null;
        if (!stream) return;
        if (artInstance) {
            await switchStreamUrl(stream, { resumeAt, resumePlaying });
            return;
        }
        await preparePlayback(stream, resolveUrl, {
            resume: { resumeAt, resumePlaying }
        });
    };

    watch(extensionActive, async (active) => {
        if (!active || !artInstance || !resolved.value?.streams?.length) return;
        const stream = resolved.value.streams[selectedStreamIndex.value];
        if (!stream) return;
        dbg('player:extension-switch-url', { quality: stream.quality });
        try {
            await switchStreamUrl(stream, {
                resumeAt: currentTime.value,
                resumePlaying: isPlaying.value
            });
            playbackError.value = '';
        } catch (err) {
            dbgError('player:extension-switch-url:fail', err);
        }
    });

    onBeforeUnmount(() => {
        destroyArt();
    });

    return {
        extensionActive,
        loading,
        playbackError,
        streamWarning,
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
        switchResolveEntry,
        switchQuality,
        togglePlay,
        pausePlayback,
        seekTo,
        skipBack,
        toggleMute,
        destroyArt,
        pickDefaultStreamIndex
    };
}