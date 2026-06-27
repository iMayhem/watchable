<template>
    <div
        ref="shellRef"
        class="nf-watch"
        :class="{
            'nf-watch--party-embed': embedMode === 'party',
            'is-idle': !controlsVisible && artReady && !switchingAudioLabel && !switchingEpisodeLabel && !menuOpen && !episodesOpen && !upNextActive && !skipActionVisible,
            'is-fs': isFullscreen,
            'is-switching-audio': Boolean(switchingAudioLabel),
            'is-switching-episode': Boolean(switchingEpisodeLabel),
            'is-menu-open': menuOpen,
            'is-episodes-open': episodesOpen,
            'is-extension-gate': extensionGateVisible && !extensionGateCompact
        }"
        @mousemove="revealControls"
        @touchstart.passive="revealControls"
        @click="onShellClick"
    >
        <div class="nf-watch__video">
            <div ref="stageRef" class="nf-watch__stage" />
            <button
                v-if="canTapVideo"
                type="button"
                class="nf-watch__tap-layer"
                :aria-label="isPlaying ? 'Pause' : 'Play'"
                @click.stop="onVideoTap"
            />
            <div
                v-if="(loading || !artReady) && (!extensionGateVisible || extensionGateCompact)"
                class="nf-watch__loader"
                aria-live="polite"
            >
                <span class="nf-watch__spinner" aria-hidden="true" />
                <p>{{ loading ? 'Loading your video…' : 'Starting playback…' }}</p>
            </div>

            <PlayerExtensionGate
                v-if="extensionGateVisible"
                :compact="extensionGateCompact"
                @recheck="$emit('extension-recheck')"
                @stream-slow="$emit('extension-stream-slow')"
            />

            <div
                v-if="switchingAudioLabel"
                class="nf-watch__status-overlay"
                role="status"
                aria-live="polite"
            >
                <div class="nf-watch__status-card">
                    <span class="nf-watch__status-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                            <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />
                            <path d="M15.5 8.5a4.5 4.5 0 0 1 0 7" stroke-linecap="round" />
                            <path d="M18 6a7.5 7.5 0 0 1 0 12" stroke-linecap="round" />
                        </svg>
                    </span>
                    <p class="nf-watch__status-title">Changing audio</p>
                    <p class="nf-watch__status-label">{{ switchingAudioLabel }}</p>
                    <span class="nf-watch__spinner nf-watch__status-spinner" aria-hidden="true" />
                </div>
            </div>

            <button
                v-if="skipActionVisible"
                type="button"
                class="nf-watch__skip-btn"
                @click.stop="$emit('skip-segment')"
            >
                {{ skipActionLabel }}
            </button>

            <NetflixUpNext
                :active="upNextActive"
                :episode="upNextEpisode"
                @play-now="$emit('up-next-play')"
                @cancel="$emit('up-next-cancel')"
                @complete="$emit('up-next-complete')"
            />

            <div
                v-if="switchingEpisodeLabel"
                class="nf-watch__status-overlay"
                role="status"
                aria-live="polite"
            >
                <div class="nf-watch__status-card">
                    <span class="nf-watch__status-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                            <rect x="3" y="5" width="18" height="14" rx="2" />
                            <path d="M10 9.5v5l4.5-2.5L10 9.5z" fill="currentColor" stroke="none" />
                        </svg>
                    </span>
                    <p class="nf-watch__status-title">Changing episode</p>
                    <p class="nf-watch__status-label">{{ switchingEpisodeLabel }}</p>
                    <span class="nf-watch__spinner nf-watch__status-spinner" aria-hidden="true" />
                </div>
            </div>
        </div>

        <div class="nf-watch__shade nf-watch__shade--top" aria-hidden="true" />
        <div class="nf-watch__shade nf-watch__shade--bottom" aria-hidden="true" />

        <header class="nf-watch__top" @click.stop>
            <button
                v-if="embedMode !== 'party'"
                type="button"
                class="nf-watch__icon-btn"
                aria-label="Back"
                @click.stop="$emit('back')"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </button>
            <div class="nf-watch__meta">
                <h1 class="nf-watch__title">{{ title }}</h1>
                <p v-if="subtitle" class="nf-watch__subtitle">{{ subtitle }}</p>
            </div>
            <a
                v-if="partyHref"
                :href="partyHref"
                class="nf-watch__party-btn"
                title="Watch Together with friends!"
                rel="nofollow"
                @click.prevent="onWatchTogether"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="nf-watch__party-icon">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span class="nf-watch__party-label">Watch Together</span>
            </a>
        </header>

        <div class="nf-watch__controls" @click.stop>
            <div
                class="nf-watch__progress"
                role="slider"
                aria-label="Seek"
                :aria-valuenow="Math.round(progress)"
                aria-valuemin="0"
                aria-valuemax="100"
                @click.stop="onProgressClick"
                @mousemove="onProgressHover"
                @mouseleave="hidePreview"
            >
                <div class="nf-watch__progress-buffer" :style="{ width: `${bufferProgress}%` }" />
                <div class="nf-watch__progress-fill" :style="{ width: `${progress}%` }">
                    <span class="nf-watch__progress-knob" />
                </div>
                <div
                    v-if="showPreview"
                    class="nf-watch__preview"
                    :style="{ left: `${previewLeft}%` }"
                >
                    <canvas
                        ref="previewCanvasEl"
                        class="nf-watch__preview-canvas"
                        width="160"
                        height="90"
                    />
                    <div class="nf-watch__preview-time">{{ formatPlayerTime(previewTime) }}</div>
                </div>
            </div>

            <!-- hidden video used only for seeking + frame capture on hover preview -->
            <video
                ref="previewVideoEl"
                class="nf-watch__preview-hidden"
                muted
                playsinline
                preload="metadata"
                @seeked="onPreviewSeeked"
            />

            <div class="nf-watch__bar">
                <div class="nf-watch__bar-left">
                    <button type="button" class="nf-watch__icon-btn" :aria-label="isPlaying ? 'Pause' : 'Play'" @click.stop="togglePlay">
                        <svg v-if="!isPlaying" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                        <svg v-else viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
                        </svg>
                    </button>

                    <button type="button" class="nf-watch__icon-btn nf-watch__icon-btn--label" aria-label="Rewind 10 seconds" @click.stop="skipBack(10)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                            <path d="M3 12a9 9 0 1 0 3-6.7" stroke-linecap="round" />
                            <path d="M3 4v5h5" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                        <span>10</span>
                    </button>

                    <button type="button" class="nf-watch__icon-btn nf-watch__icon-btn--label" aria-label="Forward 10 seconds" @click.stop="skipForward(10)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                            <path d="M21 12a9 9 0 1 1 -3-6.7" stroke-linecap="round" />
                            <path d="M21 4v5h-5" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                        <span>10</span>
                    </button>

                    <button type="button" class="nf-watch__icon-btn" :aria-label="isMuted ? 'Unmute' : 'Mute'" @click.stop="toggleMute">
                        <svg v-if="!isMuted" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.06c1.48-.74 2.5-2.26 2.5-4.03z" />
                        </svg>
                        <svg v-else viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 10v4h4l5 5V5L7 10H3zm11 4.17L15.83 14H18v-4h-2.17l1.17-1.17L16.17 8 14 10.17 11.83 8 10 9.83 11.17 11H9v2h2.17L10 14.17 11.83 16 14 13.83 16.17 16 18 14.17 16.83 13H19v-2h-2.17z" />
                        </svg>
                    </button>

                    <span class="nf-watch__time">
                        {{ formatPlayerTime(currentTime) }} / {{ formatPlayerTime(duration) }}
                    </span>
                </div>

                <div class="nf-watch__bar-right">
                    <button
                        v-if="showAnimeSkips"
                        type="button"
                        class="nf-watch__autoskip-btn"
                        :class="{ 'is-on': autoSkipEnabled }"
                        :aria-pressed="autoSkipEnabled"
                        @click.stop="$emit('toggle-auto-skip')"
                    >
                        Auto-skip {{ autoSkipEnabled ? 'On' : 'Off' }}
                    </button>

                    <button
                        v-if="showEpisodes"
                        type="button"
                        class="nf-watch__episodes-btn"
                        aria-haspopup="dialog"
                        :aria-expanded="episodesOpen"
                        @click.stop="toggleEpisodesPanel"
                    >
                        Episodes
                    </button>

                    <div ref="languageRef" class="nf-watch__quality nf-watch__language">
                        <button
                            type="button"
                            class="nf-watch__quality-btn"
                            aria-haspopup="listbox"
                            :aria-expanded="languageOpen"
                            :aria-busy="languagesLoading"
                            :disabled="languagesLoading && !languages.length"
                            @click.stop="toggleLanguageMenu"
                        >
                            {{ activeLanguageLabel }}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="m6 9 6 6 6-6" stroke-linecap="round" />
                            </svg>
                        </button>
                        <ul v-if="languageOpen" class="nf-watch__quality-menu nf-watch__language-menu" role="listbox">
                            <li v-if="languagesLoading" class="nf-watch__quality-loading" role="presentation">
                                Loading audio tracks…
                            </li>
                            <li
                                v-for="lang in languages"
                                :key="lang.category"
                                role="option"
                                :aria-selected="selectedLanguage === lang.category"
                            >
                                <button
                                    type="button"
                                    class="nf-watch__quality-item"
                                    :class="{ 'is-active': selectedLanguage === lang.category }"
                                    @click.stop="selectLanguage(lang.category)"
                                    @mouseenter="prefetchLanguage(lang.category)"
                                    @focus="prefetchLanguage(lang.category)"
                                >
                                    {{ lang.label }}
                                </button>
                            </li>
                        </ul>
                    </div>

                    <div ref="qualityRef" class="nf-watch__quality">
                        <button
                            type="button"
                            class="nf-watch__quality-btn"
                            aria-haspopup="listbox"
                            :aria-expanded="qualityOpen"
                            @click.stop="qualityOpen = !qualityOpen; languageOpen = false"
                        >
                            {{ activeQualityLabel }}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="m6 9 6 6 6-6" stroke-linecap="round" />
                            </svg>
                        </button>
                        <ul v-if="qualityOpen" class="nf-watch__quality-menu" role="listbox">
                            <li
                                v-for="(stream, index) in streams"
                                :key="stream.url"
                                role="option"
                                :aria-selected="selectedStreamIndex === index"
                            >
                                <button
                                    type="button"
                                    class="nf-watch__quality-item"
                                    :class="{ 'is-active': selectedStreamIndex === index }"
                                    @click.stop="selectQuality(index)"
                                >
                                    {{ stream.quality }}
                                </button>
                            </li>
                        </ul>
                    </div>

                    <button type="button" class="nf-watch__icon-btn" aria-label="Fullscreen" @click.stop="toggleFullscreen">
                        <svg v-if="!isFullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                            <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" stroke-linecap="round" />
                        </svg>
                        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                            <path d="M9 9H4V4M15 9h5V4M9 15H4v5M15 15h5v5" stroke-linecap="round" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>

        <div
            v-if="episodesOpen && showEpisodes"
            class="nf-watch__episodes"
            role="dialog"
            aria-label="Episodes"
            @click.stop
        >
            <button
                type="button"
                class="nf-watch__episodes-backdrop"
                aria-label="Close episodes"
                @click="episodesOpen = false"
            />
            <aside
                class="nf-watch__episodes-panel"
                @click.stop
                @pointerdown.stop
                @pointerup.stop
            >
                <header class="nf-watch__episodes-head">
                    <div class="nf-watch__episodes-intro">
                        <p v-if="title" class="nf-watch__episodes-show">{{ title }}</p>
                        <h2 class="nf-watch__episodes-label">Episodes</h2>
                    </div>
                    <button
                        type="button"
                        class="nf-watch__episodes-close"
                        aria-label="Close episodes"
                        @click="episodesOpen = false"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
                        </svg>
                    </button>
                </header>
                <NetflixEpisodePicker
                    panel
                    :seasons="episodeSeasons"
                    :episodes="episodeList"
                    :current-season="currentSeason"
                    :current-episode="currentEpisode"
                    :loading="episodesLoading"
                    @season-change="onEpisodeSeasonChange"
                    @select="onEpisodeSelect"
                    @prefetch="onEpisodePrefetch"
                    @previous="onEpisodePrevious"
                    @next="onEpisodeNext"
                />
            </aside>
        </div>

        <p v-if="streamWarning && !playbackError" class="nf-watch__warning" role="status">{{ streamWarning }}</p>
        <p v-if="playbackError" class="nf-watch__error" role="alert">{{ playbackError }}</p>
    </div>
</template>

<script lang="ts">
import {
    computed,
    defineComponent,
    onBeforeUnmount,
    onMounted,
    PropType,
    ref,
    watch
} from 'vue';
import {
    formatPlayerTime,
    type MoovieStream
} from '../../composables/useMooviePlayer';
import { nfDebug } from '../../composables/useNetflixDebug';
import {
    getLanguageOption,
    type NetflixLanguageOption
} from '../../composables/useNetflixLanguage';
import NetflixEpisodePicker from './NetflixEpisodePicker.vue';
import NetflixUpNext, { type NetflixUpNextEpisode } from './NetflixUpNext.vue';
import PlayerExtensionGate from './PlayerExtensionGate.vue';
import type {
    NetflixCatalogEpisode,
    NetflixCatalogSeason
} from '../../composables/useNetflixCatalogEpisodes';

export default defineComponent({
    name: 'NetflixPlayer',
    components: { NetflixEpisodePicker, NetflixUpNext, PlayerExtensionGate },
    props: {
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        extensionGateVisible: { type: Boolean, default: false },
        extensionGateCompact: { type: Boolean, default: false },
        loading: { type: Boolean, default: false },
        artReady: { type: Boolean, default: false },
        playbackError: { type: String, default: '' },
        streamWarning: { type: String, default: '' },
        isPlaying: { type: Boolean, default: false },
        currentTime: { type: Number, default: 0 },
        duration: { type: Number, default: 0 },
        progress: { type: Number, default: 0 },
        bufferProgress: { type: Number, default: 0 },
        isMuted: { type: Boolean, default: false },
        streams: { type: Array as PropType<MoovieStream[]>, default: () => [] },
        selectedStreamIndex: { type: Number, default: 0 },
        languages: { type: Array as PropType<NetflixLanguageOption[]>, default: () => [] },
        selectedLanguage: { type: String, default: 'hindi' },
        languagesLoading: { type: Boolean, default: false },
        switchingAudioLabel: { type: String, default: '' },
        switchingEpisodeLabel: { type: String, default: '' },
        showEpisodes: { type: Boolean, default: false },
        episodeSeasons: {
            type: Array as PropType<NetflixCatalogSeason[]>,
            default: () => []
        },
        episodeList: {
            type: Array as PropType<NetflixCatalogEpisode[]>,
            default: () => []
        },
        currentSeason: { type: Number, default: 1 },
        currentEpisode: { type: Number, default: 1 },
        episodesLoading: { type: Boolean, default: false },
        upNextActive: { type: Boolean, default: false },
        upNextEpisode: {
            type: Object as PropType<NetflixUpNextEpisode | null>,
            default: null
        },
        showAnimeSkips: { type: Boolean, default: false },
        skipActionVisible: { type: Boolean, default: false },
        skipActionLabel: { type: String, default: 'Skip Intro' },
        autoSkipEnabled: { type: Boolean, default: true },
        bindContainer: {
            type: Function as PropType<(el: HTMLElement | null) => void>,
            required: true
        },
        partyHref: { type: String, default: '' },
        embedMode: { type: String, default: '' }
    },
    emits: [
        'back',
        'toggle-play',
        'skip-back',
        'skip-forward',
        'toggle-mute',
        'seek',
        'quality',
        'language',
        'language-prefetch',
        'episode-select',
        'episode-prefetch',
        'episode-season-change',
        'episode-previous',
        'episode-next',
        'up-next-play',
        'up-next-cancel',
        'up-next-complete',
        'extension-recheck',
        'extension-stream-slow',
        'skip-segment',
        'toggle-auto-skip'
    ],
    setup(props, { emit }) {
        const shellRef = ref<HTMLElement | null>(null);
        const stageRef = ref<HTMLElement | null>(null);
        const qualityRef = ref<HTMLElement | null>(null);
        const languageRef = ref<HTMLElement | null>(null);
        const qualityOpen = ref(false);
        const languageOpen = ref(false);
        const episodesOpen = ref(false);
        const blockVideoTap = ref(false);
        const controlsVisible = ref(true);
        const isFullscreen = ref(false);
        let hideTimer: number | null = null;
        let tapLockTimer: number | null = null;

        const onWatchTogether = (event: MouseEvent) => {
            const target = event.currentTarget as HTMLAnchorElement;
            const href = target.href;
            setTimeout(() => {
                window.location.href = href;
            }, 50);
        };

        const lockVideoTap = (ms = 450) => {
            blockVideoTap.value = true;
            if (tapLockTimer !== null) window.clearTimeout(tapLockTimer);
            tapLockTimer = window.setTimeout(() => {
                blockVideoTap.value = false;
                tapLockTimer = null;
            }, ms);
        };

        const menuOpen = computed(
            () => qualityOpen.value || languageOpen.value || episodesOpen.value
        );

        const canTapVideo = computed(
            () =>
                props.artReady &&
                !props.loading &&
                !props.switchingAudioLabel &&
                !props.switchingEpisodeLabel &&
                !menuOpen.value &&
                !blockVideoTap.value
        );

        const activeQualityLabel = computed(() => {
            const stream = props.streams[props.selectedStreamIndex];
            return stream?.quality || 'Quality';
        });

        const activeLanguageLabel = computed(() => {
            const lang = props.languages.find((l) => l.category === props.selectedLanguage);
            if (lang?.label) return lang.label;
            if (props.selectedLanguage) {
                return getLanguageOption(props.selectedLanguage).label;
            }
            if (props.languagesLoading) return 'Audio…';
            return 'Language';
        });

        const revealControls = () => {
            controlsVisible.value = true;
            if (hideTimer !== null) window.clearTimeout(hideTimer);
            if (
                props.isPlaying &&
                props.artReady &&
                !qualityOpen.value &&
                !languageOpen.value &&
                !episodesOpen.value
            ) {
                hideTimer = window.setTimeout(() => {
                    if (!qualityOpen.value && !languageOpen.value && !episodesOpen.value) {
                        controlsVisible.value = false;
                    }
                }, 3200);
            }
        };

        const onVideoTap = () => {
            if (blockVideoTap.value || menuOpen.value) return;
            nfDebug('player-ui:tap-toggle');
            revealControls();
            emit('toggle-play');
        };

        const toggleEpisodesPanel = () => {
            episodesOpen.value = !episodesOpen.value;
            if (episodesOpen.value) {
                qualityOpen.value = false;
                languageOpen.value = false;
                controlsVisible.value = true;
                if (hideTimer !== null) window.clearTimeout(hideTimer);
            }
        };

        const onEpisodeSeasonChange = (season: number) => {
            emit('episode-season-change', season);
        };

        const onEpisodeSelect = (episode: number) => {
            lockVideoTap();
            emit('episode-select', props.currentSeason, episode);
        };

        const onEpisodePrefetch = (episode: number) => {
            emit('episode-prefetch', episode);
        };

        const onEpisodePrevious = () => {
            lockVideoTap();
            emit('episode-previous');
        };

        const onEpisodeNext = () => {
            lockVideoTap();
            emit('episode-next');
        };

        const onShellClick = () => {
            if (menuOpen.value) return;
            revealControls();
        };

        const onProgressClick = (event: MouseEvent) => {
            const bar = event.currentTarget as HTMLElement;
            const rect = bar.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
            const target = ratio * (props.duration || 0);
            nfDebug('player-ui:seek', { ratio, target });
            emit('seek', target);
        };

        // Hover preview on seek bar (shows frame at that time)
        const showPreview = ref(false);
        const previewTime = ref(0);
        const previewLeft = ref(0);
        const previewVideoEl = ref<HTMLVideoElement | null>(null);
        const previewCanvasEl = ref<HTMLCanvasElement | null>(null);
        let previewSeekRaf: number | null = null;

        const currentPreviewSrc = computed(() => {
            const idx = props.selectedStreamIndex ?? 0;
            const s = props.streams?.[idx];
            if (!s) return '';
            return s.url || '';
        });

        const onProgressHover = (event: MouseEvent) => {
            if (!props.duration) return;
            const bar = (event.currentTarget || event.target) as HTMLElement;
            if (!bar) return;
            const rect = bar.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const ratio = Math.max(0, Math.min(1, x / rect.width));
            const t = ratio * props.duration;

            previewTime.value = t;
            previewLeft.value = Math.max(6, Math.min(94, ratio * 100));
            showPreview.value = true;

            if (previewSeekRaf) cancelAnimationFrame(previewSeekRaf);
            previewSeekRaf = requestAnimationFrame(() => {
                const pv = previewVideoEl.value;
                if (pv && currentPreviewSrc.value) {
                    const doSeek = () => {
                        // seek; on 'seeked' we will capture to canvas
                        if (Math.abs((pv.currentTime || 0) - t) > 0.3) {
                            pv.currentTime = t;
                        } else {
                            capturePreviewFrame();
                        }
                    };
                    if (!pv.src || pv.src !== currentPreviewSrc.value) {
                        pv.src = currentPreviewSrc.value;
                        pv.load();
                        // Wait for metadata before seeking to a specific time
                        pv.addEventListener('loadedmetadata', doSeek, { once: true });
                    } else {
                        doSeek();
                    }
                }
            });
        };

        const hidePreview = () => {
            showPreview.value = false;
            if (previewSeekRaf) {
                cancelAnimationFrame(previewSeekRaf);
                previewSeekRaf = null;
            }
        };

        const capturePreviewFrame = () => {
            const pv = previewVideoEl.value;
            const canvas = previewCanvasEl.value;
            if (!pv || !canvas || !showPreview.value) return;
            try {
                pv.pause(); // keep it paused, we only want the frame
                const w = 160;
                const h = 90;
                if (canvas.width !== w) canvas.width = w;
                if (canvas.height !== h) canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(pv, 0, 0, w, h);
                }
            } catch (err) {
                // canvas may be tainted (CORS on some streams) or not ready; preview may be blank
            }
        };

        const onPreviewSeeked = () => {
            capturePreviewFrame();
        };

        // Preview video src is set lazily on first hover (to avoid interfering with main playback load)

        const selectQuality = (index: number) => {
            qualityOpen.value = false;
            languageOpen.value = false;
            nfDebug('player-ui:quality-select', { index });
            emit('quality', index);
        };

        const toggleLanguageMenu = () => {
            if (props.languagesLoading && !props.languages.length) return;
            languageOpen.value = !languageOpen.value;
            if (languageOpen.value) {
                qualityOpen.value = false;
                controlsVisible.value = true;
                if (hideTimer !== null) window.clearTimeout(hideTimer);
            }
        };

        const selectLanguage = (category: string) => {
            languageOpen.value = false;
            nfDebug('player-ui:language-select', { category });
            emit('language', category);
        };

        const prefetchLanguage = (category: string) => {
            emit('language-prefetch', category);
        };

        const toggleFullscreen = async () => {
            const el = shellRef.value;
            if (!el) return;
            if (!document.fullscreenElement) {
                nfDebug('player-ui:fullscreen:enter');
                await el.requestFullscreen?.();
            } else {
                nfDebug('player-ui:fullscreen:exit');
                await document.exitFullscreen?.();
            }
        };

        const onFullscreenChange = () => {
            isFullscreen.value = document.fullscreenElement === shellRef.value;
            nfDebug('player-ui:fullscreen:change', { active: isFullscreen.value });
        };

        const onDocClick = (event: MouseEvent) => {
            const target = event.target as Node;
            if (!qualityRef.value?.contains(target)) qualityOpen.value = false;
            if (!languageRef.value?.contains(target)) languageOpen.value = false;
        };

        watch(
            () => props.isPlaying,
            (playing) => {
                if (!playing) {
                    controlsVisible.value = true;
                    if (hideTimer !== null) window.clearTimeout(hideTimer);
                } else {
                    revealControls();
                }
            }
        );

        watch(
            () => props.switchingAudioLabel,
            (label) => {
                if (!label) return;
                controlsVisible.value = true;
                qualityOpen.value = false;
                languageOpen.value = false;
                episodesOpen.value = false;
                if (hideTimer !== null) window.clearTimeout(hideTimer);
            }
        );

        watch(
            () => props.switchingEpisodeLabel,
            (label) => {
                if (!label) return;
                controlsVisible.value = true;
                qualityOpen.value = false;
                languageOpen.value = false;
                episodesOpen.value = false;
                if (hideTimer !== null) window.clearTimeout(hideTimer);
            }
        );

        watch(
            stageRef,
            (el) => {
                nfDebug('player-ui:stage-bind', { hasElement: Boolean(el) });
                props.bindContainer(el);
            },
            { flush: 'post' }
        );

        watch(
            () => props.playbackError,
            (err) => {
                if (err) nfDebug('player-ui:error', err);
            }
        );

        watch(
            () => props.artReady,
            (ready) => {
                if (ready) nfDebug('player-ui:art-ready');
            }
        );

        const keepControlsForMenu = (open: boolean) => {
            if (open) {
                controlsVisible.value = true;
                if (hideTimer !== null) window.clearTimeout(hideTimer);
            }
        };

        watch(qualityOpen, keepControlsForMenu);
        watch(languageOpen, keepControlsForMenu);
        watch(episodesOpen, keepControlsForMenu);

        onMounted(() => {
            nfDebug('player-ui:mount');
            props.bindContainer(stageRef.value);
            document.addEventListener('fullscreenchange', onFullscreenChange);
            document.addEventListener('click', onDocClick);
            revealControls();
        });

        onBeforeUnmount(() => {
            props.bindContainer(null);
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            document.removeEventListener('click', onDocClick);
            if (hideTimer !== null) window.clearTimeout(hideTimer);
            if (tapLockTimer !== null) window.clearTimeout(tapLockTimer);
        });

        return {
            shellRef,
            stageRef,
            qualityRef,
            languageRef,
            qualityOpen,
            languageOpen,
            episodesOpen,
            menuOpen,
            toggleEpisodesPanel,
            onEpisodeSeasonChange,
            onEpisodeSelect,
            onEpisodePrefetch,
            onEpisodePrevious,
            onEpisodeNext,
            emit,
            controlsVisible,
            isFullscreen,
            activeQualityLabel,
            activeLanguageLabel,
            formatPlayerTime,
            revealControls,
            canTapVideo,
            onVideoTap,
            onShellClick,
            onProgressClick,
            onProgressHover,
            hidePreview,
            showPreview,
            previewTime,
            previewLeft,
            previewVideoEl,
            previewCanvasEl,
            onPreviewSeeked,
            selectQuality,
            toggleLanguageMenu,
            selectLanguage,
            prefetchLanguage,
            toggleFullscreen,
            togglePlay: () => emit('toggle-play'),
            skipBack: (s: number) => emit('skip-back', s),
            skipForward: (s: number) => emit('skip-forward', s),
            toggleMute: () => emit('toggle-mute'),
            onWatchTogether
        };
    }
});
</script>

<style lang="scss" scoped>
.nf-watch {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 100dvh;
    background: #000;
    color: #fff;
    overflow: hidden;
    user-select: none;

    &__video {
        position: absolute;
        inset: 0;
        z-index: 1;
        display: grid;
        place-items: center;
        background: #000;
        /* Contain Artplayer's internal z-index within this layer.
           Nothing inside this div can ever paint over sibling elements
           like the controls bar or language dropdown, no matter what
           z-index Artplayer sets via inline styles. */
        isolation: isolate;
    }

    &__stage {
        position: relative;
        z-index: 1;
        pointer-events: auto;
        width: 100%;
        height: 100%;

        :deep(.art-video-player) {
            z-index: 1 !important;
            width: 100% !important;
            height: 100% !important;
        }

        :deep(.art-video) {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain;
        }

        :deep(.art-layers),
        :deep(.art-mask),
        :deep(.art-controls),
        :deep(.art-bottom),
        :deep(.art-info),
        :deep(.art-settings),
        :deep(.art-contextmenus) {
            display: none !important;
        }
    }

    &__skip-btn {
        position: absolute;
        right: 1.5rem;
        top: 50%;
        z-index: 6;
        transform: translateY(-50%);
        padding: 0.65rem 1.35rem;
        border: 2px solid rgba(255, 255, 255, 0.85);
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.65);
        color: #fff;
        font-size: 0.95rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        cursor: pointer;
        transition: background 0.15s ease, transform 0.15s ease;

        &:hover {
            background: rgba(255, 255, 255, 0.14);
            transform: translateY(-50%) scale(1.02);
        }
    }

    &__tap-layer {
        position: absolute;
        inset: 0;
        z-index: 3;
        border: none;
        padding: 0;
        background: transparent;
        cursor: pointer;
    }

    &__status-overlay {
        position: absolute;
        inset: 0;
        z-index: 5;
        display: grid;
        place-content: center;
        background: rgba(0, 0, 0, 0.72);
        backdrop-filter: blur(4px);
        pointer-events: none;
    }

    &__status-card {
        display: grid;
        justify-items: center;
        gap: 0.55rem;
        padding: 1.35rem 1.75rem;
        border-radius: 12px;
        background: rgba(16, 16, 16, 0.92);
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
        min-width: min(88vw, 280px);
        text-align: center;
    }

    &__status-icon {
        display: grid;
        place-items: center;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: rgba(255, 90, 31, 0.14);
        color: var(--ember);

        svg {
            width: 28px;
            height: 28px;
        }
    }

    &__status-title {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: #fff;
        letter-spacing: 0.02em;
    }

    &__status-label {
        margin: 0;
        font-size: 0.82rem;
        color: rgba(255, 255, 255, 0.72);
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    &__status-spinner {
        width: 28px;
        height: 28px;
        margin-top: 0.25rem;
        border-width: 2px;
    }

    &__loader {
        position: absolute;
        inset: 0;
        z-index: 2;
        display: grid;
        place-content: center;
        gap: 1rem;
        text-align: center;
        background: rgba(0, 0, 0, 0.55);
        font-size: 0.95rem;
        color: rgba(255, 255, 255, 0.85);
    }

    &__spinner {
        width: 52px;
        height: 52px;
        margin: 0 auto;
        border: 3px solid rgba(255, 255, 255, 0.15);
        border-top-color: var(--ember);
        border-radius: 50%;
        animation: nf-spin 0.9s linear infinite;
    }

    &__shade {
        position: absolute;
        left: 0;
        right: 0;
        z-index: 3;
        pointer-events: none;

        &--top {
            top: 0;
            height: 120px;
            background: linear-gradient(180deg, rgba(0, 0, 0, 0.75), transparent);
        }

        &--bottom {
            bottom: 0;
            height: 160px;
            background: linear-gradient(0deg, rgba(0, 0, 0, 0.85), transparent);
        }
    }

    &__top,
    &__controls {
        position: absolute;
        left: 0;
        right: 0;
        z-index: 40;
        pointer-events: auto;
        transition: opacity 0.25s ease, transform 0.25s ease;
    }

    &__top {
        top: 0;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1.25rem 1.5rem;
    }

    &__meta {
        min-width: 0;
        flex: 1;
    }

    &__party-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-left: auto;
        flex-shrink: 0;
        background: rgba(255, 90, 31, 0.12);
        border: 1px solid rgba(255, 90, 31, 0.28);
        border-radius: var(--r-pill);
        color: var(--ember);
        padding: 0.45rem 0.95rem;
        min-height: 36px;
        font-family: var(--font-ui);
        font-size: 0.82rem;
        font-weight: 600;
        text-decoration: none;
        transition: background-color 0.15s ease, border-color 0.15s ease;

        &:hover {
            background: rgba(255, 90, 31, 0.2);
            border-color: rgba(255, 90, 31, 0.45);
        }

        @media (max-width: 640px) {
            width: 36px;
            padding: 0;
            display: inline-grid;
            place-items: center;

            .nf-watch__party-label {
                display: none;
            }
        }
    }

    &__party-icon {
        width: 16px;
        height: 16px;
    }

    &__title {
        margin: 0;
        font-size: clamp(1rem, 2vw, 1.35rem);
        font-weight: 600;
        letter-spacing: 0.01em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__subtitle {
        margin: 0.2rem 0 0;
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.72);
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    &__controls {
        bottom: 0;
        padding: 0 1.5rem 1.25rem;
        overflow: visible;
    }

    &__progress {
        position: relative;
        height: 4px;
        margin-bottom: 0.85rem;
        background: rgba(255, 255, 255, 0.25);
        border-radius: 2px;
        cursor: pointer;

        &:hover {
            height: 6px;
        }
    }

    &__progress-buffer {
        position: absolute;
        inset: 0 auto 0 0;
        background: rgba(255, 255, 255, 0.35);
        border-radius: inherit;
    }

    &__progress-fill {
        position: absolute;
        inset: 0 auto 0 0;
        background: var(--ember);
        border-radius: inherit;
    }

    &__progress-knob {
        position: absolute;
        top: 50%;
        right: 0;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--ember);
        transform: translate(50%, -50%) scale(0);
        transition: transform 0.15s ease;
    }

    &__progress:hover &__progress-knob {
        transform: translate(50%, -50%) scale(1);
    }

    &__preview {
        position: absolute;
        bottom: calc(100% + 10px);
        transform: translateX(-50%);
        width: 160px;
        height: 90px;
        background: #000;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        overflow: hidden;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.7);
        pointer-events: none;
        z-index: 50;
    }

    &__preview-canvas {
        width: 100%;
        height: 100%;
        display: block;
        background: #111;
        image-rendering: crisp-edges;
    }

    &__preview-time {
        position: absolute;
        bottom: 2px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 10px;
        font-family: var(--font-ui);
        color: #fff;
        background: rgba(0, 0, 0, 0.6);
        padding: 0 4px;
        border-radius: 2px;
        line-height: 1.1;
        pointer-events: none;
    }

    &__preview-hidden {
        position: absolute;
        left: -9999px;
        top: -9999px;
        width: 160px;
        height: 90px;
        opacity: 0;
        pointer-events: none;
    }

    &__bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
    }

    &__bar-left,
    &__bar-right {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        min-width: 0;
    }

    &__bar-right {
        flex-shrink: 0;
        overflow: visible;
    }

    &__icon-btn {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: transparent;
        color: #fff;
        cursor: pointer;
        transition: background 0.15s ease;

        svg {
            width: 22px;
            height: 22px;
        }

        &:hover {
            background: rgba(255, 255, 255, 0.12);
        }

        &--label {
            position: relative;
            width: 44px;

            span {
                position: absolute;
                font-size: 0.58rem;
                font-weight: 800;
                letter-spacing: -0.02em;
            }
        }
    }

    &__time {
        font-size: 0.82rem;
        font-variant-numeric: tabular-nums;
        color: rgba(255, 255, 255, 0.9);
        white-space: nowrap;
    }

    &__quality {
        position: relative;
        z-index: 10;
    }

    &__language {
        z-index: 11;
    }

    &__quality-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        min-width: 72px;
        height: 36px;
        padding: 0 0.65rem;
        border: 1px solid rgba(255, 255, 255, 0.35);
        border-radius: 4px;
        background: rgba(20, 20, 20, 0.8);
        color: #fff;
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;

        svg {
            width: 14px;
            height: 14px;
        }
    }

    &__language-menu {
        min-width: 148px;
        max-height: 240px;
        overflow-y: auto;
    }

    &__quality-loading {
        padding: 0.65rem 0.9rem;
        font-size: 0.82rem;
        color: rgba(255, 255, 255, 0.55);
        list-style: none;
    }

    &__quality-menu {
        position: absolute;
        right: 0;
        bottom: calc(100% + 8px);
        z-index: 60;
        pointer-events: auto;
        min-width: 120px;
        margin: 0;
        padding: 0.35rem 0;
        list-style: none;
        background: rgba(20, 20, 20, 0.96);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 4px;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    }

    &__quality-item {
        display: block;
        width: 100%;
        padding: 0.55rem 0.9rem;
        border: none;
        background: transparent;
        color: rgba(255, 255, 255, 0.85);
        font-size: 0.82rem;
        text-align: left;
        cursor: pointer;

        &.is-active,
        &:hover {
            color: #fff;
            background: rgba(255, 255, 255, 0.08);
        }

        &.is-active {
            font-weight: 700;
        }
    }

    &__warning,
    &__error {
        position: absolute;
        left: 50%;
        bottom: 7rem;
        z-index: 5;
        transform: translateX(-50%);
        margin: 0;
        padding: 0.65rem 1rem;
        border-radius: 4px;
        font-size: 0.85rem;
        max-width: min(92vw, 520px);
        text-align: center;
        line-height: 1.4;
    }

    &__warning {
        background: rgba(20, 20, 20, 0.92);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #f5f5f5;
    }

    &__error {
        background: rgba(180, 20, 20, 0.9);
        white-space: nowrap;
    }

    &.is-idle &__top,
    &.is-idle &__controls,
    &.is-idle &__shade {
        opacity: 0;
        pointer-events: none;
    }

    &.is-idle {
        cursor: none;
    }

    &.is-extension-gate {
        cursor: default;

        .nf-watch__top,
        .nf-watch__controls,
        .nf-watch__shade {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
        }
    }

    &__autoskip-btn {
        display: inline-flex;
        align-items: center;
        height: 36px;
        padding: 0 0.75rem;
        border: 1px solid rgba(255, 255, 255, 0.35);
        border-radius: 4px;
        background: rgba(20, 20, 20, 0.8);
        color: rgba(255, 255, 255, 0.72);
        font-size: 0.72rem;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;

        &.is-on {
            color: #fff;
            border-color: var(--ember);
            background: rgba(255, 90, 31, 0.18);
        }

        &:hover {
            background: rgba(255, 255, 255, 0.1);
        }
    }

    &__episodes-btn {
        display: inline-flex;
        align-items: center;
        height: 36px;
        padding: 0 0.75rem;
        border: 1px solid rgba(255, 255, 255, 0.35);
        border-radius: 4px;
        background: rgba(20, 20, 20, 0.8);
        color: #fff;
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;

        &:hover {
            background: rgba(255, 255, 255, 0.1);
        }
    }

    &__episodes {
        position: absolute;
        inset: 0;
        z-index: 60;
        display: flex;
        pointer-events: auto;
        isolation: isolate;
    }

    &__episodes-backdrop {
        all: unset;
        flex: 1;
        cursor: pointer;
        background: rgba(0, 0, 0, 0.45);
    }

    &__episodes-panel {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        width: min(400px, 42vw);
        height: 100%;
        padding: 1rem 1rem 1.25rem;
        background: rgba(20, 20, 20, 0.97);
        border-left: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: -16px 0 48px rgba(0, 0, 0, 0.55);
        animation: nf-ep-panel-in 0.28s var(--ease-out, ease-out);
        overflow: hidden;
        pointer-events: auto;

        :deep(.nf-episodes--panel) {
            flex: 1;
            min-height: 0;
        }
    }

    &__episodes-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--s-3);
        margin-bottom: 0.85rem;
        flex-shrink: 0;
    }

    &__episodes-intro {
        min-width: 0;
    }

    &__episodes-show {
        margin: 0 0 0.2rem;
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.62);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__episodes-label {
        margin: 0;
        font-family: var(--font-display);
        font-size: 1.35rem;
        font-weight: 500;
        color: #fff;
    }

    &__episodes-close {
        all: unset;
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        cursor: pointer;
        color: #fff;
        flex-shrink: 0;

        &:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        svg {
            width: 18px;
            height: 18px;
        }
    }

    &.is-menu-open,
    &.is-episodes-open {
        cursor: default;

        .nf-watch__top,
        .nf-watch__controls,
        .nf-watch__shade {
            opacity: 1;
            pointer-events: auto;
        }

        .nf-watch__stage {
            pointer-events: none;
        }
    }

    &.is-switching-audio,
    &.is-switching-episode {
        cursor: default;
    }

    &--party-embed {
        min-height: 0;
        height: 100%;

        .nf-watch__top {
            padding: 0.75rem 1rem 0.5rem;
        }

        .nf-watch__controls {
            padding: 0 1rem 0.85rem;
        }

        .nf-watch__shade--bottom {
            height: 140px;
        }
    }
}

@keyframes nf-spin {
    to { transform: rotate(360deg); }
}

@keyframes nf-ep-panel-in {
    from {
        transform: translateX(100%);
    }

    to {
        transform: translateX(0);
    }
}

@media (max-width: 640px) {
    .nf-watch {
        &__top {
            padding: 0.85rem 0.9rem;
        }

        &__controls {
            padding: 0 0.9rem 0.9rem;
        }

        &__icon-btn {
            width: 36px;
            height: 36px;

            svg {
                width: 20px;
                height: 20px;
            }
        }

        &__time {
            font-size: 0.72rem;
        }

        &__episodes-panel {
            width: min(400px, 88vw);
        }
    }
}
</style>