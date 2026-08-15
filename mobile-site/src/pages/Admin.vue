<template>
    <div class="admin-page">
        <div class="admin-page__orb orb-left" />
        <div class="admin-page__orb orb-right" />

        <div class="admin-page__container">
            <section v-if="!authenticated" class="admin-page__view">
                <h1 class="admin-page__title">Admin Gateway</h1>
                <p class="admin-page__subtitle">Access settings dashboard to configure defaults.</p>
                <form @submit.prevent="handleAuthenticate">
                    <div class="admin-page__field">
                        <label class="admin-page__label" for="passcode">Passcode</label>
                        <input
                            id="passcode"
                            v-model="passcode"
                            type="password"
                            class="admin-page__input"
                            placeholder="••••••••"
                            required
                            autocomplete="current-password"
                        >
                    </div>
                    <button type="submit" class="admin-page__btn" :disabled="authLoading">
                        <span>{{ authLoading ? 'Verifying...' : 'Unlock Dashboard' }}</span>
                    </button>
                </form>
            </section>

            <section v-else class="admin-page__view">
                <h1 class="admin-page__title">Site Settings</h1>
                <p class="admin-page__subtitle">Update default videoplayer instantly without rebuilding.</p>

                <form @submit.prevent="handleSaveSettings">
                    <div class="admin-page__field">
                        <label class="admin-page__label" for="default-provider">Default Stream Player (PC)</label>
                        <select id="default-provider" v-model="settings.defaultProvider" class="admin-page__select">
                            <option value="moovie">Moovie (moovie server)</option>
                            <option value="moovie_x">Moovie X (peestream.in)</option>
                            <option value="sugar">Sugar (vidcodin.net)</option>
                            <option value="rasmalai">Rasmalai (sweet server)</option>
                            <option value="cinemaos">Gulab Jamun (CinemaOS)</option>
                            <option value="smashy">Jalebi (SmashyStream)</option>
                            <option value="mappletv">Kaju Katli (MappleTV)</option>
                            <option value="vidsuper">Motichoor Ladoo (Vidsuper)</option>
                            <option value="vidking">Kheer (VidKing)</option>
                            <option value="videasy">Barfi (VidEasy)</option>
                            <option value="vidsrc_ru">Laddu (VidSrc.ru)</option>
                            <option value="vidsrc_su">Peda (VidSrc.su)</option>
                            <option value="vidsrcme">Gajar Ka Halwa (VidSrcMe)</option>
                            <option value="multiembed">Soan Papdi (MultiEmbed)</option>
                            <option value="vsrc">Sandesh (vsrc.su)</option>
                            <option value="vidlink">Cham Cham (VidLink)</option>
                            <option value="autoembed">Kulfi (AutoEmbed)</option>
                            <option value="vidfast">Mysore Pak (VidFast)</option>
                            <option value="movies111">Imarti (111Movies)</option>
                            <option value="vidora">Ghevar (Vidora)</option>
                            <option value="icecream">Icecream (Chillflix)</option>
                            <option value="cinezo">Cheesecake (Cinezo)</option>
                            <option value="nankhatai">Nankhatai (NontonGo)</option>
                            <option value="petha">Petha (NontonGo)</option>
                            <option value="spoider">Spoider (screenscape.me)</option>
                        </select>
                    </div>

                    <div class="admin-page__field">
                        <label class="admin-page__label" for="default-provider-mobile">Default Stream Player (Mobile)</label>
                        <select id="default-provider-mobile" v-model="settings.defaultProviderMobile" class="admin-page__select">
                            <option value="moovie">Moovie (moovie server)</option>
                            <option value="moovie_x">Moovie X (peestream.in)</option>
                            <option value="sugar">Sugar (vidcodin.net)</option>
                            <option value="rasmalai">Rasmalai (sweet server)</option>
                            <option value="cinemaos">Gulab Jamun (CinemaOS)</option>
                            <option value="smashy">Jalebi (SmashyStream)</option>
                            <option value="mappletv">Kaju Katli (MappleTV)</option>
                            <option value="vidsuper">Motichoor Ladoo (Vidsuper)</option>
                            <option value="vidking">Kheer (VidKing)</option>
                            <option value="videasy">Barfi (VidEasy)</option>
                            <option value="vidsrc_ru">Laddu (VidSrc.ru)</option>
                            <option value="vidsrc_su">Peda (VidSrc.su)</option>
                            <option value="vidsrcme">Gajar Ka Halwa (VidSrcMe)</option>
                            <option value="multiembed">Soan Papdi (MultiEmbed)</option>
                            <option value="vsrc">Sandesh (vsrc.su)</option>
                            <option value="vidlink">Cham Cham (VidLink)</option>
                            <option value="autoembed">Kulfi (AutoEmbed)</option>
                            <option value="vidfast">Mysore Pak (VidFast)</option>
                            <option value="movies111">Imarti (111Movies)</option>
                            <option value="vidora">Ghevar (Vidora)</option>
                            <option value="icecream">Icecream (Chillflix)</option>
                            <option value="cinezo">Cheesecake (Cinezo)</option>
                            <option value="nankhatai">Nankhatai (NontonGo)</option>
                            <option value="petha">Petha (NontonGo)</option>
                            <option value="spoider">Spoider (screenscape.me)</option>
                        </select>
                    </div>

                    <div class="admin-page__field">
                        <label class="admin-page__label" for="tmdb-quality">TMDB Image Quality</label>
                        <select id="tmdb-quality" v-model="settings.tmdbQuality" class="admin-page__select">
                            <option value="low">Low - faster, smaller poster images</option>
                            <option value="medium">Medium - balanced image quality</option>
                            <option value="high">High - sharpest images, heavier bandwidth</option>
                        </select>
                    </div>

                    <div class="admin-page__field">
                        <label class="admin-page__label">Groq API Keys (3 Slots)</label>
                        <input v-model="settings.groqKeys[0]" type="password" class="admin-page__input" placeholder="Groq API Key Slot 1">
                        <input v-model="settings.groqKeys[1]" type="password" class="admin-page__input" placeholder="Groq API Key Slot 2">
                        <input v-model="settings.groqKeys[2]" type="password" class="admin-page__input" placeholder="Groq API Key Slot 3">
                        <p class="admin-page__hint">Enter up to 3 keys. Failover on rate limits.</p>
                    </div>

                    <div class="admin-page__field">
                        <label class="admin-page__label">OpenSubtitles API Keys (Auto-Failover)</label>
                        <div v-for="(_, i) in osApiKeys" :key="i" style="display:flex;gap:0.5rem;margin-bottom:0.5rem;align-items:center">
                            <input v-model="osApiKeys[i]" type="password" class="admin-page__input" style="flex:1" placeholder="OpenSubtitles API Key">
                            <button type="button" class="admin-page__btn admin-page__btn--sm admin-page__btn--danger" @click="removeOsKey(i)" v-if="osApiKeys.length > 1">&times;</button>
                        </div>
                        <button type="button" class="admin-page__btn admin-page__btn--sm" @click="addOsKey">+ Add Key</button>
                        <p class="admin-page__hint">Keys are tried in order. If one fails (429/403), the next key is used automatically.</p>
                    </div>

                    <div class="admin-page__field">
                        <label class="admin-page__label" for="new-passcode">Change Passcode (Optional)</label>
                        <input id="new-passcode" v-model="newPasscode" type="password" class="admin-page__input" placeholder="Enter new passcode to update">
                    </div>

                    <button type="submit" class="admin-page__btn" :disabled="saveLoading">
                        <span>{{ saveLoading ? 'Saving...' : 'Save Changes' }}</span>
                    </button>
                </form>

                <div class="admin-page__curation">
                    <h2 class="admin-page__section-title">
                        4K Selection
                        <span class="admin-page__curation-count">({{ selectedMovies.length }}/10)</span>
                    </h2>

                    <form @submit.prevent="handleSearch4K" class="admin-page__search-row">
                        <input v-model="searchQuery" type="text" class="admin-page__input" placeholder="Search movies..." autocomplete="off">
                        <button type="submit" class="admin-page__btn admin-page__btn--sm">Search</button>
                    </form>

                    <ul v-if="searchResults.length" class="admin-page__list">
                        <li v-for="movie in searchResults" :key="movie.id" class="admin-page__list-item">
                            <div class="admin-page__item-details">
                                <div class="admin-page__item-title">{{ movie.title }}</div>
                                <div class="admin-page__item-meta">{{ movie.release_date ? movie.release_date.split('-')[0] : 'N/A' }}</div>
                            </div>
                            <button
                                type="button"
                                class="admin-page__btn admin-page__btn--sm"
                                :disabled="isAlreadyAdded(movie.id) || selectedMovies.length >= 10"
                                @click="addMovie(movie)"
                            >
                                {{ isAlreadyAdded(movie.id) ? 'Added' : 'Add' }}
                            </button>
                        </li>
                    </ul>

                    <ul class="admin-page__list">
                        <li v-if="!selectedMovies.length" class="admin-page__empty">No 4K movies selected yet</li>
                        <li v-for="(movie, index) in selectedMovies" :key="movie.id" class="admin-page__list-item">
                            <div class="admin-page__item-details">
                                <div class="admin-page__item-title">{{ index + 1 }}. {{ movie.title }}</div>
                                <div class="admin-page__item-meta">{{ movie.releaseDate ? movie.releaseDate.split('-')[0] : 'N/A' }}</div>
                            </div>
                            <div class="admin-page__item-actions">
                                <button type="button" class="admin-page__icon-btn" :disabled="index === 0" @click="moveItem(index, -1)">↑</button>
                                <button type="button" class="admin-page__icon-btn" :disabled="index === selectedMovies.length - 1" @click="moveItem(index, 1)">↓</button>
                                <button type="button" class="admin-page__icon-btn admin-page__icon-btn--danger" @click="removeMovie(movie.id)">✕</button>
                            </div>
                        </li>
                    </ul>

                    <button type="button" class="admin-page__btn" :disabled="save4kLoading" @click="handleSave4K">
                        <span>{{ save4kLoading ? 'Saving curation...' : 'Save 4K Curation' }}</span>
                    </button>
                </div>

                <div class="admin-page__server-grid">
                    <div class="admin-page__server-row"><strong>ID</strong><strong>Sweet Name</strong></div>
                    <div class="admin-page__server-row"><span>moovie</span><span>Moovie</span></div>
                    <div class="admin-page__server-row"><span>rasmalai</span><span>Rasmalai</span></div>
                    <div class="admin-page__server-row"><span>cinemaos</span><span>Gulab Jamun</span></div>
                    <div class="admin-page__server-row"><span>smashy</span><span>Jalebi</span></div>
                    <div class="admin-page__server-row"><span>mappletv</span><span>Kaju Katli</span></div>
                    <div class="admin-page__server-row"><span>vidsuper</span><span>Motichoor Ladoo</span></div>
                    <div class="admin-page__server-row"><span>vidking</span><span>Kheer</span></div>
                    <div class="admin-page__server-row"><span>videasy</span><span>Barfi</span></div>
                    <div class="admin-page__server-row"><span>vidsrc_ru</span><span>Laddu</span></div>
                    <div class="admin-page__server-row"><span>vidsrc_su</span><span>Peda</span></div>
                    <div class="admin-page__server-row"><span>vidsrcme</span><span>Gajar Ka Halwa</span></div>
                    <div class="admin-page__server-row"><span>multiembed</span><span>Soan Papdi</span></div>
                    <div class="admin-page__server-row"><span>vsrc</span><span>Sandesh</span></div>
                    <div class="admin-page__server-row"><span>vidlink</span><span>Cham Cham</span></div>
                    <div class="admin-page__server-row"><span>autoembed</span><span>Kulfi</span></div>
                    <div class="admin-page__server-row"><span>vidfast</span><span>Mysore Pak</span></div>
                    <div class="admin-page__server-row"><span>movies111</span><span>Imarti</span></div>
                    <div class="admin-page__server-row"><span>vidora</span><span>Ghevar</span></div>
                    <div class="admin-page__server-row"><span>icecream</span><span>Icecream</span></div>
                    <div class="admin-page__server-row"><span>cinezo</span><span>Cheesecake</span></div>
                    <div class="admin-page__server-row"><span>nankhatai</span><span>Nankhatai</span></div>
                    <div class="admin-page__server-row"><span>petha</span><span>Petha</span></div>
                    <div class="admin-page__server-row"><span>spoider</span><span>Spoider</span></div>
                </div>

                <!-- Server Reorder -->
                <div style="margin-top: 2rem;">
                    <h2 class="admin-page__section-title">Server Order</h2>
                    <p class="admin-page__hint" style="margin-bottom:0.75rem;">Rearrange the server list for all users.</p>
                    <div v-for="(s, i) in serverOrderList" :key="s.id" class="admin-page__reorder-item">
                        <div class="admin-page__reorder-controls">
                            <button type="button" class="admin-page__reorder-btn" :disabled="i === 0" @click="moveServer(i, -1)">↑</button>
                            <button type="button" class="admin-page__reorder-btn" :disabled="i === serverOrderList.length - 1" @click="moveServer(i, 1)">↓</button>
                        </div>
                        <span class="admin-page__reorder-idx">{{ i + 1 }}</span>
                        <span class="admin-page__reorder-name">{{ s.name }}</span>
                        <span class="admin-page__reorder-id">{{ s.id }}</span>
                    </div>
                    <button type="button" class="admin-page__btn" style="margin-top:0.75rem;" :disabled="orderSaving" @click="handleSaveOrder">
                        <span>{{ orderSaving ? 'Saving...' : 'Save Server Order' }}</span>
                    </button>
                </div>

                <div class="admin-page__curation">
                    <h2 class="admin-page__section-title">Donations Tracker</h2>

                    <div class="admin-page__balance-card">
                        <h3 class="admin-page__subsection-title">Live Wallet Balance</h3>
                        <div v-if="cryptoLoading" class="admin-page__empty">Checking wallets...</div>
                        <template v-else>
                            <div class="admin-page__balance-row"><span>BTC</span><span>${{ cryptoBtcUsd.toFixed(2) }}</span></div>
                            <div class="admin-page__balance-row"><span>LTC</span><span>${{ cryptoLtcUsd.toFixed(2) }}</span></div>
                            <div class="admin-page__balance-row"><span>USDT</span><span>${{ cryptoUsdtUsd.toFixed(2) }}</span></div>
                            <div class="admin-page__balance-row admin-page__balance-row--total"><span>Total</span><span>${{ cryptoTotal.toFixed(2) }}</span></div>
                        </template>
                        <button type="button" class="admin-page__btn admin-page__btn--sm" :disabled="cryptoLoading" @click="refreshCryptoBalance" style="margin-top:0.5rem">
                            {{ cryptoLoading ? 'Refreshing...' : 'Refresh Balance' }}
                        </button>
                    </div>

                    <form @submit.prevent="handleSaveDonations">
                        <div class="admin-page__field">
                            <label class="admin-page__label" for="donation-raised">Manual Override Amount ($)</label>
                            <input id="donation-raised" v-model.number="donationRaised" type="number" class="admin-page__input" min="0" step="0.01" placeholder="0">
                        </div>
                        <div class="admin-page__field">
                            <label class="admin-page__label">
                                <input v-model="donationPopupEnabled" type="checkbox" style="margin-right:0.5rem">
                                Show donation popup on first visit
                            </label>
                        </div>
                        <button type="submit" class="admin-page__btn" :disabled="donationLoading">
                            <span>{{ donationLoading ? 'Saving...' : 'Save Donation Settings' }}</span>
                        </button>
                    </form>

                    <button type="button" class="admin-page__btn admin-page__btn--donation" :disabled="donationNotifLoading" @click="handleDonationNotif" style="margin-top:0.75rem">
                        <span>{{ donationNotifLoading ? 'Sending...' : '❤️ Notify everyone — donation received!' }}</span>
                    </button>
                </div>

                <div class="admin-page__curation">
                    <h2 class="admin-page__section-title">Ad Management</h2>
                    <p class="admin-page__hint" style="margin-bottom:1rem">Turn ads on/off separately for PC and Mobile.</p>

                    <div class="admin-page__field">
                        <label class="admin-page__label" style="display:flex;align-items:center;gap:0.75rem;text-transform:none;font-weight:400;font-size:0.85rem">
                            <span>📢 Ads PC</span>
                            <label class="admin-page__toggle" style="margin-left:auto">
                                <input v-model="adsPcEnabled" type="checkbox" class="admin-page__toggle-input">
                                <span class="admin-page__toggle-track">
                                    <span class="admin-page__toggle-knob" />
                                </span>
                            </label>
                        </label>
                    </div>

                    <div class="admin-page__field">
                        <label class="admin-page__label" style="display:flex;align-items:center;gap:0.75rem;text-transform:none;font-weight:400;font-size:0.85rem">
                            <span>📢 Ads Mobile</span>
                            <label class="admin-page__toggle" style="margin-left:auto">
                                <input v-model="adsMobileEnabled" type="checkbox" class="admin-page__toggle-input">
                                <span class="admin-page__toggle-track">
                                    <span class="admin-page__toggle-knob" />
                                </span>
                            </label>
                        </label>
                    </div>

                    <div class="admin-page__field">
                        <label class="admin-page__label" style="display:flex;align-items:center;gap:0.75rem;text-transform:none;font-weight:400;font-size:0.85rem">
                            <span>🙈 Hide Support Button</span>
                            <label class="admin-page__toggle" style="margin-left:auto">
                                <input v-model="supportBtnHidden" type="checkbox" class="admin-page__toggle-input">
                                <span class="admin-page__toggle-track">
                                    <span class="admin-page__toggle-knob" />
                                </span>
                            </label>
                        </label>
                    </div>

                    <div class="admin-page__field">
                        <label class="admin-page__label" style="display:flex;align-items:center;gap:0.75rem;text-transform:none;font-weight:400;font-size:0.85rem">
                            <span>🔄 Stream Proxy</span>
                            <label class="admin-page__toggle" style="margin-left:auto">
                                <input v-model="streamProxyEnabled" type="checkbox" class="admin-page__toggle-input">
                                <span class="admin-page__toggle-track">
                                    <span class="admin-page__toggle-knob" />
                                </span>
                            </label>
                        </label>
                    </div>

                    <button type="submit" class="admin-page__btn" :disabled="saveLoading" @click="handleSaveSettings" style="margin-top:0.5rem">
                        <span>{{ saveLoading ? 'Saving...' : 'Save Settings' }}</span>
                    </button>
                </div>
            </section>
        </div>

        <div class="admin-page__toast" :class="{ 'is-show': toast, 'is-success': toastType === 'success', 'is-error': toastType === 'error' }">
            {{ toast }}
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, reactive, onMounted } from 'vue'
import { serverOrder, setServerOrder, fetchServerOrder, getServers } from '@/composables/useStream'
import { getSyncClient } from '@/lib/syncClient'

const DEFAULT_PASSCODE = 'admin123'

let syncClient: any = null

async function getClient() {
    if (syncClient) return syncClient
    syncClient = await getSyncClient()
    return syncClient
}

const authenticated = ref(false)
const authLoading = ref(false)
const saveLoading = ref(false)
const save4kLoading = ref(false)
const orderSaving = ref(false)
const serverOrderList = ref<{ id: string; name: string }[]>([])
const passcode = ref('')
const newPasscode = ref('')
const toast = ref('')
const toastType = ref<'success' | 'error'>('success')
const searchQuery = ref('')
const searchResults = ref<any[]>([])
const selectedMovies = ref<any[]>([])
let adminPasscode = DEFAULT_PASSCODE

const settings = reactive({
    defaultProvider: 'icecream',
    defaultProviderMobile: 'icecream',
    tmdbQuality: 'medium',
    groqKeys: ['', '', '']
})
const osApiKeys = ref<string[]>([''])

function showToast(message: string, isSuccess = true) {
    toast.value = message
    toastType.value = isSuccess ? 'success' : 'error'
    setTimeout(() => { toast.value = '' }, 3000)
}

async function handleAuthenticate() {
    authLoading.value = true
    try {
        const client = await getClient()
        const { data } = await client.from('app_settings').select('value').eq('key', 'admin_passcode').single()
        if (data?.value) adminPasscode = data.value

        if (passcode.value === adminPasscode) {
            showToast('Access Granted!')
            authenticated.value = true
            await loadDashboardSettings()
        } else {
            showToast('Invalid passcode', false)
        }
    } catch {
        if (passcode.value === DEFAULT_PASSCODE) {
            showToast('Unlocked (using offline fallback)')
            authenticated.value = true
            await loadDashboardSettings()
        } else {
            showToast('Auth error. Make sure migrations are run.', false)
        }
    } finally {
        authLoading.value = false
    }
}

async function loadDashboardSettings() {
    const client = await getClient()
    try {
        const { data } = await client.from('app_settings').select('value').eq('key', 'default_provider').single()
        if (data?.value) settings.defaultProvider = data.value.toLowerCase()
    } catch { /* ignore */ }

    try {
        const { data } = await client.from('app_settings').select('value').eq('key', 'default_provider_mobile').single()
        if (data?.value) settings.defaultProviderMobile = data.value.toLowerCase()
    } catch { /* ignore */ }

    try {
        const { data } = await client.from('app_settings').select('value').eq('key', 'tmdb_image_quality').single()
        if (data?.value) settings.tmdbQuality = data.value
    } catch { /* ignore */ }

    try {
        const { data } = await client.from('app_settings').select('value').eq('key', 'groq_keys').single()
        if (data?.value) {
            const keys = JSON.parse(data.value)
            if (Array.isArray(keys)) {
                if (keys[0]) settings.groqKeys[0] = keys[0]
                if (keys[1]) settings.groqKeys[1] = keys[1]
                if (keys[2]) settings.groqKeys[2] = keys[2]
            }
        }
    } catch { /* ignore */ }

    try {
        const { data } = await client.from('app_settings').select('value').eq('key', 'opensubtitles_api_keys').single()
        if (data?.value) {
            const keys = JSON.parse(data.value)
            if (Array.isArray(keys) && keys.length) {
                osApiKeys.value = keys
            }
        }
    } catch { /* ignore */ }

    await load4KCuration()

    try {
        const { data } = await client.from('app_settings').select('value').eq('key', 'donation_raised').single()
        if (data?.value) donationRaised.value = Number(data.value)
    } catch { /* ignore */ }

    try {
        const { data } = await client.from('app_settings').select('value').eq('key', 'donation_popup_enabled').single()
        if (data?.value) donationPopupEnabled.value = data.value === 'true'
    } catch { /* ignore */ }

    try {
        const { data } = await client.from('app_settings').select('value').eq('key', 'ads_pc_enabled').single()
        adsPcEnabled.value = data?.value === 'true'
    } catch { /* ignore */ }

    try {
        const { data } = await client.from('app_settings').select('value').eq('key', 'ads_mobile_enabled').single()
        adsMobileEnabled.value = data?.value === 'true'
    } catch { /* ignore */ }

    try {
        const { data } = await client.from('app_settings').select('value').eq('key', 'support_btn_hidden').single()
        supportBtnHidden.value = data?.value === 'true'
    } catch { /* ignore */ }

    try {
        const { data } = await client.from('app_settings').select('value').eq('key', 'stream_proxy_enabled').single()
        if (data) streamProxyEnabled.value = data.value === 'true'
    } catch { /* ignore */ }

    await loadServerOrder()
}

async function loadServerOrder() {
    await fetchServerOrder()
    const servers = getServers('movie')
    const idMap: Record<string, string> = {
        moovie: 'Moovie',
        sugar: 'Sugar',
        rasmalai: 'Rasmalai', cinemaos: 'Gulab Jamun', smashy: 'Jalebi',
        mappletv: 'Kaju Katli', vidking: 'Kheer', videasy: 'Barfi',
        vidsrc_ru: 'Laddu', vidsrc_su: 'Peda', vidsrcme: 'Gajar Ka Halwa',
        multiembed: 'Soan Papdi', vsrc: 'Sandesh', vidlink: 'Cham Cham',
        autoembed: 'Kulfi', vidfast: 'Mysore Pak', movies111: 'Imarti',
        vidora: 'Ghevar', vidsuper: 'Motichoor Ladoo', icecream: 'Icecream',
        cinezo: 'Cheesecake', nankhatai: 'Nankhatai', petha: 'Petha', spoider: 'Spoider'
    }
    const reverseMap: Record<string, string> = {}
    for (const [id, name] of Object.entries(idMap)) reverseMap[name.toLowerCase()] = id

    if (serverOrder.value && serverOrder.value.length > 0) {
        const savedList = serverOrder.value.map(id => ({ id, name: idMap[id.toLowerCase()] || id }))
        const savedIds = new Set(serverOrder.value.map(id => id.toLowerCase()))
        for (const s of servers) {
            const id = reverseMap[s.name.toLowerCase()] || s.name.toLowerCase()
            if (!savedIds.has(id.toLowerCase())) {
                savedList.push({ id, name: s.name })
            }
        }
        serverOrderList.value = savedList
    } else {
        serverOrderList.value = servers.map(s => ({ id: reverseMap[s.name.toLowerCase()] || s.name.toLowerCase(), name: s.name }))
    }
}

function moveServer(index: number, direction: number) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= serverOrderList.value.length) return
    const item = serverOrderList.value.splice(index, 1)[0]
    serverOrderList.value.splice(newIndex, 0, item)
}

async function handleSaveOrder() {
    orderSaving.value = true
    const client = await getClient()
    try {
        const ids = serverOrderList.value.map(s => s.id)
        await client.from('app_settings').upsert({ key: 'server_order', value: JSON.stringify(ids), updated_at: new Date() }, { onConflict: 'key' })
        setServerOrder(ids)
        showToast('Server order updated!')
    } catch {
        showToast('Failed to save order', false)
    } finally {
        orderSaving.value = false
    }
}

async function handleSaveSettings() {
    saveLoading.value = true
    const client = await getClient()
    try {
        await client.from('app_settings').upsert({ key: 'default_provider', value: settings.defaultProvider, updated_at: new Date() }, { onConflict: 'key' })
        await client.from('app_settings').upsert({ key: 'default_provider_mobile', value: settings.defaultProviderMobile, updated_at: new Date() }, { onConflict: 'key' })
        await client.from('app_settings').upsert({ key: 'tmdb_image_quality', value: settings.tmdbQuality, updated_at: new Date() }, { onConflict: 'key' })

        const keys = settings.groqKeys.filter(Boolean)
        await client.from('app_settings').upsert({ key: 'groq_keys', value: JSON.stringify(keys), updated_at: new Date() }, { onConflict: 'key' })

        const osKeys = osApiKeys.value.filter(Boolean)
        await client.from('app_settings').upsert({ key: 'opensubtitles_api_keys', value: JSON.stringify(osKeys), updated_at: new Date() }, { onConflict: 'key' })

        if (newPasscode.value) {
            await client.from('app_settings').upsert({ key: 'admin_passcode', value: newPasscode.value, updated_at: new Date() }, { onConflict: 'key' })
            adminPasscode = newPasscode.value
            newPasscode.value = ''
        }

        await client.from('app_settings').upsert({ key: 'ads_pc_enabled', value: String(adsPcEnabled.value), updated_at: new Date() }, { onConflict: 'key' })
        await client.from('app_settings').upsert({ key: 'ads_mobile_enabled', value: String(adsMobileEnabled.value), updated_at: new Date() }, { onConflict: 'key' })
        await client.from('app_settings').upsert({ key: 'support_btn_hidden', value: String(supportBtnHidden.value), updated_at: new Date() }, { onConflict: 'key' })
        await client.from('app_settings').upsert({ key: 'stream_proxy_enabled', value: String(streamProxyEnabled.value), updated_at: new Date() }, { onConflict: 'key' })

        showToast('Settings updated successfully!')
    } catch {
        showToast('Failed to update settings in Sync', false)
    } finally {
        saveLoading.value = false
    }
}

async function load4KCuration() {
    const client = await getClient()
    try {
        const { data } = await client.from('app_settings').select('value').eq('key', '4k_movies_today').single()
        if (data?.value) selectedMovies.value = JSON.parse(data.value)
        else selectedMovies.value = []
    } catch {
        selectedMovies.value = []
    }
}

async function handleSearch4K() {
    if (!searchQuery.value.trim()) return
    try {
        const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=dfa4c2c7c1de1005adee824dc5593672&query=${encodeURIComponent(searchQuery.value)}&language=en-US&page=1`)
        const data = await res.json()
        searchResults.value = data.results || []
    } catch {
        searchResults.value = []
        showToast('Error searching movies', false)
    }
}

function isAlreadyAdded(id: number) {
    return selectedMovies.value.some((m: any) => m.id === id)
}

function addOsKey() {
    osApiKeys.value.push('')
}

function removeOsKey(index: number) {
    if (osApiKeys.value.length > 1) {
        osApiKeys.value.splice(index, 1)
    }
}

function addMovie(movie: any) {
    if (selectedMovies.value.length >= 10) return
    selectedMovies.value.push({
        id: movie.id,
        title: movie.title || movie.original_title,
        originalTitle: movie.original_title,
        posterPath: movie.poster_path,
        rating: movie.vote_average,
        releaseDate: movie.release_date,
        genreIds: movie.genre_ids,
        adult: movie.adult,
        type: 'movie'
    })
}

function removeMovie(id: number) {
    selectedMovies.value = selectedMovies.value.filter((m: any) => m.id !== id)
}

function moveItem(index: number, direction: number) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= selectedMovies.value.length) return
    const arr = selectedMovies.value
    const temp = arr[index]
    arr[index] = arr[newIndex]
    arr[newIndex] = temp
}

async function handleSave4K() {
    save4kLoading.value = true
    const client = await getClient()
    try {
        await client.from('app_settings').upsert({ key: '4k_movies_today', value: JSON.stringify(selectedMovies.value), updated_at: new Date() }, { onConflict: 'key' })
        showToast('4K curation saved successfully!')
    } catch {
        showToast('Failed to save 4K curation in Sync', false)
    } finally {
        save4kLoading.value = false
    }
}

// ── Ads ──────────────────────────────────────────────────────────────────────────
const adsPcEnabled = ref(false)
const adsMobileEnabled = ref(false)
const supportBtnHidden = ref(false)
const streamProxyEnabled = ref(true)

// ── Donations ────────────────────────────────────────────────────────────────────
const donationRaised = ref(0)
const donationLoading = ref(false)
const donationPopupEnabled = ref(true)
const donationNotifLoading = ref(false)
const cryptoBtcUsd = ref(0)
const cryptoLtcUsd = ref(0)
const cryptoUsdtUsd = ref(0)
const cryptoTotal = ref(0)
const cryptoLoading = ref(false)

async function refreshCryptoBalance() {
    cryptoLoading.value = true
    const BTC_ADDR = 'bc1qkk0yyu8efu2gep5y59ev7s4j0wxnpxsfh4ympk'
    const LTC_ADDR = 'ltc1qpnurrqnv466wa4uh6urh0ul5n4wu0rf8k5l25z'
    const USDT_ADDR = 'TKfaywHdffM1iYdiSP3xFPajxgXwq2jmDG'
    const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
    try {
        const [btcRes, ltcRes, usdtRes, priceRes] = await Promise.all([
            fetch(`https://api.blockchair.com/bitcoin/address/${BTC_ADDR}?limit=0,1`).then(r => r.json()).catch(() => ({})),
            fetch(`https://api.blockchair.com/litecoin/address/${LTC_ADDR}?limit=0,1`).then(r => r.json()).catch(() => ({})),
            fetch(`https://api.trongrid.io/v1/accounts/${USDT_ADDR}?only_confirmed=true`).then(r => r.json()).catch(() => ({})),
            fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,litecoin,tether&vs_currencies=usd').then(r => r.json()).catch(() => ({}))
        ])
        const btcBal = (btcRes?.data?.[BTC_ADDR]?.balance ?? 0) / 1e8
        const ltcBal = (ltcRes?.data?.[LTC_ADDR]?.balance ?? 0) / 1e8
        let usdtBal = 0
        const tokens = usdtRes?.data?.[0]?.trc20 ?? []
        for (const t of tokens) {
            if (t[USDT_CONTRACT]) { usdtBal = Number(t[USDT_CONTRACT]) / 1e6; break }
        }
        const btcPrice = priceRes?.bitcoin?.usd ?? 0
        const ltcPrice = priceRes?.litecoin?.usd ?? 0
        cryptoBtcUsd.value = btcBal * btcPrice
        cryptoLtcUsd.value = ltcBal * ltcPrice
        cryptoUsdtUsd.value = usdtBal
        cryptoTotal.value = cryptoBtcUsd.value + cryptoLtcUsd.value + cryptoUsdtUsd.value
    } catch { /* ignore */ } finally {
        cryptoLoading.value = false
    }
}

async function handleSaveDonations() {
    donationLoading.value = true
    const client = await getClient()
    try {
        await client.from('app_settings').upsert({ key: 'donation_raised', value: String(donationRaised.value), updated_at: new Date() }, { onConflict: 'key' })
        await client.from('app_settings').upsert({ key: 'donation_popup_enabled', value: String(donationPopupEnabled.value), updated_at: new Date() }, { onConflict: 'key' })
        showToast('Donation settings saved!')
    } catch {
        showToast('Failed to save donation settings', false)
    } finally {
        donationLoading.value = false
    }
}

async function handleDonationNotif() {
    donationNotifLoading.value = true
    const client = await getClient()
    try {
        const amount = cryptoTotal.value > 0 ? `$${cryptoTotal.value.toFixed(2)}` : 'a donation'
        await client.from('notifications').insert({
            title: `❤️ Someone just donated ${amount}!`,
            message: 'Thank you for keeping this thing running. 💛',
            type: 'success',
            created_by: 'admin',
            created_at: new Date().toISOString()
        })
        showToast('Donation notification sent!')
    } catch {
        showToast('Failed to send notification', false)
    } finally {
        donationNotifLoading.value = false
    }
}

onMounted(() => {
    void refreshCryptoBalance()
})
</script>

<style scoped>
.admin-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0b0a08;
    color: #e8e1d3;
    font-family: 'General Sans', system-ui, sans-serif;
    position: relative;
    overflow-x: hidden;
    padding: 1rem;
}

.admin-page__orb {
    position: absolute;
    width: 500px;
    height: 500px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 90, 31, 0.3) 0%, rgba(11, 10, 8, 0) 70%);
    pointer-events: none;
    filter: blur(60px);
}

.orb-left { top: -15%; left: -15%; }
.orb-right { bottom: -15%; right: -15%; }

.admin-page__container {
    width: 100%;
    max-width: 480px;
    padding: 2rem 1.5rem;
    background: rgba(19, 17, 14, 0.7);
    backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(245, 239, 228, 0.08);
    border-radius: 14px;
    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6), 0 0 60px rgba(255, 90, 31, 0.08);
    z-index: 10;
}

.admin-page__title {
    font-family: 'Fraunces', serif;
    font-weight: 500;
    font-size: 1.75rem;
    letter-spacing: -0.02em;
    color: #f5efe4;
    margin-bottom: 0.5rem;
}

.admin-page__subtitle {
    color: #a79f8d;
    font-size: 0.85rem;
    margin-bottom: 1.5rem;
    line-height: 1.5;
}

.admin-page__field {
    margin-bottom: 1.25rem;
}

.admin-page__label {
    display: block;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #8a8270;
    margin-bottom: 0.4rem;
}

.admin-page__input,
.admin-page__select {
    width: 100%;
    padding: 0.75rem 0.875rem;
    background: rgba(245, 239, 228, 0.03);
    border: 1px solid rgba(245, 239, 228, 0.08);
    border-radius: 8px;
    color: #e8e1d3;
    font-family: inherit;
    font-size: 0.9rem;
    outline: none;
    transition: all 0.32s cubic-bezier(0.22, 1, 0.36, 1);
    box-sizing: border-box;
}

.admin-page__input + .admin-page__input {
    margin-top: 0.4rem;
}

.admin-page__select {
    appearance: none;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23c7bfb0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right 1rem center;
    background-size: 1em;
    padding-right: 2.5rem;
}

.admin-page__input:focus,
.admin-page__select:focus {
    border-color: #ff5a1f;
    box-shadow: 0 0 0 3px rgba(255, 90, 31, 0.15);
    background: rgba(245, 239, 228, 0.05);
}

.admin-page__btn {
    width: 100%;
    padding: 0.75rem;
    background: #ff5a1f;
    color: #0b0a08;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.32s cubic-bezier(0.22, 1, 0.36, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    box-shadow: 0 4px 12px rgba(255, 90, 31, 0.25);
    font-family: inherit;
}

.admin-page__btn:hover { background: #e84817; box-shadow: 0 6px 16px rgba(255, 90, 31, 0.4); transform: translateY(-1px); }
.admin-page__btn:active { transform: translateY(0); }
.admin-page__btn:disabled { background: #8a8270; color: #0b0a08; cursor: not-allowed; box-shadow: none; }
.admin-page__btn--sm { width: auto; padding: 0.35rem 0.7rem; font-size: 0.75rem; box-shadow: none; white-space: nowrap; }

.admin-page__hint {
    font-size: 0.7rem;
    color: #a79f8d;
    margin-top: 0.25rem;
    line-height: 1.4;
}

.admin-page__curation {
    margin-top: 2rem;
    border-top: 1px solid rgba(245, 239, 228, 0.08);
    padding-top: 1.5rem;
}

.admin-page__section-title {
    font-family: 'Fraunces', serif;
    font-size: 1.25rem;
    color: #f5efe4;
    margin-bottom: 0.75rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.admin-page__curation-count {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    color: #8a8270;
}

.admin-page__search-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
}

.admin-page__list {
    list-style: none;
    background: rgba(245, 239, 228, 0.02);
    border: 1px solid rgba(245, 239, 228, 0.08);
    border-radius: 8px;
    margin-bottom: 1rem;
    padding: 0.25rem 0;
}

.admin-page__list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid rgba(245, 239, 228, 0.08);
    gap: 0.75rem;
}

.admin-page__list-item:last-child { border-bottom: none; }

.admin-page__item-details {
    flex: 1;
    min-width: 0;
    text-align: left;
}

.admin-page__item-title {
    font-weight: 500;
    font-size: 0.85rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #e8e1d3;
}

.admin-page__item-meta {
    font-size: 0.7rem;
    color: #8a8270;
    margin-top: 0.1rem;
}

.admin-page__item-actions {
    display: flex;
    gap: 0.2rem;
}

.admin-page__icon-btn {
    background: transparent;
    border: none;
    color: #a79f8d;
    cursor: pointer;
    padding: 0.2rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    width: 26px;
    height: 26px;
    transition: all 0.32s cubic-bezier(0.22, 1, 0.36, 1);
    font-family: inherit;
}

.admin-page__icon-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); color: #f5efe4; }
.admin-page__icon-btn:disabled { opacity: 0.25; cursor: not-allowed; }
.admin-page__icon-btn--danger:hover { color: #ff8a80; background: rgba(197,78,61,0.15); }

.admin-page__empty {
    padding: 1.5rem;
    text-align: center;
    color: #8a8270;
    font-size: 0.85rem;
}

.admin-page__server-grid {
    background: rgba(245, 239, 228, 0.02);
    border: 1px solid rgba(245, 239, 228, 0.08);
    border-radius: 8px;
    padding: 1rem;
    margin-top: 1.5rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    max-height: 120px;
    overflow-y: auto;
}

.admin-page__server-row {
    display: flex;
    justify-content: space-between;
    padding: 0.3rem 0;
    color: #a79f8d;
    border-bottom: 1px solid rgba(245, 239, 228, 0.04);
}

.admin-page__server-row:last-child { border-bottom: none; }
.admin-page__server-row strong { color: #e8e1d3; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; }
.admin-page__server-row span:first-child { color: #ff5a1f; }

.admin-page__toast {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    padding: 0.875rem 1.25rem;
    border-radius: 8px;
    background: rgba(19, 17, 14, 0.7);
    border: 1px solid rgba(245, 239, 228, 0.08);
    color: #e8e1d3;
    font-size: 0.85rem;
    font-weight: 500;
    backdrop-filter: blur(12px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    transform: translateY(100px);
    opacity: 0;
    transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    z-index: 100;
}

.admin-page__toast.is-show { transform: translateY(0); opacity: 1; }
.admin-page__toast.is-success { border-left: 4px solid #6ba368; }
.admin-page__toast.is-error { border-left: 4px solid #c94e3d; }

.admin-page__balance-card {
    background: rgba(245, 239, 228, 0.02);
    border: 1px solid rgba(245, 239, 228, 0.08);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1.25rem;
}

.admin-page__balance-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.3rem 0;
    font-size: 0.8rem;
    color: #c4bda8;
}

.admin-page__balance-row--total {
    border-top: 1px solid rgba(245, 239, 228, 0.1);
    margin-top: 0.3rem;
    padding-top: 0.5rem;
    font-weight: 700;
    color: #ff5a1f;
    font-size: 0.9rem;
}

.admin-page__btn--donation {
    background: #ff5a1f;
    color: #0b0a08;
    border: none;
}

.admin-page__btn--donation:hover:not(:disabled) {
    background: #e84817;
}

.admin-page__toggle {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
}

.admin-page__toggle-input {
    display: none;
}

.admin-page__toggle-track {
    position: relative;
    width: 40px;
    height: 22px;
    background: rgba(245, 239, 228, 0.12);
    border-radius: 11px;
    transition: background 0.3s ease;
}

.admin-page__toggle-input:checked + .admin-page__toggle-track {
    background: #ff5a1f;
}

.admin-page__toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    background: #f5efe4;
    border-radius: 50%;
    transition: transform 0.3s ease;
}

.admin-page__toggle-input:checked + .admin-page__toggle-track .admin-page__toggle-knob {
    transform: translateX(18px);
}

.admin-page__subsection-title {
    font-family: 'Fraunces', serif;
    font-size: 1rem;
    color: #f5efe4;
    margin-bottom: 0.5rem;
}

@media (max-width: 480px) {
    .admin-page__container {
        padding: 1.5rem 1rem;
    }
    .admin-page__title {
        font-size: 1.5rem;
    }
}

.admin-page__reorder-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: rgba(19, 17, 14, 0.7);
    border: 1px solid rgba(245, 239, 228, 0.08);
    border-radius: 6px;
    margin-bottom: 0.35rem;
}
.admin-page__reorder-controls {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.admin-page__reorder-btn {
    background: rgba(245, 239, 228, 0.06);
    border: 1px solid rgba(245, 239, 228, 0.1);
    color: #c7bfb0;
    width: 24px;
    height: 18px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.7rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
}
.admin-page__reorder-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}
.admin-page__reorder-btn:hover:not(:disabled) {
    background: rgba(255, 90, 31, 0.2);
    color: #ff5a1f;
}
.admin-page__reorder-idx {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    color: #8a8270;
    min-width: 1.2rem;
    text-align: right;
}
.admin-page__reorder-name {
    flex: 1;
    font-size: 0.85rem;
    color: #e8e1d3;
}
.admin-page__reorder-id {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: #8a8270;
    text-transform: uppercase;
}
</style>
