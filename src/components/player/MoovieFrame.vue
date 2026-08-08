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



                <!-- Artwork: hi-res TMDB poster/backdrop until the actual video starts playing -->
                <transition name="fade">
                    <div v-if="showArtwork && artworkBackdropUrl" class="moovie-frame__artwork" :style="{ backgroundImage: `url(${artworkBackdropUrl})` }">
                        <div class="moovie-frame__artwork-scrim moovie-frame__artwork-scrim--top" aria-hidden="true" />
                        <div class="moovie-frame__artwork-scrim moovie-frame__artwork-scrim--bottom" aria-hidden="true" />
                        <div class="moovie-frame__artwork-stage">
                            <div v-if="artworkPosterUrl" class="moovie-frame__artwork-poster" :style="{ backgroundImage: `url(${artworkPosterUrl})` }" />
                            <h2 class="moovie-frame__artwork-title">{{ title }}</h2>
                            <p class="moovie-frame__artwork-sub">
                                {{ artworkSubline }}<span class="moovie-frame__artwork-dots"><span>.</span><span>.</span><span>.</span></span>
                            </p>
                        </div>
                    </div>
                </transition>



                <div v-if="!loading && !error" class="moovie-frame__center-btn" @click="togglePlay">
                    <div v-if="buffering && !showArtwork" class="moovie-frame__spinner" />
                    <div v-else-if="!playing && !showArtwork && !buffering" class="moovie-frame__big-play-btn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="8,5 19,12 8,19" /></svg>
                    </div>
                    <button
                        type="button"
                        class="moovie-frame__center-skip moovie-frame__center-skip--back"
                        @click.stop="seekBy(-15)"
                        aria-label="Rewind 15 seconds"
                        title="Rewind 15 seconds"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
                            <text x="12" y="15" text-anchor="middle" fill="currentColor" stroke="none" font-size="7" font-family="system-ui, sans-serif" font-weight="700">15</text>
                        </svg>
                    </button>
                    <button
                        type="button"
                        class="moovie-frame__center-skip moovie-frame__center-skip--fwd"
                        @click.stop="seekBy(15)"
                        aria-label="Forward 15 seconds"
                        title="Forward 15 seconds"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" />
                            <text x="12" y="15" text-anchor="middle" fill="currentColor" stroke="none" font-size="7" font-family="system-ui, sans-serif" font-weight="700">15</text>
                        </svg>
                    </button>
                </div>

                <div v-if="error && !loading" class="moovie-frame__overlay moovie-frame__overlay--error">
                    <p class="eyebrow">Hub Error</p>
                    <h3>{{ error }}</h3>
                    <button type="button" class="moovie-frame__retry" @click="retry">Retry</button>
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

                <div v-if="!loading && !error" class="moovie-frame__controls" @mouseenter="isHoveringControls = true; resetIdleTimer()" @mouseleave="isHoveringControls = false; resetIdleTimer()">
                    <div class="moovie-frame__controls-left">
                        <button v-if="mediaType === 'tv'" class="moovie-frame__ctrl-btn" @click="$emit('prev-episode')" aria-label="Previous Episode">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="19,20 9,12 19,4" /><rect x="5" y="4" width="2" height="16" rx="0.5" /></svg>
                        </button>
                        <button class="moovie-frame__ctrl-btn moovie-frame__mobile-skip" @click="seekBy(-15)" aria-label="Rewind 15 seconds" title="Rewind 15 seconds">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
                                <text x="12" y="15" text-anchor="middle" fill="currentColor" stroke="none" font-size="7" font-family="system-ui, sans-serif" font-weight="700">15</text>
                            </svg>
                        </button>
                        <button class="moovie-frame__ctrl-btn" :class="{ 'is-active': playing }" @click="togglePlay" aria-label="Play/Pause">
                            <svg v-if="!playing" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21" /></svg>
                            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                        </button>
                        <button class="moovie-frame__ctrl-btn moovie-frame__mobile-skip" @click="seekBy(15)" aria-label="Forward 15 seconds" title="Forward 15 seconds">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" />
                                <text x="12" y="15" text-anchor="middle" fill="currentColor" stroke="none" font-size="7" font-family="system-ui, sans-serif" font-weight="700">15</text>
                            </svg>
                        </button>
                        <button v-if="mediaType === 'tv'" class="moovie-frame__ctrl-btn" @click="$emit('next-episode')" aria-label="Next Episode">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,4 15,12 5,20" /><rect x="17" y="4" width="2" height="16" rx="0.5" /></svg>
                        </button>
                        <span class="moovie-frame__time">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
                    </div>
                    <div class="moovie-frame__controls-right">
                        <button
                            class="moovie-frame__ctrl-btn moovie-frame__subtitle-toggle"
                            :class="{ 'is-active': selectedSubtitleTrack !== -1 }"
                            :disabled="!subtitleTracks.length"
                            :aria-pressed="selectedSubtitleTrack !== -1"
                            :aria-label="selectedSubtitleTrack !== -1 ? 'Turn subtitles off' : 'Turn subtitles on'"
                            :title="selectedSubtitleTrack !== -1 ? 'Subtitles on' : 'Subtitles off'"
                            @click.stop="toggleSubtitles"
                        >
                            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
                                <path d="M7.5 10h3M13.5 10h3M7.5 14h9" />
                            </svg>
                        </button>
                        <div class="moovie-frame__volume-control">
                            <button
                                class="moovie-frame__ctrl-btn"
                                :class="{ 'is-active': muted }"
                                @click.stop="handleVolumeButtonClick"
                                aria-label="Mute"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19" /><path v-if="!muted" d="M15.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" /><path v-if="!muted" d="M19 12c0 2.97-1.65 5.54-4 6.71v2.06c3.45-1.28 6-4.56 6-8.77s-2.55-7.49-6-8.77v2.06c2.35 1.17 4 3.74 4 6.71z" /><line v-if="muted" x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
                            </button>
                            <transition name="fade">
                                <div v-if="volumeSliderOpen" class="moovie-frame__volume-slider-popup" @click.stop>
                                    <input
                                        type="range"
                                        class="moovie-frame__volume-vertical-slider"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        :value="muted ? 0 : volume"
                                        @input="onVolumeChange"
                                        aria-label="Volume"
                                    />
                                </div>
                            </transition>
                        </div>
                        <button
                            class="moovie-frame__ctrl-btn moovie-frame__cast-btn"
                            @click.stop="handleCastToTV"
                            aria-label="Cast to TV"
                            title="Cast to Smart TV / Chromecast / AirPlay"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.92-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                            </svg>
                        </button>
                        <button
                            class="moovie-frame__ctrl-btn moovie-frame__three-dot-btn"
                            :class="{ 'is-open': settingsOpen }"
                            @click.stop="settingsOpen ? (settingsOpen = false, settingsSection = null) : (settingsOpen = true, qualityOpen = false)"
                            aria-label="Settings"
                            :aria-expanded="settingsOpen"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
                            </svg>
                        </button>
                        <button class="moovie-frame__ctrl-btn" :class="{ 'is-active': isFullscreen }" @click="toggleFullscreen" aria-label="Fullscreen">
                            <svg v-if="!isFullscreen" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
                            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" /></svg>
                        </button>
                    </div>
                </div>

                <Transition name="moovie-settings">
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
                            <div class="moovie-frame__settings-heading">
                                <span class="moovie-frame__settings-eyebrow">{{ settingsSection ? 'Playback control' : 'Moovie control room' }}</span>
                                <span class="moovie-frame__settings-title">{{ settingsSection ? settingsSection.charAt(0).toUpperCase() + settingsSection.slice(1) : title }}</span>
                            </div>
                            <span v-if="!settingsSection" class="moovie-frame__settings-live"><i /> Live</span>
                        </div>

                        <div class="moovie-frame__settings-scroll">
                            <template v-if="!settingsSection">
                                <button class="moovie-frame__settings-item" @click="settingsSection = 'speed'">
                                    <span class="moovie-frame__settings-item-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                                    </span>
                                    <span class="moovie-frame__settings-item-label">Speed</span>
                                    <span class="moovie-frame__settings-item-value">{{ playbackSpeed }}x</span>
                                    <svg class="moovie-frame__settings-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                                </button>
                                <button class="moovie-frame__settings-item" @click="togglePiP">
                                    <span class="moovie-frame__settings-item-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><rect x="12" y="9" width="8" height="8" rx="1"/></svg>
                                    </span>
                                    <span class="moovie-frame__settings-item-label">Picture-in-Picture</span>
                                    <span class="moovie-frame__settings-item-badge" :class="{ 'is-on': isPiP }">{{ isPiP ? 'On' : 'Off' }}</span>
                                </button>
                                <div class="moovie-frame__settings-divider" />
                                <button class="moovie-frame__settings-item" @click="settingsSection = 'server'">
                                    <span class="moovie-frame__settings-item-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1"/><circle cx="6" cy="18" r="1"/></svg>
                                    </span>
                                    <span class="moovie-frame__settings-item-label">Server</span>
                                    <span class="moovie-frame__settings-item-value">{{ selectedServer || 'Auto' }}</span>
                                    <svg class="moovie-frame__settings-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                                </button>
                                <button class="moovie-frame__settings-item" @click="settingsSection = 'quality'; qualityOpen = false">
                                    <span class="moovie-frame__settings-item-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                                    </span>
                                    <span class="moovie-frame__settings-item-label">Quality</span>
                                    <span class="moovie-frame__settings-item-value">{{ hlsQualityLabel }}</span>
                                    <svg class="moovie-frame__settings-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                                </button>
                                <button class="moovie-frame__settings-item" @click="settingsSection = 'audio'">
                                    <span class="moovie-frame__settings-item-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                                    </span>
                                    <span class="moovie-frame__settings-item-label">Audio</span>
                                    <span class="moovie-frame__settings-item-value">{{ currentAudioLabel }}</span>
                                    <svg class="moovie-frame__settings-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                                </button>
                                <button class="moovie-frame__settings-item" @click="settingsSection = 'subtitles'">
                                    <span class="moovie-frame__settings-item-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="14" x2="23" y2="14"/><path d="M7 14h4"/><path d="M13 14h4"/></svg>
                                    </span>
                                    <span class="moovie-frame__settings-item-label">Subtitles</span>
                                    <span class="moovie-frame__settings-item-value">{{ subtitleTracks.length ? currentSubtitleLabel : 'Search' }}</span>
                                    <svg class="moovie-frame__settings-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                                </button>
                            </template>

                            <template v-if="settingsSection === 'server'">
                                <button
                                    v-for="server in availableServers"
                                    :key="server.name"
                                    class="moovie-frame__settings-item"
                                    :class="{ 'is-active': selectedServer === server.name }"
                                    @click="selectServer(server.name)"
                                >
                                    <span class="moovie-frame__settings-item-status" :class="`is-${server.hasStreams ? 'success' : server.status}`">
                                        {{ server.hasStreams ? '✓' : server.status === 'pending' ? '⟳' : server.status === 'failure' ? '✕' : server.status === 'notfound' ? '–' : '○' }}
                                    </span>
                                    <span class="moovie-frame__settings-item-label">{{ server.name }}</span>
                                </button>
                            </template>

                            <template v-if="settingsSection === 'quality'">
                                <template v-if="hlsQualities.length > 0">
                                    <button
                                        class="moovie-frame__settings-item"
                                        :class="{ 'is-active': selectedHlsQuality === -1 }"
                                        @click="selectHlsQuality(-1)"
                                    >
                                        <span class="moovie-frame__settings-item-label">Auto</span>
                                        <span class="moovie-frame__settings-item-badge" :class="{ 'is-on': selectedHlsQuality === -1 }">Adaptive</span>
                                    </button>
                                    <button
                                        v-for="q in hlsQualities"
                                        :key="q.id"
                                        class="moovie-frame__settings-item"
                                        :class="{ 'is-active': selectedHlsQuality === q.id }"
                                        @click="selectHlsQuality(q.id)"
                                    >
                                        <span class="moovie-frame__settings-item-label">{{ q.label }}</span>
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
                                        <span class="moovie-frame__settings-item-label">{{ q }}</span>
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
                                    <span class="moovie-frame__settings-item-label">{{ track.name }}</span>
                                    <span v-if="track.lang && track.lang !== track.name" class="moovie-frame__settings-item-hint">{{ track.lang }}</span>
                                </button>
                            </template>

                            <template v-if="settingsSection === 'subtitles'">
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
                                <div class="moovie-frame__settings-group">
                                    <div class="moovie-frame__settings-slider-header">
                                        <span class="moovie-frame__settings-group-title">Background</span>
                                        <span class="moovie-frame__settings-slider-value">{{ Math.round(subtitleBgOpacity * 100) }}%</span>
                                    </div>
                                    <div class="moovie-frame__slider-wrapper">
                                        <input type="range" class="moovie-frame__settings-slider" min="0" max="1" step="0.05" v-model.number="subtitleBgOpacity" />
                                    </div>
                                </div>
                                <div class="moovie-frame__settings-group">
                                    <div class="moovie-frame__settings-slider-header">
                                        <span class="moovie-frame__settings-group-title">Text Opacity</span>
                                        <span class="moovie-frame__settings-slider-value">{{ Math.round(subtitleTextOpacity * 100) }}%</span>
                                    </div>
                                    <div class="moovie-frame__slider-wrapper">
                                        <input type="range" class="moovie-frame__settings-slider" min="0.1" max="1" step="0.05" v-model.number="subtitleTextOpacity" />
                                    </div>
                                </div>
                                <div class="moovie-frame__settings-group">
                                    <div class="moovie-frame__settings-slider-header">
                                        <span class="moovie-frame__settings-group-title">Font Size</span>
                                        <span class="moovie-frame__settings-slider-value">{{ subtitleFontSize }}%</span>
                                    </div>
                                    <div class="moovie-frame__slider-wrapper">
                                        <input type="range" class="moovie-frame__settings-slider" min="50" max="250" step="5" v-model.number="subtitleFontSize" />
                                    </div>
                                </div>
                                <div class="moovie-frame__settings-group">
                                    <span class="moovie-frame__settings-group-title">Position</span>
                                    <div class="moovie-frame__option-grid">
                                        <button type="button" class="moovie-frame__option-btn" @click="moveSubtitles('up')" title="Move Subtitles Up">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
                                        </button>
                                        <button type="button" class="moovie-frame__option-btn" @click="moveSubtitles('down')" title="Move Subtitles Down">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                                        </button>
                                        <span class="moovie-frame__option-val">{{ 100 - subtitlePosition }}%</span>
                                    </div>
                                </div>
                                <div class="moovie-frame__settings-divider" />
                                <span class="moovie-frame__settings-group-title" style="padding: 0 0.75rem;">Tracks</span>
                                <button
                                    class="moovie-frame__settings-item"
                                    :class="{ 'is-active': selectedSubtitleTrack === -1 }"
                                    @click="selectSubtitleTrack(-1)"
                                >
                                    <span class="moovie-frame__settings-item-label">Off</span>
                                </button>
                                <button
                                    v-for="track in subtitleTracks"
                                    :key="track.id"
                                    class="moovie-frame__settings-item"
                                    :class="{ 'is-active': selectedSubtitleTrack === track.id }"
                                    @click="selectSubtitleTrack(track.id)"
                                >
                                    <span class="moovie-frame__settings-item-label">{{ track.name }}</span>
                                    <span v-if="track.lang && track.lang !== track.name" class="moovie-frame__settings-item-hint">{{ track.lang }}</span>
                                </button>
                                <button
                                    v-if="!subtitleTracks.length"
                                    class="moovie-frame__settings-item"
                                    @click="loadOpenSubtitles()"
                                >
                                    <span class="moovie-frame__settings-item-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                    </span>
                                    <span class="moovie-frame__settings-item-label">Search subtitles</span>
                                </button>
                            </template>

                            <template v-if="settingsSection === 'speed'">
                                <div class="moovie-frame__speed-grid">
                                    <button
                                        v-for="spd in PLAYBACK_SPEEDS"
                                        :key="spd"
                                        class="moovie-frame__speed-btn"
                                        :class="{ 'is-active': playbackSpeed === spd }"
                                        @click="setPlaybackSpeed(spd)"
                                    >
                                        {{ spd }}x
                                    </button>
                                </div>
                            </template>
                        </div>
                    </div>
                </Transition>
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
            const fetchProviderVariants = async (attempt = 0): Promise<LanguageVariant[]> => {
                let ctrl: AbortController | null = null
                let timeout: ReturnType<typeof setTimeout> | null = null
                try {
                const params = new URLSearchParams({ q: title, type, provider })
                if (tmdbId) params.set('tmdbId', String(tmdbId))
                if (season != null) params.set('season', String(season))
                if (episode != null) params.set('episode', String(episode))
                    ctrl = new AbortController()
                    timeout = setTimeout(() => ctrl?.abort(), 45_000)
                    const res = await fetch(`${STREAMSCRAPER_HUB}/api/search?${params}`, { signal: ctrl.signal })
                    if (!res.ok) throw new Error(`HTTP ${res.status}`)
                    const json = await res.json().catch(() => null)
                    if (!json || typeof json !== 'object') throw new Error('Invalid response')
                    const items: any[] = json.results?.flatMap?.((result: any) =>
                        (result.streams || (result._languageVariants ? [result] : []))
                            .flatMap((stream: any) => Array.isArray(stream._languageVariants) ? stream._languageVariants : [])
                    ) ?? []
                    return items.map((variant: any): LanguageVariant => ({
                        language: variant.language ?? 'unknown',
                        label: variant.language ?? 'Unknown',
                        provider,
                        id: `${provider}:${variant.catalogId ?? variant.id ?? ''}`,
                        type: variant.media_type === 'tv' ? 'show' : (variant.type ?? type),
                        season: variant.season,
                        episode: variant.episode,
                    }))
                } catch (error) {
                    // HomeCine provides the dependable regional audio variants. Retry it
                    // once because an in-flight source scan can briefly cancel this request.
                    if (provider === 'homecine' && attempt === 0) {
                        await new Promise(resolve => setTimeout(resolve, 750))
                        return fetchProviderVariants(1)
                    }
                    console.warn('[MoovieFrame] language variant request failed:', provider, error)
                    return []
                } finally {
                    if (timeout) clearTimeout(timeout)
                }
            }
            return fetchProviderVariants()
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
): Promise<{ url: string; type: 'm3u8' | 'mp4'; proxyUrl?: string; headers?: Record<string, string> } | null> {
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
        return { 
            url, 
            type: isHls ? 'm3u8' : 'mp4', 
            proxyUrl: json.proxyUrl ? STREAMSCRAPER_HUB + json.proxyUrl : undefined,
            headers: json.headers
        }
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
        const subtitlePosition = ref(95)

        const activeCueText = ref('This is a preview of the subtitles')
        const activeCueTextFormatted = computed(() => {
            return activeCueText.value.replace(/\n/g, '<br>')
        })

        function updateActiveCueText() {
            const video = videoRef.value
            if (!video) return
            // Find showing text track
            let showingTrack: TextTrack | null = null
            for (let i = 0; i < video.textTracks.length; i++) {
                const track = video.textTracks[i]
                if (track.mode === 'showing') {
                    showingTrack = track
                    break
                }
            }
            if (showingTrack && showingTrack.activeCues && showingTrack.activeCues.length > 0) {
                // Get the text from the active cue(s)
                const texts: string[] = []
                for (let j = 0; j < showingTrack.activeCues.length; j++) {
                    const cue = showingTrack.activeCues[j] as VTTCue
                    if (cue && cue.text) {
                        texts.push(cue.text.replace(/<[^>]+>/g, '')) // strip HTML tags
                    }
                }
                if (texts.length > 0) {
                    activeCueText.value = texts.join('\n')
                    return
                }
            }
            // If no active cue but track has cues, fall back to first cue as placeholder example
            if (showingTrack && showingTrack.cues && showingTrack.cues.length > 0) {
                const firstCue = showingTrack.cues[0] as VTTCue
                if (firstCue && firstCue.text) {
                    activeCueText.value = firstCue.text.replace(/<[^>]+>/g, '')
                    return
                }
            }
            activeCueText.value = 'This is a preview of the subtitles'
        }

        async function handleCastToTV() {
            const castWindow = window as any;
            const video = videoRef.value as HTMLVideoElement | null;

            // 1. Google Cast Framework (Chromecast / Android TV / Google TV in Chrome, Brave, Edge)
            if (castWindow.cast?.framework) {
                try {
                    const castContext = castWindow.cast.framework.CastContext.getInstance();
                    try {
                        castContext.setOptions({
                            receiverApplicationId: castWindow.chrome?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID || 'CC1AD845',
                            autoJoinPolicy: castWindow.chrome?.cast?.AUTO_JOIN_POLICY?.ORIGIN_SCOPED || 'origin_scoped'
                        });
                    } catch (e) {
                        // Options already set
                    }

                    const session = await castContext.requestSession();
                    if (session && video) {
                        const streamUrl = video.currentSrc || video.src || (streams.value && streams.value[selectedQualityIndex.value]?.url);
                        if (streamUrl) {
                            const contentType = streamUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4';
                            const mediaInfo = new castWindow.chrome.cast.media.MediaInfo(streamUrl, contentType);
                            const request = new castWindow.chrome.cast.media.LoadRequest(mediaInfo);
                            request.currentTime = video.currentTime || 0;
                            session.loadMedia(request);
                        }
                    }
                    return;
                } catch (castErr: any) {
                    console.debug('[Cast] Google Cast session request note:', castErr);
                    if (castErr === 'cancel' || castErr?.code === 'cancel' || castErr === 'cancel_session_start') return;
                }
            }

            // 2. Native AirPlay support (Safari, iOS, macOS)
            if (video && typeof (video as any).webkitShowPlaybackTargetPicker === 'function') {
                (video as any).webkitShowPlaybackTargetPicker();
                return;
            }

            // 3. Browser Remote Playback API
            if (video && (video as any).remote && typeof (video as any).remote.prompt === 'function') {
                try {
                    await (video as any).remote.prompt();
                    return;
                } catch (err: any) {
                    console.debug('[Cast] Remote playback prompt error:', err);
                }
            }

            alert('Cast feature is unavailable on this browser or no casting devices were detected on your local network. Make sure your Chromecast or TV is powered on and connected to the same Wi-Fi network.');
        }

        function handleDownloadMedia() {
            const video = videoRef.value as HTMLVideoElement | null;
            const hub4kStream = streams.value?.find(s => (s.providerName || (s as any).provider || '').toLowerCase().includes('4khdhub'));
            const currentStream = hub4kStream || streams.value?.[selectedQualityIndex.value] || streams.value?.[0];
            let targetUrl = currentStream?.url || currentStream?.proxyUrl || video?.currentSrc || video?.src;

            if (!targetUrl) {
                alert('No active video stream found to download.');
                return;
            }

            // Decode proxied URLs back to the direct file when possible.
            // Direct R2/google URLs already carry Content-Disposition: attachment,
            // so opening them starts a real download without any proxy.
            try {
                const u = new URL(targetUrl, window.location.origin);
                if (u.searchParams.get('u') && u.pathname.includes('/proxy')) {
                    const b64 = u.searchParams.get('u')!;
                    const direct = decodeURIComponent(escape(atob(b64.replace(/-/g, '+').replace(/_/g, '/'))));
                    if (/^https?:\/\//i.test(direct)) targetUrl = direct;
                }
            } catch (err) {
                // keep targetUrl as-is
            }

            const titleClean = (props.title || 'media').replace(/[^a-zA-Z0-9_\-]/g, '_');
            let epSuffix = '';
            if (props.mediaType === 'tv' && props.season && props.episode) {
                epSuffix = `_S${String(props.season).padStart(2, '0')}E${String(props.episode).padStart(2, '0')}`;
            }
            const qualityLabel = currentStream?.quality || activeQualityLabel.value || 'HD';
            const fileName = `${titleClean}${epSuffix}_${qualityLabel}.mp4`;

            // Direct download, no proxy. Cross-origin <a download> is ignored by
            // browsers, so open the URL directly — the CDN serves it as an
            // attachment (R2 signed URLs include response-content-disposition).
            try {
                const a = document.createElement('a');
                a.href = targetUrl;
                a.download = fileName;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } catch (err) {
                // Last resort: open directly (browser may play it instead of downloading)
                console.warn('[Download] Direct link failed, opening in new tab:', err);
                window.open(targetUrl, '_blank');
            }
        }

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

        const loadServerOverrides = async () => {
            try {
                const supabase = await getSupabaseClient()
                const { data } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'default_server_overrides')
                    .single()
                if (data?.value) {
                    const overrides = JSON.parse(data.value)
                    const key = `${props.mediaType}-${props.mediaId}`
                    if (overrides[key]) {
                        selectedServer.value = overrides[key]
                        console.debug('[MoovieFrame] Loaded server override:', selectedServer.value)
                    }
                }
            } catch { /* ignore */ }
        }
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

        const volumeSliderOpen = ref(false)
        const volume = ref(0.8)
        const originalStream = ref<HubStream | null>(null)

        function onVolumeChange(e: Event) {
            const video = videoRef.value
            if (!video) return
            const val = parseFloat((e.target as HTMLInputElement).value)
            video.volume = val
            volume.value = val
            if (val > 0) {
                video.muted = false
                muted.value = false
            } else {
                video.muted = true
                muted.value = true
            }
        }
        function handleVolumeButtonClick() {
            if (!volumeSliderOpen.value) {
                volumeSliderOpen.value = true
            } else {
                toggleMute()
            }
        }

        const controlsHidden = ref(false)
        const isHoveringControls = ref(false)
        const brandText = computed(() => {
            if (typeof window !== 'undefined') {
                return window.location.hostname.includes('peestream') ? 'pee' : 'moovie'
            }
            return 'moovie'
        })
        let idleTimer: ReturnType<typeof setTimeout> | null = null
        function resetIdleTimer() {
            controlsHidden.value = false
            if (idleTimer) clearTimeout(idleTimer)
            idleTimer = setTimeout(function() {
                if (playing.value && !seeking.value && !settingsOpen.value && !qualityOpen.value && !isHoveringControls.value) {
                    controlsHidden.value = true
                }
            }, 3000)
        }
        function handleMouseLeave() {
            isHoveringControls.value = false
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
            const name = track?.name || ''
            if (!name || name.toLowerCase() === 'unknown' || name.toLowerCase() === 'und') {
                return 'English'
            }
            return name
        })

        const currentSubtitleLabel = computed(() => {
            if (selectedSubtitleTrack.value === -1) return 'Off'
            const track = subtitleTracks.value.find(t => t.id === selectedSubtitleTrack.value)
            return track?.name || 'Unknown'
        })

        useAmbientColor(computed(() => props.backdropPath || props.posterPath || null), rootRef)

        const artworkBackdropUrl = computed(() => {
            const path = props.backdropPath || props.posterPath
            return path ? useWebImage(path, 'hero') : ''
        })

        const firstFrameShown = ref(false)

        const artworkPosterUrl = computed(() => props.posterPath ? useWebImage(props.posterPath, 'hero') : '')

        const showArtwork = computed(() => !error.value && !firstFrameShown.value)

        const activeProviderName = computed(() => {
            const active = providers.value.find(p => p.status === 'pending') || providers.value.find(p => p.status === 'waiting')
            return active?.name || ''
        })

        const artworkSubline = computed(() => {
            if (loading.value) {
                return activeProviderName.value ? `Finding sources — Checking ${activeProviderName.value}` : 'Finding sources'
            }
            return 'Starting playback'
        })

        const ambientImage = ref('')
        const computeAmbient = () => {
            const path = props.backdropPath || props.posterPath
            ambientImage.value = path ? useWebImage(path, 'hero') : ''
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
            audioTracks.value = audioTracks.value.filter(t => (t as any)._catalogId || (t as any)._variantId || (t as any)._isOriginal)
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
            const onTimeUpdate = () => { currentTime.value = video.currentTime; duration.value = video.duration || 0; updateActiveCueText() }
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
            video.addEventListener('playing', () => { playbackStarted.value = true; firstFrameShown.value = true; onBufferEnd() })
            video.addEventListener('canplay', onBufferEnd)
            video.addEventListener('loadeddata', onBufferEnd)
            video.addEventListener('seeked', onSeeked)
            video.addEventListener('error', onBufferEnd)
            video.addEventListener('abort', onBufferEnd)
            video.addEventListener('timeupdate', onTimeUpdate)

            // Autoplay: the `autoplay` attribute alone is ignored by browsers when
            // sound is enabled and there's no user gesture, so force an explicit
            // play() right after mounting and again on canplay. If the policy blocks
            // it, fall back to muted playback and STAY muted — unmuting without a
            // gesture makes Chrome pause the video again.
            let autoplayTried = false
            const tryAutoplay = () => {
                if (autoplayTried || isRespondingToSync || !video.paused) return
                autoplayTried = true
                const p = video.play()
                if (p) {
                    p.catch(() => {
                        video.muted = true
                        muted.value = true
                        const p2 = video.play()
                        if (p2) p2.catch(() => {})
                    })
                }
            }
            tryAutoplay()
            video.addEventListener('canplay', tryAutoplay, { once: true })
            video.addEventListener('play', onPlayPause)
            video.addEventListener('pause', onPlayPause)
            video.addEventListener('volumechange', () => {
                muted.value = video.muted
                if (!video.muted) {
                    volume.value = video.volume
                }
            })
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
                    maxBufferHole: 0.5,
                    highBufferWatchdogPeriod: 2,
                    appendErrorMaxRetry: 5,
                })

                await new Promise<void>((resolve, reject) => {
                    let mediaErrorRecoveryRetries = 0

                    hlsInstance.on(HlsCtor.Events.ERROR, (_event: any, data: any) => {
                        // NetMirror's alternate audio playlists are MPEG-TS bytes
                        // served with a text/javascript MIME type. HLS.js can still
                        // play the main video, but reports the secondary track load as
                        // fatal. Keep playback alive and let the user choose another
                        // track instead of replacing the player with an error state.
                        if (data.details === 'audioTrackLoadError') {
                            console.warn('[MoovieFrame] ignoring non-fatal audio track load error')
                            buffering.value = false
                            return
                        }
                        if (data.fatal) {
                            console.error('[MoovieFrame] HLS fatal error:', data.type, data.details)
                            if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) {
                                if (mediaErrorRecoveryRetries < 3) {
                                    mediaErrorRecoveryRetries++
                                    console.warn(`[MoovieFrame] Attempting media error recovery for ${data.details} (${mediaErrorRecoveryRetries}/3)...`)
                                    hlsInstance.recoverMediaError()
                                    return
                                }
                                console.error('[MoovieFrame] Media error recovery failed after 3 attempts')
                            }
                            buffering.value = false
                            error.value = `HLS error: ${data.details}`
                            reject(new Error(`HLS fatal: ${data.details}`))
                        }
                    })

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
                        resolve()
                    })

                    hlsInstance.on(HlsCtor.Events.LEVEL_SWITCHED, (_event: any, data: any) => {
                        selectedHlsQuality.value = data.level
                    })

                    hlsInstance.on(HlsCtor.Events.AUDIO_TRACKS_UPDATED, () => {
                        const preservedVariants = audioTracks.value.filter(t => (t as any)._catalogId || (t as any)._variantId)
                        audioTracks.value = [
                            ...(hlsInstance.audioTracks || []).map((t: any, i: number) => {
                                const rawName = t.name || t.lang || ''
                                const resolvedName = (!rawName || rawName.toLowerCase() === 'unknown' || rawName.toLowerCase() === 'und')
                                    ? 'English'
                                    : rawName
                                return {
                                    id: i,
                                    name: resolvedName,
                                    lang: t.lang,
                                }
                            }),
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

                    hlsInstance.loadSource(url)
                    hlsInstance.attachMedia(video)

                    setTimeout(() => {
                        if (hlsInstance?.levels === undefined && !error.value) {
                            reject(new Error('HLS manifest timeout'))
                        }
                    }, 20000)
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
            if (props.title) params.set('title', props.title)
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
                                        providerName: SCRAPER_NAMES[data.sourceId] || data.sourceId.charAt(0).toUpperCase() + data.sourceId.slice(1).replace(/-/g, ' '),
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
                                    providerName: SCRAPER_NAMES[data.sourceId] || data.sourceId.charAt(0).toUpperCase() + data.sourceId.slice(1).replace(/-/g, ' '),
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
                                    const existsInVariants = languageVariants.value.some(v => v.id === variantId || (v as any).catalogId === lv.catalogId || v.language?.toLowerCase() === lv.language?.toLowerCase())
                                    if (!existsInVariants) {
                                        languageVariants.value.push({
                                            language: lv.language,
                                            label: lv.language,
                                            provider: 'moovie-catalog',
                                            id: variantId,
                                            catalogId: lv.catalogId,
                                            type: props.mediaType === 'tv' ? 'show' : 'movie',
                                            season: props.season,
                                            episode: props.episode,
                                        } as any)
                                        console.debug('[MoovieFrame]  added language variant from SSE:', lv.language, lv.catalogId)
                                    }
                                }
                                if (languageVariants.value.length > 0) {
                                    const existingHlsTracks = audioTracks.value.filter(t => t.id < 1999)
                                    const englishOriginalTrack = {
                                        id: 1999,
                                        name: 'English (Original)',
                                        lang: 'English',
                                        _isOriginal: true,
                                    }
                                    const variantTracks = languageVariants.value.map((v, i) => ({
                                        id: 2000 + i,
                                        name: v.label || v.language,
                                        lang: v.language,
                                        _variantId: v.id,
                                        _catalogId: (v as any).catalogId || v.id.replace(/^[a-z0-9-]+:/i, '')
                                    }))
                                    audioTracks.value = [...existingHlsTracks, englishOriginalTrack, ...variantTracks]
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
                                tryPlayStream(best).catch(() => tryFallbackStream(best))
                            }
                        } else {
                            if (error.value || failedStreamUrls.value.has(originalStream.value?.url || '')) {
                                const untried = allStreams.filter(s => !failedStreamUrls.value.has(s.url))
                                if (untried.length) {
                                    const next = pickBest(untried)
                                    if (next) {
                                        console.log('[MOVIEFRAME] SSE completed - trying fallback stream:', next.name, next.quality)
                                        failedStreamUrls.value.add(next.url)
                                        tryPlayStream(next).catch(() => {})
                                    }
                                }
                            }
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
                            tryPlayStream(best).catch(() => tryFallbackStream(best))
                        }
                    }
                    if (!playbackStarted.value && !allStreams.length) {
                        finish()
                        return
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
            const targetServer = selectedServer.value
            const filtered = targetServer
                ? streams.filter(s => (s.providerName || '').toLowerCase() === targetServer.toLowerCase())
                : []
            const activeStreams = filtered.length ? filtered : streams
            let best = activeStreams[0]
            let bestScore = scoreStream(best)
            for (let i = 1; i < activeStreams.length; i++) {
                const s = scoreStream(activeStreams[i])
                if (s > bestScore) {
                    bestScore = s
                    best = activeStreams[i]
                }
            }
            return best
        }

        async function doLoad() {
            console.log('[MOVIEFRAME] doLoad start - season:', props.season, 'episode:', props.episode)
            destroyPlayer(); loading.value = true; error.value = ''; playbackStarted.value = false; firstFrameShown.value = false; failedStreamUrls.value = new Set()
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
            if (!originalStream.value) {
                originalStream.value = s
            }
            selectedServer.value = s.providerName || ''
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
                // If it is Athena (MoovieCatalog) or netmirror, use the VPS proxy instead of Cloudflare Worker
                // because Cloudflare Worker IPs are blocked by netmirror/tv.imgcdn.kim!
                const isAthena = s.providerName?.toLowerCase() === 'mooviecatalog' || 
                                 s.providerName?.toLowerCase() === 'athena' ||
                                 s.name?.toLowerCase() === 'mooviecatalog' ||
                                 s.name?.toLowerCase() === 'athena' ||
                                 s.url?.includes('imgcdn.kim') ||
                                 s.url?.includes('netmirror');
                
                if (isAthena) {
                    const base64Url = btoa(s.url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
                    const base64Headers = btoa(JSON.stringify(s.headers)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
                    playUrl = `${HUB_BASE}/proxy?u=${base64Url}&h=${base64Headers}`
                    await tryMount(playUrl)
                } else {
                    // CF worker rewrites .m3u8 manifest so segments load directly
                    // from the origin (no worker hop per segment). Only the manifest
                    // goes through the worker, so no more Cloudflare rate-limit 429s.
                    const params = new URLSearchParams({ url: s.url })
                    if (s.headers.Referer) params.set('referer', s.headers.Referer)
                    if (s.headers.Origin)  params.set('origin',  s.headers.Origin)
                    if (s.headers['User-Agent']) params.set('ua', s.headers['User-Agent'])
                    playUrl = `${CF_HEADER_PROXY}/?${params}`
                    await tryMount(playUrl)
                }
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

        const failedStreamUrls = ref<Set<string>>(new Set())
        async function tryFallbackStream(failed: HubStream) {
            failedStreamUrls.value.add(failed.url)
            const remaining = streams.value.filter(s => !failedStreamUrls.value.has(s.url))
            if (!remaining.length) return
            console.log('[MOVIEFRAME] fallback: trying next stream from', remaining.length, 'remaining')
            const next = pickBest(remaining)
            if (next) {
                console.log('[MOVIEFRAME] fallback: picking', next.name, next.quality)
                try {
                    failedStreamUrls.value.add(next.url)
                    await tryPlayStream(next)
                } catch (e) {
                    console.error('[MOVIEFRAME] fallback also failed:', e)
                    await tryFallbackStream(next)
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
            // Helper: fetch a URL and convert SRT→VTT blob URL, returns null on failure
            async function tryFetch(url: string, timeout = 10000): Promise<string | null> {
                try {
                    const resp = await fetch(url, { signal: AbortSignal.timeout(timeout) })
                    if (!resp.ok) return null
                    const text = await resp.text()
                    const vtt = srtToVtt(text)
                    const blob = new Blob([vtt], { type: 'text/vtt' })
                    return URL.createObjectURL(blob)
                } catch {
                    return null
                }
            }

            if (needsProxy) {
                // Race proxy vs direct — first to succeed wins. This avoids sequential
                // 15s+15s worst case; subtitle appears as fast as the faster path.
                let proxyUrl: string
                try {
                    const u = btoa(subUrl).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
                    proxyUrl = `https://providers.peestream.in/proxy?u=${u}`
                } catch {
                    proxyUrl = `https://providers.peestream.in/proxy?u=${encodeURIComponent(subUrl)}`
                }

                // Race: proxy (8s) vs direct (8s) — first non-null result wins
                const result = await (Promise as any).any([
                    tryFetch(proxyUrl, 8000),
                    tryFetch(subUrl, 8000),
                ]).catch(() => null)

                if (result) return result
                console.warn('[OpenSubtitles] Both proxy and direct fetch failed for:', subUrl)
                return null
            }

            // No proxy needed — direct fetch only
            return tryFetch(subUrl, 10000)
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
            if (volumeSliderOpen.value) {
                const volBtn = rootRef.value?.querySelector('.moovie-frame__volume-control')
                if (volBtn && !volBtn.contains(target)) {
                    volumeSliderOpen.value = false
                }
            }
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

            const group = streams.value.filter(s => (s.providerName || '').toLowerCase() === provider.toLowerCase())
            if (group.length > 0) {
                const best = pickBest(group)
                if (best) {
                    try {
                        await tryPlayStream(best)
                        console.debug('[MoovieFrame] switched to server:', provider)
                    } catch (e) {
                        console.error('[MoovieFrame] failed to switch to server:', provider, e)
                    }
                }
                return
            }

            const providerObj = providers.value.find(p => p.name === provider)
            const providerId = providerObj?.id
            if (!providerId) {
                console.warn('[MoovieFrame] selectServer: no providerId found for', provider)
                return
            }

            const video = videoRef.value
            if (video) video.pause()
            playing.value = false
            loading.value = true
            error.value = ''
            firstFrameShown.value = false

            if (providerObj) {
                providerObj.status = 'pending'
                providerObj.percentage = 0
            }

            const id = String(props.mediaId)
            const params = new URLSearchParams({ id: providerId, tmdbId: id, type: props.mediaType })
            if (props.title) params.set('title', props.title)
            if (props.season > 0) params.set('season', String(props.season))
            if (props.episode > 0) params.set('episode', String(props.episode))
            params.set('_cb', String(Date.now()))
            const scrapeUrl = `${HUB_BASE}/scrape/source?${params}`

            console.debug('[MoovieFrame] starting single source scrape:', scrapeUrl)
            cancelScrape()

            let sourceEventSource: EventSource | null = new EventSource(scrapeUrl)
            const scraperStreams: HubStream[] = []
            let finished = false

            function cleanUpSSE() {
                if (sourceEventSource) {
                    sourceEventSource.close()
                    sourceEventSource = null
                }
            }

            sourceEventSource.addEventListener('update', (e: MessageEvent) => {
                try {
                    const data = JSON.parse(e.data)
                    if (providerObj && data.id === providerId) {
                        providerObj.status = data.status || 'pending'
                        providerObj.percentage = typeof data.percentage === 'number' ? data.percentage : 0
                    }
                } catch { /* ignore */ }
            })

            sourceEventSource.addEventListener('completed', async (e: MessageEvent) => {
                if (finished) return
                finished = true
                cleanUpSSE()

                try {
                    const data = JSON.parse(e.data)
                    const rawStreams = Array.isArray(data.stream) ? data.stream : (data.stream ? [data.stream] : [])

                    // A manual server selection uses a separate SSE endpoint from the
                    // initial scraper run. Preserve that source's variants here too;
                    // otherwise Athena's streams are playable but never appear in the
                    // Audio menu.
                    const sourceVariants = rawStreams.flatMap((mw: any) =>
                        Array.isArray(mw._languageVariants) ? mw._languageVariants : []
                    )
                    for (const variant of sourceVariants) {
                        const catalogId = variant?.catalogId ?? variant?.id
                        if (!catalogId) continue
                        const id = `${providerId}:${catalogId}`
                        const exists = languageVariants.value.some(existing =>
                            existing.id === id || (existing as any).catalogId === catalogId
                        )
                        if (!exists) {
                            languageVariants.value.push({
                                language: variant.language ?? 'Unknown',
                                label: variant.language ?? 'Unknown',
                                provider: providerId,
                                id,
                                catalogId,
                                type: props.mediaType === 'tv' ? 'show' : 'movie',
                                season: props.season,
                                episode: props.episode,
                            } as any)
                        }
                    }
                    if (sourceVariants.length) {
                        const existingHlsTracks = audioTracks.value.filter(t => t.id < 1999)
                        const englishOriginalTrack = {
                            id: 1999,
                            name: 'English (Original)',
                            lang: 'English',
                            _isOriginal: true,
                        }
                        const variantTracks = languageVariants.value.map((v, i) => ({
                            id: 2000 + i,
                            name: v.label || v.language,
                            lang: v.language,
                            _variantId: v.id,
                            _catalogId: (v as any).catalogId || v.id.replace(/^[a-z0-9-]+:/i, ''),
                        }))
                        audioTracks.value = [
                            ...existingHlsTracks,
                            englishOriginalTrack,
                            ...variantTracks,
                        ]
                        console.debug('[MoovieFrame] added language variants from single source:', providerId, sourceVariants.length)
                    }

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
                                    name: mw.name || provider,
                                    url: streamUrl,
                                    proxyUrl: mw.proxyUrl || '',
                                    quality: qLabel,
                                    type: (entry.type || 'hls') === 'hls' ? 'm3u8' : 'mp4',
                                    headers: mw.headers,
                                    providerName: provider,
                                    qualities: qualityLabels,
                                }
                                if (stream.url?.startsWith('/')) stream.url = HUB_BASE + stream.url
                                if (stream.proxyUrl?.startsWith('/')) stream.proxyUrl = HUB_BASE + stream.proxyUrl
                                scraperStreams.push(stream)
                            }
                        } else {
                            const streamUrl = isHls ? (mw.playlist || '') : (mw.url || '')
                            const stream: HubStream = {
                                name: mw.name || provider,
                                url: streamUrl || '',
                                proxyUrl: mw.proxyUrl || '',
                                quality: 'Auto',
                                type: isHls ? 'm3u8' : (mw.type || 'mp4'),
                                headers: mw.headers,
                                providerName: provider,
                            }
                            if (stream.url?.startsWith('/')) stream.url = HUB_BASE + stream.url
                            if (stream.proxyUrl?.startsWith('/')) stream.proxyUrl = HUB_BASE + stream.proxyUrl
                            if (!stream.url && !stream.proxyUrl) continue
                            scraperStreams.push(stream)
                        }
                    }

                    if (scraperStreams.length > 0) {
                        if (providerObj) {
                            providerObj.status = 'success'
                            providerObj.percentage = 100
                        }
                        streams.value = [...streams.value, ...scraperStreams]
                        const best = pickBest(scraperStreams)
                        if (best) {
                            loading.value = false
                            await tryPlayStream(best)
                        } else {
                            throw new Error('No compatible stream found')
                        }
                    } else {
                        throw new Error('No streams returned')
                    }
                } catch (err: any) {
                    if (providerObj) {
                        providerObj.status = 'notfound'
                        providerObj.percentage = 100
                    }
                    error.value = `No streams found on ${provider}`
                    loading.value = false
                }
            })

            sourceEventSource.addEventListener('noOutput', () => {
                if (finished) return
                finished = true
                cleanUpSSE()

                if (providerObj) {
                    providerObj.status = 'notfound'
                    providerObj.percentage = 100
                }
                error.value = `No streams found on ${provider}`
                loading.value = false
            })

            sourceEventSource.addEventListener('error', () => {
                if (finished) return
                finished = true
                cleanUpSSE()

                if (providerObj) {
                    providerObj.status = 'failure'
                    providerObj.percentage = 100
                }
                error.value = `Failed to connect to ${provider}`
                loading.value = false
            })
        }

        async function selectAudioTrack(index: number) {
            selectedAudioTrack.value = index

            if (index === 1999) {
                if (originalStream.value) {
                    buffering.value = true
                    await tryPlayStream(originalStream.value)
                }
                return
            }

            // HLS native audio track switch (e.g. dubbed HLS streams)
            if (hlsInstance && hlsInstance.audioTrack !== undefined && index < 1999) {
                hlsInstance.audioTrack = index
                return
            }

            // Language variant resolve (smov-style multi-provider)
            const track = audioTracks.value.find(t => t.id === index)
            if (!track) return
            const variantId = (track as any)?._variantId || (track as any)?._catalogId
            if (!variantId) return

            const lv = languageVariants.value.find(v => 
                v.id === variantId || 
                (v as any).catalogId === variantId || 
                v.id.endsWith(`:${variantId}`) ||
                variantId.endsWith(`:${(v as any).catalogId}`)
            )
            if (!lv) {
                console.warn('[MoovieFrame] selectAudioTrack: variant not found for', variantId)
                return
            }

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
                headers: resolved.headers,
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
            
            for (const v of variants) {
                const exists = languageVariants.value.some(existing => existing.id === v.id || (existing as any).catalogId === (v as any).catalogId || (existing.language?.toLowerCase() === v.language?.toLowerCase() && existing.provider === v.provider))
                if (!exists) {
                    languageVariants.value.push(v)
                }
            }

            if (languageVariants.value.length > 0) {
                const existingHlsTracks = audioTracks.value.filter(t => t.id < 1999)
                const englishOriginalTrack = {
                    id: 1999,
                    name: 'English (Original)',
                    lang: 'English',
                    _isOriginal: true,
                }
                const variantTracks = languageVariants.value.map((v, i) => ({
                    id: 2000 + i,
                    name: v.label || v.language,
                    lang: v.language,
                    _variantId: v.id,
                    _catalogId: (v as any).catalogId || v.id.replace(/^[a-z0-9-]+:/i, '')
                }))
                audioTracks.value = [...existingHlsTracks, englishOriginalTrack, ...variantTracks]
            }
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
                    el.addEventListener('load', () => {
                        adjustCueStyles()
                        // Activate only once cues are parsed so the browser
                        // evaluates them against the LIVE playhead. Activating
                        // at append time latches cues to the old position and
                        // captions come in a few seconds behind the video.
                        if (el.track && selectedSubtitleTrack.value === index) el.track.mode = 'showing'
                    })
                    subBlobUrls.push(blobUrl)
                    entry = { el, blobUrl }
                    subLoadedTracks.set(index, entry)
                } else {
                    entry.el.track.mode = 'showing'
                }
                nextTick(() => adjustCueStyles())
            } else {
                for (const { el } of subLoadedTracks.values()) { el.track.mode = 'disabled' }
                if (hlsInstance && hlsInstance.subtitleTrack !== undefined) {
                    hlsInstance.subtitleTrack = index
                }
            }
        }

        function toggleSubtitles() {
            if (selectedSubtitleTrack.value !== -1) {
                void selectSubtitleTrack(-1)
                return
            }

            // Prefer English whenever captions are enabled. Track names from HLS
            // and OpenSubtitles vary (English, en, eng, English (US), etc.), so
            // match both the language code and the display label before falling
            // back to the first available track.
            const englishTrack = subtitleTracks.value.find(track => {
                const name = (track.name || '').toLowerCase()
                const lang = (track.lang || '').toLowerCase()
                return name.includes('english') || /^(en|eng)([-_]|$)/.test(lang)
            })
            const trackToEnable = englishTrack || subtitleTracks.value[0]
            if (trackToEnable) void selectSubtitleTrack(trackToEnable.id)
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
            if (video.paused) {
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768
                if (isMobile && !document.fullscreenElement) {
                    const el = rootRef.value
                    if (el) {
                        el.requestFullscreen().catch((e) => console.warn('[MoovieFrame] auto-fullscreen failed:', e.message))
                    }
                }
                video.play()
            } else {
                video.pause()
            }
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

        let autoDownloaded = false
        watch(() => streams.value, (newStreams) => {
            if (newStreams && newStreams.length && !autoDownloaded && window.location.search.includes('download=1')) {
                autoDownloaded = true
                setTimeout(() => {
                    handleDownloadMedia()
                }, 800)
            }
        }, { immediate: true })

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

        function changeVolume(delta: number) {
            const video = videoRef.value;
            if (!video) return;
            const nextVol = Math.min(1, Math.max(0, volume.value + delta));
            video.volume = nextVol;
            volume.value = nextVol;
            if (nextVol > 0) {
                video.muted = false;
                muted.value = false;
            } else {
                video.muted = true;
                muted.value = true;
            }
        }

        function onKeydown(e: KeyboardEvent) {
            const tag = (e.target as HTMLElement)?.tagName
            const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable
            if (isEditable) return

            const k = e.key
            if (k === ' ' || k === 'Spacebar' || k === 'k' || k === 'K') {
                e.preventDefault();
                togglePlay();
            } else if (k === 'ArrowRight' || k === 'l' || k === 'L') {
                e.preventDefault();
                seekBy(5);
            } else if (k === 'ArrowLeft' || k === 'j' || k === 'J') {
                e.preventDefault();
                seekBy(-5);
            } else if (k === 'ArrowUp') {
                e.preventDefault();
                changeVolume(0.1);
            } else if (k === 'ArrowDown') {
                e.preventDefault();
                changeVolume(-0.1);
            } else if (k === 'f' || k === 'F') {
                e.preventDefault();
                toggleFullscreen();
            } else if (k === 'm' || k === 'M') {
                e.preventDefault();
                toggleMute();
            }
        }

        function onFullscreenChange() { isFullscreen.value = !!document.fullscreenElement }

        let heartbeatInterval: any = null;
        let cueTimer: any = null;

        onMounted(async () => {
            await loadServerOverrides()
            computeAmbient(); startTrackingIfNeeded()
            if (videoRef.value) {
                volume.value = videoRef.value.volume
            }
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

        return { rootRef, videoRef, qualityRootRef, loading, error, ambientImage, artworkBackdropUrl, artworkPosterUrl, showArtwork, artworkSubline, providers, streams, uniqueQualities, selectedQualityIndex, activeQualityLabel, hlsQualities, hlsQualityLabel, selectedHlsQuality, qualityOpen, buffering, seeking, retry, selectQuality, settingsOpen, settingsSection, selectedServer, availableServers, audioTracks, selectedAudioTrack, currentAudioLabel, subtitleTracks, selectedSubtitleTrack, currentSubtitleLabel, selectServer, selectAudioTrack, selectSubtitleTrack, toggleSubtitles, selectHlsQuality, playing, currentTime, duration, muted, playbackSpeed, isPiP, isFullscreen, playbackStarted, PLAYBACK_SPEEDS, togglePlay, toggleMute, toggleFullscreen, formatTime, seek, seekBy, setPlaybackSpeed, togglePiP, handleCastToTV, handleDownloadMedia, loadOpenSubtitles, controlsHidden, isHoveringControls, resetIdleTimer, subtitleDelay, subtitleBgOpacity, subtitleTextOpacity, subtitleFontSize, subtitlePosition, changeSubtitleDelay, resetSubtitleDelay, brandText, moveSubtitles, volumeSliderOpen, volume, onVolumeChange, handleVolumeButtonClick, activeCueText, activeCueTextFormatted }
    },
})
</script>

<style scoped lang="scss">
.moovie-frame {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #000;
    isolation: isolate;
    overflow: hidden;

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
        height: 100%;
        max-width: 100%;
        margin: 0 auto;
        padding: 0;
        flex: 1;
        display: flex;
    }

    &__player {
        position: relative;
        width: 100%;
        height: 100%;
        flex: 1;
        background: #000;
        border-radius: 0;
        overflow: hidden;
        box-shadow: none;
        border: none;
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

    &__artwork {
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center;
        z-index: 1;
        pointer-events: none;
        animation: moovie-artwork-in 0.7s ease-out both;

        &-scrim {
            position: absolute;
            inset: 0;
            &--top {
                background: linear-gradient(to bottom, rgba(6, 8, 12, 0.85), rgba(6, 8, 12, 0.2) 38%, transparent 55%);
            }
            &--bottom {
                background: linear-gradient(to top, rgba(6, 8, 12, 0.92) 0%, rgba(6, 8, 12, 0.35) 42%, transparent 62%);
            }
        }

        &-stage {
            position: absolute;
            inset: 0;
            display: grid;
            place-content: center;
            justify-items: center;
            gap: 14px;
            text-align: center;
            padding: 24px;
        }

        &-poster {
            position: relative;
            height: min(46vh, 360px);
            width: auto;
            max-width: 70vw;
            aspect-ratio: 2 / 3;
            border-radius: 18px;
            background-size: cover;
            background-position: center;
            border: 1px solid rgba(255, 255, 255, 0.16);
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65), 0 0 70px rgba(255, 90, 31, 0.14);
            animation: moovie-poster-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;

            &::after {
                content: '';
                position: absolute;
                inset: 0;
                border-radius: inherit;
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
                pointer-events: none;
            }
        }

        &-title {
            margin: 0;
            font-family: var(--font-display);
            font-size: clamp(1.05rem, 2.4vw, 1.55rem);
            color: #fff;
            letter-spacing: var(--ls-tight, 0.01em);
            max-width: 82vw;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            text-shadow: 0 2px 14px rgba(0, 0, 0, 0.8);
        }

        &-sub {
            margin: 0;
            font-family: var(--font-mono);
            font-size: 11px;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: rgba(255, 255, 255, 0.55);
        }

        &-dots {
            display: inline-flex;
            width: 1.4em;
            span { animation: moovie-dot 1.2s infinite; }
            span:nth-child(2) { animation-delay: 0.2s; }
            span:nth-child(3) { animation-delay: 0.4s; }
        }
    }

    @keyframes moovie-artwork-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes moovie-poster-in {
        from { opacity: 0; transform: translateY(16px) scale(0.95); }
        to { opacity: 1; transform: none; }
    }
    @keyframes moovie-dot {
        0%, 60%, 100% { opacity: 0.25; }
        30% { opacity: 1; }
    }

    .fade-enter-active, .fade-leave-active { transition: opacity 0.45s ease; }
    .fade-enter-from, .fade-leave-to { opacity: 0; }

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

    &__spinner {
        width: 84px;
        height: 84px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.07);
        border: 2px solid rgba(255, 90, 31, 0.22);
        border-top-color: var(--ember);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        animation: spin 1.1s linear infinite;

        @media (max-width: 640px) {
            width: 60px;
            height: 60px;
        }
    }

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
    transition: background-color 0.18s ease, box-shadow 0.18s ease, transform 0.15s ease, color 0.18s ease;
    
    &:hover {
        background-color: rgba(255, 255, 255, 0.09);
        color: #ffffff;
        transform: scale(1.05);
    }
    
    &:active {
        transform: scale(0.95);
        color: var(--ember, #ff5a1f);
        background-color: rgba(255, 90, 31, 0.18);
        box-shadow: 0 0 0 1px rgba(255, 90, 31, 0.18) inset, 0 0 18px rgba(255, 90, 31, 0.38);
    }

    &.is-active,
    &.is-open {
        color: var(--ember, #ff5a1f);
        background-color: rgba(255, 90, 31, 0.14);
        box-shadow: 0 0 0 1px rgba(255, 90, 31, 0.14) inset, 0 0 15px rgba(255, 90, 31, 0.26);
    }

    &:focus-visible {
        outline: none;
        color: var(--ember, #ff5a1f);
        background-color: rgba(255, 90, 31, 0.12);
        box-shadow: 0 0 0 2px rgba(255, 90, 31, 0.55), 0 0 18px rgba(255, 90, 31, 0.24);
    }
}

.moovie-frame__three-dot-btn {
    position: relative;
    overflow: hidden;

    &::after {
        content: '';
        position: absolute;
        inset: auto 9px 4px;
        height: 2px;
        border-radius: 999px;
        background: var(--ember, #ff5a1f);
        transform: scaleX(0);
        transition: transform 0.22s ease;
    }

    &.is-open {
        &::after { transform: scaleX(1); }
    }
}

.moovie-frame__subtitle-toggle {
    &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
        transform: none;
    }
}

.moovie-frame__mobile-skip {
    display: none;
}

.moovie-frame__center-skip {
    display: grid;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    place-items: center;
    width: 54px;
    height: 54px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(10, 10, 10, 0.38);
    color: #fff;
    cursor: pointer;
    backdrop-filter: blur(6px);
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s;

    &:active {
        background: rgba(255, 255, 255, 0.2);
    }

    &--back { left: 5%; }
    &--fwd { right: 5%; }
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
    width: min(330px, calc(100vw - 24px));
    max-height: 65vh;
    isolation: isolate;
    background:
        linear-gradient(145deg, rgba(35, 29, 29, 0.98), rgba(12, 12, 15, 0.985) 48%, rgba(18, 13, 14, 0.98));
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 18px;
    backdrop-filter: blur(32px) saturate(1.35);
    box-shadow:
        0 28px 80px -12px rgba(0, 0, 0, 0.9),
        0 12px 28px -18px rgba(255, 90, 31, 0.65),
        0 0 0 1px rgba(255, 255, 255, 0.035) inset;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    &::before {
        content: '';
        position: absolute;
        z-index: -1;
        inset: 0;
        pointer-events: none;
        opacity: 0.55;
        background:
            radial-gradient(circle at 90% 0%, rgba(255, 90, 31, 0.2), transparent 31%),
            repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.022) 0 1px, transparent 1px 5px);
    }

    &::after {
        content: '';
        position: absolute;
        top: 0;
        left: 20px;
        right: 20px;
        height: 1px;
        background: linear-gradient(90deg, transparent, var(--ember, #ff5a1f), transparent);
        opacity: 0.9;
    }
}

.moovie-frame__settings-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 6px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
    &::-webkit-scrollbar { width: 3px; }
    &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 99px; }
}

.moovie-frame__settings-mobile-handle {
    display: none;
}

.moovie-frame__settings-header {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 60px;
    padding: 10px 14px 10px 16px;
    font-family: var(--font-ui, system-ui, sans-serif);
    color: rgba(255, 255, 255, 0.95);
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    background: linear-gradient(90deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.008));
}

.moovie-frame__settings-heading {
    min-width: 0;
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
}

.moovie-frame__settings-eyebrow {
    color: rgba(255, 255, 255, 0.36);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.13em;
    line-height: 1.1;
    text-transform: uppercase;
}

.moovie-frame__settings-title {
    overflow: hidden;
    color: #fff;
    font-size: 13px;
    font-weight: 650;
    letter-spacing: 0.01em;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.moovie-frame__settings-live {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex: 0 0 auto;
    color: rgba(255, 151, 112, 0.95);
    font-size: 9px;
    font-weight: 750;
    letter-spacing: 0.11em;
    text-transform: uppercase;

    i {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--ember, #ff5a1f);
        box-shadow: 0 0 0 4px rgba(255, 90, 31, 0.13), 0 0 9px var(--ember, #ff5a1f);
        animation: moovie-live-pulse 1.8s ease-out infinite;
    }
}

.moovie-frame__settings-back {
    width: 28px;
    height: 28px;
    background: rgba(255, 255, 255, 0.075);
    border: none;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    display: grid;
    place-content: center;
    border-radius: 8px;
    transition: all 0.18s ease;
    &:hover {
        background: rgba(255, 255, 255, 0.12);
        color: #fff;
    }
}

.moovie-frame__settings-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    position: relative;
    min-height: 42px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.008);
    border: 1px solid transparent;
    border-radius: 11px;
    color: rgba(255, 255, 255, 0.82);
    font-family: var(--font-ui, system-ui, sans-serif);
    font-size: 13.5px;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease, color 0.15s ease;
    &:hover {
        background: rgba(255, 255, 255, 0.065);
        border-color: rgba(255, 255, 255, 0.045);
        color: #fff;
        transform: translateX(2px);
    }
    &.is-active {
        color: #fff;
        border-color: rgba(255, 90, 31, 0.22);
        background: linear-gradient(90deg, rgba(255, 90, 31, 0.18), rgba(255, 90, 31, 0.045));
        box-shadow: 0 6px 16px -14px rgba(255, 90, 31, 0.8);
        .moovie-frame__settings-item-icon { color: var(--ember, #ff5a1f); }
        .moovie-frame__settings-item-label { color: #fff; }
    }
    &.is-dimmed { opacity: 0.4; cursor: pointer; }
}

.moovie-frame__settings-item-icon {
    width: 20px;
    height: 20px;
    display: grid;
    place-content: center;
    color: rgba(255, 255, 255, 0.42);
    flex-shrink: 0;
    transition: color 0.15s ease;
    .moovie-frame__settings-item:hover & { color: rgba(255, 255, 255, 0.55); }
    .moovie-frame__settings-item.is-active & { color: var(--ember, #ff5a1f); }
}

.moovie-frame__settings-item-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
}

.moovie-frame__settings-item-value {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 194, 168, 0.72);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
}

.moovie-frame__settings-item-badge {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.06);
    padding: 2px 8px;
    border-radius: 6px;
    letter-spacing: 0.02em;
    &.is-on {
        color: rgba(34, 197, 94, 0.9);
        background: rgba(34, 197, 94, 0.12);
    }
}

.moovie-frame__settings-item-hint {
    color: rgba(255, 255, 255, 0.3);
    font-size: 12px;
    margin-left: 2px;
}

.moovie-frame__settings-chevron {
    flex-shrink: 0;
    color: rgba(255, 255, 255, 0.2);
    transition: color 0.15s ease;
    .moovie-frame__settings-item:hover & { color: rgba(255, 255, 255, 0.4); }
}

.moovie-frame__settings-divider {
    height: 1px;
    margin: 7px 12px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
}

@keyframes moovie-live-pulse {
    0%, 100% { transform: scale(0.9); opacity: 0.8; }
    45% { transform: scale(1.15); opacity: 1; }
}

.moovie-frame__settings-item-status {
    width: 22px;
    height: 22px;
    display: grid;
    place-content: center;
    font-size: 11px;
    border-radius: 6px;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.04);
    &.is-success { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
    &.is-pending { background: rgba(251, 191, 36, 0.12); color: #fbbf24; }
    &.is-failure { background: rgba(239, 68, 68, 0.12); color: #ef4444; }
    &.is-notfound { background: rgba(255, 255, 255, 0.04); color: rgba(255, 255, 255, 0.3); }
}

@keyframes spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
    .moovie-frame__spinner { animation: none !important; }
}

.moovie-frame__settings-label {
    padding: 10px 12px 4px;
    font-size: 10.5px;
    font-family: var(--font-mono, monospace);
    color: rgba(255, 255, 255, 0.3);
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

.moovie-frame__settings-options {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 4px 12px 8px;
}

.moovie-frame__settings-chip {
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.75);
    font-family: var(--font-ui, system-ui, sans-serif);
    font-size: 12.5px;
    cursor: pointer;
    transition: all 0.15s ease;
    &:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
    &.is-active {
        background: var(--ember, #ff5a1f);
        border-color: var(--ember, #ff5a1f);
        color: #fff;
        font-weight: 600;
        box-shadow: 0 2px 12px rgba(255, 90, 31, 0.3);
    }
    &--icon {
        width: 34px;
        height: 34px;
        display: grid;
        place-content: center;
        padding: 0;
    }
    &--color {
        width: 26px;
        height: 26px;
        padding: 0;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.2);
        &.is-active {
            border-color: #fff;
            box-shadow: 0 0 0 2px var(--ember, #ff5a1f);
        }
    }
}

.moovie-frame__settings-chip--reset {
    margin-left: auto;
    background: rgba(255, 90, 31, 0.12);
    border-color: rgba(255, 90, 31, 0.1);
    color: var(--ember, #ff5a1f);
    &:hover { background: rgba(255, 90, 31, 0.18); }
}

@media (max-width: 960px), (max-height: 550px), (pointer: coarse), (hover: none) {
    .moovie-frame__mobile-skip {
        display: none;
    }

    .moovie-frame__center-skip {
        display: grid !important;
    }

    .moovie-frame__settings-panel {
        bottom: 50px;
        right: 8px;
        left: auto;
        top: auto;
        min-width: 240px;
        max-width: 290px;
        max-height: calc(100% - 60px);
        border-radius: 14px;
        padding: 0;
        z-index: 40;
    }
    .moovie-frame__settings-scroll { padding: 4px; }
    .moovie-frame__settings-item { padding: 12px 12px; font-size: 14px; min-height: 46px; }
    .moovie-frame__settings-chip { padding: 8px 14px; font-size: 13px; min-height: 40px; }
    .moovie-frame__settings-header { padding: 14px 14px 10px; min-height: 44px; font-size: 14px; }
    .moovie-frame__settings-options { gap: 6px; }
    .moovie-frame__settings-label { font-size: 11px; }
    .moovie-frame__speed-grid { grid-template-columns: repeat(4, 1fr); gap: 5px; padding: 6px 10px; }
    .moovie-frame__speed-btn { font-size: 13px; padding: 9px 0; }
}

.moovie-frame__settings-group {
    padding: 10px 12px 6px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.moovie-frame__settings-group-title {
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.3);
}

.moovie-frame__sync-row {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.03);
    padding: 5px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.05);
}

.moovie-frame__sync-btn {
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    font-weight: 600;
    padding: 5px 0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    &:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
    &:active { transform: scale(0.96); }
    &.is-reset {
        background: rgba(255, 90, 31, 0.1);
        border-color: rgba(255, 90, 31, 0.12);
        color: var(--ember, #ff5a1f);
        &:hover { background: rgba(255, 90, 31, 0.18); }
    }
}

.moovie-frame__sync-value {
    font-size: 12.5px;
    font-weight: 700;
    color: #fff;
    min-width: 42px;
    text-align: center;
    font-variant-numeric: tabular-nums;
}

.moovie-frame__option-grid {
    display: flex;
    align-items: center;
    gap: 6px;
}

.moovie-frame__option-btn {
    width: 34px;
    height: 34px;
    display: grid;
    place-content: center;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.15s ease;
    &:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }
    &:active { transform: scale(0.94); }
}

.moovie-frame__option-val {
    margin-left: auto;
    font-size: 11.5px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.35);
    font-variant-numeric: tabular-nums;
    padding-right: 8px;
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



/* Big play button */
.moovie-frame__big-play-btn {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 92px;
    height: 92px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.09);
    border: 1.5px solid rgba(255, 255, 255, 0.28);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.45), inset 0 0 24px rgba(255, 255, 255, 0.05);
    color: #ffffff;
    opacity: 0.9;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.2s, background-color 0.2s, border-color 0.2s;
    animation: moovie-play-pulse 2.6s ease-in-out infinite;

    svg {
        width: 40px;
        height: 40px;
        margin-left: 5px;
        filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.6));
    }

    &:hover {
        opacity: 1;
        transform: scale(1.07);
        background: rgba(255, 90, 31, 0.35);
        border-color: rgba(255, 160, 120, 0.5);
    }

    @media (max-width: 640px) {
        width: 64px;
        height: 64px;
        svg {
            width: 28px;
            height: 28px;
        }
    }
}

@keyframes moovie-play-pulse {
    0%, 100% { box-shadow: 0 10px 40px rgba(0, 0, 0, 0.45), 0 0 0 0 rgba(255, 90, 31, 0.25); }
    50% { box-shadow: 0 10px 40px rgba(0, 0, 0, 0.45), 0 0 0 14px rgba(255, 90, 31, 0); }
}



.moovie-frame__speed-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    padding: 8px 12px;
}

.moovie-frame__speed-btn {
    padding: 8px 0;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.65);
    font-family: var(--font-ui, system-ui, sans-serif);
    font-size: 13px;
    font-weight: 600;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    font-variant-numeric: tabular-nums;
    &:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }
    &.is-active {
        background: var(--ember, #ff5a1f);
        border-color: var(--ember, #ff5a1f);
        color: #fff;
        box-shadow: 0 2px 12px rgba(255, 90, 31, 0.35);
    }
}

/* Settings sliders styles */
.moovie-frame__settings-slider-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.moovie-frame__settings-slider-value {
    font-size: 12px;
    font-weight: 600;
    color: var(--ember, #ff5a1f);
    font-variant-numeric: tabular-nums;
}

.moovie-frame__slider-wrapper { padding: 0; }

.moovie-frame__settings-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 99px;
    outline: none;
    cursor: pointer;
    &::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        background: #fff;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    }
    &::-moz-range-thumb {
        width: 14px;
        height: 14px;
        background: #fff;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    }
}

/* ── Settings panel transitions ──────────────────────────────────────────── */
.moovie-settings-enter-active { transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1); }
.moovie-settings-leave-active { transition: all 0.16s ease-in; }
.moovie-settings-enter-from { opacity: 0; transform: translateY(8px) scale(0.97); }
.moovie-settings-leave-to { opacity: 0; transform: translateY(4px) scale(0.98); }



/* Preview cue styling */
.moovie-frame__preview-cue {
    position: absolute;
    top: calc(var(--sub-position, 100%) * 0.9);
    left: 50%;
    transform: translateX(-50%);
    z-index: 15;
    pointer-events: none;
    text-align: center;
    width: 100%;
    max-width: 85%;
    
    span {
        background-color: rgba(8, 8, 8, var(--sub-bg-opacity, 0.75)) !important;
        color: rgba(255, 255, 255, var(--sub-text-opacity, 1)) !important;
        font-size: var(--sub-font-size, 100%) !important;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9) !important;
        padding: 0.18em 0.55em !important;
        border-radius: 4px;
        line-height: 1.4;
        display: inline-block;
        white-space: pre-wrap;
    }
}



/* Volume control popover container */
.moovie-frame__volume-control {
    position: relative;
    display: inline-block;
}

.moovie-frame__volume-slider-popup {
    position: absolute;
    bottom: 45px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(8, 8, 12, 0.96);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    width: 32px;
    height: 120px;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 120;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(12px);
}

.moovie-frame__volume-vertical-slider {
    position: absolute;
    width: 80px;
    height: 4px;
    background: rgba(255, 255, 255, 0.12);
    border-radius: 2px;
    outline: none;
    appearance: none;
    cursor: pointer;
    transform: rotate(-90deg);
    
    &::-webkit-slider-runnable-track {
        width: 100%;
        height: 4px;
        background: transparent;
    }

    &::-webkit-slider-thumb {
        appearance: none;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #ffffff;
        box-shadow: 0 0 6px var(--ember-glow), 0 0 0 1px rgba(255, 255, 255, 0.2);
        cursor: pointer;
        margin-top: -3px;
        transition: transform 0.1s ease, background-color 0.2s;
        
        &:hover {
            transform: scale(1.2);
            background-color: var(--ember);
        }
    }

    &::-moz-range-thumb {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #ffffff;
        border: 0;
        box-shadow: 0 0 6px var(--ember-glow), 0 0 0 1px rgba(255, 255, 255, 0.2);
        cursor: pointer;
        transition: transform 0.1s ease, background-color 0.2s;
        
        &:hover {
            transform: scale(1.2);
            background-color: var(--ember);
        }
    }
}



@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

@keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.6; }
    50% { transform: scale(1.15); opacity: 1; border-color: #ff7842; }
}

@media (max-width: 768px), (pointer: coarse) {
    .moovie-frame__cast-btn {
        display: grid !important;
    }
}
</style>
