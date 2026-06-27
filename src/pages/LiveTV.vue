<template>
    <div class="livetv">
        <SiteHeader />

        <main id="main" class="livetv__main" role="main">
            <section class="livetv__body container-lm">
                <header class="livetv__head">
                    <p class="eyebrow">Broadcast</p>
                    <h1 class="livetv__title display">Live TV</h1>
                    <p class="meta livetv__lede">
                        Free IPTV channels from the
                        <a href="https://github.com/iptv-org/iptv" target="_blank" rel="noopener noreferrer">iptv-org</a>
                        community catalogue.
                    </p>
                </header>

                <div class="livetv__controls">
                    <label class="livetv__field">
                        <span class="livetv__label eyebrow">Country</span>
                        <select
                            v-model="selectedCountryPath"
                            class="livetv__select"
                            :disabled="countriesLoading"
                        >
                            <option value="">
                                {{ countriesLoading ? 'Loading countries…' : 'Select country' }}
                            </option>
                            <option
                                v-for="country in countries"
                                :key="country.path"
                                :value="country.path"
                            >
                                {{ country.name }}
                            </option>
                        </select>
                    </label>

                    <label class="livetv__field livetv__field--grow">
                        <span class="livetv__label eyebrow">Channel</span>
                        <select
                            v-model="selectedStreamUrl"
                            class="livetv__select"
                            :disabled="!channels.length || channelsLoading"
                            @change="onStreamChange"
                        >
                            <option value="">
                                {{ channelsLoading ? 'Loading channels…' : 'Select channel' }}
                            </option>
                            <option
                                v-for="channel in filteredChannels"
                                :key="channel.link"
                                :value="channel.link"
                            >
                                {{ channel.title }}
                            </option>
                        </select>
                    </label>

                    <label v-if="channels.length" class="livetv__field livetv__field--search">
                        <span class="livetv__label eyebrow">Filter</span>
                        <input
                            v-model="channelFilter"
                            type="search"
                            class="livetv__input"
                            placeholder="Search channels…"
                            aria-label="Filter channels"
                        />
                    </label>
                </div>

                <p v-if="countriesError" class="livetv__error meta" role="alert">{{ countriesError }}</p>
                <p v-else-if="channelsError" class="livetv__error meta" role="alert">{{ channelsError }}</p>

                <div class="livetv__stage">
                    <div
                        v-if="selectedStreamUrl"
                        ref="playerContainer"
                        class="livetv__player"
                        :aria-label="selectedChannelTitle || 'Live TV player'"
                    />

                    <div v-else class="livetv__placeholder">
                        <svg viewBox="0 0 24 24" width="56" height="56" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4">
                            <rect x="2" y="5" width="20" height="14" rx="2" />
                            <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
                        </svg>
                        <p>Select a country and channel to start watching.</p>
                    </div>

                    <p v-if="playerError" class="livetv__player-error meta" role="alert">{{ playerError }}</p>
                </div>

                <p v-if="selectedCountryPath && !channelsLoading" class="meta livetv__count">
                    {{ filteredChannels.length.toLocaleString() }}
                    {{ filteredChannels.length === 1 ? 'channel' : 'channels' }}
                    <template v-if="channelFilter.trim()"> matching filter</template>
                </p>
            </section>
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import {
    fetchIptvCountries,
    fetchIptvPlaylist,
    type IptvChannel,
    type IptvCountry
} from '../composables/useIptv';
import { useLiveTvPlayer } from '../composables/useLiveTvPlayer';

const countries = ref<IptvCountry[]>([]);
const channels = ref<IptvChannel[]>([]);
const selectedCountryPath = ref('');
const selectedStreamUrl = ref('');
const selectedChannelTitle = ref('');
const channelFilter = ref('');
const countriesLoading = ref(false);
const channelsLoading = ref(false);
const countriesError = ref('');
const channelsError = ref('');

const playerContainer = ref<HTMLElement | null>(null);
const { mount, destroy, playerError } = useLiveTvPlayer(playerContainer);

const filteredChannels = computed(() => {
    const query = channelFilter.value.trim().toLowerCase();
    if (!query) return channels.value;
    return channels.value.filter((channel) =>
        channel.title.toLowerCase().includes(query)
    );
});

async function loadCountries() {
    countriesLoading.value = true;
    countriesError.value = '';
    try {
        countries.value = await fetchIptvCountries();
    } catch (error) {
        countriesError.value = error instanceof Error
            ? error.message
            : 'Could not load country list.';
    } finally {
        countriesLoading.value = false;
    }
}

async function loadChannels(path: string) {
    channelsLoading.value = true;
    channelsError.value = '';
    channels.value = [];
    selectedStreamUrl.value = '';
    selectedChannelTitle.value = '';
    channelFilter.value = '';
    destroy();

    try {
        channels.value = await fetchIptvPlaylist(path);
        if (!channels.value.length) {
            channelsError.value = 'No HTTPS channels found for this country.';
        }
    } catch (error) {
        channelsError.value = error instanceof Error
            ? error.message
            : 'Could not load channel list.';
    } finally {
        channelsLoading.value = false;
    }
}

function onStreamChange() {
    const channel = channels.value.find((item) => item.link === selectedStreamUrl.value);
    selectedChannelTitle.value = channel?.title ?? '';
    if (selectedStreamUrl.value) {
        void mount(selectedStreamUrl.value, selectedChannelTitle.value);
    } else {
        destroy();
    }
}

watch(selectedCountryPath, (path) => {
    if (path) void loadChannels(path);
});

watch(channelFilter, () => {
    if (
        selectedStreamUrl.value &&
        !filteredChannels.value.some((channel) => channel.link === selectedStreamUrl.value)
    ) {
        selectedStreamUrl.value = '';
        selectedChannelTitle.value = '';
        destroy();
    }
});

onMounted(() => {
    document.title = 'Live TV — Moovie';
    void loadCountries();
});
</script>

<style lang="scss" scoped>
.livetv {
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    &__main {
        padding: var(--s-6) 0 var(--s-10);
    }

    &__head {
        margin-bottom: var(--s-6);
    }

    &__title {
        margin: var(--s-2) 0;
        font-size: clamp(2rem, 5vw, 3rem);
    }

    &__lede {
        max-width: 42rem;
        color: var(--bone-300);

        a {
            color: var(--ember);
            text-decoration: underline;
            text-underline-offset: 0.15em;
        }
    }

    &__controls {
        display: grid;
        grid-template-columns: minmax(10rem, 14rem) minmax(12rem, 1fr) minmax(10rem, 16rem);
        gap: var(--s-4);
        margin-bottom: var(--s-5);

        @media (max-width: 900px) {
            grid-template-columns: 1fr 1fr;
        }

        @media (max-width: 560px) {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 640px) {
        &__select,
        &__input {
            min-height: 2.75rem;
            font-size: 16px;
            border-radius: var(--r-md);
        }
    }

    &__field {
        display: flex;
        flex-direction: column;
        gap: var(--s-2);

        &--grow {
            @media (max-width: 900px) {
                grid-column: 1 / -1;
            }
        }

        &--search {
            @media (max-width: 900px) {
                grid-column: 1 / -1;
            }
        }
    }

    &__label {
        color: var(--bone-400);
    }

    &__select,
    &__input {
        width: 100%;
        min-height: 2.75rem;
        padding: 0 var(--s-4);
        border-radius: var(--r-md);
        border: 1px solid var(--rule-strong);
        background: var(--ink-850);
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
    }

    &__select {
        appearance: none;
        padding-right: 2.5rem;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a79f8d' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.85rem center;
        cursor: pointer;

        &:disabled {
            opacity: 0.55;
            cursor: not-allowed;
        }
    }

    &__input {
        &::placeholder {
            color: var(--bone-500);
        }
    }

    &__error {
        margin-bottom: var(--s-4);
        color: var(--danger);
    }

    &__stage {
        position: relative;
    }

    &__player {
        position: relative;
        width: 100%;
        height: clamp(14rem, 56.25vw, 72vh);
        max-height: 72vh;
        border-radius: var(--r-lg);
        overflow: hidden;
        border: 1px solid var(--rule-strong);
        background: #000;
        box-shadow: 0 20px 48px rgba(0, 0, 0, 0.45);

        :deep(.art-video-player) {
            position: absolute;
            inset: 0;
            width: 100% !important;
            height: 100% !important;
            overflow: hidden;
        }

        :deep(.art-video) {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        :deep(.art-bottom) {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            padding-bottom: 0;
        }

        :deep(.art-controls) {
            display: flex;
            align-items: center;
            padding: 0 12px 12px;
        }

        :deep(.art-controls-left),
        :deep(.art-controls-center),
        :deep(.art-controls-right) {
            display: flex;
            align-items: center;
        }

        :deep(.art-control) {
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }

        :deep(.art-control .art-icon) {
            display: flex;
            align-items: center;
            justify-content: center;
        }
    }

    &__placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--s-4);
        min-height: min(72vh, 28rem);
        padding: var(--s-8);
        text-align: center;
        border-radius: var(--r-lg);
        border: 1px dashed var(--rule-strong);
        background: var(--ink-850);
        color: var(--bone-300);

        svg {
            color: var(--bone-500);
        }
    }

    &__player-error {
        margin-top: var(--s-3);
        color: var(--danger);
    }

    &__count {
        margin-top: var(--s-4);
        color: var(--bone-400);
    }
}
</style>