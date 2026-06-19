<template>
    <div class="nf-stream-page">
        <NetflixPlayer
            :bind-container="bindPlayerContainer"
            :title="title"
            :subtitle="subtitle"
            :loading="loading"
            :art-ready="artReady"
            :playback-error="playbackError"
            :is-playing="isPlaying"
            :current-time="currentTime"
            :duration="duration"
            :progress="progress"
            :buffer-progress="bufferProgress"
            :is-muted="isMuted"
            :streams="resolved?.streams || []"
            :selected-stream-index="selectedStreamIndex"
            @back="goBack"
            @toggle-play="togglePlay"
            @skip-back="skipBack"
            @toggle-mute="toggleMute"
            @seek="seekTo"
            @quality="onQuality"
        />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, onMounted, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import NetflixPlayer from '../components/player/NetflixPlayer.vue';
import { parseCatalogTitle } from '../composables/useMoovieCatalog';
import { useMooviePlayer } from '../composables/useMooviePlayer';
import { useSeo } from '../composables/useSeo';
import { nfDebug } from '../composables/useNetflixDebug';

export default defineComponent({
    name: 'StreamNetflix',
    components: { NetflixPlayer },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const { updateSeo } = useSeo();
        const player = useMooviePlayer({ skin: 'netflix' });
        const {
            loading,
            playbackError,
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
            switchQuality,
            togglePlay,
            seekTo,
            skipBack,
            toggleMute,
            destroyArt
        } = player;

        let started = false;

        const bindPlayerContainer = (el: HTMLElement | null) => {
            artContainer.value = el;
        };

        const mediaType = computed((): 'movie' | 'tv' => {
            if (route.name === 'StreamNetflixTV') return 'tv';
            return 'movie';
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
                id: String(route.params.id || ''),
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
            const fallback = `/nf/${mediaType.value}/${route.params.id}`;
            if (window.history.length > 1) {
                router.back();
                scheduleTeardown();
                return;
            }
            router.replace(fallback);
            scheduleTeardown();
        };

        const startPlayback = () => {
            nfDebug('stream:playback:start', {
                id: route.params.id,
                type: mediaType.value,
                season: route.params.season,
                episode: route.params.episode
            });
            resolveAndPlay({
                type: mediaType.value,
                id: String(route.params.id || ''),
                season: parseInt(String(route.params.season || '0'), 10),
                episode: parseInt(String(route.params.episode || '0'), 10)
            });
        };

        const onQuality = (index: number) => {
            nfDebug('stream:quality', { index });
            switchQuality(index, resolveUrl.value);
        };

        onBeforeRouteLeave(() => {
            scheduleTeardown();
        });

        onMounted(() => {
            nfDebug('stream:mount', { path: route.path });
            updateSeo({
                title: 'Watch — Netflix on Moovie',
                canonical: `https://moovie.fun${route.path}`,
                image: 'https://moovie.fun/og-image.png'
            });
            if (!started) {
                started = true;
                startPlayback();
            }
        });

        onBeforeUnmount(() => {
            teardown();
        });

        watch(
            () => [route.params.id, route.params.season, route.params.episode],
            () => {
                nfDebug('stream:route-change', {
                    id: route.params.id,
                    season: route.params.season,
                    episode: route.params.episode
                });
                startPlayback();
            }
        );

        return {
            bindPlayerContainer,
            loading,
            playbackError,
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
            onQuality
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