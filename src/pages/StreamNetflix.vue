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
            :selected-language="playbackLanguage"
            @back="goBack"
            @toggle-play="togglePlay"
            @skip-back="skipBack"
            @toggle-mute="toggleMute"
            @seek="seekTo"
            @quality="onQuality"
            @language="onLanguage"
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
    catalogStreamTarget,
    findCatalogueLanguageVariants,
    findCatalogueVariantForLanguage,
    languagesForCatalogueItems
} from '../composables/useNetflixCatalogLookup';
import {
    getNetflixLanguage,
    getLanguageOption,
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
            seekTo,
            skipBack,
            toggleMute,
            destroyArt
        } = player;

        let started = false;
        const playbackEntryId = ref(String(route.params.id || ''));
        let skipRoutePlayback = false;

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
            if (mediaType.value === 'tv') {
                const season = parseInt(String(route.params.season || '1'), 10);
                const episode = parseInt(String(route.params.episode || '1'), 10);
                parts.push(`S${season} · E${episode}`);
            }
            return parts.join('  ·  ');
        });

        const resolveUrl = computed(() => {
            const params = new URLSearchParams({
                action: 'resolve',
                type: mediaType.value,
                id: playbackEntryId.value,
                se: String(route.params.season || '0'),
                ep: String(route.params.episode || '0'),
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

        const loadAvailableLanguages = async (displayTitle: string) => {
            const variants = await findCatalogueLanguageVariants(displayTitle);
            availableLanguages.value = languagesForCatalogueItems(variants);
            if (!availableLanguages.value.length) {
                availableLanguages.value = [getLanguageOption(playbackLanguage.value)];
            }
        };

        const ensureCanonicalStreamRoute = async (): Promise<boolean> => {
            const id = String(route.params.id || '');
            if (!id) return true;

            try {
                const meta = await fetchMoovieCatalogMeta(routeMediaType.value, id);
                const target = catalogStreamTarget({
                    id,
                    title: meta.title,
                    media_type: meta.media_type
                });

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
            const type = mediaType.value;
            const season = type === 'tv'
                ? parseInt(String(route.params.season || '1'), 10)
                : 0;
            const episode = type === 'tv'
                ? parseInt(String(route.params.episode || '1'), 10)
                : 0;

            nfDebug('stream:playback:start', { id, type, season, episode });
            await resolveAndPlay({ type, id, season, episode });

            const title = resolved.value?.meta?.title || '';
            const parsed = parseCatalogTitle(title);
            if (parsed.displayTitle) {
                void loadAvailableLanguages(parsed.displayTitle);
            }
        };

        const onQuality = (index: number) => {
            nfDebug('stream:quality', { index });
            switchQuality(index, resolveUrl.value);
        };

        const onLanguage = async (category: string) => {
            if (category === playbackLanguage.value) return;

            const lang = getLanguageOption(category);
            const currentTitle = resolved.value?.meta?.title || title.value;
            const parsed = parseCatalogTitle(currentTitle);
            const displayTitle = parsed.displayTitle || currentTitle;
            const resumeAt = currentTime.value;
            const resumePlaying = isPlaying.value;

            nfDebug('stream:language', { category, displayTitle, resumeAt, resumePlaying });

            const variant = await findCatalogueVariantForLanguage(displayTitle, lang, {
                excludeId: String(route.params.id || ''),
                mediaType: mediaType.value
            });

            if (!variant) {
                addToast(
                    `${lang.label} audio is not available for this title.`,
                    'warning'
                );
                return;
            }

            const target = catalogStreamTarget(variant);

            try {
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

                setPlaybackLanguage(category);
                syncBrowserUrl(target.path);

                if (parsed.displayTitle) {
                    void loadAvailableLanguages(parsed.displayTitle);
                }
            } catch (err: any) {
                playbackEntryId.value = String(route.params.id || playbackEntryId.value);
                nfDebug('stream:language:fail', { category, err });
                addToast(
                    err?.message || `Could not switch to ${lang.label} audio.`,
                    'warning'
                );
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
                const ok = await ensureCanonicalStreamRoute();
                if (ok) await startPlayback();
            }
        });

        onBeforeUnmount(() => {
            teardown();
        });

        watch(
            () => [route.params.id, route.params.season, route.params.episode],
            async ([id, season, episode], prev) => {
                if (skipRoutePlayback) {
                    skipRoutePlayback = false;
                    nfDebug('stream:route-change:skip', { id });
                    return;
                }
                if (!id || id === prev?.[0]) return;
                playbackEntryId.value = String(id);
                nfDebug('stream:route-change', { id, season, episode });
                await startPlayback();
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
            playbackLanguage
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