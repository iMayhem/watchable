<template>
    <div v-if="visible" class="mode-gate" role="dialog" aria-modal="true" aria-labelledby="mode-gate-title">
        <div class="mode-gate__backdrop" aria-hidden="true" />
        <div class="mode-gate__panel">
            <p class="mode-gate__eyebrow eyebrow">Welcome to moovie</p>
            <h1 id="mode-gate-title" class="mode-gate__title display">Choose your catalogue</h1>
            <p class="mode-gate__copy">
                Pick how you want to browse. You can switch anytime from the header.
            </p>

            <div class="mode-gate__choices">
                <button type="button" class="mode-gate__card mode-gate__card--netflix" @click="choose('netflix')">
                    <span class="mode-gate__card-badge">Stream</span>
                    <span class="mode-gate__card-title">Netflix</span>
                    <span class="mode-gate__card-desc">
                        Hindi, Hollywood, Telugu, Tamil, Malayalam, Korean and more — playable in-browser.
                    </span>
                </button>

                <button type="button" class="mode-gate__card mode-gate__card--global" @click="choose('global')">
                    <span class="mode-gate__card-badge">Discover</span>
                    <span class="mode-gate__card-title">Global</span>
                    <span class="mode-gate__card-desc">
                        The full moovie periodical — TMDB films, series, anime and regional editions.
                    </span>
                </button>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue';
import { useRouter } from 'vue-router';
import { getContentMode, type ContentMode } from '../../composables/useContentMode';

export default defineComponent({
    name: 'ContentModeGate',
    setup() {
        const router = useRouter();
        const { contentMode, setContentMode } = getContentMode();

        const visible = computed(() => contentMode.value !== 'global' && contentMode.value !== 'netflix');

        const choose = (mode: ContentMode) => {
            setContentMode(mode);
            if (router.currentRoute.value.path !== '/') {
                router.push('/');
            }
        };

        return { visible, choose };
    }
});
</script>

<style lang="scss" scoped>
.mode-gate {
    position: fixed;
    inset: 0;
    z-index: 20000;
    display: grid;
    place-items: center;
    padding: var(--s-5);

    &__backdrop {
        position: absolute;
        inset: 0;
        background: rgba(11, 10, 8, 0.88);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
    }

    &__panel {
        position: relative;
        width: min(920px, 100%);
        padding: clamp(var(--s-6), 5vw, var(--s-8));
        background: var(--ink-850);
        border: 1px solid var(--rule-strong);
        border-radius: var(--r-lg);
        box-shadow: 0 40px 100px -30px rgba(0, 0, 0, 0.75);
        text-align: center;
    }

    &__eyebrow {
        color: var(--ember);
        margin-bottom: var(--s-3);
    }

    &__title {
        margin: 0 0 var(--s-3);
        color: var(--bone-50);
        font-size: clamp(2rem, 5vw, 3rem);
    }

    &__copy {
        margin: 0 auto var(--s-6);
        max-width: 52ch;
        color: var(--bone-300);
        font-size: var(--fs-sm);
        line-height: var(--lh-base);
    }

    &__choices {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--s-4);
    }

    &__card {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--s-2);
        padding: var(--s-5);
        border-radius: var(--r-md);
        border: 1px solid var(--rule);
        background: var(--ink-800);
        color: var(--bone-50);
        text-align: left;
        cursor: pointer;
        transition:
            transform var(--dur-base) var(--ease-out),
            border-color var(--dur-base) var(--ease-out),
            box-shadow var(--dur-base) var(--ease-out);

        &:hover {
            transform: translateY(-3px);
            border-color: var(--rule-strong);
            box-shadow: 0 20px 50px -20px rgba(0, 0, 0, 0.6);
        }

        &--netflix:hover {
            border-color: rgba(229, 9, 20, 0.55);
        }

        &--global:hover {
            border-color: rgba(255, 138, 61, 0.55);
        }
    }

    &__card-badge {
        font-family: var(--font-mono);
        font-size: 0.68rem;
        letter-spacing: var(--ls-micro);
        text-transform: uppercase;
        color: var(--bone-400);
    }

    &__card-title {
        font-family: var(--font-display);
        font-size: clamp(1.5rem, 3vw, 2rem);
        font-weight: 500;
        letter-spacing: var(--ls-tight);
    }

    &__card-desc {
        color: var(--bone-300);
        font-size: var(--fs-sm);
        line-height: var(--lh-base);
    }
}

@media (max-width: 720px) {
    .mode-gate__choices {
        grid-template-columns: 1fr;
    }
}
</style>