<template>
    <div class="actors">
        <SiteHeader />

        <main id="main" class="actors__main" role="main">
            <section class="actors__masthead container-lm">
                <form class="actors__search" role="search" @submit.prevent>
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8">
                        <circle cx="11" cy="11" r="7"/>
                        <path d="m20 20-3.5-3.5"/>
                    </svg>
                    <input
                        type="text"
                        class="actors__input"
                        placeholder="Search for a person — name, role, anything"
                        :value="searchTerm"
                        aria-label="Search actors"
                        @input="onSearchInput"
                    />
                    <button
                        v-if="searchTerm"
                        type="button"
                        class="actors__clear"
                        aria-label="Clear search"
                        @click="clearSearch"
                    >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6 6 18M6 6l12 12" stroke-linecap="round"/>
                        </svg>
                    </button>
                </form>
            </section>

            <section class="actors__body container-lm">
                <header class="actors__results-head">
                    <div class="actors__results-meta">
                        <p class="eyebrow actors__results-eyebrow">{{ resultsEyebrow }}</p>
                        <h2 class="actors__results-title">{{ resultsTitle }}</h2>
                    </div>

                    <p v-if="totalResults" class="meta actors__count">
                        {{ totalResults.toLocaleString() }} people
                    </p>
                </header>

                <div v-if="isLoading && !results.length" class="actors__loading" role="status">
                    <div
                        v-for="n in 12"
                        :key="`s-${n}`"
                        class="actors__skeleton"
                        aria-hidden="true"
                    >
                        <div class="actors__skeleton-circle" />
                        <div class="actors__skeleton-line" />
                        <div class="actors__skeleton-line actors__skeleton-line--short" />
                    </div>
                </div>

                <div v-else-if="!results.length" class="actors__empty">
                    <div class="actors__empty-icon" aria-hidden="true">
                        <svg viewBox="0 0 64 64" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.4">
                            <circle cx="32" cy="22" r="10"/>
                            <path d="M14 54c4-10 12-14 18-14s14 4 18 14"/>
                        </svg>
                    </div>
                    <h3 class="actors__empty-title display">No one by that name.</h3>
                    <p class="actors__empty-desc">
                        Spelling, perhaps — or try the popular roster while we wait for the
                        casting call.
                    </p>
                    <button type="button" class="actors__empty-reset" @click="clearSearch">
                        Show popular people
                    </button>
                </div>

                <div v-else class="actors__grid">
                    <PersonCard
                        v-for="person in results"
                        :key="person.id"
                        :id="person.id"
                        :name="person.name"
                        :profile-path="person.profile_path"
                        :department="person.known_for_department || ''"
                    />
                </div>

                <div
                    v-if="results.length && (hasMore || isLoadingMore)"
                    ref="scrollSentinel"
                    class="actors__sentinel"
                    aria-hidden="true"
                >
                    <div v-if="isLoadingMore" class="actors__sentinel-grid">
                        <div
                            v-for="n in 4"
                            :key="`more-${n}`"
                            class="actors__skeleton"
                        >
                            <div class="actors__skeleton-circle" />
                            <div class="actors__skeleton-line" />
                            <div class="actors__skeleton-line actors__skeleton-line--short" />
                        </div>
                    </div>
                </div>
            </section>
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, onMounted, onBeforeUnmount, ref } from 'vue';
import { debounce } from '../utils/memoization';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import PersonCard from '../components/cards/PersonCard.vue';
import { useActor, Actor } from '../composables/useActor';
import { addSearchTerm } from '../composables/useHistory';
import { useInfiniteScroll } from '../composables/useLazyLoad';

export default defineComponent({
    name: 'Actors',
    components: { SiteHeader, SiteFooter, PersonCard },
    setup() {
        const { fetchTopActors } = useActor();

        const results = ref<Actor[]>([]);
        const page = ref(1);
        const totalPages = ref(1);
        const totalResults = ref(0);
        const isLoading = ref(false);
        const isLoadingMore = ref(false);
        const searchTerm = ref('');

        const buildPopularUrl = (pageNum: number): string =>
            `https://api.themoviedb.org/3/person/popular?page=${pageNum}`;

        const buildSearchUrl = (pageNum: number): string => {
            const params = new URLSearchParams({
                query: searchTerm.value,
                page: String(pageNum),
                include_adult: 'false'
            });
            return `https://api.themoviedb.org/3/search/person?${params.toString()}`;
        };

        const fetchPage = async (pageNum: number, append: boolean) => {
            if (append) isLoadingMore.value = true;
            else isLoading.value = true;

            try {
                const url = searchTerm.value
                    ? buildSearchUrl(pageNum)
                    : buildPopularUrl(pageNum);
                const { data } = await fetchTopActors(url);
                const fresh = (data.value?.results ?? []) as Actor[];
                totalPages.value = data.value?.total_pages ?? 0;
                totalResults.value = data.value?.total_results ?? 0;
                page.value = pageNum;
                results.value = append ? [...results.value, ...fresh] : fresh;
            } finally {
                isLoading.value = false;
                isLoadingMore.value = false;
            }
        };

        const reload = () => {
            page.value = 1;
            void fetchPage(1, false).then(() => drainPagesIfNeeded());
        };

        const scrollSentinel = ref<HTMLElement | null>(null);

        const hasMore = computed(() => page.value < totalPages.value);

        const scrollEnabled = computed(() => hasMore.value && results.value.length > 0);

        const loadMore = async () => {
            if (isLoadingMore.value || !hasMore.value) return;
            await fetchPage(page.value + 1, true);
            void drainPagesIfNeeded();
        };

        const sentinelNearViewport = () => {
            const el = scrollSentinel.value;
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            return rect.top <= window.innerHeight + 640;
        };

        const drainPagesIfNeeded = async () => {
            await nextTick();
            if (!hasMore.value || isLoadingMore.value || isLoading.value || !sentinelNearViewport()) {
                return;
            }
            await loadMore();
            await drainPagesIfNeeded();
        };

        useInfiniteScroll(scrollSentinel, loadMore, {
            enabled: scrollEnabled,
            busy: isLoadingMore
        });

        const debouncedSearch = debounce(() => {
            if (searchTerm.value) addSearchTerm(searchTerm.value);
            reload();
        }, 400);

        const onSearchInput = (e: Event) => {
            searchTerm.value = (e.target as HTMLInputElement).value;
            debouncedSearch();
        };

        const clearSearch = () => {
            searchTerm.value = '';
            reload();
        };

        const resultsEyebrow = computed(() => {
            if (searchTerm.value) return 'Searching';
            return 'On call';
        });

        const resultsTitle = computed(() => {
            if (searchTerm.value) return `"${searchTerm.value}"`;
            return 'Popular roster';
        });

        onMounted(() => {
            document.title = 'People — Moovie';
            void fetchPage(1, false).then(() => drainPagesIfNeeded());

            window.addEventListener('movora_settings_change', reload);
        });

        onBeforeUnmount(() => {
            window.removeEventListener('movora_settings_change', reload);
        });

        return {
            results,
            totalResults,
            isLoading,
            isLoadingMore,
            searchTerm,
            hasMore,
            scrollSentinel,
            resultsEyebrow,
            resultsTitle,
            onSearchInput,
            clearSearch
        };
    }
});
</script>

<style lang="scss" scoped>
.actors {
    position: relative;
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    &__main {
        padding-block: clamp(var(--s-6), 6vw, var(--s-8));
    }

    // ── Masthead ───────────────────────────────────────────────────────────
    &__masthead {
        padding-bottom: var(--s-5);
        border-bottom: 1px solid var(--rule);
        margin-bottom: var(--s-5);
    }

    &__search {
        display: flex;
        align-items: center;
        gap: var(--s-3);
        padding: 0.75rem var(--s-4);
        background: var(--surface-tint);
        border: 1px solid var(--rule);
        border-radius: var(--r-pill);
        max-width: 520px;
        color: var(--bone-400);
        transition: border-color var(--dur-fast) var(--ease-out);

        &:focus-within {
            border-color: var(--ember);
            color: var(--bone-200);
        }
    }

    &__input {
        flex: 1;
        min-width: 0;
        background: transparent;
        border: 0;
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: var(--fs-base);
        outline: none;

        &::placeholder { color: var(--bone-500); }
    }

    &__clear {
        all: unset;
        cursor: pointer;
        color: var(--bone-400);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        transition: background-color var(--dur-fast) var(--ease-out);

        &:hover {
            background: var(--surface-tint-hover);
            color: var(--bone-200);
        }
    }

    // ── Body ──────────────────────────────────────────────────────────────
    &__body {
        padding-bottom: clamp(var(--s-7), 8vw, var(--s-10));
    }

    &__results-head {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        justify-content: space-between;
        gap: var(--s-5);
        margin-bottom: var(--s-6);
    }

    &__results-eyebrow {
        color: var(--bone-400);
        margin: 0 0 var(--s-2);
    }

    &__results-title {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: clamp(1.5rem, 3vw, 2.2rem);
        color: var(--bone-50);
        margin: 0;
        letter-spacing: var(--ls-tight);
    }

    &__count {
        color: var(--bone-400);
    }

    // ── Grid ──────────────────────────────────────────────────────────────
    &__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: var(--s-6) var(--s-5);

        @media (max-width: 720px) {
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
            gap: var(--s-5) var(--s-4);
        }
    }

    // ── Loading skeleton ──────────────────────────────────────────────────
    &__loading {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: var(--s-6) var(--s-5);

        @media (max-width: 720px) {
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
        }
    }

    &__skeleton {
        display: grid;
        gap: var(--s-3);
        text-align: center;
        justify-items: center;
    }

    &__skeleton-circle {
        width: 100%;
        aspect-ratio: 1;
        border-radius: 50%;
        background: linear-gradient(
            90deg,
            var(--ink-700) 0%,
            var(--ink-600) 50%,
            var(--ink-700) 100%
        );
        background-size: 200% 100%;
        animation: shimmer 1.6s linear infinite;
    }

    &__skeleton-line {
        width: 80%;
        height: 12px;
        border-radius: var(--r-sm);
        background: var(--ink-700);

        &--short { width: 50%; height: 10px; opacity: 0.7; }
    }

    @keyframes shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }

    // ── Empty / error ─────────────────────────────────────────────────────
    &__empty {
        text-align: center;
        padding: clamp(var(--s-7), 8vw, var(--s-9)) var(--s-4);
        max-width: 520px;
        margin: 0 auto;
    }

    &__empty-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--bone-500);
        margin-bottom: var(--s-4);

        svg {
            width: 48px;
            height: 48px;
            opacity: 0.7;
        }
    }

    &__empty-title {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: clamp(1.6rem, 3vw, 2.2rem);
        color: var(--bone-50);
        margin: 0 0 var(--s-3);
        font-variation-settings: 'opsz' 96, 'SOFT' 40;
    }

    &__empty-desc {
        color: var(--bone-300);
        line-height: 1.55;
        max-width: 44ch;
        margin: 0 auto var(--s-5);
    }

    &__empty-reset {
        all: unset;
        cursor: pointer;
        padding: 0.6rem var(--s-5);
        background: var(--ember);
        color: var(--ink-900);
        border-radius: var(--r-pill);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 600;
        letter-spacing: var(--ls-snug);
        transition: transform var(--dur-fast) var(--ease-out);

        &:hover { transform: translateY(-1px); }
    }

    &__sentinel {
        margin-top: var(--s-6);
        min-height: 1px;
    }

    &__sentinel-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: var(--s-6) var(--s-5);

        @media (max-width: 720px) {
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
            gap: var(--s-5) var(--s-4);
        }
    }
}

@media (prefers-reduced-motion: reduce) {
    .actors__skeleton-circle { animation: none; }
}
</style>
