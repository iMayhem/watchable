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
                    v-if="embedUrl && shouldLoad && !hasError"
                    :key="embedUrl"
                    ref="frameEl"
                    :src="embedUrl"
                    :title="title"
                    class="stream-frame__iframe"
                    :class="{ 'is-loading': iframeLoading }"
                    :allow="iframeAllow"
                    allowfullscreen
                    frameborder="0"
                    v-bind="iframeExtraAttrs"
                    @load="onLoad"
                    @error="onError"
                />
                <!-- Loading state -->
                <transition name="puff">
                    <div v-if="showOverlay" class="stream-frame__server-tip">
                        <p>If server does not load or takes time, click on gear icon <span class="meta">&rarr;</span> select server <span class="meta">&rarr;</span> choose <strong>ultrafast</strong>. <span class="timer">({{ countdown }}s)</span></p>
                    </div>
                </transition>

                <!-- Loading state -->
                <div v-if="iframeLoading && !hasError" class="stream-frame__loading" role="status" aria-live="polite">
                    <div class="stream-frame__skeleton" aria-hidden="true" />
                    <div class="stream-frame__loader">
                        <div class="stream-frame__spinner" aria-hidden="true" />
                        <p class="meta">{{ loadingLabel }}</p>
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
        embedProvider: { type: String as () => 'default' | 'animeplay', default: 'default' },
        season: { type: Number, default: 0 },
        episode: { type: Number, default: 0 }
    },
    emits: ['switch-to-server'],
    setup(props) {
        const rootRef = ref<HTMLElement | null>(null);
        const frameEl = ref<HTMLIFrameElement | null>(null);
        const hasError = ref(false);
        const iframeLoading = ref(true);
        const shouldLoad = ref(false);
        const showOverlay = ref(false);
        const countdown = ref(10);

        let overlayTimer: number | null = null;
        let intervalTimer: number | null = null;

        const loadingMessages = [
            'Threading the reel…',
            'Cueing the projector…',
            'Striking the print…',
            'Rolling film…'
        ];
        const loadingLabel = ref(loadingMessages[0]);
        let messageTimer: number | null = null;

        const startMessages = () => {
            if (messageTimer) clearInterval(messageTimer);
            let i = 0;
            loadingLabel.value = loadingMessages[0];
            messageTimer = window.setInterval(() => {
                i = (i + 1) % loadingMessages.length;
                loadingLabel.value = loadingMessages[i];
            }, 2200);
        };

        const stopMessages = () => {
            if (messageTimer) {
                clearInterval(messageTimer);
                messageTimer = null;
            }
        };

        watch(() => props.embedUrl, (newUrl) => {
            if (overlayTimer) clearTimeout(overlayTimer);
            if (intervalTimer) clearInterval(intervalTimer);
            if (newUrl && newUrl.includes('cinemaos.live')) {
                showOverlay.value = true;
                countdown.value = 15;
                
                intervalTimer = window.setInterval(() => {
                    countdown.value--;
                }, 1000);
                
                overlayTimer = window.setTimeout(() => {
                    showOverlay.value = false;
                    clearInterval(intervalTimer!);
                }, 15000);
            } else {
                showOverlay.value = false;
            }
        }, { immediate: true });

        const isAnimeplayEmbed = computed(() => {
            if (props.embedProvider === 'animeplay') return true;
            const lower = props.embedUrl.toLowerCase();
            return lower.includes('animeplay.cfd') || lower.includes('megaplay.buzz');
        });

        const iframeAllow = computed(() =>
            isAnimeplayEmbed.value
                ? 'autoplay; fullscreen; picture-in-picture'
                : 'autoplay; fullscreen; encrypted-media; picture-in-picture'
        );

        const iframeExtraAttrs = computed(() => {
            const attrs: Record<string, string> = {};
            if (isAnimeplayEmbed.value) {
                attrs.referrerpolicy = 'origin';
            }
            const url = props.embedUrl.toLowerCase();
            if (url.includes('cinemaos.live') || url.includes('smashystream.com')) {
                attrs.sandbox = 'allow-scripts allow-same-origin allow-forms allow-presentation allow-popups';
            }
            return attrs;
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
            stopMessages();
        };

        const onError = () => {
            hasError.value = true;
            stopMessages();
        };

        const retry = () => {
            hasError.value = false;
            iframeLoading.value = true;
            startMessages();
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
                    startMessages();
                    startTrackingIfNeeded();
                }
            }
        );

        watch(
            () => [props.backdropPath, props.posterPath],
            () => computeAmbient(),
            { immediate: true }
        );

        const handleUnload = () => {
            if (frameEl.value) {
                frameEl.value.src = 'about:blank';
            }
        };

        onMounted(() => {
            startTrackingIfNeeded();
            window.addEventListener('beforeunload', handleUnload);
            window.addEventListener('pagehide', handleUnload);
            startMessages();
            // Delay rendering the heavy iframe to let the page transition and paint skeleton cleanly
            window.setTimeout(() => {
                shouldLoad.value = true;
            }, 150);
        });

        onUnmounted(() => {
            window.removeEventListener('beforeunload', handleUnload);
            window.removeEventListener('pagehide', handleUnload);
            stopMessages();
            if (stopTracking) {
                stopTracking();
                stopTracking = null;
            }
            if (overlayTimer) clearTimeout(overlayTimer);
            if (intervalTimer) clearInterval(intervalTimer);
        });

        return {
            rootRef,
            frameEl,
            hasError,
            iframeLoading,
            showOverlay,
            countdown,
            loadingLabel,
            ambientImage,
            iframeAllow,
            iframeExtraAttrs,
            onLoad,
            onError,
            retry,
            shouldLoad
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
        max-width: 100%;
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
        place-items: center;
        background: var(--ink-900);
        z-index: 5;
    }

    &__skeleton {
        position: absolute;
        inset: 0;
        background:
            linear-gradient(
                100deg,
                rgba(255, 255, 255, 0) 30%,
                rgba(255, 255, 255, 0.04) 50%,
                rgba(255, 255, 255, 0) 70%
            ) var(--ink-800);
        background-size: 220% 100%;
        animation: streamFrameShimmer 2.4s infinite ease-in-out;
    }

    &__loader {
        position: relative;
        z-index: 1;
        display: grid;
        gap: var(--s-3);
        justify-items: center;
        color: var(--bone-200);
    }

    &__spinner {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 2px solid var(--rule-strong);
        border-top-color: var(--ember);
        animation: streamFrameSpin 1.1s linear infinite;
    }

    .meta {
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        letter-spacing: 0.06em;
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

    @keyframes streamFrameShimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
    }

    @keyframes streamFrameSpin {
        to { transform: rotate(360deg); }
    }

    @media (prefers-reduced-motion: reduce) {
        .stream-frame__skeleton,
        .stream-frame__spinner {
            animation: none;
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

    &__server-tip {
        position: absolute;
        top: var(--s-5);
        left: 50%;
        transform: translateX(-50%);
        z-index: 20;
        padding: 0.6rem 1.25rem;
        pointer-events: none;
        text-align: center;
        width: max-content;
        max-width: 90%;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8), 0 0 10px rgba(0, 0, 0, 0.5);

        p {
            margin: 0;
            color: var(--bone-100);
            font-size: var(--fs-xs);
            font-family: var(--font-ui);

            @media (min-width: 640px) {
                font-size: var(--fs-sm);
            }
            
            strong {
                color: var(--ember);
                font-weight: 600;
            }
            
            .meta {
                color: var(--bone-400);
                margin: 0 0.2rem;
            }
            
            .timer {
                color: var(--ember);
                font-weight: 700;
                margin-left: 0.35rem;
                font-variant-numeric: tabular-nums;
            }
        }
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

.puff-enter-active,
.puff-leave-active {
    transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.puff-enter-from {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px) scale(0.95);
}
.puff-leave-to {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px) scale(1.05);
    filter: blur(4px);
}
</style>
