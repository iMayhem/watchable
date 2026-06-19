<template>
    <div class="nf-stream-page">
        <NetflixPlayer
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
        />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import NetflixPlayer from '../components/player/NetflixPlayer.vue';
import {
    fetchMoovieCatalogMeta,
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

export default defineComponent({
    name: 'StreamNetflix',
    components: { NetflixPlayer },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const { updateSeo } = useSeo();
        const { language: playbackLanguage, setLanguage: setPlaybackLanguage } =
            getNetflixLanguage();
        const { addToast } = useToast();
        const availableLanguages = ref<NetflixLanguageOption[]>([]);
        const languagesLoading = ref(false);
        const playingLanguageCategory = ref<string | null>(null);
        const switchingAudioLabel = ref('');
        const switchingEpisodeLabel = ref('');

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
            switchQuality,
            togglePlay,
            pausePlayback,
            seekTo,
            skipBack,
            toggleMute,
            destroyArt
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

        const bindPlayerContainer = (el: HTMLElement | null) => {
            artContainer.value = el;
        };

        const routeMediaType = computed((): 'movie' | 'tv' => {
            if (route.name === 'StreamNetflixTV') return 'tv';
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
            if (supportsEpisodes.value || route.name === 'StreamNetflixTV') {
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
            if (supportsEpisodes.value || route.name === 'StreamNetflixTV') {
                const season = parseInt(String(route.params.season || '1'), 10);
                const episode = parseInt(String(route.params.episode || '1'), 10);
                parts.push(`S${season} · E${episode}`);
            }
            return parts.join('  ·  ');
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

        const ensureCanonicalStreamRoute = async (): Promise<boolean> => {
            const id = String(route.params.id || '');
            if (!id) return true;

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

                if (route.path !== target.path) {
                    nfDebug('stream:canonical-route', { from: route.path, to: target.path });
                    playbackEntryId.value = id;
                    skipRoutePlayback = true;
                    await router.replace(target.path);
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

        const startPlayback = async () => {
            const id = playbackEntryId.value;
            const type = streamType.value;
            const season = type === 'tv'
                ? parseInt(String(route.params.season || '1'), 10)
                : 0;
            const episode = type === 'tv'
                ? parseInt(String(route.params.episode || '1'), 10)
                : 0;

            nfDebug('stream:playback:start', { id, type, season, episode });

            languagesLoading.value = true;
            let catalogMeta: { title?: string; channel?: string } | null = null;

            try {
                const [meta, cache] = await Promise.all([
                    fetchMoovieCatalogMeta(type, id),
                    fetchCatalogAudioCacheByIds([id])
                ]);
                catalogMeta = meta;
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
            } catch (err) {
                nfDebug('stream:languages:seed:fail', { id, err });
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

            try {
                await Promise.all([
                    resolveAndPlay({ type, id, season, episode }),
                    languageLoadPromise
                ]);
            } finally {
                languagesLoading.value = false;
            }

            const title = resolved.value?.meta?.title || catalogMeta?.title || '';
            if (title) {
                syncPlayingLanguageFromTitle(title, catalogMeta?.channel);
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
            switchingEpisodeLabel.value = formatEpisodeLabel(season, episode);

            try {
                await switchResolveEntry(
                    { type: streamType.value, id, season, episode },
                    { resumeAt: 0, resumePlaying: true }
                );

                const path = catalogStreamPath(id, season, episode);
                skipRoutePlayback = true;
                syncBrowserUrl(path);
                await router.replace(path);
            } catch (err: any) {
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

        const onEpisodeNext = () => {
            if (!episodeList.value.length) return;
            const max = Math.max(...episodeList.value.map((ep) => ep.episode_number));
            if (currentEpisode.value < max) {
                switchEpisode(currentSeason.value, currentEpisode.value + 1);
            }
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

        onBeforeRouteLeave(() => {
            scheduleTeardown();
        });

        onMounted(async () => {
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
            teardown();
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
                    await startPlayback();
                    return;
                }

                if (!supportsEpisodes.value) return;

                const nextSeason = parseInt(String(season || '1'), 10);
                const nextEpisode = parseInt(String(episode || '1'), 10);

                try {
                    await switchResolveEntry(
                        {
                            type: streamType.value,
                            id: String(id),
                            season: nextSeason,
                            episode: nextEpisode
                        },
                        { resumeAt: 0, resumePlaying: true }
                    );
                } catch (err: any) {
                    nfDebug('stream:route-episode:fail', { id, season, episode, err });
                    addToast(err?.message || 'Could not switch episode.', 'warning');
                }

                if (seasonChanged) {
                    await setPickerSeason(nextSeason);
                }
            }
        );

        return {
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
            onEpisodeNext
        };
    }
});
</script>

<style lang="scss" scoped>
.nf-stream-page {
    min-height: 100dvh;
    background: #000;
}
</style>