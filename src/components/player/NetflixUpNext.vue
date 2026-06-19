<template>
    <Transition name="nf-upnext">
        <div
            v-if="active && episode"
            class="nf-upnext"
            role="dialog"
            aria-label="Up next"
            @click.stop
        >
            <p class="nf-upnext__eyebrow">Up next</p>
            <div class="nf-upnext__card">
                <div class="nf-upnext__still">
                    <img
                        v-if="stillUrl"
                        :src="stillUrl"
                        :alt="episode.name"
                        loading="lazy"
                    />
                    <div v-else class="nf-upnext__still-fallback" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
                            <rect x="3" y="6" width="18" height="12" rx="2" />
                            <path d="m8 3 4 3 4-3" />
                        </svg>
                    </div>
                    <span v-if="countingDown" class="nf-upnext__count">{{ countdown }}s</span>
                </div>
                <div class="nf-upnext__body">
                    <span class="nf-upnext__code">{{ episode.code }}</span>
                    <h3 class="nf-upnext__name">{{ episode.name }}</h3>
                </div>
            </div>
            <div class="nf-upnext__actions">
                <button type="button" class="nf-upnext__btn nf-upnext__btn--ghost" @click="cancel">
                    Cancel
                </button>
                <button type="button" class="nf-upnext__btn nf-upnext__btn--play" @click="playNow">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                    <span>{{ countingDown ? `Next in ${countdown}s` : 'Play now' }}</span>
                </button>
            </div>
        </div>
    </Transition>
</template>

<script lang="ts">
import { computed, defineComponent, onUnmounted, PropType, ref, watch } from 'vue';
import { useStorage } from '@vueuse/core';
import { useWebImage } from '../../utils/useWebImage';

export interface NetflixUpNextEpisode {
    season: number;
    episode: number;
    code: string;
    name: string;
    still_path?: string | null;
}

export default defineComponent({
    name: 'NetflixUpNext',
    props: {
        active: { type: Boolean, default: false },
        episode: {
            type: Object as PropType<NetflixUpNextEpisode | null>,
            default: null
        },
        countdownSeconds: { type: Number, default: 5 }
    },
    emits: ['play-now', 'cancel', 'complete'],
    setup(props, { emit }) {
        const autoplay = useStorage<boolean>('nf:autoplay-next', true);
        const countingDown = ref(false);
        const countdown = ref(props.countdownSeconds);
        let timer: ReturnType<typeof setInterval> | null = null;

        const stillUrl = computed(() => {
            const path = props.episode?.still_path;
            return path ? useWebImage(path, 'medium') : '';
        });

        const stopCountdown = () => {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
            countingDown.value = false;
            countdown.value = props.countdownSeconds;
        };

        const playNow = () => {
            stopCountdown();
            emit('play-now');
        };

        const cancel = () => {
            stopCountdown();
            emit('cancel');
        };

        const startCountdown = () => {
            stopCountdown();
            if (!autoplay.value) return;
            countingDown.value = true;
            countdown.value = props.countdownSeconds;
            timer = setInterval(() => {
                countdown.value -= 1;
                if (countdown.value <= 0) {
                    stopCountdown();
                    emit('complete');
                }
            }, 1000);
        };

        watch(
            () => props.active,
            (visible) => {
                if (visible && props.episode) {
                    startCountdown();
                } else {
                    stopCountdown();
                }
            }
        );

        watch(autoplay, (enabled) => {
            if (!props.active) return;
            if (enabled) startCountdown();
            else stopCountdown();
        });

        onUnmounted(stopCountdown);

        return {
            autoplay,
            countingDown,
            countdown,
            stillUrl,
            playNow,
            cancel
        };
    }
});
</script>

<style lang="scss" scoped>
.nf-upnext {
    position: absolute;
    right: 1.5rem;
    bottom: 6.5rem;
    z-index: 50;
    width: min(360px, 88vw);
    padding: 1rem;
    border-radius: 8px;
    background: rgba(20, 20, 20, 0.94);
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
    pointer-events: auto;

    &__eyebrow {
        margin: 0 0 0.65rem;
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.62);
    }

    &__card {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 0.75rem;
        align-items: center;
    }

    &__still {
        position: relative;
        aspect-ratio: 16 / 9;
        border-radius: 4px;
        overflow: hidden;
        background: #111;

        img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
    }

    &__still-fallback {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: rgba(255, 255, 255, 0.35);

        svg {
            width: 28px;
            height: 28px;
        }
    }

    &__count {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background: rgba(0, 0, 0, 0.55);
        font-size: 1.1rem;
        font-weight: 700;
        color: #fff;
    }

    &__body {
        min-width: 0;
    }

    &__code {
        display: block;
        font-size: 0.72rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.62);
        margin-bottom: 0.25rem;
    }

    &__name {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        line-height: 1.35;
        color: #fff;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    &__actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.65rem;
        margin-top: 0.85rem;
    }

    &__btn {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        border: none;
        border-radius: 4px;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease;

        &--ghost {
            padding: 0.5rem 0.85rem;
            background: rgba(255, 255, 255, 0.12);
            color: #fff;

            &:hover {
                background: rgba(255, 255, 255, 0.2);
            }
        }

        &--play {
            padding: 0.5rem 0.9rem;
            background: #fff;
            color: #000;

            svg {
                width: 16px;
                height: 16px;
            }

            &:hover {
                background: rgba(255, 255, 255, 0.88);
            }
        }
    }
}

.nf-upnext-enter-active,
.nf-upnext-leave-active {
    transition: opacity 0.28s ease, transform 0.28s ease;
}

.nf-upnext-enter-from,
.nf-upnext-leave-to {
    opacity: 0;
    transform: translateY(12px);
}

@media (max-width: 640px) {
    .nf-upnext {
        right: 0.9rem;
        left: 0.9rem;
        width: auto;
        bottom: 5.5rem;

        &__card {
            grid-template-columns: 100px 1fr;
        }
    }
}
</style>