<template>
    <Teleport to="body">
        <div
            v-if="visible"
            class="opening-splash"
            :class="{ 'is-fading': fading }"
            role="presentation"
            aria-hidden="true"
            @click="dismiss"
        >
            <div class="opening-splash__scene">
                <div class="opening-splash__vignette" />

                <div class="opening-splash__word-wrap">
                    <div class="opening-splash__word">
                        <span
                            v-for="(letter, index) in letters"
                            :key="`${letter}-${index}`"
                            class="opening-splash__letter"
                            :style="{ '--i': index }"
                        >
                            {{ letter }}
                        </span>
                    </div>
                </div>

                <p class="opening-splash__tagline">a cinema periodical</p>
            </div>

        </div>
    </Teleport>
</template>

<script lang="ts">
import { defineComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

const SPLASH_DURATION_MS = 5600;
const LETTERS = ['m', 'o', 'o', 'v', 'i', 'e'] as const;

export default defineComponent({
    name: 'OpeningSplash',
    setup() {
        const route = useRoute();
        const visible = ref(false);
        const fading = ref(false);
        const timers: number[] = [];
        const letters = LETTERS;

        const shouldPlay = () => {
            if (route.meta.bareLayout) return false;
            if (route.query.embed === 'party') return false;
            if (route.query.nosplash === '1') return false;
            if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                return false;
            }
            return true;
        };

        const setScrollLock = (locked: boolean) => {
            document.documentElement.classList.toggle('moovie-splash-lock', locked);
        };

        const clearTimers = () => {
            timers.forEach((id) => window.clearTimeout(id));
            timers.length = 0;
        };

        const finish = () => {
            if (!visible.value) return;
            clearTimers();
            fading.value = false;
            visible.value = false;
            setScrollLock(false);
        };

        const dismiss = () => finish();

        const start = () => {
            if (!shouldPlay()) return;

            clearTimers();
            fading.value = false;
            visible.value = true;
            setScrollLock(true);

            timers.push(
                window.setTimeout(() => {
                    fading.value = true;
                }, SPLASH_DURATION_MS - 1200)
            );

            timers.push(
                window.setTimeout(() => {
                    finish();
                }, SPLASH_DURATION_MS)
            );
        };

        const onKeydown = (event: KeyboardEvent) => {
            if (!visible.value) return;
            if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                dismiss();
            }
        };

        onMounted(() => {
            start();
            window.addEventListener('keydown', onKeydown);
        });

        onBeforeUnmount(() => {
            clearTimers();
            setScrollLock(false);
            window.removeEventListener('keydown', onKeydown);
        });

        return {
            visible,
            fading,
            letters,
            dismiss
        };
    }
});
</script>

<style lang="scss">
html.moovie-splash-lock,
html.moovie-splash-lock body {
    overflow: hidden !important;
}
</style>

<style lang="scss" scoped>
.opening-splash {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: #000;
    opacity: 1;
    transition: opacity 1.1s ease-out;

    &.is-fading {
        opacity: 0;
        pointer-events: none;
    }

    &__scene {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background: #0b0a08;
        overflow: hidden;
    }

    &__vignette {
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at center, transparent 50%, rgba(0, 0, 0, 0.55) 100%);
        pointer-events: none;
    }

    &__word-wrap {
        position: relative;
        z-index: 2;
    }

    &__word {
        display: flex;
        align-items: baseline;
        justify-content: center;
        gap: 0.05em;
        padding: 0 1rem;
        transform-origin: center center;
        animation: splash-rush-toward 1.65s cubic-bezier(0.25, 0.8, 0.25, 1) 2.15s forwards;
    }

    &__letter {
        --delay: calc(0.08s + (var(--i) * 0.3s));
        display: inline-block;
        font-family: var(--font-display);
        font-size: clamp(3.4rem, 12vmin, 5.8rem);
        font-weight: 700;
        line-height: 1;
        letter-spacing: -0.02em;
        color: #f5efe4;
        opacity: 0;
        transform: translateY(8px);
        animation: splash-letter 0.55s ease-out var(--delay) forwards;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }

    &__tagline {
        position: absolute;
        bottom: clamp(2rem, 8vmin, 4rem);
        z-index: 2;
        font-family: var(--font-ui);
        font-size: clamp(0.72rem, 2.2vmin, 0.88rem);
        font-weight: 600;
        letter-spacing: 0.22em;
        text-transform: lowercase;
        color: rgba(245, 239, 228, 0.5);
        opacity: 0;
        animation: splash-tagline 0.7s ease-out 1.95s forwards;
    }

}

@keyframes splash-letter {
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes splash-rush-toward {
    0% {
        opacity: 1;
        transform: scale(0.92);
    }

    35% {
        opacity: 1;
        transform: scale(1);
    }

    100% {
        opacity: 0;
        transform: scale(1.72);
    }
}

@keyframes splash-tagline {
    to {
        opacity: 1;
    }
}

@media (prefers-reduced-motion: reduce) {
    .opening-splash__word,
    .opening-splash__letter,
    .opening-splash__tagline {
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
    }
}
</style>