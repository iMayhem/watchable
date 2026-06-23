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
                <div class="opening-splash__grain" />
                <div class="opening-splash__vignette" />
                <div class="opening-splash__glow" />

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

            <button
                type="button"
                class="opening-splash__skip"
                @click.stop="dismiss"
            >
                Skip
            </button>
        </div>
    </Teleport>
</template>

<script lang="ts">
import { defineComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

const SPLASH_DURATION_MS = 6800;
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
                }, SPLASH_DURATION_MS - 1600)
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
    transition: opacity 1.8s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: opacity;

    &.is-fading {
        opacity: 0;
        pointer-events: none;
    }

    &__scene {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background: radial-gradient(circle at 50% 44%, #16100b 0%, #000 72%);
        overflow: hidden;
        perspective: 1100px;
        transform-style: preserve-3d;
    }

    &__grain {
        position: absolute;
        inset: -50%;
        opacity: 0.1;
        background-image:
            radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.55) 0.35px, transparent 0.45px),
            radial-gradient(circle at 80% 40%, rgba(255, 255, 255, 0.4) 0.35px, transparent 0.45px);
        background-size: 4px 4px, 5px 5px;
        animation: splash-grain 10s linear infinite;
        pointer-events: none;
    }

    &__vignette {
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at center, transparent 42%, rgba(0, 0, 0, 0.65) 100%);
        pointer-events: none;
    }

    &__glow {
        position: absolute;
        inset: 0;
        background: radial-gradient(
            ellipse 48% 32% at 50% 48%,
            rgba(255, 90, 31, 0.22) 0%,
            rgba(255, 90, 31, 0.06) 42%,
            transparent 72%
        );
        animation: splash-glow 6s ease-in-out infinite;
        pointer-events: none;
    }

    &__word-wrap {
        position: relative;
        z-index: 2;
        transform-style: preserve-3d;
    }

    &__word {
        display: flex;
        align-items: baseline;
        justify-content: center;
        gap: 0.04em;
        padding: 0 1rem;
        transform-origin: center center;
        transform-style: preserve-3d;
        animation: splash-rush-toward 2.35s cubic-bezier(0.32, 0.72, 0.22, 1) 2.95s forwards;
        will-change: transform, opacity, filter;
    }

    &__letter {
        --delay: calc(0.1s + (var(--i) * 0.38s));
        display: inline-block;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: clamp(3.6rem, 13.5vmin, 6.2rem);
        font-weight: 700;
        line-height: 1;
        letter-spacing: -0.03em;
        color: #f5efe4;
        opacity: 0;
        transform: translate3d(0, 10px, -60px) scale(0.82);
        transform-origin: center center;
        text-shadow:
            0 0 16px rgba(255, 90, 31, 0.28),
            0 0 36px rgba(255, 90, 31, 0.1);
        animation: splash-letter 0.78s cubic-bezier(0.22, 1, 0.36, 1) var(--delay) forwards;
        will-change: transform, opacity;
        -webkit-font-smoothing: antialiased;
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
        color: rgba(245, 239, 228, 0.42);
        opacity: 0;
        transform: translate3d(0, 8px, 0);
        animation: splash-tagline 1s cubic-bezier(0.22, 1, 0.36, 1) 2.45s forwards;
    }

    &__skip {
        position: absolute;
        right: max(1rem, env(safe-area-inset-right));
        bottom: max(1rem, env(safe-area-inset-bottom));
        z-index: 3;
        padding: 0.45rem 0.85rem;
        border: 1px solid rgba(245, 239, 228, 0.18);
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.55);
        color: rgba(245, 239, 228, 0.78);
        font-family: var(--font-ui);
        font-size: 0.74rem;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
        transition:
            border-color 0.15s ease,
            color 0.15s ease,
            background 0.15s ease;

        &:hover {
            border-color: rgba(255, 90, 31, 0.45);
            color: #f5efe4;
            background: rgba(255, 90, 31, 0.12);
        }
    }
}

@keyframes splash-grain {
    from { transform: translate3d(0, 0, 0); }
    to { transform: translate3d(-2%, -1.5%, 0); }
}

@keyframes splash-glow {
    0%, 100% { opacity: 0.82; }
    50% { opacity: 1; }
}

@keyframes splash-letter {
    0% {
        opacity: 0;
        transform: translate3d(0, 10px, -60px) scale(0.82);
    }

    100% {
        opacity: 1;
        transform: translate3d(0, 0, 0) scale(1);
        text-shadow:
            0 0 20px rgba(255, 90, 31, 0.42),
            0 0 40px rgba(255, 90, 31, 0.16);
    }
}

@keyframes splash-rush-toward {
    0% {
        opacity: 1;
        transform: translate3d(0, 0, -40px) scale(0.88);
        filter: blur(0);
    }

    42% {
        opacity: 1;
        transform: translate3d(0, 0, 30px) scale(1.18);
        filter: blur(0);
    }

    100% {
        opacity: 0;
        transform: translate3d(0, 0, 280px) scale(3.6);
        filter: blur(12px);
    }
}

@keyframes splash-tagline {
    to {
        opacity: 1;
        transform: translate3d(0, 0, 0);
    }
}

@media (prefers-reduced-motion: reduce) {
    .opening-splash__word,
    .opening-splash__letter,
    .opening-splash__tagline,
    .opening-splash__grain,
    .opening-splash__glow {
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
        filter: none !important;
    }
}
</style>