<template>
    <div class="nf-stream-page">
        <NetflixPlayer
            :container-ref="playerShell.container"
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
import { computed, defineComponent, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import NetflixPlayer from '../components/player/NetflixPlayer.vue';
import { parseNetmirrorTitle } from '../composables/useNetmirror';
import { useNetmirrorPlayer } from '../composables/useNetmirrorPlayer';
import { useSeo } from '../composables/useSeo';

export default defineComponent({
    name: 'StreamNetflix',
    components: { NetflixPlayer },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const { updateSeo } = useSeo();
        const player = useNetmirrorPlayer({ skin: 'netflix' });
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
            toggleMute
        } = player;

        const playerShell = { container: artContainer };

        const mediaType = computed((): 'movie' | 'tv' => {
            if (route.name === 'StreamNetflixTV') return 'tv';
            return 'movie';
        });

        const parsedMeta = computed(() => {
            const raw = resolved.value?.meta?.title || '';
            return parseNetmirrorTitle(raw);
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
            return `/api/netmirror?${params.toString()}`;
        });

        const goBack = () => {
            router.push(`/nf/${mediaType.value}/${route.params.id}`);
        };

        const startPlayback = () => {
            resolveAndPlay({
                type: mediaType.value,
                id: String(route.params.id || ''),
                season: parseInt(String(route.params.season || '0'), 10),
                episode: parseInt(String(route.params.episode || '0'), 10)
            });
        };

        const onQuality = (index: number) => {
            switchQuality(index, resolveUrl.value);
        };

        onMounted(() => {
            updateSeo({
                title: 'Watch — Netflix on Moovie',
                canonical: `https://moovie.fun${route.path}`,
                image: 'https://moovie.fun/og-image.png'
            });
            startPlayback();
        });

        watch(
            () => [route.params.id, route.params.season, route.params.episode],
            startPlayback
        );

        return {
            playerShell,
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