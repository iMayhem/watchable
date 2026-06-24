<template>
    <MobileShell>
        <div class="m-livestream">
            <header class="m-livestream__head">
                <h1 class="m-livestream__title">Livestream</h1>
            </header>

            <!-- Theater View -->
            <div v-if="activeChannel" class="m-livestream__theater">
                <div class="m-livestream__video-wrapper">
                    <div id="youtube-player" class="m-livestream__video-frame"></div>
                </div>

                <!-- Stream Details & Controls -->
                <div class="m-livestream__meta-bar">
                    <div class="m-livestream__streamer-info">
                        <div class="m-livestream__avatar" style="background: linear-gradient(135deg, #ff0000, #b30000)">
                            {{ activeChannel ? activeChannel.charAt(0).toUpperCase() : '' }}
                        </div>
                        <div class="m-livestream__streamer-details">
                            <div class="m-livestream__streamer-name">
                                {{ activeChannel }}
                                <span class="m-livestream__live-badge">LIVE</span>
                            </div>
                            <div class="m-livestream__streamer-sub">Streaming live on YouTube</div>
                        </div>
                    </div>

                    <div class="m-livestream__controls-row">
                        <!-- Quality selector -->
                        <div class="m-livestream__quality-control">
                            <select v-model="selectedQuality" class="m-livestream__quality-select" title="Change quality">
                                <option value="hd1080">1080p</option>
                                <option value="hd720">720p</option>
                                <option value="large">480p</option>
                                <option value="medium">360p</option>
                                <option value="auto">Auto</option>
                            </select>
                        </div>

                        <!-- Chat toggle -->
                        <button @click="toggleChat" class="m-livestream__action-btn">
                            {{ showChat ? 'Hide Chat' : 'Show Chat' }}
                        </button>
                    </div>
                </div>

                <!-- Mobile stacked chat -->
                <div v-if="showChat && chatUrl" class="m-livestream__chat-wrapper">
                    <iframe
                        :src="chatUrl"
                        class="m-livestream__chat-frame"
                        frameborder="0"
                        scrolling="no"
                    ></iframe>
                </div>
            </div>

            <!-- Filters & Navigation -->
            <div class="m-livestream__filters">
                <!-- Category Tabs -->
                <div class="m-livestream__games-nav">
                    <button
                        v-for="cat in categories"
                        :key="cat.id"
                        class="m-livestream__game-tab"
                        :class="{ 'is-active': selectedGameId === cat.id }"
                        @click="selectGame(cat.id)"
                    >
                        <img :src="cat.boxArt" :alt="cat.name" class="m-livestream__game-boxart" />
                        <span class="m-livestream__game-tab-title">{{ cat.name }}</span>
                    </button>
                </div>

                <!-- Search and Custom Input -->
                <div class="m-livestream__search-row">
                    <div class="m-livestream__search-field">
                        <input
                            v-model="searchQuery"
                            type="search"
                            class="m-livestream__input"
                            placeholder="Search channels…"
                            aria-label="Search streams"
                        />
                    </div>

                    <form @submit.prevent="watchCustomChannel" class="m-livestream__custom-form">
                        <input
                            v-model="customChannelInput"
                            type="text"
                            class="m-livestream__input"
                            placeholder="YouTube URL or video ID"
                            aria-label="YouTube URL or ID"
                        />
                        <button type="submit" class="m-livestream__btn-primary">
                            Watch
                        </button>
                    </form>
                </div>
            </div>

            <!-- Channels Grid -->
            <div class="m-livestream__grid-section">
                <h2 class="m-livestream__section-title">
                    {{ selectedGameName }} Channels
                </h2>

                <div v-if="filteredStreamers.length" class="m-livestream__grid">
                    <div
                        v-for="streamer in filteredStreamers"
                        :key="streamer.username"
                        class="m-livestream__card m-livestream__card--yt"
                        :class="{ 'is-playing': activeChannel === streamer.name }"
                        @click="setActiveChannel(streamer.username)"
                    >
                        <div class="m-livestream__card-preview">
                            <img
                                :src="`https://img.youtube.com/vi/${streamer.youtubeId}/mqdefault.jpg`"
                                :alt="streamer.name"
                                class="m-livestream__card-avatar"
                                @error="handleAvatarError($event, streamer)"
                            />
                            <span class="m-livestream__card-badge" style="background:#ff0000">LIVE</span>
                        </div>

                        <div class="m-livestream__card-info">
                            <h3 class="m-livestream__card-name">{{ streamer.name }}</h3>
                            <p class="m-livestream__card-game">{{ streamer.game }}</p>
                        </div>
                    </div>
                </div>

                <div v-else class="m-livestream__empty meta">
                    No matching streams found.
                </div>
            </div>
        </div>
    </MobileShell>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import MobileShell from '../layout/MobileShell.vue';
import { getSettings, loadGlobalSettings } from '@/composables/useSettings';

interface Streamer {
    name: string;
    username: string;
    game: string;
    gameId: string;
    tags: string[];
    youtubeId: string;
}

interface Category {
    id: string;
    name: string;
    boxArt: string;
}

// State
const activeChannel = ref<string>('');
const activeYoutubeId = ref<string>('');
const selectedQuality = ref<string>('hd1080');
const selectedGameId = ref<string>('all');
const searchQuery = ref<string>('');
const customChannelInput = ref<string>('');
const showChat = ref<boolean>(false);

const route = useRoute();
const { defaultYoutubeStream } = getSettings();

let ytPlayer: any = null;

// Categories
const categories: Category[] = [
    { id: 'all', name: 'All', boxArt: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=120&h=160&q=80' },
    { id: 'music', name: '24/7 Music', boxArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=120&h=160&q=80' },
    { id: 'fps', name: 'FPS & BR', boxArt: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=120&h=160&q=80' },
    { id: 'moba', name: 'MOBA', boxArt: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=120&h=160&q=80' },
    { id: 'esports', name: 'Esports', boxArt: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=120&h=160&q=80' },
    { id: 'variety', name: 'Variety', boxArt: 'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=120&h=160&q=80' },
    { id: 'news', name: 'Gaming News', boxArt: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=120&h=160&q=80' },
];

const streamers: Streamer[] = [
    { name: 'Lofi Girl', username: 'lofi-girl', game: '24/7 Music', gameId: 'music', tags: ['Lofi', 'Study', 'Chill', '24/7'], youtubeId: 'jfKfPfyJRdk' },
    { name: 'Monstercat Radio', username: 'monstercat-radio', game: '24/7 Music', gameId: 'music', tags: ['Electronic', 'Dance', '24/7'], youtubeId: '2b4SItX_q9g' },
    { name: 'ChilledCow Study', username: 'chilledcow-study', game: '24/7 Music', gameId: 'music', tags: ['Ambient', 'Focus', '24/7'], youtubeId: 'rUxyKA_-grg' },
    { name: 'DXL Radio', username: 'dxl-radio', game: '24/7 Music', gameId: 'music', tags: ['Gaming OST', 'Retro', '24/7'], youtubeId: '4xDzrJKXOOY' },
    { name: 'Shroud', username: 'shroud-yt', game: 'Valorant / FPS', gameId: 'fps', tags: ['FPS', 'Pro'], youtubeId: 'UCoz8NrwgL7U' },
    { name: 'TimTheTatman', username: 'timthetatman-yt', game: 'Fortnite / Variety', gameId: 'fps', tags: ['Fortnite', 'Fun'], youtubeId: 'UCurnxCDF_qUHSMOGAMJjoNg' },
    { name: 'SypherPK', username: 'sypherpk-yt', game: 'Fortnite', gameId: 'fps', tags: ['Fortnite', 'Tips'], youtubeId: 'UCax2-FkWFXEaAoGAqUexPRQ' },
    { name: 'DrDisrespect', username: 'drdisrespect-yt', game: 'FPS / BR', gameId: 'fps', tags: ['Warzone', 'Hype'], youtubeId: 'UCnErmqRHFCxLHG5rdBYxGqA' },
    { name: 'Tyler1', username: 'tyler1-yt', game: 'League of Legends', gameId: 'moba', tags: ['LoL', 'Ranked'], youtubeId: 'UCnHGCQ4kRkA4ThNlFLIY_RQ' },
    { name: 'Faker', username: 'faker-yt', game: 'League of Legends', gameId: 'moba', tags: ['LoL', 'Pro', 'T1'], youtubeId: 'UCBYncKVGMjfMDscSdShGdnQ' },
    { name: 'Grubby', username: 'grubby-yt', game: 'Warcraft / Dota 2', gameId: 'moba', tags: ['RTS', 'Pro'], youtubeId: 'UCFOAopFqEjfxXI2R7JqKAeg' },
    { name: 'ESL Counter-Strike', username: 'esl-cs2', game: 'CS2 Esports', gameId: 'esports', tags: ['CS2', 'Pro'], youtubeId: 'UCPq2ETz4aAGo2Z-8JisDPIA' },
    { name: 'PGL Esports', username: 'pgl-esports', game: 'Multi-game Esports', gameId: 'esports', tags: ['Major', 'Live'], youtubeId: 'UCbQXBbHW7CvzIhXKw1pMYXA' },
    { name: 'Riot Games', username: 'riot-games-yt', game: 'Valorant / LoL Esports', gameId: 'esports', tags: ['Valorant', 'VCT'], youtubeId: 'UCfyAQ9KBWP9BFT0bYMu3_yw' },
    { name: 'Markiplier', username: 'markiplier-yt', game: 'Variety Gaming', gameId: 'variety', tags: ['Horror', 'Indie'], youtubeId: 'UC7_YxT-KID8kRbqZo7MyscQ' },
    { name: 'Jacksepticeye', username: 'jack-yt', game: 'Variety Gaming', gameId: 'variety', tags: ['Indie', 'Funny'], youtubeId: 'UCYzPXprvl5Y-Sf0g4vX-m6g' },
    { name: 'Ludwig', username: 'ludwig-yt', game: 'Variety / Chess', gameId: 'variety', tags: ['Variety', 'Chess'], youtubeId: 'UCrPseYLGpNygVi34QpGNqpA' },
    { name: 'Valkyrae', username: 'valkyrae-yt', game: 'Variety Gaming', gameId: 'variety', tags: ['Variety', 'Collab'], youtubeId: 'UCbs6hSivNMVCGFWbHnHr7Ug' },
    { name: 'IGN', username: 'ign-yt', game: 'Gaming News & Reviews', gameId: 'news', tags: ['News', 'Reviews'], youtubeId: 'UCKy1dAqELo0zrOtPkf0eTMw' },
    { name: 'GameSpot', username: 'gamespot-yt', game: 'Gaming News', gameId: 'news', tags: ['News', 'Reviews'], youtubeId: 'UCbu2SsF-Or3Rsn3NxqODImQ' },
    { name: 'Gameranx', username: 'gameranx-yt', game: 'Gaming Tips & News', gameId: 'news', tags: ['Tips', 'Lists'], youtubeId: 'UCNAz5Ut1Swwg6h6ysBtWFog' },
];

// Computed
const currentHostname = computed(() => {
    if (typeof window !== 'undefined') return window.location.hostname;
    return 'localhost';
});

const chatUrl = computed(() => {
    if (!activeYoutubeId.value) return '';
    if (activeYoutubeId.value.startsWith('UC') && activeYoutubeId.value.length === 24) return '';
    return `https://www.youtube.com/live_chat?v=${activeYoutubeId.value}&embed_domain=${currentHostname.value}`;
});

const selectedGameName = computed(() => {
    const cat = categories.find(c => c.id === selectedGameId.value);
    return cat ? cat.name : 'All';
});

const filteredStreamers = computed(() => {
    let result = streamers;
    if (selectedGameId.value !== 'all') {
        result = result.filter(s => s.gameId === selectedGameId.value);
    }
    const query = searchQuery.value.trim().toLowerCase();
    if (query) {
        result = result.filter(s =>
            s.name.toLowerCase().includes(query) ||
            s.username.toLowerCase().includes(query) ||
            s.game.toLowerCase().includes(query)
        );
    }
    return result;
});

// YouTube player
function loadYoutubeApi() {
    if (typeof window === 'undefined') return;
    if ((window as any).YT) return;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const first = document.getElementsByTagName('script')[0];
    first.parentNode?.insertBefore(tag, first);
}

function initYoutubePlayer() {
    if (typeof window === 'undefined') return;
    loadYoutubeApi();
    if (!(window as any).YT || !(window as any).YT.Player) {
        setTimeout(initYoutubePlayer, 100);
        return;
    }
    if (ytPlayer) {
        try { ytPlayer.destroy(); } catch (e) { /* ignore */ }
        ytPlayer = null;
    }
    const container = document.getElementById('youtube-player');
    if (!container) return;

    const qualityParam = selectedQuality.value !== 'auto' ? selectedQuality.value : 'default';
    const isChannel = activeYoutubeId.value.startsWith('UC') && activeYoutubeId.value.length === 24;
    const playerVars: any = { autoplay: 1, mute: 1, rel: 0, modestbranding: 1, origin: window.location.origin };
    let videoId = activeYoutubeId.value;
    if (isChannel) { playerVars.channel = activeYoutubeId.value; videoId = 'live_stream'; }

    ytPlayer = new (window as any).YT.Player('youtube-player', {
        height: '100%', width: '100%', videoId, playerVars,
        events: {
            onReady: (event: any) => {
                event.target.mute();
                event.target.playVideo();
                if (qualityParam !== 'default' && event.target.setPlaybackQuality) event.target.setPlaybackQuality(qualityParam);
                setTimeout(() => {
                    const duration = event.target.getDuration?.();
                    if (duration > 0) event.target.seekTo(duration, true);
                }, 1000);
            },
            onStateChange: (event: any) => {
                if (event.data === (window as any).YT.PlayerState.PLAYING) {
                    const duration = event.target.getDuration();
                    const currentTime = event.target.getCurrentTime();
                    if (duration > 0 && (duration - currentTime) > 15 && !event.target.hasSeekedToLive) {
                        event.target.seekTo(duration, true);
                        event.target.hasSeekedToLive = true;
                    }
                }
            }
        }
    });
}

function selectGame(gameId: string) { selectedGameId.value = gameId; }

function setActiveChannel(username: string) {
    const streamer = streamers.find(s => s.username === username);
    if (!streamer) return;
    activeChannel.value = streamer.name;
    activeYoutubeId.value = streamer.youtubeId;
    nextTick(() => {
        const playerEl = document.querySelector('.m-livestream__theater');
        if (playerEl) playerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

function watchCustomChannel() {
    const input = customChannelInput.value.trim();
    if (!input) return;
    const ytVideoReg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
    const ytChannelReg = /(?:youtube\.com\/channel\/)(UC[^"&?\/ ]{22})/;
    const ytLiveReg = /(?:youtube\.com\/live\/)([^"&?\/ ]{11})/;
    const videoMatch = input.match(ytVideoReg);
    const channelMatch = input.match(ytChannelReg);
    const liveMatch = input.match(ytLiveReg);
    if (videoMatch) { activeChannel.value = 'YouTube Live'; activeYoutubeId.value = videoMatch[1]; }
    else if (liveMatch) { activeChannel.value = 'YouTube Live'; activeYoutubeId.value = liveMatch[1]; }
    else if (channelMatch) { activeChannel.value = 'YouTube Channel'; activeYoutubeId.value = channelMatch[1]; }
    else if (input.startsWith('UC') && input.length === 24) { activeChannel.value = 'YouTube Channel'; activeYoutubeId.value = input; }
    else if (/^[a-zA-Z0-9_-]{11}$/.test(input)) { activeChannel.value = 'YouTube Live'; activeYoutubeId.value = input; }
    else return;
    customChannelInput.value = '';
    nextTick(() => {
        const playerEl = document.querySelector('.m-livestream__theater');
        if (playerEl) playerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

function toggleChat() { showChat.value = !showChat.value; }

function handleAvatarError(event: Event, streamer: Streamer) {
    const img = event.target as HTMLImageElement;
    img.src = `https://api.dicebear.com/7.x/initials/svg?seed=${streamer.name}&backgroundColor=ff0000`;
}

function parseYoutubeId(input: string): string {
    const ytVideoReg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
    const ytChannelReg = /(?:youtube\.com\/channel\/)(UC[^"&?\/ ]{22})/;
    const ytLiveReg = /(?:youtube\.com\/live\/)([^"&?\/ ]{11})/;
    const v = input.match(ytVideoReg); if (v) return v[1];
    const l = input.match(ytLiveReg); if (l) return l[1];
    const c = input.match(ytChannelReg); if (c) return c[1];
    if (input.startsWith('UC') && input.length === 24) return input;
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    return '';
}

function playDefaultYoutubeLink(link: string) {
    const id = parseYoutubeId(link);
    if (id) { activeChannel.value = 'Admin Recommended Live'; activeYoutubeId.value = id; }
}

watch(activeYoutubeId, () => { nextTick(() => { initYoutubePlayer(); }); });

watch(selectedQuality, (newQuality) => {
    if (ytPlayer && ytPlayer.setPlaybackQuality) {
        ytPlayer.setPlaybackQuality(newQuality === 'auto' ? 'default' : newQuality);
    }
});

onMounted(async () => {
    document.title = 'Livestream — Moovie';
    await loadGlobalSettings();
    if (route.query.ytId) {
        activeChannel.value = 'YouTube Live';
        activeYoutubeId.value = String(route.query.ytId);
    } else if (defaultYoutubeStream.value) {
        playDefaultYoutubeLink(defaultYoutubeStream.value);
    } else {
        setActiveChannel(streamers[0].username);
    }
});

watch(defaultYoutubeStream, (newVal) => {
    if (!route.query.ytId && newVal && !activeYoutubeId.value) playDefaultYoutubeLink(newVal);
});

onUnmounted(() => {
    if (ytPlayer) { try { ytPlayer.destroy(); } catch (e) { /* ignore */ } ytPlayer = null; }
});
</script>

<style lang="scss" scoped>
.m-livestream {
    padding: var(--s-4) var(--s-4) var(--s-8);

    &__head {
        margin-bottom: var(--s-4);
    }

    &__title {
        margin: var(--s-1) 0 0;
        font-family: var(--font-display);
        font-size: 1.6rem;
    }

    // Theater Mode Styles
    &__theater {
        margin-bottom: var(--s-6);
        border-radius: var(--r-md);
        overflow: hidden;
        border: 1px solid var(--rule-strong);
        background: var(--ink-950);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
    }

    &__video-wrapper {
        position: relative;
        width: 100%;
        height: clamp(12rem, 56.25vw, 52vh);
        background: #000;
    }

    &__video-frame {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: none;
    }

    &__meta-bar {
        display: flex;
        flex-direction: column;
        gap: var(--s-3);
        padding: var(--s-4);
        background: var(--ink-850);
        border-top: 1px solid var(--rule-strong);
    }

    &__streamer-info {
        display: flex;
        align-items: center;
        gap: var(--s-3);
    }

    &__avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: var(--r-pill);
        background: linear-gradient(135deg, #ff0000, #b30000);
        color: #fff;
        font-weight: 700;
        font-size: 0.95rem;
    }

    &__streamer-details {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    &__streamer-name {
        font-weight: 600;
        font-size: 0.95rem;
        color: var(--bone-50);
        display: flex;
        align-items: center;
        gap: var(--s-2);
    }

    &__live-badge {
        font-size: 0.55rem;
        font-weight: 800;
        color: #fff;
        background: #ff0000;
        padding: 1px 4px;
        border-radius: var(--r-xs);
        letter-spacing: 0.05em;
    }

    &__streamer-sub {
        font-size: 0.72rem;
        color: var(--bone-400);
        margin-top: 1px;
    }

    &__controls-row {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: var(--s-2);
        margin-top: var(--s-1);
    }

    &__quality-select {
        width: 100%;
        min-height: 2.25rem;
        padding: 0 var(--s-6) 0 var(--s-3);
        border-radius: var(--r-md);
        border: 1px solid var(--rule-strong);
        background: var(--ink-800);
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: 0.78rem;
        cursor: pointer;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23a79f8d' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.65rem center;
        outline: none;
    }

    &__action-btn {
        min-height: 2.25rem;
        padding: 0 var(--s-4);
        border-radius: var(--r-md);
        border: 1px solid var(--rule-strong);
        background: var(--ink-800);
        color: var(--bone-200);
        font-family: var(--font-ui);
        font-size: 0.78rem;
        font-weight: 500;
        cursor: pointer;
    }

    &__chat-wrapper {
        border-top: 1px solid var(--rule-strong);
        height: 350px;
        width: 100%;
        background: #0c0b0a;
    }

    &__chat-frame {
        width: 100%;
        height: 100%;
        border: none;
    }

    // Filter Section
    &__filters {
        display: grid;
        gap: var(--s-3);
        margin-bottom: var(--s-6);
    }

    &__games-nav {
        display: flex;
        gap: var(--s-2);
        overflow-x: auto;
        padding-bottom: var(--s-2);
        scrollbar-width: none;
        -ms-overflow-style: none;

        &::-webkit-scrollbar {
            display: none;
        }
    }

    &__game-tab {
        display: flex;
        align-items: center;
        gap: var(--s-2);
        flex-shrink: 0;
        padding: 6px 12px 6px 6px;
        border-radius: var(--r-md);
        border: 1px solid var(--rule-strong);
        background: var(--ink-800);
        color: var(--bone-300);
        cursor: pointer;

        &.is-active {
            background: rgba(255, 0, 0, 0.1);
            border-color: #ff4444;
            color: var(--bone-50);
        }
    }

    &__game-boxart {
        width: 24px;
        height: 32px;
        object-fit: cover;
        border-radius: var(--r-xs);
    }

    &__game-tab-title {
        font-family: var(--font-ui);
        font-weight: 600;
        font-size: 0.72rem;
    }

    &__search-row {
        display: grid;
        gap: var(--s-2);
    }

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

        &:focus {
            outline: none;
            border-color: #ff4444;
        }

        &::placeholder {
            color: var(--bone-500);
        }
    }

    &__custom-form {
        display: flex;
        gap: var(--s-2);

        .m-livestream__input {
            flex-grow: 1;
        }
    }

    &__btn-primary {
        min-height: 2.75rem;
        padding: 0 var(--s-4);
        border-radius: var(--r-md);
        background: #ff0000;
        color: #fff;
        font-family: var(--font-ui);
        font-weight: 600;
        font-size: 0.88rem;
        border: none;
        cursor: pointer;
    }

    // Grid section
    &__section-title {
        font-size: 0.95rem;
        font-weight: 700;
        margin-bottom: var(--s-3);
        color: var(--bone-100);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    &__grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: var(--s-3);
    }

    &__card {
        background: var(--ink-850);
        border-radius: var(--r-md);
        border: 1px solid var(--rule-strong);
        overflow: hidden;
        cursor: pointer;

        &.is-playing {
            border-color: #ff0000;
            box-shadow: 0 0 0 1px #ff0000;
        }

        &--yt.is-playing {
            border-color: #ff0000;
            box-shadow: 0 0 0 1px #ff0000;
        }
    }

    &__card-preview {
        position: relative;
        aspect-ratio: 16 / 9;
        background: var(--ink-950);
        overflow: hidden;
    }

    &__card-avatar {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    &__card-badge {
        position: absolute;
        top: 6px;
        left: 6px;
        font-size: 0.52rem;
        font-weight: 800;
        background: #ff0000;
        color: #fff;
        padding: 1px 4px;
        border-radius: var(--r-xs);
        letter-spacing: 0.02em;
    }

    &__card-info {
        padding: var(--s-3);
    }

    &__card-name {
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--bone-50);
        margin-bottom: 1px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__card-game {
        font-size: 0.68rem;
        color: var(--bone-400);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__empty {
        padding: var(--s-8) var(--s-4);
        text-align: center;
        border-radius: var(--r-md);
        border: 1px dashed var(--rule);
        background: var(--ink-850);
    }
}
</style>
