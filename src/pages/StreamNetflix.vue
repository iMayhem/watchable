<template>
    <div class="nf-stream-page" :class="{ 'nf-stream-page--party-embed': isPartyEmbed }">
        <NetflixPlayer
            :embed-mode="isPartyEmbed ? 'party' : ''"
            :bind-container="bindPlayerContainer"
            :title="title"
            :subtitle="subtitle"
            :loading="loading"
            :art-ready="artReady"
            :playback-error="playbackError"
            :stream-warning="streamWarning"
            :is-playing="isPlaying"
            :current-time="currentTime"
            :duration="duration"
            :progress="progress"
            :buffer-progress="bufferProgress"
            :is-muted="isMuted"
            :streams="resolved?.streams || []"
            :selected-stream-index="selectedStreamIndex"
            :languages="availableLanguages"
            :selected-language="selectedPlaybackLanguage"
            :languages-loading="languagesLoading"
            :switching-audio-label="switchingAudioLabel"
            :switching-episode-label="switchingEpisodeLabel"
            :show-episodes="showEpisodePicker"
            :episode-seasons="episodeSeasons"
            :episode-list="episodeList"
            :current-season="pickerSeason"
            :current-episode="currentEpisode"
            :episodes-loading="episodesLoading"
            @back="goBack"
            @toggle-play="togglePlay"
            @skip-back="skipBack"
            @toggle-mute="toggleMute"
            @seek="seekTo"
            @quality="onQuality"
            @language="onLanguage"
            @language-prefetch="onLanguagePrefetch"
            @episode-select="onEpisodeSelect"
            @episode-prefetch="onEpisodePrefetch"
            @episode-season-change="onEpisodeSeasonChange"
            @episode-previous="onEpisodePrevious"
            @episode-next="onEpisodeNext"
            :up-next-active="upNextActive"
            :up-next-episode="upNextEpisode"
            @up-next-play="onUpNextPlay"
            @up-next-cancel="onUpNextCancel"
            @up-next-complete="onUpNextPlay"
            :show-anime-skips="showAnimeSkips"
            :skip-action-visible="skipActionVisible"
            :skip-action-label="skipActionLabel"
            :auto-skip-enabled="autoSkipEnabled"
            @skip-segment="onSkipSegment"
            @toggle-auto-skip="onToggleAutoSkip"
            party-href=""
            :extension-gate-visible="extensionGateVisible"
            :extension-gate-compact="extensionGateCompact"
            @extension-recheck="onExtensionRecheck"
            @extension-stream-slow="onExtensionStreamSlow"
        />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { NetflixUpNextEpisode } from '../components/player/NetflixUpNext.vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import NetflixPlayer from '../components/player/NetflixPlayer.vue';
import {
    catalogDisplayTitle,
    catalogHasEpisodeGuide,
    fetchMoovieCatalogMetaResolved,
    inferCatalogMediaType,
    parseCatalogTitle
} from '../composables/useMoovieCatalog';
import { prefetchMoovieResolve, useMooviePlayer } from '../composables/useMooviePlayer';
import { useStreamExtension } from '../composables/useStreamExtension';
import { useSeo } from '../composables/useSeo';
import {
    catalogStreamPath,
    catalogStreamTarget,
    explicitLanguageLabels,
    findCatalogueLanguageVariants,
    catalogVariantsByLanguage,
    findCatalogueVariantForLanguage,
    languagesForCatalogueItems,
    playbackLanguageCategoryForItem
} from '../composables/useNetflixCatalogLookup';
import { fetchEnrichmentByCatalogIds } from '../composables/useCatalogEnrichmentCache';
import {
    episodeRowsNeedStillsUpgrade,
    useNetflixCatalogEpisodes
} from '../composables/useNetflixCatalogEpisodes';
import {
    fetchCatalogAudioCacheByIds,
    peekCatalogAudioCache
} from '../composables/useCatalogAudioCache';
import {
    getNetflixLanguage,
    getLanguageOption,
    NETFLIX_LANGUAGES,
    type NetflixLanguageOption
} from '../composables/useNetflixLanguage';
import { useToast } from '../composables/useToast';
import { nfDebug } from '../composables/useNetflixDebug';
import { useNetflixAniskip } from '../composables/useNetflixAniskip';



export default defineComponent({
    name: 'StreamNetflix',
    components: { NetflixPlayer },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const isPartyEmbed = computed(
            () => Boolean(route.meta.partyEmbed) || route.query.embed === 'party'
        );
        const { updateSeo } = useSeo();
        const { language: playbackLanguage, setLanguage: setPlaybackLanguage } =
            getNetflixLanguage();
        const { addToast } = useToast();
        const availableLanguages = ref<NetflixLanguageOption[]>([]);
        const languagesLoading = ref(false);
        const languageVariantPool = ref<import('../composables/useMoovieCatalog').MoovieCatalogItem[]>(
            []
        );
        const languageVariantsByCategory = ref(
            new Map<string, import('../composables/useMoovieCatalog').MoovieCatalogItem>()
        );
        const playingLanguageCategory = ref<string | null>(null);
        const switchingAudioLabel = ref('');
        const switchingEpisodeLabel = ref('');
        const upNextActive = ref(false);
        const upNextDismissed = ref(false);

        const formatEpisodeLabel = (season: number, episode: number) =>
            `S${season} · E${String(episode).padStart(2, '0')}`;
        const { extensionActive, checkExtension, pingExtension } = useStreamExtension();
        const slowStreamChosen = ref(false);
        const extensionGateVisible = computed(() => !extensionActive.value);
        const extensionGateCompact = computed(
            () => !extensionActive.value && slowStreamChosen.value
        );

        const player = useMooviePlayer({ skin: 'netflix' });
        const {
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
            progress,
            bufferProgress,
            isMuted,
            resolveAndPlay,
            switchResolveEntry,
            resetPlaybackSession,
            switchQuality,
            togglePlay,
            pausePlayback,
            seekTo,
            skipBack,
            toggleMute,
            destroyArt,
            playbackEnded
        } = player;

        let started = false;
        let playbackQueued = false;
        const playbackEntryId = ref(String(route.params.id || ''));

        const canStartPlayback = () =>
            extensionActive.value || slowStreamChosen.value;

        const waitForExtensionDetection = async (timeoutMs = 600) => {
            pingExtension();
            checkExtension();
            if (extensionActive.value) return;

            await new Promise<void>((resolve) => {
                const waitStarted = Date.now();
                const timer = window.setInterval(() => {
                    checkExtension();
                    pingExtension();
                    if (extensionActive.value || Date.now() - waitStarted >= timeoutMs) {
                        window.clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        };

        const tryStartPlayback = async () => {
            if (!canStartPlayback()) {
                playbackQueued = true;
                return;
            }
            playbackQueued = false;
            await startPlayback();
        };

        let skipRoutePlayback = false;

        const {
            seasons: episodeSeasons,
            episodes: episodeList,
            loading: episodesLoading,
            supportsEpisodes,
            currentSeason: pickerSeason,
            load: loadEpisodes,
            setSeason: setPickerSeason,
            reset: resetEpisodes
        } = useNetflixCatalogEpisodes();

        const currentSeason = computed(() =>
            parseInt(String(route.params.season || '1'), 10)
        );
        const currentEpisode = computed(() =>
            parseInt(String(route.params.episode || '1'), 10)
        );

        const aniskip = useNetflixAniskip({
            catalogId: playbackEntryId,
            currentSeason,
            currentEpisode,
            episodeSeasons,
            duration,
            currentTime,
            seekTo
        });

        const bindPlayerContainer = (el: HTMLElement | null) => {
            artContainer.value = el;
        };

        const isTvRoute = computed(
            () => route.name === 'StreamNetflixTV' || route.name === 'EmbedNetflixTV'
        );

        const routeMediaType = computed((): 'movie' | 'tv' => {
            if (isTvRoute.value) return 'tv';
            return 'movie';
        });

        const mediaType = computed((): 'movie' | 'tv' => {
            const meta = resolved.value?.meta;
            if (meta?.title) {
                return inferCatalogMediaType(meta);
            }
            return routeMediaType.value;
        });

        const metaHasEpisodeGuide = (
            meta?: {
                title?: string;
                media_type?: string;
                duration?: unknown;
                embed?: string | null;
                subjectid?: string | null;
                embed_en?: string | null;
                season?: unknown;
            } | null
        ) =>
            Boolean(
                meta?.title && catalogHasEpisodeGuide(meta, routeMediaType.value)
            );

        const showEpisodePicker = computed(() => {
            if (isTvRoute.value) return true;
            if (supportsEpisodes.value) return true;
            return metaHasEpisodeGuide(resolved.value?.meta);
        });

        const streamType = computed((): 'movie' | 'tv' => {
            if (showEpisodePicker.value) return 'tv';
            return 'movie';
        });

        const parsedMeta = computed(() => {
            const raw = resolved.value?.meta?.title || '';
            return parseCatalogTitle(raw);
        });

        const title = computed(
            () => catalogDisplayTitle(resolved.value?.meta?.title || '') || 'Now playing'
        );

        const subtitle = computed(() => {
            const parts: string[] = [];
            if (parsedMeta.value.languages.length) {
                parts.push(parsedMeta.value.languages.join(' · '));
            }
            if (showEpisodePicker.value) {
                const season = parseInt(String(route.params.season || '1'), 10);
                const episode = parseInt(String(route.params.episode || '1'), 10);
                parts.push(`S${season} · E${episode}`);
            }
            return parts.join(' · ');
        });

        const resolveUrl = computed(() => {
            const params = new URLSearchParams({
                action: 'resolve',
                type: streamType.value,
                id: playbackEntryId.value,
                se: String(
                    streamType.value === 'tv' ? route.params.season || '1' : '0'
                ),
                ep: String(
                    streamType.value === 'tv' ? route.params.episode || '1' : '0'
                ),
                server: '1'
            });
            return `/api/moovie-catalog?${params.toString()}`;
        });

        const teardown = () => {
            destroyArt();
        };

        const scheduleTeardown = () => {
            // Let the cached detail/home route paint first, then drop the player.
            queueMicrotask(() => teardown());
        };

        const goBack = () => {
            if (isPartyEmbed.value) return;
            nfDebug('stream:back', { id: route.params.id, type: mediaType.value });
            const fallback = `/nf/${mediaType.value}/${playbackEntryId.value}`;
            if (window.history.length > 1) {
                router.back();
                scheduleTeardown();
                return;
            }
            router.replace(fallback);
            scheduleTeardown();
        };

        const languageOptionsFromLabels = (labels: string[]): NetflixLanguageOption[] =>
            labels
                .map((label) => NETFLIX_LANGUAGES.find((row) => row.label === label))
                .filter((row): row is NetflixLanguageOption => Boolean(row));

        const selectedPlaybackLanguage = computed(
            () => playingLanguageCategory.value || playbackLanguage.value
        );

        const seedPlayingLanguageOption = (catalogTitle: string, channel?: string) => {
            const category = playbackLanguageCategoryForItem({
                title: catalogTitle,
                media_type: mediaType.value,
                channel
            });
            if (!category) return;

            playingLanguageCategory.value = category;
            const option = getLanguageOption(category);
            if (
                !availableLanguages.value.some((row) => row.category === option.category)
            ) {
                availableLanguages.value = [option, ...availableLanguages.value];
            }
        };

        const syncPlayingLanguageFromTitle = (
            catalogTitle: string,
            channel?: string
        ) => {
            seedPlayingLanguageOption(catalogTitle, channel);
        };

        const seedLanguagesFromTitle = (catalogTitle: string, catalogId?: string) => {
            const cached = catalogId ? peekCatalogAudioCache(catalogId) : undefined;
            if (cached?.length) {
                const seeded = languageOptionsFromLabels(cached);
                if (seeded.length) {
                    availableLanguages.value = seeded;
                    return;
                }
            }

            const labels = explicitLanguageLabels({
                title: catalogTitle,
                media_type: mediaType.value
            } as any);
            const seeded = languageOptionsFromLabels(labels);
            if (seeded.length) {
                availableLanguages.value = seeded;
            }
        };

        const syncLanguageVariantPool = (
            variants: import('../composables/useMoovieCatalog').MoovieCatalogItem[],
            anchorTitle?: string
        ) => {
            languageVariantPool.value = variants;
            const anchor = anchorTitle
                ? { title: anchorTitle, media_type: mediaType.value }
                : undefined;
            languageVariantsByCategory.value = catalogVariantsByLanguage(variants, anchor);
            prefetchLanguageResolves(languageVariantsByCategory.value);
        };

        const prefetchLanguageResolves = (
            variantMap: Map<string, import('../composables/useMoovieCatalog').MoovieCatalogItem>
        ) => {
            if (!variantMap.size) return;
            const season = currentSeason.value;
            const episode = currentEpisode.value;
            const supportsEpisodes = showEpisodePicker.value;

            for (const item of variantMap.values()) {
                const target = catalogStreamTarget(item, {
                    supportsEpisodes,
                    season,
                    episode
                });
                prefetchMoovieResolve({
                    type: target.mediaType,
                    id: String(item.id),
                    season: target.season,
                    episode: target.episode
                });
            }
        };

        const loadAvailableLanguages = async (
            displayTitle: string,
            anchorTitle?: string,
            catalogId?: string
        ) => {
            if (catalogId) {
                const cache = await fetchCatalogAudioCacheByIds([catalogId]);
                const cached = cache.get(String(catalogId));
                if (cached?.length) {
                    const seeded = languageOptionsFromLabels(cached);
                    if (seeded.length) {
                        availableLanguages.value = seeded;
                    }
                }
            }

            const anchor = anchorTitle
                ? { title: anchorTitle, media_type: mediaType.value }
                : undefined;
            const variants = await findCatalogueLanguageVariants(displayTitle, {
                anchor,
                maxPages: 3
            });
            if (variants.length) {
                syncLanguageVariantPool(variants, anchorTitle);
            }
            const anchorItem = anchor
                ? ({ title: anchorTitle, media_type: mediaType.value } as const)
                : undefined;
            const resolved = languagesForCatalogueItems(variants, anchorItem as any);
            if (resolved.length) {
                availableLanguages.value = resolved;
                return;
            }

            if (anchorTitle) {
                seedLanguagesFromTitle(anchorTitle, catalogId);
            }
        };

        const streamPathForEmbed = (path: string) => {
            if (!isPartyEmbed.value) return path;
            return path.replace(/^\/stream\/nf\//, '/embed/nf/');
        };

        const ensureCanonicalStreamRoute = async (): Promise<boolean> => {
            const id = String(route.params.id || '');
            if (!id) return true;
            if (isPartyEmbed.value) return true;

            try {
                const meta = await fetchMoovieCatalogMetaResolved(
                    routeMediaType.value,
                    id
                );
                const season = parseInt(String(route.params.season || '1'), 10);
                const episode = parseInt(String(route.params.episode || '1'), 10);

                const target = catalogStreamTarget(
                    {
                        id,
                        title: meta.title,
                        media_type: meta.media_type,
                        duration: meta.duration,
                        embed: meta.embed,
                        subjectid: meta.subjectid,
                        embed_en: meta.embed_en,
                        season: meta.season
                    },
                    {
                        season,
                        episode,
                        supportsEpisodes:
                            catalogHasEpisodeGuide(meta, routeMediaType.value) ||
                            isTvRoute.value
                    }
                );

                const targetPath = streamPathForEmbed(target.path);
                if (route.path !== targetPath) {
                    nfDebug('stream:canonical-route', { from: route.path, to: targetPath });
                    playbackEntryId.value = id;
                    skipRoutePlayback = true;
                    await router.replace({ path: targetPath, query: { ...route.query } });
                    await tryStartPlayback();
                    return false;
                }
            } catch (err) {
                nfDebug('stream:canonical-route:skip', { id, err });
            }

            return true;
        };

        const syncBrowserUrl = (path: string) => {
            if (route.path === path) return;
            window.history.replaceState(window.history.state, '', path);
        };

        const playbackTypeForId = (
            _id: string,
            meta?: {
                title?: string;
                media_type?: string;
                duration?: unknown;
                embed?: string | null;
                subjectid?: string | null;
                embed_en?: string | null;
                season?: unknown;
            } | null
        ): 'movie' | 'tv' => {
            if (isTvRoute.value) return 'tv';
            if (meta?.title) {
                if (!catalogHasEpisodeGuide(meta, routeMediaType.value)) {
                    return 'movie';
                }
                return inferCatalogMediaType(meta);
            }
            return routeMediaType.value === 'tv' ? 'tv' : 'movie';
        };

        type EpisodeCatalogMeta = {
            title?: string;
            media_type?: string;
            release_date?: string;
            duration?: unknown;
            embed?: string | null;
            subjectid?: string | null;
            embed_en?: string | null;
            season?: unknown;
        };

        let episodeCatalogLoadId = '';

        const shouldLoadEpisodeCatalog = (
            playbackType: 'movie' | 'tv',
            meta?: EpisodeCatalogMeta | null
        ) => {
            if (!meta?.title) return false;
            return (
                playbackType === 'tv' ||
                isTvRoute.value ||
                catalogHasEpisodeGuide(meta, routeMediaType.value)
            );
        };

        const kickoffEpisodeCatalog = async (
            id: string,
            meta: EpisodeCatalogMeta,
            playbackType: 'movie' | 'tv',
            playbackSeason: number
        ) => {
            if (!shouldLoadEpisodeCatalog(playbackType, meta)) return;
            if (episodesLoading.value && episodeCatalogLoadId === id) return;
            if (
                episodeCatalogLoadId === id &&
                episodeList.value.length &&
                !episodeRowsNeedStillsUpgrade(episodeList.value)
            ) {
                return;
            }

            let tmdbId: number | undefined;
            try {
                const enrichment = await fetchEnrichmentByCatalogIds([id]);
                const row = enrichment.get(id);
                if (row?.tmdb_id && Number.isFinite(row.tmdb_id)) {
                    tmdbId = row.tmdb_id;
                }
            } catch {
                /* optional TMDB hint */
            }

            episodeCatalogLoadId = id;
            void loadEpisodes(
                {
                    id,
                    title: meta.title || '',
                    release_date: meta.release_date,
                    media_type:
                        meta.media_type === 'tv'
                            ? 'tv'
                            : meta.media_type === 'movie'
                              ? 'movie'
                              : playbackType,
                    duration: meta.duration as
                        | string
                        | number
                        | null
                        | undefined,
                    embed: meta.embed,
                    subjectid: meta.subjectid,
                    embed_en: meta.embed_en,
                    season: meta.season
                },
                {
                    season: playbackSeason,
                    routeType:
                        playbackType === 'tv' || isTvRoute.value ? 'tv' : 'movie',
                    tmdbId
                }
            );
        };

        const hydratePlaybackSidecars = async (
            id: string,
            catalogMeta: {
                title?: string;
                channel?: string;
                media_type?: string;
                release_date?: string;
                duration?: unknown;
                embed?: string | null;
                subjectid?: string | null;
                embed_en?: string | null;
                season?: unknown;
            },
            _type: 'movie' | 'tv',
            _season: number
        ) => {
            if (catalogMeta.title) {
                syncPlayingLanguageFromTitle(
                    catalogMeta.title,
                    catalogMeta.channel
                );
                seedLanguagesFromTitle(catalogMeta.title, id);
            }

            const parsed = parseCatalogTitle(catalogMeta.title || '');
            if (parsed.displayTitle && catalogMeta.title) {
                await loadAvailableLanguages(
                    parsed.displayTitle,
                    catalogMeta.title,
                    id
                );
            }
        };

        const startPlayback = async () => {
            const id = playbackEntryId.value;
            if (!id) return;

            episodeCatalogLoadId = '';
            resetEpisodes();

            const routeSeason = parseInt(String(route.params.season || '1'), 10);
            const routeEpisode = parseInt(String(route.params.episode || '1'), 10);

            let catalogMeta: {
                title?: string;
                media_type?: string;
                channel?: string;
                release_date?: string;
                duration?: unknown;
                embed?: string | null;
                subjectid?: string | null;
                embed_en?: string | null;
                season?: unknown;
            } | null = null;

            try {
                catalogMeta = await fetchMoovieCatalogMetaResolved(
                    routeMediaType.value,
                    id
                );
            } catch {
                /* resolve with route hints */
            }

            const target = catalogMeta?.title
                ? catalogStreamTarget(
                      {
                          id,
                          title: catalogMeta.title,
                          media_type: catalogMeta.media_type,
                          duration: catalogMeta.duration,
                          embed: catalogMeta.embed,
                          subjectid: catalogMeta.subjectid,
                          embed_en: catalogMeta.embed_en,
                          season: catalogMeta.season
                      },
                      {
                          season: routeSeason,
                          episode: routeEpisode,
                          supportsEpisodes:
                              catalogHasEpisodeGuide(
                                  catalogMeta,
                                  routeMediaType.value
                              ) || isTvRoute.value
                      }
                  )
                : null;

            const type =
                target?.mediaType ??
                playbackTypeForId(id, catalogMeta);
            const season =
                target?.season ??
                (type === 'tv' ? routeSeason : 0);
            const episode =
                target?.episode ??
                (type === 'tv' ? routeEpisode : 0);

            nfDebug('stream:playback:start', { id, type, season, episode });

            if (catalogMeta?.title) {
                void kickoffEpisodeCatalog(id, catalogMeta, type, season);
            }

            try {
                // Resolve streams first — languages/episodes must not block playback.
                await resolveAndPlay({ type, id, season, episode });

                const meta = resolved.value?.meta;
                const sidecarMeta = meta?.title
                    ? meta
                    : catalogMeta;
                if (!sidecarMeta?.title) return;

                const episodeMeta: EpisodeCatalogMeta = {
                    title: sidecarMeta.title,
                    media_type: sidecarMeta.media_type ?? catalogMeta?.media_type,
                    release_date: catalogMeta?.release_date || '',
                    duration: catalogMeta?.duration,
                    embed: catalogMeta?.embed,
                    subjectid: sidecarMeta.subjectid ?? catalogMeta?.subjectid,
                    embed_en: catalogMeta?.embed_en,
                    season: catalogMeta?.season
                };

                if (
                    episodeCatalogLoadId !== id ||
                    (!episodesLoading.value &&
                        episodeRowsNeedStillsUpgrade(episodeList.value))
                ) {
                    void kickoffEpisodeCatalog(id, episodeMeta, type, season);
                }

                languagesLoading.value = true;
                try {
                    await hydratePlaybackSidecars(
                        id,
                        {
                            title: episodeMeta.title,
                            media_type: episodeMeta.media_type,
                            channel: catalogMeta?.channel,
                            release_date: episodeMeta.release_date,
                            duration: episodeMeta.duration,
                            embed: episodeMeta.embed,
                            subjectid: episodeMeta.subjectid,
                            embed_en: episodeMeta.embed_en,
                            season: episodeMeta.season
                        },
                        type,
                        season
                    );
                } finally {
                    languagesLoading.value = false;
                }
            } catch (err) {
                nfDebug('stream:playback:fail', { id, err });
            }
        };

        const onQuality = (index: number) => {
            nfDebug('stream:quality', { index });
            switchQuality(index, resolveUrl.value);
        };

        const prefetchEpisodeResolve = (season: number, episode: number) => {
            const id = playbackEntryId.value;
            if (!id || !showEpisodePicker.value || episode < 1) return;
            prefetchMoovieResolve({
                type: playbackTypeForId(id, resolved.value?.meta),
                id,
                season,
                episode
            });
        };

        const prefetchAdjacentEpisodes = () => {
            if (!showEpisodePicker.value) return;

            const season = currentSeason.value;
            const episode = currentEpisode.value;
            if (episode > 1) {
                prefetchEpisodeResolve(season, episode - 1);
            }
            prefetchEpisodeResolve(season, episode + 1);

            const max = episodeList.value.length
                ? Math.max(...episodeList.value.map((ep) => ep.episode_number))
                : 0;
            if (max && episode >= max && nextSeasonNumber.value) {
                prefetchEpisodeResolve(nextSeasonNumber.value, 1);
            }
        };

        const onEpisodePrefetch = (episode: number) => {
            prefetchEpisodeResolve(pickerSeason.value, episode);
        };

        const switchEpisode = async (season: number, episode: number) => {
            const id = playbackEntryId.value;
            if (!id || !showEpisodePicker.value || switchingEpisodeLabel.value) return;
            if (season === currentSeason.value && episode === currentEpisode.value) return;

            nfDebug('stream:episode:switch', { id, season, episode });
            dismissUpNext();
            switchingEpisodeLabel.value = formatEpisodeLabel(season, episode);

            try {
                await switchResolveEntry(
                    {
                        type: playbackTypeForId(id, resolved.value?.meta),
                        id,
                        season,
                        episode
                    },
                    { resumeAt: 0, resumePlaying: true }
                );

                const path = streamPathForEmbed(catalogStreamPath(id, season, episode));
                skipRoutePlayback = true;
                syncBrowserUrl(path);
                void router.replace({ path, query: { ...route.query } });
                if (pickerSeason.value !== season) {
                    void setPickerSeason(season);
                }
                prefetchAdjacentEpisodes();
            } catch (err: any) {
                if (err?.name === 'ResolveAborted') return;
                nfDebug('stream:episode:fail', { id, season, episode, err });
                addToast(err?.message || 'Could not switch episode.', 'warning');
            } finally {
                switchingEpisodeLabel.value = '';
            }
        };

        const onEpisodeSelect = (episode: number) => {
            switchEpisode(pickerSeason.value, episode);
        };

        const onEpisodeSeasonChange = async (season: number) => {
            await setPickerSeason(season);
        };

        const onEpisodePrevious = () => {
            if (currentEpisode.value > 1) {
                switchEpisode(currentSeason.value, currentEpisode.value - 1);
            }
        };

        const nextSeasonNumber = computed(() => {
            const next = episodeSeasons.value.find(
                (row) => row.season_number === currentSeason.value + 1
            );
            return next?.season_number ?? 0;
        });

        const nextEpisodeTarget = computed((): { season: number; episode: number } | null => {
            if (!showEpisodePicker.value || !episodeList.value.length) return null;

            const max = Math.max(...episodeList.value.map((ep) => ep.episode_number));
            if (currentEpisode.value < max) {
                return {
                    season: currentSeason.value,
                    episode: currentEpisode.value + 1
                };
            }
            if (nextSeasonNumber.value) {
                return { season: nextSeasonNumber.value, episode: 1 };
            }
            return null;
        });

        const upNextEpisode = computed((): NetflixUpNextEpisode | null => {
            const target = nextEpisodeTarget.value;
            if (!target) return null;

            const code = `S${target.season} · E${String(target.episode).padStart(2, '0')}`;
            if (target.season === currentSeason.value) {
                const row = episodeList.value.find(
                    (ep) => ep.episode_number === target.episode
                );
                return {
                    season: target.season,
                    episode: target.episode,
                    code,
                    name: row?.name || `Episode ${target.episode}`,
                    still_path: row?.still_path
                };
            }

            return {
                season: target.season,
                episode: target.episode,
                code,
                name: `Episode ${target.episode}`
            };
        });

        const dismissUpNext = () => {
            upNextActive.value = false;
            upNextDismissed.value = true;
        };

        const onUpNextCancel = () => {
            dismissUpNext();
        };

        const onUpNextPlay = async () => {
            const target = nextEpisodeTarget.value;
            dismissUpNext();
            if (!target) return;
            await switchEpisode(target.season, target.episode);
        };

        const onEpisodeNext = () => {
            const target = nextEpisodeTarget.value;
            if (!target) return;
            switchEpisode(target.season, target.episode);
        };

        const resolveLanguageVariant = async (
            category: string,
            displayTitle: string,
            currentTitle: string
        ) => {
            const cached = languageVariantsByCategory.value.get(category);
            if (cached) return cached;

            const lang = getLanguageOption(category);
            return findCatalogueVariantForLanguage(displayTitle, lang, {
                excludeId: String(route.params.id || ''),
                mediaType: mediaType.value,
                anchorTitle: currentTitle,
                maxPages: 2,
                knownVariants: languageVariantPool.value
            });
        };

        const onLanguagePrefetch = (category: string) => {
            if (category === selectedPlaybackLanguage.value) return;
            const variant = languageVariantsByCategory.value.get(category);
            if (!variant) return;

            const target = catalogStreamTarget(variant, {
                supportsEpisodes: showEpisodePicker.value,
                season: currentSeason.value,
                episode: currentEpisode.value
            });
            prefetchMoovieResolve({
                type: target.mediaType,
                id: String(variant.id),
                season: target.season,
                episode: target.episode
            });
        };

        const onLanguage = async (category: string) => {
            if (
                category === selectedPlaybackLanguage.value ||
                switchingAudioLabel.value
            ) {
                return;
            }

            const lang = getLanguageOption(category);
            const currentTitle = resolved.value?.meta?.title || title.value;
            const parsed = parseCatalogTitle(currentTitle);
            const displayTitle = parsed.displayTitle || currentTitle;
            const resumeAt = currentTime.value;
            const resumePlaying = isPlaying.value;

            switchingAudioLabel.value = lang.label;
            pausePlayback();

            nfDebug('stream:language', { category, displayTitle, resumeAt, resumePlaying });

            try {
                const variant = await resolveLanguageVariant(
                    category,
                    displayTitle,
                    currentTitle
                );

                if (!variant) {
                    addToast(
                        `${lang.label} audio is not available for this title.`,
                        'warning'
                    );
                    return;
                }

                const target = catalogStreamTarget(variant, {
                    supportsEpisodes: showEpisodePicker.value,
                    season: currentSeason.value,
                    episode: currentEpisode.value
                });
                playbackEntryId.value = String(variant.id);
                await switchResolveEntry(
                    {
                        type: target.mediaType,
                        id: String(variant.id),
                        season: target.season,
                        episode: target.episode
                    },
                    { resumeAt, resumePlaying }
                );

                playingLanguageCategory.value = category;
                setPlaybackLanguage(category);
                syncBrowserUrl(target.path);

                if (parsed.displayTitle) {
                    void loadAvailableLanguages(
                        parsed.displayTitle,
                        resolved.value?.meta?.title || currentTitle,
                        playbackEntryId.value
                    );
                }
            } catch (err: any) {
                playbackEntryId.value = String(route.params.id || playbackEntryId.value);
                nfDebug('stream:language:fail', { category, err });
                addToast(
                    err?.message || `Could not switch to ${lang.label} audio.`,
                    'warning'
                );
            } finally {
                switchingAudioLabel.value = '';
            }
        };

        onBeforeRouteLeave((to) => {
            if (isPartyEmbed.value && to.meta?.partyEmbed) return;
            scheduleTeardown();
        });

        const onExtensionRecheck = async () => {
            nfDebug('stream:extension-gate:recheck');
            pingExtension();
            checkExtension();
            if (!extensionActive.value) {
                addToast(
                    'Extension not detected yet. Install it, set access to moovie.fun, then hard-refresh.',
                    'warning'
                );
                return;
            }
            slowStreamChosen.value = false;
            await tryStartPlayback();
        };

        const onExtensionStreamSlow = async () => {
            nfDebug('stream:extension-gate:slow-server');
            slowStreamChosen.value = true;
            playbackQueued = false;
            await startPlayback();
        };

        onMounted(async () => {
            if (isPartyEmbed.value) {
                document.documentElement.classList.add('nf-party-embed');
            }
            playbackEntryId.value = String(route.params.id || playbackEntryId.value);
            nfDebug('stream:mount', { path: route.path, id: playbackEntryId.value });
            updateSeo({
                title: 'Watch — Netflix on Moovie',
                canonical: `https://moovie.fun${route.path}`,
                image: 'https://moovie.fun/og-image.png'
            });
            await waitForExtensionDetection();
            if (!started) {
                started = true;
                const shouldStart = await ensureCanonicalStreamRoute();
                if (shouldStart) {
                    await tryStartPlayback();
                }
            }
        });

        onBeforeUnmount(() => {
            document.documentElement.classList.remove('nf-party-embed');
            teardown();
        });

        watch(
            () => [currentSeason.value, currentEpisode.value],
            () => {
                upNextDismissed.value = false;
                upNextActive.value = false;
            }
        );

        watch(
            () => artReady.value && Boolean(resolved.value?.streams?.length),
            (ready) => {
                if (ready) prefetchAdjacentEpisodes();
            }
        );

        watch(playbackEnded, (ended) => {
            if (
                !ended ||
                !showEpisodePicker.value ||
                !nextEpisodeTarget.value ||
                upNextDismissed.value ||
                switchingAudioLabel.value ||
                switchingEpisodeLabel.value
            ) {
                return;
            }
            upNextActive.value = true;
        });

        watch(
            () => resolved.value?.meta?.title,
            (catalogTitle) => {
                if (catalogTitle) {
                    syncPlayingLanguageFromTitle(catalogTitle);
                }
            }
        );

        watch(extensionActive, async (active) => {
            if (!active || !playbackQueued) return;
            nfDebug('stream:extension-gate:detected');
            await tryStartPlayback();
        });

        watch(
            () => [route.params.id, route.params.season, route.params.episode],
            async ([id, season, episode], prev) => {
                if (skipRoutePlayback) {
                    skipRoutePlayback = false;
                    nfDebug('stream:route-change:skip', { id, season, episode });
                    const skippedSeason = parseInt(String(season || '1'), 10);
                    if (skippedSeason !== pickerSeason.value) {
                        void setPickerSeason(skippedSeason);
                    }
                    return;
                }
                if (!id) return;

                const idChanged = id !== prev?.[0];
                const seasonChanged = season !== prev?.[1];
                const episodeChanged = episode !== prev?.[2];
                if (!idChanged && !seasonChanged && !episodeChanged) return;

                slowStreamChosen.value = false;
                playbackEntryId.value = String(id);
                nfDebug('stream:route-change', { id, season, episode, idChanged, seasonChanged, episodeChanged });

                if (idChanged) {
                    resetPlaybackSession();
                    availableLanguages.value = [];
                    await tryStartPlayback();
                    return;
                }

                if (!showEpisodePicker.value) return;

                const nextSeason = parseInt(String(season || '1'), 10);
                const nextEpisode = parseInt(String(episode || '1'), 10);

                if (!canStartPlayback()) {
                    playbackQueued = true;
                    resetPlaybackSession();
                    if (seasonChanged) {
                        await setPickerSeason(nextSeason);
                    }
                    return;
                }

                const type = playbackTypeForId(String(id), resolved.value?.meta);

                try {
                    await switchResolveEntry(
                        {
                            type,
                            id: String(id),
                            season: nextSeason,
                            episode: nextEpisode
                        },
                        { resumeAt: 0, resumePlaying: true }
                    );
                } catch (err: any) {
                    if (err?.name === 'ResolveAborted') return;
                    nfDebug('stream:route-episode:fail', { id, season, episode, err });
                    addToast(err?.message || 'Could not switch episode.', 'warning');
                }

                if (seasonChanged) {
                    await setPickerSeason(nextSeason);
                }
            }
        );

        return {
            isPartyEmbed,
            bindPlayerContainer,
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
            progress,
            bufferProgress,
            isMuted,
            title,
            subtitle,
            goBack,
            togglePlay,
            seekTo,
            skipBack,
            toggleMute,
            onQuality,
            onLanguage,
            onLanguagePrefetch,
            availableLanguages,
            languagesLoading,
            selectedPlaybackLanguage,
            playbackLanguage,
            switchingAudioLabel,
            switchingEpisodeLabel,
            mediaType,
            showEpisodePicker,
            supportsEpisodes,
            episodeSeasons,
            episodeList,
            pickerSeason,
            currentSeason,
            currentEpisode,
            episodesLoading,
            onEpisodeSelect,
            onEpisodePrefetch,
            onEpisodeSeasonChange,
            onEpisodePrevious,
            onEpisodeNext,
            upNextActive,
            upNextEpisode,
            onUpNextPlay,
            onUpNextCancel,
            showAnimeSkips: aniskip.isAnime,
            skipActionVisible: aniskip.skipActionVisible,
            skipActionLabel: aniskip.skipActionLabel,
            autoSkipEnabled: aniskip.autoSkip,
            onSkipSegment: aniskip.onSkipSegment,
            onToggleAutoSkip: aniskip.toggleAutoSkip,
            extensionGateVisible,
            extensionGateCompact,
            onExtensionRecheck,
            onExtensionStreamSlow
        };
    }
});
</script>

<style lang="scss" scoped>
.nf-stream-page {
    min-height: 100dvh;
    background: #000;

    &--party-embed {
        height: 100%;
        min-height: 0;
    }
}
</style>