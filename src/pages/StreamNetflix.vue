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
            :show-episodes="supportsEpisodes"
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
            @episode-select="onEpisodeSelect"
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
            :party-href="isPartyEmbed ? '' : partyHref"
        />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { NetflixUpNextEpisode } from '../components/player/NetflixUpNext.vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import NetflixPlayer from '../components/player/NetflixPlayer.vue';
import {
    fetchMoovieCatalogMeta,
    fetchMoovieCatalogMetaResolved,
    inferCatalogMediaType,
    parseCatalogTitle
} from '../composables/useMoovieCatalog';
import { useMooviePlayer } from '../composables/useMooviePlayer';
import { useSeo } from '../composables/useSeo';
import {
    catalogStreamPath,
    catalogStreamTarget,
    explicitLanguageLabels,
    findCatalogueLanguageVariants,
    findCatalogueVariantForLanguage,
    languagesForCatalogueItems,
    playbackLanguageCategoryForItem
} from '../composables/useNetflixCatalogLookup';
import { useNetflixCatalogEpisodes } from '../composables/useNetflixCatalogEpisodes';
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
import { buildStreamPartyHref } from '../utils/partyRoom';


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
        const playingLanguageCategory = ref<string | null>(null);
        const switchingAudioLabel = ref('');
        const switchingEpisodeLabel = ref('');
        const upNextActive = ref(false);
        const upNextDismissed = ref(false);

        const formatEpisodeLabel = (season: number, episode: number) =>
            `S${season} · E${String(episode).padStart(2, '0')}`;
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
        const playbackEntryId = ref(String(route.params.id || ''));

        let skipRoutePlayback = false;

        const {
            seasons: episodeSeasons,
            episodes: episodeList,
            loading: episodesLoading,
            supportsEpisodes,
            currentSeason: pickerSeason,
            load: loadEpisodes,
            setSeason: setPickerSeason
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

        const streamType = computed((): 'movie' | 'tv' => {
            if (supportsEpisodes.value || isTvRoute.value) {
                return 'tv';
            }
            return mediaType.value;
        });

        const parsedMeta = computed(() => {
            const raw = resolved.value?.meta?.title || '';
            return parseCatalogTitle(raw);
        });

        const title = computed(() => parsedMeta.value.displayTitle || 'Now playing');

        const subtitle = computed(() => {
            const parts: string[] = [];
            if (parsedMeta.value.languages.length) {
                parts.push(parsedMeta.value.languages.join(' · '));
            }
            if (supportsEpisodes.value || isTvRoute.value) {
                const season = parseInt(String(route.params.season || '1'), 10);
                const episode = parseInt(String(route.params.episode || '1'), 10);
                parts.push(`S${season} · E${episode}`);
            }
            return parts.join('  ·  ');
        });

        const partyHref = computed(() => {
            const id = playbackEntryId.value;
            if (!id) return '';

            const season = currentSeason.value;
            const episode = currentEpisode.value;
            const isTv = supportsEpisodes.value || isTvRoute.value;
            const partyTitle = isTv
                ? `${title.value} - S${season}E${episode}`
                : title.value;

            return buildStreamPartyHref({
                id,
                title: partyTitle,
                type: isTv ? 'tv' : 'movie',
                season,
                episode,
                source: 'netflix'
            });
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
            const variants = await findCatalogueLanguageVariants(displayTitle, { anchor });
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
                const meta = await fetchMoovieCatalogMeta(routeMediaType.value, id);
                const season = parseInt(String(route.params.season || '1'), 10);
                const episode = parseInt(String(route.params.episode || '1'), 10);

                await loadEpisodes(
                    {
                        id,
                        title: meta.title || '',
                        release_date: meta.release_date,
                        media_type: meta.media_type
                    },
                    { season }
                );

                const target = catalogStreamTarget(
                    {
                        id,
                        title: meta.title,
                        media_type: meta.media_type
                    },
                    {
                        supportsEpisodes: supportsEpisodes.value,
                        season,
                        episode
                    }
                );

                const targetPath = streamPathForEmbed(target.path);
                if (route.path !== targetPath) {
                    nfDebug('stream:canonical-route', { from: route.path, to: targetPath });
                    playbackEntryId.value = id;
                    skipRoutePlayback = true;
                    await router.replace({ path: targetPath, query: { ...route.query } });
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
            id: string,
            meta?: { title?: string; media_type?: string } | null
        ): 'movie' | 'tv' => {
            if (meta?.title && String(resolved.value?.meta?.id || '') === String(id)) {
                return inferCatalogMediaType(meta);
            }
            if (meta?.title) {
                return inferCatalogMediaType(meta);
            }
            return routeMediaType.value;
        };

        const startPlayback = async () => {
            const id = playbackEntryId.value;
            if (!id) return;

            languagesLoading.value = true;
            let catalogMeta: {
                title?: string;
                channel?: string;
                media_type?: string;
                release_date?: string;
            } | null = null;

            try {
                const [meta, cache] = await Promise.all([
                    fetchMoovieCatalogMetaResolved(routeMediaType.value, id),
                    fetchCatalogAudioCacheByIds([id])
                ]);
                catalogMeta = meta;

                const type = playbackTypeForId(id, catalogMeta);
                const season =
                    type === 'tv'
                        ? parseInt(String(route.params.season || '1'), 10)
                        : 0;
                const episode =
                    type === 'tv'
                        ? parseInt(String(route.params.episode || '1'), 10)
                        : 0;

                nfDebug('stream:playback:start', { id, type, season, episode });

                if (catalogMeta) {
                    syncPlayingLanguageFromTitle(
                        catalogMeta.title || '',
                        catalogMeta.channel
                    );
                    seedLanguagesFromTitle(catalogMeta.title || '', id);
                }

                const cached = cache.get(String(id));
                if (cached?.length) {
                    const seeded = languageOptionsFromLabels(cached);
                    if (seeded.length) availableLanguages.value = seeded;
                }

                const parsed = parseCatalogTitle(catalogMeta?.title || '');
                const languageLoadPromise =
                    parsed.displayTitle && catalogMeta?.title
                        ? loadAvailableLanguages(
                              parsed.displayTitle,
                              catalogMeta.title,
                              id
                          )
                        : Promise.resolve();

                const episodesPromise = catalogMeta
                    ? loadEpisodes(
                          {
                              id,
                              title: catalogMeta.title || '',
                              release_date: catalogMeta.release_date,
                              media_type: type
                          },
                          { season }
                      )
                    : Promise.resolve();

                await Promise.all([
                    resolveAndPlay({ type, id, season, episode }),
                    languageLoadPromise,
                    episodesPromise
                ]);

                const title = resolved.value?.meta?.title || catalogMeta?.title || '';
                if (title) {
                    syncPlayingLanguageFromTitle(title, catalogMeta?.channel);
                }
            } catch (err) {
                nfDebug('stream:playback:fail', { id, err });
            } finally {
                languagesLoading.value = false;
            }
        };

        const onQuality = (index: number) => {
            nfDebug('stream:quality', { index });
            switchQuality(index, resolveUrl.value);
        };

        const refreshEpisodeCatalog = async () => {
            const meta = resolved.value?.meta;
            if (!meta?.title) return;
            await loadEpisodes(
                {
                    id: playbackEntryId.value,
                    title: meta.title,
                    media_type:
                        meta.media_type === 'tv' || meta.media_type === 'movie'
                            ? meta.media_type
                            : mediaType.value
                },
                { season: currentSeason.value }
            );
        };

        const switchEpisode = async (season: number, episode: number) => {
            const id = playbackEntryId.value;
            if (!id || !supportsEpisodes.value || switchingEpisodeLabel.value) return;

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
                await router.replace({ path, query: { ...route.query } });
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
            if (!supportsEpisodes.value || !episodeList.value.length) return null;

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
                const variant = await findCatalogueVariantForLanguage(displayTitle, lang, {
                    excludeId: String(route.params.id || ''),
                    mediaType: mediaType.value,
                    anchorTitle: currentTitle
                });

                if (!variant) {
                    addToast(
                        `${lang.label} audio is not available for this title.`,
                        'warning'
                    );
                    return;
                }

                const target = catalogStreamTarget(variant);
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
                    languagesLoading.value = true;
                    try {
                        await loadAvailableLanguages(
                            parsed.displayTitle,
                            resolved.value?.meta?.title || currentTitle,
                            playbackEntryId.value
                        );
                    } finally {
                        languagesLoading.value = false;
                    }
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
            if (!started) {
                started = true;
                await ensureCanonicalStreamRoute();
                await startPlayback();
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

        watch(playbackEnded, (ended) => {
            if (
                !ended ||
                !supportsEpisodes.value ||
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
                void refreshEpisodeCatalog();
            }
        );

        watch(
            () => [route.params.id, route.params.season, route.params.episode],
            async ([id, season, episode], prev) => {
                if (skipRoutePlayback) {
                    skipRoutePlayback = false;
                    nfDebug('stream:route-change:skip', { id, season, episode });
                    return;
                }
                if (!id) return;

                const idChanged = id !== prev?.[0];
                const seasonChanged = season !== prev?.[1];
                const episodeChanged = episode !== prev?.[2];
                if (!idChanged && !seasonChanged && !episodeChanged) return;

                playbackEntryId.value = String(id);
                nfDebug('stream:route-change', { id, season, episode, idChanged, seasonChanged, episodeChanged });

                if (idChanged) {
                    resetPlaybackSession();
                    availableLanguages.value = [];
                    await startPlayback();
                    return;
                }

                if (!supportsEpisodes.value) return;

                const nextSeason = parseInt(String(season || '1'), 10);
                const nextEpisode = parseInt(String(episode || '1'), 10);
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
            availableLanguages,
            languagesLoading,
            selectedPlaybackLanguage,
            playbackLanguage,
            switchingAudioLabel,
            switchingEpisodeLabel,
            mediaType,
            supportsEpisodes,
            episodeSeasons,
            episodeList,
            pickerSeason,
            currentSeason,
            currentEpisode,
            episodesLoading,
            onEpisodeSelect,
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
            partyHref
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