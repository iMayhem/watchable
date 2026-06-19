<template>
    <div class="nm-test">
        <header class="nm-test__header">
            <p class="nm-test__badge">Internal · Hidden</p>
            <h1>NetMirror Lab</h1>
            <p class="nm-test__sub">
                Test stream resolution through moovie proxy. Not linked anywhere on the site.
            </p>
        </header>

        <section class="nm-test__panel">
            <div class="nm-test__row">
                <label>
                    <span>NetMirror ID</span>
                    <input v-model="mediaId" type="text" placeholder="111489" />
                </label>
                <label>
                    <span>Type</span>
                    <select v-model="mediaType">
                        <option value="movie">movie</option>
                        <option value="tv">tv</option>
                    </select>
                </label>
                <label>
                    <span>Season</span>
                    <input v-model.number="season" type="number" min="0" />
                </label>
                <label>
                    <span>Episode</span>
                    <input v-model.number="episode" type="number" min="0" />
                </label>
                <label>
                    <span>Server mirror</span>
                    <select v-model.number="server">
                        <option :value="1">1 · spedostream2</option>
                        <option :value="2">2 · watch22</option>
                        <option :value="3">3 · watch21</option>
                        <option :value="5">5 · test.watch22</option>
                    </select>
                </label>
            </div>

            <div class="nm-test__row">
                <label class="nm-test__search">
                    <span>Search NetMirror</span>
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Disclosure Day"
                        @keydown.enter="runSearch"
                    />
                </label>
                <button type="button" class="nm-test__btn nm-test__btn--ghost" :disabled="loading" @click="runSearch">
                    Search
                </button>
                <button type="button" class="nm-test__btn" :disabled="loading" @click="resolve">
                    {{ loading ? 'Resolving…' : 'Resolve & Play' }}
                </button>
            </div>

            <div v-if="searchResults.length" class="nm-test__search-results">
                <button
                    v-for="item in searchResults"
                    :key="item.id"
                    type="button"
                    class="nm-test__chip"
                    @click="applySearchResult(item)"
                >
                    {{ item.title?.trim() }} · {{ item.media_type }} · #{{ item.id }}
                </button>
            </div>

            <p v-if="error" class="nm-test__error" role="alert">{{ error }}</p>
        </section>

        <section v-if="resolved" class="nm-test__panel">
            <div class="nm-test__meta">
                <h2>{{ resolved.meta.title }}</h2>
                <p>
                    subjectid {{ resolved.meta.subjectid }} ·
                    {{ streams.length }} stream{{ streams.length === 1 ? '' : 's' }} found
                </p>
            </div>

            <div class="nm-test__mode">
                <button
                    type="button"
                    class="nm-test__mode-btn"
                    :class="{ 'is-active': playerMode === 'iframe' }"
                    @click="playerMode = 'iframe'"
                >
                    Proxied iframe
                </button>
                <button
                    type="button"
                    class="nm-test__mode-btn"
                    :class="{ 'is-active': playerMode === 'direct' }"
                    :disabled="!activeStream"
                    @click="playerMode = 'direct'"
                >
                    Proxied MP4
                </button>
            </div>

            <div class="nm-test__player">
                <iframe
                    v-if="playerMode === 'iframe' && playerProxyUrl"
                    :key="playerProxyUrl"
                    :src="playerProxyUrl"
                    title="NetMirror proxied player"
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                    allowfullscreen
                    frameborder="0"
                />
                <video
                    v-else-if="playerMode === 'direct' && activeStream"
                    :key="activeStream.proxiedUrl"
                    controls
                    autoplay
                    playsinline
                    :src="activeStream.proxiedUrl"
                />
                <div v-else class="nm-test__player-empty">No stream loaded yet.</div>
            </div>

            <div v-if="streams.length" class="nm-test__qualities">
                <button
                    v-for="(stream, index) in streams"
                    :key="stream.url"
                    type="button"
                    class="nm-test__quality"
                    :class="{ 'is-active': selectedStreamIndex === index }"
                    @click="selectStream(index)"
                >
                    {{ stream.quality }}
                </button>
            </div>
        </section>

        <section v-if="resolved" class="nm-test__panel nm-test__debug">
            <button type="button" class="nm-test__debug-toggle" @click="showDebug = !showDebug">
                {{ showDebug ? 'Hide' : 'Show' }} debug JSON
            </button>
            <pre v-if="showDebug">{{ debugJson }}</pre>
        </section>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref } from 'vue';
import { useSeo } from '../composables/useSeo';

interface NetmirrorStream {
    quality: string;
    url: string;
    proxiedUrl: string;
}

interface NetmirrorResolve {
    meta: {
        id: string;
        title: string;
        subjectid: string;
        media_type: string;
        season: unknown;
        trailer: string | null;
        backdrop_path: string | null;
    };
    auth: { timestamp: number; signature: string };
    watchboxUrl: string;
    playerProxyUrl: string;
    streams: NetmirrorStream[];
    defaultStream: NetmirrorStream | null;
}

interface SearchResult {
    id: string;
    title: string;
    media_type: string;
}

export default defineComponent({
    name: 'TestNetmirror',
    setup() {
        const { updateSeo } = useSeo();

        const mediaId = ref('111489');
        const mediaType = ref<'movie' | 'tv'>('movie');
        const season = ref(0);
        const episode = ref(0);
        const server = ref(1);
        const searchQuery = ref('');

        const loading = ref(false);
        const error = ref('');
        const resolved = ref<NetmirrorResolve | null>(null);
        const searchResults = ref<SearchResult[]>([]);

        const playerMode = ref<'iframe' | 'direct'>('iframe');
        const selectedStreamIndex = ref(0);
        const showDebug = ref(false);

        const streams = computed(() => resolved.value?.streams || []);
        const activeStream = computed(() => streams.value[selectedStreamIndex.value] || null);
        const playerProxyUrl = computed(() => resolved.value?.playerProxyUrl || '');
        const debugJson = computed(() => JSON.stringify(resolved.value, null, 2));

        const buildApiUrl = (action = 'resolve') => {
            const params = new URLSearchParams({
                action,
                type: mediaType.value,
                id: mediaId.value,
                se: String(season.value),
                ep: String(episode.value),
                server: String(server.value),
            });
            return `/api/netmirror?${params.toString()}`;
        };

        const parseApiResponse = async (resp: Response) => {
            const contentType = resp.headers.get('content-type') || '';
            const text = await resp.text();
            const looksLikeHtml =
                text.trimStart().startsWith('<') || /<!doctype/i.test(text.slice(0, 200));

            if (!contentType.includes('application/json') && looksLikeHtml) {
                throw new Error(
                    'API returned HTML instead of JSON. Deploy /api/netmirror to Cloudflare Pages, or run npm run dev locally (functions middleware is enabled).'
                );
            }

            try {
                return JSON.parse(text);
            } catch {
                throw new Error(`Invalid API response (${resp.status}): ${text.slice(0, 160)}`);
            }
        };

        const resolve = async () => {
            loading.value = true;
            error.value = '';
            try {
                const resp = await fetch(buildApiUrl('resolve'));
                const data = await parseApiResponse(resp);
                if (!resp.ok) {
                    throw new Error(data.error || `Request failed (${resp.status})`);
                }
                resolved.value = data;
                selectedStreamIndex.value = 0;
                if (!data.streams?.length) {
                    playerMode.value = 'iframe';
                }
            } catch (err: any) {
                error.value = err?.message || 'Failed to resolve stream';
                resolved.value = null;
            } finally {
                loading.value = false;
            }
        };

        const runSearch = async () => {
            if (!searchQuery.value.trim()) return;
            loading.value = true;
            error.value = '';
            try {
                const params = new URLSearchParams({
                    action: 'search',
                    q: searchQuery.value.trim(),
                });
                const resp = await fetch(`/api/netmirror?${params.toString()}`);
                const data = await parseApiResponse(resp);
                if (!resp.ok) {
                    throw new Error(data.error || `Search failed (${resp.status})`);
                }
                searchResults.value = data.results || [];
            } catch (err: any) {
                error.value = err?.message || 'Search failed';
                searchResults.value = [];
            } finally {
                loading.value = false;
            }
        };

        const applySearchResult = (item: SearchResult) => {
            mediaId.value = item.id;
            mediaType.value = item.media_type === 'tv' ? 'tv' : 'movie';
            season.value = 0;
            episode.value = 0;
            resolve();
        };

        const selectStream = (index: number) => {
            selectedStreamIndex.value = index;
            playerMode.value = 'direct';
        };

        onMounted(() => {
            updateSeo({
                title: 'Test',
                canonical: 'https://moovie.fun/test',
                image: 'https://moovie.fun/og-image.png',
            });

            let robotsMeta = document.querySelector('meta[name="robots"]');
            if (!robotsMeta) {
                robotsMeta = document.createElement('meta');
                robotsMeta.setAttribute('name', 'robots');
                document.head.appendChild(robotsMeta);
            }
            robotsMeta.setAttribute('content', 'noindex, nofollow');
        });

        return {
            mediaId,
            mediaType,
            season,
            episode,
            server,
            searchQuery,
            loading,
            error,
            resolved,
            searchResults,
            playerMode,
            selectedStreamIndex,
            showDebug,
            streams,
            activeStream,
            playerProxyUrl,
            debugJson,
            resolve,
            runSearch,
            applySearchResult,
            selectStream,
        };
    },
});
</script>

<style scoped lang="scss">
.nm-test {
    min-height: 100vh;
    padding: 2rem 1.25rem 3rem;
    background:
        radial-gradient(circle at top, rgba(78, 181, 255, 0.12), transparent 40%),
        #070b12;
    color: #f4f7fb;
}

.nm-test__header {
    max-width: 1100px;
    margin: 0 auto 1.5rem;
}

.nm-test__badge {
    display: inline-block;
    margin: 0 0 0.5rem;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    background: rgba(255, 193, 7, 0.15);
    color: #ffd76a;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.nm-test__header h1 {
    margin: 0;
    font-size: clamp(1.8rem, 4vw, 2.6rem);
}

.nm-test__sub {
    margin: 0.5rem 0 0;
    color: rgba(244, 247, 251, 0.65);
    max-width: 52ch;
}

.nm-test__panel {
    max-width: 1100px;
    margin: 0 auto 1rem;
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    background: rgba(10, 16, 28, 0.82);
    backdrop-filter: blur(10px);
}

.nm-test__row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem;
    align-items: end;
}

.nm-test__row + .nm-test__row {
    margin-top: 0.75rem;
}

label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.78rem;
    color: rgba(244, 247, 251, 0.7);
}

input,
select {
    width: 100%;
    padding: 0.65rem 0.75rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(0, 0, 0, 0.35);
    color: #fff;
}

.nm-test__search {
    grid-column: span 2;
}

.nm-test__btn {
    padding: 0.7rem 1rem;
    border: 0;
    border-radius: 10px;
    background: linear-gradient(135deg, #4eb5ff, #2d79ff);
    color: #fff;
    font-weight: 600;
    cursor: pointer;

    &:disabled {
        opacity: 0.55;
        cursor: not-allowed;
    }
}

.nm-test__btn--ghost {
    background: rgba(255, 255, 255, 0.08);
}

.nm-test__search-results {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
}

.nm-test__chip {
    border: 1px solid rgba(78, 181, 255, 0.35);
    background: rgba(78, 181, 255, 0.08);
    color: #d8ecff;
    border-radius: 999px;
    padding: 0.35rem 0.7rem;
    cursor: pointer;
    font-size: 0.82rem;
}

.nm-test__error {
    margin: 0.75rem 0 0;
    color: #ff8f8f;
}

.nm-test__meta h2 {
    margin: 0 0 0.35rem;
    font-size: 1.35rem;
}

.nm-test__meta p {
    margin: 0;
    color: rgba(244, 247, 251, 0.6);
    font-size: 0.9rem;
}

.nm-test__mode {
    display: flex;
    gap: 0.5rem;
    margin: 1rem 0 0.75rem;
}

.nm-test__mode-btn {
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: transparent;
    color: rgba(244, 247, 251, 0.75);
    border-radius: 999px;
    padding: 0.45rem 0.9rem;
    cursor: pointer;

    &.is-active {
        border-color: rgba(78, 181, 255, 0.7);
        background: rgba(78, 181, 255, 0.15);
        color: #fff;
    }

    &:disabled {
        opacity: 0.45;
        cursor: not-allowed;
    }
}

.nm-test__player {
    aspect-ratio: 16 / 9;
    border-radius: 14px;
    overflow: hidden;
    background: #000;
    border: 1px solid rgba(255, 255, 255, 0.08);

    iframe,
    video {
        width: 100%;
        height: 100%;
        display: block;
        border: 0;
    }
}

.nm-test__player-empty {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    color: rgba(244, 247, 251, 0.45);
}

.nm-test__qualities {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
}

.nm-test__quality {
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: #fff;
    border-radius: 8px;
    padding: 0.4rem 0.75rem;
    cursor: pointer;

    &.is-active {
        border-color: #4eb5ff;
        background: rgba(78, 181, 255, 0.18);
    }
}

.nm-test__debug-toggle {
    border: 0;
    background: transparent;
    color: #9ecfff;
    cursor: pointer;
    padding: 0;
    font-size: 0.9rem;
}

.nm-test__debug pre {
    margin: 0.75rem 0 0;
    padding: 0.85rem;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.45);
    overflow: auto;
    font-size: 0.75rem;
    line-height: 1.45;
    max-height: 320px;
}
</style>