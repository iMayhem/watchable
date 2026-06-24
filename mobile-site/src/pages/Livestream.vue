<template>
    <MobileShell>
        <div class="m-livestream">
            <header class="m-livestream__head">
                <h1 class="m-livestream__title">Livestream</h1>
            </header>

            <!-- Theater View -->
            <div v-if="activeVideoId" class="m-livestream__theater">
                <div class="m-livestream__video-wrapper">
                    <div id="youtube-player" class="m-livestream__video-frame"></div>
                </div>

                <!-- Stream Details & Controls -->
                <div class="m-livestream__meta-bar">
                    <div class="m-livestream__streamer-info">
                        <div class="m-livestream__avatar" style="background: linear-gradient(135deg, #ff0000, #b30000)">
                            {{ activeStream?.channelTitle?.charAt(0)?.toUpperCase() ?? 'Y' }}
                        </div>
                        <div class="m-livestream__streamer-details">
                            <div class="m-livestream__streamer-name">
                                {{ activeStream?.channelTitle || 'YouTube Live' }}
                                <span class="m-livestream__live-badge">LIVE</span>
                            </div>
                            <div class="m-livestream__streamer-sub">{{ activeStream?.title }}</div>
                        </div>
                    </div>

                    <div class="m-livestream__controls-row">
                        <div class="m-livestream__quality-control">
                            <select v-model="selectedQuality" class="m-livestream__quality-select" title="Change quality">
                                <option value="hd1080">1080p</option>
                                <option value="hd720">720p</option>
                                <option value="large">480p</option>
                                <option value="medium">360p</option>
                                <option value="auto">Auto</option>
                            </select>
                        </div>
                        <button @click="toggleChat" class="m-livestream__action-btn">
                            {{ showChat ? 'Hide Chat' : 'Show Chat' }}
                        </button>
                    </div>
                </div>

                <!-- Mobile stacked chat -->
                <div v-if="showChat && chatUrl" class="m-livestream__chat-wrapper">
                    <iframe :src="chatUrl" class="m-livestream__chat-frame" frameborder="0" scrolling="no"></iframe>
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
                        :class="{ 'is-active': selectedCategory === cat.id }"
                        @click="selectCategory(cat.id)"
                    >
                        <span style="font-size:1rem">{{ cat.emoji }}</span>
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
                            placeholder="Search live streams…"
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
                        <button type="submit" class="m-livestream__btn-primary">Watch</button>
                    </form>
                </div>
            </div>

            <!-- Channels Grid -->
            <div class="m-livestream__grid-section">
                <div class="m-livestream__section-header">
                    <h2 class="m-livestream__section-title">{{ selectedCategoryName }}</h2>
                    <button @click="fetchStreams" class="m-livestream__refresh-btn" :class="{ 'is-loading': loading }">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                        </svg>
                    </button>
                </div>

                <!-- Loading skeleton -->
                <div v-if="loading" class="m-livestream__grid">
                    <div v-for="i in 6" :key="i" class="m-livestream__card">
                        <div class="m-livestream__card-preview skeleton-box"></div>
                        <div class="m-livestream__card-info">
                            <div class="skeleton-line" style="width:85%"></div>
                            <div class="skeleton-line" style="width:60%;margin-top:5px"></div>
                        </div>
                    </div>
                </div>

                <!-- Error -->
                <div v-else-if="error" class="m-livestream__empty meta">
                    <p>{{ error }}</p>
                    <button @click="fetchStreams" class="m-livestream__btn-primary" style="margin-top:8px">Retry</button>
                </div>

                <!-- Streams grid -->
                <div v-else-if="filteredStreams.length" class="m-livestream__grid">
                    <div
                        v-for="stream in filteredStreams"
                        :key="stream.videoId"
                        class="m-livestream__card m-livestream__card--yt"
                        :class="{ 'is-playing': activeVideoId === stream.videoId }"
                        @click="playStream(stream)"
                    >
                        <div class="m-livestream__card-preview">
                            <img
                                :src="stream.thumbnail"
                                :alt="stream.title"
                                class="m-livestream__card-avatar"
                                loading="lazy"
                            />
                            <span class="m-livestream__card-badge" style="background:#ff0000">LIVE</span>
                            <span v-if="stream.viewerCount" class="m-livestream__card-viewers">
                                {{ formatViewers(stream.viewerCount) }}
                            </span>
                        </div>
                        <div class="m-livestream__card-info">
                            <h3 class="m-livestream__card-name">{{ stream.title }}</h3>
                            <p class="m-livestream__card-game">{{ stream.channelTitle }}</p>
                        </div>
                    </div>
                </div>

                <!-- Empty -->
                <div v-else class="m-livestream__empty meta">
                    No live streams found right now. Try refreshing.
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

const YT_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string;

interface LiveStream {
    videoId: string;
    title: string;
    channelTitle: string;
    channelId: string;
    thumbnail: string;
    viewerCount?: string;
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
const showChat = ref(false);
const selectedQuality = ref('hd720');

let ytPlayer: any = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const route = useRoute();
const { defaultYoutubeStream } = getSettings();

// Categories
const categories: Category[] = [
    { id: 'gaming',        name: 'All Gaming',     emoji: '🎮', query: 'pc gaming live stream english' },
    { id: 'fps',           name: 'CS2 / Valorant', emoji: '🔫', query: 'cs2 counter strike valorant fps live stream english' },
    { id: 'battle_royale', name: 'Battle Royale',  emoji: '🪂', query: 'warzone apex legends pubg battlegrounds pc live stream' },
    { id: 'openworld',     name: 'Open World/RPG', emoji: '🗺️',  query: 'elden ring cyberpunk gta red dead redemption witcher pc live stream' },
    { id: 'moba',          name: 'MOBA',           emoji: '⚔️',  query: 'league of legends dota 2 live stream english pro' },
    { id: 'esports',       name: 'Esports',        emoji: '🏆', query: 'cs2 valorant esports tournament championship live english' },
    { id: 'music',         name: '24/7 Music',     emoji: '🎵', query: 'lofi hip hop music 24/7 live radio chill' },
];

const selectedCategoryName = computed(() =>
    categories.find(c => c.id === selectedCategory.value)?.name ?? 'Gaming'
);

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
        s.channelTitle.toLowerCase().includes(q)
    );
});

async function fetchStreams() {
    loading.value = true;
    error.value = '';

    const cat = categories.find(c => c.id === selectedCategory.value);
    const q = encodeURIComponent(cat?.query ?? 'gaming live stream');

    try {
        const searchRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&eventType=live&q=${q}&maxResults=20&relevanceLanguage=en&regionCode=US&order=viewCount&key=${YT_API_KEY}`
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
        const detailsRes = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoIds}&key=${YT_API_KEY}`
        );
        const detailsData = await detailsRes.json();
        const detailsMap: Record<string, any> = {};
        for (const v of (detailsData.items ?? [])) detailsMap[v.id] = v;

        const mapped: LiveStream[] = items.map((item: any) => {
            const videoId = item.id.videoId;
            const snippet = item.snippet;
            const viewerCount = detailsMap[videoId]?.liveStreamingDetails?.concurrentViewers ?? '';
            const thumb =
                snippet.thumbnails?.high?.url ||
                snippet.thumbnails?.medium?.url ||
                `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            return { videoId, title: snippet.title, channelTitle: snippet.channelTitle, channelId: snippet.channelId, thumbnail: thumb, viewerCount } as LiveStream;
        });

        // Sort by concurrent viewers descending (most popular first)
        streams.value = mapped.sort((a, b) => {
            const va = parseInt(String(a.viewerCount || '0'), 10);
            const vb = parseInt(String(b.viewerCount || '0'), 10);
            return vb - va;
        });

        if (!activeVideoId.value && streams.value.length) {
            playStream(streams.value[0]);
        }
    } catch (e: any) {
        error.value = e?.message ?? 'Failed to load streams.';
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
        const el = document.querySelector('.m-livestream__theater');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

function loadYoutubeApi() {
    if (typeof window === 'undefined') return;
    if ((window as any).YT?.Player) return;
    if (document.querySelector('script[src*="youtube.com/iframe_api"]')) return;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
}

function initYoutubePlayer(videoId: string) {
    const tryInit = () => {
        if (!(window as any).YT?.Player) { setTimeout(tryInit, 100); return; }

        if (ytPlayer) {
            try { ytPlayer.loadVideoById(videoId); return; } catch {}
        }

        const el = document.getElementById('youtube-player');
        if (!el) return;

        ytPlayer = new (window as any).YT.Player('youtube-player', {
            height: '100%', width: '100%', videoId,
            playerVars: { autoplay: 1, mute: 1, rel: 0, modestbranding: 1, playsinline: 1, origin: window.location.origin },
            events: {
                onReady: (event: any) => {
                    event.target.mute();
                    event.target.playVideo();
                    if (selectedQuality.value !== 'auto') event.target.setPlaybackQuality?.(selectedQuality.value);
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
    const videoId = input.match(ytVideoReg)?.[1] ?? input.match(ytLiveReg)?.[1] ?? (/^[a-zA-Z0-9_-]{11}$/.test(input) ? input : null);
    if (!videoId) return;
    customChannelInput.value = '';
    playStream({ videoId, title: 'Custom Stream', channelTitle: 'YouTube Live', channelId: '', thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` });
}

function toggleChat() { showChat.value = !showChat.value; }

function formatViewers(count: string | number): string {
    const n = typeof count === 'string' ? parseInt(count, 10) : count;
    if (isNaN(n)) return '';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString();
}

function parseYoutubeId(input: string): string {
    const ytVideoReg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
    const v = input.match(ytVideoReg); if (v) return v[1];
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    return '';
}

watch(selectedQuality, (q) => {
    if (ytPlayer?.setPlaybackQuality) ytPlayer.setPlaybackQuality(q === 'auto' ? 'default' : q);
});

onMounted(async () => {
    document.title = 'Livestream — Moovie';
    await loadGlobalSettings();
    loadYoutubeApi();

    if (route.query.ytId) {
        const videoId = String(route.query.ytId);
        playStream({ videoId, title: 'YouTube Live', channelTitle: 'YouTube Live', channelId: '', thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` });
    } else if (defaultYoutubeStream.value) {
        const id = parseYoutubeId(defaultYoutubeStream.value);
        if (id) playStream({ videoId: id, title: 'Admin Recommended', channelTitle: 'YouTube Live', channelId: '', thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg` });
    }

    await fetchStreams();
    refreshTimer = setInterval(fetchStreams, 3 * 60 * 1000);
});

onUnmounted(() => {
    if (ytPlayer) { try { ytPlayer.destroy(); } catch {} ytPlayer = null; }
    if (refreshTimer) clearInterval(refreshTimer);
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
        flex-shrink: 0;
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
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
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
        &::-webkit-scrollbar { display: none; }
    }

    &__game-tab {
        display: flex;
        align-items: center;
        gap: var(--s-2);
        flex-shrink: 0;
        padding: 6px 12px;
        border-radius: var(--r-md);
        border: 1px solid var(--rule-strong);
        background: var(--ink-800);
        color: var(--bone-300);
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;

        &.is-active {
            background: rgba(255, 0, 0, 0.1);
            border-color: #ff4444;
            color: var(--bone-50);
        }
    }

    &__game-tab-title {
        font-family: var(--font-ui);
        font-weight: 600;
        font-size: 0.72rem;
        white-space: nowrap;
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
        &:focus { outline: none; border-color: #ff4444; }
        &::placeholder { color: var(--bone-500); }
    }

    &__custom-form {
        display: flex;
        gap: var(--s-2);
        .m-livestream__input { flex-grow: 1; }
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
    &__grid-section { padding-bottom: var(--s-4); }

    &__section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--s-3);
    }

    &__section-title {
        font-size: 0.82rem;
        font-weight: 700;
        color: var(--bone-200);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    &__refresh-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: var(--r-md);
        border: 1px solid var(--rule-strong);
        background: var(--ink-800);
        color: var(--bone-400);
        cursor: pointer;
        &.is-loading svg { animation: spin 1s linear infinite; }
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

    &__card-viewers {
        position: absolute;
        bottom: 6px;
        right: 6px;
        font-size: 0.6rem;
        font-weight: 600;
        color: #fff;
        background: rgba(0,0,0,0.7);
        padding: 1px 5px;
        border-radius: var(--r-xs);
    }

    &__card-info { padding: var(--s-3); }

    &__card-name {
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--bone-50);
        margin-bottom: 1px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    &__card-game {
        font-size: 0.65rem;
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

    // Skeleton
    .skeleton-box {
        background: linear-gradient(90deg, var(--ink-800) 25%, var(--ink-700) 50%, var(--ink-800) 75%);
        background-size: 200% 100%;
        animation: shimmer 1.4s infinite;
        aspect-ratio: 16/9;
    }

    .skeleton-line {
        height: 10px;
        border-radius: 4px;
        background: linear-gradient(90deg, var(--ink-800) 25%, var(--ink-700) 50%, var(--ink-800) 75%);
        background-size: 200% 100%;
        animation: shimmer 1.4s infinite;
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
