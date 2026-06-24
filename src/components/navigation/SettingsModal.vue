<template>
    <div v-if="isOpen" class="settings-modal" role="dialog" aria-modal="true" @click.self="close">
        <div class="settings-modal__card">
            <header class="settings-modal__header">
                <div class="settings-modal__title-group">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="settings-modal__icon">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                        <path d="M2 12h20" />
                    </svg>
                    <h3 class="settings-modal__title display">Regional Settings</h3>
                </div>
                <button type="button" class="settings-modal__close" @click="close" aria-label="Close modal">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>
            </header>

            <div class="settings-modal__body">
                <p class="settings-modal__desc">
                    Choose your browsing region to tailor trending titles and catalog picks.
                </p>

                <div class="settings-modal__field">
                    <label class="settings-modal__label eyebrow">Browsing Region</label>
                    <div class="settings-modal__select-wrapper">
                        <select v-model="localRegion" class="settings-modal__select">
                            <option v-for="r in regions" :key="r.code" :value="r.code">
                                {{ r.name }}
                            </option>
                        </select>
                        <span class="settings-modal__select-arrow"></span>
                    </div>
                </div>

                <div class="settings-modal__field" style="margin-top: var(--s-2);">
                    <label class="settings-modal__checkbox-label">
                        <input type="checkbox" v-model="localYoutubeStreams" class="settings-modal__checkbox" />
                        <span class="settings-modal__checkbox-text">Enable YouTube Streams</span>
                    </label>
                    <p class="settings-modal__chk-subdesc">
                        Include YouTube Live videos in your livestream directory.
                    </p>
                </div>
            </div>

            <footer class="settings-modal__footer">
                <button type="button" class="settings-modal__btn settings-modal__btn--cancel" @click="close">
                    Cancel
                </button>
                <button type="button" class="settings-modal__btn settings-modal__btn--save" @click="save">
                    Save Changes
                </button>
            </footer>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue';
import { getSettings, REGIONS } from '../../composables/useSettings';

export default defineComponent({
    name: 'SettingsModal',
    props: {
        isOpen: {
            type: Boolean,
            required: true
        }
    },
    emits: ['close'],
    setup(props, { emit }) {
        const { region, language, youtubeStreams, updateSettings } = getSettings();

        const localRegion = ref(region.value);
        const localYoutubeStreams = ref(youtubeStreams.value);

        watch(
            () => props.isOpen,
            (newVal) => {
                if (newVal) {
                    localRegion.value = region.value;
                    localYoutubeStreams.value = youtubeStreams.value;
                }
            }
        );

        const close = () => {
            emit('close');
        };

        const save = () => {
            updateSettings(localRegion.value, language.value, localYoutubeStreams.value);
            close();
        };

        return {
            regions: REGIONS,
            localRegion,
            localYoutubeStreams,
            close,
            save
        };
    }
});
</script>

<style lang="scss" scoped>
.settings-modal {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--s-4);
    background: rgba(11, 10, 8, 0.65);
    backdrop-filter: blur(8px);
    animation: fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);

    &__card {
        width: 100%;
        max-width: 440px;
        background: rgba(26, 24, 21, 0.85);
        border: 1px solid var(--rule);
        border-radius: var(--r-md);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(24px);
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
        width: 20px;
        height: 20px;
        color: var(--ember);
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
        transition: color 0.15s, background-color 0.15s;

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
        gap: var(--s-5);
    }

    &__desc {
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        color: var(--bone-300);
        line-height: 1.5;
        margin: 0 0 var(--s-2);
    }

    &__field {
        display: flex;
        flex-direction: column;
        gap: var(--s-2);
    }

    &__label {
        color: var(--bone-400);
        font-size: 0.6875rem;
        margin: 0;
    }

    &__select-wrapper {
        position: relative;
        width: 100%;
    }

    &__select {
        width: 100%;
        appearance: none;
        background: var(--ink-950);
        border: 1px solid var(--rule);
        border-radius: var(--r-sm);
        padding: 10px var(--s-8) 10px var(--s-4);
        color: var(--bone-100);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        cursor: pointer;
        outline: none;
        transition: border-color var(--dur-fast), box-shadow var(--dur-fast);

        &:hover {
            border-color: var(--rule-strong);
        }

        &:focus {
            border-color: var(--ember);
            box-shadow: 0 0 0 2px rgba(255, 90, 31, 0.15);
        }

        option {
            background: #ffffff;
            color: #1a1815;
        }
    }

    &__select-arrow {
        position: absolute;
        right: 14px;
        top: 50%;
        transform: translateY(-50%);
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 5px solid var(--bone-400);
        pointer-events: none;
    }

    &__checkbox-label {
        display: inline-flex;
        align-items: center;
        gap: var(--s-3);
        cursor: pointer;
        color: var(--bone-100);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 500;
    }

    &__checkbox {
        width: 18px;
        height: 18px;
        accent-color: var(--ember);
        cursor: pointer;
    }

    &__chk-subdesc {
        font-family: var(--font-ui);
        font-size: var(--fs-xs);
        color: var(--bone-400);
        margin-top: 2px;
        margin-left: 28px;
    }

    &__footer {
        display: flex;
        justify-content: flex-end;
        gap: var(--s-3);
        padding: var(--s-4) var(--s-6);
        background: rgba(0, 0, 0, 0.15);
        border-top: 1px solid var(--rule);
    }

    &__btn {
        font-family: var(--font-ui);
        font-size: var(--fs-xs);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: var(--ls-wide);
        padding: 9px 20px;
        border-radius: var(--r-sm);
        cursor: pointer;
        transition: transform var(--dur-fast), background-color var(--dur-fast), border-color var(--dur-fast), color var(--dur-fast);

        &--cancel {
            background: transparent;
            border: 1px solid var(--rule-strong);
            color: var(--bone-300);

            &:hover {
                color: var(--bone-50);
                border-color: var(--bone-300);
            }
        }

        &--save {
            background: linear-gradient(135deg, var(--ember) 0%, #ff8a00 100%);
            border: none;
            color: var(--ink-900);

            &:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(255, 90, 31, 0.2);
            }
        }
    }
}

@keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes scale-up {
    from {
        opacity: 0;
        transform: scale(0.96);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}

@media (max-width: 640px) {
    .settings-modal {
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
            gap: var(--s-4);
        }

        &__select {
            min-height: 2.75rem;
            padding: 0.65rem var(--s-8) 0.65rem var(--s-4);
            font-size: 16px;
            border-radius: var(--r-md);
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
