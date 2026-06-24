<template>
    <div class="livestream">
        <SiteHeader />

        <main id="main" class="livestream__main" role="main">
            <section class="livestream__body container-lm">


                <!-- Theater View (Active Stream Player) -->
                <div v-if="activeChannel" class="livestream__theater">
                    <div class="livestream__theater-container" :class="{ 'chat-collapsed': !showChat }">
                        <div class="livestream__video-wrapper">
                            <!-- Twitch Player -->
                            <iframe
                                v-if="activePlatform === 'twitch'"
                                :src="playerUrl"
                                class="livestream__video-frame"
                                allowfullscreen
                                allow="autoplay; encrypted-media"
                                scrolling="no"
                                frameborder="0"
                            ></iframe>

                            <!-- YouTube Player Container -->
                            <div
                                v-else-if="activePlatform === 'youtube'"
                                id="youtube-player"
                                class="livestream__video-frame"
                            ></div>
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
                                <p>Live Chat is only available for direct YouTube Video IDs, not channel-based feeds.</p>
                            </div>
                        </div>
                    </div>

                    <!-- Stream Details -->
                    <div class="livestream__meta-bar">
                        <div class="livestream__streamer-info">
                            <div class="livestream__avatar" :style="activePlatform === 'youtube' ? { background: 'linear-gradient(135deg, #ff0000, #b30000)' } : {}">
                                {{ activeChannel.charAt(0).toUpperCase() }}
                            </div>
                            <div>
                                <div class="livestream__streamer-name">
                                    {{ activeChannel }}
                                    <span 
                                        class="livestream__live-badge" 
                                        :class="{ 'livestream__live-badge--offline': activePlatform === 'twitch' && offlineStreamers[activeChannel.toLowerCase()] }"
                                    >
                                        {{ (activePlatform === 'twitch' && offlineStreamers[activeChannel.toLowerCase()]) ? 'OFFLINE' : 'LIVE' }}
                                    </span>
                                </div>
                                <div class="livestream__streamer-sub">
                                    {{ (activePlatform === 'twitch' && offlineStreamers[activeChannel.toLowerCase()]) ? 'Currently offline on Twitch' : `Currently streaming live on ${activePlatform === 'youtube' ? 'YouTube' : 'Twitch'}` }}
                                </div>
                            </div>
                        </div>

                        <!-- Quality Selection Dropdown -->
                        <div class="livestream__quality-control">
                            <label class="eyebrow" style="color: var(--bone-400); font-size: 0.65rem; display: block; margin-bottom: 4px;">Graphics Quality</label>
                            <div class="livestream__quality-select-wrapper">
                                <select v-model="selectedQuality" class="livestream__quality-select" :disabled="activePlatform === 'twitch'" :title="activePlatform === 'twitch' ? 'Twitch manages quality settings inside its own player settings cog' : 'Change stream quality'">
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
                            
                            <!-- YouTube External Link -->
                            <a v-if="activePlatform === 'youtube'" :href="activeYoutubeId.startsWith('UC') ? `https://youtube.com/channel/${activeYoutubeId}` : `https://youtube.com/watch?v=${activeYoutubeId}`" target="_blank" rel="noopener noreferrer" class="livestream__action-btn livestream__action-btn--youtube">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                    <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                </svg>
                                Open on YouTube
                            </a>

                            <!-- Twitch External Link -->
                            <a v-else :href="`https://twitch.tv/${activeChannel}`" target="_blank" rel="noopener noreferrer" class="livestream__action-btn livestream__action-btn--twitch">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
                                </svg>
                                Open on Twitch
                            </a>
                        </div>
                    </div>
                </div>

                <!-- Custom Channel & Filter bar -->
                <div class="livestream__filters">
                    <!-- Game Filter Tabs -->
                    <div class="livestream__games-nav">
                        <button
                            v-for="game in games"
                            :key="game.id"
                            class="livestream__game-tab"
                            :class="{ 'is-active': selectedGameId === game.id }"
                            @click="selectGame(game.id)"
                        >
                            <img :src="game.boxArt" :alt="game.name" class="livestream__game-boxart" />
                            <div class="livestream__game-tab-info">
                                <span class="livestream__game-tab-title">{{ game.name }}</span>
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
                                placeholder="Search streamers..."
                                aria-label="Search streams"
                            />
                        </div>

                        <form @submit.prevent="watchCustomChannel" class="livestream__custom-form">
                            <select v-if="youtubeStreams" v-model="customPlatform" class="livestream__platform-select">
                                <option value="twitch">Twitch</option>
                                <option value="youtube">YouTube</option>
                            </select>
                            <input
                                v-model="customChannelInput"
                                type="text"
                                class="livestream__input"
                                :placeholder="customPlatform === 'twitch' ? 'Enter twitch username...' : 'Enter youtube video ID or URL...'"
                                aria-label="Channel identifier"
                            />
                            <button type="submit" class="livestream__btn-primary">
                                Watch
                            </button>
                        </form>
                    </div>
                </div>

                <!-- Streamers Grid -->
                <div class="livestream__grid-section">
                    <h2 class="livestream__section-title">
                        {{ selectedGameName }} Channels
                    </h2>
                    
                    <div v-if="filteredStreamers.length" class="livestream__grid">
                        <div
                            v-for="streamer in filteredStreamers"
                            :key="streamer.username"
                            class="livestream__card"
                            :class="{ 
                                'is-playing': activeChannel === streamer.username,
                                'livestream__card--yt': streamer.platform === 'youtube'
                            }"
                            @click="setActiveChannel(streamer.username)"
                        >
                            <div class="livestream__card-preview" :class="{ 'is-offline': offlineStreamers[streamer.username] }">
                                <img
                                    :src="streamer.platform === 'youtube' 
                                        ? `https://img.youtube.com/vi/${streamer.youtubeId}/mqdefault.jpg` 
                                        : (offlineStreamers[streamer.username] 
                                            ? `https://api.dicebear.com/7.x/identicon/svg?seed=${streamer.username}` 
                                            : `https://static-cdn.jtvnw.net/previews-ttv/live_user_${streamer.username}-440x248.jpg`)"
                                    :alt="streamer.name"
                                    class="livestream__card-avatar"
                                    @error="handleAvatarError($event, streamer)"
                                />
                                <div class="livestream__card-overlay">
                                    <div class="livestream__play-btn-circle" :style="streamer.platform === 'youtube' ? { background: 'rgba(255, 0, 0, 0.9)' } : {}">
                                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    </div>
                                </div>
                                <span 
                                    class="livestream__card-badge" 
                                    :class="{ 'is-offline-badge': offlineStreamers[streamer.username] }"
                                    :style="streamer.platform === 'youtube' ? { background: '#ff0000' } : {}"
                                >
                                    {{ offlineStreamers[streamer.username] ? 'OFFLINE' : (streamer.platform === 'youtube' ? 'YT LIVE' : 'LIVE') }}
                                </span>
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
                            <path d="M12 22V12" />
                            <path d="M12 12L3.3 7" />
                            <path d="M12 12l8.7-5" />
                        </svg>
                        <p>No streams found matching your criteria. Try searching a different keyword or watch a custom channel.</p>
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
const selectedQuality = ref<string>('hd1080'); // hd1080 (max graphics) by default!
const offlineStreamers = ref<Record<string, boolean>>({});

const selectedGameId = ref<string>('all');
const searchQuery = ref<string>('');
const customChannelInput = ref<string>('');
const showChat = ref<boolean>(true);
const copied = ref<boolean>(false);

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
    
    // Load YouTube IFrame API script when player is initialized
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
        mute: 0,
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
                event.target.playVideo();
                if (qualityParam !== 'default' && event.target.setPlaybackQuality) {
                    event.target.setPlaybackQuality(qualityParam);
                }
                
                // Jump to live edge on ready after a short delay
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
                    // If current time is behind by more than 15 seconds, seek to live
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
        name: '24/7 Music & Esports',
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

// High uptime / popular streamers for fallback/curated grid
const streamers: Streamer[] = [
    // 24/7 Channels (Always Online)
    { name: 'Lofi Girl', username: 'lofigirl', game: '24/7 Music & Esports', gameId: 'always-live', tags: ['Lofi Beats', 'Study', 'Relax', '24/7'], platform: 'twitch' },
    { name: 'Monstercat', username: 'monstercat', game: '24/7 Music & Esports', gameId: 'always-live', tags: ['Electronic', 'Dance', 'Music', '24/7'], platform: 'twitch' },
    { name: 'NoCopyrightSounds', username: 'nocopyrightsounds', game: '24/7 Music & Esports', gameId: 'always-live', tags: ['NCS', 'Bass', 'Music', '24/7'], platform: 'twitch' },
    { name: 'ESL CS2', username: 'esl_csgo', game: '24/7 Music & Esports', gameId: 'always-live', tags: ['CS2', 'Esports', 'Reruns', '24/7'], platform: 'twitch' },
    { name: 'ESL Dota 2', username: 'esl_dota2', game: '24/7 Music & Esports', gameId: 'always-live', tags: ['Dota 2', 'Esports', 'Reruns', '24/7'], platform: 'twitch' },
    
    // YouTube Live Streams (Curated)
    { name: 'Lofi Girl Live (YT)', username: 'lofigirl-yt', game: 'YouTube Live', gameId: 'youtube', tags: ['Music', 'Lofi Beats', 'Chill', 'YouTube'], platform: 'youtube', youtubeId: 'jfKfPfyJRdk' },
    { name: 'Monstercat Radio (YT)', username: 'monstercat-yt', game: 'YouTube Live', gameId: 'youtube', tags: ['Music', 'Electronic', 'Dance', 'YouTube'], platform: 'youtube', youtubeId: '2b4SItX_q9g' },
    { name: 'IGN Gaming (YT)', username: 'ign-yt', game: 'YouTube Live', gameId: 'youtube', tags: ['Gaming', 'News', 'Reviews', 'YouTube'], platform: 'youtube', youtubeId: 'e22e5kym970' },
    { name: 'Space Ambient (YT)', username: 'spaceambient-yt', game: 'YouTube Live', gameId: 'youtube', tags: ['Ambient', 'Chill', 'Space', 'YouTube'], platform: 'youtube', youtubeId: '5wNeQD_dJm4' },

    // Just Chatting
    { name: 'xQc', username: 'xqc', game: 'Just Chatting', gameId: 'just-chatting', tags: ['English', 'IRL', 'Funny'], platform: 'twitch' },
    { name: 'HasanAbi', username: 'hasanabi', game: 'Just Chatting', gameId: 'just-chatting', tags: ['English', 'Politics', 'News'], platform: 'twitch' },
    { name: 'Kai Cenat', username: 'kaicenat', game: 'Just Chatting', gameId: 'just-chatting', tags: ['English', 'IRL', 'Collabs'], platform: 'twitch' },
    { name: 'Pokimane', username: 'pokimane', game: 'Just Chatting', gameId: 'just-chatting', tags: ['English', 'Chilled', 'Reacts'], platform: 'twitch' },
    // League
    { name: 'Faker', username: 'faker', game: 'League of Legends', gameId: 'league', tags: ['Korean', 'Pro Player', 'T1'], platform: 'twitch' },
    { name: 'Doublelift', username: 'doublelift', game: 'League of Legends', gameId: 'league', tags: ['English', 'Co-Stream', 'Analyst'], platform: 'twitch' },
    { name: 'Tyler1', username: 'loltyler1', game: 'League of Legends', gameId: 'league', tags: ['English', 'Climb', 'Rage'], platform: 'twitch' },
    { name: 'OTP LoL', username: 'otplol_', game: 'League of Legends', gameId: 'league', tags: ['French', 'Esports', 'LFL'], platform: 'twitch' },
    // Valorant
    { name: 'Tarik', username: 'tarik', game: 'Valorant', gameId: 'valorant', tags: ['English', 'Watch Party', 'Vct'], platform: 'twitch' },
    { name: 'Shroud', username: 'shroud', game: 'Valorant', gameId: 'valorant', tags: ['English', 'Aim', 'Chill'], platform: 'twitch' },
    { name: 'TenZ', username: 'tenz', game: 'Valorant', gameId: 'valorant', tags: ['English', 'Pro', 'Radiant'], platform: 'twitch' },
    { name: 'Kyedae', username: 'kyedae', game: 'Valorant', gameId: 'valorant', tags: ['English', 'Ranked', 'Friendly'], platform: 'twitch' },
    // GTA V
    { name: 'Buddha', username: 'buddha', game: 'Grand Theft Auto V', gameId: 'gta-v', tags: ['English', 'NoPixel', 'Roleplay'], platform: 'twitch' },
    { name: 'Sykkuno', username: 'sykkuno', game: 'Grand Theft Auto V', gameId: 'gta-v', tags: ['English', 'Co-op', 'Wholesome'], platform: 'twitch' },
    { name: 'Lord Kebun', username: 'lord_kebun', game: 'Grand Theft Auto V', gameId: 'gta-v', tags: ['English', 'NoPixel', 'RP'], platform: 'twitch' },
    // Minecraft
    { name: 'Tubbo', username: 'tubbo', game: 'Minecraft', gameId: 'minecraft', tags: ['English', 'SMP', 'Multiplayer'], platform: 'twitch' },
    { name: 'Ranboo', username: 'ranboolive', game: 'Minecraft', gameId: 'minecraft', tags: ['English', 'RP', 'Interactive'], platform: 'twitch' },
    { name: 'CaptainSparklez', username: 'captainsparklez', game: 'Minecraft', gameId: 'minecraft', tags: ['English', 'Mods', 'Classic'], platform: 'twitch' },
    // Fortnite
    { name: 'Ninja', username: 'ninja', game: 'Fortnite', gameId: 'fortnite', tags: ['English', 'Classic', 'FPS'], platform: 'twitch' },
    { name: 'Clix', username: 'clix', game: 'Fortnite', gameId: 'fortnite', tags: ['English', 'Wagers', 'Ranked'], platform: 'twitch' },
    { name: 'SypherPK', username: 'sypherpk', game: 'Fortnite', gameId: 'fortnite', tags: ['English', 'Guides', 'Updates'], platform: 'twitch' },
    // CS2
    { name: 'Gaules', username: 'gaules', game: 'Counter-Strike 2', gameId: 'cs2', tags: ['Portuguese', 'Esports', 'Tribo'], platform: 'twitch' },
    { name: 'ohnePixel', username: 'ohnepixel', game: 'Counter-Strike 2', gameId: 'cs2', tags: ['English', 'Skins', 'Cases'], platform: 'twitch' },
    { name: 's1mple', username: 's1mple', game: 'Counter-Strike 2', gameId: 'cs2', tags: ['Ukrainian', 'Pro', 'Aim'], platform: 'twitch' },
    // Dota 2
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

// Computed Hostname for Twitch embeds
const currentHostname = computed(() => {
    if (typeof window !== 'undefined') {
        return window.location.hostname;
    }
    return 'localhost';
});

// Embedded Player & Chat URLs
const playerUrl = computed(() => {
    if (activePlatform.value === 'youtube') {
        const qualityParam = selectedQuality.value !== 'auto' ? `&vq=${selectedQuality.value}` : '';
        if (activeYoutubeId.value.startsWith('UC') && activeYoutubeId.value.length === 24) {
            return `https://www.youtube.com/embed/live_stream?channel=${activeYoutubeId.value}&autoplay=1&mute=0${qualityParam}`;
        }
        return `https://www.youtube.com/embed/${activeYoutubeId.value}?autoplay=1&mute=0${qualityParam}`;
    }
    return `https://player.twitch.tv/?channel=${activeChannel.value}&parent=${currentHostname.value}&muted=false`;
});

const chatUrl = computed(() => {
    if (activePlatform.value === 'youtube') {
        if (activeYoutubeId.value.startsWith('UC') && activeYoutubeId.value.length === 24) {
            // Cannot embed YouTube chat for general live_stream channel URL
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

// Filtering logic
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

    // Sort: Online first (or YouTube which we assume always active), then Offline
    return [...result].sort((a, b) => {
        const aOffline = offlineStreamers.value[a.username] ? 1 : 0;
        const bOffline = offlineStreamers.value[b.username] ? 1 : 0;
        return aOffline - bOffline;
    });
});

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
        // Fallback
        activeChannel.value = username;
        activePlatform.value = 'twitch';
        activeYoutubeId.value = '';
    }

    if (activePlatform.value === 'twitch') {
        void checkSingleTwitchStream(activeChannel.value);
    }

    // Scroll to player smoothly after DOM updates
    nextTick(() => {
        const playerEl = document.querySelector('.livestream__theater');
        if (playerEl) {
            playerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });
}

function watchCustomChannel() {
    const input = customChannelInput.value.trim();
    if (!input) return;

    // Detect YouTube URL formats first (regardless of dropdown value)
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
        // No YouTube URL match, fall back to selected platform
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
            // Check if input looks like a YouTube ID (11 chars)
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
    
    // Scroll to player
    setTimeout(() => {
        const playerEl = document.querySelector('.livestream__theater');
        if (playerEl) {
            playerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
}

function toggleChat() {
    showChat.value = !showChat.value;
}

function copyStreamLink() {
    if (typeof window !== 'undefined') {
        const queryParams = activePlatform.value === 'youtube' 
            ? `platform=youtube&ytId=${activeYoutubeId.value}`
            : `channel=${activeChannel.value}`;
        const link = `${window.location.origin}/livestream?${queryParams}`;
        
        navigator.clipboard.writeText(link).then(() => {
            copied.value = true;
            setTimeout(() => {
                copied.value = false;
            }, 2000);
        });
    }
}

// Handle fallback if avatar / preview fails to load (e.g. offline)
function handleAvatarError(event: Event, streamer: Streamer) {
    const img = event.target as HTMLImageElement;
    if (streamer.platform === 'youtube') {
        img.src = `https://api.dicebear.com/7.x/initials/svg?seed=${streamer.name}&backgroundColor=ff5a1f`;
    } else {
        offlineStreamers.value[streamer.username] = true;
        img.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${streamer.username}`;
    }
}

// Helper to parse default Youtube stream configuration
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
        // Assume direct ID
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

// Watch settings changes dynamically
watch(youtubeStreams, (enabled) => {
    if (!enabled && activePlatform.value === 'youtube') {
        // Fallback to Twitch Lofi Girl if YouTube option gets disabled
        setActiveChannel(streamers[0].username);
    }
});

// Watch for administrative default YouTube stream loading
watch(defaultYoutubeStream, (newVal) => {
    if (!route.query.channel && !route.query.ytId && youtubeStreams.value) {
        const isDefaultCurrentlyPlaying = activeChannel.value === streamers[0].username || !activeChannel.value;
        if (isDefaultCurrentlyPlaying && newVal) {
            playDefaultYoutubeLink(newVal);
        }
    }
});

// Watch for YouTube player activation/changes
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

function loadInitialStream() {
    // Check if channel passed in URL queries
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
            // Fallback to Lofi Girl
            setActiveChannel(streamers[0].username);
        }
    }
}

onMounted(async () => {
    document.title = 'Livestream — Moovie';
    
    // Wait for settings to load
    await loadGlobalSettings();

    // Check live status of Twitch streams immediately and periodically
    void checkAllTwitchStreams();
    checkInterval = setInterval(() => {
        void checkAllTwitchStreams();
    }, 60000);

    // Load default or query-specified stream immediately on mount
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
.livestream {
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    &__main {
        padding: var(--s-6) 0 var(--s-10);
    }

    &__head {
        margin-bottom: var(--s-8);
    }

    &__title {
        margin: var(--s-2) 0;
        font-size: clamp(2.25rem, 6vw, 3.5rem);
        background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: 800;
        letter-spacing: -0.04em;
    }

    &__lede {
        max-width: 44rem;
        color: var(--bone-300);
        font-size: var(--fs-md);
        line-height: 1.6;
    }

    // Theater Mode Styles
    &__theater {
        margin-bottom: var(--s-8);
        border-radius: var(--r-xl);
        overflow: hidden;
        border: 1px solid var(--rule-strong);
        background: var(--ink-950);
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
    }

    &__theater-container {
        display: grid;
        grid-template-columns: 1fr 340px;
        background: #090807;

        @media (max-width: 1024px) {
            grid-template-columns: 1fr;
        }

        &.chat-collapsed {
            grid-template-columns: 1fr;
        }
    }

    &__video-wrapper {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 9;
        background: #000;
    }

    &__video-frame {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
    }

    &__chat-wrapper {
        border-left: 1px solid var(--rule-strong);
        height: 100%;
        width: 340px;
        background: #0c0b0a;

        @media (max-width: 1024px) {
            width: 100%;
            height: 400px;
            border-left: none;
            border-top: 1px solid var(--rule-strong);
        }
    }

    &__chat-frame {
        width: 100%;
        height: 100%;
    }

    &__chat-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--s-3);
        height: 100%;
        padding: var(--s-6);
        text-align: center;
        color: var(--bone-400);

        svg {
            color: var(--bone-600);
        }

        p {
            font-size: var(--fs-xs);
            line-height: 1.4;
            margin: 0;
        }
    }

    &__meta-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-4);
        padding: var(--s-4) var(--s-6);
        background: var(--ink-850);
        border-top: 1px solid var(--rule-strong);

        @media (max-width: 768px) {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--s-4);
        }
    }

    &__quality-control {
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-width: 140px;

        @media (max-width: 768px) {
            width: 100%;
        }
    }

    &__quality-select-wrapper {
        position: relative;
        width: 100%;
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
        font-size: var(--fs-xs);
        cursor: pointer;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23a79f8d' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.65rem center;
        outline: none;
        transition: border-color var(--dur-fast) var(--ease-out);

        &:focus:not(:disabled) {
            border-color: #8b5cf6;
        }

        &:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
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
        width: 44px;
        height: 44px;
        border-radius: var(--r-pill);
        background: linear-gradient(135deg, #a855f7, #6366f1);
        color: #fff;
        font-weight: 700;
        font-size: var(--fs-md);
        box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
    }

    &__streamer-name {
        font-weight: 600;
        font-size: var(--fs-md);
        color: var(--bone-50);
        display: flex;
        align-items: center;
        gap: var(--s-2);
    }

    &__live-badge {
        font-size: 0.65rem;
        font-weight: 800;
        color: #fff;
        background: var(--danger);
        padding: 2px 6px;
        border-radius: var(--r-xs);
        letter-spacing: 0.05em;
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;

        &--offline {
            background: var(--ink-600) !important;
            color: var(--bone-300) !important;
            border: 1px solid var(--rule-strong);
            animation: none !important;
        }
    }

    &__streamer-sub {
        font-size: var(--fs-xs);
        color: var(--bone-400);
        margin-top: 2px;
    }

    &__actions {
        display: flex;
        align-items: center;
        gap: var(--s-3);

        @media (max-width: 768px) {
            width: 100%;
            justify-content: flex-start;
        }
    }

    &__action-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        padding: var(--s-2) var(--s-4);
        border-radius: var(--r-md);
        border: 1px solid var(--rule-strong);
        background: var(--ink-800);
        color: var(--bone-200);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        font-weight: 500;
        cursor: pointer;
        transition: all var(--dur-fast) var(--ease-out);

        &:hover {
            color: var(--bone-50);
            background: var(--surface-tint);
            border-color: var(--bone-400);
        }

        &--twitch {
            background: #9146FF;
            color: #fff;
            border-color: #9146FF;

            &:hover {
                background: #772ce8;
                border-color: #772ce8;
                color: #fff;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(145, 70, 255, 0.3);
            }
        }

        &--youtube {
            background: #FF0000;
            color: #fff;
            border-color: #FF0000;

            &:hover {
                background: #cc0000;
                border-color: #cc0000;
                color: #fff;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(255, 0, 0, 0.3);
            }
        }
    }

    // Filter Section
    &__filters {
        display: flex;
        flex-direction: column;
        gap: var(--s-5);
        margin-bottom: var(--s-8);
        padding: var(--s-5);
        background: var(--ink-850);
        border-radius: var(--r-lg);
        border: 1px solid var(--rule-strong);
    }

    &__games-nav {
        display: flex;
        gap: var(--s-3);
        overflow-x: auto;
        padding-bottom: var(--s-2);
        scrollbar-width: thin;
        scrollbar-color: var(--rule-strong) transparent;

        &::-webkit-scrollbar {
            height: 6px;
        }

        &::-webkit-scrollbar-track {
            background: transparent;
        }

        &::-webkit-scrollbar-thumb {
            background: var(--rule-strong);
            border-radius: var(--r-pill);
        }
    }

    &__game-tab {
        display: flex;
        align-items: center;
        gap: var(--s-3);
        flex-shrink: 0;
        padding: var(--s-2) var(--s-4) var(--s-2) var(--s-2);
        border-radius: var(--r-md);
        border: 1px solid var(--rule-strong);
        background: var(--ink-800);
        color: var(--bone-300);
        cursor: pointer;
        transition: all var(--dur-fast) var(--ease-out);

        &:hover {
            border-color: var(--bone-400);
            color: var(--bone-50);
            background: var(--surface-tint);
        }

        &.is-active {
            background: linear-gradient(135deg, rgba(#a855f7, 0.15) 0%, rgba(#6366f1, 0.15) 100%);
            border-color: #8b5cf6;
            color: var(--bone-50);
            box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);
        }
    }

    &__game-boxart {
        width: 32px;
        height: 42px;
        object-fit: cover;
        border-radius: var(--r-xs);
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    &__game-tab-title {
        font-family: var(--font-ui);
        font-weight: 600;
        font-size: var(--fs-xs);
    }

    &__search-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--s-4);

        @media (max-width: 768px) {
            grid-template-columns: 1fr;
        }
    }

    &__search-field {
        position: relative;
        display: flex;
        align-items: center;
    }

    &__search-icon {
        position: absolute;
        left: var(--s-4);
        color: var(--bone-500);
        pointer-events: none;
        width: 18px;
        height: 18px;
    }

    &__input {
        width: 100%;
        min-height: 2.75rem;
        padding: 0 var(--s-4) 0 2.75rem;
        border-radius: var(--r-md);
        border: 1px solid var(--rule-strong);
        background: var(--ink-800);
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        transition: all var(--dur-fast) var(--ease-out);

        &:focus {
            outline: none;
            border-color: #8b5cf6;
            box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.25);
            background: var(--ink-750);
        }

        &::placeholder {
            color: var(--bone-500);
        }
    }

    &__custom-form {
        display: flex;
        gap: var(--s-2);

        .livestream__input {
            padding-left: var(--s-4);
        }
    }

    &__platform-select {
        min-height: 2.75rem;
        padding: 0 var(--s-3);
        border-radius: var(--r-md);
        border: 1px solid var(--rule-strong);
        background: var(--ink-800);
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        cursor: pointer;
        outline: none;
        transition: border-color var(--dur-fast) var(--ease-out);

        &:focus {
            border-color: #8b5cf6;
        }
    }

    &__btn-primary {
        min-height: 2.75rem;
        padding: 0 var(--s-6);
        border-radius: var(--r-md);
        background: linear-gradient(135deg, #a855f7, #6366f1);
        color: #fff;
        font-family: var(--font-ui);
        font-weight: 600;
        font-size: var(--fs-sm);
        border: none;
        cursor: pointer;
        transition: all var(--dur-fast) var(--ease-out);
        box-shadow: 0 4px 12px rgba(168, 85, 247, 0.2);

        &:hover {
            opacity: 0.9;
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(168, 85, 247, 0.3);
        }

        &:active {
            transform: translateY(0);
        }
    }

    // Grid section
    &__section-title {
        font-size: var(--fs-lg);
        font-weight: 700;
        margin-bottom: var(--s-5);
        color: var(--bone-100);
        letter-spacing: -0.02em;
    }

    &__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: var(--s-5);
    }

    &__card {
        background: var(--ink-850);
        border-radius: var(--r-lg);
        border: 1px solid var(--rule-strong);
        overflow: hidden;
        cursor: pointer;
        transition: all var(--dur-fast) var(--ease-out);

        &:hover {
            transform: translateY(-4px);
            border-color: #8b5cf6;
            box-shadow: 0 12px 24px rgba(0, 0, 0, 0.35);

            .livestream__card-overlay {
                opacity: 1;
            }

            .livestream__card-avatar {
                transform: scale(1.05);
            }
        }

        &.is-playing {
            border-color: #8b5cf6;
            background: linear-gradient(180deg, var(--ink-850) 0%, rgba(#8b5cf6, 0.08) 100%);
            box-shadow: 0 0 0 2px #8b5cf6;
        }

        &--yt {
            &:hover {
                border-color: #ff0000;
                box-shadow: 0 12px 24px rgba(255, 0, 0, 0.15);
            }
            &.is-playing {
                border-color: #ff0000;
                background: linear-gradient(180deg, var(--ink-850) 0%, rgba(#ff0000, 0.04) 100%);
                box-shadow: 0 0 0 2px #ff0000;
            }
        }
    }

    &__card-preview {
        position: relative;
        aspect-ratio: 16 / 9;
        background: var(--ink-950);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity var(--dur-fast) var(--ease-out);

        &.is-offline {
            opacity: 0.55;
            
            .livestream__card-avatar {
                opacity: 0.5;
            }
        }
    }

    &__card-avatar {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform var(--dur-base) var(--ease-out);
        opacity: 0.85;
    }

    &__card-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity var(--dur-fast) var(--ease-out);
    }

    &__play-btn-circle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 50px;
        height: 50px;
        border-radius: var(--r-pill);
        background: rgba(#8b5cf6, 0.9);
        color: #fff;
        box-shadow: 0 8px 20px rgba(139, 92, 246, 0.4);
    }

    &__card-badge {
        position: absolute;
        top: var(--s-3);
        left: var(--s-3);
        font-size: 0.6rem;
        font-weight: 800;
        background: var(--danger);
        color: #fff;
        padding: 2px 6px;
        border-radius: var(--r-xs);
        letter-spacing: 0.05em;

        &.is-offline-badge {
            background: var(--ink-600) !important;
            color: var(--bone-300) !important;
            border: 1px solid var(--rule-strong);
        }
    }

    &__card-info {
        padding: var(--s-4);
    }

    &__card-name {
        font-size: var(--fs-md);
        font-weight: 600;
        color: var(--bone-50);
        margin-bottom: 2px;
    }

    &__card-game {
        font-size: var(--fs-xs);
        color: var(--bone-400);
        margin-bottom: var(--s-3);
    }

    &__card-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    &__tag {
        font-size: 0.65rem;
        font-weight: 500;
        background: var(--ink-800);
        color: var(--bone-300);
        padding: 2px 8px;
        border-radius: var(--r-pill);
        border: 1px solid var(--rule-strong);
    }

    &__empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--s-4);
        padding: var(--s-10) var(--s-6);
        text-align: center;
        border-radius: var(--r-lg);
        border: 1px dashed var(--rule-strong);
        background: var(--ink-850);
        color: var(--bone-300);

        svg {
            color: var(--bone-500);
        }
    }
}

@keyframes pulse {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: .6;
    }
}
</style>
