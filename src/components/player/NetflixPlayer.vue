<template>
    <div
        ref="shellRef"
        class="nf-watch"
        :class="{ 'is-idle': !controlsVisible && artReady, 'is-fs': isFullscreen }"
        @mousemove="revealControls"
        @touchstart.passive="revealControls"
        @click="onShellClick"
    >
        <div class="nf-watch__video">
            <div ref="stageRef" class="nf-watch__stage" />
            <div v-if="loading || !artReady" class="nf-watch__loader" aria-live="polite">
                <span class="nf-watch__spinner" aria-hidden="true" />
                <p>{{ loading ? 'Loading your video…' : 'Starting playback…' }}</p>
            </div>
        </div>

        <div class="nf-watch__shade nf-watch__shade--top" aria-hidden="true" />
        <div class="nf-watch__shade nf-watch__shade--bottom" aria-hidden="true" />

        <header class="nf-watch__top" @click.stop>
            <button type="button" class="nf-watch__icon-btn" aria-label="Back" @click.stop="$emit('back')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </button>
            <div class="nf-watch__meta">
                <h1 class="nf-watch__title">{{ title }}</h1>
                <p v-if="subtitle" class="nf-watch__subtitle">{{ subtitle }}</p>
            </div>
        </header>

        <div class="nf-watch__controls" @click.stop>
            <div
                class="nf-watch__progress"
                role="slider"
                aria-label="Seek"
                :aria-valuenow="Math.round(progress)"
                aria-valuemin="0"
                aria-valuemax="100"
                @click.stop="onProgressClick"
            >
                <div class="nf-watch__progress-buffer" :style="{ width: `${bufferProgress}%` }" />
                <div class="nf-watch__progress-fill" :style="{ width: `${progress}%` }">
                    <span class="nf-watch__progress-knob" />
                </div>
            </div>

            <div class="nf-watch__bar">
                <div class="nf-watch__bar-left">
                    <button type="button" class="nf-watch__icon-btn" :aria-label="isPlaying ? 'Pause' : 'Play'" @click.stop="togglePlay">
                        <svg v-if="!isPlaying" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                        <svg v-else viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
                        </svg>
                    </button>

                    <button type="button" class="nf-watch__icon-btn nf-watch__icon-btn--label" aria-label="Rewind 10 seconds" @click.stop="skipBack(10)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                            <path d="M3 12a9 9 0 1 0 3-6.7" stroke-linecap="round" />
                            <path d="M3 4v5h5" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                        <span>10</span>
                    </button>

                    <button type="button" class="nf-watch__icon-btn" :aria-label="isMuted ? 'Unmute' : 'Mute'" @click.stop="toggleMute">
                        <svg v-if="!isMuted" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.06c1.48-.74 2.5-2.26 2.5-4.03z" />
                        </svg>
                        <svg v-else viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 10v4h4l5 5V5L7 10H3zm11 4.17L15.83 14H18v-4h-2.17l1.17-1.17L16.17 8 14 10.17 11.83 8 10 9.83 11.17 11H9v2h2.17L10 14.17 11.83 16 14 13.83 16.17 16 18 14.17 16.83 13H19v-2h-2.17z" />
                        </svg>
                    </button>

                    <span class="nf-watch__time">
                        {{ formatPlayerTime(currentTime) }} / {{ formatPlayerTime(duration) }}
                    </span>
                </div>

                <div class="nf-watch__bar-right">
                    <div ref="qualityRef" class="nf-watch__quality">
                        <button
                            type="button"
                            class="nf-watch__quality-btn"
                            aria-haspopup="listbox"
                            :aria-expanded="qualityOpen"
                            @click.stop="qualityOpen = !qualityOpen"
                        >
                            {{ activeQualityLabel }}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="m6 9 6 6 6-6" stroke-linecap="round" />
                            </svg>
                        </button>
                        <ul v-if="qualityOpen" class="nf-watch__quality-menu" role="listbox">
                            <li
                                v-for="(stream, index) in streams"
                                :key="stream.url"
                                role="option"
                                :aria-selected="selectedStreamIndex === index"
                            >
                                <button
                                    type="button"
                                    class="nf-watch__quality-item"
                                    :class="{ 'is-active': selectedStreamIndex === index }"
                                    @click.stop="selectQuality(index)"
                                >
                                    {{ stream.quality }}
                                </button>
                            </li>
                        </ul>
                    </div>

                    <button type="button" class="nf-watch__icon-btn" aria-label="Fullscreen" @click.stop="toggleFullscreen">
                        <svg v-if="!isFullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                            <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" stroke-linecap="round" />
                        </svg>
                        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                            <path d="M9 9H4V4M15 9h5V4M9 15H4v5M15 15h5v5" stroke-linecap="round" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>

        <p v-if="playbackError" class="nf-watch__error" role="alert">{{ playbackError }}</p>
    </div>
</template>

<script lang="ts">
import {
    computed,
    defineComponent,
    onBeforeUnmount,
    onMounted,
    PropType,
    ref,
    watch
} from 'vue';
import {
    formatPlayerTime,
    type NetmirrorStream
} from '../../composables/useNetmirrorPlayer';
import { nfDebug } from '../../composables/useNetflixDebug';

export default defineComponent({
    name: 'NetflixPlayer',
    props: {
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        loading: { type: Boolean, default: false },
        artReady: { type: Boolean, default: false },
        playbackError: { type: String, default: '' },
        isPlaying: { type: Boolean, default: false },
        currentTime: { type: Number, default: 0 },
        duration: { type: Number, default: 0 },
        progress: { type: Number, default: 0 },
        bufferProgress: { type: Number, default: 0 },
        isMuted: { type: Boolean, default: false },
        streams: { type: Array as PropType<NetmirrorStream[]>, default: () => [] },
        selectedStreamIndex: { type: Number, default: 0 },
        bindContainer: {
            type: Function as PropType<(el: HTMLElement | null) => void>,
            required: true
        }
    },
    emits: ['back', 'toggle-play', 'skip-back', 'toggle-mute', 'seek', 'quality'],
    setup(props, { emit }) {
        const shellRef = ref<HTMLElement | null>(null);
        const stageRef = ref<HTMLElement | null>(null);
        const qualityRef = ref<HTMLElement | null>(null);
        const qualityOpen = ref(false);
        const controlsVisible = ref(true);
        const isFullscreen = ref(false);
        let hideTimer: number | null = null;

        const activeQualityLabel = computed(() => {
            const stream = props.streams[props.selectedStreamIndex];
            return stream?.quality || 'Quality';
        });

        const revealControls = () => {
            controlsVisible.value = true;
            if (hideTimer !== null) window.clearTimeout(hideTimer);
            if (props.isPlaying && props.artReady) {
                hideTimer = window.setTimeout(() => {
                    controlsVisible.value = false;
                    qualityOpen.value = false;
                }, 3200);
            }
        };

        const onShellClick = () => {
            nfDebug('player-ui:click-toggle');
            revealControls();
            emit('toggle-play');
        };

        const onProgressClick = (event: MouseEvent) => {
            const bar = event.currentTarget as HTMLElement;
            const rect = bar.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
            const target = ratio * (props.duration || 0);
            nfDebug('player-ui:seek', { ratio, target });
            emit('seek', target);
        };

        const selectQuality = (index: number) => {
            qualityOpen.value = false;
            nfDebug('player-ui:quality-select', { index });
            emit('quality', index);
        };

        const toggleFullscreen = async () => {
            const el = shellRef.value;
            if (!el) return;
            if (!document.fullscreenElement) {
                nfDebug('player-ui:fullscreen:enter');
                await el.requestFullscreen?.();
            } else {
                nfDebug('player-ui:fullscreen:exit');
                await document.exitFullscreen?.();
            }
        };

        const onFullscreenChange = () => {
            isFullscreen.value = document.fullscreenElement === shellRef.value;
            nfDebug('player-ui:fullscreen:change', { active: isFullscreen.value });
        };

        const onDocClick = (event: MouseEvent) => {
            if (!qualityRef.value?.contains(event.target as Node)) {
                qualityOpen.value = false;
            }
        };

        watch(
            () => props.isPlaying,
            (playing) => {
                if (!playing) {
                    controlsVisible.value = true;
                    if (hideTimer !== null) window.clearTimeout(hideTimer);
                } else {
                    revealControls();
                }
            }
        );

        watch(
            stageRef,
            (el) => {
                nfDebug('player-ui:stage-bind', { hasElement: Boolean(el) });
                props.bindContainer(el);
            },
            { flush: 'post' }
        );

        watch(
            () => props.playbackError,
            (err) => {
                if (err) nfDebug('player-ui:error', err);
            }
        );

        watch(
            () => props.artReady,
            (ready) => {
                if (ready) nfDebug('player-ui:art-ready');
            }
        );

        onMounted(() => {
            nfDebug('player-ui:mount');
            props.bindContainer(stageRef.value);
            document.addEventListener('fullscreenchange', onFullscreenChange);
            document.addEventListener('click', onDocClick);
            revealControls();
        });

        onBeforeUnmount(() => {
            props.bindContainer(null);
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            document.removeEventListener('click', onDocClick);
            if (hideTimer !== null) window.clearTimeout(hideTimer);
        });

        return {
            shellRef,
            qualityRef,
            qualityOpen,
            controlsVisible,
            isFullscreen,
            activeQualityLabel,
            formatPlayerTime,
            revealControls,
            onShellClick,
            onProgressClick,
            selectQuality,
            toggleFullscreen,
            togglePlay: () => emit('toggle-play'),
            skipBack: (s: number) => emit('skip-back', s),
            toggleMute: () => emit('toggle-mute')
        };
    }
});
</script>

<style lang="scss" scoped>
.nf-watch {
    --nf-red: #e50914;
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 100dvh;
    background: #000;
    color: #fff;
    overflow: hidden;
    user-select: none;

    &__video {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background: #000;
    }

    &__stage {
        width: 100%;
        height: 100%;

        :deep(.art-video-player) {
            width: 100% !important;
            height: 100% !important;
        }

        :deep(.art-video) {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain;
        }

        :deep(.art-layers),
        :deep(.art-mask),
        :deep(.art-controls),
        :deep(.art-bottom),
        :deep(.art-info),
        :deep(.art-settings),
        :deep(.art-contextmenus) {
            display: none !important;
        }
    }

    &__loader {
        position: absolute;
        inset: 0;
        z-index: 2;
        display: grid;
        place-content: center;
        gap: 1rem;
        text-align: center;
        background: rgba(0, 0, 0, 0.55);
        font-size: 0.95rem;
        color: rgba(255, 255, 255, 0.85);
    }

    &__spinner {
        width: 52px;
        height: 52px;
        margin: 0 auto;
        border: 3px solid rgba(255, 255, 255, 0.15);
        border-top-color: var(--nf-red);
        border-radius: 50%;
        animation: nf-spin 0.9s linear infinite;
    }

    &__shade {
        position: absolute;
        left: 0;
        right: 0;
        z-index: 3;
        pointer-events: none;

        &--top {
            top: 0;
            height: 120px;
            background: linear-gradient(180deg, rgba(0, 0, 0, 0.75), transparent);
        }

        &--bottom {
            bottom: 0;
            height: 160px;
            background: linear-gradient(0deg, rgba(0, 0, 0, 0.85), transparent);
        }
    }

    &__top,
    &__controls {
        position: absolute;
        left: 0;
        right: 0;
        z-index: 4;
        transition: opacity 0.25s ease, transform 0.25s ease;
    }

    &__top {
        top: 0;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1.25rem 1.5rem;
    }

    &__meta {
        min-width: 0;
    }

    &__title {
        margin: 0;
        font-size: clamp(1rem, 2vw, 1.35rem);
        font-weight: 600;
        letter-spacing: 0.01em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__subtitle {
        margin: 0.2rem 0 0;
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.72);
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    &__controls {
        bottom: 0;
        padding: 0 1.5rem 1.25rem;
    }

    &__progress {
        position: relative;
        height: 4px;
        margin-bottom: 0.85rem;
        background: rgba(255, 255, 255, 0.25);
        border-radius: 2px;
        cursor: pointer;

        &:hover {
            height: 6px;
        }
    }

    &__progress-buffer {
        position: absolute;
        inset: 0 auto 0 0;
        background: rgba(255, 255, 255, 0.35);
        border-radius: inherit;
    }

    &__progress-fill {
        position: absolute;
        inset: 0 auto 0 0;
        background: var(--nf-red);
        border-radius: inherit;
    }

    &__progress-knob {
        position: absolute;
        top: 50%;
        right: 0;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--nf-red);
        transform: translate(50%, -50%) scale(0);
        transition: transform 0.15s ease;
    }

    &__progress:hover &__progress-knob {
        transform: translate(50%, -50%) scale(1);
    }

    &__bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
    }

    &__bar-left,
    &__bar-right {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        min-width: 0;
    }

    &__bar-right {
        flex-shrink: 0;
    }

    &__icon-btn {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: transparent;
        color: #fff;
        cursor: pointer;
        transition: background 0.15s ease;

        svg {
            width: 22px;
            height: 22px;
        }

        &:hover {
            background: rgba(255, 255, 255, 0.12);
        }

        &--label {
            position: relative;
            width: 44px;

            span {
                position: absolute;
                font-size: 0.58rem;
                font-weight: 800;
                letter-spacing: -0.02em;
            }
        }
    }

    &__time {
        font-size: 0.82rem;
        font-variant-numeric: tabular-nums;
        color: rgba(255, 255, 255, 0.9);
        white-space: nowrap;
    }

    &__quality {
        position: relative;
    }

    &__quality-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        min-width: 72px;
        height: 36px;
        padding: 0 0.65rem;
        border: 1px solid rgba(255, 255, 255, 0.35);
        border-radius: 4px;
        background: rgba(20, 20, 20, 0.8);
        color: #fff;
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;

        svg {
            width: 14px;
            height: 14px;
        }
    }

    &__quality-menu {
        position: absolute;
        right: 0;
        bottom: calc(100% + 8px);
        min-width: 120px;
        margin: 0;
        padding: 0.35rem 0;
        list-style: none;
        background: rgba(20, 20, 20, 0.96);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 4px;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    }

    &__quality-item {
        display: block;
        width: 100%;
        padding: 0.55rem 0.9rem;
        border: none;
        background: transparent;
        color: rgba(255, 255, 255, 0.85);
        font-size: 0.82rem;
        text-align: left;
        cursor: pointer;

        &.is-active,
        &:hover {
            color: #fff;
            background: rgba(255, 255, 255, 0.08);
        }

        &.is-active {
            font-weight: 700;
        }
    }

    &__error {
        position: absolute;
        left: 50%;
        bottom: 7rem;
        z-index: 5;
        transform: translateX(-50%);
        margin: 0;
        padding: 0.65rem 1rem;
        background: rgba(180, 20, 20, 0.9);
        border-radius: 4px;
        font-size: 0.85rem;
        white-space: nowrap;
    }

    &.is-idle &__top,
    &.is-idle &__controls,
    &.is-idle &__shade {
        opacity: 0;
        pointer-events: none;
    }

    &.is-idle {
        cursor: none;
    }
}

@keyframes nf-spin {
    to { transform: rotate(360deg); }
}

@media (max-width: 640px) {
    .nf-watch {
        &__top {
            padding: 0.85rem 0.9rem;
        }

        &__controls {
            padding: 0 0.9rem 0.9rem;
        }

        &__icon-btn {
            width: 36px;
            height: 36px;

            svg {
                width: 20px;
                height: 20px;
            }
        }

        &__time {
            font-size: 0.72rem;
        }
    }
}
</style>