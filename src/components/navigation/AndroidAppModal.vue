<template>
    <div
        v-if="isOpen"
        class="android-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="android-modal-title"
        @click.self="close"
    >
        <div class="android-modal__card">
            <!-- Header matching site modal architecture -->
            <header class="android-modal__header">
                <div class="android-modal__title-group">
                    <AndroidIcon :size="22" class="android-modal__icon" />
                    <h3 id="android-modal-title" class="android-modal__title display">
                        Streamly (Moovie) for Android
                    </h3>
                </div>
                <button
                    type="button"
                    class="android-modal__close"
                    @click="close"
                    aria-label="Close modal"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>
            </header>

            <!-- Body with description and clean highlights -->
            <div class="android-modal__body">
                <p class="android-modal__desc">
                    Stream movies, series, and anime with native video decoding, fluid 4K playback, and background streaming on your Android phone, tablet, or TV.
                </p>

                <!-- Highlights list from configuration -->
                <ul class="android-modal__features">
                    <li
                        v-for="feat in displayFeatures"
                        :key="feat.title"
                        class="android-modal__feature-item"
                        :title="feat.desc"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="android-modal__check">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>{{ feat.title }}</span>
                    </li>
                </ul>

                <!-- Release metadata note -->
                <div class="android-modal__meta">
                    <span class="android-modal__meta-dot" />
                    <span>v{{ config.version }} ({{ config.fileSize }}) • {{ config.minAndroid }}</span>
                </div>
            </div>

            <!-- Footer with site-standard buttons -->
            <footer class="android-modal__footer">
                <button
                    type="button"
                    class="android-modal__btn android-modal__btn--cancel"
                    @click="close"
                >
                    Close
                </button>
                <button
                    type="button"
                    class="android-modal__btn android-modal__btn--download"
                    @click="handleDownloadClick"
                >
                    <AndroidIcon :size="18" class="android-modal__btn-icon" />
                    <span>Download for Android</span>
                </button>
            </footer>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, computed, onMounted, onBeforeUnmount } from 'vue';
import AndroidIcon from '../svg/logo/android.vue';
import { useAndroidApp } from '../../composables/useAndroidApp';

export default defineComponent({
    name: 'AndroidAppModal',
    components: {
        AndroidIcon
    },
    props: {
        isOpen: {
            type: Boolean,
            required: true
        }
    },
    emits: ['close'],
    setup(props, { emit }) {
        const { config, hasDownloadUrl, triggerApkDownload } = useAndroidApp();

        const displayFeatures = computed(() => {
            return config.features.slice(0, 4);
        });

        const close = () => {
            emit('close');
        };

        const handleDownloadClick = () => {
            triggerApkDownload();
        };

        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && props.isOpen) {
                close();
            }
        };

        onMounted(() => {
            window.addEventListener('keydown', handleKeydown);
        });

        onBeforeUnmount(() => {
            window.removeEventListener('keydown', handleKeydown);
        });

        return {
            config,
            displayFeatures,
            hasDownloadUrl,
            close,
            handleDownloadClick
        };
    }
});
</script>

<style lang="scss" scoped>
.android-modal {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--s-4);
    background: var(--overlay-scrim);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    animation: fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);

    &__card {
        width: 100%;
        max-width: 460px;
        background: var(--glass);
        border: 1px solid var(--glass-border);
        border-radius: var(--r-md);
        box-shadow: var(--shadow-pane);
        backdrop-filter: var(--blur-pane);
        -webkit-backdrop-filter: var(--blur-pane);
        overflow: hidden;
        animation: scale-up 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--s-5) var(--s-6);
        border-bottom: 1px solid var(--rule);
    }

    &__title-group {
        display: flex;
        align-items: center;
        gap: var(--s-3);
    }

    &__icon {
        color: var(--ember);
        flex-shrink: 0;
    }

    &__title {
        font-size: 1.45rem;
        margin: 0;
        font-weight: 500;
        letter-spacing: -0.01em;
        color: var(--bone-50);
    }

    &__close {
        color: var(--bone-400);
        cursor: pointer;
        padding: var(--s-1);
        border-radius: 50%;
        background: transparent;
        border: none;
        transition: color 0.15s, background-color 0.15s;
        display: inline-flex;
        align-items: center;
        justify-content: center;

        svg {
            width: 18px;
            height: 18px;
            display: block;
        }

        &:hover {
            color: var(--bone-50);
            background: var(--surface-tint);
        }
    }

    &__body {
        padding: var(--s-6);
        display: flex;
        flex-direction: column;
        gap: var(--s-4);
    }

    &__desc {
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        color: var(--bone-300);
        line-height: 1.5;
        margin: 0;
    }

    &__features {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: var(--s-3) var(--s-4);

        @media (max-width: 440px) {
            grid-template-columns: 1fr;
        }
    }

    &__feature-item {
        display: flex;
        align-items: center;
        gap: var(--s-2);
        font-family: var(--font-ui);
        font-size: var(--fs-xs);
        color: var(--bone-200);
        line-height: 1.35;
    }

    &__check {
        width: 14px;
        height: 14px;
        color: var(--ember);
        flex-shrink: 0;
    }

    &__meta {
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        font-family: var(--font-ui);
        font-size: var(--fs-xs);
        color: var(--bone-400);
        padding-top: var(--s-1);
    }

    &__meta-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--ember);
        opacity: 0.8;
    }

    &__footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--s-3);
        padding: var(--s-4) var(--s-6);
        border-top: 1px solid var(--rule);
        background: rgba(0, 0, 0, 0.15);
    }

    &__btn {
        font-family: var(--font-ui);
        font-size: var(--fs-xs);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: var(--ls-wide);
        padding: 10px 20px;
        border-radius: var(--r-sm);
        cursor: pointer;
        transition: transform var(--dur-fast), background-color var(--dur-fast), border-color var(--dur-fast), color var(--dur-fast), box-shadow var(--dur-fast);

        &--cancel {
            background: transparent;
            border: 1px solid var(--rule-strong);
            color: var(--bone-300);

            &:hover {
                color: var(--bone-50);
                border-color: var(--bone-300);
            }
        }

        &--download {
            display: inline-flex;
            align-items: center;
            gap: var(--s-2);
            background: linear-gradient(135deg, var(--ember) 0%, #ffffff 100%);
            border: none;
            color: var(--ink-900);
            box-shadow: 0 4px 14px rgba(255, 255, 255, 0.35);

            &:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 20px rgba(255, 255, 255, 0.5);
            }

            &:active {
                transform: translateY(0) scale(0.97);
                box-shadow: 0 2px 8px rgba(255, 255, 255, 0.3);
            }
        }
    }

    &__btn-icon {
        flex-shrink: 0;
    }
}

@keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes scale-up {
    from {
        opacity: 0;
        transform: translateY(16px) scale(0.94);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

@media (max-width: 640px) {
    .android-modal {
        align-items: flex-end;
        padding: 0;

        &__card {
            max-width: none;
            border-radius: var(--r-lg) var(--r-lg) 0 0;
            animation: slide-up 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        &__header {
            padding: var(--s-4);
        }

        &__title {
            font-size: 1.2rem;
        }

        &__close {
            display: grid;
            place-items: center;
            width: 2.75rem;
            height: 2.75rem;
            padding: 0;
        }

        &__body {
            padding: var(--s-4);
            gap: var(--s-3);
        }

        &__features {
            grid-template-columns: 1fr;
        }

        &__footer {
            padding: var(--s-3) var(--s-4) calc(var(--s-4) + env(safe-area-inset-bottom, 0px));
            gap: var(--s-2);
        }

        &__btn {
            flex: 1;
            min-height: 2.75rem;
            padding: 0.65rem 1rem;
            font-size: 0.8rem;
            border-radius: var(--r-md);
            justify-content: center;
        }
    }
}

@keyframes slide-up {
    from {
        opacity: 0;
        transform: translateY(100%);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
