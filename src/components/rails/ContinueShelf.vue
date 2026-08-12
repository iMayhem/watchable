<template>
    <LmRail
        v-if="entries.length"
        :title="title"
        :eyebrow="eyebrow"
        density="keyart"
        :columns="{ base: 1.7, sm: 2.4, md: 3.5, lg: 5.2, xl: 6.2, xxl: 7.2, huge: 8.2 }"
        :peek-room="false"
    >
        <article
            v-for="entry in entries"
            :key="`cw-${entry.type}-${entry.id}`"
            class="continue"
        >
            <router-link :to="entry.resumePath" class="continue__link" :aria-label="entry.ariaLabel">
                <div class="continue__art">
                    <img
                        v-if="entry.image"
                        :src="entry.image"
                        :alt="entry.title"
                        loading="lazy"
                        decoding="async"
                    />
                    <div v-else class="continue__placeholder" aria-hidden="true">
                        <span>{{ entry.initial }}</span>
                    </div>

                    <div class="continue__scrim" aria-hidden="true" />

                    <div class="continue__play">
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </div>

                    <div
                        class="continue__progress"
                        :style="{ width: `${entry.progress}%` }"
                        :aria-valuenow="entry.progress"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        role="progressbar"
                        :aria-label="`${entry.progress}% watched`"
                    />
                </div>

                <div class="continue__body">
                    <h4 class="continue__title">{{ entry.title }}</h4>
                    <p v-if="entry.subtitle" class="meta continue__sub">{{ entry.subtitle }}</p>
                </div>
            </router-link>
        </article>
    </LmRail>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue';
import LmRail from './Rail.vue';
import { viewHistory } from '../../composables/useHistory';
import { streamData } from '../../composables/useStream';
import { getProgressPercent } from '../../composables/useProgress';
import { useWebImage } from '../../utils/useWebImage';
import { getCachedAnimeTmdbArtwork, resolveAnimeTmdbMetaByTmdbId } from '../../composables/useAnimeTmdbArtwork';

interface Entry {
    id: number | string;
    type: 'movie' | 'tv' | 'anime';
    title: string;
    image: string;
    initial: string;
    eyebrow: string;
    subtitle: string;
    resumePath: string;
    progress: number; // 0..100
    ariaLabel: string;
}

export default defineComponent({
    name: 'ContinueShelf',
    components: { LmRail },
    props: {
        title: { type: String, default: 'Continue watching' },
        eyebrow: { type: String, default: '' }
    },
    setup() {
        const entries = computed<Entry[]>(() => {
            return viewHistory.value.map(item => {
                const id = String(item.id);
                const state = streamData.value.movieServerMap[id];
                const isTv = item.type === 'tv';
                const isAnime = item.type === 'anime';

                if (isAnime && !getCachedAnimeTmdbArtwork(Number(item.id))) {
                    void resolveAnimeTmdbMetaByTmdbId(Number(item.id));
                }

                const animePoster = isAnime
                    ? getCachedAnimeTmdbArtwork(Number(item.id))?.posterPath
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
                    ? `/stream/anime/${item.id}/episode/${episode}`
                    : (isTv
                        ? `/stream/tv-show/${item.id}/season/${season}/episode/${episode}`
                        : `/stream/movie/${item.id}`);

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

        return { entries };
    }
});
</script>

<style lang="scss" scoped>
.continue {
    display: block;
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--rule);
    border-radius: var(--r-lg);
    background: var(--ink-800);
    transition:
        border-color var(--dur-fast) var(--ease-out),
        background-color var(--dur-fast) var(--ease-out),
        transform var(--dur-fast) var(--ease-out);

    &__link {
        display: block;
        color: inherit;
        text-decoration: none;
    }

    &__art {
        position: relative;
        aspect-ratio: 16 / 9;
        border-radius: 0;
        overflow: hidden;
        background: var(--ink-700);
        box-shadow: none;
        transition:
            transform var(--dur-base) var(--ease-out),
            box-shadow var(--dur-base) var(--ease-out);

        img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
            transition: transform var(--dur-slow) var(--ease-out);
        }
    }

    &:hover,
    &:focus-within {
        transform: translateY(-4px);
        border-color: var(--rule-strong);
        background: var(--ink-700);
    }

    &__link:hover &__art,
    &__link:focus-visible &__art {
        box-shadow: none;

        img { transform: scale(1.04); }
        .continue__play { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }

    &__placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        font-family: var(--font-display);
        color: var(--bone-500);
        font-size: 3rem;
        background:
            radial-gradient(70% 70% at 40% 40%, var(--ink-600), var(--ink-800));
    }

    &__scrim {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(
            180deg,
            transparent 50%,
            rgba(11, 10, 8, 0.75) 100%
        );
    }

    &__play {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 46px;
        height: 46px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #000;
        color: var(--ember);
        border-radius: 50%;
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.85);
        transition:
            opacity var(--dur-fast) var(--ease-out),
            transform var(--dur-fast) var(--ease-out);
        box-shadow: 0 8px 22px rgba(0, 0, 0, 0.45);

        svg { width: 18px; height: 18px; margin-left: 2px; }
    }

    &__progress {
        position: absolute;
        left: 0;
        bottom: 0;
        height: 3px;
        background: #050505;
        box-shadow: 0 0 12px rgba(0, 0, 0, 0.45);
        min-width: 6px;
        transition: width var(--dur-base) var(--ease-out);
    }

    // ── Body ──────────────────────────────────────────────────────────────
    &__body {
        padding: 0.7rem 0.8rem 0.8rem;
    }

    &__eyebrow {
        color: var(--ember);
    }

    &__title {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: 0.9rem;
        line-height: 1.2;
        color: var(--bone-50);
        margin-top: 0.25rem;
        font-variation-settings: 'opsz' 36;
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    &__sub {
        margin-top: 0.25rem;
        color: var(--bone-400);
    }
}

@media (prefers-reduced-motion: reduce) {
    .continue {
        &__art, img, .continue__play { transition: none; transform: none !important; }
    }
}
</style>
