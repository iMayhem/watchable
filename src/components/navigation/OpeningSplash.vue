<template>
    <Teleport to="body">
        <div
            v-if="visible"
            class="opening-splash"
            :class="{ 'is-fading': fading }"
            role="presentation"
            aria-hidden="true"
        >
            <div class="opening-splash__scene">
                <span class="opening-splash__bloom" aria-hidden="true" />
                <span class="opening-splash__grain grain" aria-hidden="true" />

                <div class="opening-splash__brand" :class="{ 'is-settling': settling }">
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

const SPLASH_DURATION_MS = 5200;
const LETTERS = ['m', 'o', 'o', 'v', 'i', 'e'] as const;

export default defineComponent({
    name: 'OpeningSplash',
    setup() {
        const route = useRoute();
        const visible = ref(false);
        const fading = ref(false);
        const settling = ref(false);
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
            settling.value = false;
            visible.value = false;
            setScrollLock(false);
        };

        const start = () => {
            if (!shouldPlay()) return;

            clearTimers();
            fading.value = false;
            settling.value = false;
            visible.value = true;
            setScrollLock(true);

            timers.push(
                window.setTimeout(() => {
                    settling.value = true;
                }, 2600)
            );

            timers.push(
                window.setTimeout(() => {
                    fading.value = true;
                }, SPLASH_DURATION_MS - 1100)
            );

            timers.push(
                window.setTimeout(() => {
                    finish();
                }, SPLASH_DURATION_MS)
            );
        };

        onMounted(() => {
            start();
        });

        onBeforeUnmount(() => {
            clearTimers();
            setScrollLock(false);
        });

        return {
            visible,
            fading,
            settling,
            letters
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
    background: var(--ink-900);
    opacity: 1;
    transition: opacity 1.1s var(--ease-out);

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
        transition:
            opacity var(--dur-slow) var(--ease-out),
            transform var(--dur-slow) var(--ease-out);

        &.is-settling {
            opacity: 0;
            transform: translateY(-6px);
        }
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
    .opening-splash__eyebrow,
    .opening-splash__brand {
        animation: none !important;
        transition: none !important;
        opacity: 1 !important;
        transform: none !important;
    }
}
</style>