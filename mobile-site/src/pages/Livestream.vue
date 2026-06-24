<template>
    <MobileShell>
        <div class="m-livestream">
            <header class="m-livestream__head">
                <h1 class="m-livestream__title">Livestream</h1>
            </header>

            <!-- Theater View (Active Stream Player) -->
            <div v-if="activeChannel" class="m-livestream__theater">
                <div class="m-livestream__video-wrapper">
                    <!-- Twitch Player -->
                    <iframe
                        v-if="activePlatform === 'twitch'"
                        :src="playerUrl"
                        class="m-livestream__video-frame"
                        allowfullscreen
                        scrolling="no"
                        frameborder="0"
                    ></iframe>

                    <!-- YouTube Player Container -->
                    <div
                        v-else-if="activePlatform === 'youtube'"
                        id="youtube-player"
                        class="m-livestream__video-frame"
                    ></div>
                </div>

                <!-- Stream Details & Controls -->
                <div class="m-livestream__meta-bar">
                    <div class="m-livestream__streamer-info">
                        <div class="m-livestream__avatar" :style="activePlatform === 'youtube' ? { background: 'linear-gradient(135deg, #ff0000, #b30000)' } : {}">
                            {{ activeChannel ? activeChannel.charAt(0).toUpperCase() : '' }}
                        </div>
                        <div class="m-livestream__streamer-details">
                            <div class="m-livestream__streamer-name">
                                {{ activeChannel }}
                                <span 
                                    class="m-livestream__live-badge" 
                                    :class="{ 'm-livestream__live-badge--offline': activePlatform === 'twitch' && offlineStreamers[activeChannel.toLowerCase()] }"
                                >
                                    {{ (activePlatform === 'twitch' && offlineStreamers[activeChannel.toLowerCase()]) ? 'OFFLINE' : 'LIVE' }}
                                </span>
                            </div>
                            <div class="m-livestream__streamer-sub">
                                {{ (activePlatform === 'twitch' && offlineStreamers[activeChannel.toLowerCase()]) ? 'Currently offline' : 'Streaming live' }} on {{ activePlatform === 'youtube' ? 'YouTube' : 'Twitch' }}
                            </div>
                        </div>
                    </div>

                    <div class="m-livestream__controls-row">
                        <!-- Quality selector -->
                        <div class="m-livestream__quality-control">
                            <select v-model="selectedQuality" class="m-livestream__quality-select" :disabled="activePlatform === 'twitch'" :title="activePlatform === 'twitch' ? 'Twitch manages quality settings inside its own player settings cog' : 'Change quality'">
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

                <!-- Mobile stacked chat container -->
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
                <!-- Game Tabs (horizontal scrollable) -->
                <div class="m-livestream__games-nav">
                    <button
                        v-for="game in games"
                        :key="game.id"
                        class="m-livestream__game-tab"
                        :class="{ 'is-active': selectedGameId === game.id }"
                        @click="selectGame(game.id)"
                    >
                        <img :src="game.boxArt" :alt="game.name" class="m-livestream__game-boxart" />
                        <span class="m-livestream__game-tab-title">{{ game.name }}</span>
                    </button>
                </div>

                <!-- Search and Custom Input -->
                <div class="m-livestream__search-row">
                    <div class="m-livestream__search-field">
                        <input
                            v-model="searchQuery"
                            type="search"
                            class="m-livestream__input"
                            placeholder="Search streamers…"
                            aria-label="Search streams"
                        />
                    </div>

                    <form @submit.prevent="watchCustomChannel" class="m-livestream__custom-form">
                        <select v-if="youtubeStreams" v-model="customPlatform" class="m-livestream__platform-select">
                            <option value="twitch">Twitch</option>
                            <option value="youtube">YouTube</option>
                        </select>
                        <input
                            v-model="customChannelInput"
                            type="text"
                            class="m-livestream__input"
                            :placeholder="customPlatform === 'twitch' ? 'Twitch username' : 'YouTube URL or ID'"
                            aria-label="Custom Channel"
                        />
                        <button type="submit" class="m-livestream__btn-primary">
                            Watch
                        </button>
                    </form>
                </div>
            </div>

            <!-- Streamers Grid -->
            <div class="m-livestream__grid-section">
                <h2 class="m-livestream__section-title">
                    {{ selectedGameName }} Channels
                </h2>

                <div v-if="filteredStreamers.length" class="m-livestream__grid">
                    <div
                        v-for="streamer in filteredStreamers"
                        :key="streamer.username"
                        class="m-livestream__card"
                        :class="{ 
                            'is-playing': activeChannel === streamer.username,
                            'm-livestream__card--yt': streamer.platform === 'youtube'
                        }"
                        @click="setActiveChannel(streamer.username)"
                    >
                        <div class="m-livestream__card-preview" :class="{ 'is-offline': offlineStreamers[streamer.username] }">
                            <img
                                :src="streamer.platform === 'youtube' 
                                    ? `https://img.youtube.com/vi/${streamer.youtubeId}/mqdefault.jpg` 
                                    : (offlineStreamers[streamer.username] 
                                        ? `https://api.dicebear.com/7.x/identicon/svg?seed=${streamer.username}` 
                                        : `https://static-cdn.jtvnw.net/previews-ttv/live_user_${streamer.username}-440x248.jpg`)"
                                :alt="streamer.name"
                                class="m-livestream__card-avatar"
                                @error="handleAvatarError($event, streamer)"
                            />
                            <span 
                                class="m-livestream__card-badge" 
                                :class="{ 'is-offline-badge': offlineStreamers[streamer.username] }"
                                :style="streamer.platform === 'youtube' ? { background: '#ff0000' } : {}"
                            >
                                {{ offlineStreamers[streamer.username] ? 'OFFLINE' : (streamer.platform === 'youtube' ? 'YT LIVE' : 'LIVE') }}
                            </span>
                        </div>

                        <div class="m-livestream__card-info">
                            <h3 class="m-livestream__card-name">{{ streamer.name }}</h3>
                            <p class="m-livestream__card-game">{{ streamer.game }}</p>
                        </div>
                    </div>
                </div>

                <div v-else class="m-livestream__empty meta">
                    No matching livestreams found.
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
    platform?: 'twitch' | 'youtube';
    youtubeId?: string;
}

interface Game {
    id: string;
    name: string;
    boxArt: string;
}

// State
const activeChannel = ref<string>('');
const activePlatform = ref<'twitch' | 'youtube'>('twitch');
const activeYoutubeId = ref<string>('');
const customPlatform = ref<'twitch' | 'youtube'>('twitch');
const selectedQuality = ref<string>('hd1080');
const offlineStreamers = ref<Record<string, boolean>>({});

const selectedGameId = ref<string>('all');
const searchQuery = ref<string>('');
const customChannelInput = ref<string>('');
const showChat = ref<boolean>(false); // default to false on mobile to save layout spacing

const route = useRoute();
const { youtubeStreams, defaultYoutubeStream } = getSettings();

// Games list
const gamesList: Game[] = [
    {
        id: 'all',
        name: 'All Categories',
        boxArt: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=120&h=160&q=80'
    },
    {
        id: 'always-live',
        name: '24/7 Channels',
        boxArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=120&h=160&q=80'
    },
    {
        id: 'youtube',
        name: 'YouTube Live',
        boxArt: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=120&h=160&q=80'
    },
    {
        id: 'just-chatting',
        name: 'Just Chatting',
        boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/509658-285x380.jpg'
    },
    {
        id: 'league',
        name: 'League of Legends',
        boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/21779-285x380.jpg'
    },
    {
        id: 'valorant',
        name: 'Valorant',
        boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/516575-285x380.jpg'
    },
    {
        id: 'gta-v',
        name: 'Grand Theft Auto V',
        boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/32982_IGDB-285x380.jpg'
    },
    {
        id: 'minecraft',
        name: 'Minecraft',
        boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/27471_IGDB-285x380.jpg'
    },
    {
        id: 'fortnite',
        name: 'Fortnite',
        boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/33214-285x380.jpg'
    },
    {
        id: 'cs2',
        name: 'Counter-Strike 2',
        boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/493057-285x380.jpg'
    },
    {
        id: 'dota2',
        name: 'Dota 2',
        boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/29595-285x380.jpg'
    }
];

const games = computed(() => {
    if (!youtubeStreams.value) {
        return gamesList.filter(g => g.id !== 'youtube');
    }
    return gamesList;
});

// Curated grid
const streamers: Streamer[] = [
    { name: 'Lofi Girl', username: 'lofigirl', game: '24/7 Music & Esports', gameId: 'always-live', tags: ['Lofi Beats', 'Study', 'Relax', '24/7'], platform: 'twitch' },
    { name: 'Monstercat', username: 'monstercat', game: '24/7 Music & Esports', gameId: 'always-live', tags: ['Electronic', 'Dance', 'Music', '24/7'], platform: 'twitch' },
    { name: 'NoCopyrightSounds', username: 'nocopyrightsounds', game: '24/7 Music & Esports', gameId: 'always-live', tags: ['NCS', 'Bass', 'Music', '24/7'], platform: 'twitch' },
    { name: 'ESL CS2', username: 'esl_csgo', game: '24/7 Music & Esports', gameId: 'always-live', tags: ['CS2', 'Esports', 'Reruns', '24/7'], platform: 'twitch' },
    { name: 'ESL Dota 2', username: 'esl_dota2', game: '24/7 Music & Esports', gameId: 'always-live', tags: ['Dota 2', 'Esports', 'Reruns', '24/7'], platform: 'twitch' },
    
    { name: 'Lofi Girl Live (YT)', username: 'lofigirl-yt', game: 'YouTube Live', gameId: 'youtube', tags: ['Music', 'Lofi Beats', 'Chill', 'YouTube'], platform: 'youtube', youtubeId: 'jfKfPfyJRdk' },
    { name: 'Monstercat Radio (YT)', username: 'monstercat-yt', game: 'YouTube Live', gameId: 'youtube', tags: ['Music', 'Electronic', 'Dance', 'YouTube'], platform: 'youtube', youtubeId: '2b4SItX_q9g' },
    { name: 'IGN Gaming (YT)', username: 'ign-yt', game: 'YouTube Live', gameId: 'youtube', tags: ['Gaming', 'News', 'Reviews', 'YouTube'], platform: 'youtube', youtubeId: 'e22e5kym970' },
    { name: 'Space Ambient (YT)', username: 'spaceambient-yt', game: 'YouTube Live', gameId: 'youtube', tags: ['Ambient', 'Chill', 'Space', 'YouTube'], platform: 'youtube', youtubeId: '5wNeQD_dJm4' },

    { name: 'xQc', username: 'xqc', game: 'Just Chatting', gameId: 'just-chatting', tags: ['English', 'IRL', 'Funny'], platform: 'twitch' },
    { name: 'HasanAbi', username: 'hasanabi', game: 'Just Chatting', gameId: 'just-chatting', tags: ['English', 'Politics', 'News'], platform: 'twitch' },
    { name: 'Kai Cenat', username: 'kaicenat', game: 'Just Chatting', gameId: 'just-chatting', tags: ['English', 'IRL', 'Collabs'], platform: 'twitch' },
    { name: 'Pokimane', username: 'pokimane', game: 'Just Chatting', gameId: 'just-chatting', tags: ['English', 'Chilled', 'Reacts'], platform: 'twitch' },
    { name: 'Faker', username: 'faker', game: 'League of Legends', gameId: 'league', tags: ['Korean', 'Pro Player', 'T1'], platform: 'twitch' },
    { name: 'Doublelift', username: 'doublelift', game: 'League of Legends', gameId: 'league', tags: ['English', 'Co-Stream', 'Analyst'], platform: 'twitch' },
    { name: 'Tyler1', username: 'loltyler1', game: 'League of Legends', gameId: 'league', tags: ['English', 'Climb', 'Rage'], platform: 'twitch' },
    { name: 'OTP LoL', username: 'otplol_', game: 'League of Legends', gameId: 'league', tags: ['French', 'Esports', 'LFL'], platform: 'twitch' },
    { name: 'Tarik', username: 'tarik', game: 'Valorant', gameId: 'valorant', tags: ['English', 'Watch Party', 'Vct'], platform: 'twitch' },
    { name: 'Shroud', username: 'shroud', game: 'Valorant', gameId: 'valorant', tags: ['English', 'Aim', 'Chill'], platform: 'twitch' },
    { name: 'TenZ', username: 'tenz', game: 'Valorant', gameId: 'valorant', tags: ['English', 'Pro', 'Radiant'], platform: 'twitch' },
    { name: 'Kyedae', username: 'kyedae', game: 'Valorant', gameId: 'valorant', tags: ['English', 'Ranked', 'Friendly'], platform: 'twitch' },
    { name: 'Buddha', username: 'buddha', game: 'Grand Theft Auto V', gameId: 'gta-v', tags: ['English', 'NoPixel', 'Roleplay'], platform: 'twitch' },
    { name: 'Sykkuno', username: 'sykkuno', game: 'Grand Theft Auto V', gameId: 'gta-v', tags: ['English', 'Co-op', 'Wholesome'], platform: 'twitch' },
    { name: 'Lord Kebun', username: 'lord_kebun', game: 'Grand Theft Auto V', gameId: 'gta-v', tags: ['English', 'NoPixel', 'RP'], platform: 'twitch' },
    { name: 'Tubbo', username: 'tubbo', game: 'Minecraft', gameId: 'minecraft', tags: ['English', 'SMP', 'Multiplayer'], platform: 'twitch' },
    { name: 'Ranboo', username: 'ranboolive', game: 'Minecraft', gameId: 'minecraft', tags: ['English', 'RP', 'Interactive'], platform: 'twitch' },
    { name: 'CaptainSparklez', username: 'captainsparklez', game: 'Minecraft', gameId: 'minecraft', tags: ['English', 'Mods', 'Classic'], platform: 'twitch' },
    { name: 'Ninja', username: 'ninja', game: 'Fortnite', gameId: 'fortnite', tags: ['English', 'Classic', 'FPS'], platform: 'twitch' },
    { name: 'Clix', username: 'clix', game: 'Fortnite', gameId: 'fortnite', tags: ['English', 'Wagers', 'Ranked'], platform: 'twitch' },
    { name: 'SypherPK', username: 'sypherpk', game: 'Fortnite', gameId: 'fortnite', tags: ['English', 'Guides', 'Updates'], platform: 'twitch' },
    { name: 'Gaules', username: 'gaules', game: 'Counter-Strike 2', gameId: 'cs2', tags: ['Portuguese', 'Esports', 'Tribo'], platform: 'twitch' },
    { name: 'ohnePixel', username: 'ohnepixel', game: 'Counter-Strike 2', gameId: 'cs2', tags: ['English', 'Skins', 'Cases'], platform: 'twitch' },
    { name: 's1mple', username: 's1mple', game: 'Counter-Strike 2', gameId: 'cs2', tags: ['Ukrainian', 'Pro', 'Aim'], platform: 'twitch' },
    { name: 'Gorgc', username: 'gorgc', game: 'Dota 2', gameId: 'dota2', tags: ['English', 'Ranked', 'Immortal'], platform: 'twitch' },
    { name: 'Grubby', username: 'grubby', game: 'Dota 2', gameId: 'dota2', tags: ['English', 'Learning', 'RTS'], platform: 'twitch' },
    { name: 'Dendi', username: 'dendi', game: 'Dota 2', gameId: 'dota2', tags: ['Ukrainian', 'Pro', 'B8'], platform: 'twitch' }
];

const visibleStreamers = computed(() => {
    if (!youtubeStreams.value) {
        return streamers.filter(s => s.platform !== 'youtube');
    }
    return streamers;
});

// Computed Hostname
const currentHostname = computed(() => {
    if (typeof window !== 'undefined') {
        return window.location.hostname;
    }
    return 'localhost';
});

// URLs
const playerUrl = computed(() => {
    if (activePlatform.value === 'youtube') {
        const qualityParam = selectedQuality.value !== 'auto' ? `&vq=${selectedQuality.value}` : '';
        if (activeYoutubeId.value.startsWith('UC') && activeYoutubeId.value.length === 24) {
            return `https://www.youtube.com/embed/live_stream?channel=${activeYoutubeId.value}&autoplay=1&mute=1${qualityParam}`;
        }
        return `https://www.youtube.com/embed/${activeYoutubeId.value}?autoplay=1&mute=1${qualityParam}`;
    }
    return `https://player.twitch.tv/?channel=${activeChannel.value}&parent=${currentHostname.value}&muted=true`;
});

const chatUrl = computed(() => {
    if (activePlatform.value === 'youtube') {
        if (activeYoutubeId.value.startsWith('UC') && activeYoutubeId.value.length === 24) {
            return '';
        }
        return `https://www.youtube.com/live_chat?v=${activeYoutubeId.value}&embed_domain=${currentHostname.value}`;
    }
    return `https://www.twitch.tv/embed/${activeChannel.value}/chat?parent=${currentHostname.value}&darkpopout=true`;
});

const selectedGameName = computed(() => {
    const game = games.value.find(g => g.id === selectedGameId.value);
    return game ? game.name : 'Curated';
});

// Filtering
const filteredStreamers = computed(() => {
    let result = visibleStreamers.value;

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

    // Sort: Online first
    return [...result].sort((a, b) => {
        const aOffline = offlineStreamers.value[a.username] ? 1 : 0;
        const bOffline = offlineStreamers.value[b.username] ? 1 : 0;
        return aOffline - bOffline;
    });
});

// API checking state
let checkInterval: any = null;
let ytPlayer: any = null;

function loadYoutubeApi() {
    if (typeof window === 'undefined') return;
    if ((window as any).YT) return;
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
}

function initYoutubePlayer() {
    if (typeof window === 'undefined') return;
    loadYoutubeApi();

    if (!(window as any).YT || !(window as any).YT.Player) {
        setTimeout(initYoutubePlayer, 100);
        return;
    }

    if (ytPlayer) {
        try {
            ytPlayer.destroy();
        } catch (e) {
            console.error(e);
        }
        ytPlayer = null;
    }

    const container = document.getElementById('youtube-player');
    if (!container) return;

    const qualityParam = selectedQuality.value !== 'auto' ? selectedQuality.value : 'default';

    let videoId = '';
    let channelId = '';

    if (activeYoutubeId.value.startsWith('UC') && activeYoutubeId.value.length === 24) {
        channelId = activeYoutubeId.value;
    } else {
        videoId = activeYoutubeId.value;
    }

    const playerVars: any = {
        autoplay: 1,
        mute: 1,
        rel: 0,
        modestbranding: 1,
        origin: window.location.origin
    };

    if (channelId) {
        playerVars.channel = channelId;
        videoId = 'live_stream';
    }

    ytPlayer = new (window as any).YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: playerVars,
        events: {
            onReady: (event: any) => {
                event.target.mute();
                event.target.playVideo();
                if (qualityParam !== 'default' && event.target.setPlaybackQuality) {
                    event.target.setPlaybackQuality(qualityParam);
                }
                
                setTimeout(() => {
                    if (event.target.getDuration) {
                        const duration = event.target.getDuration();
                        if (duration > 0) {
                            event.target.seekTo(duration, true);
                        }
                    }
                }, 1000);
            },
            onStateChange: (event: any) => {
                if (event.data === (window as any).YT.PlayerState.PLAYING) {
                    const duration = event.target.getDuration();
                    const currentTime = event.target.getCurrentTime();
                    if (duration > 0 && (duration - currentTime) > 15) {
                        if (!event.target.hasSeekedToLive) {
                            event.target.seekTo(duration, true);
                            event.target.hasSeekedToLive = true;
                        }
                    }
                }
            }
        }
    });
}

async function checkSingleTwitchStream(username: string) {
    const name = username.toLowerCase();
    try {
        const url = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${name}-440x248.jpg`;
        const res = await fetch(url, { method: 'HEAD' });
        const isOffline = res.redirected || res.url.includes('404_preview') || res.status === 404;
        offlineStreamers.value[name] = isOffline;
    } catch (err) {
        console.error(`Failed to check live status for custom channel ${name}:`, err);
    }
}

async function checkAllTwitchStreams() {
    const twitchStreamers = streamers.filter(s => s.platform === 'twitch' || !s.platform);
    await Promise.all(
        twitchStreamers.map(async (streamer) => {
            try {
                const url = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${streamer.username}-440x248.jpg`;
                const res = await fetch(url, { method: 'HEAD' });
                const isOffline = res.redirected || res.url.includes('404_preview') || res.status === 404;
                offlineStreamers.value[streamer.username] = isOffline;
            } catch (err) {
                console.error(`Failed to check live status for ${streamer.username}:`, err);
            }
        })
    );
}

// Methods
function selectGame(gameId: string) {
    selectedGameId.value = gameId;
}

function setActiveChannel(username: string) {
    const streamer = streamers.find(s => s.username === username);
    if (streamer) {
        activeChannel.value = streamer.username;
        activePlatform.value = streamer.platform || 'twitch';
        activeYoutubeId.value = streamer.youtubeId || '';
    } else {
        activeChannel.value = username;
        activePlatform.value = 'twitch';
        activeYoutubeId.value = '';
    }

    if (activePlatform.value === 'twitch') {
        void checkSingleTwitchStream(activeChannel.value);
    }

    // Scroll to player smoothly
    nextTick(() => {
        const playerEl = document.querySelector('.m-livestream__theater');
        if (playerEl) {
            playerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
}

function watchCustomChannel() {
    const input = customChannelInput.value.trim();
    if (!input) return;

    const ytVideoReg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
    const ytChannelReg = /(?:youtube\.com\/channel\/)(UC[^"&?\/ ]{22})/;
    const ytShortsReg = /(?:youtube\.com\/shorts\/)([^"&?\/ ]{11})/;
    const ytLiveReg = /(?:youtube\.com\/live\/)([^"&?\/ ]{11})/;

    const videoMatch = input.match(ytVideoReg);
    const channelMatch = input.match(ytChannelReg);
    const shortsMatch = input.match(ytShortsReg);
    const liveMatch = input.match(ytLiveReg);

    if (videoMatch) {
        activeChannel.value = 'YouTube Live Video';
        activePlatform.value = 'youtube';
        activeYoutubeId.value = videoMatch[1];
    } else if (shortsMatch) {
        activeChannel.value = 'YouTube Video';
        activePlatform.value = 'youtube';
        activeYoutubeId.value = shortsMatch[1];
    } else if (liveMatch) {
        activeChannel.value = 'YouTube Live';
        activePlatform.value = 'youtube';
        activeYoutubeId.value = liveMatch[1];
    } else if (channelMatch) {
        activeChannel.value = 'YouTube Live Channel';
        activePlatform.value = 'youtube';
        activeYoutubeId.value = channelMatch[1];
    } else {
        if (customPlatform.value === 'youtube') {
            if (input.startsWith('UC') && input.length === 24) {
                activeChannel.value = 'YouTube Live Channel';
                activePlatform.value = 'youtube';
                activeYoutubeId.value = input;
            } else {
                activeChannel.value = 'YouTube Live Video';
                activePlatform.value = 'youtube';
                activeYoutubeId.value = input;
            }
        } else {
            const isYtIdPattern = /^[a-zA-Z0-9_-]{11}$/.test(input);
            if (isYtIdPattern && youtubeStreams.value) {
                activeChannel.value = 'YouTube Live Video';
                activePlatform.value = 'youtube';
                activeYoutubeId.value = input;
            } else {
                activeChannel.value = input.toLowerCase();
                activePlatform.value = 'twitch';
                activeYoutubeId.value = '';
                void checkSingleTwitchStream(activeChannel.value);
            }
        }
    }

    customChannelInput.value = '';
    
    nextTick(() => {
        const playerEl = document.querySelector('.m-livestream__theater');
        if (playerEl) {
            playerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
}

function toggleChat() {
    showChat.value = !showChat.value;
}

function handleAvatarError(event: Event, streamer: Streamer) {
    const img = event.target as HTMLImageElement;
    if (streamer.platform === 'youtube') {
        img.src = `https://api.dicebear.com/7.x/initials/svg?seed=${streamer.name}&backgroundColor=ff5a1f`;
    } else {
        offlineStreamers.value[streamer.username] = true;
        img.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${streamer.username}`;
    }
}

function playDefaultYoutubeLink(link: string) {
    const ytVideoReg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
    const ytChannelReg = /(?:youtube\.com\/channel\/)(UC[^"&?\/ ]{22})/;
    const ytShortsReg = /(?:youtube\.com\/shorts\/)([^"&?\/ ]{11})/;
    const ytLiveReg = /(?:youtube\.com\/live\/)([^"&?\/ ]{11})/;

    const videoMatch = link.match(ytVideoReg);
    const channelMatch = link.match(ytChannelReg);
    const shortsMatch = link.match(ytShortsReg);
    const liveMatch = link.match(ytLiveReg);

    if (videoMatch) {
        activeChannel.value = 'Admin Recommended Live';
        activePlatform.value = 'youtube';
        activeYoutubeId.value = videoMatch[1];
    } else if (shortsMatch) {
        activeChannel.value = 'Admin Recommended Video';
        activePlatform.value = 'youtube';
        activeYoutubeId.value = shortsMatch[1];
    } else if (liveMatch) {
        activeChannel.value = 'Admin Recommended Live';
        activePlatform.value = 'youtube';
        activeYoutubeId.value = liveMatch[1];
    } else if (channelMatch) {
        activeChannel.value = 'Admin Recommended Channel';
        activePlatform.value = 'youtube';
        activeYoutubeId.value = channelMatch[1];
    } else {
        if (link.startsWith('UC') && link.length === 24) {
            activeChannel.value = 'Admin Recommended Channel';
            activePlatform.value = 'youtube';
            activeYoutubeId.value = link;
        } else if (link.length === 11) {
            activeChannel.value = 'Admin Recommended Live';
            activePlatform.value = 'youtube';
            activeYoutubeId.value = link;
        }
    }
}

function loadInitialStream() {
    if (route.query.channel) {
        activeChannel.value = String(route.query.channel).toLowerCase();
        activePlatform.value = 'twitch';
        activeYoutubeId.value = '';
    } else if (route.query.platform === 'youtube' && route.query.ytId) {
        activeChannel.value = 'YouTube Live Video';
        activePlatform.value = 'youtube';
        activeYoutubeId.value = String(route.query.ytId);
    } else {
        if (youtubeStreams.value && defaultYoutubeStream.value) {
            playDefaultYoutubeLink(defaultYoutubeStream.value);
        } else {
            setActiveChannel(streamers[0].username);
        }
    }
}

// Watchers
watch(youtubeStreams, (enabled) => {
    if (!enabled && activePlatform.value === 'youtube') {
        setActiveChannel(streamers[0].username);
    }
});

watch(defaultYoutubeStream, (newVal) => {
    if (!route.query.channel && !route.query.ytId && youtubeStreams.value) {
        const isDefaultCurrentlyPlaying = activeChannel.value === streamers[0].username || !activeChannel.value;
        if (isDefaultCurrentlyPlaying && newVal) {
            playDefaultYoutubeLink(newVal);
        }
    }
});

watch([activePlatform, activeYoutubeId], () => {
    if (activePlatform.value === 'youtube') {
        nextTick(() => {
            initYoutubePlayer();
        });
    } else {
        if (ytPlayer) {
            try {
                ytPlayer.destroy();
            } catch (e) {
                console.error(e);
            }
            ytPlayer = null;
        }
    }
});

watch(selectedQuality, (newQuality) => {
    if (activePlatform.value === 'youtube' && ytPlayer && ytPlayer.setPlaybackQuality) {
        ytPlayer.setPlaybackQuality(newQuality === 'auto' ? 'default' : newQuality);
    }
});

onMounted(async () => {
    document.title = 'Livestream — Moovie';
    await loadGlobalSettings();

    void checkAllTwitchStreams();
    checkInterval = setInterval(() => {
        void checkAllTwitchStreams();
    }, 60000);

    loadInitialStream();

    if (activePlatform.value === 'twitch' && activeChannel.value) {
        void checkSingleTwitchStream(activeChannel.value);
    } else if (activePlatform.value === 'youtube' && activeChannel.value) {
        nextTick(() => {
            initYoutubePlayer();
        });
    }
});

onUnmounted(() => {
    if (checkInterval) {
        clearInterval(checkInterval);
    }
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
        background: linear-gradient(135deg, #a855f7, #6366f1);
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
        background: var(--danger);
        padding: 1px 4px;
        border-radius: var(--r-xs);
        letter-spacing: 0.05em;

        &--offline {
            background: var(--ink-600) !important;
            color: var(--bone-300) !important;
            border: 1px solid var(--rule-strong);
        }
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

        &:disabled {
            opacity: 0.6;
        }
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
            background: linear-gradient(135deg, rgba(#a855f7, 0.15) 0%, rgba(#6366f1, 0.15) 100%);
            border-color: #8b5cf6;
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
            border-color: #8b5cf6;
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

    &__platform-select {
        min-height: 2.75rem;
        padding: 0 var(--s-3);
        border-radius: var(--r-md);
        border: 1px solid var(--rule-strong);
        background: var(--ink-850);
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: 0.88rem;
    }

    &__btn-primary {
        min-height: 2.75rem;
        padding: 0 var(--s-4);
        border-radius: var(--r-md);
        background: linear-gradient(135deg, #a855f7, #6366f1);
        color: #fff;
        font-family: var(--font-ui);
        font-weight: 600;
        font-size: 0.88rem;
        border: none;
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

        &.is-playing {
            border-color: #8b5cf6;
            box-shadow: 0 0 0 1px #8b5cf6;
        }

        &--yt {
            &.is-playing {
                border-color: #ff0000;
                box-shadow: 0 0 0 1px #ff0000;
            }
        }
    }

    &__card-preview {
        position: relative;
        aspect-ratio: 16 / 9;
        background: var(--ink-950);
        overflow: hidden;

        &.is-offline {
            opacity: 0.55;
        }
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
        background: var(--danger);
        color: #fff;
        padding: 1px 4px;
        border-radius: var(--r-xs);
        letter-spacing: 0.02em;

        &.is-offline-badge {
            background: var(--ink-600) !important;
            color: var(--bone-300) !important;
            border: 1px solid var(--rule-strong);
        }
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
