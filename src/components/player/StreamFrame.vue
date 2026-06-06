<template>
    <div ref="rootRef" class="stream-frame" :class="{ 'is-loading': isLoading || isResolving, 'has-error': hasError || !!resolveError }">
        <div
            v-if="ambientImage"
            class="stream-frame__bloom"
            :style="{ backgroundImage: `url(${ambientImage})` }"
            aria-hidden="true"
        />

        <div class="stream-frame__stage">
            <div class="stream-frame__player">
                <!-- If native provider: Render premium native HTML5 player -->
                <div v-if="isNative && !resolveError" class="stream-frame__native-wrapper">
                    <div v-if="videoUrl" ref="artPlayerRef" class="stream-frame__artplayer" />

                    <!-- Custom Loader for Direct API resolution -->
                    <div v-if="isResolving" class="stream-frame__loading" role="status" aria-live="polite">
                        <div class="stream-frame__skeleton" aria-hidden="true" />
                        <div class="stream-frame__loader">
                            <div class="stream-frame__spinner" aria-hidden="true" />
                            <p class="meta">
                                <template v-if="autoRetryCount > 0">Retrying… ({{ autoRetryCount }}/{{ MAX_AUTO_RETRIES }})</template>
                                <template v-else>Striking the high-performance print…</template>
                            </p>
                        </div>
                    </div>
                </div>

                <iframe
                    v-else-if="embedUrl && !isNative && !hasError"
                    ref="frameEl"
                    :src="embedUrl"
                    :title="title"
                    class="stream-frame__iframe"
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                    allowfullscreen
                    frameborder="0"
                    :sandbox="sandboxAttribute"
                    @load="onLoad"
                    @error="onError"
                />

                <!-- General loading states -->
                <div v-if="isLoading && !isNative && !hasError" class="stream-frame__loading" role="status" aria-live="polite">
                    <div class="stream-frame__skeleton" aria-hidden="true" />
                    <div class="stream-frame__loader">
                        <div class="stream-frame__spinner" aria-hidden="true" />
                        <p class="meta">{{ loadingLabel }}</p>
                    </div>
                </div>

                <!-- Iframe Error -->
                <div v-if="hasError && !isNative" class="stream-frame__error" role="alert">
                    <p class="eyebrow">Reel jam</p>
                    <h3>The frame didn't catch.</h3>
                    <p class="stream-frame__error-message">
                        Try a different server below, or reload this projector.
                    </p>
                    <button type="button" class="stream-frame__retry" @click="retry">Reload</button>
                </div>

                <!-- Native Resolve Error -->
                <div v-if="resolveError" class="stream-frame__error" role="alert">
                    <p class="eyebrow">Projector Fault</p>
                    <h3>Unable to strike direct stream.</h3>
                    <p class="stream-frame__error-message">{{ resolveError }}</p>
                    <button type="button" class="stream-frame__retry" @click="() => resolveStream()">Retry</button>
                </div>
            </div>
        </div>

        <!-- Premium Direct Downloader Modal -->
        <div v-if="showDownloadModal" class="dl-modal" role="dialog" aria-modal="true" @click.self="closeDownloadModal">
            <div class="dl-modal__content">
                <header class="dl-modal__header">
                    <h3>📥 Premium Direct Downloader</h3>
                    <button class="dl-modal__close" @click="closeDownloadModal" aria-label="Close modal">×</button>
                </header>

                <!-- Scrape / Loading State -->
                <div v-if="isScraping" class="dl-modal__loading">
                    <div class="dl-modal__spinner"></div>
                    <p>Scraping high-speed direct MP4 mirrors...</p>
                    <p class="sub">Scanning global video servers & file sizes...</p>
                </div>

                <!-- Error State -->
                <div v-else-if="scrapeError" class="dl-modal__error">
                    <p class="error-title">Failed to scrape MP4 servers</p>
                    <p>{{ scrapeError }}</p>
                    <button class="dl-modal__retry-btn" @click="startFreshScrape">Try Again</button>
                </div>

                <!-- Empty State (No MP4s) -->
                <div v-else-if="filteredMp4Servers.length === 0" class="dl-modal__error">
                    <p class="error-title">No Direct MP4 Streams Available</p>
                    <p>Only HLS (.m3u8) streams are online for this title at the moment.</p>
                </div>

                <!-- Servers Grid -->
                <div v-else class="dl-modal__body">
                    <p class="dl-modal__intro">Choose a direct MP4 server mirror below to download. Direct links are pre-loaded for high-speed download managers.</p>
                    <div class="dl-servers-list">
                        <div v-for="(srv, idx) in filteredMp4Servers" :key="idx" class="dl-server-card">
                            <div class="dl-server-card__meta">
                                <span class="badge quality">{{ srv.quality }}</span>
                                <span class="badge format">MP4</span>
                                <h4 class="server-name">{{ srv.server || 'Direct Stream Mirror' }}</h4>
                            </div>
                            
                            <div class="dl-server-card__actions">
                                <span class="size-label">
                                    <template v-if="srv.loadingSize">⏳ Scanning size...</template>
                                    <template v-else>📦 {{ srv.size || 'Direct Stream' }}</template>
                                </span>
                                <div class="btn-group">
                                    <button class="dl-action-btn copy" @click="copyServerUrl(srv, idx)" :title="srv.copied ? 'Copied!' : 'Copy Direct URL'">
                                        {{ srv.copied ? '✨ Copied!' : '🔗 Copy' }}
                                    </button>
                                    <button class="dl-action-btn download" @click="downloadServerUrl(srv)">
                                        📥 Download
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, onUnmounted, ref, watch } from 'vue';
import { useWebImage } from '../../utils/useWebImage';
import { useAmbientColor } from '../../composables/useAmbientColor';
import { startProgressTracking } from '../../composables/useProgress';
import { usePrefetch } from '../../composables/usePrefetch';
import Artplayer from 'artplayer';
import Hls from 'hls.js';

export default defineComponent({
    name: 'StreamFrame',
    props: {
        embedUrl: { type: String, default: '' },
        title: { type: String, default: 'Stream' },
        backdropPath: { type: String, default: '' },
        posterPath: { type: String, default: '' },
        mediaId: { type: [String, Number], default: '' },
        mediaType: { type: String as () => 'movie' | 'tv' | 'anime', default: 'movie' },
        season: { type: Number, default: 0 },
        episode: { type: Number, default: 0 }
    },
    emits: ['switch-to-server'],
    setup(props, { emit }) {
        const rootRef = ref<HTMLElement | null>(null);
        const frameEl = ref<HTMLIFrameElement | null>(null);
        const artPlayerRef = ref<HTMLElement | null>(null);
        let artplayerInstance: Artplayer | null = null;
        const isLoading = ref(true);
        const hasError = ref(false);

        // Priority 3: Prefetch optimization
        const { getCachedStream } = usePrefetch();

        // Native streaming states
        const isNative = computed(() => props.embedUrl && (props.embedUrl.startsWith('https://api.moovie.fun') || props.embedUrl.startsWith('NATIVE:')));
        const sandboxAttribute = computed(() => {
            if (!props.embedUrl) return undefined;
            const url = props.embedUrl.toLowerCase();
            if (url.includes('cinemaos.tech') || url.includes('smashystream.com')) {
                return 'allow-scripts allow-same-origin allow-forms';
            }
            return undefined;
        });
        const videoUrl = ref('');
        const subtitles = ref<Array<{ label: string; src: string; srclang: string; default: boolean }>>([]);
        const resolutions = ref<Array<{ label: string; url: string }>>([]);
        const isResolving = ref(false);
        const resolveError = ref('');
        const autoRetryCount = ref(0);
        const MAX_AUTO_RETRIES = 5;
        let autoRetryTimer: ReturnType<typeof setTimeout> | null = null;

        // Direct MP4 Downloader state
        const showDownloadModal = ref(false);
        const isScraping = ref(false);
        const scrapeError = ref('');
        const filteredMp4Servers = ref<any[]>([]);

        // Auto-fallback mechanism
        const currentStreamIndex = ref(0);
        const isUserManualSwitch = ref(false); // Track if user manually changed stream
        let bufferingTimeout: ReturnType<typeof setTimeout> | null = null;
        let hasPlayedSuccessfully = ref(false); // Track if video has started playing

        const ambientPath = computed(() => props.backdropPath || props.posterPath || null);
        useAmbientColor(ambientPath, rootRef);

        const loadingMessages = [
            'Threading the reel…',
            'Cueing the projector…',
            'Striking the print…',
            'Rolling film…'
        ];
        const loadingLabel = ref(loadingMessages[0]);
        let messageTimer: ReturnType<typeof setInterval> | null = null;

        const startMessages = () => {
            let i = 0;
            messageTimer = setInterval(() => {
                i = (i + 1) % loadingMessages.length;
                loadingLabel.value = loadingMessages[i];
            }, 2200);
        };

        const stopMessages = () => {
            if (messageTimer) {
                clearInterval(messageTimer);
                messageTimer = null;
            }
        };

        let stopTracking: (() => void) | null = null;

        const startTrackingIfNeeded = () => {
            if (stopTracking) {
                stopTracking();
                stopTracking = null;
            }
            if (props.mediaId && props.embedUrl) {
                stopTracking = startProgressTracking(
                    props.mediaId,
                    props.mediaType,
                    props.mediaType === 'tv' ? props.season : undefined,
                    props.mediaType === 'tv' || props.mediaType === 'anime' ? props.episode : undefined
                );
            }
        };

        const ambientImage = ref<string>('');
        const computeAmbient = () => {
            const path = props.backdropPath || props.posterPath;
            ambientImage.value = path ? useWebImage(path, 'large') : '';
        };

        const onLoad = () => {
            window.setTimeout(() => {
                isLoading.value = false;
                hasError.value = false;
                stopMessages();
            }, 600);
        };

        const onError = () => {
            isLoading.value = false;
            hasError.value = true;
            stopMessages();
        };

        const retry = () => {
            hasError.value = false;
            isLoading.value = true;
            startMessages();
            if (frameEl.value && props.embedUrl) {
                const src = frameEl.value.src;
                frameEl.value.src = '';
                window.setTimeout(() => {
                    if (frameEl.value) frameEl.value.src = src;
                }, 80);
            }
        };

        // Internal single-attempt fetch
        const _attemptResolve = async (): Promise<any> => {
            const type = props.mediaType;

            if (props.embedUrl.startsWith('NATIVE:')) {
                let cleanUrl = props.embedUrl.substring(7);
                if (cleanUrl.startsWith('/api/cinestream') && typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
                    cleanUrl = `http://localhost:3000/api/cinestream/resolve${cleanUrl.substring(15)}`;
                }
                console.log(`[StreamFrame] Native direct fetch: ${cleanUrl}`);
                const resolveRes = await fetch(cleanUrl);
                if (!resolveRes.ok) throw new Error('Moovie resolver is offline');
                return await resolveRes.json();
            } else {
                const titleEnc = encodeURIComponent(props.title);
                const searchUrl = `https://api.moovie.fun/vps-proxy/search?q=${titleEnc}&type=${type === 'movie' ? 'movie' : 'tv'}`;
                const searchRes = await fetch(searchUrl);
                if (!searchRes.ok) throw new Error('Metadata resolver is currently offline');
                const searchData = await searchRes.json();
                const item = searchData.results?.[0];
                if (!item) throw new Error('No matching streaming source found');
                const detailPath = item.raw?.detailPath || item.pageUrl;
                const subjectId = item.id;
                const resolveUrl = `https://api.moovie.fun/vps-proxy/resolve?detailPath=${encodeURIComponent(detailPath)}&subjectId=${subjectId}&type=${type}&season=${props.season}&episode=${props.episode}`;
                const resolveRes = await fetch(resolveUrl);
                if (!resolveRes.ok) throw new Error('Failed to resolve media stream URLs');
                return await resolveRes.json();
            }
        };

        // Resolves stream links — with auto-retry on failure
        const resolveStream = async (isAutoRetry = false) => {
            if (!isNative.value) return;

            // Clear any pending auto-retry timer
            if (autoRetryTimer) {
                clearTimeout(autoRetryTimer);
                autoRetryTimer = null;
            }

            // Reset retry counter only if this is a fresh user-initiated resolve
            if (!isAutoRetry) {
                autoRetryCount.value = 0;
            }

            // Priority 3: Check prefetch cache first
            const cachedData = getCachedStream(
                props.mediaId,
                props.mediaType,
                props.mediaType === 'tv' ? props.season : undefined,
                props.mediaType === 'tv' || props.mediaType === 'anime' ? props.episode : undefined
            );

            if (cachedData) {
                console.log('[StreamFrame] Using prefetched stream data');
                isResolving.value = false;
                isLoading.value = false;
                resolveError.value = '';
                autoRetryCount.value = 0;
                processStreamData(cachedData);
                return;
            }

            isResolving.value = true;
            resolveError.value = '';
            videoUrl.value = '';
            subtitles.value = [];
            resolutions.value = [];

            try {
                const resolveData = await _attemptResolve();
                autoRetryCount.value = 0; // Success — reset counter
                processStreamData(resolveData);

            } catch (err: any) {
                const isNoVideos = err.message && err.message.includes('No videos found');

                if (isNoVideos) {
                    // Hard stop — no point retrying
                    resolveError.value = err.message;
                    console.log('[StreamFrame]', err.message);
                } else if (autoRetryCount.value < MAX_AUTO_RETRIES) {
                    // Auto-retry: silently retry after 3 seconds
                    autoRetryCount.value++;
                    console.log(`[StreamFrame] Resolve failed (${autoRetryCount.value}/${MAX_AUTO_RETRIES}), retrying in 3s...`, err.message);
                    // Stay in resolving state (keep spinner), schedule next attempt
                    isResolving.value = true;
                    autoRetryTimer = setTimeout(() => {
                        resolveStream(true);
                    }, 3000);
                    return; // Don't hit the finally block below yet
                } else {
                    // All retries exhausted
                    console.error('[STREAM_RESOLVER_ERROR] All retries exhausted', err);
                    autoRetryCount.value = 0;
                    
                    // Auto-switch to Cinemaos for movies and TV shows (not anime)
                    if (props.mediaType === 'movie' || props.mediaType === 'tv') {
                        console.log('[StreamFrame] Switching to Cinemaos after failed retries...');
                        resolveError.value = 'Switching to Cinemaos...';
                        
                        // Switch to Cinemaos (server index 0) after a short delay
                        setTimeout(() => {
                            emit('switch-to-server', 0);
                        }, 1500);
                    } else {
                        // For anime, just show error
                        resolveError.value = err.message || 'Failed to strike print';
                    }
                }
            } finally {
                if (!autoRetryTimer) {
                    isResolving.value = false;
                    isLoading.value = false;
                }
            }
        };

        // Helper function to process stream data (used by both cached and fresh data)
        const processStreamData = (resolveData: any) => {
            // Check if Moovie returned no videos
            if (!resolveData.stream && (!resolveData.options || resolveData.options.length === 0)) {
                // Check if this is a Moovie request
                if (props.embedUrl.includes('cinestream') || props.embedUrl.includes('NATIVE:')) {
                    console.log('[StreamFrame] Moovie returned no videos, switching to Cinemaos...');
                    
                    // Auto-switch to Cinemaos (server index 0) after a short delay
                    setTimeout(() => {
                        emit('switch-to-server', 0); // Cinemaos is at index 0
                    }, 1500);
                    
                    // Throw error to be caught and displayed
                    throw new Error('No videos found. Switching to Cinemaos...');
                }
                throw new Error('Streaming resource is currently offline for this item');
            }

            // Format stream options
            const streamOptions = resolveData.options || [];
            resolutions.value = streamOptions.map((opt: any) => ({
                label: `${opt.quality || 'Auto'} (${opt.format?.toUpperCase() || 'M3U8'})`,
                url: opt.url
            }));

            // Reset auto-fallback state for new content
            currentStreamIndex.value = 0;
            isUserManualSwitch.value = false;
            hasPlayedSuccessfully.value = false;

            const defaultStream = resolveData.stream || streamOptions[0];
            videoUrl.value = defaultStream.url;

            // Subtitles options mapping
            const captionOptions = resolveData.captions || [];
            subtitles.value = captionOptions.map((sub: any, idx: number) => {
                let subUrl = sub.url;
                if (subUrl.startsWith('/api/cinestream') && typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
                    if (subUrl.includes('proxyUrl=')) {
                        const proxyUrlParam = subUrl.split('proxyUrl=')[1];
                        subUrl = `http://localhost:3000/api/cinestream/proxy?url=${proxyUrlParam}`;
                    } else if (subUrl.includes('subUrl=')) {
                        const subParam = subUrl.split('subUrl=')[1];
                        subUrl = `http://localhost:3000/api/cinestream/proxy?url=${subParam}`;
                    }
                }
                return {
                    label: sub.language,
                    src: subUrl,
                    srclang: sub.languageCode || 'en',
                    default: idx === 0 || sub.language.toLowerCase() === 'english'
                };
            });
        };

        // Auto-fallback: Switch to next stream if current one is buffering
        const tryNextStream = () => {
            if (isUserManualSwitch.value || hasPlayedSuccessfully.value) {
                console.log('[AUTO-FALLBACK] Skipping auto-switch (user control or already playing)');
                return;
            }

            // First, try different qualities of the same stream
            if (artplayerInstance && artplayerInstance.quality && artplayerInstance.quality.length > 1) {
                const currentQuality = artplayerInstance.quality.find((q: any) => q.default);
                
                if (currentQuality) {
                    const currentIndex = artplayerInstance.quality.indexOf(currentQuality);
                    
                    // Try next quality in the same stream
                    if (currentIndex < artplayerInstance.quality.length - 1) {
                        const nextQuality = artplayerInstance.quality[currentIndex + 1];
                        console.log(`[AUTO-FALLBACK] Switching to next quality: ${nextQuality.html}`);
                        
                        if (artplayerInstance) {
                            artplayerInstance.notice.show = `Switching to ${nextQuality.html}...`;
                            artplayerInstance.switchQuality(nextQuality.url);
                        }
                        return;
                    }
                }
            }

            // If no more qualities, try next stream source
            if (currentStreamIndex.value < resolutions.value.length - 1) {
                currentStreamIndex.value++;
                const nextStream = resolutions.value[currentStreamIndex.value];
                console.log(`[AUTO-FALLBACK] Switching to stream ${currentStreamIndex.value + 1}/${resolutions.value.length}: ${nextStream.label}`);
                
                videoUrl.value = nextStream.url;
                
                // Show notification to user
                if (artplayerInstance) {
                    artplayerInstance.notice.show = `Switching to backup stream (${currentStreamIndex.value + 1}/${resolutions.value.length})...`;
                }
            } else {
                console.log('[AUTO-FALLBACK] No more streams available');
                if (artplayerInstance) {
                    artplayerInstance.notice.show = 'All streams failed. Please try a different server.';
                }
            }
        };

        const initArtPlayer = () => {
            if (!artPlayerRef.value || !videoUrl.value) return;

            if (artplayerInstance) {
                artplayerInstance.destroy();
                artplayerInstance = null;
            }

            const qualityList = resolutions.value.map((res: any) => ({
                html: res.label,
                url: res.url,
                default: res.url === videoUrl.value
            }));

            // Sort qualities to prioritize 1080p and working streams
            const sortedQualities = [...qualityList].sort((a, b) => {
                // Prioritize 1080p
                if (a.html.includes('1080') && !b.html.includes('1080')) return -1;
                if (!a.html.includes('1080') && b.html.includes('1080')) return 1;
                
                // Then prioritize M3U8 format
                if (a.html.includes('M3U8') && !b.html.includes('M3U8')) return -1;
                if (!a.html.includes('M3U8') && b.html.includes('M3U8')) return 1;
                
                return 0;
            });

            // Use the best quality as default if available
            const bestQuality = sortedQualities[0];
            if (bestQuality && !isUserManualSwitch.value) {
                videoUrl.value = bestQuality.url;
                console.log(`[AUTO-FALLBACK] Auto-selecting best quality: ${bestQuality.html}`);
            }

            // Update quality list with new default
            const finalQualityList = qualityList.map(q => ({
                ...q,
                default: q.url === videoUrl.value
            }));

            const subtitleList = subtitles.value.map((sub: any) => ({
                html: sub.label,
                url: sub.src,
                default: sub.default
            }));

            const activeSub = subtitleList.find((s) => s.default);

            const isM3U8 = videoUrl.value.toLowerCase().includes('m3u8') || videoUrl.value.toLowerCase().includes('hls') || videoUrl.value.toLowerCase().includes('type=hls');
            
            // Build Artplayer config
            const artplayerConfig: any = {
                container: artPlayerRef.value as HTMLDivElement,
                url: videoUrl.value,
                type: isM3U8 ? 'm3u8' : 'mp4',
                autoplay: true,
                playbackRate: true,
                aspectRatio: true,
                setting: true,
                hotkey: true,
                pip: true,
                fullscreen: true,
                fullscreenWeb: true,
                miniProgressBar: false,
                theme: '#E50914', // Premium Netflix Red theme
                quality: finalQualityList,
                controls: [
                    {
                        position: 'right',
                        html: '<span class="art-icon" style="cursor: pointer; display: flex; align-items: center; justify-content: center; width: 40px; height: 100%; opacity: 0.8; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.8" title="Download Moovie Stream"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #10b981;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></span>',
                        click: function () {
                            openDownloadModal();
                        }
                    }
                ],
                customType: {
                    m3u8: function (video: HTMLVideoElement, url: string, art: any) {
                        if (Hls.isSupported()) {
                            if (art.hls) art.hls.destroy();
                            const hls = new Hls();
                            hls.loadSource(url);
                            hls.attachMedia(video);
                            art.hls = hls;
                            art.on('destroy', () => hls.destroy());
                        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                            video.src = url;
                        } else {
                            art.notice.show = 'Unsupported media type';
                        }
                    }
                },
                settings: [
                    {
                        html: 'Subtitles',
                        width: 250,
                        tooltip: activeSub?.html || 'Off',
                        selector: [
                            {
                                html: 'Off',
                                default: !activeSub,
                                url: ''
                            },
                            ...subtitleList.map((sub) => ({
                                html: sub.html,
                                default: sub.default,
                                url: sub.url
                            }))
                        ],
                        onSelect: (item: any) => {
                            if (artplayerInstance) {
                                if (item.url) {
                                    artplayerInstance.subtitle.url = item.url;
                                    artplayerInstance.subtitle.show = true;
                                } else {
                                    artplayerInstance.subtitle.show = false;
                                }
                            }
                            return item.html;
                        }
                    }
                ]
            };

            // Only add subtitle config if we have a valid subtitle
            if (activeSub && activeSub.url) {
                artplayerConfig.subtitle = {
                    url: activeSub.url,
                    type: 'vtt',
                    style: {
                        color: '#ffffff',
                        fontSize: '24px',
                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)'
                    }
                };
            }

            artplayerInstance = new Artplayer(artplayerConfig);

            // Auto-fallback: Monitor buffering and playing events
            artplayerInstance.on('video:waiting', () => {
                if (hasPlayedSuccessfully.value || isUserManualSwitch.value) {
                    // Normal buffering during playback, don't auto-switch
                    return;
                }

                console.log('[AUTO-FALLBACK] Video buffering detected, starting 2s timeout...');
                
                // Clear any existing timeout
                if (bufferingTimeout) {
                    clearTimeout(bufferingTimeout);
                }

                // Set 2-second timeout to switch to next stream
                bufferingTimeout = setTimeout(() => {
                    console.log('[AUTO-FALLBACK] Buffering timeout reached, trying next stream...');
                    tryNextStream();
                }, 2000);
            });

            artplayerInstance.on('video:playing', () => {
                console.log('[AUTO-FALLBACK] Video playing successfully');
                hasPlayedSuccessfully.value = true;
                
                // Clear buffering timeout if video starts playing
                if (bufferingTimeout) {
                    clearTimeout(bufferingTimeout);
                    bufferingTimeout = null;
                }
            });

            artplayerInstance.on('video:canplay', () => {
                // Clear buffering timeout when video is ready to play
                if (bufferingTimeout) {
                    clearTimeout(bufferingTimeout);
                    bufferingTimeout = null;
                }
            });

            artplayerInstance.on('video:error', () => {
                console.log('[AUTO-FALLBACK] Video error detected, trying next stream...');
                tryNextStream();
            });

            // Auto-fallback: Try 1080p quality first if available
            artplayerInstance.on('video:loadstart', () => {
                if (hasPlayedSuccessfully.value || isUserManualSwitch.value) {
                    return;
                }

                // Look for 1080p quality and switch to it if current is not working
                setTimeout(() => {
                    if (artplayerInstance && artplayerInstance.quality && artplayerInstance.quality.length > 1) {
                        const currentQuality = artplayerInstance.quality.find((q: any) => q.default);
                        const quality1080p = artplayerInstance.quality.find((q: any) => 
                            q.html && (q.html.includes('1080p') || q.html.includes('1080'))
                        );

                        // If current quality is not 1080p and 1080p is available, switch to it
                        if (quality1080p && currentQuality && currentQuality.url !== quality1080p.url) {
                            console.log('[AUTO-FALLBACK] Auto-selecting 1080p quality for better playback');
                            artplayerInstance.notice.show = 'Switching to 1080p for better quality...';
                            artplayerInstance.switchQuality(quality1080p.url);
                        }
                    }
                }, 1000); // Wait 1 second for qualities to load
            });

            artplayerInstance.on('quality', (quality: any) => {
                console.log('[ARTPLAYER] Quality changed by user:', quality.html);
                isUserManualSwitch.value = true; // User manually changed quality
                videoUrl.value = quality.url;
            });

            applyArtplayerCompactUi(artplayerInstance);
        };

        const applyArtplayerCompactUi = (art: Artplayer) => {
            art.cssVar('--art-control-height', '34px');
            art.cssVar('--art-control-icon-size', '20px');
            art.cssVar('--art-control-icon-scale', 0.92);
            art.cssVar('--art-bottom-gap', '0px');
            art.cssVar('--art-progress-height', '3px');
            art.cssVar('--art-bottom-offset', '0px');
            art.cssVar('--art-padding', '8px');
            art.cssVar('--art-bottom-height', '37px');
        };

        watch(videoUrl, (next) => {
            if (next && isNative.value) {
                if (!artplayerInstance) {
                    initArtPlayer();
                } else if (artplayerInstance.url !== next) {
                    const isM3U8 = next.toLowerCase().includes('m3u8') || next.toLowerCase().includes('hls') || next.toLowerCase().includes('type=hls');
                    (artplayerInstance as any).switch(next, isM3U8 ? 'm3u8' : 'mp4');
                }
            }
        });

        watch([resolutions, subtitles], () => {
            if (isNative.value && videoUrl.value) {
                window.setTimeout(() => {
                    initArtPlayer();
                }, 50);
            }
        });

        watch(
            () => props.embedUrl,
            (next, prev) => {
                if (next && next !== prev) {
                    if (isNative.value) {
                        resolveStream();
                    } else {
                        isLoading.value = true;
                        hasError.value = false;
                        startMessages();
                    }
                    startTrackingIfNeeded();
                }
            }
        );

        watch(
            () => [props.season, props.episode],
            () => {
                if (isNative.value) {
                    resolveStream();
                }
            }
        );

        watch(
            () => [props.backdropPath, props.posterPath],
            () => computeAmbient(),
            { immediate: true }
        );

        // Downloader modal handlers
        const openDownloadModal = () => {
            showDownloadModal.value = true;
            startFreshScrape();
        };

        const closeDownloadModal = () => {
            showDownloadModal.value = false;
        };

        const resolveServerSize = async (url: string, index: number) => {
            try {
                // Fire rapid lightweight HEAD request to read content length
                const response = await fetch(url, { method: 'HEAD' });
                const contentLength = response.headers.get('content-length');
                if (contentLength) {
                    const bytes = parseInt(contentLength, 10);
                    if (!isNaN(bytes) && bytes > 0) {
                        const mb = bytes / (1024 * 1024);
                        if (mb >= 1000) {
                            const gb = mb / 1024;
                            filteredMp4Servers.value[index].size = `${gb.toFixed(2)} GB`;
                        } else {
                            filteredMp4Servers.value[index].size = `${Math.round(mb)} MB`;
                        }
                    } else {
                        filteredMp4Servers.value[index].size = 'Direct MP4';
                    }
                } else {
                    filteredMp4Servers.value[index].size = 'Direct MP4';
                }
            } catch (e) {
                filteredMp4Servers.value[index].size = 'Direct MP4';
            } finally {
                filteredMp4Servers.value[index].loadingSize = false;
            }
        };

        const startFreshScrape = async () => {
            isScraping.value = true;
            scrapeError.value = '';
            filteredMp4Servers.value = [];

            try {
                let cleanUrl = props.embedUrl;
                if (cleanUrl.startsWith('NATIVE:')) {
                    cleanUrl = cleanUrl.substring(7);
                }

                let resolveUrl = '';
                if (cleanUrl.startsWith('/api/cinestream')) {
                    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
                        resolveUrl = `http://localhost:3000/api/cinestream/resolve${cleanUrl.substring(15)}`;
                    } else if (typeof window !== 'undefined') {
                        resolveUrl = `${window.location.origin}${cleanUrl}`;
                    }
                } else {
                    const type = props.mediaType;
                    const id = props.mediaId;
                    const base = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                        ? 'http://localhost:3000/api/cinestream/resolve'
                        : `${window.location.origin}/api/cinestream/resolve`;

                    resolveUrl = `${base}?type=${type}&id=${id}&title=${encodeURIComponent(props.title)}`;
                    if (props.mediaType === 'tv') {
                        resolveUrl += `&season=${props.season}&episode=${props.episode}`;
                    }
                }

                // Append cache buster to guarantee fresh scraping
                const freshUrl = `${resolveUrl}${resolveUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
                console.log(`[Direct MP4 Scrape] fresh scraping url: ${freshUrl}`);

                const res = await fetch(freshUrl);
                if (!res.ok) {
                    let errMsg = 'Scraper service returned an offline status';
                    try {
                        const errData = await res.json();
                        if (errData && errData.error) {
                            errMsg = errData.error;
                        }
                    } catch (e) {}
                    throw new Error(errMsg);
                }

                const data = await res.json();
                const allOptions = data.options || [];

                // Filter strictly for direct MP4 mirrors (not m3u8 playlists)
                const mp4Options = allOptions.filter((opt: any) => {
                    const urlLower = (opt.url || '').toLowerCase();
                    const formatLower = (opt.format || '').toLowerCase();
                    return !urlLower.includes('.m3u8') && !urlLower.includes('.hls') && !urlLower.includes('type=hls') && formatLower !== 'm3u8';
                });

                filteredMp4Servers.value = mp4Options.map((opt: any) => ({
                    server: opt.server || 'Direct MP4 Mirror',
                    quality: opt.quality || 'Auto',
                    url: opt.url,
                    size: '',
                    loadingSize: true,
                    copied: false
                }));

                // Fetch sizes in parallel asynchronously
                filteredMp4Servers.value.forEach((srv: any, idx: number) => {
                    resolveServerSize(srv.url, idx);
                });

            } catch (err: any) {
                console.error('[Fresh MP4 Scrape Failed]', err);
                scrapeError.value = err.message || 'Scraper failed to retrieve direct links';
            } finally {
                isScraping.value = false;
            }
        };

        const copyServerUrl = (srv: any, index: number) => {
            navigator.clipboard.writeText(srv.url).then(() => {
                filteredMp4Servers.value[index].copied = true;
                setTimeout(() => {
                    if (filteredMp4Servers.value[index]) {
                        filteredMp4Servers.value[index].copied = false;
                    }
                }, 2000);
            }).catch(() => {});
        };

        const downloadServerUrl = (srv: any) => {
            window.open(srv.url, '_blank');
        };

        onMounted(() => {
            if (isNative.value) {
                resolveStream();
            } else {
                startMessages();
                window.setTimeout(() => {
                    if (isLoading.value) onLoad();
                }, 15000);
            }
            startTrackingIfNeeded();
        });

        onUnmounted(() => {
            stopMessages();
            if (bufferingTimeout) {
                clearTimeout(bufferingTimeout);
                bufferingTimeout = null;
            }
            if (autoRetryTimer) {
                clearTimeout(autoRetryTimer);
                autoRetryTimer = null;
            }
            if (artplayerInstance) {
                artplayerInstance.destroy();
                artplayerInstance = null;
            }
            if (stopTracking) {
                stopTracking();
                stopTracking = null;
            }
        });

        return {
            rootRef,
            frameEl,
            artPlayerRef,
            isLoading,
            hasError,
            loadingLabel,
            ambientImage,
            isNative,
            sandboxAttribute,
            videoUrl,
            subtitles,
            resolutions,
            isResolving,
            resolveError,
            autoRetryCount,
            MAX_AUTO_RETRIES,
            onLoad,
            onError,
            retry,
            resolveStream,
            showDownloadModal,
            closeDownloadModal,
            isScraping,
            scrapeError,
            filteredMp4Servers,
            startFreshScrape,
            copyServerUrl,
            downloadServerUrl
        };
    }
});
</script>

<style lang="scss" scoped>
.stream-frame {
    position: relative;
    width: 100%;
    isolation: isolate;

    &__bloom {
        position: absolute;
        inset: -10% -5%;
        width: fit-content;
        background-size: cover;
        background-position: center;
        filter: blur(80px) saturate(1.4) brightness(0.55);
        opacity: 0.55;
        z-index: -1;
        pointer-events: none;

        &::after {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(
                ellipse at center,
                transparent 0%,
                var(--ink-900) 78%
            );
        }
    }

    &__stage {
        position: relative;
        width: 100%;
        max-width: 1280px;
        margin: 0 auto;
        padding: 0 var(--s-4) var(--s-5) var(--s-4);

        @media (min-width: 768px) and (max-width: 1023px) {
            padding: 0 var(--s-5) var(--s-6) var(--s-5);
        }

        @media (min-width: 1024px) {
            padding: 0;
        }
    }

    &__player {
        position: relative;
        aspect-ratio: 16 / 9;
        background: #000;
        border-radius: var(--r-lg);
        overflow: hidden;
        box-shadow:
            0 32px 80px rgba(0, 0, 0, 0.6),
            0 0 60px rgba(var(--ambient), 0.18),
            0 0 0 1px var(--rule);
        transition: box-shadow var(--dur-slow) var(--ease-out);
    }

    &__native-wrapper {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: #000;
    }

    &__artplayer {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        background: #000;
    }

    &__settings-bar {
        position: absolute;
        bottom: 50px;
        right: var(--s-4);
        display: flex;
        align-items: center;
        gap: var(--s-3);
        background: rgba(11, 10, 8, 0.85);
        backdrop-filter: blur(8px);
        padding: 0.5rem 0.85rem;
        border-radius: var(--r-pill);
        box-shadow: inset 0 0 0 1px var(--rule);
        z-index: 10;
        pointer-events: auto;
        opacity: 0;
        transition: opacity var(--dur-fast) var(--ease-out);

        .stream-frame__player:hover & {
            opacity: 1;
        }

        .meta {
            color: var(--bone-400);
            font-weight: 600;
            font-size: var(--fs-xs);
            letter-spacing: var(--ls-micro);
            text-transform: uppercase;
        }
    }

    &__selector {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--bone-100);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);

        select {
            background: var(--surface-tint);
            border: 1px solid var(--rule-strong);
            color: var(--bone-50);
            font-size: var(--fs-xs);
            font-weight: 600;
            border-radius: var(--r-md);
            padding: 2px 6px;
            cursor: pointer;
            outline: none;
            transition: background var(--dur-fast) var(--ease-out);

            &:hover {
                background: var(--surface-tint-hover);
            }
        }
    }

    &__iframe {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: 0;
    }

    &__loading {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background: var(--ink-900);
        z-index: 5;
    }

    &__skeleton {
        position: absolute;
        inset: 0;
        background:
            linear-gradient(
                100deg,
                rgba(255, 255, 255, 0) 30%,
                rgba(255, 255, 255, 0.04) 50%,
                rgba(255, 255, 255, 0) 70%
            ) var(--ink-800);
        background-size: 220% 100%;
        animation: streamFrameShimmer 2.4s infinite ease-in-out;
    }

    &__loader {
        position: relative;
        z-index: 1;
        display: grid;
        gap: var(--s-3);
        justify-items: center;
        color: var(--bone-200);
    }

    &__spinner {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 2px solid var(--rule-strong);
        border-top-color: var(--ember);
        animation: streamFrameSpin 1.1s linear infinite;
    }

    &__error {
        position: absolute;
        inset: 0;
        display: grid;
        place-content: center;
        gap: var(--s-3);
        text-align: center;
        padding: var(--s-6);
        background: var(--ink-900);
        z-index: 5;

        h3 {
            font-family: var(--font-display);
            font-size: var(--fs-2xl);
            color: var(--bone-50);
            margin: 0;
            letter-spacing: var(--ls-tight);
        }
    }

    &__error-message {
        color: var(--bone-200);
        max-width: 360px;
        margin: 0 auto;
    }

    &__retry {
        margin-top: var(--s-2);
        padding: 0.65rem 1.4rem;
        background: var(--ember);
        color: var(--ink-900);
        border: 0;
        border-radius: var(--r-pill);
        font-family: var(--font-ui);
        font-weight: 600;
        cursor: pointer;
        transition:
            background-color var(--dur-fast) var(--ease-out),
            transform var(--dur-fast) var(--ease-out);

        &:hover {
            background: var(--ember-600);
            transform: translateY(-1px);
        }
    }
}

@keyframes streamFrameShimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}

@keyframes streamFrameSpin {
    to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
    .stream-frame__skeleton,
    .stream-frame__spinner {
        animation: none;
    }
}

@import url('/artplayer-compact.css');

/* Direct Downloader Modal Styles */
.dl-modal {
    position: absolute;
    inset: 0;
    z-index: 100;
    background: rgba(11, 10, 8, 0.94);
    backdrop-filter: blur(16px);
    display: grid;
    place-items: center;
    padding: var(--s-4);
    animation: fadeIn 0.25s var(--ease-out);

    &__content {
        background: linear-gradient(135deg, rgba(23, 22, 20, 0.96) 0%, rgba(15, 14, 12, 0.99) 100%);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: var(--r-xl);
        width: 100%;
        max-width: 480px; /* Slim and elegant to sit centered on the video player stage */
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.05);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: scaleUp 0.3s var(--ease-out);
    }

    &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--s-3) var(--s-4);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);

        h3 {
            margin: 0;
            font-family: var(--font-display);
            font-size: var(--fs-base);
            font-weight: 600;
            color: var(--bone-50);
            display: flex;
            align-items: center;
            gap: var(--s-2);
        }
    }

    &__close {
        all: unset;
        font-size: var(--fs-2xl);
        color: var(--bone-400);
        cursor: pointer;
        line-height: 1;
        transition: color 0.15s;

        &:hover {
            color: var(--ember);
        }
    }

    &__body {
        padding: var(--s-4);
        overflow-y: auto;
        max-height: 240px; /* Scrollable list, stays compact */
        display: flex;
        flex-direction: column;
        gap: var(--s-2);
    }

    &__intro {
        margin: 0 0 var(--s-2) 0;
        font-size: var(--fs-xs);
        color: var(--bone-300);
        line-height: var(--lh-base);
    }

    &__loading {
        padding: var(--s-8) var(--s-4);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: var(--s-3);

        p {
            margin: 0;
            font-size: var(--fs-sm);
            font-weight: 500;
            color: var(--bone-100);
        }

        .sub {
            font-size: var(--fs-xs);
            color: var(--bone-400);
        }
    }

    &__spinner {
        width: 32px;
        height: 32px;
        border: 3px solid rgba(255, 255, 255, 0.08);
        border-top-color: var(--ember);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    &__error {
        padding: var(--s-8) var(--s-4);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: var(--s-3);
        color: var(--bone-300);

        .error-title {
            font-family: var(--font-display);
            font-size: var(--fs-base);
            font-weight: 500;
            color: var(--bone-100);
        }

        p:not(.error-title) {
            font-size: var(--fs-xs);
            margin: 0;
            max-width: 280px;
        }
    }

    &__retry-btn {
        all: unset;
        background: var(--surface-tint);
        color: var(--bone-50);
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: var(--s-2) var(--s-4);
        border-radius: var(--r-pill);
        font-weight: 600;
        font-size: var(--fs-xs);
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s;

        &:hover {
            background: var(--ember);
            color: var(--ink-900);
        }
    }
}

.dl-servers-list {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
}

.dl-server-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: var(--r-md);
    padding: var(--s-2) var(--s-3);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--s-3);
    transition: background 0.2s, border-color 0.2s;

    &:hover {
        background: rgba(255, 255, 255, 0.04);
        border-color: rgba(255, 255, 255, 0.08);
    }

    &__meta {
        display: flex;
        align-items: center;
        gap: var(--s-2);
        min-width: 0;

        .server-name {
            margin: 0;
            font-size: var(--fs-sm);
            font-weight: 500;
            color: var(--bone-100);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .badge {
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 1px 4px;
            border-radius: 3px;
            letter-spacing: 0.5px;
            flex-shrink: 0;

            &.quality {
                background: rgba(139, 92, 246, 0.15);
                color: #a78bfa;
                border: 1px solid rgba(139, 92, 246, 0.3);
            }

            &.format {
                background: rgba(16, 185, 129, 0.15);
                color: #34d399;
                border: 1px solid rgba(16, 185, 129, 0.3);
            }
        }
    }

    &__actions {
        display: flex;
        align-items: center;
        gap: var(--s-2);
        flex-shrink: 0;

        .size-label {
            font-size: var(--fs-xs);
            color: var(--bone-300);
            font-weight: 500;
            white-space: nowrap;
        }

        .btn-group {
            display: flex;
            align-items: center;
            gap: var(--s-1);
        }
    }
}

.dl-action-btn {
    all: unset;
    padding: var(--s-1) var(--s-2);
    border-radius: var(--r-pill);
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s var(--ease-out);

    &.copy {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: var(--bone-200);

        &:hover {
            background: rgba(255, 255, 255, 0.1);
            color: var(--bone-50);
        }
    }

    &.download {
        background: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.3);
        color: #34d399;

        &:hover {
            background: rgba(16, 185, 129, 0.2);
            color: #6ee7b7;
            transform: translateY(-1px);
        }
    }
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes scaleUp {
    from { transform: scale(0.96); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
</style>
