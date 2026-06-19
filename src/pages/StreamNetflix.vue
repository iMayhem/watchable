<template>
    <div class="nf-stream">
        <SiteHeader />

        <main id="main" class="nf-stream__main container-lm" role="main">
            <router-link to="/" class="nf-stream__back eyebrow">← Back to catalogue</router-link>

            <header class="nf-stream__header">
                <h1 class="nf-stream__title display">{{ title }}</h1>
                <p v-if="languageLine" class="nf-stream__langs">{{ languageLine }}</p>
                <p class="nf-stream__ext" :class="{ 'is-active': extensionActive }">
                    {{ extensionActive ? 'Extension active · direct CDN' : 'Add extension for faster playback' }}
                </p>
            </header>

            <div class="nf-stream__player-wrap">
                <div ref="artContainer" class="nf-stream__player" />
                <div v-if="!artReady" class="nf-stream__player-placeholder">
                    {{ loading ? 'Resolving stream…' : 'Preparing player…' }}
                </div>
            </div>

            <p v-if="playbackError" class="nf-stream__error" role="alert">{{ playbackError }}</p>

            <div v-if="resolved?.streams?.length" class="nf-stream__qualities">
                <button
                    v-for="(stream, index) in resolved.streams"
                    :key="stream.url"
                    type="button"
                    class="nf-stream__quality"
                    :class="{ 'is-active': selectedStreamIndex === index }"
                    @click="onQuality(index)"
                >
                    {{ stream.quality }}
                </button>
            </div>
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import { parseNetmirrorTitle } from '../composables/useNetmirror';
import { useNetmirrorPlayer } from '../composables/useNetmirrorPlayer';
import { useSeo } from '../composables/useSeo';

export default defineComponent({
    name: 'StreamNetflix',
    components: { SiteHeader, SiteFooter },
    setup() {
        const route = useRoute();
        const { updateSeo } = useSeo();
        const {
            extensionActive,
            loading,
            playbackError,
            resolved,
            selectedStreamIndex,
            artReady,
            artContainer,
            resolveAndPlay,
            switchQuality
        } = useNetmirrorPlayer();

        const mediaType = computed((): 'movie' | 'tv' => {
            if (route.name === 'StreamNetflixTV') return 'tv';
            return 'movie';
        });

        const title = computed(() => {
            const raw = resolved.value?.meta?.title || 'Now playing';
            return parseNetmirrorTitle(raw).displayTitle || raw;
        });

        const languageLine = computed(() => {
            const raw = resolved.value?.meta?.title || '';
            return parseNetmirrorTitle(raw).languages.join(' · ');
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
            extensionActive,
            loading,
            playbackError,
            resolved,
            selectedStreamIndex,
            artReady,
            artContainer,
            title,
            languageLine,
            onQuality
        };
    }
});
</script>

<style lang="scss" scoped>
.nf-stream {
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    &__main {
        padding-top: calc(var(--header-height, 72px) + var(--s-5));
        padding-bottom: var(--s-10);
    }

    &__back {
        display: inline-flex;
        margin-bottom: var(--s-4);
        color: var(--bone-400);
        text-decoration: none;

        &:hover {
            color: var(--bone-50);
        }
    }

    &__header {
        margin-bottom: var(--s-5);
    }

    &__title {
        margin: 0 0 var(--s-2);
        font-size: clamp(1.8rem, 4vw, 2.6rem);
    }

    &__langs {
        margin: 0 0 var(--s-2);
        color: var(--ember);
        font-family: var(--font-mono);
        font-size: 0.78rem;
        letter-spacing: var(--ls-micro);
        text-transform: uppercase;
    }

    &__ext {
        margin: 0;
        font-size: 0.82rem;
        color: var(--bone-400);

        &.is-active {
            color: #8fd0ff;
        }
    }

    &__player-wrap {
        position: relative;
        aspect-ratio: 16 / 9;
        border-radius: var(--r-md);
        overflow: hidden;
        background: var(--ink-850);
        border: 1px solid var(--rule);
    }

    &__player {
        width: 100%;
        height: 100%;
    }

    &__player-placeholder {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: var(--bone-400);
        font-size: var(--fs-sm);
        pointer-events: none;
    }

    &__error {
        margin: var(--s-4) 0 0;
        color: #ff8b8b;
        font-size: var(--fs-sm);
    }

    &__qualities {
        display: flex;
        flex-wrap: wrap;
        gap: var(--s-2);
        margin-top: var(--s-4);
    }

    &__quality {
        padding: 0.45rem 0.9rem;
        border-radius: var(--r-pill);
        border: 1px solid var(--rule);
        background: var(--ink-800);
        color: var(--bone-200);
        font-family: var(--font-mono);
        font-size: 0.75rem;
        cursor: pointer;

        &.is-active,
        &:hover {
            border-color: var(--ember);
            color: var(--bone-50);
        }
    }
}
</style>