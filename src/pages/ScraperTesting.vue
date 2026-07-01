<template>
    <div class="stest">
        <header class="stest__header">
            <h1>Scraper Testing</h1>
            <p class="stest__sub">Test the scraper proxy at proxy.moovie.fun</p>
        </header>

        <section class="stest__panel">
            <div class="stest__row">
                <label>
                    <span>Title</span>
                    <input v-model="title" type="text" placeholder="Interstellar" @keydown.enter="search" />
                </label>
                <label>
                    <span>Season</span>
                    <input v-model.number="season" type="number" min="0" placeholder="0" />
                </label>
                <label>
                    <span>Episode</span>
                    <input v-model.number="episode" type="number" min="0" placeholder="0" />
                </label>
                <label>
                    <span>Fast</span>
                    <select v-model.number="fast">
                        <option :value="0">Off</option>
                        <option :value="1">On</option>
                    </select>
                </label>
                <button type="button" class="stest__btn" :disabled="loading" @click="search">
                    {{ loading ? 'Scraping…' : 'Scrape' }}
                </button>
            </div>
            <p v-if="error" class="stest__error">{{ error }}</p>
        </section>

        <section v-if="numProviders > 0" class="stest__panel">
            <div class="stest__summary">
                <span>{{ numProviders }} provider{{ numProviders === 1 ? '' : 's' }}</span>
                <span>{{ numStreams }} stream{{ numStreams === 1 ? '' : 's' }}</span>
                <span v-if="timing">{{ timing }}ms</span>
            </div>

            <div v-if="activeStreamUrl" class="stest__player">
                <div ref="artContainer" class="stest__artplayer" />
            </div>

            <div v-for="(urls, provider) in result" :key="provider" class="stest__provider">
                <div class="stest__provider-header">
                    <strong>{{ provider }}</strong>
                    <span class="stest__count">{{ urls.length }} URL{{ urls.length === 1 ? '' : 's' }}</span>
                </div>
                <div v-for="(url, i) in urls" :key="i" class="stest__stream">
                    <span class="stest__idx">#{{ i + 1 }}</span>
                    <code class="stest__url">{{ url }}</code>
                    <button type="button" class="stest__play-btn" @click="setActive(url)">Play</button>
                    <button type="button" class="stest__copy-btn" @click="copy(url)">Copy</button>
                </div>
            </div>
        </section>

        <section v-if="result && numProviders === 0" class="stest__panel">
            <p class="stest__no-streams">No streams found</p>
        </section>

        <section v-if="result" class="stest__panel">
            <button type="button" class="stest__debug-toggle" @click="showDebug = !showDebug">
                {{ showDebug ? 'Hide' : 'Show' }} raw JSON
            </button>
            <pre v-if="showDebug">{{ JSON.stringify(result, null, 2) }}</pre>
        </section>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onUnmounted, ref, watch } from 'vue';

const API_BASE = 'https://proxy.moovie.fun';

export default defineComponent({
    name: 'ScraperTesting',
    setup() {
        const title = ref('Interstellar');
        const season = ref(0);
        const episode = ref(0);
        const fast = ref(0);
        const loading = ref(false);
        const error = ref('');
        const result = ref<Record<string, string[]> | null>(null);
        const timing = ref<number | null>(null);
        const showDebug = ref(false);
        const activeStreamUrl = ref('');
        const artContainer = ref<HTMLElement | null>(null);
        let artInstance: any = null;

        const numProviders = computed(() => {
            if (!result.value) return 0;
            return Object.keys(result.value).length;
        });

        const numStreams = computed(() => {
            if (!result.value) return 0;
            let count = 0;
            for (const urls of Object.values(result.value)) {
                count += urls.length;
            }
            return count;
        });

        const loadArtplayerAssets = (() => {
            let promise: Promise<void> | null = null;
            return () => {
                if ((window as any).Artplayer) return Promise.resolve();
                if (promise) return promise;
                promise = new Promise((resolve, reject) => {
                    if (!document.querySelector('link[data-stest-art-css]')) {
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = 'https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.css';
                        link.setAttribute('data-stest-art-css', '1');
                        document.head.appendChild(link);
                    }
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.min.js';
                    script.onload = () => {
                        const hlsScript = document.createElement('script');
                        hlsScript.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';
                        hlsScript.onload = () => resolve();
                        hlsScript.onerror = () => resolve();
                        document.head.appendChild(hlsScript);
                    };
                    script.onerror = () => reject(new Error('ArtPlayer failed to load'));
                    document.head.appendChild(script);
                });
                return promise;
            };
        })();

        const destroyArt = () => {
            if (artInstance) {
                try { artInstance.destroy(false); } catch { /* ignore */ }
                artInstance = null;
            }
        };

        const mountArtplayer = async (url: string) => {
            await loadArtplayerAssets();
            const container = artContainer.value;
            if (!container) return;
            destroyArt();

            const ArtplayerCtor = (window as any).Artplayer;
            const HlsCtor = (window as any).Hls;
            const isM3u8 = url.includes('.m3u8') || url.includes('m3u8');

            artInstance = new ArtplayerCtor({
                container,
                url,
                type: isM3u8 ? 'm3u8' : 'mp4',
                autoplay: true,
                preload: 'auto',
                playbackRate: true,
                aspectRatio: true,
                fullscreen: true,
                fullscreenWeb: true,
                miniProgressBar: true,
                fastForward: true,
                setting: true,
                theme: '#4eb5ff',
                customType: isM3u8 ? {
                    m3u8(video: HTMLVideoElement, src: string) {
                        if (HlsCtor?.isSupported()) {
                            const hls = new HlsCtor({ enableWorker: true });
                            hls.loadSource(src);
                            hls.attachMedia(video);
                        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                            video.src = src;
                        }
                    },
                } : undefined,
            });

            artInstance.on('video:loadedmetadata', () => {
                console.log('[ArtPlayer] loadedmetadata');
            });
        };

        const setActive = (url: string) => {
            activeStreamUrl.value = url;
            mountArtplayer(url);
        };

        const copy = async (url: string) => {
            try {
                await navigator.clipboard.writeText(url);
            } catch { /* ignore */ }
        };

        const search = async () => {
            if (!title.value.trim()) return;
            loading.value = true;
            error.value = '';
            result.value = null;
            activeStreamUrl.value = '';
            timing.value = null;
            destroyArt();

            const params: Record<string, string> = { title: title.value.trim() };
            if (season.value > 0) params.season = String(season.value);
            if (episode.value > 0) params.episode = String(episode.value);
            if (fast.value) params.fast = '1';

            const qs = new URLSearchParams(params).toString();
            const url = `${API_BASE}/api/scrape?${qs}`;
            const startedAt = performance.now();

            try {
                const resp = await fetch(url);
                timing.value = Math.round(performance.now() - startedAt);
                if (!resp.ok) {
                    throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
                }
                result.value = await resp.json();
                if (numStreams.value > 0) {
                    const firstUrl = Object.values(result.value!)[0][0];
                    setActive(firstUrl);
                }
            } catch (err: any) {
                error.value = err.message || 'Request failed';
            } finally {
                loading.value = false;
            }
        };

        onUnmounted(() => {
            destroyArt();
        });

        return {
            title, season, episode, fast,
            loading, error, result, timing, showDebug,
            numProviders, numStreams, activeStreamUrl, artContainer,
            search, setActive, copy,
        };
    },
});
</script>

<style scoped lang="scss">
.stest {
    min-height: 100vh;
    padding: 2rem 1.25rem 3rem;
    background: radial-gradient(circle at top, rgba(78, 181, 255, 0.12), transparent 40%), #070b12;
    color: #f4f7fb;
}
.stest__header {
    max-width: 1100px;
    margin: 0 auto 1.5rem;
}
.stest__header h1 {
    margin: 0;
    font-size: clamp(1.8rem, 4vw, 2.6rem);
}
.stest__sub {
    margin: 0.5rem 0 0;
    color: rgba(244, 247, 251, 0.65);
}
.stest__panel {
    max-width: 1100px;
    margin: 0 auto 1rem;
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    background: rgba(10, 16, 28, 0.82);
    backdrop-filter: blur(10px);
}
.stest__row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 0.75rem;
    align-items: end;
}
label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.78rem;
    color: rgba(244, 247, 251, 0.7);
}
input, select {
    width: 100%;
    padding: 0.65rem 0.75rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(0, 0, 0, 0.35);
    color: #fff;
}
.stest__btn {
    padding: 0.7rem 1rem;
    border: 0;
    border-radius: 10px;
    background: linear-gradient(135deg, #4eb5ff, #2d79ff);
    color: #fff;
    font-weight: 600;
    cursor: pointer;
    &:disabled { opacity: 0.55; cursor: not-allowed; }
}
.stest__error {
    margin: 0.75rem 0 0;
    color: #ff8f8f;
}
.stest__summary {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    font-size: 0.85rem;
    color: rgba(244, 247, 251, 0.6);
}
.stest__player {
    aspect-ratio: 16 / 9;
    border-radius: 14px;
    overflow: hidden;
    background: #000;
    border: 1px solid rgba(255, 255, 255, 0.08);
    margin-bottom: 1rem;
}
.stest__artplayer {
    width: 100%;
    height: 100%;
}
.stest__provider {
    margin-bottom: 0.75rem;
    padding: 0.75rem;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.25);
}
.stest__provider-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.4rem;
    strong { color: #9ecfff; }
}
.stest__count {
    font-size: 0.75rem;
    color: rgba(244, 247, 251, 0.45);
}
.stest__stream {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0;
    font-size: 0.78rem;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    &:last-child { border-bottom: 0; }
}
.stest__idx {
    color: rgba(244, 247, 251, 0.35);
    font-size: 0.7rem;
    min-width: 1.5rem;
}
.stest__url {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(244, 247, 251, 0.6);
    font-size: 0.72rem;
}
.stest__play-btn, .stest__copy-btn {
    padding: 0.25rem 0.5rem;
    border: 0;
    border-radius: 6px;
    font-size: 0.7rem;
    cursor: pointer;
    white-space: nowrap;
}
.stest__play-btn {
    background: linear-gradient(135deg, #4eb5ff, #2d79ff);
    color: #fff;
}
.stest__copy-btn {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(244, 247, 251, 0.7);
}
.stest__no-streams {
    color: rgba(244, 247, 251, 0.5);
    font-style: italic;
}
.stest__debug-toggle {
    border: 0;
    background: transparent;
    color: #9ecfff;
    cursor: pointer;
    font-size: 0.9rem;
}
.stest__panel pre {
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
