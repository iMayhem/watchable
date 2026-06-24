<template>
    <div class="livestream">
        <SiteHeader />

        <main id="main" class="livestream__main" role="main">
            <section class="livestream__body container-lm">

                <!-- Theater View (Active Stream Player) -->
                <div v-if="activeVideoId" class="livestream__theater">
                    <div class="livestream__theater-container" :class="{ 'chat-collapsed': !showChat }">
                        <div class="livestream__video-wrapper">
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
                                <p>Chat unavailable for this stream.</p>
                            </div>
                        </div>
                    </div>

                    <!-- Stream Details -->
                    <div class="livestream__meta-bar">
                        <div class="livestream__streamer-info">
                            <img
                                v-if="activeStream?.channelThumb"
                                :src="activeStream.channelThumb"
                                class="livestream__avatar-img"
                                :alt="activeStream.channelTitle"
                            />
                            <div v-else class="livestream__avatar" style="background: linear-gradient(135deg, #ff0000, #b30000)">
                                {{ activeStream?.channelTitle?.charAt(0)?.toUpperCase() }}
                            </div>
                            <div>
                                <div class="livestream__streamer-name">
                                    {{ activeStream?.channelTitle || 'YouTube Live' }}
                                    <span class="livestream__live-badge">LIVE</span>
                                </div>
                                <div class="livestream__streamer-sub">{{ activeStream?.title }}</div>
                            </div>
                        </div>

                        <div class="livestream__meta-right">
                            <!-- Viewer count -->
                            <div v-if="activeStream?.viewerCount" class="livestream__viewer-count">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                                {{ formatViewers(activeStream.viewerCount) }} watching
                            </div>

                            <!-- Quality -->
                            <div class="livestream__quality-control">
                                <label style="color: var(--bone-400); font-size: 0.65rem; display: block; margin-bottom: 4px;">Quality</label>
                                <div class="livestream__quality-select-wrapper">
                                    <select v-model="selectedQuality" class="livestream__quality-select" title="Change stream quality">
                                        <option value="hd1080">1080p</option>
                                        <option value="hd720">720p</option>
                                        <option value="large">480p</option>
                                        <option value="medium">360p</option>
                                        <option value="auto">Auto</option>
                                    </select>
                                </div>
                            </div>

                            <div class="livestream__actions">
                                <button @click="toggleChat" class="livestream__action-btn">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                    {{ showChat ? 'Hide Chat' : 'Show Chat' }}
                                </button>
                                <a :href="`https://youtube.com/watch?v=${activeVideoId}`" target="_blank" rel="noopener noreferrer" class="livestream__action-btn livestream__action-btn--youtube">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                                    Open on YouTube
                                </a>
                            </div>
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
                            :class="{ 'is-active': selectedCategory === cat.id }"
                            @click="selectCategory(cat.id)"
                        >
                            <span class="livestream__game-tab-emoji">{{ cat.emoji }}</span>
                            <span class="livestream__game-tab-title">{{ cat.name }}</span>
                        </button>
                    </div>

                    <!-- Search and custom stream -->
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
                                placeholder="Search live streams..."
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
                            <button type="submit" class="livestream__btn-primary">Watch</button>
                        </form>
                    </div>
                </div>

                <!-- Channels Grid -->
                <div class="livestream__grid-section">
                    <div class="livestream__section-header">
                        <h2 class="livestream__section-title">
                            {{ selectedCategoryName }} Live Streams
                            <span class="livestream__count" v-if="!loading && streams.length">{{ filteredStreams.length }} live</span>
                        </h2>
                        <button @click="fetchStreams" class="livestream__refresh-btn" :class="{ 'is-loading': loading }" title="Refresh streams">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                            </svg>
                            Refresh
                        </button>
                    </div>

                    <!-- Loading skeleton -->
                    <div v-if="loading" class="livestream__grid">
                        <div v-for="i in 12" :key="i" class="livestream__card livestream__card--skeleton">
                            <div class="livestream__card-preview skeleton-box"></div>
                            <div class="livestream__card-info">
                                <div class="skeleton-line" style="width:80%"></div>
                                <div class="skeleton-line" style="width:55%; margin-top:6px"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Error -->
                    <div v-else-if="error" class="livestream__empty">
                        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <p>{{ error }}</p>
                        <button @click="fetchStreams" class="livestream__btn-primary">Try Again</button>
                    </div>

                    <!-- Streams grid -->
                    <div v-else-if="filteredStreams.length" class="livestream__grid">
                        <div
                            v-for="stream in filteredStreams"
                            :key="stream.videoId"
                            class="livestream__card livestream__card--yt"
                            :class="{ 'is-playing': activeVideoId === stream.videoId }"
                            @click="playStream(stream)"
                        >
                            <div class="livestream__card-preview">
                                <img
                                    :src="stream.thumbnail"
                                    :alt="stream.title"
                                    class="livestream__card-avatar"
                                    loading="lazy"
                                />
                                <div class="livestream__card-overlay">
                                    <div class="livestream__play-btn-circle" style="background: rgba(255,0,0,0.9)">
                                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                    </div>
                                </div>
                                <span class="livestream__card-badge" style="background:#ff0000">LIVE</span>
                                <span v-if="stream.viewerCount" class="livestream__card-viewers">
                                    <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                                    {{ formatViewers(stream.viewerCount) }}
                                </span>
                            </div>

                            <div class="livestream__card-info">
                                <h3 class="livestream__card-name">{{ stream.title }}</h3>
                                <p class="livestream__card-game">{{ stream.channelTitle }}</p>
                                <p v-if="stream.gameName" class="livestream__card-category">{{ stream.gameName }}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Empty -->
                    <div v-else class="livestream__empty">
                        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        </svg>
                        <p>No live streams found for this category right now.</p>
                        <button @click="fetchStreams" class="livestream__btn-primary">Refresh</button>
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

const YT_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string;

interface LiveStream {
    videoId: string;
    title: string;
    channelTitle: string;
    channelId: string;
    channelThumb?: string;
    thumbnail: string;
    viewerCount?: string;
    gameName?: string;
    categoryId?: string;
}

interface Category {
    id: string;
    name: string;
    emoji: string;
    query: string;
}

// State
const activeVideoId = ref<string>('');
const activeStream = ref<LiveStream | null>(null);
const streams = ref<LiveStream[]>([]);
const loading = ref(false);
const error = ref('');
const selectedCategory = ref('gaming');
const searchQuery = ref('');
const customChannelInput = ref('');
const showChat = ref(true);
const selectedQuality = ref('hd1080');

let ytPlayer: any = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const route = useRoute();
const { defaultYoutubeStream } = getSettings();

// Categories
const categories: Category[] = [
    { id: 'gaming',       name: 'All Gaming',      emoji: '🎮', query: 'pc gaming live stream english' },
    { id: 'fps',          name: 'CS2 / Valorant',  emoji: '🔫', query: 'cs2 counter strike valorant fps live stream english' },
    { id: 'battle_royale',name: 'Battle Royale',   emoji: '🪂', query: 'warzone apex legends pubg battlegrounds pc live stream' },
    { id: 'openworld',    name: 'Open World / RPG',emoji: '🗺️',  query: 'elden ring cyberpunk gta red dead redemption witcher pc live stream' },
    { id: 'moba',         name: 'MOBA',            emoji: '⚔️',  query: 'league of legends dota 2 live stream english pro' },
    { id: 'esports',      name: 'Esports',         emoji: '🏆', query: 'cs2 valorant esports tournament championship live english' },
    { id: 'simulation',   name: 'Sim / Strategy',  emoji: '🏙️',  query: 'cities skylines factorio total war civilization 6 pc live stream' },
    { id: 'music',        name: '24/7 Music',      emoji: '🎵', query: 'lofi hip hop music 24/7 live radio chill' },
];

// Computed
const selectedCategoryName = computed(() => {
    return categories.find(c => c.id === selectedCategory.value)?.name ?? 'Gaming';
});

const currentHostname = computed(() => {
    if (typeof window !== 'undefined') return window.location.hostname;
    return 'localhost';
});

const chatUrl = computed(() => {
    if (!activeVideoId.value) return '';
    return `https://www.youtube.com/live_chat?v=${activeVideoId.value}&embed_domain=${currentHostname.value}`;
});

const filteredStreams = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return streams.value;
    return streams.value.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.channelTitle.toLowerCase().includes(q) ||
        (s.gameName ?? '').toLowerCase().includes(q)
    );
});

// YouTube Data API v3 fetch
async function fetchStreams() {
    loading.value = true;
    error.value = '';

    const cat = categories.find(c => c.id === selectedCategory.value);
    const q = encodeURIComponent(cat?.query ?? 'gaming live stream');

    try {
        // Search for live streams
        const searchRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&eventType=live&q=${q}&maxResults=24&relevanceLanguage=en&regionCode=US&order=viewCount&key=${YT_API_KEY}`
        );
        if (!searchRes.ok) {
            const errBody = await searchRes.json();
            throw new Error(errBody?.error?.message ?? 'YouTube API error');
        }
        const searchData = await searchRes.json();
        const items = searchData.items ?? [];

        if (!items.length) {
            streams.value = [];
            loading.value = false;
            return;
        }

        const videoIds = items.map((i: any) => i.id.videoId).join(',');

        // Fetch video details for concurrent viewer counts
        const detailsRes = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,snippet&id=${videoIds}&key=${YT_API_KEY}`
        );
        const detailsData = await detailsRes.json();
        const detailsMap: Record<string, any> = {};
        for (const v of (detailsData.items ?? [])) {
            detailsMap[v.id] = v;
        }

        const mapped: LiveStream[] = items.map((item: any) => {
            const videoId = item.id.videoId;
            const snippet = item.snippet;
            const details = detailsMap[videoId];
            const viewerCount = details?.liveStreamingDetails?.concurrentViewers ?? '';
            const thumb =
                snippet.thumbnails?.maxres?.url ||
                snippet.thumbnails?.high?.url ||
                snippet.thumbnails?.medium?.url ||
                `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

            return {
                videoId,
                title: snippet.title,
                channelTitle: snippet.channelTitle,
                channelId: snippet.channelId,
                thumbnail: thumb,
                viewerCount,
                gameName: '',
            } as LiveStream;
        });

        // Sort by concurrent viewers descending (most popular first)
        streams.value = mapped.sort((a, b) => {
            const va = parseInt(String(a.viewerCount || '0'), 10);
            const vb = parseInt(String(b.viewerCount || '0'), 10);
            return vb - va;
        });

        // Auto-play first if none active
        if (!activeVideoId.value && streams.value.length) {
            playStream(streams.value[0]);
        }
    } catch (e: any) {
        console.error(e);
        error.value = e?.message ?? 'Failed to load live streams. Check your API key.';
    } finally {
        loading.value = false;
    }
}

function selectCategory(id: string) {
    selectedCategory.value = id;
    streams.value = [];
    activeVideoId.value = '';
    activeStream.value = null;
    fetchStreams();
}

function playStream(stream: LiveStream) {
    activeVideoId.value = stream.videoId;
    activeStream.value = stream;
    nextTick(() => {
        initYoutubePlayer(stream.videoId);
        const el = document.querySelector('.livestream__theater');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

// YouTube IFrame Player
function loadYoutubeApi() {
    if (typeof window === 'undefined') return;
    if ((window as any).YT && (window as any).YT.Player) return;
    if (document.querySelector('script[src*="youtube.com/iframe_api"]')) return;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
}

function initYoutubePlayer(videoId: string) {
    if (typeof window === 'undefined') return;

    const tryInit = () => {
        if (!(window as any).YT?.Player) {
            setTimeout(tryInit, 100);
            return;
        }

        if (ytPlayer) {
            try { ytPlayer.loadVideoById(videoId); return; } catch {}
        }

        const el = document.getElementById('youtube-player');
        if (!el) return;

        ytPlayer = new (window as any).YT.Player('youtube-player', {
            height: '100%',
            width: '100%',
            videoId,
            playerVars: {
                autoplay: 1,
                mute: 1,
                rel: 0,
                modestbranding: 1,
                origin: window.location.origin,
            },
            events: {
                onReady: (event: any) => {
                    event.target.mute();
                    event.target.playVideo();
                    if (selectedQuality.value !== 'auto') {
                        event.target.setPlaybackQuality?.(selectedQuality.value);
                    }
                },
            },
        });
    };

    tryInit();
}

function watchCustomChannel() {
    const input = customChannelInput.value.trim();
    if (!input) return;

    const ytVideoReg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
    const ytLiveReg = /(?:youtube\.com\/live\/)([^"&?\/ ]{11})/;

    const videoMatch = input.match(ytVideoReg);
    const liveMatch = input.match(ytLiveReg);
    const rawId = /^[a-zA-Z0-9_-]{11}$/.test(input) ? input : null;

    const videoId = videoMatch?.[1] ?? liveMatch?.[1] ?? rawId;
    if (!videoId) return;

    const fakeStream: LiveStream = {
        videoId,
        title: 'Custom Stream',
        channelTitle: 'YouTube Live',
        channelId: '',
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
    customChannelInput.value = '';
    playStream(fakeStream);
}

function toggleChat() {
    showChat.value = !showChat.value;
}

function formatViewers(count: string | number): string {
    const n = typeof count === 'string' ? parseInt(count, 10) : count;
    if (isNaN(n)) return '';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString();
}

function parseYoutubeId(input: string): string {
    const ytVideoReg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
    const ytLiveReg = /(?:youtube\.com\/live\/)([^"&?\/ ]{11})/;
    const v = input.match(ytVideoReg);
    if (v) return v[1];
    const l = input.match(ytLiveReg);
    if (l) return l[1];
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    return '';
}

watch(selectedQuality, (q) => {
    if (ytPlayer?.setPlaybackQuality) {
        ytPlayer.setPlaybackQuality(q === 'auto' ? 'default' : q);
    }
});

onMounted(async () => {
    document.title = 'Livestream — Moovie';
    await loadGlobalSettings();
    loadYoutubeApi();

    if (route.query.ytId) {
        const videoId = String(route.query.ytId);
        const fakeStream: LiveStream = {
            videoId,
            title: 'YouTube Live',
            channelTitle: 'YouTube Live',
            channelId: '',
            thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        };
        playStream(fakeStream);
    } else if (defaultYoutubeStream.value) {
        const id = parseYoutubeId(defaultYoutubeStream.value);
        if (id) {
            const fakeStream: LiveStream = {
                videoId: id,
                title: 'Admin Recommended',
                channelTitle: 'YouTube Live',
                channelId: '',
                thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
            };
            playStream(fakeStream);
        }
    }

    await fetchStreams();

    // Auto-refresh every 3 minutes
    refreshTimer = setInterval(fetchStreams, 3 * 60 * 1000);
});

onUnmounted(() => {
    if (ytPlayer) {
        try { ytPlayer.destroy(); } catch {}
        ytPlayer = null;
    }
    if (refreshTimer) clearInterval(refreshTimer);
});
</script>

<style scoped lang="scss">
.livestream {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--ink-950);

    &__main {
        flex: 1;
        padding-top: var(--header-h, 64px);
    }

    &__body {
        padding: var(--s-6) var(--s-4);
        max-width: 1400px;
        margin: 0 auto;
    }

    // ── Theater ────────────────────────────────────────────────────────────
    &__theater {
        margin-bottom: var(--s-6);
        border-radius: var(--r-lg);
        overflow: hidden;
        border: 1px solid var(--rule-strong);
        background: var(--ink-950);
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    }

    &__theater-container {
        display: grid;
        grid-template-columns: 1fr 340px;
        height: clamp(360px, 52vw, 600px);

        &.chat-collapsed {
            grid-template-columns: 1fr;
        }
    }

    &__video-wrapper {
        position: relative;
        background: #000;
        min-width: 0;
    }

    &__video-frame {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: none;
    }

    &__chat-wrapper {
        border-left: 1px solid var(--rule-strong);
        background: #0c0b0a;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    &__chat-frame {
        width: 100%;
        height: 100%;
        border: none;
        flex: 1;
    }

    &__chat-placeholder {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--s-3);
        color: var(--bone-500);
        font-size: 0.82rem;
        text-align: center;
        padding: var(--s-4);
    }

    // ── Meta bar ───────────────────────────────────────────────────────────
    &__meta-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--s-3);
        padding: var(--s-3) var(--s-5);
        background: var(--ink-850);
        border-top: 1px solid var(--rule-strong);
    }

    &__streamer-info {
        display: flex;
        align-items: center;
        gap: var(--s-3);
        min-width: 0;
        flex: 1;
    }

    &__avatar-img {
        width: 40px;
        height: 40px;
        border-radius: var(--r-pill);
        object-fit: cover;
        flex-shrink: 0;
    }

    &__avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: var(--r-pill);
        color: #fff;
        font-weight: 700;
        font-size: 1rem;
        flex-shrink: 0;
    }

    &__streamer-name {
        font-weight: 600;
        font-size: 1rem;
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
        padding: 2px 5px;
        border-radius: var(--r-xs);
        letter-spacing: 0.06em;
    }

    &__streamer-sub {
        font-size: 0.73rem;
        color: var(--bone-400);
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 400px;
    }

    &__meta-right {
        display: flex;
        align-items: center;
        gap: var(--s-4);
        flex-shrink: 0;
        flex-wrap: wrap;
    }

    &__viewer-count {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 0.78rem;
        color: var(--bone-300);
        font-weight: 500;
    }

    &__quality-control {
        display: flex;
        flex-direction: column;
    }

    &__quality-select-wrapper {
        position: relative;
    }

    &__quality-select {
        min-height: 2.25rem;
        padding: 0 var(--s-7) 0 var(--s-3);
        border-radius: var(--r-md);
        border: 1px solid var(--rule-strong);
        background: var(--ink-800);
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: 0.8rem;
        cursor: pointer;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23a79f8d' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.65rem center;
        outline: none;

        &:focus { border-color: #ff4444; }
    }

    &__actions {
        display: flex;
        align-items: center;
        gap: var(--s-2);
    }

    &__action-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        min-height: 2.25rem;
        padding: 0 var(--s-4);
        border-radius: var(--r-md);
        border: 1px solid var(--rule-strong);
        background: var(--ink-800);
        color: var(--bone-200);
        font-family: var(--font-ui);
        font-size: 0.8rem;
        font-weight: 500;
        cursor: pointer;
        text-decoration: none;
        transition: background 0.15s, border-color 0.15s;

        &:hover { background: var(--ink-700); border-color: var(--bone-500); }

        &--youtube {
            border-color: rgba(255, 0, 0, 0.4);
            color: #ff4444;
            &:hover { background: rgba(255, 0, 0, 0.1); border-color: #ff0000; }
        }
    }

    // ── Filters ────────────────────────────────────────────────────────────
    &__filters {
        display: flex;
        flex-direction: column;
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
        &::-webkit-scrollbar { display: none; }
    }

    &__game-tab {
        display: flex;
        align-items: center;
        gap: var(--s-2);
        flex-shrink: 0;
        padding: 7px 14px;
        border-radius: var(--r-md);
        border: 1px solid var(--rule-strong);
        background: var(--ink-800);
        color: var(--bone-300);
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s, color 0.15s;

        &:hover { background: var(--ink-700); }

        &.is-active {
            background: rgba(255, 0, 0, 0.12);
            border-color: #ff4444;
            color: var(--bone-50);
        }
    }

    &__game-tab-emoji { font-size: 1rem; }

    &__game-tab-title {
        font-family: var(--font-ui);
        font-weight: 600;
        font-size: 0.75rem;
        white-space: nowrap;
    }

    &__search-row {
        display: grid;
        grid-template-columns: 1fr 1.4fr;
        gap: var(--s-3);
    }

    &__search-field {
        position: relative;
        display: flex;
        align-items: center;
    }

    &__search-icon {
        position: absolute;
        left: 12px;
        color: var(--bone-500);
        pointer-events: none;
        width: 16px;
        height: 16px;
    }

    &__input {
        width: 100%;
        min-height: 2.5rem;
        padding: 0 var(--s-4);
        border-radius: var(--r-md);
        border: 1px solid var(--rule-strong);
        background: var(--ink-850);
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: 0.88rem;
        transition: border-color 0.15s;

        .livestream__search-field & { padding-left: 2.2rem; }

        &:focus { outline: none; border-color: #ff4444; }
        &::placeholder { color: var(--bone-500); }
    }

    &__custom-form {
        display: flex;
        gap: var(--s-2);
        .livestream__input { flex: 1; min-width: 0; }
    }

    &__btn-primary {
        min-height: 2.5rem;
        padding: 0 var(--s-5);
        border-radius: var(--r-md);
        background: #ff0000;
        color: #fff;
        font-family: var(--font-ui);
        font-weight: 600;
        font-size: 0.88rem;
        border: none;
        cursor: pointer;
        transition: background 0.15s;
        white-space: nowrap;
        &:hover { background: #cc0000; }
    }

    // ── Grid section ───────────────────────────────────────────────────────
    &__grid-section {
        padding-bottom: var(--s-10);
    }

    &__section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--s-4);
    }

    &__section-title {
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--bone-300);
        text-transform: uppercase;
        letter-spacing: 0.07em;
        display: flex;
        align-items: center;
        gap: var(--s-2);
    }

    &__count {
        font-size: 0.68rem;
        font-weight: 600;
        padding: 2px 7px;
        border-radius: var(--r-pill);
        background: rgba(255, 0, 0, 0.15);
        color: #ff6666;
        border: 1px solid rgba(255, 0, 0, 0.3);
    }

    &__refresh-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        min-height: 2rem;
        padding: 0 var(--s-3);
        border-radius: var(--r-md);
        border: 1px solid var(--rule-strong);
        background: var(--ink-800);
        color: var(--bone-300);
        font-family: var(--font-ui);
        font-size: 0.75rem;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s;

        &:hover { background: var(--ink-700); }

        &.is-loading svg {
            animation: spin 1s linear infinite;
        }
    }

    // ── Grid ───────────────────────────────────────────────────────────────
    &__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: var(--s-4);
    }

    &__card {
        background: var(--ink-850);
        border-radius: var(--r-md);
        border: 1px solid var(--rule-strong);
        overflow: hidden;
        cursor: pointer;
        transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;

        &:hover {
            transform: translateY(-2px);
            border-color: var(--bone-600);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }

        &.is-playing {
            border-color: #ff0000;
            box-shadow: 0 0 0 2px rgba(255, 0, 0, 0.3);
        }

        &--skeleton {
            pointer-events: none;
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
        transition: transform 0.2s;
        .livestream__card:hover & { transform: scale(1.04); }
    }

    &__card-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.15s;
        .livestream__card:hover & { opacity: 1; }
    }

    &__play-btn-circle {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }

    &__card-badge {
        position: absolute;
        top: 8px;
        left: 8px;
        font-size: 0.52rem;
        font-weight: 800;
        color: #fff;
        padding: 2px 5px;
        border-radius: var(--r-xs);
        letter-spacing: 0.04em;
    }

    &__card-viewers {
        position: absolute;
        bottom: 8px;
        right: 8px;
        font-size: 0.65rem;
        font-weight: 600;
        color: #fff;
        background: rgba(0, 0, 0, 0.75);
        padding: 2px 6px;
        border-radius: var(--r-xs);
        display: flex;
        align-items: center;
        gap: 3px;
    }

    &__card-info {
        padding: var(--s-3) var(--s-4);
    }

    &__card-name {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--bone-50);
        margin-bottom: 3px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        line-height: 1.35;
    }

    &__card-game {
        font-size: 0.72rem;
        color: var(--bone-400);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__card-category {
        font-size: 0.68rem;
        color: #ff6666;
        margin-top: 3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    // ── Skeleton ───────────────────────────────────────────────────────────
    .skeleton-box {
        background: linear-gradient(90deg, var(--ink-800) 25%, var(--ink-700) 50%, var(--ink-800) 75%);
        background-size: 200% 100%;
        animation: shimmer 1.4s infinite;
    }

    .skeleton-line {
        height: 12px;
        border-radius: 4px;
        background: linear-gradient(90deg, var(--ink-800) 25%, var(--ink-700) 50%, var(--ink-800) 75%);
        background-size: 200% 100%;
        animation: shimmer 1.4s infinite;
    }

    // ── Empty ──────────────────────────────────────────────────────────────
    &__empty {
        padding: var(--s-12) var(--s-6);
        text-align: center;
        border-radius: var(--r-md);
        border: 1px dashed var(--rule);
        background: var(--ink-850);
        color: var(--bone-500);
        font-size: 0.88rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--s-3);
    }
}

@keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
}
</style>
