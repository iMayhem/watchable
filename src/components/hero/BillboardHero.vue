<template>
    <section
        ref="rootRef"
        class="billboard"
        :class="{
            'trailer-playing': trailerLive,
            'is-loading': loading,
            'billboard--poster-art': isPosterKeyArt
        }"
        aria-label="Featured title"
    >
        <!-- Skeleton Loading state -->
        <div v-if="loading" class="billboard__skeleton-wrapper">
            <div class="billboard__stage billboard__skeleton-shimmer" />
            <div class="container-lm billboard__content">
                <div class="billboard__skeleton-line billboard__skeleton-shimmer" style="width: 120px; height: 16px; margin-bottom: 24px; border-radius: 4px" />
                <div class="billboard__skeleton-line billboard__skeleton-shimmer" style="width: 60%; height: 5rem; margin-bottom: 24px; border-radius: 8px" />
                <div class="billboard__skeleton-line billboard__skeleton-shimmer" style="width: 40%; height: 24px; margin-bottom: 16px; border-radius: 4px" />
                <div class="billboard__skeleton-line billboard__skeleton-shimmer" style="width: 50%; height: 60px; margin-bottom: 32px; border-radius: 6px" />
                <div class="billboard__actions">
                    <div class="billboard__skeleton-line billboard__skeleton-shimmer" style="width: 140px; height: 48px; border-radius: 24px" />
                    <div class="billboard__skeleton-line billboard__skeleton-shimmer" style="width: 140px; height: 48px; border-radius: 24px" />
                    <div class="billboard__skeleton-line billboard__skeleton-shimmer" style="width: 140px; height: 48px; border-radius: 24px" />
                </div>
            </div>
        </div>

        <!-- Normal Content -->
        <template v-else>
            <div class="billboard__stage">
                <template v-if="backdropUrl">
                    <div v-if="isPosterKeyArt" class="billboard__art-fallback">
                        <img
                            class="billboard__art--blurred"
                            :src="backdropUrl"
                            alt=""
                            fetchpriority="low"
                            decoding="async"
                            loading="eager"
                        />
                        <img
                            class="billboard__art--contained"
                            :src="backdropUrl"
                            :alt="title"
                            fetchpriority="high"
                            decoding="async"
                            loading="eager"
                        />
                    </div>
                    <img
                        v-else
                        class="billboard__backdrop"
                        :src="backdropUrl"
                        :alt="title"
                        loading="eager"
                        fetchpriority="high"
                        decoding="async"
                    />
                </template>
                <div v-else class="billboard__backdrop billboard__backdrop--placeholder" aria-hidden="true" />

                <TrailerIframe
                    :bind-ref="setIframe"
                    :src="trailerSrc"
                    :visible="trailerVisible"
                    :live="trailerLive"
                    @load="onIframeLoad"
                />

                <div class="billboard__scrim" aria-hidden="true" />
                <div class="billboard__bloom" aria-hidden="true" />
                <div class="billboard__grain grain" aria-hidden="true" />
            </div>

            <TrailerControls
                :visible="trailerLive"
                :paused="userPaused"
                :muted="userMuted"
                @toggle-pause="togglePause"
                @toggle-mute="toggleMute"
            />

            <div class="container-lm billboard__content">
                <span class="eyebrow billboard__eyebrow">{{ eyebrow }}</span>

                <h1 class="billboard__title display">
                    {{ title }}
                </h1>

                <p v-if="tagline" class="billboard__tagline">{{ tagline }}</p>

                <ul class="billboard__meta meta">
                    <li v-if="year">{{ year }}</li>
                    <li v-if="ratingLabel" class="billboard__rating">
                        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                            <path fill="currentColor" d="M12 2l2.9 6.88L22 9.82l-5.34 4.94L18.18 22 12 18.27 5.82 22l1.52-7.24L2 9.82l7.1-.94z"/>
                        </svg>
                        {{ ratingLabel }}
                    </li>
                    <li v-for="g in genreNames" :key="g">{{ g }}</li>
                    <li v-if="adult" class="billboard__cert">18+</li>
                </ul>

                <p v-if="overview" class="billboard__overview">{{ truncatedOverview }}</p>

                <div class="billboard__actions">
                    <LmButton
                        variant="primary"
                        size="lg"
                        :to="playRoute"
                        aria-label="Play"
                    >
                        <template #leading>
                            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                                <path fill="currentColor" d="M8 5v14l11-7z"/>
                            </svg>
                        </template>
                        Play
                    </LmButton>



                    <LmButton
                        variant="ghost"
                        size="lg"
                        :to="detailRoute"
                        aria-label="More info"
                    >
                        More info
                    </LmButton>

                    <LmButton
                        variant="outline"
                        size="lg"
                        :href="partyHref"
                        rel="nofollow"
                        aria-label="Watch Together"
                    >
                        <template #leading>
                            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </template>
                        Watch Together
                    </LmButton>

                    <LmButton
                        variant="outline"
                        size="lg"
                        :loading="downloading"
                        :disabled="downloading"
                        @click="handleDownload"
                        aria-label="Download"
                    >
                        <template #leading>
                            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                        </template>
                        Download
                    </LmButton>
                </div>
            </div>

            <!-- Download Quality Panel -->
            <Teleport to="body">
                <Transition name="lm-dialog">
                    <div
                        v-if="showDownloadModal"
                        class="billboard__dl-overlay"
                        @click.self="showDownloadModal = false"
                    >
                        <div class="billboard__dl-modal" role="dialog" aria-modal="true" aria-label="Select Quality">
                            <header class="billboard__dl-header">
                                <h3 class="billboard__dl-title">Select Quality</h3>
                                <button type="button" class="billboard__dl-close" @click="showDownloadModal = false">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                                </button>
                            </header>
                            <div class="billboard__dl-body">
                                <button
                                    v-for="opt in downloadOptions"
                                    :key="opt.url"
                                    type="button"
                                    class="billboard__dl-opt"
                                    @click="triggerDownload(opt.url, opt.quality)"
                                >
                                    <span
                                        class="billboard__dl-badge"
                                        :class="{
                                            'is-4k': opt.quality.includes('4K') || opt.quality.includes('2160'),
                                            'is-1080': opt.quality.includes('1080'),
                                            'is-720': opt.quality.includes('720')
                                        }"
                                    >{{ opt.quality }}</span>
                                    <span class="billboard__dl-meta">
                                        <span class="billboard__dl-chip">MP4</span>
                                        <template v-if="opt.size === ''">
                                            <span class="billboard__dl-dot">•</span>
                                            <span class="billboard__dl-size is-checking">Checking...</span>
                                        </template>
                                        <template v-else-if="opt.size && opt.size !== '-'">
                                            <span class="billboard__dl-dot">•</span>
                                            <span class="billboard__dl-size">{{ opt.size }}</span>
                                        </template>
                                    </span>
                                    <svg class="billboard__dl-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="7 10 12 15 17 10" />
                                        <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </Transition>
            </Teleport>
        </template>
    </section>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, PropType, ref, toRef } from 'vue';
import LmButton from '../primitives/Button.vue';
import {
    catalogDisplayImageSize,
    isCatalogCdnImage
} from '../../utils/useWebImage';
import TrailerControls from './TrailerControls.vue';
import TrailerIframe from './TrailerIframe.vue';
import { genreName, primeGenres } from '../../composables/useGenreLookup';
import { useAmbientColor } from '../../composables/useAmbientColor';
import { useTrailerEmbed } from '../../composables/useTrailerEmbed';
import { useAppPaths } from '../../composables/useAppPaths';
import { useWebImage } from '../../utils/useWebImage';
import { buildPartyHref } from '../../utils/partyRoom';
import { logDownload } from '../../composables/useDownloadTracking';

export default defineComponent({
    name: 'BillboardHero',
    components: { LmButton, TrailerControls, TrailerIframe },
    props: {
        id: { type: [Number, String], default: '' },
        partyId: { type: [Number, String], default: null },
        type: { type: String as PropType<'movie' | 'tv' | 'anime'>, default: 'movie' },
        title: { type: String, default: '' },
        tagline: { type: String, default: '' },
        overview: { type: String, default: '' },
        backdropPath: { type: String as PropType<string | null>, default: null },
        posterPath: { type: String as PropType<string | null>, default: null },
        rating: { type: Number, default: 0 },
        releaseDate: { type: String, default: '' },
        genreIds: { type: Array as PropType<number[]>, default: () => [] },
        adult: { type: Boolean, default: false },
        eyebrow: { type: String, default: 'This week’s feature' },
        dwellMs: { type: Number, default: 2000 },
        loading: { type: Boolean, default: false },
        strictBackdrop: { type: Boolean, default: false },
        playTo: { type: [String, Object] as PropType<string | Record<string, unknown>>, default: null },
        detailTo: { type: [String, Object] as PropType<string | Record<string, unknown>>, default: null }
    },
    setup(props) {
        const rootRef = ref<HTMLElement | null>(null);
        const artPath = computed(() => {
            return props.strictBackdrop
                ? props.backdropPath
                : props.backdropPath || props.posterPath;
        });

        const isPosterKeyArt = computed(() => {
            const path = artPath.value;
            if (!path) return false;
            if (props.backdropPath && props.backdropPath === props.posterPath) return true;
            return isCatalogCdnImage(path);
        });

        useAmbientColor(artPath, rootRef);

        const backdropUrl = computed(() => {
            const path = artPath.value;
            if (!path) return '';
            const preferHero = Boolean(props.backdropPath) && !isPosterKeyArt.value;
            const size = catalogDisplayImageSize(path, preferHero ? 'hero' : 'large');
            return useWebImage(path, size);
        });

        const year = computed(() =>
            props.releaseDate ? new Date(props.releaseDate).getFullYear() : null
        );

        const ratingLabel = computed(() =>
            props.rating > 0 ? props.rating.toFixed(1) : ''
        );

        const genreNames = computed(() => {
            return (props.genreIds || [])
                .map(id => genreName(id, props.type === 'anime' ? 'tv' : props.type))
                .filter((n): n is string => !!n)
                .slice(0, 3);
        });

        const truncatedOverview = computed(() => {
            if (!props.overview) return '';
            if (props.overview.length <= 240) return props.overview;
            return `${props.overview.slice(0, 237).trim()}…`;
        });

        const paths = useAppPaths();

        const playRoute = computed(() => {
            if (props.playTo) return props.playTo;
            return props.type === 'tv'
                ? paths.streamTvShow(props.id, 1, 1)
                : paths.streamMovie(props.id);
        });

        const detailRoute = computed(() => {
            if (props.detailTo) return props.detailTo;
            return paths.detailPath(props.type === 'tv' ? 'tv' : 'movie', props.id);
        });

        const partyHref = computed(() =>
            buildPartyHref({
                id: props.id,
                partyId: props.partyId ?? undefined,
                title: props.title,
                type: props.type,
                source: 'global'
            })
        );

        const embedType = computed(() => props.type === 'anime' ? 'tv' as const : props.type);

        const {
            iframeRef,
            trailerVisible,
            trailerLive,
            trailerSrc,
            userPaused,
            userMuted,
            onIframeLoad,
            togglePause,
            toggleMute
        } = useTrailerEmbed({
            id: toRef(props, 'id'),
            type: embedType,
            rootEl: rootRef,
            dwellMs: props.dwellMs
        });

        const setIframe = (el: HTMLIFrameElement | null) => {
            iframeRef.value = el;
        };

        onMounted(() => {
            primeGenres();
        });

        const showDownloadModal = ref(false);
        const downloading = ref(false);
        const downloadOptions = ref<{ quality: string; url: string; size?: string }[]>([]);

        const extractDirectDownloadUrl = (rawUrl: string): string => {
            if (!rawUrl) return '';
            try {
                const fullUrl = rawUrl.startsWith('/') ? `https://proxy.moovie.fun${rawUrl}` : rawUrl;
                const u = new URL(fullUrl);
                const embedded = u.searchParams.get('link') || u.searchParams.get('url') || u.searchParams.get('file') || u.searchParams.get('download');
                if (embedded && /^https?:\/\//i.test(embedded)) {
                    return embedded;
                }
                return fullUrl;
            } catch (e) {
                return rawUrl.startsWith('/') ? `https://proxy.moovie.fun${rawUrl}` : rawUrl;
            }
        };

        const triggerDownload = (url: string, quality: string) => {
            const finalUrl = extractDirectDownloadUrl(url);
            const titleClean = (props.title || 'media').replace(/[^a-zA-Z0-9_\-]/g, '_');
            const isCrossOrigin = (() => { try { return new URL(finalUrl).origin !== location.origin } catch { return true } })();
            if (!isCrossOrigin) {
                const a = document.createElement('a');
                a.href = finalUrl;
                a.download = `${titleClean}_${quality}.mp4`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } else {
                window.open(finalUrl, '_blank');
            }
            showDownloadModal.value = false;
            logDownload(props.id, props.type, quality, props.title);
        };

        const fetchExactFileSize = async (rawUrl: string): Promise<string> => {
            if (!rawUrl) return '';
            const tryHead = async (url: string): Promise<string> => {
                const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
                const len = res.headers.get('content-length');
                if (len) {
                    const bytes = parseInt(len, 10);
                    if (bytes > 0) {
                        const gb = bytes / (1024 * 1024 * 1024);
                        if (gb >= 0.9) return `${gb.toFixed(1)} GB`;
                        const mb = bytes / (1024 * 1024);
                        return `${mb.toFixed(0)} MB`;
                    }
                }
                return '';
            };
            try { return await tryHead(rawUrl); } catch (e) {}
            try {
                const uB64 = btoa(rawUrl).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                const proxyUrl = `https://proxy.moovie.fun/proxy?u=${uB64}`;
                return await tryHead(proxyUrl);
            } catch (e) {}
            try {
                const uB64 = btoa(rawUrl).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                const proxyUrl = `https://proxy.moovie.fun/proxy?u=${uB64}`;
                const res = await fetch(proxyUrl, { headers: { Range: 'bytes=0-0' }, signal: AbortSignal.timeout(3000) });
                const cr = res.headers.get('content-range');
                const len = res.headers.get('content-length');
                let totalBytes = 0;
                if (cr && cr.includes('/')) {
                    totalBytes = parseInt(cr.split('/')[1], 10);
                } else if (len) {
                    totalBytes = parseInt(len, 10);
                }
                if (totalBytes > 0) {
                    const gb = totalBytes / (1024 * 1024 * 1024);
                    if (gb >= 0.9) return `${gb.toFixed(1)} GB`;
                    const mb = totalBytes / (1024 * 1024);
                    return `${mb.toFixed(0)} MB`;
                }
            } catch (e) {}
            return '';
        };
        const loadOptionSizes = (opts: { quality: string; url: string; size?: string }[]) => {
            opts.forEach(async (opt) => {
                const sz = await fetchExactFileSize(opt.url);
                opt.size = sz || '-';
                downloadOptions.value = [...downloadOptions.value];
            });
        };

        const handleDownload = async () => {
            const id = props.id;
            if (!id || downloading.value) return;
            downloading.value = true;
            try {
                const fetchProvider = (providerId: string) => new Promise<{ quality: string; url: string; size?: string }[]>((resolve) => {
                    let url = `https://proxy.moovie.fun/scrape/source?id=${providerId}&tmdbId=${id}&type=movie&_cb=${Date.now()}`;
                    const es = new EventSource(url);
                    const options: { quality: string; url: string; size?: string }[] = [];
                    let done = false;
                    const finish = () => {
                        if (!done) { done = true; es.close(); resolve(options); }
                    };
                    const timer = setTimeout(finish, 5000);
                    const parse = (item: any) => {
                        if (!item) return;
                        if (item.qualities) {
                            for (const [ql, qo] of Object.entries(item.qualities as Record<string, any>)) {
                                if (qo && qo.url) options.push({ quality: ql.toUpperCase(), url: extractDirectDownloadUrl(qo.url), size: '' });
                            }
                        } else if (item.url && (item.type === 'mp4' || /\.mp4/i.test(item.url))) {
                            options.push({ quality: (item.quality || '1080P').toUpperCase(), url: extractDirectDownloadUrl(item.url), size: '' });
                        }
                    };
                    es.onmessage = (evt) => {
                        try {
                            const data = JSON.parse(evt.data);
                            for (const item of (Array.isArray(data.stream || data.streams) ? (data.stream || data.streams) : [data.stream || data.streams])) {
                                parse(item);
                            }
                        } catch (e) {}
                    };
                    es.addEventListener('completed', (evt: any) => {
                        try {
                            const data = JSON.parse(evt.data);
                            for (const item of (Array.isArray(data.stream || data.streams) ? (data.stream || data.streams) : [data.stream || data.streams])) {
                                parse(item);
                            }
                        } catch (e) {}
                        finish();
                    });
                    es.onerror = finish;
                });

                const allOptions = (await Promise.all(['4khdhubnew', '4khdhub', 'moovie-catalog'].map(fetchProvider))).flat();
                if (allOptions.length === 0) {
                    window.location.href = paths.detailPath('movie', props.id);
                    return;
                }
                const rank: Record<string, number> = { '4K': 100, '2160': 90, '1080': 80, '720': 70, '480': 60, '360': 50 };
                allOptions.sort((a, b) => (rank[a.quality.replace(/P$/i, '').toUpperCase()] || 0) - (rank[b.quality.replace(/P$/i, '').toUpperCase()] || 0)).reverse();
                downloadOptions.value = allOptions;
                showDownloadModal.value = true;
                loadOptionSizes(allOptions);
            } catch (e) {
                window.location.href = paths.detailPath('movie', props.id);
            } finally {
                downloading.value = false;
            }
        };

        return {
            rootRef,
            setIframe,
            backdropUrl,
            isPosterKeyArt,
            year,
            ratingLabel,
            genreNames,
            truncatedOverview,
            playRoute,
            detailRoute,
            partyHref,
            trailerVisible,
            trailerLive,
            trailerSrc,
            userPaused,
            userMuted,
            onIframeLoad,
            togglePause,
            toggleMute,
            handleDownload,
            showDownloadModal,
            downloading,
            downloadOptions,
            triggerDownload
        };
    }
});
</script>

<style lang="scss" scoped>
.billboard {
    position: relative;
    isolation: isolate;
    min-height: clamp(520px, 78vh, 880px);
    display: flex;
    align-items: flex-end;
    color: var(--bone-50);
    overflow: hidden;

    &__stage {
        position: absolute;
        inset: 0;
        z-index: 0;
    }

    &__backdrop {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center 25%;
        transition: opacity var(--dur-slow) var(--ease-out);

        &--placeholder {
            background: radial-gradient(70% 70% at 40% 40%, var(--ink-700), var(--ink-900));
        }
    }

    &.trailer-playing &__backdrop,
    &.trailer-playing &__art-fallback { opacity: 0; }

    &--poster-art {
        min-height: clamp(560px, 78vh, 820px);
    }

    &--poster-art &__scrim {
        background:
            linear-gradient(180deg, rgba(11,10,8,0.6) 0%, rgba(11,10,8,0) 25%, rgba(11,10,8,0) 55%, rgba(11,10,8,0.8) 88%, var(--ink-900) 100%),
            radial-gradient(120% 90% at 0% 100%, rgba(11,10,8,0.7), rgba(11,10,8,0) 55%);
    }

    &__art-fallback {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        background: var(--ink-950);
        transition: opacity var(--dur-slow) var(--ease-out);
    }

    &--poster-art &__art-fallback {
        justify-content: flex-end;
        padding-right: 6%;
    }

    &__art--blurred {
        position: absolute;
        inset: -40px;
        width: calc(100% + 80px);
        height: calc(100% + 80px);
        object-fit: cover;
        filter: blur(30px) brightness(0.2) saturate(1.2);
        opacity: 0.9;
        z-index: 1;
    }

    &__art--contained {
        position: relative;
        z-index: 2;
        max-width: min(55vw, 460px);
        max-height: 86%;
        width: auto;
        height: auto;
        object-fit: contain;
        object-position: center;
        border-radius: var(--r-md, 8px);
        box-shadow: 0 12px 60px rgba(0, 0, 0, 0.95);
    }

    @media (max-width: 720px) {
        &__art--contained {
            max-width: min(72vw, 300px);
            max-height: 76%;
        }
    }

    &__scrim {
        position: absolute;
        inset: 0;
        background:
            linear-gradient(180deg, rgba(11,10,8,0) 0%, rgba(11,10,8,0) 40%, rgba(11,10,8,0.75) 85%, var(--ink-900) 100%),
            linear-gradient(90deg, rgba(11,10,8,0.85) 0%, rgba(11,10,8,0.45) 45%, rgba(11,10,8,0) 75%);
        pointer-events: none;
    }

    &__bloom {
        position: absolute;
        left: -10%;
        bottom: -30%;
        width: 80%;
        height: 80%;
        background: radial-gradient(closest-side, rgba(var(--ambient, 255 90 31), 0.20), transparent 70%);
        filter: blur(40px);
        pointer-events: none;
    }

    &__grain {
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0.6;
    }

    &__content {
        position: relative;
        z-index: 1;
        padding-block: clamp(var(--s-6), 8vh, var(--s-10));
        padding-inline: var(--s-6);
        max-width: 860px;
    }

    &__eyebrow {
        color: var(--ember);
        display: inline-block;
        margin-bottom: var(--s-3);
    }

    &__title {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: clamp(3rem, 8vw, 6.5rem);
        line-height: 0.96;
        letter-spacing: -0.02em;
        font-variation-settings: 'opsz' 144, 'SOFT' 30;
        color: var(--bone-50);
        margin: 0;
        text-wrap: balance;
        max-width: 18ch;
    }

    &__tagline {
        font-family: var(--font-display);
        font-style: italic;
        font-size: clamp(1.125rem, 1.6vw, 1.5rem);
        color: var(--bone-200);
        margin-top: var(--s-3);
        max-width: 48ch;
    }

    &__meta {
        list-style: none;
        display: flex;
        flex-wrap: wrap;
        gap: var(--s-3);
        margin: var(--s-5) 0 0;
        padding: 0;
        color: var(--bone-200);
        font-size: var(--fs-xs);

        li {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            position: relative;
        }

        li + li::before {
            content: '·';
            color: var(--bone-400);
            margin-right: var(--s-3);
            position: absolute;
            left: calc(-1 * var(--s-3) - 0.2rem);
        }
    }

    &__rating {
        color: var(--gold-leaf);
        svg { color: var(--gold-leaf); }
    }

    &__cert {
        padding: 1px 6px;
        border: 1px solid var(--rule);
        border-radius: 2px;
        color: var(--bone-200);
    }

    &__overview {
        font-size: var(--fs-base);
        line-height: 1.55;
        color: var(--bone-200);
        margin: var(--s-5) 0 0;
        max-width: 52ch;

        @media (max-width: 600px) {
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
    }

    &__actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--s-3);
        margin-top: var(--s-6);
    }

    @media (max-width: 720px) {
        min-height: clamp(460px, 70vh, 680px);
        align-items: flex-end;

        &__content { padding-block: var(--s-6); }
        &__overview { margin-top: var(--s-4); }
        &__actions { margin-top: var(--s-5); }
    }
}

@media (prefers-reduced-motion: reduce) {
    .billboard__backdrop { transition: none; }
}

.billboard__skeleton-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
}

.billboard__skeleton-line {
    background: var(--ink-750);
}

.billboard__skeleton-shimmer {
    position: relative;
    overflow: hidden;
    background: var(--ink-750);

    &::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.04),
            transparent
        );
        transform: translateX(-100%);
        animation: billboard-skeleton-shimmer-anim 1.6s infinite ease-in-out;
    }
}

.billboard__dl-overlay {
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: rgba(4, 5, 8, 0.84);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
}

.billboard__dl-modal {
    position: relative;
    background: linear-gradient(165deg, rgba(20, 22, 30, 0.96) 0%, rgba(10, 11, 16, 0.98) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 20px;
    width: 100%;
    max-width: 400px;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    padding: 20px;
    box-shadow: 0 32px 80px -16px rgba(0, 0, 0, 0.9);

    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 15%;
        right: 15%;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255, 120, 30, 0.8), transparent);
    }
}

.billboard__dl-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
}

.billboard__dl-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--bone-50);
    margin: 0;
}

.billboard__dl-close {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.22s ease;
    flex-shrink: 0;

    &:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.14);
        border-color: rgba(255, 255, 255, 0.25);
        transform: rotate(90deg);
    }
}

.billboard__dl-body {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;

    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); border-radius: 4px; }
    &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.18); border-radius: 4px; }
}

.billboard__dl-opt {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    color: #fff;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;

    &:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 107, 0, 0.4);
    }

    &:active {
        transform: scale(0.98);
    }
}

.billboard__dl-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    font-weight: 800;
    padding: 4px 9px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    color: #e2e2e8;
    border: 1px solid rgba(255, 255, 255, 0.12);
    flex-shrink: 0;
    min-width: 48px;

    &.is-4k {
        background: linear-gradient(135deg, rgba(255, 190, 0, 0.24), rgba(255, 107, 0, 0.24));
        color: #ffd000;
        border-color: rgba(255, 190, 0, 0.45);
        box-shadow: 0 0 16px rgba(255, 190, 0, 0.2);
    }
    &.is-1080 {
        background: rgba(56, 189, 248, 0.18);
        color: #38bdf8;
        border-color: rgba(56, 189, 248, 0.35);
    }
    &.is-720 {
        background: rgba(192, 132, 252, 0.18);
        color: #c084fc;
        border-color: rgba(192, 132, 252, 0.35);
    }
}

.billboard__dl-meta {
    flex: 1;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
}

.billboard__dl-chip {
    font-family: var(--font-mono, monospace);
    font-size: 0.65rem;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.7);
    padding: 1px 5px;
    border-radius: 4px;
}

.billboard__dl-dot {
    color: rgba(255, 255, 255, 0.25);
    flex-shrink: 0;
}

.billboard__dl-size {
    color: #ff9d54;
    font-weight: 700;
    font-size: 0.7rem;
    background: rgba(255, 107, 0, 0.14);
    border: 1px solid rgba(255, 107, 0, 0.25);
    padding: 1px 6px;
    border-radius: 4px;
}
.billboard__dl-size.is-checking {
    color: rgba(255, 255, 255, 0.5);
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
    font-style: italic;
}

.billboard__dl-arrow {
    flex-shrink: 0;
    color: rgba(255, 255, 255, 0.4);
    transition: color 0.2s, transform 0.2s;
}

.billboard__dl-opt:hover .billboard__dl-arrow {
    color: #ff6b00;
    transform: translateY(2px);
}

@media (max-width: 520px) {
    .billboard__dl-overlay {
        padding: 0;
        align-items: flex-end;
    }
    .billboard__dl-modal {
        max-width: 100%;
        max-height: 60vh;
        border-radius: 20px 20px 0 0;
        padding: 16px;
    }
    .billboard__dl-header {
        margin-bottom: 12px;
    }
    .billboard__dl-title {
        font-size: 1rem;
    }
    .billboard__dl-opt {
        padding: 11px 12px;
        gap: 10px;
    }
    .billboard__dl-badge {
        font-size: 0.7rem;
        padding: 3px 8px;
        min-width: 42px;
    }
    .billboard__dl-meta {
        font-size: 0.7rem;
    }
}

@keyframes billboard-skeleton-shimmer-anim {
    100% {
        transform: translateX(100%);
    }
}
</style>
