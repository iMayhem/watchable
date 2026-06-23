<template>
    <MobileShell>
        <div class="m-livetv">
            <header class="m-livetv__head">
                <p class="eyebrow">Broadcast</p>
                <h1 class="m-livetv__title">Live TV</h1>
            </header>

            <div class="m-livetv__controls">
                <label class="m-livetv__field">
                    <span class="m-livetv__label meta">Country</span>
                    <select
                        v-model="selectedCountryPath"
                        class="m-livetv__select"
                        :disabled="countriesLoading"
                    >
                        <option value="">
                            {{ countriesLoading ? 'Loading…' : 'Select country' }}
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

                <label class="m-livetv__field">
                    <span class="m-livetv__label meta">Channel</span>
                    <select
                        v-model="selectedStreamUrl"
                        class="m-livetv__select"
                        :disabled="!channels.length || channelsLoading"
                        @change="onStreamChange"
                    >
                        <option value="">
                            {{ channelsLoading ? 'Loading…' : 'Select channel' }}
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

                <input
                    v-if="channels.length"
                    v-model="channelFilter"
                    type="search"
                    class="m-livetv__input"
                    placeholder="Filter channels…"
                    aria-label="Filter channels"
                />
            </div>

            <p v-if="countriesError || channelsError" class="m-livetv__error meta" role="alert">
                {{ countriesError || channelsError }}
            </p>

            <div class="m-livetv__stage">
                <div
                    v-if="selectedStreamUrl"
                    ref="playerContainer"
                    class="m-livetv__player"
                />
                <div v-else class="m-livetv__placeholder meta">
                    Select a country and channel to start watching.
                </div>
                <p v-if="playerError" class="m-livetv__error meta" role="alert">{{ playerError }}</p>
            </div>
        </div>
    </MobileShell>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import MobileShell from '../layout/MobileShell.vue';
import {
    fetchIptvCountries,
    fetchIptvPlaylist,
    type IptvChannel,
    type IptvCountry
} from '@/composables/useIptv';
import { useLiveTvPlayer } from '@/composables/useLiveTvPlayer';

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
            : 'Could not load countries.';
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
            channelsError.value = 'No HTTPS channels found.';
        }
    } catch (error) {
        channelsError.value = error instanceof Error
            ? error.message
            : 'Could not load channels.';
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
        destroy();
    }
});

onMounted(() => {
    document.title = 'Live TV — Moovie';
    void loadCountries();
});
</script>

<style lang="scss" scoped>
.m-livetv {
    padding: var(--s-4) var(--s-4) var(--s-8);

    &__head {
        margin-bottom: var(--s-4);
    }

    &__title {
        margin: var(--s-1) 0 0;
        font-family: var(--font-display);
        font-size: 1.6rem;
    }

    &__controls {
        display: grid;
        gap: var(--s-3);
        margin-bottom: var(--s-4);
    }

    &__field {
        display: grid;
        gap: var(--s-2);
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
        font-size: 16px;
        -webkit-tap-highlight-color: transparent;
    }

    &__select {
        appearance: none;
        padding-right: 2.75rem;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23a79f8d' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.9rem center;
        cursor: pointer;

        &:disabled {
            opacity: 0.55;
            cursor: not-allowed;
        }
    }

    &__input::placeholder {
        color: var(--bone-500);
    }

    &__stage {
        margin-top: var(--s-2);
    }

    &__player {
        position: relative;
        width: 100%;
        height: clamp(12rem, 56.25vw, 52vh);
        border-radius: var(--r-md);
        overflow: hidden;
        background: #000;
        border: 1px solid var(--rule);

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
            padding: 0 10px 10px;
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
    }

    &__placeholder {
        display: grid;
        place-items: center;
        min-height: 12rem;
        padding: var(--s-6);
        text-align: center;
        border-radius: var(--r-md);
        border: 1px dashed var(--rule);
        background: var(--ink-850);
    }

    &__error {
        margin-top: var(--s-2);
        color: var(--danger, #c94e3d);
    }
}
</style>