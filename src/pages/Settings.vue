<template>
    <div class="settings-page">
        <SiteHeader />

        <main id="main" class="settings-page__main" role="main">
            <div class="container-lm">
                <!-- Page Header -->
                <header class="settings-page__header">
                    <div class="settings-page__title-group">
                        <div class="settings-page__badge">Preferences & Config</div>
                        <h1 class="settings-page__title display">Settings</h1>
                        <p class="settings-page__subtitle">
                            Configure your browsing region, content language, video playback servers, ad preferences, and local storage caches.
                        </p>
                    </div>
                </header>

                <div class="settings-page__grid">
                    <!-- Section 1: Regional & Language -->
                    <section class="settings-card">
                        <div class="settings-card__header">
                            <div class="settings-card__icon-box">🌐</div>
                            <div>
                                <h2 class="settings-card__title">Regional & Localization</h2>
                                <p class="settings-card__desc">Choose your region. Movie, show, and anime titles are shown in English.</p>
                            </div>
                        </div>

                        <div class="settings-card__body">
                            <!-- Region Selector -->
                            <div class="settings-field">
                                <label for="setting-region" class="settings-field__label eyebrow">Browsing Region</label>
                                <p class="settings-field__help">Tailors streaming provider badges, release dates, and regional catalog highlights.</p>
                                <div class="settings-select-wrapper">
                                    <select id="setting-region" v-model="selectedRegion" class="settings-select" @change="saveRegionalSettings">
                                        <option v-for="r in REGIONS" :key="r.code" :value="r.code">
                                            {{ r.name }}
                                        </option>
                                    </select>
                                    <span class="settings-select-arrow">▼</span>
                                </div>
                            </div>

                            <!-- Catalog language is fixed to English so localized titles do not
                                 appear inconsistently across catalog, search, and player pages. -->
                            <div class="settings-field">
                                <label for="setting-language" class="settings-field__label eyebrow">Content Language</label>
                                <p class="settings-field__help">English-only catalog metadata.</p>
                                <div class="settings-select-wrapper">
                                    <select id="setting-language" v-model="selectedLanguage" class="settings-select" disabled>
                                        <option value="en-US">English</option>
                                    </select>
                                    <span class="settings-select-arrow">▼</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- Section 2: Player & Ad Preferences -->
                    <section class="settings-card">
                        <div class="settings-card__header">
                            <div class="settings-card__icon-box">🎬</div>
                            <div>
                                <h2 class="settings-card__title">Player & Ad Controls</h2>
                                <p class="settings-card__desc">Customize your default streaming server and advertising preferences.</p>
                            </div>
                        </div>

                        <div class="settings-card__body">
                            <!-- Remove Ads Toggle -->
                            <div class="settings-toggle-row">
                                <div class="settings-toggle-info">
                                    <span class="settings-toggle-label">Remove Ads / Ad-Free Mode</span>
                                    <span class="settings-toggle-desc">Suppress sitewide promotional overlays and third-party advertising scripts.</span>
                                </div>
                                <label class="settings-switch">
                                    <input type="checkbox" v-model="adsHidden" @change="toggleAdsHidden" />
                                    <span class="settings-slider" />
                                </label>
                            </div>

                            <!-- Default Server Selection -->
                            <div class="settings-field">
                                <label for="setting-server" class="settings-field__label eyebrow">Default Stream Server</label>
                                <p class="settings-field__help">Server selection is coming soon — currently set to Poseidon (Multi-Audio HD).</p>
                                <div class="settings-select-wrapper is-disabled">
                                    <select id="setting-server" v-model="defaultServerId" class="settings-select" disabled>
                                        <option value="moovie">Moovie</option>
                                    </select>
                                    <span class="settings-select-arrow">▼</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- Section: Playback Routing (Direct / VPS Proxy) -->
                    <section class="settings-card">
                        <div class="settings-card__header">
                            <div class="settings-card__icon-box">🛰️</div>
                            <div>
                                <h2 class="settings-card__title">Playback Routing</h2>
                                <p class="settings-card__desc">Choose how scraped streams are played: direct from the source or relayed through the VPS proxy.</p>
                            </div>
                        </div>

                        <div class="settings-card__body">
                            <div class="settings-field">
                                <label for="setting-route" class="settings-field__label eyebrow">Stream Route</label>
                                <p class="settings-field__help">This applies to every scraper stream. Changes are only applied once you hit Save — playback keeps your current route until then.</p>
                                <div class="settings-select-wrapper">
                                    <select id="setting-route" v-model="draftRoute" class="settings-select">
                                        <option value="auto">Auto (Follow Site Setting)</option>
                                        <option value="direct">Direct (Play Straight From Source)</option>
                                        <option value="proxy">VPS Proxy (Route Through Server)</option>
                                    </select>
                                    <span class="settings-select-arrow">▼</span>
                                </div>
                            </div>

                            <div class="settings-action-box">
                                <div>
                                    <span class="settings-action-title">Playback Route: <span style="color: var(--ember);">{{ routeLabel }}</span></span>
                                    <span class="settings-action-desc">
                                        {{ routeDirty ? 'You have unsaved changes — click Save to apply.' : 'This is the route currently used by the player.' }}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    class="settings-btn settings-btn--save"
                                    :disabled="!routeDirty"
                                    @click="savePlaybackRoute"
                                >
                                    Save Route
                                </button>
                            </div>
                        </div>
                    </section>

                    <!-- Section 3: FebBox Cloud Integration -->
                    <section class="settings-card">
                        <div class="settings-card__header">
                            <div class="settings-card__icon-box">☁️</div>
                            <div>
                                <h2 class="settings-card__title">FebBox Cloud Integration</h2>
                                <p class="settings-card__desc">Configure FebBox cloud storage sources, stream quality, and user token.</p>
                            </div>
                        </div>

                        <div class="settings-card__body">
                            <!-- Enable FebBox -->
                            <div class="settings-toggle-row">
                                <div class="settings-toggle-info">
                                    <span class="settings-toggle-label">Enable FebBox Sources</span>
                                    <span class="settings-toggle-desc">Include FebBox cloud stream mirrors in video source listings.</span>
                                </div>
                                <label class="settings-switch">
                                    <input type="checkbox" v-model="febboxEnabled" @change="saveFebboxSettings" />
                                    <span class="settings-slider" />
                                </label>
                            </div>

                            <!-- FebBox Token Input -->
                            <div class="settings-field">
                                <label for="setting-febbox-token" class="settings-field__label eyebrow">FebBox User Token / Key</label>
                                <p class="settings-field__help">Optional VIP account key to unlock high-speed FebBox direct streaming threads.</p>
                                <input
                                    id="setting-febbox-token"
                                    type="text"
                                    v-model="febboxToken"
                                    placeholder="Enter FebBox user token..."
                                    class="settings-input"
                                    @change="saveFebboxSettings"
                                />
                            </div>

                            <!-- FebBox Quality Preference -->
                            <div class="settings-field">
                                <label for="setting-febbox-quality" class="settings-field__label eyebrow">FebBox Stream Quality</label>
                                <p class="settings-field__help">Preferred default video resolution for FebBox cloud stream links.</p>
                                <div class="settings-select-wrapper">
                                    <select id="setting-febbox-quality" v-model="febboxQuality" class="settings-select" @change="saveFebboxSettings">
                                        <option value="auto">Auto (Best Available)</option>
                                        <option value="1080p">1080p Full HD</option>
                                        <option value="720p">720p HD</option>
                                        <option value="480p">480p SD</option>
                                    </select>
                                    <span class="settings-select-arrow">▼</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- Section 3: Artwork & Image Quality -->
                    <section class="settings-card">
                        <div class="settings-card__header">
                            <div class="settings-card__icon-box">🖼️</div>
                            <div>
                                <h2 class="settings-card__title">Artwork & Performance</h2>
                                <p class="settings-card__desc">Adjust TMDB poster resolution and manage local client caching.</p>
                            </div>
                        </div>

                        <div class="settings-card__body">
                            <!-- TMDB Quality -->
                            <div class="settings-field">
                                <label for="setting-quality" class="settings-field__label eyebrow">Poster & Image Quality</label>
                                <p class="settings-field__help">Lower quality loads faster on limited mobile connections; High provides crisp 4K artwork.</p>
                                <div class="settings-select-wrapper">
                                    <select id="setting-quality" v-model="imageQuality" class="settings-select" @change="saveImageQuality">
                                        <option value="low">Low (Fast Loading / Low Data)</option>
                                        <option value="medium">Medium (Balanced Standard)</option>
                                        <option value="high">High (Maximum Resolution)</option>
                                    </select>
                                    <span class="settings-select-arrow">▼</span>
                                </div>
                            </div>

                            <!-- Cache Purge Button -->
                            <div class="settings-action-box">
                                <div>
                                    <span class="settings-action-title">Local Storage & Cache Cleanup</span>
                                    <span class="settings-action-desc">Purge cached poster images, catalog enrichments, and temporary session data.</span>
                                </div>
                                <button type="button" class="settings-btn settings-btn--danger" @click="clearLocalCache">
                                    Purge Cache 🧹
                                </button>
                            </div>
                        </div>
                    </section>

                    <!-- Section 4: Account & History -->
                    <section class="settings-card">
                        <div class="settings-card__header">
                            <div class="settings-card__icon-box">👤</div>
                            <div>
                                <h2 class="settings-card__title">Account & Data Management</h2>
                                <p class="settings-card__desc">Manage your active user profile, watch history, and saved data.</p>
                            </div>
                        </div>

                        <div class="settings-card__body">
                            <div class="settings-user-info">
                                <div class="settings-user-avatar">
                                    {{ (currentUser || 'Guest').charAt(0).toUpperCase() }}
                                </div>
                                <div class="settings-user-details">
                                    <span class="settings-user-name">{{ currentUser || 'Guest User' }}</span>
                                    <span class="settings-user-status">
                                        {{ currentUser ? 'Logged In' : 'Guest Mode (Local Storage)' }}
                                    </span>
                                </div>
                            </div>

                            <div class="settings-actions-grid">
                                <button type="button" class="settings-btn settings-btn--outline" @click="clearSearchHistory">
                                    Clear Search History
                                </button>
                                <button type="button" class="settings-btn settings-btn--outline" @click="clearWatchHistory">
                                    Clear Watch History
                                </button>
                                <button v-if="currentUser" type="button" class="settings-btn settings-btn--danger" @click="handleSignOut">
                                    Sign Out 🚪
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import { getSettings, REGIONS } from '../composables/useSettings';
import { usePlaybackRoute, type PlaybackRoute } from '../composables/usePlaybackRoute';
import { getCurrentUser, logoutUser } from '../lib/auth';
import { useSeo } from '../composables/useSeo';
import { useToast } from '../composables/useToast';

const { updateSeo } = useSeo();
const { region, language, updateSettings } = getSettings();
const { addToast } = useToast();
const { savedRoute, draftRoute, saveRoute } = usePlaybackRoute();

const routeLabel = computed(() => {
    const map: Record<PlaybackRoute, string> = {
        auto: 'Auto (Follow Site Setting)',
        direct: 'Direct',
        proxy: 'VPS Proxy'
    };
    return map[draftRoute.value] || 'Auto';
});

const routeDirty = computed(() => draftRoute.value !== savedRoute.value);

function savePlaybackRoute() {
    saveRoute();
    addToast('Playback route saved — new streams will use this route.', 'success');
}

const selectedRegion = ref(region.value || 'global');
const selectedLanguage = ref(language.value || 'en-US');
const adsHidden = ref(localStorage.getItem('ads_hidden') === 'true');
const defaultServerId = ref(localStorage.getItem('default_server_id') || 'poseidon');
const imageQuality = ref<'low' | 'medium' | 'high'>(
    (localStorage.getItem('movora_image_quality') as any) || 'medium'
);
const febboxEnabled = ref(localStorage.getItem('febbox_enabled') !== 'false');
const febboxToken = ref(localStorage.getItem('febbox_token') || '');
const febboxQuality = ref(localStorage.getItem('febbox_quality') || 'auto');
const currentUser = ref(getCurrentUser());

function saveRegionalSettings() {
    updateSettings(selectedRegion.value, selectedLanguage.value);
    addToast('Regional settings saved successfully!', 'success');
}

function saveFebboxSettings() {
    localStorage.setItem('febbox_enabled', String(febboxEnabled.value));
    localStorage.setItem('febbox_token', febboxToken.value.trim());
    localStorage.setItem('febbox_quality', febboxQuality.value);
    addToast('FebBox settings updated!', 'success');
}

function toggleAdsHidden() {
    localStorage.setItem('ads_hidden', String(adsHidden.value));
    addToast(adsHidden.value ? 'Ad-free mode enabled! Reloading...' : 'Ads re-enabled. Reloading...', 'info');
    setTimeout(() => {
        window.location.reload();
    }, 600);
}

function saveImageQuality() {
    localStorage.setItem('movora_image_quality', imageQuality.value);
    addToast(`Poster quality set to ${imageQuality.value.toUpperCase()}`, 'info');
}

async function clearLocalCache() {
    try {
        if (typeof window !== 'undefined' && window.caches) {
            const keys = await window.caches.keys();
            for (const key of keys) {
                await window.caches.delete(key);
            }
        }
        localStorage.removeItem('moovie_poster_cache_v1');
        localStorage.removeItem('movora_poster_cache_v1');
        localStorage.removeItem('genres-cache-movie');
        localStorage.removeItem('genres-cache-tv');
        addToast('Local storage cache purged successfully!', 'success');
    } catch {
        addToast('Failed to clear cache', 'error');
    }
}

function clearSearchHistory() {
    localStorage.removeItem('searchHistory');
    addToast('Search history cleared!', 'info');
}

function clearWatchHistory() {
    localStorage.removeItem('viewHistory');
    addToast('Watch history cleared!', 'info');
}

function handleSignOut() {
    logoutUser();
    currentUser.value = null;
    addToast('Signed out of your account', 'info');
}

onMounted(() => {
    updateSeo({
        title: 'Settings & Preferences — Moovie',
        canonical: 'https://moovie.fun/settings'
    });
});
</script>

<style lang="scss" scoped>
.settings-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-dark);
    color: var(--bone-100);

    &__main {
        flex: 1;
        padding-top: calc(var(--site-header-height) + var(--s-6));
        padding-bottom: var(--s-10);
    }

    &__header {
        margin-bottom: var(--s-8);
    }

    &__badge {
        display: inline-block;
        padding: var(--s-1) var(--s-3);
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ember);
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.25);
        border-radius: var(--r-pill);
        margin-bottom: var(--s-3);
    }

    &__title {
        font-size: clamp(2rem, 4vw, 3rem);
        color: var(--bone-50);
        margin-bottom: var(--s-2);
    }

    &__subtitle {
        max-width: 680px;
        font-size: 1rem;
        color: var(--bone-300);
        line-height: 1.5;
    }

    &__grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: var(--s-6);

        @media (max-width: 900px) {
            grid-template-columns: 1fr;
        }
    }
}

.settings-card {
    background: #080808;
    backdrop-filter: blur(16px);
    border: 1px solid var(--rule);
    border-radius: var(--r-lg);
    padding: var(--s-6);
    display: flex;
    flex-direction: column;
    gap: var(--s-5);
    box-shadow: var(--shadow-md);
    transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast);

    &:hover {
        border-color: rgba(255, 255, 255, 0.3);
    }

    &__header {
        display: flex;
        align-items: flex-start;
        gap: var(--s-4);
        padding-bottom: var(--s-4);
        border-bottom: 1px solid var(--rule);
    }

    &__icon-box {
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.3rem;
        background: #0d0d0d;
        border: 1px solid var(--rule);
        border-radius: var(--r-md);
        flex-shrink: 0;
    }

    &__title {
        font-size: 1.25rem;
        color: var(--bone-50);
        margin-bottom: 2px;
    }

    &__desc {
        font-size: 0.85rem;
        color: var(--bone-400);
        line-height: 1.4;
    }

    &__body {
        display: flex;
        flex-direction: column;
        gap: var(--s-5);
    }
}

.settings-field {
    display: flex;
    flex-direction: column;
    gap: 6px;

    &__label {
        color: var(--bone-200);
        font-size: 0.75rem;
    }

    &__help {
        font-size: 0.8rem;
        color: var(--bone-400);
        margin-bottom: 4px;
    }
}

.settings-select-wrapper {
    position: relative;
    width: 100%;
}
.settings-select-wrapper.is-disabled {
    opacity: 0.5;
    pointer-events: none;
}

.settings-select {
    width: 100%;
    appearance: none;
    padding: var(--s-3) var(--s-4);
    font-family: var(--font-ui);
    font-size: 0.92rem;
    color: var(--bone-100);
    background: #050505;
    border: 1px solid var(--rule);
    border-radius: var(--r-md);
    cursor: pointer;
    outline: none;
    transition: border-color var(--dur-fast), background var(--dur-fast);

    &:focus, &:hover {
        border-color: var(--ember);
        background: #101010;
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    option {
        background: #111;
        color: #fff;
    }
}

.settings-select-arrow {
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.7rem;
    color: var(--bone-400);
    pointer-events: none;
}

.settings-input {
    width: 100%;
    padding: var(--s-3) var(--s-4);
    font-family: var(--font-ui);
    font-size: 0.92rem;
    color: var(--bone-100);
    background: #050505;
    border: 1px solid var(--rule);
    border-radius: var(--r-md);
    outline: none;
    transition: border-color var(--dur-fast), background var(--dur-fast);
    &:focus {
        border-color: var(--ember);
        background: #101010;
    }
    &::placeholder {
        color: var(--bone-500);
    }
}

.settings-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--s-4);
    padding: var(--s-3) var(--s-4);
    background: #050505;
    border: 1px solid var(--rule);
    border-radius: var(--r-md);
}

.settings-toggle-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.settings-toggle-label {
    font-size: 0.92rem;
    font-weight: 600;
    color: var(--bone-100);
}

.settings-toggle-desc {
    font-size: 0.78rem;
    color: var(--bone-400);
}

.settings-switch {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 26px;
    flex-shrink: 0;

    input {
        opacity: 0;
        width: 0;
        height: 0;

        &:checked + .settings-slider {
            background-color: var(--ember);
        }

        &:checked + .settings-slider:before {
            transform: translateX(22px);
        }
    }
}

.settings-slider {
    position: absolute;
    cursor: pointer;
    top: 0; left: 0; right: 0; bottom: 0;
    background-color: rgba(255, 255, 255, 0.15);
    transition: .3s;
    border-radius: 34px;

    &:before {
        position: absolute;
        content: "";
        height: 18px;
        width: 18px;
        left: 4px;
        bottom: 4px;
        background-color: white;
        transition: .3s;
        border-radius: 50%;
    }
}

.settings-action-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--s-4);
    padding: var(--s-4);
    background: #050505;
    border: 1px solid var(--rule);
    border-radius: var(--r-md);

    @media (max-width: 600px) {
        flex-direction: column;
        align-items: stretch;
    }
}

.settings-action-title {
    display: block;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--bone-100);
    margin-bottom: 2px;
}

.settings-action-desc {
    display: block;
    font-size: 0.78rem;
    color: var(--bone-400);
}

.settings-user-info {
    display: flex;
    align-items: center;
    gap: var(--s-4);
    padding: var(--s-4);
    background: #050505;
    border: 1px solid var(--rule);
    border-radius: var(--r-md);
}

.settings-user-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--ember) 0%, #ffffff 100%);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3rem;
    font-weight: 700;
    flex-shrink: 0;
}

.settings-user-details {
    display: flex;
    flex-direction: column;
}

.settings-user-name {
    font-size: 1rem;
    font-weight: 700;
    color: var(--bone-50);
}

.settings-user-status {
    font-size: 0.8rem;
    color: var(--bone-400);
}

.settings-actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--s-3);
}

.settings-btn {
    padding: var(--s-3) var(--s-4);
    font-family: var(--font-ui);
    font-size: 0.85rem;
    font-weight: 600;
    border-radius: var(--r-md);
    cursor: pointer;
    transition: all var(--dur-fast) var(--ease-out);
    text-align: center;

    &--outline {
        background: transparent;
        color: var(--bone-200);
        border: 1px solid var(--rule);

        &:hover {
            background: var(--surface-tint);
            border-color: var(--bone-300);
            color: #fff;
        }
    }

    &--save {
        background: var(--ember);
        color: #fff;
        border: 1px solid var(--ember);
        white-space: nowrap;

        &:hover:not(:disabled) {
            background: var(--ember-600);
            box-shadow: 0 4px 20px rgba(255, 90, 31, 0.3);
        }

        &:disabled {
            opacity: 0.45;
            cursor: not-allowed;
        }
    }

    &--danger {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
        border: 1px solid rgba(239, 68, 68, 0.3);

        &:hover {
            background: rgba(239, 68, 68, 0.3);
            border-color: rgba(239, 68, 68, 0.6);
            color: #fff;
        }
    }
}
</style>
