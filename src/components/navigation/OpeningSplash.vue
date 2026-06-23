<template>
    <Teleport to="body">
        <div
            v-if="mounted"
            class="opening-splash"
            :class="{ 'is-fading': fading }"
            role="presentation"
            aria-hidden="true"
            @transitionend="onFadeEnd"
        >
            <div class="opening-splash__scene">
                <span class="opening-splash__bloom" aria-hidden="true" />
                <span class="opening-splash__grain grain" aria-hidden="true" />

                <div class="opening-splash__brand">
                    <div class="opening-splash__wordmark" aria-hidden="true">
                        <span
                            v-for="(letter, index) in letters"
                            :key="`${letter}-${index}`"
                            class="opening-splash__letter"
                            :style="{ '--i': index }"
                        >
                            {{ letter }}
                        </span>
                    </div>
                    <p class="eyebrow opening-splash__eyebrow">A Cinema Periodical</p>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script lang="ts">
import { defineComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useOpeningSplash } from '../../composables/useOpeningSplash';

const SPLASH_DURATION_MS = 5200;
const FADE_MS = 900;
const LETTERS = ['m', 'o', 'o', 'v', 'i', 'e'] as const;

export default defineComponent({
    name: 'OpeningSplash',
    setup() {
        const route = useRoute();
        const { setSplashActive } = useOpeningSplash();
        const mounted = ref(false);
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

        const teardown = () => {
            clearTimers();
            fading.value = false;
            mounted.value = false;
            setSplashActive(false);
            setScrollLock(false);
        };

        const onFadeEnd = (event: TransitionEvent) => {
            if (event.propertyName !== 'opacity' || !fading.value) return;
            teardown();
        };

        const startFade = () => {
            if (!mounted.value || fading.value) return;
            fading.value = true;
            // Restore scroll + layout before the overlay fades so the header doesn't jump.
            setScrollLock(false);
        };

        const start = () => {
            if (!shouldPlay()) return;

            clearTimers();
            fading.value = false;
            mounted.value = true;
            setSplashActive(true);
            setScrollLock(true);

            timers.push(
                window.setTimeout(() => {
                    startFade();
                }, SPLASH_DURATION_MS - FADE_MS)
            );

            timers.push(
                window.setTimeout(() => {
                    if (fading.value) teardown();
                }, SPLASH_DURATION_MS + 120)
            );
        };

        onMounted(() => {
            start();
        });

        onBeforeUnmount(() => {
            teardown();
        });

        return {
            mounted,
            fading,
            letters,
            onFadeEnd
        };
    }
});
</script>

<style lang="scss">
html.moovie-splash-lock,
html.moovie-splash-lock body {
    overflow: hidden !important;
}

html.moovie-splash-lock .site-header,
html.moovie-splash-lock .site-header::before {
    transition: none !important;
}
</style>

<style lang="scss" scoped>
.opening-splash {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: var(--ink-900);
    opacity: 1;
    transition: opacity 0.9s var(--ease-out);

    &.is-fading {
        opacity: 0;
        pointer-events: none;
    }

    &__scene {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background: var(--ink-900);
        color: var(--bone-50);
        isolation: isolate;
        overflow: hidden;
    }

    &__bloom {
        position: absolute;
        inset: -25% -15%;
        z-index: 0;
        background:
            radial-gradient(ellipse at 18% 12%, rgba(255, 90, 31, 0.2) 0%, transparent 52%),
            radial-gradient(ellipse at 82% 78%, rgba(201, 167, 106, 0.14) 0%, transparent 55%),
            radial-gradient(ellipse at 50% 100%, rgba(229, 9, 20, 0.08) 0%, transparent 48%),
            radial-gradient(ellipse at center, var(--ink-850) 0%, var(--ink-900) 72%);
        filter: blur(24px);
        pointer-events: none;
    }

    &__grain {
        position: absolute;
        inset: 0;
        z-index: 1;
        opacity: 0.45;
        pointer-events: none;
    }

    &__brand {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--s-3);
        text-align: center;
    }

    &__wordmark {
        display: inline-flex;
        align-items: baseline;
        justify-content: center;
        letter-spacing: -0.07em;
        line-height: 0.85;
    }

    &__letter {
        --delay: calc(var(--i) * 0.34s);
        display: inline-block;
        font-family: var(--font-display);
        font-weight: 800;
        font-size: clamp(3rem, 13vw, 5.25rem);
        text-transform: lowercase;
        background: linear-gradient(135deg, var(--ember) 0%, #ff8a00 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        opacity: 0;
        transform: translateY(10px);
        animation: splash-letter-in var(--dur-slow) var(--ease-out) var(--delay) forwards;
    }

    &__eyebrow {
        margin: 0;
        color: var(--bone-400);
        opacity: 0;
        animation: splash-eyebrow-in var(--dur-slow) var(--ease-out) 1.95s forwards;
    }
}

@keyframes splash-letter-in {
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes splash-eyebrow-in {
    to {
        opacity: 1;
    }
}

@media (prefers-reduced-motion: reduce) {
    .opening-splash__letter,
    .opening-splash__eyebrow {
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
    }
}
</style>