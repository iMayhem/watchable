import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { useStorage } from '@vueuse/core';
import { fetchAnimeMediaById } from './useAniList';
import {
    fetchAnimeCatalogCacheByMoovieIds,
    peekAnilistIdForMoovieCatalogId
} from './useAnimeCatalogCache';
import type { NetflixCatalogSeason } from './useNetflixCatalogEpisodes';
import {
    computeAbsoluteEpisode,
    fetchAniskipRelationRules,
    fetchAniskipSkipTimes,
    labelForSkipType,
    pickActiveSkip,
    resolveAniskipTarget,
    shouldAutoSkip,
    type AniskipSkipResult
} from './useAniskip';
import { nfDebug } from './useNetflixDebug';

interface UseNetflixAniskipOptions {
    catalogId: Ref<string>;
    currentSeason: ComputedRef<number>;
    currentEpisode: ComputedRef<number>;
    episodeSeasons: Ref<NetflixCatalogSeason[]>;
    duration: Ref<number>;
    currentTime: Ref<number>;
    seekTo: (time: number) => void;
}

export function useNetflixAniskip(options: UseNetflixAniskipOptions) {
    const autoSkip = useStorage<boolean>('nf:aniskip:autoplay', true);
    const isAnime = ref(false);
    const malId = ref<number | null>(null);
    const skipTimes = ref<AniskipSkipResult[]>([]);
    const skippedIds = ref(new Set<string>());
    let prevTime = 0;
    let loadToken = 0;

    const activeSkip = computed(() =>
        pickActiveSkip(skipTimes.value, options.currentTime.value, skippedIds.value)
    );

    const skipActionVisible = computed(
        () => isAnime.value && Boolean(activeSkip.value)
    );

    const skipActionLabel = computed(() => {
        const row = activeSkip.value;
        return row ? labelForSkipType(row.skipType) : '';
    });

    const resetSkipped = () => {
        skippedIds.value = new Set();
        prevTime = 0;
    };

    const resolveMalId = async (catalogId: string): Promise<number | null> => {
        let anilistId = peekAnilistIdForMoovieCatalogId(catalogId);
        if (!anilistId) {
            const cache = await fetchAnimeCatalogCacheByMoovieIds([catalogId]);
            const row = cache.get(catalogId);
            anilistId = row?.anilist_id;
        }
        if (!anilistId) return null;

        isAnime.value = true;
        const response = await fetchAnimeMediaById(anilistId);
        const idMal = response?.data?.Media?.idMal;
        return idMal && Number.isFinite(idMal) ? Number(idMal) : null;
    };

    const loadSkipTimes = async () => {
        const token = ++loadToken;
        resetSkipped();
        skipTimes.value = [];

        const catalogId = options.catalogId.value;
        if (!catalogId) {
            isAnime.value = false;
            malId.value = null;
            return;
        }

        const resolvedMal = await resolveMalId(catalogId);
        if (token !== loadToken) return;

        malId.value = resolvedMal;
        if (!resolvedMal) {
            skipTimes.value = [];
            return;
        }

        const absoluteEpisode = computeAbsoluteEpisode(
            options.episodeSeasons.value,
            options.currentSeason.value,
            options.currentEpisode.value
        );
        const rules = await fetchAniskipRelationRules(resolvedMal);
        if (token !== loadToken) return;

        const target = resolveAniskipTarget(resolvedMal, absoluteEpisode, rules);
        const episodeLength = options.duration.value || 0;

        const results = await fetchAniskipSkipTimes(
            target.malId,
            target.episode,
            episodeLength
        );
        if (token !== loadToken) return;

        skipTimes.value = results;
        nfDebug('aniskip:loaded', {
            malId: target.malId,
            episode: target.episode,
            absoluteEpisode,
            count: results.length
        });
    };

    const performSkip = (skip: AniskipSkipResult) => {
        skippedIds.value.add(skip.skipId);
        options.seekTo(skip.interval.endTime);
        nfDebug('aniskip:skip', {
            type: skip.skipType,
            to: skip.interval.endTime
        });
    };

    const onSkipSegment = () => {
        const row = activeSkip.value;
        if (!row) return;
        performSkip(row);
    };

    const toggleAutoSkip = () => {
        autoSkip.value = !autoSkip.value;
    };

    watch(
        () => [
            options.catalogId.value,
            options.currentSeason.value,
            options.currentEpisode.value
        ],
        () => {
            void loadSkipTimes();
        },
        { immediate: true }
    );

    watch(
        () => options.episodeSeasons.value.length,
        () => {
            if (isAnime.value) void loadSkipTimes();
        }
    );

    watch(
        () => options.duration.value,
        (next, prev) => {
            if (isAnime.value && next > 0 && !prev) {
                void loadSkipTimes();
            }
        }
    );

    watch(options.currentTime, (time) => {
        if (!autoSkip.value || !isAnime.value) {
            prevTime = time;
            return;
        }

        const row = pickActiveSkip(skipTimes.value, time, skippedIds.value);
        if (row && shouldAutoSkip(row, time, prevTime)) {
            performSkip(row);
        }
        prevTime = time;
    });

    return {
        autoSkip,
        isAnime,
        skipActionVisible,
        skipActionLabel,
        onSkipSegment,
        toggleAutoSkip
    };
}