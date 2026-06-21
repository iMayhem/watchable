<template>
    <MobileSection v-if="entries.length" :title="title" :eyebrow="eyebrow">
        <div class="m-continue-track">
            <article
                v-for="entry in entries"
                :key="`cw-${entry.type}-${entry.id}`"
                class="m-continue-card"
            >
                <router-link :to="entry.resumePath" class="m-continue-card__link" :aria-label="entry.ariaLabel">
                    <div class="m-continue-card__art">
                        <img
                            v-if="entry.image"
                            :src="entry.image"
                            :alt="entry.title"
                            loading="lazy"
                            decoding="async"
                        />
                        <div v-else class="m-continue-card__placeholder" aria-hidden="true">
                            <span>{{ entry.initial }}</span>
                        </div>

                        <div class="m-continue-card__scrim" aria-hidden="true" />

                        <div class="m-continue-card__play" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </div>

                        <div
                            class="m-continue-card__progress"
                            :style="{ width: `${entry.progress}%` }"
                            role="progressbar"
                            :aria-valuenow="entry.progress"
                            aria-valuemin="0"
                            aria-valuemax="100"
                            :aria-label="`${entry.progress}% watched`"
                        />
                    </div>

                    <div class="m-continue-card__body">
                        <span class="eyebrow m-continue-card__eyebrow">{{ entry.eyebrow }}</span>
                        <h4 class="m-continue-card__title">{{ entry.title }}</h4>
                        <p v-if="entry.subtitle" class="meta m-continue-card__sub">{{ entry.subtitle }}</p>
                    </div>
                </router-link>
            </article>
        </div>
    </MobileSection>
</template>

<script lang="ts">
import { computed, defineComponent, ref, watchEffect } from 'vue';
import MobileSection from './MobileSection.vue';
import { viewHistory } from '@/composables/useHistory';
import { streamData } from '@/composables/useStream';
import { getProgressPercent } from '@/composables/useProgress';
import { useWebImage } from '@/utils/useWebImage';
import { useAppPaths } from '@/composables/useAppPaths';
import { getCachedAnimeTmdbArtwork, resolveAnimeTmdbMetaByTmdbId } from '@/composables/useAnimeTmdbArtwork';

interface Entry {
    id: number | string;
    type: 'movie' | 'tv' | 'anime';
    title: string;
    image: string;
    initial: string;
    eyebrow: string;
    subtitle: string;
    resumePath: string;
    progress: number;
    ariaLabel: string;
}

export default defineComponent({
    name: 'MobileContinueShelf',
    components: { MobileSection },
    props: {
        title: { type: String, default: 'Continue watching' },
        eyebrow: { type: String, default: 'Pick up where you left off' }
    },
    setup() {
        const paths = useAppPaths();
        const animePosterMap = ref<Record<string, string>>({});
        const pendingAnimePosterRequests = new Set<string>();

        const entries = computed<Entry[]>(() => {
            return viewHistory.value.map((item: any) => {
                const id = String(item.id);
                const isTv = item.type === 'tv';
                const isAnime = item.type === 'anime';
                const state = streamData.value.movieServerMap[id];
                const animePoster = isAnime
                    ? animePosterMap.value[id]
                        || getCachedAnimeTmdbArtwork(Number(item.id))?.posterPath
                        || null
                    : null;
                const imagePath = animePoster || item.image;
                const image = imagePath ? useWebImage(imagePath, 'medium') : '';
                const initial = (item.title?.[0] || '·').toUpperCase();

                const season = state?.season && state.season > 0 ? state.season : 1;
                const episode = state?.episode && state.episode > 0 ? state.episode : 1;

                const progress = getProgressPercent(
                    item.id,
                    item.type,
                    isTv ? season : undefined,
                    (isTv || isAnime) ? episode : undefined
                );
                
                const resumePath = isAnime
                    ? paths.streamAnime(item.id, episode)
                    : (isTv
                        ? paths.streamTvShow(item.id, season, episode)
                        : paths.streamMovie(item.id));

                const subtitle = isAnime
                    ? `Episode ${episode}`
                    : (isTv
                        ? `S${season} · E${episode}`
                        : item.rating
                            ? `★ ${item.rating.toFixed(1)}`
                            : '');

                return {
                    id: item.id,
                    type: item.type,
                    title: item.title,
                    image,
                    initial,
                    eyebrow: isAnime ? 'Anime' : (isTv ? 'Series' : 'Film'),
                    subtitle,
                    resumePath,
                    progress,
                    ariaLabel: isAnime
                        ? `Resume ${item.title} Episode ${episode}`
                        : (isTv
                            ? `Resume ${item.title} Season ${season} Episode ${episode}`
                            : `Resume ${item.title}`)
                } satisfies Entry;
            });
        });

        watchEffect(() => {
            for (const item of viewHistory.value) {
                if (item.type !== 'anime') continue;
                const id = String(item.id);
                if (animePosterMap.value[id] || pendingAnimePosterRequests.has(id)) continue;

                const cached = getCachedAnimeTmdbArtwork(Number(item.id));
                if (cached?.posterPath) {
                    animePosterMap.value[id] = cached.posterPath;
                    continue;
                }

                pendingAnimePosterRequests.add(id);
                void resolveAnimeTmdbMetaByTmdbId(Number(item.id))
                    .then((meta) => {
                        if (meta?.posterPath) {
                            animePosterMap.value[id] = meta.posterPath;
                        }
                    })
                    .finally(() => {
                        pendingAnimePosterRequests.delete(id);
                    });
            }
        });

        return { entries };
    }
});
</script>

<style lang="scss" scoped>
.m-continue-track {
    display: flex;
    gap: var(--s-3);
    overflow-x: auto;
    overflow-y: hidden;
    scroll-behavior: smooth;
    scroll-snap-type: x mandatory;
    padding-inline: var(--s-4);
    padding-bottom: var(--s-2);
    -webkit-overflow-scrolling: touch;

    &::-webkit-scrollbar {
        display: none;
    }
}

.m-continue-card {
    flex: 0 0 70%;
    max-width: 260px;
    scroll-snap-align: start;

    &__link {
        display: block;
        color: inherit;
        text-decoration: none;

        &:active {
            .m-continue-card__art {
                transform: scale(0.97);
                filter: brightness(0.9);
            }
        }
    }

    &__art {
        position: relative;
        aspect-ratio: 16 / 9;
        border-radius: var(--r-md);
        overflow: hidden;
        background: var(--ink-800);
        border: 1px solid var(--rule);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        transform: translateZ(0);
        transition: transform 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94), filter 0.15s ease;

        img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
    }

    &__placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        font-family: var(--font-display);
        color: var(--bone-500);
        font-size: 2.2rem;
        background: radial-gradient(70% 70% at 40% 40%, var(--ink-700), var(--ink-900));
    }

    &__scrim {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(180deg, transparent 55%, rgba(11, 10, 8, 0.8) 100%);
    }

    &__play {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--ember);
        color: var(--ink-900);
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(255, 90, 31, 0.45);

        svg {
            width: 14px;
            height: 14px;
            margin-left: 2px;
        }
    }

    &__progress {
        position: absolute;
        left: 0;
        bottom: 0;
        height: 3px;
        background: var(--ember);
        box-shadow: 0 0 8px var(--ember-glow);
        min-width: 6px;
    }

    &__body {
        padding: var(--s-2) var(--s-1) var(--s-1);
    }

    &__eyebrow {
        color: var(--ember);
        font-size: 0.625rem;
    }

    &__title {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: var(--fs-sm);
        line-height: 1.2;
        color: var(--bone-100);
        margin: 0.15rem 0 0;
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    &__sub {
        margin-top: 0.15rem;
        color: var(--bone-400);
        font-size: 0.625rem;
    }
}
</style>
