<template>
    <MobileShell>
        <div class="m-detail">
            <div class="m-anime-hero">
                <template v-if="loading">
                    <div class="m-anime-hero__skeleton-img m-anime-hero__skeleton-shimmer" />
                    <div class="m-anime-hero__scrim" aria-hidden="true" />
                    <div class="m-anime-hero__body">
                        <div class="m-anime-hero__skeleton-title m-anime-hero__skeleton-shimmer" />
                        <div class="m-anime-hero__skeleton-btn m-anime-hero__skeleton-shimmer" />
                    </div>
                </template>
                <template v-else>
                    <img
                        v-if="bannerUrl"
                        :src="bannerUrl"
                        :alt="title"
                        class="m-anime-hero__img"
                    />
                    <div class="m-anime-hero__scrim" aria-hidden="true" />
                    <div class="m-anime-hero__body">
                        <h1 class="m-anime-hero__title">{{ title }}</h1>
                        <router-link :to="playRoute" class="m-anime-hero__play">Play</router-link>
                    </div>
                </template>
            </div>

            <template v-if="loading">
                <div class="m-anime-hero__desc">
                    <div class="m-anime-hero__skeleton-line m-anime-hero__skeleton-shimmer" style="width: 100%; height: 14px; margin-bottom: 8px" />
                    <div class="m-anime-hero__skeleton-line m-anime-hero__skeleton-shimmer" style="width: 95%; height: 14px; margin-bottom: 8px" />
                    <div class="m-anime-hero__skeleton-line m-anime-hero__skeleton-shimmer" style="width: 70%; height: 14px" />
                </div>
                <MobileSection title="Episodes" eyebrow="Watch">
                    <div class="m-anime-eps">
                        <div v-for="i in 8" :key="i" class="m-anime-eps__skeleton-chip m-anime-hero__skeleton-shimmer" />
                    </div>
                </MobileSection>
            </template>
            <template v-else>
                <p v-if="description" class="m-anime-hero__desc" v-html="description" />

                <MobileSection v-if="episodes.length" title="Episodes" eyebrow="Watch">
                    <div class="m-anime-eps">
                        <router-link
                            v-for="ep in episodes"
                            :key="ep"
                            :to="anime ? paths.streamAnime(anime.id, ep) : ''"
                            class="m-anime-eps__chip"
                        >
                            Ep {{ ep }}
                        </router-link>
                    </div>
                </MobileSection>
            </template>
        </div>
    </MobileShell>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import MobileShell from '../layout/MobileShell.vue';
import MobileSection from '../components/MobileSection.vue';
import { useAniList, AnimeMedia } from '@/composables/useAniList';
import { useAppPaths } from '@/composables/useAppPaths';

const route = useRoute();
const paths = useAppPaths();
const { fetchAnimeById } = useAniList();
const anime = ref<AnimeMedia | null>(null);
const loading = ref(true);

const title = computed(
    () => anime.value?.title.english || anime.value?.title.romaji || 'Anime'
);

const bannerUrl = computed(() => anime.value?.bannerImage || anime.value?.coverImage.large || '');
const description = computed(() => anime.value?.description?.replace(/<[^>]+>/g, '') ?? '');
const episodes = computed(() => {
    const count = anime.value?.episodes ?? 0;
    return count > 0 ? Array.from({ length: Math.min(count, 24) }, (_, i) => i + 1) : [1];
});

const playRoute = computed(() =>
    paths.streamAnime(anime.value?.id ?? Number(route.params.id), 1)
);

onMounted(async () => {
    loading.value = true;
    try {
        const res = await fetchAnimeById(Number(route.params.id));
        anime.value = res?.data?.Media ?? null;
        document.title = `${title.value} — Moovie`;
    } finally {
        loading.value = false;
    }
});
</script>

<style lang="scss" scoped>
.m-anime-hero {
    position: relative;
    margin: 0 var(--s-4) var(--s-4);
    border-radius: var(--r-md);
    overflow: hidden;
    aspect-ratio: 16 / 9;

    &__img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    &__scrim {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, transparent, rgba(11, 10, 8, 0.9));
    }

    &__body {
        position: absolute;
        inset: auto 0 0 0;
        padding: var(--s-4);
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--s-3);
    }

    &__title {
        font-family: var(--font-display);
        font-size: 1.25rem;
        margin: 0;
        flex: 1;
    }

    &__play {
        flex-shrink: 0;
        padding: 0.5rem 1rem;
        border-radius: var(--r-pill);
        background: var(--ember);
        color: var(--ink-900);
        font-weight: 700;
        text-decoration: none;
    }

    &__desc {
        padding: 0 var(--s-4) var(--s-4);
        color: var(--bone-300);
        font-size: var(--fs-sm);
        line-height: var(--lh-base);
    }

    &__skeleton-img {
        width: 100%;
        height: 100%;
        background: var(--ink-800);
    }

    &__skeleton-title {
        width: 180px;
        height: 20px;
        border-radius: 4px;
        background: var(--ink-750);
    }

    &__skeleton-btn {
        width: 60px;
        height: 32px;
        border-radius: var(--r-pill);
        background: var(--ink-750);
    }

    &__skeleton-line {
        background: var(--ink-750);
        border-radius: 2px;
    }

    &__skeleton-shimmer {
        position: relative;
        overflow: hidden;
        background: var(--ink-750);

        &::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(
                90deg,
                transparent,
                rgba(255, 255, 255, 0.04),
                transparent
            );
            transform: translateX(-100%);
            animation: mobile-anime-skeleton-shimmer-anim 1.6s infinite ease-in-out;
        }
    }
}

@keyframes mobile-anime-skeleton-shimmer-anim {
    100% {
        transform: translateX(100%);
    }
}

.m-anime-eps {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-2);
    padding: 0 var(--s-4) var(--s-4);

    &__chip {
        min-width: 3.25rem;
        min-height: 2.5rem;
        display: grid;
        place-items: center;
        padding: 0 var(--s-3);
        border-radius: var(--r-sm);
        border: 1px solid var(--rule);
        color: var(--bone-100);
        text-decoration: none;
        font-weight: 600;
        font-size: var(--fs-sm);
    }

    &__skeleton-chip {
        width: 3.25rem;
        height: 2.5rem;
        border-radius: var(--r-sm);
        background: var(--ink-750);
    }
}

.m-detail__loading {
    display: flex;
    justify-content: center;
    padding: var(--s-10);
}
</style>
