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
            <iframe
                v-if="iframeSrc"
                class="opening-splash__frame"
                :src="iframeSrc"
                title="Moovie opening"
                allow="autoplay"
            />
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
const SPLASH_PATH = '/splash_screens/moovie-sting/index.html';

export default defineComponent({
    name: 'OpeningSplash',
    setup() {
        const route = useRoute();
        const visible = ref(false);
        const fading = ref(false);
        const iframeSrc = ref('');
        const timers: number[] = [];

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
            iframeSrc.value = '';
            setScrollLock(false);
        };

        const dismiss = () => finish();

        const start = () => {
            if (!shouldPlay()) return;

            clearTimers();
            fading.value = false;
            visible.value = true;
            iframeSrc.value = `${SPLASH_PATH}?t=${Date.now()}`;
            setScrollLock(true);

            timers.push(
                window.setTimeout(() => {
                    fading.value = true;
                }, SPLASH_DURATION_MS - 1500)
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
            iframeSrc,
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
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
    animation: splash-fade-out 1.5s ease-in-out forwards;
    animation-play-state: paused;

    &.is-fading {
        animation-play-state: running;
    }

    &__frame {
        width: 100%;
        height: 100%;
        border: 0;
        background: #000;
    }

    &__skip {
        position: absolute;
        right: max(1rem, env(safe-area-inset-right));
        bottom: max(1rem, env(safe-area-inset-bottom));
        z-index: 2;
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

@keyframes splash-fade-out {
    from {
        opacity: 1;
        transform: scale(1);
    }

    to {
        opacity: 0;
        transform: scale(0.97);
    }
}
</style>