<template>
    <div ref="rootRef" class="moovie-frame" :class="{ 'has-error': error, 'is-buffering': buffering }">
        <div v-if="ambientImage" class="moovie-frame__bloom" :style="{ backgroundImage: `url(${ambientImage})` }" aria-hidden="true" />

        <div class="moovie-frame__stage">
            <div class="moovie-frame__player">
                <video ref="videoRef" class="moovie-frame__video" />

                <div v-if="!loading && !error" class="moovie-frame__center-btn" @click="togglePlay">
                    <div v-if="buffering" class="moovie-frame__spinner" />
                    <svg v-else-if="!playing" width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><polygon points="8,5 19,12 8,19" /></svg>
                    <svg v-else width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                </div>

                <div v-if="error && !loading" class="moovie-frame__overlay moovie-frame__overlay--error">
                    <p class="eyebrow">Hub Error</p>
                    <h3>{{ error }}</h3>
                    <button type="button" class="moovie-frame__retry" @click="retry">Retry</button>
                </div>

                <div v-if="loading && providers.length && !error" class="moovie-frame__scraper-status">
                    <div class="moovie-frame__scraper-handle">Scraping</div>
                    <div
                        v-for="p in providers"
                        :key="p.id"
                        class="moovie-frame__provider"
                        :class="`is-${p.status}`"
                    >
                        <span class="moovie-frame__provider-icon">
                            <span v-if="p.status === 'pending'" class="moovie-frame__spinner moovie-frame__spinner--sm" />
                            <span v-else-if="p.status === 'success'" class="moovie-frame__check">✓</span>
                            <span v-else-if="p.status === 'failure'" class="moovie-frame__cross">✕</span>
                            <span v-else-if="p.status === 'notfound'" class="moovie-frame__dash">–</span>
                            <span v-else class="moovie-frame__dot">○</span>
                        </span>
                        <span class="moovie-frame__provider-name">{{ p.name }}</span>
                        <span v-if="p.status === 'pending'" class="moovie-frame__provider-pct">{{ p.percentage }}%</span>
                    </div>
                </div>

                <ul
                    v-if="!loading && !error && qualityOpen && uniqueQualities.length > 1"
                    ref="qualityRootRef"
                    class="moovie-frame__quality-menu"
                >
                    <li
                        v-for="(q, i) in uniqueQualities"
                        :key="i"
                        role="option"
                        :aria-selected="selectedQualityIndex === i"
                    >
                        <button
                            type="button"
                            class="moovie-frame__quality-item"
                            :class="{ 'is-active': selectedQualityIndex === i }"
                            @click.stop="selectQuality(i)"
                        >
                            {{ q }}
                        </button>
                    </li>
                </ul>

                <div v-if="!loading && !error && visibleCues.length" class="moovie-frame__subtitle-overlay" :style="subtitleOverlayStyle">
                    <p
                        v-for="(cue, i) in visibleCues"
                        :key="i"
                        class="moovie-frame__subtitle-cue"
                        :style="subtitleCueStyle"
                    >{{ cue.text }}</p>
                </div>

                <div v-if="!loading && !error" class="moovie-frame__seekbar">
                    <input
                        type="range"
                        class="moovie-frame__seek-input"
                        min="0"
                        :max="duration || 0"
                        step="0.1"
                        :value="currentTime"
                        @input="seek"
                        @mousedown="seeking = true"
                        @mouseup="seeking = false"
                        @touchstart="seeking = true"
                        @touchend="seeking = false"
                        aria-label="Seek"
                    />
                    <div class="moovie-frame__seek-track" :class="{ 'is-active': seeking }">
                        <div class="moovie-frame__seek-fill" :style="{ width: duration ? (currentTime / duration * 100) + '%' : '0%' }">
                            <div class="moovie-frame__seek-thumb" />
                        </div>
                    </div>
                </div>

                <div v-if="!loading && !error" class="moovie-frame__controls">
                    <div class="moovie-frame__controls-left">
                        <button class="moovie-frame__ctrl-btn" @click="togglePlay" aria-label="Play/Pause">
                            <svg v-if="!playing" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21" /></svg>
                            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                        </button>
                        <span class="moovie-frame__time">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
                    </div>
                    <div class="moovie-frame__controls-right">
                        <button class="moovie-frame__ctrl-btn" @click="toggleMute" aria-label="Mute">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19" /><path v-if="!muted" d="M15.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" /><path v-if="!muted" d="M19 12c0 2.97-1.65 5.54-4 6.71v2.06c3.45-1.28 6-4.56 6-8.77s-2.55-7.49-6-8.77v2.06c2.35 1.17 4 3.74 4 6.71z" /><line v-if="muted" x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
                        </button>
                        <button
                            class="moovie-frame__ctrl-btn moovie-frame__three-dot-btn"
                            :class="{ 'is-open': settingsOpen }"
                            @click.stop="settingsOpen ? (settingsOpen = false, settingsSection = null) : (settingsOpen = true, qualityOpen = false)"
                            aria-label="Settings"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
                            </svg>
                        </button>
                        <button class="moovie-frame__ctrl-btn" @click="toggleFullscreen" aria-label="Fullscreen">
                            <svg v-if="!isFullscreen" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
                            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" /></svg>
                        </button>
                    </div>
                </div>

                <div v-if="settingsOpen" class="moovie-frame__settings-panel" @click.stop>
                    <div class="moovie-frame__settings-header">
                        <button
                            v-if="settingsSection"
                            class="moovie-frame__settings-back"
                            @click="settingsSection = null"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                        </button>
                        <span>{{ settingsSection ? settingsSection.charAt(0).toUpperCase() + settingsSection.slice(1) : 'Settings' }}</span>
                    </div>

                    <template v-if="!settingsSection">
                        <button
                            class="moovie-frame__settings-item"
                            @click="settingsSection = 'speed'"
                        >
                            <span class="moovie-frame__settings-item-label">Playback Speed</span>
                            <span class="moovie-frame__settings-item-value">{{ playbackSpeed }}x</span>
                            <svg class="moovie-frame__settings-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                        </button>
                        <button
                            class="moovie-frame__settings-item"
                            @click="togglePiP"
                        >
                            <span class="moovie-frame__settings-item-label">Picture-in-Picture</span>
                            <span class="moovie-frame__settings-item-value">{{ isPiP ? 'On' : 'Off' }}</span>
                        </button>
                        <div class="moovie-frame__settings-divider" />
                        <button
                            class="moovie-frame__settings-item"
                            @click="settingsSection = 'server'"
                        >
                            <span class="moovie-frame__settings-item-label">Server</span>
                            <span class="moovie-frame__settings-item-value">{{ selectedServer || 'Auto' }}</span>
                            <svg class="moovie-frame__settings-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                        </button>
                        <button
                            class="moovie-frame__settings-item"
                            @click="settingsSection = 'quality'; qualityOpen = false"
                        >
                            <span class="moovie-frame__settings-item-label">Quality</span>
                            <span class="moovie-frame__settings-item-value">{{ hlsQualityLabel }}</span>
                            <svg class="moovie-frame__settings-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                        </button>
                        <button
                            class="moovie-frame__settings-item"
                            @click="settingsSection = 'audio'"
                        >
                            <span class="moovie-frame__settings-item-label">Audio</span>
                            <span class="moovie-frame__settings-item-value">{{ currentAudioLabel }}</span>
                            <svg class="moovie-frame__settings-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                        </button>
                        <button
                            class="moovie-frame__settings-item"
                            @click="settingsSection = 'captions'"
                        >
                            <span class="moovie-frame__settings-item-label">Captions</span>
                            <span class="moovie-frame__settings-item-value">{{ subtitleTracks.length ? currentSubtitleLabel : 'Off' }}</span>
                            <svg class="moovie-frame__settings-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                        </button>
                    </template>

                    <template v-if="settingsSection === 'server'">
                        <button
                            v-for="server in availableServers"
                            :key="server.name"
                            class="moovie-frame__settings-item"
                            :class="{
                                'is-active': selectedServer === server.name,
                                'is-dimmed': !server.hasStreams,
                            }"
                            @click="selectServer(server.name)"
                        >
                            <span class="moovie-frame__settings-item-status" :class="`is-${server.hasStreams ? 'success' : server.status}`">
                                {{ server.hasStreams ? '✓' : server.status === 'pending' ? '⟳' : server.status === 'failure' ? '✕' : server.status === 'notfound' ? '–' : '○' }}
                            </span>
                            <span>{{ server.name }}</span>
                        </button>
                    </template>

                    <template v-if="settingsSection === 'quality'">
                        <button
                            v-for="(q, i) in uniqueQualities"
                            :key="i"
                            class="moovie-frame__settings-item"
                            :class="{ 'is-active': selectedQualityIndex === i }"
                            @click="selectQuality(i)"
                        >
                            <span>{{ q }}</span>
                        </button>
                        <template v-if="!uniqueQualities.length && hlsQualities.length">
                            <div class="moovie-frame__settings-divider" />
                            <button
                                class="moovie-frame__settings-item"
                                :class="{ 'is-active': selectedHlsQuality === -1 }"
                                @click="selectHlsQuality(-1)"
                            >
                                <span>Auto</span>
                            </button>
                            <button
                                v-for="q in hlsQualities"
                                :key="q.id"
                                class="moovie-frame__settings-item"
                                :class="{ 'is-active': selectedHlsQuality === q.id }"
                                @click="selectHlsQuality(q.id)"
                            >
                                <span>{{ q.label }}</span>
                            </button>
                        </template>
                    </template>

                    <template v-if="settingsSection === 'audio'">
                        <button
                            v-for="track in audioTracks"
                            :key="track.id"
                            class="moovie-frame__settings-item"
                            :class="{ 'is-active': selectedAudioTrack === track.id }"
                            @click="selectAudioTrack(track.id)"
                        >
                            <span>{{ track.name }}<span v-if="track.lang" class="moovie-frame__settings-item-hint"> — {{ track.lang }}</span></span>
                        </button>
                    </template>

                    <template v-if="settingsSection === 'captions'">
                        <button
                            class="moovie-frame__settings-item"
                            :class="{ 'is-active': selectedSubtitleTrack === -1 }"
                            @click="selectSubtitleTrack(-1)"
                        >
                            <span>Off</span>
                        </button>
                        <button
                            v-for="track in subtitleTracks"
                            :key="track.id"
                            class="moovie-frame__settings-item"
                            :class="{ 'is-active': selectedSubtitleTrack === track.id }"
                            @click="selectSubtitleTrack(track.id)"
                        >
                            <span>{{ track.name }}<span v-if="track.lang" class="moovie-frame__settings-item-hint"> — {{ track.lang }}</span></span>
                        </button>
                        <div class="moovie-frame__settings-divider" />
                        <button
                            class="moovie-frame__settings-item"
                            @click="settingsSection = 'captions-style'"
                        >
                            <span class="moovie-frame__settings-item-label">Style</span>
                            <svg class="moovie-frame__settings-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                        </button>
                    </template>

                    <template v-if="settingsSection === 'captions-style'">
                        <div class="moovie-frame__settings-label">Font Size</div>
                        <div class="moovie-frame__settings-options">
                            <button
                                v-for="s in FONT_SIZES"
                                :key="s"
                                class="moovie-frame__settings-chip"
                                :class="{ 'is-active': subFontSize === s }"
                                @click="setSubStyle('fontSize', s)"
                            >{{ s }}</button>
                        </div>
                        <div class="moovie-frame__settings-label">Opacity</div>
                        <div class="moovie-frame__settings-options">
                            <button
                                v-for="o in OPACITIES"
                                :key="o"
                                class="moovie-frame__settings-chip"
                                :class="{ 'is-active': subOpacity === o }"
                                @click="setSubStyle('opacity', o)"
                            >{{ Math.round(o * 100) }}%</button>
                        </div>
                        <div class="moovie-frame__settings-label">Text Color</div>
                        <div class="moovie-frame__settings-options">
                            <button
                                v-for="c in TEXT_COLORS"
                                :key="c"
                                class="moovie-frame__settings-chip moovie-frame__settings-chip--color"
                                :class="{ 'is-active': subTextColor === c }"
                                :style="{ background: c }"
                                @click="setSubStyle('textColor', c)"
                            />
                        </div>
                        <div class="moovie-frame__settings-label">Background Opacity</div>
                        <div class="moovie-frame__settings-options">
                            <button
                                v-for="o in OPACITIES"
                                :key="o"
                                class="moovie-frame__settings-chip"
                                :class="{ 'is-active': subBgOpacity === o }"
                                @click="setSubStyle('bgOpacity', o)"
                            >{{ Math.round(o * 100) }}%</button>
                        </div>
                        <div class="moovie-frame__settings-label">Background Color</div>
                        <div class="moovie-frame__settings-options">
                            <button
                                v-for="c in BG_COLORS"
                                :key="c"
                                class="moovie-frame__settings-chip moovie-frame__settings-chip--color"
                                :class="{ 'is-active': subBgColor === c }"
                                :style="{ background: c, borderColor: c === '#ffffff' || c === '#f0eee3' ? 'rgba(255,255,255,0.3)' : undefined }"
                                @click="setSubStyle('bgColor', c)"
                            />
                        </div>
                        <div class="moovie-frame__settings-label">Background Blur</div>
                        <div class="moovie-frame__settings-options">
                            <button
                                v-for="b in BG_BLURS"
                                :key="b"
                                class="moovie-frame__settings-chip"
                                :class="{ 'is-active': subBgBlur === b }"
                                @click="setSubStyle('bgBlur', b)"
                            >{{ b === 0 ? 'Off' : Math.round(b * 100) + '%' }}</button>
                        </div>
                        <div class="moovie-frame__settings-label">Bold</div>
                        <div class="moovie-frame__settings-options">
                            <button
                                class="moovie-frame__settings-chip"
                                :class="{ 'is-active': subBold }"
                                @click="setSubStyle('bold', !subBold)"
                            >{{ subBold ? 'On' : 'Off' }}</button>
                        </div>
                        <div class="moovie-frame__settings-label">Position</div>
                        <div class="moovie-frame__settings-options moovie-frame__settings-options--center">
                            <button class="moovie-frame__settings-chip moovie-frame__settings-chip--icon" @click="setSubStyle('position', Math.min(95, subPosition + 5))" aria-label="Move up">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5z"/></svg>
                            </button>
                            <span class="moovie-frame__settings-pos-value">{{ subPosition }}%</span>
                            <button class="moovie-frame__settings-chip moovie-frame__settings-chip--icon" @click="setSubStyle('position', Math.max(5, subPosition - 5))" aria-label="Move down">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
                            </button>
                        </div>
                    </template>

                    <template v-if="settingsSection === 'speed'">
                        <button
                            v-for="spd in PLAYBACK_SPEEDS"
                            :key="spd"
                            class="moovie-frame__settings-item"
                            :class="{ 'is-active': playbackSpeed === spd }"
                            @click="setPlaybackSpeed(spd)"
                        >
                            <span>{{ spd }}x</span>
                        </button>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { useWebImage } from '../../utils/useWebImage'
import { useAmbientColor } from '../../composables/useAmbientColor'
import { startProgressTracking } from '../../composables/useProgress'
import { getSupabaseClient } from '../../lib/supabase'

const HUB_BASE = 'https://proxy.moovie.fun'
const CF_HEADER_PROXY = 'https://cf-header-proxy.moovie.fun'
const WYZIE_SUBS = 'https://sub.wyzie.io/search'
const WYZIE_API_KEY = 'wyzie-m3moskoivi4mwobs7167pcscgmtou59j'

interface WyzieSub {
    id: string
    url: string
    display: string
    language: string
    format: string
}

interface SrtCue {
    start: number
    end: number
    text: string
}

function parseSrt(text: string): SrtCue[] {
    const blocks = text.trim().replace(/\r\n/g, '\n').split(/\n\n+/)
    const cues: SrtCue[] = []
    for (const block of blocks) {
        const lines = block.split('\n').filter(Boolean)
        if (lines.length < 2) continue
        const timeLine = lines.find(l => l.includes('-->'))
        if (!timeLine) continue
        const m = timeLine.match(
            /(\d{1,2}):(\d{2}):(\d{2})[.,](\d+)\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[.,](\d+)/
        )
        if (!m) continue
        const start = +m[1] * 3600 + +m[2] * 60 + +m[3] + parseInt(m[4].padEnd(3, '0')) / 1000
        const end = +m[5] * 3600 + +m[6] * 60 + +m[7] + parseInt(m[8].padEnd(3, '0')) / 1000
        const text = lines.slice(lines.indexOf(timeLine) + 1).join('\n').trim()
        if (text) cues.push({ start, end, text })
    }
    return cues
}

interface ProviderStatus {
    id: string
    name: string
    status: 'waiting' | 'pending' | 'success' | 'failure' | 'notfound'
    percentage: number
    error?: string
}

interface HubStream {
    name: string
    url: string
    proxyUrl: string
    quality: string
    type: string
    headers?: Record<string, string>
    providerName?: string
    qualities?: string[]
}

        let proxyEnabled = true
        let proxyFetched = false

        async function ensureProxySetting() {
            if (proxyFetched) return
            proxyFetched = true
            try {
                const client = await getSupabaseClient()
                const { data } = await client.from('app_settings').select('value').eq('key', 'stream_proxy_enabled').single()
                if (data) proxyEnabled = data.value === 'true'
            } catch { /* keep default */ }
        }

export default defineComponent({
    name: 'MoovieFrame',
    props: {
        mediaId: { type: [String, Number], default: '' },
        mediaType: { type: String as () => 'movie' | 'tv', default: 'movie' },
        season: { type: Number, default: 0 },
        episode: { type: Number, default: 0 },
        title: { type: String, default: 'Stream' },
        backdropPath: { type: String, default: '' },
        posterPath: { type: String, default: '' },
    },
    setup(props) {
        const rootRef = ref<HTMLElement | null>(null)
        const videoRef = ref<HTMLVideoElement | null>(null)
        const qualityRootRef = ref<HTMLElement | null>(null)
        const loading = ref(false)
        const error = ref('')
        const streams = ref<HubStream[]>([])
        const selectedStreamIndex = ref(0)
        const qualityOpen = ref(false)
        const buffering = ref(false)
        const seeking = ref(false)
        const settingsOpen = ref(false)
        const settingsSection = ref<string | null>(null)
        const selectedServer = ref('')
        const audioTracks = ref<{ id: number; name: string; lang?: string }[]>([])
        const selectedAudioTrack = ref(-1)
        const subtitleTracks = ref<{ id: number; name: string; lang?: string; isWyzie?: boolean }[]>([])
        const selectedSubtitleTrack = ref(-1)
        const captionSrtData = ref('')
        const subFontSize = ref('medium')
        const subTextColor = ref('#ffffff')
        const subOpacity = ref(1)
        const subBgOpacity = ref(0.5)
        const subBgColor = ref('#000000')
        const subBgBlur = ref(0.5)
        const subBold = ref(false)
        const subPosition = ref(5)
        const FONT_SIZES = ['small', 'medium', 'large', 'x-large'] as const
        const BG_COLORS = ['#000000', '#0f0f0f', '#1a1a2e', '#16213e', '#2d2d2d', '#3d0000', '#004d40', '#4a148c']
        const TEXT_COLORS = ['#ffffff', '#f0eee3', '#ffd54f', '#ff8a65', '#81c784', '#64b5f6', '#ce93d8', '#f48fb1']
        const BG_BLURS = [0, 0.25, 0.5, 0.75, 1]
        const OPACITIES = [0.25, 0.5, 0.75, 1]
        const hlsQualities = ref<{ id: number; label: string; height: number }[]>([])
        const selectedHlsQuality = ref(-1)
        const WYZIE_TRACK_OFFSET = 1000

        const visibleCues = computed(() => {
            if (!captionSrtData.value) return []
            const now = currentTime.value
            return parseSrt(captionSrtData.value).filter(c => c.start <= now && c.end >= now)
        })

        const fontSizeMap: Record<string, string> = { small: '1.1em', medium: '1.5em', large: '2em', 'x-large': '2.8em' }

        const subtitleOverlayStyle = computed(() => ({
            bottom: `${subPosition.value}%`,
        }))

        const subtitleCueStyle = computed(() => ({
            color: subTextColor.value,
            fontSize: fontSizeMap[subFontSize.value] || '1.5em',
            opacity: subOpacity.value,
            fontWeight: subBold.value ? 'bold' : 'normal' as any,
            backgroundColor: `rgba(0,0,0,${subBgOpacity.value})`,
            backdropFilter: subBgBlur.value > 0 ? `blur(${Math.floor(subBgBlur.value * 32)}px)` : 'none',
        }))
        const playing = ref(false)
        const currentTime = ref(0)
        const duration = ref(0)
        const muted = ref(false)
        const playbackSpeed = ref(1)
        const isPiP = ref(false)
        const isFullscreen = ref(false)
        const playbackStarted = ref(false)
        const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]
        let hlsInstance: any = null
        let stopTracking: (() => void) | null = null

        const uniqueQualities = computed(() => {
            const seen = new Set<string>()
            const out: string[] = []
            for (const s of streams.value) {
                const q = s.quality || 'Auto'
                if (!seen.has(q)) {
                    seen.add(q)
                    out.push(q)
                }
            }
            return out
        })

        const selectedQualityIndex = computed(() => {
            const q = streams.value[selectedStreamIndex.value]?.quality
            return q ? uniqueQualities.value.indexOf(q) : 0
        })

        const activeQualityLabel = computed(() => {
            return streams.value[selectedStreamIndex.value]?.quality || 'Auto'
        })

        const hlsQualityLabel = computed(() => {
            const sq = streams.value[selectedStreamIndex.value]?.quality
            if (sq && sq !== 'Auto') return sq
            if (selectedHlsQuality.value === -1) return 'Auto'
            const q = hlsQualities.value.find(l => l.id === selectedHlsQuality.value)
            return q?.label || 'Auto'
        })

        const availableServers = computed(() => {
            return providers.value.map(p => ({
                name: p.name,
                status: p.status,
                hasStreams: streams.value.some(s => s.providerName === p.name),
            }))
        })

        const currentAudioLabel = computed(() => {
            const track = audioTracks.value.find(t => t.id === selectedAudioTrack.value)
            return track?.name || 'Unknown'
        })

        const currentSubtitleLabel = computed(() => {
            if (selectedSubtitleTrack.value === -1) return 'Off'
            const track = subtitleTracks.value.find(t => t.id === selectedSubtitleTrack.value)
            return track?.name || 'Unknown'
        })

        useAmbientColor(computed(() => props.backdropPath || props.posterPath || null), rootRef)

        const ambientImage = ref('')
        const computeAmbient = () => {
            const path = props.backdropPath || props.posterPath
            ambientImage.value = path ? useWebImage(path, 'large') : ''
        }

        const loadHlsJs = (() => {
            let promise: Promise<void> | null = null
            return () => {
                if ((window as any).Hls) return Promise.resolve()
                if (promise) return promise
                promise = new Promise((resolve) => {
                    const s = document.createElement('script')
                    s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js'
                    s.onload = () => resolve()
                    s.onerror = () => resolve()
                    document.head.appendChild(s)
                })
                return promise
            }
        })()

        function destroyPlayer() {
            if (hlsInstance) { try { hlsInstance.destroy() } catch {}; hlsInstance = null }
            if (videoRef.value) { videoRef.value.removeAttribute('src'); videoRef.value.load() }
            audioTracks.value = []
            subtitleTracks.value = []
            captionSrtData.value = ''
        }

        async function mountPlayer(url: string) {
            console.debug('[MoovieFrame] mountPlayer url:', url)
            destroyPlayer()
            qualityOpen.value = false
            buffering.value = true

            await loadHlsJs()
            const HlsCtor = (window as any).Hls
            const isHls = url.includes('.m3u8') || url.includes('m3u8')

            const video = videoRef.value
            if (!video) { console.debug('[MoovieFrame] mountPlayer no video element'); return }

            video.removeAttribute('src')
            video.controls = false
            video.playsInline = true
            video.autoplay = true
            video.playbackRate = playbackSpeed.value

            const onBufferEnd = () => { buffering.value = false; playing.value = !video.paused }
            const onTimeUpdate = () => { currentTime.value = video.currentTime; duration.value = video.duration || 0 }
            const onPlayPause = () => { playing.value = !video.paused }
            video.addEventListener('waiting', () => { buffering.value = true })
            video.addEventListener('playing', onBufferEnd)
            video.addEventListener('canplay', onBufferEnd)
            video.addEventListener('loadeddata', onBufferEnd)
            video.addEventListener('seeked', onBufferEnd)
            video.addEventListener('error', onBufferEnd)
            video.addEventListener('abort', onBufferEnd)
            video.addEventListener('timeupdate', onTimeUpdate)
            video.addEventListener('play', onPlayPause)
            video.addEventListener('pause', onPlayPause)
            video.addEventListener('volumechange', () => { muted.value = video.muted })
            video.addEventListener('durationchange', onTimeUpdate)
            video.addEventListener('enterpictureinpicture', () => { isPiP.value = true })
            video.addEventListener('leavepictureinpicture', () => { isPiP.value = false })

            if (isHls && HlsCtor && HlsCtor.isSupported()) {
                hlsInstance = new HlsCtor({
                    enableWorker: true,
                    maxBufferLength: 30,
                    maxMaxBufferLength: 60,
                })
                hlsInstance.loadSource(url)
                hlsInstance.attachMedia(video)

                hlsInstance.on(HlsCtor.Events.MANIFEST_PARSED, () => {
                    const levels: { id: number; label: string; height: number }[] = []
                    if (hlsInstance.levels) {
                        for (let i = 0; i < hlsInstance.levels.length; i++) {
                            const l = hlsInstance.levels[i]
                            levels.push({ id: i, label: l.height ? `${l.height}p` : `Level ${i}`, height: l.height || 0 })
                        }
                    }
                    levels.sort((a, b) => b.height - a.height)
                    hlsQualities.value = levels
                    selectedHlsQuality.value = hlsInstance.currentLevel ?? -1
                })

                hlsInstance.on(HlsCtor.Events.LEVEL_SWITCHED, (_event: any, data: any) => {
                    selectedHlsQuality.value = data.level
                })

                hlsInstance.on(HlsCtor.Events.AUDIO_TRACKS_UPDATED, () => {
                    audioTracks.value = (hlsInstance.audioTracks || []).map((t: any, i: number) => ({
                        id: i,
                        name: t.name || t.lang || `Track ${i}`,
                        lang: t.lang,
                    }))
                    selectedAudioTrack.value = hlsInstance.audioTrack ?? -1
                })
                hlsInstance.on(HlsCtor.Events.SUBTITLE_TRACKS_UPDATED, () => {
                    subtitleTracks.value = (hlsInstance.subtitleTracks || []).map((t: any, i: number) => ({
                        id: i,
                        name: t.name || t.lang || `Track ${i}`,
                        lang: t.lang,
                    }))
                    selectedSubtitleTrack.value = hlsInstance.subtitleTrack ?? -1
                })
                hlsInstance.on(HlsCtor.Events.ERROR, (_event: any, data: any) => {
                    if (data.fatal) {
                        console.error('[MoovieFrame] HLS fatal error:', data.type, data.details)
                        buffering.value = false
                        error.value = `HLS error: ${data.details}`
                    }
                })
            } else {
                video.src = url
            }
        }

        const providers = ref<ProviderStatus[]>([])
        let eventSource: EventSource | null = null

        function buildScrapeUrl(): string {
            const id = String(props.mediaId)
            if (!id) return ''
            const params = new URLSearchParams({ tmdbId: id, type: props.mediaType })
            if (props.season > 0) params.set('season', String(props.season))
            if (props.episode > 0) params.set('episode', String(props.episode))
            params.set('_cb', String(Date.now()))
            return `${HUB_BASE}/scrape?${params}`
        }

        function cancelScrape() {
            if (eventSource) { eventSource.close(); eventSource = null }
        }

        function scrapeViaSSE(): Promise<HubStream[]> {
            return new Promise((resolve, reject) => {
                providers.value = []
                const url = buildScrapeUrl()
                if (!url) { reject(new Error('No media ID')); return }

                const providerMap = new Map<string, ProviderStatus>()
                const allStreams: HubStream[] = []
                let resolved = false
                let hasAnyOutput = false

                function finish() {
                    if (resolved) return
                    resolved = true
                    if (eventSource) { eventSource.close(); eventSource = null }
                    if (allStreams.length) {
                        resolve(allStreams)
                    } else {
                        reject(new Error('No streamable sources found'))
                    }
                }

                eventSource = new EventSource(url)

                const SCRAPER_NAMES: Record<string, string> = {
                    vaplayer: 'Poseidon',
                    'moovie-catalog': 'Athena',
                    streamvault: 'Zeus',
                    vidrift: 'Hades',
                }

                eventSource.addEventListener('init', (e: MessageEvent) => {
                    try {
                        const data = JSON.parse(e.data)
                        console.debug('[MoovieFrame] init sourceIds:', data.sourceIds)
                        const ids: string[] = data.sourceIds || []
                        providerMap.clear()
                        for (const id of ids) {
                            const name = SCRAPER_NAMES[id] || id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ')
                            providerMap.set(id, { id, name, status: 'waiting', percentage: 0 })
                        }
                        providers.value = [...providerMap.values()]
                    } catch { /* ignore */ }
                })

                eventSource.addEventListener('start', (e: MessageEvent) => {
                    const id = JSON.parse(e.data)
                    console.debug('[MoovieFrame] start:', id)
                    const ps = providerMap.get(id)
                    if (ps) { ps.status = 'pending'; ps.percentage = 0; providers.value = [...providerMap.values()] }
                })

                eventSource.addEventListener('update', (e: MessageEvent) => {
                    try {
                        const data = JSON.parse(e.data)
                        const ps = providerMap.get(data.id)
                        if (ps) {
                            ps.percentage = data.percentage || 0
                            if (data.status) ps.status = data.status
                            if (data.error) ps.error = data.error
                            providers.value = [...providerMap.values()]
                        }
                    } catch { /* ignore */ }
                })

                eventSource.addEventListener('completed', (e: MessageEvent) => {
                    try {
                        const data = JSON.parse(e.data)
                        console.debug('[MoovieFrame] completed event:', data.sourceId, 'keys:', Object.keys(data), 'stream type:', typeof data.stream, 'streams type:', typeof data.streams)
                        if (data.stream) console.debug('[MoovieFrame]  stream keys:', Object.keys(data.stream))
                        if (data.streams) console.debug('[MoovieFrame]  streams length:', data.streams?.length)
                        const ps = providerMap.get(data.sourceId)
                        if (ps) { ps.status = 'success'; providers.value = [...providerMap.values()] }

                        const rawStreams = data.streams || (data.stream ? [data.stream] : [])
                        console.debug('[MoovieFrame] completed:', data.sourceId, 'rawStreams count:', rawStreams.length)
                        for (const mw of rawStreams) {
                            const qualities = mw.qualities || {}
                            const qualityLabels = Object.keys(qualities)
                            const isHls = mw.type === 'hls' || !!mw.playlist

                            if (qualityLabels.length) {
                                for (const qLabel of qualityLabels) {
                                    const entry = qualities[qLabel]
                                    if (!entry) continue
                                    const streamUrl = (entry.playlist || entry.url || '')
                                    if (!streamUrl && !mw.proxyUrl) continue

                                    const stream: HubStream = {
                                        name: mw.name || data.sourceId,
                                        url: streamUrl,
                                        proxyUrl: mw.proxyUrl || '',
                                        quality: qLabel,
                                        type: (entry.type || 'hls') === 'hls' ? 'm3u8' : 'mp4',
                                        headers: mw.headers,
                                        providerName: SCRAPER_NAMES[data.sourceId] || data.sourceId,
                                        qualities: qualityLabels,
                                    }
                                    if (stream.url?.startsWith('/')) stream.url = HUB_BASE + stream.url
                                    if (stream.proxyUrl?.startsWith('/')) stream.proxyUrl = HUB_BASE + stream.proxyUrl
                                    allStreams.push(stream)
                                    streams.value = [...allStreams]
                                    hasAnyOutput = true
                                    console.debug('[MoovieFrame]  added quality stream:', qLabel, streamUrl.slice(0, 80))
                                }
                            } else {
                                const streamUrl = isHls ? (mw.playlist || '') : (mw.url || '')
                                const stream: HubStream = {
                                    name: mw.name || data.sourceId,
                                    url: streamUrl || '',
                                    proxyUrl: mw.proxyUrl || '',
                                    quality: 'Auto',
                                    type: isHls ? 'm3u8' : (mw.type || 'mp4'),
                                    headers: mw.headers,
                                    providerName: SCRAPER_NAMES[data.sourceId] || data.sourceId,
                                }
                                if (stream.url?.startsWith('/')) stream.url = HUB_BASE + stream.url
                                if (stream.proxyUrl?.startsWith('/')) stream.proxyUrl = HUB_BASE + stream.proxyUrl
                                if (!stream.url && !stream.proxyUrl) {
                                    console.debug('[MoovieFrame]  skipped empty stream for', data.sourceId)
                                    continue
                                }
                                allStreams.push(stream)
                                streams.value = [...allStreams]
                                hasAnyOutput = true
                                console.debug('[MoovieFrame]  added stream:', stream.name, stream.quality, stream.url?.slice(0, 80))
                            }
                        }
                        if (!rawStreams.length) {
                            if (ps) { ps.status = 'notfound'; providers.value = [...providerMap.values()] }
                            return
                        }

                        if (!playbackStarted.value) {
                            playbackStarted.value = true
                            loading.value = false
                            const best = pickBest(allStreams)
                            if (best) {
                                tryPlayStream(best).catch(e => console.error('[MoovieFrame] early playback error:', e))
                            }
                        }
                    } catch { /* ignore */ }
                })

                eventSource.addEventListener('done', () => {
                    if (!playbackStarted.value && allStreams.length) {
                        playbackStarted.value = true
                        loading.value = false
                        const best = pickBest(allStreams)
                        if (best) {
                            tryPlayStream(best).catch(e => console.error('[MoovieFrame] done playback error:', e))
                        }
                    }
                    finish()
                })
                eventSource.addEventListener('noOutput', () => { if (!hasAnyOutput) finish() })
                eventSource.addEventListener('error', () => { /* keep waiting — reconnect is automatic */ })
            })
        }

        async function fetchStreams(): Promise<HubStream[]> {
            providers.value = []
            cancelScrape()
            try {
                return await scrapeViaSSE()
            } catch (e) {
                console.debug('[MoovieFrame] SSE failed, falling back to REST:', (e as Error).message)
            }
            // Fallback to REST endpoint
            const id = String(props.mediaId)
            if (!id) throw new Error('No media ID')
            const type = props.mediaType
            const qs = `q=${encodeURIComponent(id)}&type=${type}${type === 'tv' && props.season > 0 ? `&season=${props.season}` : ''}${type === 'tv' && props.episode > 0 ? `&episode=${props.episode}` : ''}&_cb=${Date.now()}`
            let res: Response | null = null
            let usedUrl = ''
            for (const base of [`${HUB_BASE}/api/search`]) {
                usedUrl = `${base}?${qs}`
                try {
                    const r = await fetch(usedUrl)
                    if (!r.ok) continue
                    if (!r.headers.get('content-type')?.includes('application/json')) continue
                    res = r
                    break
                } catch { /* try next */ }
            }
            if (!res) throw new Error('All hub endpoints failed')
            const text = await res.text()
            let data: any
            try { data = JSON.parse(text) } catch { throw new Error('Hub returned invalid JSON') }
            const all: HubStream[] = []
            for (const group of data.results || []) {
                for (const stream of group.streams || []) {
                    if (stream.proxyUrl?.startsWith('/')) stream.proxyUrl = HUB_BASE + stream.proxyUrl
                    stream.providerName = group.providerName
                    all.push(stream)
                }
            }
            return all
        }

        const qualityRank: Record<string, number> = {
            '4K': 6, '2160P': 6, '2160': 6,
            '1080P': 5, '1080': 5, 'FHD': 5,
            '720P': 4, '720': 4, 'HD': 4,
            '480P': 3, '480': 3, 'SD': 3,
            '360P': 2, '360': 2,
            '240P': 1, '240': 1,
        }

        function scoreStream(s: HubStream): number {
            const q = (s.quality || '').toUpperCase().trim()
            const rank = qualityRank[q] ?? 0
            const typeBonus = s.type === 'm3u8' || s.url?.includes('.m3u8') ? 0.5 : 0
            return rank + typeBonus
        }

        const PROVIDER_PRIORITY = ['Poseidon', 'Athena', 'Zeus']

        function pickBest(streams: HubStream[]): HubStream | null {
            if (!streams.length) return null
            let best = streams[0]
            let bestScore = scoreStream(best)
            for (let i = 1; i < streams.length; i++) {
                const s = scoreStream(streams[i])
                if (s > bestScore) {
                    bestScore = s
                    best = streams[i]
                }
            }
            return best
        }

        async function doLoad() {
            console.debug('[MoovieFrame] doLoad start')
            destroyPlayer(); loading.value = true; error.value = ''; playbackStarted.value = false
            try {
                await ensureProxySetting()
                const all = await fetchStreams()
                streams.value = all
                if (!all.length) throw new Error('No streamable sources found')
                if (playbackStarted.value) { loading.value = false; return }
                await tryProviderChain(all)
                loading.value = false
                console.debug('[MoovieFrame] doLoad done')
            } catch (e: any) {
                console.debug('[MoovieFrame] doLoad error:', e.message)
                if (!playbackStarted.value) {
                    error.value = e.message || 'Failed to load stream'
                }
                loading.value = false
            }
        }

        async function tryProviderChain(all: HubStream[]) {
            const tried = new Set<string>()
            for (const provider of PROVIDER_PRIORITY) {
                const group = all.filter(s => s.providerName === provider)
                if (!group.length) continue
                const best = pickBest(group)
                if (!best) continue
                tried.add(provider)
                try {
                    await tryPlayStream(best)
                    return
                } catch (e) {
                    console.debug('[MoovieFrame]', provider, 'failed, trying next:', (e as Error).message)
                }
            }
            // Fallback: try any remaining untried stream
            const remaining = all.filter(s => !tried.has(s.providerName!))
            const fallback = pickBest(remaining)
            if (fallback) {
                try {
                    await tryPlayStream(fallback)
                    return
                } catch { /* give up */ }
            }
            throw new Error('All providers failed')
        }

        async function tryPlayStream(s: HubStream) {
            const useProxy = proxyEnabled && !!s.proxyUrl
            let playUrl: string
            if (useProxy) {
                playUrl = s.proxyUrl!
            } else if (s.headers && Object.keys(s.headers).length) {
                const params = new URLSearchParams({ url: s.url })
                if (s.headers.Referer) params.set('referer', s.headers.Referer)
                if (s.headers.Origin) params.set('origin', s.headers.Origin)
                if (s.headers['User-Agent']) params.set('ua', s.headers['User-Agent'])
                playUrl = `${CF_HEADER_PROXY}/?${params}`
            } else {
                playUrl = s.url
            }
            console.debug('[MoovieFrame] tryPlayStream:', s.name, s.quality, playUrl)
            try {
                await mountPlayer(playUrl)
                loadWyzieSubtitles().catch(() => {})
            } catch (e) {
                if (!useProxy && s.proxyUrl && proxyEnabled) {
                    console.debug('[MoovieFrame] direct playback failed, falling back to proxy:', s.proxyUrl)
                    await mountPlayer(s.proxyUrl)
                    loadWyzieSubtitles().catch(() => {})
                } else {
                    throw e
                }
            }
        }

        async function fetchWyzieSubtitles(): Promise<WyzieSub[]> {
            const id = String(props.mediaId)
            if (!id) { console.debug('[Wyzie] no mediaId'); return [] }
            const params = new URLSearchParams({ id, key: WYZIE_API_KEY })
            if (props.mediaType === 'tv' && props.season > 0 && props.episode > 0) {
                params.set('season', String(props.season))
                params.set('episode', String(props.episode))
            }
            const url = `${WYZIE_SUBS}?${params}`
            const proxyUrl = `${HUB_BASE}/api/proxy?destination=${encodeURIComponent(url)}`
            console.debug('[Wyzie] fetching:', url)
            for (const tryUrl of [url, proxyUrl]) {
                try {
                    const res = await fetch(tryUrl)
                    if (!res.ok) { console.debug('[Wyzie] fetch failed:', tryUrl, res.status); continue }
                    const data = await res.json()
                    console.debug('[Wyzie] got', Array.isArray(data) ? data.length : 'non-array', 'results')
                    return Array.isArray(data) ? data : []
                } catch (e) {
                    console.debug('[Wyzie] fetch error:', tryUrl, e)
                }
            }
            return []
        }

        async function loadWyzieSubtitles() {
            console.debug('[Wyzie] loading subtitles...')
            const subs = await fetchWyzieSubtitles()
            if (!subs.length) { console.debug('[Wyzie] no subtitles found'); return }
            console.debug('[Wyzie] subs count:', subs.length)

            const filtered = subs.slice(0, 15)
            const wyzieTracks: ({ id: number; name: string; lang?: string; isWyzie: boolean } & { _srtUrl: string })[] = []

            for (let i = 0; i < filtered.length; i++) {
                const sub = filtered[i]
                const trackId = WYZIE_TRACK_OFFSET + i
                wyzieTracks.push({
                    id: trackId,
                    name: sub.display || sub.language || `Sub ${trackId}`,
                    lang: sub.language,
                    isWyzie: true,
                    _srtUrl: sub.url,
                })
            }

            if (!wyzieTracks.length) { console.debug('[Wyzie] no tracks created'); return }
            console.debug('[Wyzie] tracks created:', wyzieTracks.length)

            subtitleTracks.value = [
                ...subtitleTracks.value,
                ...wyzieTracks,
            ]

            if (selectedSubtitleTrack.value === -1 && wyzieTracks.length) {
                selectSubtitleTrack(wyzieTracks[0].id)
            }
        }

        function retry() { void doLoad() }

        function onClickOutside(e: MouseEvent) {
            const target = e.target as Node
            if (qualityOpen.value && !qualityRootRef.value?.contains(target)) {
                qualityOpen.value = false
            }
            if (settingsOpen.value) {
                const panel = rootRef.value?.querySelector('.moovie-frame__settings-panel')
                const btn = rootRef.value?.querySelector('.moovie-frame__three-dot-btn')
                if (panel && !panel.contains(target) && btn && !btn.contains(target)) {
                    settingsOpen.value = false
                    settingsSection.value = null
                }
            }
        }

        async function selectQuality(index: number) {
            const q = uniqueQualities.value[index]
            if (!q) return
            const idx = streams.value.findIndex(s => s.quality === q)
            if (idx < 0) return
            qualityOpen.value = false
            settingsOpen.value = false
            settingsSection.value = null
            selectedStreamIndex.value = idx
            const stream = streams.value[idx]
            await tryPlayStream(stream)
        }

        async function selectServer(provider: string) {
            selectedServer.value = provider
            settingsOpen.value = false
            settingsSection.value = null
            console.debug('[MoovieFrame] selectServer:', provider)
            console.debug('[MoovieFrame]  all providerNames in streams:', [...new Set(streams.value.map(s => s.providerName))])
            const group = streams.value.filter(s => s.providerName === provider)
            console.debug('[MoovieFrame]  matching streams:', group.length)
            if (!group.length) return
            const best = pickBest(group)
            if (!best) {
                console.debug('[MoovieFrame] pickBest returned null for provider:', provider)
                return
            }
            console.debug('[MoovieFrame]  picked stream:', best.name, best.quality, 'url:', (best.url || best.proxyUrl || '').slice(0, 80))
            if (!best.url && !best.proxyUrl) {
                console.debug('[MoovieFrame] stream has no URL for provider:', provider)
                return
            }
            try {
                await tryPlayStream(best)
                console.debug('[MoovieFrame] switched to server:', provider)
            } catch (e) {
                console.error('[MoovieFrame] failed to switch to server:', provider, e)
            }
        }

        function selectAudioTrack(index: number) {
            selectedAudioTrack.value = index
            if (hlsInstance && hlsInstance.audioTrack !== undefined) {
                hlsInstance.audioTrack = index
            }
        }

        async function selectSubtitleTrack(index: number) {
            selectedSubtitleTrack.value = index
            captionSrtData.value = ''
            if (index === -1) {
                if (hlsInstance && hlsInstance.subtitleTrack !== undefined) {
                    hlsInstance.subtitleTrack = -1
                }
                return
            }
            if (index >= WYZIE_TRACK_OFFSET) {
                if (hlsInstance && hlsInstance.subtitleTrack !== undefined) {
                    hlsInstance.subtitleTrack = -1
                }
                const track = subtitleTracks.value.find(t => t.id === index)
                if (track && (track as any)._srtUrl) {
                    try {
                        const r = await fetch((track as any)._srtUrl)
                        if (r.ok) captionSrtData.value = await r.text()
                    } catch { /* ignore */ }
                }
            } else {
                if (hlsInstance && hlsInstance.subtitleTrack !== undefined) {
                    hlsInstance.subtitleTrack = index
                }
            }
        }

        function setSubStyle(key: 'fontSize' | 'textColor' | 'opacity' | 'bgOpacity' | 'bgColor' | 'bgBlur' | 'bold' | 'position', val: any) {
            if (key === 'fontSize') subFontSize.value = val
            else if (key === 'textColor') subTextColor.value = val
            else if (key === 'opacity') subOpacity.value = val
            else if (key === 'bgOpacity') subBgOpacity.value = val
            else if (key === 'bgColor') subBgColor.value = val
            else if (key === 'bgBlur') subBgBlur.value = val
            else if (key === 'bold') subBold.value = val
            else if (key === 'position') { subPosition.value = Math.round(Math.max(5, Math.min(95, val))) }
        }

        function selectHlsQuality(index: number) {
            selectedHlsQuality.value = index
            settingsOpen.value = false
            settingsSection.value = null
            if (hlsInstance && hlsInstance.loadLevel !== undefined) {
                hlsInstance.loadLevel = index
            }
        }

        function togglePlay() {
            const video = videoRef.value
            if (!video) return
            if (video.paused) { video.play() } else { video.pause() }
        }

        function toggleMute() {
            const video = videoRef.value
            if (!video) return
            video.muted = !video.muted
            muted.value = video.muted
        }

        function toggleFullscreen() {
            const el = rootRef.value
            if (!el) return
            if (document.fullscreenElement) {
                document.exitFullscreen()
                isFullscreen.value = false
            } else {
                el.requestFullscreen().then(() => isFullscreen.value = true).catch(() => {})
            }
        }

        function formatTime(t: number): string {
            if (!t || !isFinite(t)) return '0:00'
            const m = Math.floor(t / 60)
            const s = Math.floor(t % 60)
            return `${m}:${s.toString().padStart(2, '0')}`
        }

        function seek(e: Event) {
            const video = videoRef.value
            if (!video) return
            const val = parseFloat((e.target as HTMLInputElement).value)
            if (isFinite(val)) video.currentTime = val
        }

        function seekBy(seconds: number) {
            const video = videoRef.value
            if (!video || !isFinite(video.duration)) return
            video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds))
        }

        function setPlaybackSpeed(speed: number) {
            playbackSpeed.value = speed
            settingsSection.value = null
            if (videoRef.value) videoRef.value.playbackRate = speed
        }

        function togglePiP() {
            const video = videoRef.value
            if (!video) return
            if (document.pictureInPictureElement) {
                document.exitPictureInPicture()
            } else {
                video.requestPictureInPicture().catch(() => {})
            }
        }

        function startTrackingIfNeeded() {
            if (stopTracking) { stopTracking(); stopTracking = null }
            if (props.mediaId) {
                stopTracking = startProgressTracking(props.mediaId, props.mediaType, props.mediaType === 'tv' ? props.season : undefined, props.mediaType === 'tv' ? props.episode : undefined)
            }
        }

        watch(() => [props.backdropPath, props.posterPath], () => computeAmbient(), { immediate: true })

        function onKeydown(e: KeyboardEvent) {
            if (e.key === 'ArrowRight') { seekBy(10); e.preventDefault() }
            if (e.key === 'ArrowLeft') { seekBy(-10); e.preventDefault() }
        }

        function onFullscreenChange() { isFullscreen.value = !!document.fullscreenElement }

        onMounted(() => {
            computeAmbient(); startTrackingIfNeeded(); void doLoad()
            document.addEventListener('click', onClickOutside)
            document.addEventListener('fullscreenchange', onFullscreenChange)
            document.addEventListener('keydown', onKeydown)
        })
        onUnmounted(() => {
            cancelScrape(); destroyPlayer()
            if (stopTracking) { stopTracking(); stopTracking = null }
            document.removeEventListener('click', onClickOutside)
            document.removeEventListener('fullscreenchange', onFullscreenChange)
            document.removeEventListener('keydown', onKeydown)
        })

        return { rootRef, videoRef, qualityRootRef, loading, error, ambientImage, providers, streams, uniqueQualities, selectedQualityIndex, activeQualityLabel, hlsQualities, hlsQualityLabel, selectedHlsQuality, qualityOpen, buffering, seeking, retry, selectQuality, settingsOpen, settingsSection, selectedServer, availableServers, audioTracks, selectedAudioTrack, currentAudioLabel, subtitleTracks, selectedSubtitleTrack, currentSubtitleLabel, subFontSize, subTextColor, subOpacity, subBgOpacity, subBgColor, subBgBlur, subBold, subPosition, FONT_SIZES, TEXT_COLORS, BG_COLORS, BG_BLURS, OPACITIES, setSubStyle, visibleCues, subtitleOverlayStyle, subtitleCueStyle, selectServer, selectAudioTrack, selectSubtitleTrack, selectHlsQuality, playing, currentTime, duration, muted, playbackSpeed, isPiP, isFullscreen, playbackStarted, PLAYBACK_SPEEDS, togglePlay, toggleMute, toggleFullscreen, formatTime, seek, seekBy, setPlaybackSpeed, togglePiP }
    },
})
</script>

<style scoped lang="scss">
.moovie-frame {
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
            background: radial-gradient(ellipse at center, transparent 0%, var(--ink-900) 78%);
        }
    }

    &__stage {
        position: relative;
        width: 100%;
        max-width: 100%;
        margin: 0 auto;
        padding: 0 var(--s-4) var(--s-5) var(--s-4);
        @media (min-width: 768px) and (max-width: 1023px) { padding: 0 var(--s-5) var(--s-6) var(--s-5); }
        @media (min-width: 1024px) { padding: 0; }
    }

    &:fullscreen &__stage,
    &:-webkit-full-screen &__stage {
        padding: 0;
        max-width: 100%;
    }

    &__player {
        position: relative;
        aspect-ratio: 16 / 9;
        background: #000;
        border-radius: var(--r-lg);
        overflow: hidden;
        box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--rule);
    }

    &:fullscreen &__player,
    &:-webkit-full-screen &__player {
        aspect-ratio: unset;
        border-radius: 0;
        box-shadow: none;
        height: 100dvh;
        width: 100vw;
    }

    &:fullscreen &__bloom,
    &:-webkit-full-screen &__bloom { display: none; }

    &__video {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
    }

    &__subtitle-overlay {
        position: absolute;
        left: 0;
        right: 0;
        z-index: 8;
        display: flex;
        flex-direction: column;
        align-items: center;
        pointer-events: none;
        transition: bottom 0.2s;
        padding: 0 8%;
    }

    &__subtitle-cue {
        margin: 2px 0;
        padding: 4px 14px;
        border-radius: 4px;
        text-align: center;
        line-height: 1.4;
        font-family: var(--font-ui);
        text-shadow: 0 1px 4px rgba(0,0,0,0.6);
        word-break: break-word;
    }

    &__center-btn {
        position: absolute;
        inset: 0;
        z-index: 10;
        display: grid;
        place-content: center;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s;
        color: #fff;
        &:hover { opacity: 1; }
        @media (hover: none) { opacity: 1; }
    }

    &__overlay {
        position: absolute; inset: 0;
        display: grid; place-content: center; gap: var(--s-3);
        text-align: center; background: var(--ink-900); z-index: 5;
        h3 { font-family: var(--font-display); font-size: var(--fs-2xl); color: var(--bone-50); margin: 0; letter-spacing: var(--ls-tight); }
        &--error h3 { color: #ff8f8f; }
    }

    &__spinner { width: 44px; height: 44px; border-radius: 50%; border: 2px solid var(--rule-strong); border-top-color: var(--ember); animation: spin 1.1s linear infinite; }

    &__retry {
        margin-top: var(--s-2); padding: 0.65rem 1.4rem;
        background: var(--ember); color: var(--ink-900); border: 0;
        border-radius: var(--r-pill); font-family: var(--font-ui); font-weight: 600; cursor: pointer;
        transition: background-color 0.15s, transform 0.15s;
        &:hover { background: var(--ember-600); transform: translateY(-1px); }
    }

    &__quality-menu {
        position: absolute;
        bottom: 52px;
        right: calc(var(--s-3) + 60px);
        z-index: 20;
        min-width: 120px;
        list-style: none;
        padding: var(--s-1);
        background: rgba(15, 15, 15, 0.98);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: var(--r-md);
        backdrop-filter: blur(12px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
    }

    &__quality-item {
        display: block;
        width: 100%;
        padding: 0.4rem 0.75rem;
        background: none;
        border: 0;
        border-radius: var(--r-sm);
        color: #f0eee3;
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        text-align: left;
        cursor: pointer;
        transition: background 0.1s;
        &:hover { background: rgba(255, 255, 255, 0.08); }
        &.is-active { color: #ff5a1f; font-weight: 600; }
    }

    .meta { font-family: var(--font-mono); font-size: var(--fs-xs); letter-spacing: 0.06em; text-transform: uppercase; margin: 0; }
    .eyebrow { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--bone-400); margin: 0; }
}

@keyframes moovie-spin { to { transform: rotate(360deg); } }

.moovie-frame__seekbar {
    position: absolute;
    bottom: 42px;
    left: 0;
    right: 0;
    z-index: 25;
    height: 28px;
    display: flex;
    align-items: center;
    padding: 0 10px;
    pointer-events: none;
    cursor: pointer;
}

.moovie-frame__seek-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    z-index: 2;
    pointer-events: auto;
    margin: 0;
    -webkit-appearance: none;
    appearance: none;
}

.moovie-frame__seek-track {
    position: relative;
    width: 100%;
    height: 5px;
    background: rgba(255, 255, 255, 0.18);
    border-radius: 999px;
    overflow: visible;
    pointer-events: none;
    transition: height 0.15s;
    .moovie-frame__seekbar:hover &,
    &.is-active { height: 7px; }
}

.moovie-frame__seek-fill {
    position: relative;
    height: 100%;
    background: var(--ember, #ff5a1f);
    border-radius: 999px;
    pointer-events: none;
    transition: width 0.1s linear;
}

.moovie-frame__seek-thumb {
    position: absolute;
    right: -6px;
    top: 50%;
    width: 12px;
    height: 12px;
    background: #fff;
    border-radius: 50%;
    transform: translateY(-50%) scale(0);
    transition: transform 0.15s;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
    .moovie-frame__seekbar:hover &,
    .moovie-frame__seek-track.is-active & { transform: translateY(-50%) scale(1); }
}

.moovie-frame__controls {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 25;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
    pointer-events: none;
}

.moovie-frame__controls-left,
.moovie-frame__controls-right {
    display: flex;
    align-items: center;
    gap: 6px;
    pointer-events: auto;
}

.moovie-frame__ctrl-btn {
    width: 34px;
    height: 34px;
    display: grid;
    place-content: center;
    background: none;
    border: 0;
    color: #f0eee3;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.1s;
    &:hover { background: rgba(255, 255, 255, 0.12); }
}

.moovie-frame__three-dot-btn {
    &.is-open { background: rgba(255, 90, 31, 0.3); }
}

.moovie-frame__time {
    font-size: 0.78rem;
    font-family: var(--font-ui);
    color: rgba(255, 255, 255, 0.85);
    white-space: nowrap;
    letter-spacing: 0.02em;
    font-variant-numeric: tabular-nums;
}

.moovie-frame__settings-panel {
    position: absolute;
    bottom: 48px;
    right: 8px;
    z-index: 30;
    min-width: 220px;
    max-width: 280px;
    max-height: 60vh;
    overflow-y: auto;
    background: rgba(15, 15, 15, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--r-md);
    backdrop-filter: blur(16px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
    padding: var(--s-1);
}

.moovie-frame__settings-header {
    display: flex;
    align-items: center;
    gap: var(--s-1);
    padding: 0.4rem 0.5rem 0.4rem 0.25rem;
    font-family: var(--font-ui);
    font-size: var(--fs-sm);
    font-weight: 600;
    color: #f0eee3;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    margin-bottom: var(--s-1);
    min-height: 36px;
}

.moovie-frame__settings-back {
    background: none;
    border: 0;
    color: #f0eee3;
    cursor: pointer;
    padding: 2px;
    display: grid;
    place-content: center;
    border-radius: var(--r-sm);
    &:hover { background: rgba(255, 255, 255, 0.08); }
}

.moovie-frame__settings-item {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    width: 100%;
    padding: 0.45rem 0.65rem;
    background: none;
    border: 0;
    border-radius: var(--r-sm);
    color: #f0eee3;
    font-family: var(--font-ui);
    font-size: var(--fs-sm);
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;
    &:hover { background: rgba(255, 255, 255, 0.08); }
    &.is-active { color: #ff5a1f; font-weight: 600; }
    &.is-dimmed { opacity: 0.4; pointer-events: none; }
}

.moovie-frame__settings-item-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.moovie-frame__settings-item-value {
    font-size: var(--fs-xs);
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100px;
}

.moovie-frame__settings-item-hint {
    color: rgba(255, 255, 255, 0.4);
    font-size: var(--fs-xs);
}

.moovie-frame__settings-chevron {
    flex-shrink: 0;
    color: rgba(255, 255, 255, 0.3);
}

.moovie-frame__settings-divider {
    height: 1px;
    margin: 4px 8px;
    background: rgba(255, 255, 255, 0.06);
}

.moovie-frame__scraper-status {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 24px;
    pointer-events: none;
}

.moovie-frame__scraper-handle {
    font-size: 0.65rem;
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255,255,255,0.4);
    margin-bottom: 4px;
}

.moovie-frame__provider {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    padding: 6px 14px;
    border-radius: 6px;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(6px);
    pointer-events: auto;
    min-width: 140px;
}
.moovie-frame__provider.is-pending { background: rgba(255,90,31,0.2); }
.moovie-frame__provider.is-success { background: rgba(34,197,94,0.2); }
.moovie-frame__provider.is-failure { background: rgba(239,68,68,0.2); }

.moovie-frame__provider-icon {
    width: 18px;
    height: 18px;
    display: grid;
    place-content: center;
    flex-shrink: 0;
}
.moovie-frame__provider-icon .moovie-frame__spinner--sm {
    width: 16px;
    height: 16px;
    border-width: 2px;
}
.moovie-frame__check { color: #4ade80; font-size: 14px; }
.moovie-frame__cross { color: #f87171; font-size: 12px; }
.moovie-frame__dash  { color: #a1a1aa; font-size: 14px; }
.moovie-frame__dot   { color: #52525b; font-size: 11px; }

.moovie-frame__provider-name {
    flex: 1;
    text-align: left;
    color: var(--bone-200);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.moovie-frame__provider-pct {
    color: var(--ember);
    font-variant-numeric: tabular-nums;
    font-size: 0.7rem;
}

@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
    .moovie-frame__spinner { animation: none !important; }
}

.moovie-frame__settings-label {
    padding: 0.5rem 0.65rem 0.25rem;
    font-size: var(--fs-xs);
    font-family: var(--font-mono);
    color: rgba(255,255,255,0.4);
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.moovie-frame__settings-options {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 0 0.65rem 0.5rem;
}

.moovie-frame__settings-chip {
    padding: 0.25rem 0.6rem;
    background: rgba(255,255,255,0.08);
    border: 0;
    border-radius: var(--r-pill);
    color: #f0eee3;
    font-family: var(--font-ui);
    font-size: var(--fs-xs);
    cursor: pointer;
    transition: background 0.1s;
    &:hover { background: rgba(255,255,255,0.16); }
    &.is-active { background: var(--ember, #ff5a1f); color: #000; font-weight: 600; }
    &--icon {
        width: 30px;
        height: 30px;
        display: grid;
        place-content: center;
        padding: 0;
    }
    &--color {
        width: 24px;
        height: 24px;
        padding: 0;
        border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.15);
        &.is-active { border-color: #fff; box-shadow: 0 0 0 2px var(--ember); }
    }
}

.moovie-frame__settings-options--center {
    align-items: center;
    justify-content: center;
}

.moovie-frame__settings-pos-value {
    font-size: var(--fs-sm);
    font-family: var(--font-ui);
    color: #f0eee3;
    min-width: 40px;
    text-align: center;
    font-variant-numeric: tabular-nums;
}
</style>
