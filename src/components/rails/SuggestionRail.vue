<template>
    <section class="suggestion" :aria-label="'Suggest me something'">
        <div class="container-lm suggestion__inner">
            <div class="suggestion__body">
                <span class="eyebrow suggestion__eyebrow">{{ eyebrow }}</span>
                <h2 class="suggestion__title">{{ title }}</h2>
                <p class="suggestion__desc">{{ description }}</p>
            </div>

            <div v-if="!suggestion && !loading && !error" class="suggestion__action">
                <button type="button" class="suggestion__btn" @click="$emit('suggest')">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="M12 2l2.4 7.2L22 9.8l-5.6 4.6 1.8 7.6L12 17.8 5.8 22l1.8-7.6L2 9.8l7.6-.6z"/>
                    </svg>
                    <span>Suggest Me Something</span>
                </button>
            </div>

            <div v-if="loading" class="suggestion__loading">
                <span class="suggestion__spinner" aria-hidden="true" />
                <span>Thinking...</span>
            </div>

            <div v-if="error" class="suggestion__error">
                <p>{{ error }}</p>
                <button type="button" class="suggestion__retry" @click="$emit('suggest')">Try again</button>
            </div>

            <router-link
                v-if="suggestion"
                :to="detailRoute"
                class="suggestion__result"
            >
                <div v-if="posterUrl" class="suggestion__poster">
                    <img :src="posterUrl" :alt="suggestion.title" loading="lazy" decoding="async" />
                </div>
                <div class="suggestion__info">
                    <span class="suggestion__label">{{ suggestion.type === 'movie' ? 'Movie' : 'TV Show' }}</span>
                    <h3 class="suggestion__result-title">{{ suggestion.title }}</h3>
                    <p class="suggestion__reason">{{ suggestion.reason }}</p>
                    <span class="suggestion__watch">Watch now →</span>
                </div>
            </router-link>

            <div v-if="suggestion" class="suggestion__secondary">
                <button type="button" class="suggestion__retry" @click="$emit('suggest')">Not for me →</button>
            </div>
        </div>
    </section>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from 'vue'
import type { GeminiSuggestion } from '../../composables/useGemini'

export default defineComponent({
    name: 'SuggestionRail',
    props: {
        eyebrow: { type: String, default: 'Feeling Lucky' },
        title: { type: String, default: 'Suggest Me Something' },
        description: { type: String, default: 'Let AI pick a movie or show for you.' },
        suggestion: { type: Object as PropType<GeminiSuggestion | null>, default: null },
        loading: { type: Boolean, default: false },
        error: { type: String, default: '' }
    },
    emits: ['suggest'],
    setup(props) {
        const detailRoute = computed(() => {
            if (!props.suggestion) return ''
            const type = props.suggestion.type === 'tv' ? 'TVShow' : 'Movie'
            return { name: type, params: { id: props.suggestion.id.toString() } }
        })

        const posterUrl = computed(() => {
            if (!props.suggestion?.posterPath) return ''
            return `https://image.tmdb.org/t/p/w185${props.suggestion.posterPath}`
        })

        return { detailRoute, posterUrl }
    }
})
</script>

<style lang="scss" scoped>
.suggestion {
    margin-top: clamp(var(--s-8), 8vw, var(--s-10));
    padding: 0 var(--s-4);

    &__inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: var(--s-8) var(--s-4);
        border-radius: var(--r-lg);
        background: var(--ink-800);
        border: 1px solid var(--ink-700);
        gap: var(--s-6);
    }

    &__body {
        max-width: 480px;
    }

    &__eyebrow {
        color: var(--ember);
        margin-bottom: var(--s-2);
    }

    &__title {
        font-family: var(--font-display);
        font-size: clamp(1.3rem, 4vw, 1.75rem);
        font-weight: 500;
        margin: 0 0 var(--s-2);
    }

    &__desc {
        margin: 0;
        color: var(--bone-400);
        font-size: var(--fs-sm);
    }

    &__btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: var(--r-pill);
        background: var(--ember);
        color: var(--ink-900);
        font-family: var(--font-ui);
        font-size: 0.9rem;
        font-weight: 700;
        cursor: pointer;
        transition: opacity 0.2s;

        &:hover {
            opacity: 0.85;
        }
    }

    &__loading {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        color: var(--bone-400);
        font-size: var(--fs-sm);
    }

    &__spinner {
        width: 18px;
        height: 18px;
        border: 2px solid var(--ink-600);
        border-top-color: var(--ember);
        border-radius: 50%;
        animation: suggestion-spin 0.7s linear infinite;
    }

    &__error {
        color: var(--rose-400);
        font-size: var(--fs-sm);

        p {
            margin: 0 0 var(--s-2);
        }
    }

    &__retry {
        background: none;
        border: 1px solid var(--ink-600);
        color: var(--bone-300);
        padding: 0.4rem 1rem;
        border-radius: var(--r-pill);
        font-family: var(--font-ui);
        font-size: 0.8rem;
        cursor: pointer;
        transition: border-color 0.2s, color 0.2s;

        &:hover {
            border-color: var(--ember);
            color: var(--ember);
        }
    }

    &__result {
        display: flex;
        gap: var(--s-4);
        text-align: left;
        text-decoration: none;
        color: inherit;
        padding: var(--s-4);
        border-radius: var(--r-md);
        background: var(--ink-700);
        transition: background 0.2s;
        max-width: 420px;
        width: 100%;

        &:hover {
            background: var(--ink-600);
        }
    }

    &__poster {
        flex-shrink: 0;
        width: 80px;
        height: 120px;
        border-radius: var(--r-sm);
        overflow: hidden;
        background: var(--ink-600);

        img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
    }

    &__info {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        min-width: 0;
    }

    &__label {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--ember);
        font-weight: 700;
    }

    &__result-title {
        font-family: var(--font-display);
        font-size: 1.1rem;
        font-weight: 500;
        margin: 0;
    }

    &__reason {
        margin: 0;
        font-size: var(--fs-sm);
        color: var(--bone-400);
        line-height: 1.4;
    }

    &__watch {
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--ember);
        margin-top: auto;
    }

    &__secondary {
        margin-top: -0.5rem;
    }
}

@keyframes suggestion-spin {
    to { transform: rotate(360deg); }
}
</style>
