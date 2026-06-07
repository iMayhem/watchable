<template>
    <div ref="rootRef" class="stream-frame" :class="{ 'has-error': hasError }">
        <div
            v-if="ambientImage"
            class="stream-frame__bloom"
            :style="{ backgroundImage: `url(${ambientImage})` }"
            aria-hidden="true"
        />

        <div class="stream-frame__stage">
            <div class="stream-frame__player">
                <!-- Standard iframe embed -->
                <iframe
                    v-if="embedUrl && !hasError"
                    :key="embedUrl"
                    ref="frameEl"
                    :src="embedUrl"
                    :title="title"
                    class="stream-frame__iframe"
                    :class="{ 'is-loading': iframeLoading }"
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                    allowfullscreen
                    frameborder="0"
                    :sandbox="sandboxAttribute"
                    @load="onLoad"
                    @error="onError"
                />
                <!-- Loading state -->
                <div v-if="iframeLoading && !hasError" class="stream-frame__loading">
                    <div class="stream-frame__loading-pulse">
                        <div class="stream-frame__loading-spinner">
                            <span class="spinner-ring spinner-ring--1"></span>
                            <span class="spinner-ring spinner-ring--2"></span>
                            <span class="spinner-ring spinner-ring--3"></span>
                        </div>
                        <p class="loading-text">Preparing projector</p>
                        <p class="stream-frame__adblock-tip">Tip — Use an Adblocker for a cleaner experience</p>
                    </div>
                </div>

                <!-- Error state -->
                <div v-if="hasError" class="stream-frame__error" role="alert">
                    <p class="eyebrow">Reel jam</p>
                    <h3>The frame didn't catch.</h3>
                    <p class="stream-frame__error-message">
                        Try a different server below, or reload this projector.
                    </p>
                    <button type="button" class="stream-frame__retry" @click="retry">Reload</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, onUnmounted, ref, watch } from 'vue';
import { useWebImage } from '../../utils/useWebImage';
import { useAmbientColor } from '../../composables/useAmbientColor';
import { startProgressTracking } from '../../composables/useProgress';

export default defineComponent({
    name: 'StreamFrame',
    props: {
        embedUrl: { type: String, default: '' },
        title: { type: String, default: 'Stream' },
        backdropPath: { type: String, default: '' },
        posterPath: { type: String, default: '' },
        mediaId: { type: [String, Number], default: '' },
        mediaType: { type: String as () => 'movie' | 'tv' | 'anime', default: 'movie' },
        season: { type: Number, default: 0 },
        episode: { type: Number, default: 0 }
    },
    emits: ['switch-to-server'],
    setup(props) {
        const rootRef = ref<HTMLElement | null>(null);
        const frameEl = ref<HTMLIFrameElement | null>(null);
        const hasError = ref(false);
        const iframeLoading = ref(true);

        const sandboxAttribute = computed(() => {
            if (!props.embedUrl) return undefined;
            const url = props.embedUrl.toLowerCase();
            if (
                url.includes('cinemaos.tech') ||
                url.includes('smashystream.com') ||
                url.includes('animeplay.cfd')
            ) {
                return 'allow-scripts allow-same-origin allow-forms';
            }
            return undefined;
        });

        const ambientPath = computed(() => props.backdropPath || props.posterPath || null);
        useAmbientColor(ambientPath, rootRef);

        let stopTracking: (() => void) | null = null;

        const startTrackingIfNeeded = () => {
            if (stopTracking) {
                stopTracking();
                stopTracking = null;
            }
            if (props.mediaId && props.embedUrl) {
                stopTracking = startProgressTracking(
                    props.mediaId,
                    props.mediaType,
                    props.mediaType === 'tv' ? props.season : undefined,
                    props.mediaType === 'tv' || props.mediaType === 'anime' ? props.episode : undefined
                );
            }
        };

        const ambientImage = ref<string>('');
        const computeAmbient = () => {
            const path = props.backdropPath || props.posterPath;
            ambientImage.value = path ? useWebImage(path, 'large') : '';
        };

        const onLoad = () => {
            hasError.value = false;
            iframeLoading.value = false;
        };

        const onError = () => {
            hasError.value = true;
        };

        const retry = () => {
            hasError.value = false;
            iframeLoading.value = true;
            if (frameEl.value && props.embedUrl) {
                const src = frameEl.value.src;
                frameEl.value.src = '';
                window.setTimeout(() => {
                    if (frameEl.value) frameEl.value.src = src;
                }, 80);
            }
        };

        watch(
            () => props.embedUrl,
            (next, prev) => {
                if (next && next !== prev) {
                    hasError.value = false;
                    iframeLoading.value = true;
                    startTrackingIfNeeded();
                }
            }
        );

        watch(
            () => [props.backdropPath, props.posterPath],
            () => computeAmbient(),
            { immediate: true }
        );

        onMounted(() => {
            startTrackingIfNeeded();
        });

        onUnmounted(() => {
            if (stopTracking) {
                stopTracking();
                stopTracking = null;
            }
        });

        return {
            rootRef,
            frameEl,
            hasError,
            iframeLoading,
            ambientImage,
            sandboxAttribute,
            onLoad,
            onError,
            retry
        };
    }
});
</script>

<style lang="scss" scoped>
.stream-frame {
    position: relative;
    width: 100%;
    isolation: isolate;

    &__bloom {
        position: absolute;
        inset: -10% -5%;
        width: fit-content;
        background-size: cover;
        background-position: center;
        filter: blur(80px) saturate(1.4) brightness(0.55);
        opacity: 0.55;
        z-index: -1;
        pointer-events: none;

        &::after {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(
                ellipse at center,
                transparent 0%,
                var(--ink-900) 78%
            );
        }
    }

    &__stage {
        position: relative;
        width: 100%;
        max-width: 1280px;
        margin: 0 auto;
        padding: 0 var(--s-4) var(--s-5) var(--s-4);

        @media (min-width: 768px) and (max-width: 1023px) {
            padding: 0 var(--s-5) var(--s-6) var(--s-5);
        }

        @media (min-width: 1024px) {
            padding: 0;
        }
    }

    &__player {
        position: relative;
        aspect-ratio: 16 / 9;
        background: #000;
        border-radius: var(--r-lg);
        overflow: hidden;
        box-shadow:
            0 32px 80px rgba(0, 0, 0, 0.6),
            0 0 60px rgba(var(--ambient), 0.18),
            0 0 0 1px var(--rule);
        transition: box-shadow var(--dur-slow) var(--ease-out);
    }

    &__iframe {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: 0;
        transition: opacity var(--dur-base) var(--ease-out);

        &.is-loading {
            opacity: 0;
            pointer-events: none;
        }
    }

    &__loading {
        position: absolute;
        inset: 0;
        display: grid;
        place-content: center;
        text-align: center;
        background: linear-gradient(135deg, var(--ink-950) 0%, var(--ink-900) 100%);
        z-index: 4;
    }

    &__loading-pulse {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--s-3);
        animation: stream-pulse-anim 1.8s infinite ease-in-out;
    }

    &__loading-spinner {
        position: relative;
        width: 64px;
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: var(--s-2);

        .spinner-dot {
            width: 8px;
            height: 8px;
            background-color: var(--bone-300);
            border-radius: 50%;
            position: absolute;
            box-shadow: 0 0 8px rgba(245, 239, 228, 0.4);
        }

        .spinner-ring {
            position: absolute;
            border-radius: 50%;
            border: 2px solid transparent;
            
            &--1 {
                width: 28px;
                height: 28px;
                border-width: 1.5px;
                border-top-color: rgba(245, 239, 228, 0.3);
                animation: stream-spin-clockwise 1.2s linear infinite;
            }

            &--2 {
                width: 44px;
                height: 44px;
                border-width: 2px;
                border-top-color: rgba(245, 239, 228, 0.55);
                border-right-color: rgba(245, 239, 228, 0.55);
                animation: stream-spin-counter 1.6s linear infinite;
            }

            &--3 {
                width: 60px;
                height: 60px;
                border-width: 2.5px;
                border-top-color: var(--bone-100);
                border-right-color: var(--bone-100);
                border-left-color: var(--bone-100);
                animation: stream-spin-clockwise 2.2s linear infinite;
                box-shadow: 0 0 10px rgba(245, 239, 228, 0.05);
            }
        }
    }

    .loading-text {
        font-family: var(--font-mono);
        color: var(--bone-400);
        font-size: var(--fs-xs);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        margin: 0;
    }

    &__adblock-tip {
        font-family: var(--font-ui);
        color: var(--ember);
        font-size: var(--fs-xs);
        margin-top: var(--s-3);
        letter-spacing: var(--ls-micro);
        opacity: 0.85;
    }

    @keyframes stream-pulse-anim {
        0%, 100% {
            opacity: 0.7;
        }
        50% {
            opacity: 1;
        }
    }

    @keyframes stream-spin-clockwise {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }

    @keyframes stream-spin-counter {
        from {
            transform: rotate(360deg);
        }
        to {
            transform: rotate(0deg);
        }
    }

    &__error {
        position: absolute;
        inset: 0;
        display: grid;
        place-content: center;
        gap: var(--s-3);
        text-align: center;
        padding: var(--s-6);
        background: var(--ink-900);
        z-index: 5;

        h3 {
            font-family: var(--font-display);
            font-size: var(--fs-2xl);
            color: var(--bone-50);
            margin: 0;
            letter-spacing: var(--ls-tight);
        }
    }

    &__error-message {
        color: var(--bone-200);
        max-width: 360px;
        margin: 0 auto;
    }

    &__retry {
        margin-top: var(--s-2);
        padding: 0.65rem 1.4rem;
        background: var(--ember);
        color: var(--ink-900);
        border: 0;
        border-radius: var(--r-pill);
        font-family: var(--font-ui);
        font-weight: 600;
        cursor: pointer;
        transition:
            background-color var(--dur-fast) var(--ease-out),
            transform var(--dur-fast) var(--ease-out);

        &:hover {
            background: var(--ember-600);
            transform: translateY(-1px);
        }
    }
}
</style>
