<template>
    <MobileShell>
        <div class="m-settings">
            <header class="m-settings__head">
                <router-link to="/more" class="m-settings__back" aria-label="Back">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </router-link>
                <div>
                    <p class="eyebrow">Settings</p>
                    <h1 class="m-settings__title">Settings</h1>
                </div>
            </header>

            <!-- Regional & Localization -->
            <section class="m-settings__card">
                <div class="m-settings__card-header">
                    <span class="m-settings__icon">🌐</span>
                    <div>
                        <h2 class="m-settings__card-title">Regional & Localization</h2>
                        <p class="m-settings__card-desc">Choose your region and preferred language.</p>
                    </div>
                </div>
                <div class="m-settings__card-body">
                    <div class="m-settings__field">
                        <label class="m-settings__label">Browsing Region</label>
                        <div class="m-settings__select-wrapper">
                            <select v-model="selectedRegion" class="m-settings__select" @change="saveRegionalSettings">
                                <option v-for="r in regions" :key="r.code" :value="r.code">{{ r.name }}</option>
                            </select>
                            <span class="m-settings__select-arrow">▼</span>
                        </div>
                    </div>
                    <div class="m-settings__field">
                        <label class="m-settings__label">Content Language</label>
                        <div class="m-settings__select-wrapper">
                            <select v-model="selectedLanguage" class="m-settings__select" @change="saveRegionalSettings">
                                <option v-for="l in languages" :key="l.code" :value="l.code">{{ l.name }}</option>
                            </select>
                            <span class="m-settings__select-arrow">▼</span>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Player & Ad Controls -->
            <section class="m-settings__card">
                <div class="m-settings__card-header">
                    <span class="m-settings__icon">🎬</span>
                    <div>
                        <h2 class="m-settings__card-title">Player & Ad Controls</h2>
                        <p class="m-settings__card-desc">Customize your default streaming server and advertising preferences.</p>
                    </div>
                </div>
                <div class="m-settings__card-body">
                    <div class="m-settings__toggle-row">
                        <div class="m-settings__toggle-info">
                            <span class="m-settings__toggle-label">Remove Ads / Ad-Free Mode</span>
                            <span class="m-settings__toggle-desc">Suppress promotional overlays and advertising scripts.</span>
                        </div>
                        <label class="m-settings__switch">
                            <input type="checkbox" v-model="adsHidden" @change="toggleAdsHidden" />
                            <span class="m-settings__slider" />
                        </label>
                    </div>
                    <div class="m-settings__field">
                        <label class="m-settings__label">Default Stream Server</label>
                        <p class="m-settings__field-help">Server selection is coming soon — currently set to Thor (Ultra Fast).</p>
                        <div class="m-settings__select-wrapper is-disabled">
                            <select class="m-settings__select" disabled>
                                <option value="thor">Thor (Ultra Fast Stream)</option>
                                <option value="poseidon">Poseidon (Multi-Audio HD)</option>
                                <option value="athena">Athena (Moovie Scraper Catalog)</option>
                                <option value="apollo">Apollo (4K Ultra Stream)</option>
                                <option value="hades">Hades (Backup HLS Mirror)</option>
                            </select>
                            <span class="m-settings__select-arrow">▼</span>
                        </div>
                    </div>
                </div>
            </section>

            <!-- FebBox Cloud Integration -->
            <section class="m-settings__card">
                <div class="m-settings__card-header">
                    <span class="m-settings__icon">☁️</span>
                    <div>
                        <h2 class="m-settings__card-title">FebBox Cloud Integration</h2>
                        <p class="m-settings__card-desc">Configure FebBox cloud storage sources, stream quality, and user token.</p>
                    </div>
                </div>
                <div class="m-settings__card-body">
                    <div class="m-settings__toggle-row">
                        <div class="m-settings__toggle-info">
                            <span class="m-settings__toggle-label">Enable FebBox Sources</span>
                            <span class="m-settings__toggle-desc">Include FebBox cloud stream mirrors in video source listings.</span>
                        </div>
                        <label class="m-settings__switch">
                            <input type="checkbox" v-model="febboxEnabled" @change="saveFebboxSettings" />
                            <span class="m-settings__slider" />
                        </label>
                    </div>
                    <div class="m-settings__field">
                        <label class="m-settings__label">FebBox User Token / Key</label>
                        <p class="m-settings__field-help">Optional VIP account key to unlock high-speed FebBox direct streaming threads.</p>
                        <input
                            type="text"
                            v-model="febboxToken"
                            placeholder="Enter FebBox user token..."
                            class="m-settings__input"
                            @change="saveFebboxSettings"
                        />
                    </div>
                    <div class="m-settings__field">
                        <label class="m-settings__label">FebBox Stream Quality</label>
                        <div class="m-settings__select-wrapper">
                            <select v-model="febboxQuality" class="m-settings__select" @change="saveFebboxSettings">
                                <option value="auto">Auto (Best Available)</option>
                                <option value="1080p">1080p Full HD</option>
                                <option value="720p">720p HD</option>
                                <option value="480p">480p SD</option>
                            </select>
                            <span class="m-settings__select-arrow">▼</span>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Artwork & Performance -->
            <section class="m-settings__card">
                <div class="m-settings__card-header">
                    <span class="m-settings__icon">🖼️</span>
                    <div>
                        <h2 class="m-settings__card-title">Artwork & Performance</h2>
                        <p class="m-settings__card-desc">Adjust poster resolution and manage local caching.</p>
                    </div>
                </div>
                <div class="m-settings__card-body">
                    <div class="m-settings__field">
                        <label class="m-settings__label">Poster & Image Quality</label>
                        <div class="m-settings__select-wrapper">
                            <select v-model="imageQuality" class="m-settings__select" @change="saveImageQuality">
                                <option value="low">Low (Faster)</option>
                                <option value="medium">Medium (Balanced)</option>
                                <option value="high">High (Crisp 4K)</option>
                            </select>
                            <span class="m-settings__select-arrow">▼</span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </MobileShell>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import MobileShell from '../layout/MobileShell.vue';
import { getSettings, LANGUAGES, REGIONS } from '@/composables/useSettings';

const { region, language, updateSettings } = getSettings();

const selectedRegion = ref(region.value || 'global');
const selectedLanguage = ref(language.value || 'en-US');
const adsHidden = ref(localStorage.getItem('ads_hidden') === 'true');
const imageQuality = ref<'low' | 'medium' | 'high'>(
    (localStorage.getItem('movora_image_quality') as any) || 'medium'
);
const febboxEnabled = ref(localStorage.getItem('febbox_enabled') !== 'false');
const febboxToken = ref(localStorage.getItem('febbox_token') || '');
const febboxQuality = ref(localStorage.getItem('febbox_quality') || 'auto');

const regions = REGIONS;
const languages = LANGUAGES;

function saveRegionalSettings() {
    updateSettings(selectedRegion.value, selectedLanguage.value);
}

function saveFebboxSettings() {
    localStorage.setItem('febbox_enabled', String(febboxEnabled.value));
    localStorage.setItem('febbox_token', febboxToken.value.trim());
    localStorage.setItem('febbox_quality', febboxQuality.value);
}

function toggleAdsHidden() {
    localStorage.setItem('ads_hidden', String(adsHidden.value));
    setTimeout(() => window.location.reload(), 400);
}

function saveImageQuality() {
    localStorage.setItem('movora_image_quality', imageQuality.value);
}
</script>

<style lang="scss" scoped>
.m-settings {
    padding: var(--s-4) var(--s-4) var(--s-8);

    &__head {
        display: flex;
        align-items: center;
        gap: var(--s-3);
        margin-bottom: var(--s-5);
    }

    &__back {
        flex-shrink: 0;
        width: 2.25rem;
        height: 2.25rem;
        display: grid;
        place-items: center;
        border-radius: 50%;
        color: var(--bone-300);
        transition: background var(--dur-fast), color var(--dur-fast);

        svg {
            width: 1.2rem;
            height: 1.2rem;
        }

        &:active {
            background: var(--surface-tint);
            color: var(--bone-50);
        }
    }

    &__title {
        margin: var(--s-1) 0 0;
        font-size: 1.4rem;
    }

    &__card {
        background: rgba(24, 22, 18, 0.75);
        border: 1px solid var(--rule);
        border-radius: var(--r-lg);
        padding: var(--s-4);
        margin-bottom: var(--s-4);
        overflow: hidden;
    }
    @media (max-width: 380px) {
        &__card {
            padding: var(--s-3);
        }
    }

    &__card-header {
        display: flex;
        align-items: flex-start;
        gap: var(--s-3);
        padding-bottom: var(--s-3);
        border-bottom: 1px solid var(--rule);
        margin-bottom: var(--s-3);
    }

    &__icon {
        width: 2.25rem;
        height: 2.25rem;
        display: grid;
        place-items: center;
        font-size: 1.1rem;
        background: var(--surface-tint);
        border: 1px solid var(--rule);
        border-radius: var(--r-md);
        flex-shrink: 0;
    }

    &__card-title {
        font-size: 1rem;
        color: var(--bone-50);
        margin: 0 0 2px;
        font-weight: 600;
    }

    &__card-desc {
        font-size: 0.78rem;
        color: var(--bone-400);
        margin: 0;
    }

    &__card-body {
        display: flex;
        flex-direction: column;
        gap: var(--s-3);
    }

    &__field {
        display: flex;
        flex-direction: column;
        gap: var(--s-1);
    }

    &__label {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--bone-400);
    }

    &__field-help {
        font-size: 0.72rem;
        color: var(--bone-500);
        margin: 0;
    }

    &__select-wrapper {
        position: relative;
        width: 100%;
    }
    &__select-wrapper.is-disabled {
        opacity: 0.5;
        pointer-events: none;
    }

    &__select {
        width: 100%;
        appearance: none;
        padding: var(--s-3) var(--s-4);
        font-family: var(--font-ui);
        font-size: 16px;
        color: var(--bone-100);
        background: rgba(14, 13, 11, 0.85);
        border: 1px solid var(--rule);
        border-radius: var(--r-md);
        cursor: pointer;
        outline: none;
        min-height: 2.5rem;
        box-sizing: border-box;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        transition: border-color var(--dur-fast), background var(--dur-fast);

        &:focus {
            border-color: var(--ember);
            background: rgba(22, 20, 17, 0.95);
        }
        &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        option {
            background: #151310;
            color: #fff;
        }
    }

    &__select-arrow {
        position: absolute;
        right: 14px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 0.6rem;
        color: var(--bone-400);
        pointer-events: none;
    }

    &__input {
        width: 100%;
        padding: var(--s-3) var(--s-4);
        font-family: var(--font-ui);
        font-size: 16px;
        color: var(--bone-100);
        background: rgba(14, 13, 11, 0.85);
        border: 1px solid var(--rule);
        border-radius: var(--r-md);
        outline: none;
        min-height: 2.5rem;
        box-sizing: border-box;
        transition: border-color var(--dur-fast), background var(--dur-fast);

        &:focus {
            border-color: var(--ember);
            background: rgba(22, 20, 17, 0.95);
        }
        &::placeholder {
            color: var(--bone-500);
        }
    }

    &__toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-3);
        padding: var(--s-3);
        background: rgba(14, 13, 11, 0.6);
        border: 1px solid var(--rule);
        border-radius: var(--r-md);
    }

    &__toggle-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }

    &__toggle-label {
        font-size: 0.88rem;
        font-weight: 600;
        color: var(--bone-100);
    }

    &__toggle-desc {
        font-size: 0.72rem;
        color: var(--bone-400);
    }

    &__switch {
        position: relative;
        display: inline-block;
        width: 44px;
        height: 24px;
        flex-shrink: 0;

        input {
            opacity: 0;
            width: 0;
            height: 0;

            &:checked + .m-settings__slider {
                background: var(--ember);

                &::before {
                    transform: translateX(20px);
                }
            }
        }
    }

    &__slider {
        position: absolute;
        cursor: pointer;
        inset: 0;
        background: var(--bone-700);
        border-radius: 24px;
        transition: background var(--dur-fast);

        &::before {
            content: '';
            position: absolute;
            left: 2px;
            top: 2px;
            width: 20px;
            height: 20px;
            background: #fff;
            border-radius: 50%;
            transition: transform var(--dur-fast);
        }
    }
}
</style>
