<template>
    <div
        ref="rootRef"
        class="moovie-frame"
        :class="{ 'has-error': error, 'is-buffering': buffering, 'is-controls-hidden': controlsHidden }"
        :style="{
            '--sub-bg-opacity': subtitleBgOpacity,
            '--sub-text-opacity': subtitleTextOpacity,
            '--sub-font-size': subtitleFontSize + '%',
            '--sub-position': subtitlePosition + '%'
        }"
    >
        <div v-if="ambientImage" class="moovie-frame__bloom" :style="{ backgroundImage: `url(${ambientImage})` }" aria-hidden="true" />

        <div class="moovie-frame__stage">
            <div class="moovie-frame__player">
                <video ref="videoRef" class="moovie-frame__video" />

                <!-- Loading/Scraping backdrop: native embedded feel -->
                <transition name="fade">
                    <div v-if="loading && loadingBackdropUrl" class="moovie-frame__loading-backdrop" :style="{ backgroundImage: `url(${loadingBackdropUrl})` }" />
                </transition>

                <!-- Custom Loading Overlay like Peestream -->
                <div v-if="loading && !providers.length && !error" class="moovie-frame__loader-overlay">
                    <div class="moovie-frame__spinner-box">
                        <div class="moovie-frame__spinner-pulse" />
                        <span class="moovie-frame__spinner-text">{{ brandText }}</span>
                    </div>
                    <span class="moovie-frame__loader-status">Resolving stream...</span>
                </div>

                <div v-if="!loading && !error" class="moovie-frame__center-btn" @click="togglePlay">
                    <div v-if="buffering" class="moovie-frame__spinner" />
                    <div v-else-if="!playing" class="moovie-frame__big-play-btn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="8,5 19,12 8,19" /></svg>
                    </div>
                </div>

                <div v-if="error && !loading" class="moovie-frame__overlay moovie-frame__overlay--error">
                    <p class="eyebrow">Hub Error</p>
                    <h3>{{ error }}</h3>
                    <button type="button" class="moovie-frame__retry" @click="retry">Retry</button>
                </div>

                <!-- Premium Scraper Overlay -->
                <div v-if="loading && providers.length && !error" class="moovie-frame__scraper-overlay">
                    <div class="moovie-frame__scraper-card">
                        <div class="moovie-frame__scraper-header">
                            <div class="moovie-frame__scraper-scanner" />
                            <span class="moovie-frame__scraper-title">Searching Sources</span>
                            <span class="moovie-frame__scraper-subtitle">Locating high-quality streams...</span>
                        </div>
                        <div class="moovie-frame__scraper-grid">
                            <div
                                v-for="p in providers"
                                :key="p.id"
                                class="moovie-frame__provider-row"
                                :class="`is-${p.status}`"
                            >
                                <div class="moovie-frame__provider-info">
                                    <span class="moovie-frame__provider-status-icon">
                                        <span v-if="p.status === 'pending'" class="moovie-frame__provider-spinner" />
                                        <span v-else-if="p.status === 'success'" class="moovie-frame__check-icon">✓</span>
                                        <span v-else-if="p.status === 'failure'" class="moovie-frame__cross-icon">✕</span>
                                        <span v-else-if="p.status === 'notfound'" class="moovie-frame__dash-icon">–</span>
                                        <span v-else class="moovie-frame__dot-icon">○</span>
                                    </span>
                                    <div class="moovie-frame__provider-details">
                                        <span class="moovie-frame__provider-label">{{ p.name }}</span>
                                        <div v-if="p.status === 'pending'" class="moovie-frame__provider-progress">
                                            <div class="moovie-frame__provider-progress-fill" :style="{ width: p.percentage + '%' }" />
                                        </div>
                                    </div>
                                </div>
                                <span v-if="p.status === 'pending'" class="moovie-frame__provider-pct-val">{{ p.percentage }}%</span>
                                <span v-else-if="p.status === 'success'" class="moovie-frame__provider-status-text is-success">Ready</span>
                                <span v-else-if="p.status === 'failure'" class="moovie-frame__provider-status-text is-failed">Failed</span>
                                <span v-else-if="p.status === 'notfound'" class="moovie-frame__provider-status-text is-notfound">Empty</span>
                                <span v-else class="moovie-frame__provider-status-text">Queued</span>
                            </div>
                        </div>
                    </div>
                </div>

                <ul
                    v-if="!loading && !error && qualityOpen && (uniqueQualities.length > 1 || hlsQualities.length > 0)"
                    ref="qualityRootRef"
                    class="moovie-frame__quality-menu"
                >
                    <template v-if="hlsQualities.length > 0">
                        <li role="option" :aria-selected="selectedHlsQuality === -1">
                            <button
                                type="button"
                                class="moovie-frame__quality-item"
                                :class="{ 'is-active': selectedHlsQuality === -1 }"
                                @click.stop="selectHlsQuality(-1)"
                            >
                                Auto
                            </button>
                        </li>
                        <li
                            v-for="q in hlsQualities"
                            :key="q.id"
                            role="option"
                            :aria-selected="selectedHlsQuality === q.id"
                        >
                            <button
                                type="button"
                                class="moovie-frame__quality-item"
                                :class="{ 'is-active': selectedHlsQuality === q.id }"
                                @click.stop="selectHlsQuality(q.id)"
                            >
                                {{ q.label }}
                            </button>
                        </li>
                    </template>
                    <template v-else-if="uniqueQualities.length > 1">
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
                    </template>
                </ul>

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
                        <button v-if="mediaType === 'tv'" class="moovie-frame__ctrl-btn" @click="$emit('prev-episode')" aria-label="Previous Episode">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="19,20 9,12 19,4" /><rect x="5" y="4" width="2" height="16" rx="0.5" /></svg>
                        </button>
                        <button class="moovie-frame__ctrl-btn" @click="togglePlay" aria-label="Play/Pause">
                            <svg v-if="!playing" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21" /></svg>
                            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                        </button>
                        <button v-if="mediaType === 'tv'" class="moovie-frame__ctrl-btn" @click="$emit('next-episode')" aria-label="Next Episode">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,4 15,12 5,20" /><rect x="17" y="4" width="2" height="16" rx="0.5" /></svg>
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

                <!-- Embed Trigger Button -->
                <button
                    v-if="!loading && !error"
                    type="button"
                    class="moovie-frame__embed-trigger-btn"
                    title="Get Embed Code"
                    @click.stop="embedOpen = !embedOpen"
                >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="16 18 22 12 16 6"></polyline>
                        <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                </button>

                <!-- Embed Drawer -->
                <transition name="drawer-slide">
                    <div v-if="embedOpen" class="moovie-frame__embed-drawer" @click.stop>
                        <div class="moovie-frame__embed-header">
                            <span class="moovie-frame__embed-title">Embed Options</span>
                            <button type="button" class="moovie-frame__embed-close-btn" @click="embedOpen = false">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        
                        <div class="moovie-frame__embed-content">
                            <div class="moovie-frame__embed-input-group">
                                <span class="moovie-frame__embed-input-label">HTML Iframe Embed Code</span>
                                <div class="moovie-frame__embed-code-box-wrapper">
                                    <input type="text" class="moovie-frame__embed-code-input" readonly :value="generatedEmbedCode">
                                    <button type="button" class="moovie-frame__embed-copy-btn" @click="copyEmbedCode">
                                        <svg v-if="!embedCopied" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                        </svg>
                                        <span>{{ embedCopied ? 'Copied!' : 'Copy' }}</span>
                                    </button>
                                </div>
                            </div>
                            
                            <div class="moovie-frame__embed-options-row">
                                <label class="moovie-frame__embed-checkbox-label">
                                    <input type="checkbox" v-model="embedAutoplay">
                                    <span>Autoplay video</span>
                                </label>
                                <label class="moovie-frame__embed-checkbox-label">
                                    <input type="checkbox" v-model="embedMuted">
                                    <span>Mute on start</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </transition>

                <div v-if="settingsOpen" class="moovie-frame__settings-panel" @click.stop>
                    <div class="moovie-frame__settings-mobile-handle" />
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
                            @click="settingsSection = 'subtitles'"
                        >
                            <span class="moovie-frame__settings-item-label">Subtitles</span>
                            <span class="moovie-frame__settings-item-value">{{ subtitleTracks.length ? currentSubtitleLabel : 'Search' }}</span>
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
                        <template v-if="hlsQualities.length > 0">
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
                        <template v-else>
                            <button
                                v-for="(q, i) in uniqueQualities"
                                :key="i"
                                class="moovie-frame__settings-item"
                                :class="{ 'is-active': selectedQualityIndex === i }"
                                @click="selectQuality(i)"
                            >
                                <span>{{ q }}</span>
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

                    <template v-if="settingsSection === 'subtitles'">
                        <!-- Subtitle Delay Sync Control -->
                        <div class="moovie-frame__settings-group">
                            <span class="moovie-frame__settings-group-title">Timing Delay</span>
                            <div class="moovie-frame__sync-row">
                                <button class="moovie-frame__sync-btn" @click="changeSubtitleDelay(-0.5)">-0.5s</button>
                                <span class="moovie-frame__sync-value">{{ subtitleDelay.toFixed(1) }}s</span>
                                <button class="moovie-frame__sync-btn" @click="changeSubtitleDelay(0.5)">+0.5s</button>
                                <button class="moovie-frame__sync-btn is-reset" @click="resetSubtitleDelay">Reset</button>
                            </div>
                        </div>

                        <div class="moovie-frame__settings-divider" />

                        <!-- Subtitle Opacity & Style Controls -->
                        <div class="moovie-frame__settings-group">
                            <span class="moovie-frame__settings-group-title">Background Opacity</span>
                            <div class="moovie-frame__option-grid">
                                <button
                                    v-for="op in [0, 0.25, 0.5, 0.75, 1.0]"
                                    :key="op"
                                    class="moovie-frame__option-btn"
                                    :class="{ 'is-active': subtitleBgOpacity === op }"
                                    @click="subtitleBgOpacity = op"
                                >
                                    {{ Math.round(op * 100) }}%
                                </button>
                            </div>
                        </div>

                        <div class="moovie-frame__settings-group">
                            <span class="moovie-frame__settings-group-title">Text Opacity</span>
                            <div class="moovie-frame__option-grid">
                                <button
                                    v-for="op in [0.5, 0.75, 1.0]"
                                    :key="op"
                                    class="moovie-frame__option-btn"
                                    :class="{ 'is-active': subtitleTextOpacity === op }"
                                    @click="subtitleTextOpacity = op"
                                >
                                    {{ Math.round(op * 100) }}%
                                </button>
                            </div>
                        </div>

                        <div class="moovie-frame__settings-group">
                            <span class="moovie-frame__settings-group-title">Font Size</span>
                            <div class="moovie-frame__option-grid">
                                <button
                                    v-for="sz in [75, 100, 125, 150]"
                                    :key="sz"
                                    class="moovie-frame__option-btn"
                                    :class="{ 'is-active': subtitleFontSize === sz }"
                                    @click="subtitleFontSize = sz"
                                >
                                    {{ sz }}%
                                </button>
                            </div>
                        </div>

                        <div class="moovie-frame__settings-group">
                            <span class="moovie-frame__settings-group-title">Position</span>
                            <div class="moovie-frame__option-grid" style="display: flex; gap: 8px;">
                                <button
                                    type="button"
                                    class="moovie-frame__option-btn"
                                    @click="moveSubtitles('up')"
                                    title="Move Subtitles Up"
                                >
                                    Up
                                </button>
                                <button
                                    type="button"
                                    class="moovie-frame__option-btn"
                                    @click="moveSubtitles('down')"
                                    title="Move Subtitles Down"
                                >
                                    Down
                                </button>
                                <span class="moovie-frame__settings-item-value" style="margin-left: auto; align-self: center; font-size: 0.72rem; opacity: 0.8; padding-right: 8px; font-variant-numeric: tabular-nums;">
                                    {{ 100 - subtitlePosition }}% Raised
                                </span>
                            </div>
                        </div>

                        <div class="moovie-frame__settings-divider" />

                        <span class="moovie-frame__settings-group-title" style="padding: 0 0.75rem;">Tracks</span>
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
                            <span>{{ track.name }}<span v-if="track.lang && track.lang !== track.name" class="moovie-frame__settings-item-hint"> — {{ track.lang }}</span></span>
                        </button>
                        <button
                            v-if="!subtitleTracks.length"
                            class="moovie-frame__settings-item"
                            @click="loadOpenSubtitles()"
                        >
                            <span class="moovie-frame__settings-item-label">Search subtitles</span>
                        </button>
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
import { computed, defineComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useWebImage } from '../../utils/useWebImage'
import { useAmbientColor } from '../../composables/useAmbientColor'
import { startProgressTracking } from '../../composables/useProgress'
import { getSupabaseClient } from '../../lib/supabase'

const HUB_BASE = 'https://proxy.moovie.fun'
const CF_HEADER_PROXY = 'https://cf-header-proxy.moovie.fun'
// Language-variant hub — same VPS as HUB_BASE, mirrors smov's providers.peestream.in
const STREAMSCRAPER_HUB = 'https://proxy.moovie.fun'
const OPENSUBTITLES_API = 'https://providers.peestream.in/api/subtitles'

interface LanguageVariant {
    language: string
    label: string
    provider: string
    id: string           // format "provider:catalogId"
    type: 'movie' | 'show'
    season?: number
    episode?: number
}

/** Mirror of smov fetchLanguageVariants — parallel multi-provider search */
async function fetchLanguageVariantsFromHub(
    title: string,
    type: 'movie' | 'show',
    tmdbId?: string | number,
    season?: number,
    episode?: number
): Promise<LanguageVariant[]> {
    try {
        const providers = ['moovie-catalog', 'homecine', 'zetflix']
        const promises: Promise<LanguageVariant[]>[] = providers.map(async (provider) => {
            try {
                const params = new URLSearchParams({ q: title, type, provider })
                if (tmdbId) params.set('tmdbId', String(tmdbId))
                if (season != null) params.set('season', String(season))
                if (episode != null) params.set('episode', String(episode))
                const ctrl = new AbortController()
                const t = setTimeout(() => ctrl.abort(), 15_000)
                try {
                    const res = await fetch(`${STREAMSCRAPER_HUB}/api/search?${params}`, { signal: ctrl.signal })
                    if (!res.ok) return []
                    const json = await res.json().catch(() => null)
                    if (!json || typeof json !== 'object') return []
                    const items: any[] = json.results?.reduce?.((acc: any[], r: any) => {
                        const v = r.streams?.[0]?._languageVariants
                        if (v) acc.push(...v)
                        return acc
                    }, []) ?? []
                    return items.map((v: any): LanguageVariant => ({
                        language: v.language ?? 'unknown',
                        label: v.language ?? 'Unknown',
                        provider,
                        id: `${provider}:${v.catalogId ?? v.id ?? ''}`,
                        type: v.media_type === 'tv' ? 'show' : (v.type ?? type),
                        season: v.season,
                        episode: v.episode,
                    }))
                } finally {
                    clearTimeout(t)
                }
            } catch { return [] }
        })

        // French (fss), German (streamkiste), Chinese (iyf) — movie only, matches smov
        const idStr = tmdbId ? String(tmdbId) : ''
        if (type === 'movie' && idStr) {
            const specialEndpoints: Array<{ key: string; language: string; provider: string }> = [
                { key: 'fss', language: 'french',  provider: 'fss' },
                { key: 'de',  language: 'german',  provider: 'streamkiste' },
                { key: 'zh',  language: 'chinese', provider: 'iyf' },
            ]
            for (const ep of specialEndpoints) {
                promises.push((async () => {
                    try {
                        const params = new URLSearchParams({ tmdbId: idStr, type, title })
                        const ctrl = new AbortController()
                        const t = setTimeout(() => ctrl.abort(), 30_000)
                        try {
                            const res = await fetch(`${STREAMSCRAPER_HUB}/api/variants/${ep.key}?${params}`, { signal: ctrl.signal })
                            if (!res.ok) return []
                            const json = await res.json().catch(() => null)
                            if (!json?.variants?.length) return []
                            return json.variants.map((v: any): LanguageVariant => ({
                                language: v.language || ep.language,
                                label: v.label || ep.language.charAt(0).toUpperCase() + ep.language.slice(1),
                                provider: ep.provider,
                                id: `${ep.provider}:${v.id || idStr}`,
                                type: 'movie',
                            }))
                        } finally { clearTimeout(t) }
                    } catch { return [] }
                })())
            }
        }

        const results = await Promise.all(promises)
        const allVariants = results.flat()

        // Dedup by id; when same language has multiple providers, append provider name
        const counts = new Map<string, number>()
        for (const v of allVariants) {
            const lk = `${v.language.toLowerCase()}:${v.episode ?? ''}`
            counts.set(lk, (counts.get(lk) ?? 0) + 1)
        }
        const seen = new Set<string>()
        const unique: LanguageVariant[] = []
        for (const v of allVariants) {
            if (seen.has(v.id)) continue
            seen.add(v.id)
            const lk = `${v.language.toLowerCase()}:${v.episode ?? ''}`
            unique.push({
                ...v,
                label: (counts.get(lk) ?? 0) > 1 ? `${v.label} · ${v.provider}` : v.label,
            })
        }
        return unique
    } catch { return [] }
}

/** Mirror of smov resolveLanguageVariantUrl — resolves provider:id to a playable URL */
async function resolveLanguageVariantUrl(
    id: string,
    type: 'movie' | 'show',
    season?: number,
    episode?: number
): Promise<{ url: string; type: 'm3u8' | 'mp4'; proxyUrl?: string } | null> {
    try {
        let provider = 'moovie-catalog'
        let actualId = id
        if (id.includes(':')) {
            const idx = id.indexOf(':')
            provider = id.substring(0, idx)
            actualId = id.substring(idx + 1)
        }
        const params = new URLSearchParams({ provider, id: actualId, type })
        if (season != null) params.set('season', String(season))
        if (episode != null) params.set('episode', String(episode))
        const res = await fetch(`${STREAMSCRAPER_HUB}/api/resolve-variant?${params}`)
        if (!res.ok) return null
        const json = await res.json().catch(() => null)
        if (!json) return null
        const url = json.proxyUrl
            ? STREAMSCRAPER_HUB + json.proxyUrl
            : (json.url || '')
        if (!url) return null
        const responseType = String(json.type ?? '').toLowerCase()
        const isHls = responseType === 'm3u8' || responseType === 'hls' || url.includes('.m3u8')
        return { url, type: isHls ? 'm3u8' : 'mp4', proxyUrl: json.proxyUrl ? STREAMSCRAPER_HUB + json.proxyUrl : undefined }
    } catch { return null }
}

interface OpenSubtitle {
    id: string
    url: string
    language: string
    type: string
    needsProxy: boolean
    opensubtitles: boolean
}

function srtToVtt(srt: string): string {
    let vtt = 'WEBVTT\n\n'
    vtt += srt
        .replace(/\r\n/g, '\n')
        .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    return vtt
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
    emits: ['next-episode', 'prev-episode'],
    setup(props, ctx) {
        const rootRef = ref<HTMLElement | null>(null)
        const videoRef = ref<HTMLVideoElement | null>(null)

        const subtitleDelay = ref(0)
        const subtitleBgOpacity = ref(0.75)
        const subtitleTextOpacity = ref(1.0)
        const subtitleFontSize = ref(100)
        const subtitlePosition = ref(100)

        function resolveFullLanguageName(code?: string): string {
            if (!code) return 'Unknown';
            const cleaned = code.trim().toLowerCase();
            const map: Record<string, string> = {
                'en': 'English', 'eng': 'English',
                'hi': 'Hindi', 'hin': 'Hindi',
                'es': 'Spanish', 'spa': 'Spanish',
                'fr': 'French', 'fra': 'French', 'fre': 'French',
                'de': 'German', 'deu': 'German', 'ger': 'German',
                'it': 'Italian', 'ita': 'Italian',
                'ja': 'Japanese', 'jpn': 'Japanese',
                'ko': 'Korean', 'kor': 'Korean',
                'zh': 'Chinese', 'zho': 'Chinese', 'chi': 'Chinese',
                'ru': 'Russian', 'rus': 'Russian',
                'ar': 'Arabic', 'ara': 'Arabic',
                'pt': 'Portuguese', 'por': 'Portuguese',
                'nl': 'Dutch', 'nld': 'Dutch', 'dut': 'Dutch',
                'tr': 'Turkish', 'tur': 'Turkish',
                'pl': 'Polish', 'pol': 'Polish',
                'sv': 'Swedish', 'swe': 'Swedish',
                'vi': 'Vietnamese', 'vie': 'Vietnamese',
                'th': 'Thai', 'tha': 'Thai',
                'id': 'Indonesian', 'ind': 'Indonesian',
                'ms': 'Malay', 'msa': 'Malay',
                'fa': 'Persian', 'fas': 'Persian',
                'he': 'Hebrew', 'heb': 'Hebrew',
                'uk': 'Ukrainian', 'ukr': 'Ukrainian',
                'ro': 'Romanian', 'ron': 'Romanian', 'rum': 'Romanian',
                'el': 'Greek', 'ell': 'Greek', 'gre': 'Greek',
                'cs': 'Czech', 'ces': 'Czech', 'cze': 'Czech',
                'hu': 'Hungarian', 'hun': 'Hungarian',
                'fi': 'Finnish', 'fin': 'Finnish',
                'no': 'Norwegian', 'nor': 'Norwegian',
                'da': 'Danish', 'dan': 'Danish',
                'sk': 'Slovak', 'slk': 'Slovak', 'slo': 'Slovak',
                'bg': 'Bulgarian', 'bul': 'Bulgarian',
                'hr': 'Croatian', 'hrv': 'Croatian',
                'sr': 'Serbian', 'srp': 'Serbian',
                'sl': 'Slovenian', 'slv': 'Slovenian',
                'et': 'Estonian', 'est': 'Estonian',
                'lv': 'Latvian', 'lav': 'Latvian',
                'lt': 'Lithuanian', 'lit': 'Lithuanian',
                'tl': 'Tagalog', 'tgl': 'Tagalog',
            };
            if (map[cleaned]) return map[cleaned];
            const prefix = cleaned.split('-')[0];
            if (map[prefix]) return map[prefix];
            return code.charAt(0).toUpperCase() + code.slice(1);
        }

        function adjustCueStyles() {
            const video = videoRef.value;
            if (!video) return;
            const delay = subtitleDelay.value;
            const pos = subtitlePosition.value;
            for (let i = 0; i < video.textTracks.length; i++) {
                const track = video.textTracks[i];
                const cues = track.cues;
                if (!cues) continue;
                for (let j = 0; j < cues.length; j++) {
                    const cue = cues[j] as VTTCue;
                    if ((cue as any)._originalStartTime === undefined) {
                        (cue as any)._originalStartTime = cue.startTime;
                        (cue as any)._originalEndTime = cue.endTime;
                    }
                    cue.startTime = (cue as any)._originalStartTime + delay;
                    cue.endTime = (cue as any)._originalEndTime + delay;
                    cue.snapToLines = false;
                    cue.line = pos;
                }
            }
        }

        function changeSubtitleDelay(amount: number) {
            subtitleDelay.value += amount
            adjustCueStyles()
        }

        function resetSubtitleDelay() {
            subtitleDelay.value = 0
            adjustCueStyles()
        }

        function moveSubtitles(direction: 'up' | 'down') {
            if (direction === 'up') {
                subtitlePosition.value = Math.max(0, subtitlePosition.value - 5)
            } else {
                subtitlePosition.value = Math.min(100, subtitlePosition.value + 5)
            }
            adjustCueStyles()
        }

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
        const audioTracks = ref<{ id: number; name: string; lang?: string; _catalogId?: string }[]>([])
        const selectedAudioTrack = ref(-1)
        const languageVariants = ref<LanguageVariant[]>([])
        let langVariantFetchKey = ''
        const subtitleTracks = ref<{ id: number; name: string; lang?: string; subUrl?: string; needsProxy?: boolean }[]>([])
        const selectedSubtitleTrack = ref(-1)
        let subBlobUrls: string[] = []
        const subLoadedTracks = new Map<number, { el: HTMLTrackElement; blobUrl: string }>()
        let subsLoading = false
        const hlsQualities = ref<{ id: number; label: string; height: number }[]>([])
        const selectedHlsQuality = ref(-1)
        const OPENSUBS_TRACK_OFFSET = 1000

        const controlsHidden = ref(false)
        const embedOpen = ref(false)
        const embedAutoplay = ref(true)
        const embedMuted = ref(false)
        const embedCopied = ref(false)

        const brandText = computed(() => {
            if (typeof window !== 'undefined') {
                return window.location.hostname.includes('peestream') ? 'pee' : 'moovie'
            }
            return 'moovie'
        })

        const embedUrl = computed(() => {
            if (typeof window === 'undefined') return ''
            let url = `${window.location.origin}/embed/?tmdbId=${props.mediaId}&type=${props.mediaType}`
            if (props.mediaType === 'tv') {
                url += `&season=${props.season || 1}&episode=${props.episode || 1}`
            }
            if (embedAutoplay.value) url += '&autoplay=1'
            if (embedMuted.value) url += '&muted=1'
            return url
        })

        const generatedEmbedCode = computed(() => {
            return `<iframe src="${embedUrl.value}" width="100%" height="100%" frameborder="0" allowfullscreen allow="autoplay; encrypted-media"></iframe>`
        })

        const copyEmbedCode = () => {
            navigator.clipboard.writeText(generatedEmbedCode.value).then(() => {
                embedCopied.value = true
                setTimeout(() => { embedCopied.value = false }, 2000)
            }).catch((err) => {
                console.error('Failed to copy embed code:', err)
            })
        }
        let idleTimer: ReturnType<typeof setTimeout> | null = null
        function resetIdleTimer() {
            controlsHidden.value = false
            if (idleTimer) clearTimeout(idleTimer)
            idleTimer = setTimeout(function() {
                if (playing.value && !seeking.value && !settingsOpen.value && !qualityOpen.value) {
                    controlsHidden.value = true
                }
            }, 3000)
        }
        function handleMouseLeave() {
            if (playing.value && !seeking.value && !settingsOpen.value && !qualityOpen.value) {
                controlsHidden.value = true
                if (idleTimer) clearTimeout(idleTimer)
            }
        }

        // WatchTogether sync protocol
        let isRespondingToSync = false;
        let pendingSyncTime: number | null = null;
        let pendingSyncPlaying: boolean | null = null;

        function reportPlayerEvent(event: 'play' | 'pause' | 'seek' | 'heartbeat' | 'ready', time?: number) {
            if (isRespondingToSync) return;
            if (typeof window === 'undefined' || window.parent === window) return;
            const video = videoRef.value;
            if (!video) return;
            console.warn('[MoovieFrame] reportPlayerEvent:', event, 'time:', time ?? video.currentTime, 'playing:', !video.paused);
            window.parent.postMessage({
                type: 'watchable-player-sync',
                event,
                time: time ?? video.currentTime,
                playing: !video.paused
            }, '*');
        }

        function handleParentMessage(e: MessageEvent) {
            const data = e.data;
            if (!data || typeof data !== 'object') return;
            if (data.type !== 'moovie-command-sync') return;

            const video = videoRef.value;
            if (!video) return;

            console.warn('[MoovieFrame] handleParentMessage received command:', data, 'readyState:', video.readyState);

            if (video.readyState < 1) {
                if (data.time != null && Number.isFinite(data.time)) {
                    pendingSyncTime = data.time;
                }
                if (data.playing != null) {
                    pendingSyncPlaying = data.playing;
                }
                return;
            }

            isRespondingToSync = true;

            // Sync current time
            if (data.time != null && Number.isFinite(data.time)) {
                const diff = Math.abs(video.currentTime - data.time);
                if (diff > 3 || data.force) {
                    video.currentTime = data.time;
                }
            }

            // Sync play/pause state
            if (data.playing != null) {
                if (data.playing && video.paused) {
                    video.play().catch(() => {});
                } else if (!data.playing && !video.paused) {
                    video.pause();
                }
            }

            setTimeout(() => {
                isRespondingToSync = false;
            }, 100);
        }

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

        // Streams visible for the currently active server — if a server is selected,
        // only show its streams; otherwise fall back to all streams.
        const activeServerStreams = computed(() => {
            if (selectedServer.value) {
                const group = streams.value.filter(s => s.providerName === selectedServer.value)
                if (group.length) return group
            }
            return streams.value
        })

        const uniqueQualities = computed(() => {
            const seen = new Set<string>()
            const out: string[] = []
            for (const s of activeServerStreams.value) {
                const q = s.quality || 'Auto'
                if (!seen.has(q)) {
                    seen.add(q)
                    out.push(q)
                }
            }
            return out
        })

        const selectedQualityIndex = computed(() => {
            const currentStream = streams.value[selectedStreamIndex.value]
            if (!currentStream) return 0
            const q = currentStream.quality || 'Auto'
            const idx = uniqueQualities.value.indexOf(q)
            return idx >= 0 ? idx : 0
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

        const loadingBackdropUrl = computed(() => {
            const path = props.backdropPath || props.posterPath
            return path ? useWebImage(path, 'large') : ''
        })

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
            for (const { el } of subLoadedTracks.values()) { el.remove() }
            subLoadedTracks.clear()
            for (const url of subBlobUrls) { URL.revokeObjectURL(url) }
            subBlobUrls = []
            audioTracks.value = []
            subtitleTracks.value = []
        }

        async function mountPlayer(url: string, forceHls = false) {
            console.log('[MOVIEFRAME] mountPlayer - season:', props.season, 'episode:', props.episode, 'url:', url.slice(0, 120))
            destroyPlayer()
            qualityOpen.value = false
            buffering.value = true

            await loadHlsJs()
            const HlsCtor = (window as any).Hls
            // Use HLS.js if the URL looks like m3u8 OR the caller explicitly says it's HLS
            // (proxy URLs like proxy.moovie.fun/proxy?id=... carry no extension)
            const isHls = forceHls || url.includes('.m3u8') || url.includes('m3u8')

            const video = videoRef.value
            if (!video) { console.debug('[MoovieFrame] mountPlayer no video element'); return }

            video.removeAttribute('src')
            video.controls = false
            video.playsInline = true
            video.autoplay = true
            video.playbackRate = playbackSpeed.value

            const onBufferEnd = () => { buffering.value = false; playing.value = !video.paused }
            const onTimeUpdate = () => { currentTime.value = video.currentTime; duration.value = video.duration || 0 }
            const onPlayPause = () => { 
                playing.value = !video.paused;
                reportPlayerEvent(video.paused ? 'pause' : 'play');
            }
            const onSeeked = () => {
                onBufferEnd();
                reportPlayerEvent('seek');
            }
            const applyPendingSync = () => {
                if (video.readyState >= 1) {
                    if (pendingSyncTime != null || pendingSyncPlaying != null) {
                        console.warn('[MoovieFrame] applyPendingSync executing. readyState:', video.readyState, 'pendingSyncTime:', pendingSyncTime, 'pendingSyncPlaying:', pendingSyncPlaying);
                        isRespondingToSync = true;
                        if (pendingSyncTime != null) {
                            video.currentTime = pendingSyncTime;
                            pendingSyncTime = null;
                        }
                        if (pendingSyncPlaying != null) {
                            if (pendingSyncPlaying && video.paused) {
                                video.play().catch((err) => {
                                    console.warn('[MoovieFrame] play() failed (likely autoplay policy):', err);
                                });
                            } else if (!pendingSyncPlaying && !video.paused) {
                                video.pause();
                            }
                            pendingSyncPlaying = null;
                        }
                        setTimeout(() => {
                            isRespondingToSync = false;
                        }, 500);
                    }
                }
            };

            video.addEventListener('loadedmetadata', applyPendingSync)
            video.addEventListener('loadeddata', applyPendingSync)
            video.addEventListener('canplay', applyPendingSync)
            video.addEventListener('play', applyPendingSync)

            const pendingSyncInterval = setInterval(() => {
                if (pendingSyncTime != null || pendingSyncPlaying != null) {
                    applyPendingSync();
                } else {
                    clearInterval(pendingSyncInterval);
                }
            }, 250);
            video.addEventListener('waiting', () => { buffering.value = true })
            video.addEventListener('playing', onBufferEnd)
            video.addEventListener('canplay', onBufferEnd)
            video.addEventListener('loadeddata', onBufferEnd)
            video.addEventListener('seeked', onSeeked)
            video.addEventListener('error', onBufferEnd)
            video.addEventListener('abort', onBufferEnd)
            video.addEventListener('timeupdate', onTimeUpdate)
            video.addEventListener('play', onPlayPause)
            video.addEventListener('pause', onPlayPause)
            video.addEventListener('volumechange', () => { muted.value = video.muted })
            video.addEventListener('durationchange', onTimeUpdate)
            video.addEventListener('enterpictureinpicture', () => { isPiP.value = true })
            video.addEventListener('leavepictureinpicture', () => { isPiP.value = false })
            video.addEventListener('ended', () => {
                if (props.mediaType === 'tv') {
                    ctx.emit('next-episode')
                }
            })

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
                    if (levels.length > 0) {
                        hlsInstance.loadLevel = levels[0].id
                        selectedHlsQuality.value = levels[0].id
                    } else {
                        selectedHlsQuality.value = hlsInstance.currentLevel ?? -1
                    }
                })

                hlsInstance.on(HlsCtor.Events.LEVEL_SWITCHED, (_event: any, data: any) => {
                    selectedHlsQuality.value = data.level
                })

                hlsInstance.on(HlsCtor.Events.AUDIO_TRACKS_UPDATED, () => {
                    const preservedVariants = audioTracks.value.filter(t => (t as any)._catalogId)
                    audioTracks.value = [
                        ...(hlsInstance.audioTracks || []).map((t: any, i: number) => ({
                            id: i,
                            name: t.name || t.lang || `Track ${i}`,
                            lang: t.lang,
                        })),
                        ...preservedVariants,
                    ]
                    selectedAudioTrack.value = hlsInstance.audioTrack ?? -1
                })
                hlsInstance.on(HlsCtor.Events.SUBTITLE_TRACKS_UPDATED, () => {
                    subtitleTracks.value = (hlsInstance.subtitleTracks || []).map((t: any, i: number) => {
                        const fullName = resolveFullLanguageName(t.name || t.lang);
                        return {
                            id: i,
                            name: fullName || `Track ${i}`,
                            lang: resolveFullLanguageName(t.lang),
                        };
                    })
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
            const url = `${HUB_BASE}/scrape?${params}`
            console.log('[MOVIEFRAME] buildScrapeUrl:', url, 'season:', props.season, 'episode:', props.episode)
            return url
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

                            if (mw._languageVariants && Array.isArray(mw._languageVariants)) {
                                for (const lv of mw._languageVariants) {
                                    const variantId = `moovie-catalog:${lv.catalogId}`
                                    const existsInVariants = languageVariants.value.some(v => v.id === variantId)
                                    if (!existsInVariants) {
                                        const exists = audioTracks.value.some(t => (t as any)._catalogId === lv.catalogId || (t as any)._variantId === variantId)
                                        if (!exists) {
                                            audioTracks.value.push({
                                                id: 2000 + audioTracks.value.length,
                                                name: lv.language,
                                                lang: lv.language,
                                                _catalogId: lv.catalogId,
                                            } as any)
                                            languageVariants.value.push({
                                                language: lv.language,
                                                label: lv.language,
                                                provider: 'moovie-catalog',
                                                id: variantId,
                                                type: props.mediaType === 'tv' ? 'show' : 'movie',
                                                season: props.season,
                                                episode: props.episode,
                                            })
                                            console.debug('[MoovieFrame]  added language variant from SSE:', lv.language, lv.catalogId)
                                        }
                                    }
                                }
                            }
                        }
                        if (!rawStreams.length) {
                            if (ps) { ps.status = 'notfound'; providers.value = [...providerMap.values()] }
                            return
                        }

                        if (!playbackStarted.value) {
                            const best = pickBest(allStreams)
                            if (best) {
                                console.log('[MOVIEFRAME] SSE completed - starting early playback, streams count:', allStreams.length, 'season:', props.season, 'episode:', props.episode)
                                playbackStarted.value = true
                                loading.value = false
                                console.log('[MOVIEFRAME] SSE early playback picked:', best.name, best.quality, 'url:', (best.url || best.proxyUrl || '').slice(0, 100))
                                tryPlayStream(best).catch(e => console.error('[MoovieFrame] early playback error:', e))
                            }
                        } else {
                            console.log('[MOVIEFRAME] SSE completed but playbackStarted already true (season:', props.season, 'ep:', props.episode, ')')
                        }
                    } catch { /* ignore */ }
                })

                eventSource.addEventListener('done', () => {
                    console.log('[MOVIEFRAME] SSE done event - playbackStarted:', playbackStarted.value, 'streams:', allStreams.length)
                    if (!playbackStarted.value && allStreams.length) {
                        playbackStarted.value = true
                        loading.value = false
                        const best = pickBest(allStreams)
                        if (best) {
                            console.log('[MOVIEFRAME] done handler starting playback with:', best.name, best.quality)
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

        const providerRank: Record<string, number> = {
            'Poseidon': 3,
            'Athena': 2,
            'Zeus': 1,
            'Hades': 0,
        }

        function scoreStream(s: HubStream): number {
            const q = (s.quality || '').toUpperCase().trim()
            const qRank = qualityRank[q] ?? 0
            const pName = s.providerName || ''
            const pRank = providerRank[pName] ?? 0
            const typeBonus = s.type === 'm3u8' || s.url?.includes('.m3u8') ? 0.5 : 0
            // Quality has highest weight, provider breaks ties, type breaks further ties
            return (qRank * 10) + pRank + typeBonus
        }



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
            console.log('[MOVIEFRAME] doLoad start - season:', props.season, 'episode:', props.episode)
            destroyPlayer(); loading.value = true; error.value = ''; playbackStarted.value = false
            langVariantFetchKey = '' // reset so variant fetch fires fresh
            try {
                await ensureProxySetting()
                // Fire language variant fetch in parallel — mirrors smov's useAutoFetchLanguageVariants
                void triggerLanguageVariantFetch()
                const all = await fetchStreams()
                console.log('[MOVIEFRAME] doLoad got', all.length, 'streams')
                streams.value = all
                if (!all.length) throw new Error('No streamable sources found')
                if (playbackStarted.value) { console.log('[MOVIEFRAME] doLoad: playback already started by SSE, skipping tryProviderChain'); loading.value = false; return }
                console.log('[MOVIEFRAME] doLoad calling tryProviderChain')
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
            // Sort all streams globally: highest quality/score first
            const sorted = [...all].sort((a, b) => scoreStream(b) - scoreStream(a))
            console.log('[MOVIEFRAME] tryProviderChain sorted list:', sorted.map(s => `${s.providerName}-${s.quality}`))
            for (const stream of sorted) {
                try {
                    await tryPlayStream(stream)
                    return
                } catch (e) {
                    console.debug('[MoovieFrame] fallback provider failed:', stream.providerName, stream.quality, (e as Error).message)
                }
            }
            throw new Error('All providers failed')
        }

        async function tryPlayStream(s: HubStream) {
            const useProxy = proxyEnabled && !!s.proxyUrl
            const isHlsStream = s.type === 'm3u8' || s.type === 'hls'
            async function tryMount(url: string) {
                await Promise.all([
                    mountPlayer(url, isHlsStream),
                    loadOpenSubtitles().catch(() => {}),
                ])
            }
            let playUrl: string
            if (useProxy) {
                playUrl = s.proxyUrl!
                try {
                    await tryMount(playUrl)
                } catch (e) {
                    throw e
                }
            } else if (s.headers && Object.keys(s.headers).length) {
                // CF worker rewrites .m3u8 manifest so segments load directly
                // from the origin (no worker hop per segment). Only the manifest
                // goes through the worker, so no more Cloudflare rate-limit 429s.
                const params = new URLSearchParams({ url: s.url })
                if (s.headers.Referer) params.set('referer', s.headers.Referer)
                if (s.headers.Origin)  params.set('origin',  s.headers.Origin)
                if (s.headers['User-Agent']) params.set('ua', s.headers['User-Agent'])
                playUrl = `${CF_HEADER_PROXY}/?${params}`
                await tryMount(playUrl)
            } else {
                playUrl = s.url
                try {
                    await tryMount(playUrl)
                } catch (e) {
                    if (s.proxyUrl && proxyEnabled) {
                        console.debug('[MoovieFrame] direct playback failed, falling back to proxy:', s.proxyUrl)
                        await tryMount(s.proxyUrl)
                    } else {
                        throw e
                    }
                }
            }
        }

        async function fetchOpenSubtitles(): Promise<OpenSubtitle[]> {
            const id = String(props.mediaId)
            if (!id) { console.debug('[OpenSubtitles] no mediaId'); return [] }
            const params = new URLSearchParams({ tmdbId: id, type: props.mediaType })
            if (props.mediaType === 'tv' && props.season > 0 && props.episode > 0) {
                params.set('season', String(props.season))
                params.set('episode', String(props.episode))
            }
            const url = `${OPENSUBTITLES_API}?${params}`
            console.debug('[OpenSubtitles] fetching:', url)
            try {
                const resp = await fetch(url, { signal: AbortSignal.timeout(10000) })
                if (!resp.ok) { console.debug('[OpenSubtitles] failed', resp.status); return [] }
                const data = await resp.json()
                if (!data.captions || !Array.isArray(data.captions)) return []
                return data.captions as OpenSubtitle[]
            } catch (e) {
                console.debug('[OpenSubtitles] error:', (e as Error).message)
                return []
            }
        }

        async function downloadSubtitleBlob(subUrl: string, needsProxy: boolean): Promise<string | null> {
            let fetchUrl = subUrl
            if (needsProxy) {
                try {
                    const u = btoa(subUrl).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
                    fetchUrl = `https://providers.peestream.in/proxy?u=${u}`
                } catch (e) {
                    fetchUrl = `https://providers.peestream.in/proxy?u=${encodeURIComponent(subUrl)}`
                }
            }
            try {
                let resp = await fetch(fetchUrl, { signal: AbortSignal.timeout(15000) })
                if (!resp.ok && needsProxy) {
                    console.warn('[OpenSubtitles] Proxy fetch returned not-ok status. Falling back to direct fetch.');
                    fetchUrl = subUrl;
                    resp = await fetch(fetchUrl, { signal: AbortSignal.timeout(15000) })
                }
                if (!resp.ok) return null
                const text = await resp.text()
                const vtt = srtToVtt(text)
                const blob = new Blob([vtt], { type: 'text/vtt' })
                return URL.createObjectURL(blob)
            } catch (err) {
                if (needsProxy) {
                    console.warn('[OpenSubtitles] Proxy fetch failed with error, trying direct fallback:', err);
                    try {
                        const resp = await fetch(subUrl, { signal: AbortSignal.timeout(15000) })
                        if (resp.ok) {
                            const text = await resp.text()
                            const vtt = srtToVtt(text)
                            const blob = new Blob([vtt], { type: 'text/vtt' })
                            return URL.createObjectURL(blob)
                        }
                    } catch (fallbackErr) {
                        console.warn('[OpenSubtitles] Direct fallback fetch also failed:', fallbackErr);
                    }
                }
                return null
            }
        }

        async function loadOpenSubtitles() {
            if (subsLoading) { console.debug('[OpenSubtitles] already loading, skipping'); return }
            subsLoading = true
            console.debug('[OpenSubtitles] loading subtitle list...')
            const subs = await fetchOpenSubtitles()
            subsLoading = false
            if (!subs.length) { console.debug('[OpenSubtitles] no subtitles found'); return }

            const openTracks = subs.map((sub, i) => {
                const fullName = resolveFullLanguageName(sub.language);
                return {
                    id: OPENSUBS_TRACK_OFFSET + i,
                    name: fullName || `Sub ${i}`,
                    lang: resolveFullLanguageName(sub.language),
                    subUrl: sub.url,
                    needsProxy: sub.needsProxy,
                };
            })

            subtitleTracks.value = [
                ...subtitleTracks.value.filter(t => t.id < OPENSUBS_TRACK_OFFSET),
                ...openTracks,
            ]

            console.debug('[OpenSubtitles]', openTracks.length, 'tracks available')
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
            // Find the stream in the active server's pool first, then fall back globally
            const pool = activeServerStreams.value
            const poolIdx = pool.findIndex(s => s.quality === q)
            const stream = poolIdx >= 0 ? pool[poolIdx] : streams.value.find(s => s.quality === q)
            if (!stream) return
            const globalIdx = streams.value.indexOf(stream)
            qualityOpen.value = false
            settingsOpen.value = false
            settingsSection.value = null
            selectedStreamIndex.value = globalIdx >= 0 ? globalIdx : 0
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

        async function selectAudioTrack(index: number) {
            selectedAudioTrack.value = index

            // HLS native audio track switch (e.g. dubbed HLS streams)
            if (hlsInstance && hlsInstance.audioTrack !== undefined && index < 2000) {
                hlsInstance.audioTrack = index
                return
            }

            // Language variant resolve (smov-style multi-provider)
            const track = audioTracks.value.find(t => t.id === index)
            const variantId = (track as any)?._variantId || (track as any)?._catalogId
            if (!variantId) return

            const lv = languageVariants.value.find(v => v.id === variantId || (v as any).catalogId === variantId)
            if (!lv) return

            console.debug('[MoovieFrame] selectAudioTrack: resolving variant', lv.id, 'type:', lv.type)
            buffering.value = true

            const resolved = await resolveLanguageVariantUrl(
                lv.id,
                lv.type,
                lv.season,
                lv.episode
            )
            if (!resolved?.url) {
                console.warn('[MoovieFrame] selectAudioTrack: could not resolve variant URL for', lv.id)
                buffering.value = false
                return
            }

            console.debug('[MoovieFrame] selectAudioTrack: playing', lv.label, resolved.url.slice(0, 80))
            const s: HubStream = {
                name: lv.label,
                url: resolved.url,
                proxyUrl: resolved.proxyUrl || '',
                quality: 'Auto',
                type: resolved.type,
                providerName: lv.provider,
            }
            await tryPlayStream(s)
        }

        /** Fetch language variants from all providers (smov logic) and populate audioTracks */
        async function triggerLanguageVariantFetch() {
            if (!props.mediaId || !props.title) return

            const key = `${props.mediaId}-${props.mediaType}-${props.season ?? 0}-${props.episode ?? 0}`
            if (langVariantFetchKey === key) return
            langVariantFetchKey = key

            // Clear previous hub-sourced audio tracks (keep HLS native ones id < 2000)
            audioTracks.value = audioTracks.value.filter(t => t.id < 2000)
            languageVariants.value = []

            console.debug('[MoovieFrame] triggerLanguageVariantFetch: fetching for', props.title, props.mediaType, props.mediaId)

            const variants = await fetchLanguageVariantsFromHub(
                props.title,
                props.mediaType === 'tv' ? 'show' : 'movie',
                props.mediaId,
                props.mediaType === 'tv' ? props.season : undefined,
                props.mediaType === 'tv' ? props.episode : undefined
            )

            if (langVariantFetchKey !== key) return  // stale — props changed

            console.debug('[MoovieFrame] triggerLanguageVariantFetch: got', variants.length, 'variants')
            if (!variants.length) return

            languageVariants.value = variants

            // Keep existing HLS native audio tracks, add hub variants at id >= 2000
            const existingHlsTracks = audioTracks.value.filter(t => t.id < 2000)
            const variantTracks = variants.map((v, i) => ({
                id: 2000 + i,
                name: v.label,
                lang: v.language,
                _variantId: v.id,
            }))
            audioTracks.value = [...existingHlsTracks, ...variantTracks]
        }

        async function selectSubtitleTrack(index: number) {
            selectedSubtitleTrack.value = index
            if (index === -1) {
                for (const { el } of subLoadedTracks.values()) { el.track.mode = 'disabled' }
                if (hlsInstance && hlsInstance.subtitleTrack !== undefined) {
                    hlsInstance.subtitleTrack = -1
                }
                return
            }
            if (index >= OPENSUBS_TRACK_OFFSET) {
                if (hlsInstance && hlsInstance.subtitleTrack !== undefined) {
                    hlsInstance.subtitleTrack = -1
                }
                for (const { el } of subLoadedTracks.values()) { el.track.mode = 'disabled' }

                let entry = subLoadedTracks.get(index)
                if (!entry) {
                    const trackMeta = subtitleTracks.value.find(t => t.id === index)
                    if (!trackMeta?.subUrl) { console.debug('[OpenSubtitles] no subUrl for track', index); return }
                    const video = videoRef.value
                    if (!video) return
                    console.debug('[OpenSubtitles] lazy-loading sub:', trackMeta.name)
                    const blobUrl = await downloadSubtitleBlob(trackMeta.subUrl, !!trackMeta.needsProxy)
                    if (!blobUrl) { console.debug('[OpenSubtitles] failed to load sub'); return }
                    const el = document.createElement('track')
                    el.kind = 'captions'
                    el.label = trackMeta.name
                    el.srclang = trackMeta.lang || 'en'
                    el.src = blobUrl
                    el.default = false
                    video.appendChild(el)
                    el.addEventListener('load', () => adjustCueStyles())
                    subBlobUrls.push(blobUrl)
                    entry = { el, blobUrl }
                    subLoadedTracks.set(index, entry)
                }
                entry.el.track.mode = 'showing'
                nextTick(() => adjustCueStyles())
            } else {
                for (const { el } of subLoadedTracks.values()) { el.track.mode = 'disabled' }
                if (hlsInstance && hlsInstance.subtitleTrack !== undefined) {
                    hlsInstance.subtitleTrack = index
                }
            }
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
            } else {
                el.requestFullscreen().catch((e) => console.warn('[MoovieFrame] fullscreen failed:', e.message, e))
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
            if (!isFinite(val)) return
            currentTime.value = val
            video.currentTime = val
        }

        function seekBy(seconds: number) {
            const video = videoRef.value
            if (!video || !isFinite(video.duration)) return
            const target = Math.max(0, Math.min(video.duration, video.currentTime + seconds))
            currentTime.value = target
            video.currentTime = target
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

        watch(() => [props.season, props.episode], (newVals, oldVals) => {
            const newS = newVals[0], newE = newVals[1]
            const oldS = oldVals?.[0], oldE = oldVals?.[1]
            console.log('[MOVIEFRAME] watcher: season', oldS, '->', newS, 'episode', oldE, '->', newE, 'mediaId:', props.mediaId)
            if (newS !== oldS || newE !== oldE) {
                subtitleTracks.value = []
            }
            if (props.mediaId) {
                console.log('[MOVIEFRAME] watcher calling doLoad()')
                void doLoad();
                startTrackingIfNeeded();
            }
        }, { immediate: true })

        function onKeydown(e: KeyboardEvent) {
            const tag = (e.target as HTMLElement)?.tagName
            const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable
            if (isEditable) return
            if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); togglePlay() }
            if (e.key === 'ArrowRight') { seekBy(10); e.preventDefault() }
            if (e.key === 'ArrowLeft') { seekBy(-10); e.preventDefault() }
        }

        function onFullscreenChange() { isFullscreen.value = !!document.fullscreenElement }

        let heartbeatInterval: any = null;
        let cueTimer: any = null;

        onMounted(() => {
            computeAmbient(); startTrackingIfNeeded()
            document.addEventListener('click', onClickOutside)
            document.addEventListener('fullscreenchange', onFullscreenChange)
            document.addEventListener('keydown', onKeydown)
            window.addEventListener('message', handleParentMessage)
            const root = rootRef.value
            if (root) {
                root.addEventListener('mousemove', resetIdleTimer)
                root.addEventListener('touchstart', resetIdleTimer)
                root.addEventListener('mouseleave', handleMouseLeave)
            }
            resetIdleTimer()
 
            // Heartbeat sync timer (every 3 seconds)
            heartbeatInterval = setInterval(() => {
                if (playing.value) {
                    reportPlayerEvent('heartbeat');
                }
            }, 3000);

            // Report ready event for watchtogether playback sync on mount
            setTimeout(() => {
                reportPlayerEvent('ready');
            }, 100);

            cueTimer = setInterval(() => {
                adjustCueStyles()
            }, 1000);
        })

        watch(subtitlePosition, () => {
            nextTick(() => adjustCueStyles())
        })

        onUnmounted(() => {
            if (idleTimer) clearTimeout(idleTimer)
            if (heartbeatInterval) clearInterval(heartbeatInterval)
            if (cueTimer) clearInterval(cueTimer)
            cancelScrape(); destroyPlayer()
            if (stopTracking) { stopTracking(); stopTracking = null }
            document.removeEventListener('click', onClickOutside)
            document.removeEventListener('fullscreenchange', onFullscreenChange)
            document.removeEventListener('keydown', onKeydown)
            window.removeEventListener('message', handleParentMessage)
            const root = rootRef.value
            if (root) {
                root.removeEventListener('mousemove', resetIdleTimer)
                root.removeEventListener('touchstart', resetIdleTimer)
                root.removeEventListener('mouseleave', handleMouseLeave)
            }
        })

        return { rootRef, videoRef, qualityRootRef, loading, error, ambientImage, loadingBackdropUrl, providers, streams, uniqueQualities, selectedQualityIndex, activeQualityLabel, hlsQualities, hlsQualityLabel, selectedHlsQuality, qualityOpen, buffering, seeking, retry, selectQuality, settingsOpen, settingsSection, selectedServer, availableServers, audioTracks, selectedAudioTrack, currentAudioLabel, subtitleTracks, selectedSubtitleTrack, currentSubtitleLabel, selectServer, selectAudioTrack, selectSubtitleTrack, selectHlsQuality, playing, currentTime, duration, muted, playbackSpeed, isPiP, isFullscreen, playbackStarted, PLAYBACK_SPEEDS, togglePlay, toggleMute, toggleFullscreen, formatTime, seek, seekBy, setPlaybackSpeed, togglePiP, loadOpenSubtitles, controlsHidden, subtitleDelay, subtitleBgOpacity, subtitleTextOpacity, subtitleFontSize, subtitlePosition, changeSubtitleDelay, resetSubtitleDelay, embedOpen, embedAutoplay, embedMuted, embedCopied, brandText, generatedEmbedCode, copyEmbedCode, moveSubtitles }
    },
})
</script>

<style scoped lang="scss">
.moovie-frame {
    position: relative;
    width: 100%;
    isolation: isolate;

    // Theme override to match peestream in orange
    --ember: #ff5a1f;
    --ember-600: #ff7842;
    --ember-glow: rgba(255, 90, 31, 0.25);

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

    &__player {
        position: relative;
        aspect-ratio: 16 / 9;
        background: #080808;
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05);
    }

    &:fullscreen {
        background: #000 !important;
        width: 100vw !important;
        height: 100vh !important;
        padding: 0 !important;
        margin: 0 !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        align-items: center !important;

        .moovie-frame__stage {
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
        }
        .moovie-frame__player {
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            max-height: 100% !important;
            border-radius: 0 !important;
            aspect-ratio: unset !important;
            box-shadow: none !important;
            border: 0 !important;
        }
        .moovie-frame__bloom { display: none !important; }
    }

    &:-webkit-full-screen {
        background: #000 !important;
        width: 100vw !important;
        height: 100vh !important;
        padding: 0 !important;
        margin: 0 !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        align-items: center !important;

        .moovie-frame__stage {
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
        }
        .moovie-frame__player {
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            max-height: 100% !important;
            border-radius: 0 !important;
            aspect-ratio: unset !important;
            box-shadow: none !important;
            border: 0 !important;
        }
        .moovie-frame__bloom { display: none !important; }
    }

    &:-moz-full-screen {
        background: #000 !important;
        width: 100vw !important;
        height: 100vh !important;
        padding: 0 !important;
        margin: 0 !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        align-items: center !important;

        .moovie-frame__stage {
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
        }
        .moovie-frame__player {
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            max-height: 100% !important;
            border-radius: 0 !important;
            aspect-ratio: unset !important;
            box-shadow: none !important;
            border: 0 !important;
        }
        .moovie-frame__bloom { display: none !important; }
    }

    &:-ms-fullscreen {
        background: #000 !important;
        width: 100vw !important;
        height: 100vh !important;
        padding: 0 !important;
        margin: 0 !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        align-items: center !important;

        .moovie-frame__stage {
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
        }
        .moovie-frame__player {
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            max-height: 100% !important;
            border-radius: 0 !important;
            aspect-ratio: unset !important;
            box-shadow: none !important;
            border: 0 !important;
        }
        .moovie-frame__bloom { display: none !important; }
    }

    &.is-controls-hidden {
        .moovie-frame__center-btn,
        .moovie-frame__seekbar,
        .moovie-frame__controls,
        .moovie-frame__quality-menu { opacity: 0; pointer-events: none; transition: opacity 0.3s; }
    }

    &.is-buffering {
        .moovie-frame__center-btn {
            opacity: 1 !important;
            pointer-events: auto !important;
        }
    }

    &__loading-backdrop {
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center;
        filter: brightness(0.25) blur(10px);
        transform: scale(1.08); /* avoid blurred edges showing white */
        z-index: 1;
        pointer-events: none;
    }

    &__video {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
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

@keyframes moovie-spin { to { transform: rotate(360deg); } }

.moovie-frame__seekbar {
    position: absolute;
    bottom: 44px;
    left: 0;
    right: 0;
    z-index: 27;
    height: 32px;
    display: flex;
    align-items: center;
    padding: 0 var(--s-4);
    pointer-events: none;
    cursor: pointer;
    opacity: 1;
    transition: opacity 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
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
    height: 4px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 999px;
    overflow: visible;
    pointer-events: none;
    transition: height 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s;
    
    .moovie-frame__seekbar:hover &,
    &.is-active {
        height: 6px;
        background: rgba(255, 255, 255, 0.22);
    }
}

.moovie-frame__seek-fill {
    position: relative;
    height: 100%;
    background: linear-gradient(90deg, #ff4500 0%, var(--ember) 50%, #ff8c00 100%);
    box-shadow: 0 0 12px rgba(255, 90, 31, 0.6);
    border-radius: 999px;
    pointer-events: none;
    transition: width 0.1s linear;
}

.moovie-frame__seek-thumb {
    position: absolute;
    right: -6px;
    top: 50%;
    width: 14px;
    height: 14px;
    background: #ffffff;
    border-radius: 50%;
    transform: translateY(-50%) scale(0);
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.2), 0 0 10px rgba(255, 90, 31, 0.6);
    
    .moovie-frame__seekbar:hover &,
    .moovie-frame__seek-track.is-active & {
        transform: translateY(-50%) scale(1);
    }
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
    padding: 10px var(--s-4) 14px var(--s-4);
    background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.4) 25%, rgba(10, 10, 10, 0.95) 100%);
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    pointer-events: none;
    opacity: 1;
    transition: opacity 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.moovie-frame__controls-left,
.moovie-frame__controls-right {
    display: flex;
    align-items: center;
    gap: 8px;
    pointer-events: auto;
}

.moovie-frame__ctrl-btn {
    width: 36px;
    height: 36px;
    display: grid;
    place-content: center;
    background: rgba(255, 255, 255, 0);
    border: 0;
    color: #f3f1e9;
    cursor: pointer;
    border-radius: 8px;
    transition: background-color 0.2s, transform 0.15s, color 0.2s;
    
    &:hover {
        background-color: rgba(255, 255, 255, 0.1);
        color: #ffffff;
        transform: scale(1.05);
    }
    
    &:active {
        transform: scale(0.95);
    }
}

.moovie-frame__three-dot-btn {
    &.is-open {
        background-color: rgba(255, 90, 31, 0.2);
        color: var(--ember, #ff5a1f);
        box-shadow: 0 0 12px rgba(255, 90, 31, 0.25);
    }
}

.moovie-frame__time {
    font-size: 0.82rem;
    font-family: var(--font-ui);
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    white-space: nowrap;
    letter-spacing: 0.02em;
    font-variant-numeric: tabular-nums;
    margin-left: 6px;
}

.moovie-frame__settings-panel {
    position: absolute;
    bottom: 56px;
    right: 12px;
    z-index: 30;
    min-width: 240px;
    max-width: 300px;
    max-height: 60vh;
    overflow-y: auto;
    background: radial-gradient(circle at top left, rgba(22, 22, 22, 0.95), rgba(12, 12, 12, 0.99));
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 14px;
    backdrop-filter: blur(24px) saturate(1.4);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8), inset 0 1px 1px rgba(255, 255, 255, 0.1);
    padding: var(--s-2);
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.1) transparent;

    &::-webkit-scrollbar {
        width: 4px;
    }
    &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 99px;
    }
}

.moovie-frame__settings-mobile-handle {
    display: none;
    @media (max-width: 640px) {
        display: block;
        width: 38px;
        height: 4px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 99px;
        margin: 2px auto 14px auto;
        flex-shrink: 0;
    }
}

.moovie-frame__settings-header {
    display: flex;
    align-items: center;
    gap: var(--s-1);
    padding: 0.4rem 0.5rem 0.5rem 0.25rem;
    font-family: var(--font-ui);
    font-size: 0.88rem;
    font-weight: 600;
    color: #ffffff;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    margin-bottom: var(--s-2);
    min-height: 38px;
}

.moovie-frame__settings-back {
    background: none;
    border: 0;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    padding: 4px;
    display: grid;
    place-content: center;
    border-radius: var(--r-sm);
    transition: background-color 0.15s, color 0.15s;
    
    &:hover {
        background-color: rgba(255, 255, 255, 0.08);
        color: #ffffff;
    }
}

.moovie-frame__settings-item {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    width: 100%;
    padding: 0.55rem 0.75rem;
    background: none;
    border: 0;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.85);
    font-family: var(--font-ui);
    font-size: 0.85rem;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s, transform 0.1s;
    margin-bottom: 2px;
    
    &:hover {
        background-color: rgba(255, 255, 255, 0.07);
        color: #ffffff;
    }
    
    &.is-active {
        color: var(--ember, #ff5a1f);
        font-weight: 600;
        background-color: rgba(255, 90, 31, 0.08);
    }
    
    &.is-dimmed {
        opacity: 0.35;
        pointer-events: none;
    }
}

.moovie-frame__settings-item-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.moovie-frame__settings-item-value {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
    background: rgba(255, 255, 255, 0.05);
    padding: 1px 6px;
    border-radius: 4px;
}

.moovie-frame__settings-item-hint {
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.75rem;
}

.moovie-frame__settings-chevron {
    flex-shrink: 0;
    color: rgba(255, 255, 255, 0.3);
}

.moovie-frame__settings-divider {
    height: 1px;
    margin: 6px 8px;
    background: rgba(255, 255, 255, 0.07);
}

.moovie-frame__scraper-overlay {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: grid;
    place-content: center;
    padding: var(--s-4);
    pointer-events: none;
    
    @media (max-width: 768px) {
        padding: var(--s-2);
    }
}

.moovie-frame__scraper-card {
    width: 280px;
    max-width: 100%;
    background: radial-gradient(circle at top left, rgba(25, 25, 25, 0.88), rgba(13, 13, 13, 0.98));
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.06);
    padding: var(--s-4);
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
    
    @media (max-width: 768px) {
        width: 230px;
        padding: 10px;
        gap: 8px;
        border-radius: 10px;
    }
}

.moovie-frame__scraper-header {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    padding-bottom: var(--s-2);
    overflow: hidden;
    
    @media (max-width: 768px) {
        padding-bottom: 4px;
        gap: 0px;
    }
}

.moovie-frame__scraper-scanner {
    position: absolute;
    top: 0;
    left: -100%;
    width: 60%;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--ember, #ff5a1f), transparent);
    animation: scanner-loop 2.2s infinite ease-in-out;
}

@keyframes scanner-loop {
    0% { left: -60%; }
    100% { left: 100%; }
}

.moovie-frame__scraper-title {
    font-size: 0.9rem;
    font-family: var(--font-ui);
    font-weight: 600;
    color: #ffffff;
    letter-spacing: 0.01em;
    
    @media (max-width: 768px) {
        font-size: 0.75rem;
    }
}

.moovie-frame__scraper-subtitle {
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.45);
    
    @media (max-width: 768px) {
        font-size: 0.6rem;
    }
}

.moovie-frame__scraper-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
    
    @media (max-width: 768px) {
        gap: 4px;
    }
}

.moovie-frame__provider-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 8px;
    transition: background-color 0.25s, border-color 0.25s;
    
    &.is-pending {
        background: rgba(255, 90, 31, 0.06);
        border-color: rgba(255, 90, 31, 0.18);
    }
    &.is-success {
        background: rgba(34, 197, 94, 0.05);
        border-color: rgba(34, 197, 94, 0.2);
    }
    &.is-failure {
        background: rgba(239, 68, 68, 0.05);
        border-color: rgba(239, 68, 68, 0.2);
    }
    &.is-notfound {
        background: rgba(255, 255, 255, 0.01);
        opacity: 0.7;
    }
    
    @media (max-width: 768px) {
        padding: 4px 8px;
        border-radius: 6px;
    }
}

.moovie-frame__provider-info {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    flex: 1;
    min-width: 0;
}

.moovie-frame__provider-status-icon {
    width: 18px;
    height: 18px;
    display: grid;
    place-content: center;
    flex-shrink: 0;
    
    @media (max-width: 768px) {
        width: 14px;
        height: 14px;
    }
}

.moovie-frame__provider-spinner {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid rgba(255, 90, 31, 0.2);
    border-top-color: var(--ember, #ff5a1f);
    animation: moovie-spin 0.8s linear infinite;
    
    @media (max-width: 768px) {
        width: 10px;
        height: 10px;
    }
}

.moovie-frame__check-icon { color: #22c55e; font-weight: bold; font-size: 13px; }
.moovie-frame__cross-icon { color: #ef4444; font-weight: bold; font-size: 11px; }
.moovie-frame__dash-icon  { color: #71717a; font-size: 13px; }
.moovie-frame__dot-icon   { color: rgba(255,255,255,0.15); font-size: 10px; }

.moovie-frame__provider-details {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
}

.moovie-frame__provider-label {
    font-size: 0.8rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    
    .is-success & {
        color: #ffffff;
    }
    
    @media (max-width: 768px) {
        font-size: 0.7rem;
    }
}

.moovie-frame__provider-progress {
    height: 3px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 99px;
    overflow: hidden;
    width: 85%;
}

.moovie-frame__provider-progress-fill {
    height: 100%;
    background: var(--ember, #ff5a1f);
    border-radius: 99px;
    transition: width 0.25s ease;
}

.moovie-frame__provider-pct-val {
    font-size: 0.74rem;
    font-weight: 600;
    color: var(--ember, #ff5a1f);
    font-variant-numeric: tabular-nums;
    
    @media (max-width: 768px) {
        font-size: 0.65rem;
    }
}

.moovie-frame__provider-status-text {
    font-size: 0.74rem;
    color: rgba(255, 255, 255, 0.35);
    font-weight: 500;
    
    &.is-success {
        color: #22c55e;
    }
    &.is-failed {
        color: #ef4444;
    }
    &.is-notfound {
        color: #71717a;
    }
    
    @media (max-width: 768px) {
        font-size: 0.65rem;
    }
}

@keyframes spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
    .moovie-frame__spinner, .moovie-frame__scraper-handle { animation: none !important; }
}

.moovie-frame__settings-label {
    padding: 0.6rem 0.75rem 0.25rem;
    font-size: 0.72rem;
    font-family: var(--font-mono);
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.1em;
}

.moovie-frame__settings-options {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0.25rem 0.75rem 0.5rem;
}

.moovie-frame__settings-chip {
    padding: 0.3rem 0.75rem;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: var(--r-pill);
    color: rgba(255, 255, 255, 0.85);
    font-family: var(--font-ui);
    font-size: 0.75rem;
    cursor: pointer;
    transition: background-color 0.15s, border-color 0.15s, color 0.15s;
    
    &:hover {
        background-color: rgba(255, 255, 255, 0.15);
        color: #ffffff;
    }
    
    &.is-active {
        background-color: var(--ember, #ff5a1f);
        border-color: var(--ember, #ff5a1f);
        color: #000000;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(255, 90, 31, 0.3);
    }
    
    &--icon {
        width: 32px;
        height: 32px;
        display: grid;
        place-content: center;
        padding: 0;
    }
    
    &--color {
        width: 24px;
        height: 24px;
        padding: 0;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.25);
        &.is-active {
            border-color: #ffffff;
            box-shadow: 0 0 0 2px var(--ember, #ff5a1f);
        }
    }
}

.moovie-frame__settings-chip--reset {
    margin-left: auto;
    background: rgba(255, 90, 31, 0.15);
    border-color: rgba(255, 90, 31, 0.1);
    color: var(--ember, #ff5a1f);
    &:hover {
        background: rgba(255, 90, 31, 0.25);
    }
}

@media (max-width: 640px) {
    .moovie-frame__settings-panel {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        top: auto;
        max-width: 100%;
        max-height: 75vh;
        border-radius: 20px 20px 0 0;
        border-bottom: 0;
        padding: 1rem 0.75rem 1.5rem 0.75rem;
        z-index: 40;
        box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.8);
    }
    .moovie-frame__settings-item {
        padding: 0.75rem 0.85rem;
        font-size: 0.92rem;
        min-height: 48px;
    }
    .moovie-frame__settings-chip {
        padding: 0.55rem 0.9rem;
        font-size: 0.85rem;
        min-height: 40px;
    }
    .moovie-frame__settings-header {
        padding: 0.5rem 0.5rem 0.75rem 0.25rem;
        min-height: 44px;
        font-size: 0.95rem;
    }
    .moovie-frame__settings-options {
        gap: 0.5rem;
    }
    .moovie-frame__settings-label {
        font-size: 0.8rem;
        margin-bottom: 0.4rem;
    }
}

.moovie-frame__settings-group {
    padding: 0.35rem 0.75rem 0.5rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.moovie-frame__settings-group-title {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.45);
}

.moovie-frame__sync-row {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.04);
    padding: 4px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
}

.moovie-frame__sync-btn {
    flex: 1;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 4px 0;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.15s, transform 0.1s;

    &:hover {
        background: rgba(255, 255, 255, 0.12);
    }
    
    &:active {
        transform: scale(0.95);
    }

    &.is-reset {
        background: rgba(255, 90, 31, 0.15);
        border-color: rgba(255, 90, 31, 0.1);
        color: var(--ember, #ff5a1f);

        &:hover {
            background: rgba(255, 90, 31, 0.25);
        }
    }
}

.moovie-frame__sync-value {
    font-size: 0.8rem;
    font-weight: 700;
    color: #ffffff;
    min-width: 48px;
    text-align: center;
    font-variant-numeric: tabular-nums;
}

.moovie-frame__option-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.moovie-frame__option-btn {
    flex: 1;
    min-width: 40px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.72rem;
    font-weight: 600;
    padding: 4px 6px;
    border-radius: 6px;
    cursor: pointer;
    text-align: center;
    transition: all 0.15s ease;

    &:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #ffffff;
    }

    &.is-active {
        background: rgba(255, 90, 31, 0.10);
        border-color: rgba(255, 90, 31, 0.25);
        color: var(--ember);
        font-weight: 700;
    }
}

/* Subtitle Cue styling rules */
.moovie-frame video::cue {
    background-color: rgba(8, 8, 8, var(--sub-bg-opacity, 0.75)) !important;
    color: rgba(255, 255, 255, var(--sub-text-opacity, 1)) !important;
    font-size: var(--sub-font-size, 100%) !important;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9) !important;
}

/* Custom Loading Overlay (Peestream style in Orange) */
.moovie-frame__loader-overlay {
    position: absolute;
    inset: 0;
    background-color: #07070a;
    z-index: 100;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 15px;
}

.moovie-frame__spinner-box {
    position: relative;
    width: 100px;
    height: 100px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.moovie-frame__spinner-pulse {
    position: absolute;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 90, 31, 0.15) 0%, transparent 70%);
    border: 2.5px dashed rgba(255, 90, 31, 0.4);
    animation: spin 8s linear infinite, pulse 2s ease-in-out infinite;
}

.moovie-frame__spinner-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-weight: 800;
    font-size: 1.15rem;
    color: #ff7842;
    text-shadow: 0 0 10px rgba(255, 90, 31, 0.5);
    text-transform: lowercase;
}

.moovie-frame__loader-status {
    font-size: 0.9rem;
    font-weight: 500;
    color: #dfdfea;
    letter-spacing: 0.2px;
}

/* Big play button (Peestream style in Orange) */
.moovie-frame__big-play-btn {
    width: 70px;
    height: 70px;
    background: rgba(255, 90, 31, 0.85);
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #ffffff;
    box-shadow: 0 0 25px rgba(255, 90, 31, 0.4);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    transform: scale(1);
    cursor: pointer;
    
    svg {
        width: 24px;
        height: 24px;
        margin-left: 3px; // offset to visual center
    }

    &:hover {
        background: #ff7842;
        transform: scale(1.08);
        box-shadow: 0 0 35px rgba(255, 90, 31, 0.6);
    }
}

/* Floating Embed Button */
.moovie-frame__embed-trigger-btn {
    position: absolute;
    top: 15px;
    right: 15px;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: rgba(15, 15, 27, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(8px);
    color: #ffffff;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    z-index: 90;
    transition: all 0.2s ease;

    &:hover {
        background: rgba(255, 90, 31, 0.15);
        border-color: #ff5a1f;
        color: #ff5a1f;
        transform: scale(1.05);
    }
}

/* Sliding Embed Drawer */
.moovie-frame__embed-drawer {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 200px;
    background: rgba(7, 7, 10, 0.98);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(20px);
    z-index: 110;
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 -10px 35px rgba(0, 0, 0, 0.7);
    box-sizing: border-box;

    @media (max-width: 600px) {
        height: 220px;
    }
}

.moovie-frame__embed-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.moovie-frame__embed-title {
    font-size: 1.05rem;
    font-weight: 600;
    color: #ffffff;
}

.moovie-frame__embed-close-btn {
    background: none;
    border: none;
    color: #8e8e9f;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s ease;

    &:hover {
        color: #ff5a1f;
    }
}

.moovie-frame__embed-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.moovie-frame__embed-input-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.moovie-frame__embed-input-label {
    font-size: 0.72rem;
    color: #8e8e9f;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-weight: 600;
}

.moovie-frame__embed-code-box-wrapper {
    position: relative;
    display: flex;
    align-items: center;
}

.moovie-frame__embed-code-input {
    width: 100%;
    padding: 10px 14px;
    padding-right: 90px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    color: #ff5a1f;
    font-family: monospace;
    font-size: 0.75rem;
    outline: none;
    box-sizing: border-box;
}

.moovie-frame__embed-copy-btn {
    position: absolute;
    right: 6px;
    padding: 6px 12px;
    background: #ff5a1f;
    border: none;
    border-radius: 6px;
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s ease;
    display: flex;
    align-items: center;
    gap: 4px;

    &:hover {
        background: #ff7842;
    }
}

.moovie-frame__embed-options-row {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
}

.moovie-frame__embed-checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    color: #ffffff;
    cursor: pointer;
    user-select: none;

    input {
        accent-color: #ff5a1f;
        width: 14px;
        height: 14px;
        margin: 0;
        cursor: pointer;
    }
}

/* Animations & Transitions */
.drawer-slide-enter-active,
.drawer-slide-leave-active {
    transition: transform 0.25s cubic-bezier(0.1, 0.8, 0.3, 1);
}
.drawer-slide-enter-from,
.drawer-slide-leave-to {
    transform: translateY(100%);
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

@keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.6; }
    50% { transform: scale(1.15); opacity: 1; border-color: #ff7842; }
}
</style>
