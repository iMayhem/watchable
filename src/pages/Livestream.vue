<template>
    <div class="livestream">
        <SiteHeader />

        <main id="main" class="livestream__main" role="main">
            <section class="livestream__body container-lm">

                <!-- Theater View (Active Stream Player) -->
                <div v-if="activeChannel" class="livestream__theater">
                    <div class="livestream__theater-container" :class="{ 'chat-collapsed': !showChat }">
                        <div class="livestream__video-wrapper">
                            <!-- YouTube Player Container -->
                            <div id="youtube-player" class="livestream__video-frame"></div>
                        </div>
                        <div v-if="showChat" class="livestream__chat-wrapper">
                            <iframe
                                v-if="chatUrl"
                                :src="chatUrl"
                                class="livestream__chat-frame"
                                frameborder="0"
                                scrolling="no"
                            ></iframe>
                            <div v-else class="livestream__chat-placeholder">
                                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                <p>Live Chat is not available for channel-based streams.</p>
                            </div>
                        </div>
                    </div>

                    <!-- Stream Details -->
                    <div class="livestream__meta-bar">
                        <div class="livestream__streamer-info">
                            <div class="livestream__avatar" style="background: linear-gradient(135deg, #ff0000, #b30000)">
                                {{ activeChannel.charAt(0).toUpperCase() }}
                            </div>
                            <div>
                                <div class="livestream__streamer-name">
                                    {{ activeChannel }}
                                    <span class="livestream__live-badge">LIVE</span>
                                </div>
                                <div class="livestream__streamer-sub">Currently streaming live on YouTube</div>
                            </div>
                        </div>

                        <!-- Quality Selection Dropdown -->
                        <div class="livestream__quality-control">
                            <label class="eyebrow" style="color: var(--bone-400); font-size: 0.65rem; display: block; margin-bottom: 4px;">Graphics Quality</label>
                            <div class="livestream__quality-select-wrapper">
                                <select v-model="selectedQuality" class="livestream__quality-select" title="Change stream quality">
                                    <option value="hd1080">1080p (Max)</option>
                                    <option value="hd720">720p (High)</option>
                                    <option value="large">480p (Medium)</option>
                                    <option value="medium">360p (Low)</option>
                                    <option value="auto">Auto</option>
                                </select>
                            </div>
                        </div>
                        <div class="livestream__actions">
                            <button @click="toggleChat" class="livestream__action-btn">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                {{ showChat ? 'Hide Chat' : 'Show Chat' }}
                            </button>
                            <button @click="copyStreamLink" class="livestream__action-btn">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                </svg>
                                {{ copied ? 'Copied!' : 'Copy Link' }}
                            </button>
                            <a :href="activeYoutubeId.startsWith('UC') ? `https://youtube.com/channel/${activeYoutubeId}` : `https://youtube.com/watch?v=${activeYoutubeId}`" target="_blank" rel="noopener noreferrer" class="livestream__action-btn livestream__action-btn--youtube">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                    <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                </svg>
                                Open on YouTube
                            </a>
                        </div>
                    </div>
                </div>

                <!-- Filter bar -->
                <div class="livestream__filters">
                    <!-- Category Filter Tabs -->
                    <div class="livestream__games-nav">
                        <button
                            v-for="cat in categories"
                            :key="cat.id"
                            class="livestream__game-tab"
                            :class="{ 'is-active': selectedGameId === cat.id }"
                            @click="selectGame(cat.id)"
                        >
                            <img :src="cat.boxArt" :alt="cat.name" class="livestream__game-boxart" />
                            <div class="livestream__game-tab-info">
                                <span class="livestream__game-tab-title">{{ cat.name }}</span>
                            </div>
                        </button>
                    </div>

                    <!-- Search and custom stream block -->
                    <div class="livestream__search-row">
                        <div class="livestream__search-field">
                            <svg class="livestream__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                v-model="searchQuery"
                                type="search"
                                class="livestream__input"
                                placeholder="Search channels..."
                                aria-label="Search streams"
                            />
                        </div>

                        <form @submit.prevent="watchCustomChannel" class="livestream__custom-form">
                            <input
                                v-model="customChannelInput"
                                type="text"
                                class="livestream__input"
                                placeholder="Paste YouTube URL or video ID..."
                                aria-label="YouTube URL or video ID"
                            />
                            <button type="submit" class="livestream__btn-primary">
                                Watch
                            </button>
                        </form>
                    </div>
                </div>

                <!-- Channels Grid -->
                <div class="livestream__grid-section">
                    <h2 class="livestream__section-title">
                        {{ selectedGameName }} Channels
                    </h2>

                    <div v-if="filteredStreamers.length" class="livestream__grid">
                        <div
                            v-for="streamer in filteredStreamers"
                            :key="streamer.username"
                            class="livestream__card livestream__card--yt"
                            :class="{ 'is-playing': activeChannel === streamer.username }"
                            @click="setActiveChannel(streamer.username)"
                        >
                            <div class="livestream__card-preview">
                                <img
                                    :src="`https://img.youtube.com/vi/${streamer.youtubeId}/mqdefault.jpg`"
                                    :alt="streamer.name"
                                    class="livestream__card-avatar"
                                    @error="handleAvatarError($event, streamer)"
                                />
                                <div class="livestream__card-overlay">
                                    <div class="livestream__play-btn-circle" style="background: rgba(255,0,0,0.9)">
                                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    </div>
                                </div>
                                <span class="livestream__card-badge" style="background:#ff0000">LIVE</span>
                            </div>

                            <div class="livestream__card-info">
                                <h3 class="livestream__card-name">{{ streamer.name }}</h3>
                                <p class="livestream__card-game">{{ streamer.game }}</p>
                                <div class="livestream__card-tags">
                                    <span v-for="tag in streamer.tags" :key="tag" class="livestream__tag">
                                        {{ tag }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-else class="livestream__empty">
                        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                            <path d="M12 22V12" /><path d="M12 12L3.3 7" /><path d="M12 12l8.7-5" />
                        </svg>
                        <p>No streams found. Try a different category or paste a YouTube URL above.</p>
                    </div>
                </div>
            </section>
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import { getSettings, loadGlobalSettings } from '../composables/useSettings';

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
const showChat = ref<boolean>(true);
const copied = ref<boolean>(false);

let ytPlayer: any = null;

const route = useRoute();
const { defaultYoutubeStream } = getSettings();

// Categories
const categories: Category[] = [
    {
        id: 'all',
        name: 'All',
        boxArt: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=120&h=160&q=80'
    },
    {
        id: 'music',
        name: '24/7 Music',
        boxArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=120&h=160&q=80'
    },
    {
        id: 'fps',
        name: 'FPS & Battle Royale',
        boxArt: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=120&h=160&q=80'
    },
    {
        id: 'moba',
        name: 'MOBA & Strategy',
        boxArt: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=120&h=160&q=80'
    },
    {
        id: 'esports',
        name: 'Esports',
        boxArt: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=120&h=160&q=80'
    },
    {
        id: 'variety',
        name: 'Variety Gaming',
        boxArt: 'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=120&h=160&q=80'
    },
    {
        id: 'news',
        name: 'Gaming News',
        boxArt: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=120&h=160&q=80'
    }
];

// YouTube Gaming live channels — all with real channel IDs (UC...) or known 24/7 video IDs
const streamers: Streamer[] = [
    // 24/7 Music
    { name: 'Lofi Girl', username: 'lofi-girl', game: '24/7 Music', gameId: 'music', tags: ['Lofi', 'Study', 'Chill', '24/7'], youtubeId: 'jfKfPfyJRdk' },
    { name: 'Monstercat Radio', username: 'monstercat-radio', game: '24/7 Music', gameId: 'music', tags: ['Electronic', 'Dance', 'Music', '24/7'], youtubeId: '2b4SItX_q9g' },
    { name: 'ChilledCow Study', username: 'chilledcow-study', game: '24/7 Music', gameId: 'music', tags: ['Ambient', 'Focus', 'Beats', '24/7'], youtubeId: 'rUxyKA_-grg' },
    { name: 'DXL Radio', username: 'dxl-radio', game: '24/7 Music', gameId: 'music', tags: ['Gaming OST', 'Retro', 'Chillwave', '24/7'], youtubeId: '4xDzrJKXOOY' },

    // FPS & Battle Royale
    { name: 'Shroud', username: 'shroud-yt', game: 'Valorant / FPS', gameId: 'fps', tags: ['FPS', 'Aim', 'Pro'], youtubeId: 'UCoz8NrwgL7U' },
    { name: 'TimTheTatman', username: 'timthetatman-yt', game: 'Fortnite / Variety', gameId: 'fps', tags: ['Fortnite', 'Fun', 'Variety'], youtubeId: 'UCurnxCDF_qUHSMOGAMJjoNg' },
    { name: 'SypherPK', username: 'sypherpk-yt', game: 'Fortnite', gameId: 'fps', tags: ['Fortnite', 'Tips', 'Pro'], youtubeId: 'UCax2-FkWFXEaAoGAqUexPRQ' },
    { name: 'DrDisrespect', username: 'drdisrespect-yt', game: 'FPS / BR', gameId: 'fps', tags: ['Warzone', 'BR', 'Hype'], youtubeId: 'UCnErmqRHFCxLHG5rdBYxGqA' },

    // MOBA & Strategy
    { name: 'Tyler1', username: 'tyler1-yt', game: 'League of Legends', gameId: 'moba', tags: ['LoL', 'Ranked', 'Rage'], youtubeId: 'UCnHGCQ4kRkA4ThNlFLIY_RQ' },
    { name: 'Faker', username: 'faker-yt', game: 'League of Legends', gameId: 'moba', tags: ['LoL', 'Pro', 'T1'], youtubeId: 'UCBYncKVGMjfMDscSdShGdnQ' },
    { name: 'Grubby', username: 'grubby-yt', game: 'Warcraft / Dota 2', gameId: 'moba', tags: ['RTS', 'Pro', 'Learning'], youtubeId: 'UCFOAopFqEjfxXI2R7JqKAeg' },

    // Esports
    { name: 'ESL Counter-Strike', username: 'esl-cs2', game: 'CS2 Esports', gameId: 'esports', tags: ['CS2', 'Pro', 'Tournament'], youtubeId: 'UCPq2ETz4aAGo2Z-8JisDPIA' },
    { name: 'PGL Esports', username: 'pgl-esports', game: 'Multi-game Esports', gameId: 'esports', tags: ['Esports', 'Major', 'Live'], youtubeId: 'UCbQXBbHW7CvzIhXKw1pMYXA' },
    { name: 'Riot Games', username: 'riot-games-yt', game: 'Valorant / LoL Esports', gameId: 'esports', tags: ['Valorant', 'VCT', 'Worlds'], youtubeId: 'UCfyAQ9KBWP9BFT0bYMu3_yw' },

    // Variety Gaming
    { name: 'Markiplier', username: 'markiplier-yt', game: 'Variety Gaming', gameId: 'variety', tags: ['Horror', 'Fun', 'Indie'], youtubeId: 'UC7_YxT-KID8kRbqZo7MyscQ' },
    { name: 'Jacksepticeye', username: 'jack-yt', game: 'Variety Gaming', gameId: 'variety', tags: ['Indie', 'Positive', 'Funny'], youtubeId: 'UCYzPXprvl5Y-Sf0g4vX-m6g' },
    { name: 'Ludwig', username: 'ludwig-yt', game: 'Variety / Chess', gameId: 'variety', tags: ['Variety', 'Reactions', 'Chess'], youtubeId: 'UCrPseYLGpNygVi34QpGNqpA' },
    { name: 'Valkyrae', username: 'valkyrae-yt', game: 'Variety Gaming', gameId: 'variety', tags: ['Variety', 'Collab', 'Gaming'], youtubeId: 'UCbs6hSivNMVCGFWbHnHr7Ug' },

    // Gaming News
    { name: 'IGN', username: 'ign-yt', game: 'Gaming News & Reviews', gameId: 'news', tags: ['News', 'Reviews', 'Previews'], youtubeId: 'UCKy1dAqELo0zrOtPkf0eTMw' },
    { name: 'GameSpot', username: 'gamespot-yt', game: 'Gaming News', gameId: 'news', tags: ['News', 'Reviews', 'Events'], youtubeId: 'UCbu2SsF-Or3Rsn3NxqODImQ' },
    { name: 'Gameranx', username: 'gameranx-yt', game: 'Gaming Tips & News', gameId: 'news', tags: ['Tips', 'News', 'Lists'], youtubeId: 'UCNAz5Ut1Swwg6h6ysBtWFog' },
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

    const playerVars: any = {
        autoplay: 1,
        mute: 1,
        rel: 0,
        modestbranding: 1,
        origin: window.location.origin
    };

    let videoId = activeYoutubeId.value;
    if (isChannel) {
        playerVars.channel = activeYoutubeId.value;
        videoId = 'live_stream';
    }

    ytPlayer = new (window as any).YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId,
        playerVars,
        events: {
            onReady: (event: any) => {
                event.target.mute();
                event.target.playVideo();
                if (qualityParam !== 'default' && event.target.setPlaybackQuality) {
                    event.target.setPlaybackQuality(qualityParam);
                }
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

// Methods
function selectGame(gameId: string) {
    selectedGameId.value = gameId;
}

function setActiveChannel(username: string) {
    const streamer = streamers.find(s => s.username === username);
    if (streamer) {
        activeChannel.value = streamer.name;
        activeYoutubeId.value = streamer.youtubeId;
    }
    nextTick(() => {
        const playerEl = document.querySelector('.livestream__theater');
        if (playerEl) playerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

    if (videoMatch) {
        activeChannel.value = 'YouTube Live';
        activeYoutubeId.value = videoMatch[1];
    } else if (liveMatch) {
        activeChannel.value = 'YouTube Live';
        activeYoutubeId.value = liveMatch[1];
    } else if (channelMatch) {
        activeChannel.value = 'YouTube Channel';
        activeYoutubeId.value = channelMatch[1];
    } else if (input.startsWith('UC') && input.length === 24) {
        activeChannel.value = 'YouTube Channel';
        activeYoutubeId.value = input;
    } else if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
        activeChannel.value = 'YouTube Live';
        activeYoutubeId.value = input;
    } else {
        return;
    }

    customChannelInput.value = '';
    setTimeout(() => {
        const playerEl = document.querySelector('.livestream__theater');
        if (playerEl) playerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

function toggleChat() {
    showChat.value = !showChat.value;
}

function copyStreamLink() {
    if (typeof window !== 'undefined') {
        const link = `${window.location.origin}/livestream?platform=youtube&ytId=${activeYoutubeId.value}`;
        navigator.clipboard.writeText(link).then(() => {
            copied.value = true;
            setTimeout(() => { copied.value = false; }, 2000);
        });
    }
}

function handleAvatarError(event: Event, streamer: Streamer) {
    const img = event.target as HTMLImageElement;
    img.src = `https://api.dicebear.com/7.x/initials/svg?seed=${streamer.name}&backgroundColor=ff0000`;
}

function parseYoutubeId(input: string): string {
    const ytVideoReg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
    const ytChannelReg = /(?:youtube\.com\/channel\/)(UC[^"&?\/ ]{22})/;
    const ytLiveReg = /(?:youtube\.com\/live\/)([^"&?\/ ]{11})/;

    const v = input.match(ytVideoReg);
    if (v) return v[1];
    const l = input.match(ytLiveReg);
    if (l) return l[1];
    const c = input.match(ytChannelReg);
    if (c) return c[1];
    if (input.startsWith('UC') && input.length === 24) return input;
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    return '';
}

function playDefaultYoutubeLink(link: string) {
    const id = parseYoutubeId(link);
    if (id) {
        activeChannel.value = 'Admin Recommended Live';
        activeYoutubeId.value = id;
    }
}

// Watch YouTube ID changes to reinit player
watch(activeYoutubeId, () => {
    nextTick(() => { initYoutubePlayer(); });
});

watch(selectedQuality, (newQuality) => {
    if (ytPlayer && ytPlayer.setPlaybackQuality) {
        ytPlayer.setPlaybackQuality(newQuality === 'auto' ? 'default' : newQuality);
    }
});

onMounted(async () => {
    document.title = 'Livestream — Moovie';
    await loadGlobalSettings();

    // Handle query params (e.g. shared links)
    if (route.query.ytId) {
        activeChannel.value = 'YouTube Live';
        activeYoutubeId.value = String(route.query.ytId);
    } else if (defaultYoutubeStream.value) {
        playDefaultYoutubeLink(defaultYoutubeStream.value);
    } else {
        // Auto-play first stream (Lofi Girl)
        setActiveChannel(streamers[0].username);
    }
});

watch(defaultYoutubeStream, (newVal) => {
    if (!route.query.ytId && newVal && !activeYoutubeId.value) {
        playDefaultYoutubeLink(newVal);
    }
});

onUnmounted(() => {
    if (ytPlayer) {
        try { ytPlayer.destroy(); } catch (e) { /* ignore */ }
        ytPlayer = null;
    }
});
</script>
