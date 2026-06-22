
        // Safe localStorage wrapper to prevent crashes when opened via file:// protocol
        const safeLocalStorage = {
            getItem(key) {
                try {
                    return localStorage.getItem(key);
                } catch (e) {
                    console.warn('localStorage getItem failed, falling back:', e);
                    return null;
                }
            },
            setItem(key, value) {
                try {
                    localStorage.setItem(key, value);
                } catch (e) {
                    console.warn('localStorage setItem failed:', e);
                }
            }
        };

        const PARTY_HOST_KEY = 'watchable_party_hosts';

        function readPartyHostMap() {
            try {
                return JSON.parse(safeLocalStorage.getItem(PARTY_HOST_KEY) || '{}');
            } catch (e) {
                return {};
            }
        }

        function markAsPartyHost(roomId) {
            if (!roomId) return;
            const map = readPartyHostMap();
            map[roomId] = { user: currentUserName, at: Date.now() };
            safeLocalStorage.setItem(PARTY_HOST_KEY, JSON.stringify(map));
        }

        function checkIsPartyHost(room) {
            if (!room?.id) return false;
            const entry = readPartyHostMap()[room.id];
            return Boolean(entry && entry.user === currentUserName);
        }

        function applyRoomHostRole(room, created = false) {
            isHost = created || checkIsPartyHost(room);
            if (isHost && room?.id) markAsPartyHost(room.id);
        }

        // Adjust links for file:// protocol vs http:// protocol dynamically
        if (window.location.protocol !== 'file:') {
            document.querySelectorAll('a[href="../index.html"]').forEach(link => {
                link.setAttribute('href', '/');
            });
        }

        // Short code codec for clean room URLs (e.g. ?room=AS840)
        function generateShortCode() {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let code = '';
            for (let i = 0; i < 5; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return code;
        }

        function shortCodeToUuid(code) {
            if (!code) return null;
            const clean = code.trim().toUpperCase();
            const num = parseInt(clean, 36);
            if (isNaN(num)) return null;
            const hex = num.toString(16).padStart(8, '0');
            return `${hex}-74be-4961-9b03-8afd980da989`;
        }

        function uuidToShortCode(uuid) {
            if (!uuid || typeof uuid !== 'string') return null;
            if (!uuid.endsWith('-74be-4961-9b03-8afd980da989')) return null;
            const hex = uuid.split('-')[0];
            const num = parseInt(hex, 16);
            if (isNaN(num)) return null;
            return num.toString(36).toUpperCase();
        }

        function isPartyShortCode(roomId) {
            if (!roomId || typeof roomId !== 'string') return false;
            // Watch-party media rooms encode season/episode in the id.
            if (roomId.includes('_')) return false;
            // Pure numbers are TMDB / catalogue ids — not lobby short codes.
            if (/^\d+$/.test(roomId)) return false;
            return /^[a-z0-9]{5,6}$/i.test(roomId);
        }

        // Supabase Dynamic configuration
        const defaultUrl = 'https://eeyiragtylotiwozbgqp.supabase.co';
        const defaultKey = safeLocalStorage.getItem('supabase_anon_key') || ''; // Overrides can be in localStorage

        // Parse query params (Direct Join or Stream details transfer)
        const urlParams = new URLSearchParams(window.location.search);
        let joinRoomId = urlParams.get('room') || '';
        const catalogMediaId = urlParams.get('media') || '';
        const prefillTitle = urlParams.get('title') || '';

        function isCatalogMediaKey(value) {
            if (!value || typeof value !== 'string') return false;
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return false;
            if (isPartyShortCode(value)) return false;
            return true;
        }

        async function createCatalogPartyRoom(catalogKey) {
            const isBot = /bot|googlebot|crawler|spider|robot|crawling|lighthouse/i.test(navigator.userAgent) || navigator.webdriver;
            if (isBot) {
                console.log('Bot detected. Skipping automatic room creation.');
                showLobbyView();
                return;
            }

            const roomName = `${currentUserName}'s Watch Lounge`;
            const shortCode = generateShortCode();
            const uuid = shortCodeToUuid(shortCode);
            const row = {
                id: uuid,
                name: roomName,
                movie_title: prefillTitle || 'Feature Title',
                embed_sources: catalogKey,
                media_id: catalogKey,
                scheduled_start_time: new Date().toISOString()
            };

            const { data: newRoom, error: createError } = await supabaseClient
                .from('rooms')
                .insert([row])
                .select()
                .single();

            if (createError) throw createError;

            activeRoom = newRoom;
            applyRoomHostRole(newRoom, true);
            showRoomView(newRoom);
        }

        // Parsing room parameter for custom player URLs
        let isAnime = false;
        let isTv = false;
        let isNetflix = false;
        let mediaId = joinRoomId;
        let season = 1;
        let episode = 1;
        function parseMediaParams(idString) {
            isNetflix = idString.startsWith('nf_');
            const payload = isNetflix ? idString.slice(3) : idString;

            isAnime = payload.startsWith('anime_') || (!isNetflix && payload.includes('_ep'));
            isTv = payload.includes('_s') && !isAnime;
            mediaId = payload;
            season = 1;
            episode = 1;

            if (isAnime) {
                const cleanId = payload.replace('anime_', '');
                if (cleanId.includes('_ep')) {
                    const parts = cleanId.split('_ep');
                    mediaId = parts[0];
                    episode = parseInt(parts[1]) || 1;
                } else {
                    mediaId = cleanId;
                }
            } else if (isTv) {
                const parts = payload.split('_s');
                mediaId = parts[0];
                const epParts = parts[1].split('e');
                season = parseInt(epParts[0]) || 1;
                episode = parseInt(epParts[1]) || 1;
            } else {
                mediaId = payload;
            }
        }

        let netflixArt = null;
        let netflixStreams = [];
        let netflixStreamIndex = 0;
        let netflixUiTimer = null;
        let netflixControlsTimer = null;
        let partyNfUiBound = false;
        let partyNfControlsIdleBound = false;
        let partyNfContentResizeObserver = null;
        const PARTY_NF_CONTROLS_HIDE_MS = 3200;
        let netflixCatalogMeta = null;
        let netflixLanguageVariants = [];
        let netflixSeasons = [];
        let netflixEpisodes = [];
        let netflixEpisodesLoading = false;
        let netflixSupportsEpisodes = false;
        let netflixTmdbShowId = null;
        let partyViewingSeason = 1;
        let partyEpisodeUpgradeToken = 0;
        let partyEpisodesListBound = false;
        let partyExtensionActive = false;

        const NETFLIX_QUALITY_RANK = { '360P': 0, '480P': 1, '720P': 2, '1080P': 3, unknown: 4 };
        const PARTY_TMDB_API_KEY = 'dfa4c2c7c1de1005adee824dc5593672';
        const partyShowMetaCache = new Map();
        const partySeasonEpisodesCache = new Map();

        const NETFLIX_LANGUAGE_TAGS = [
            { category: 'hindi', label: 'Hindi', matchLabels: ['Hindi', 'HindiDub'] },
            { category: 'english', label: 'English', matchLabels: ['English'] },
            { category: 'telugu', label: 'Telugu', matchLabels: ['Telugu'] },
            { category: 'tamil', label: 'Tamil', matchLabels: ['Tamil'] },
            { category: 'malayalam', label: 'Malayalam', matchLabels: ['Malayalam'] },
            { category: 'bengali', label: 'Bengali', matchLabels: ['Bengali'] },
            { category: 'kannada', label: 'Kannada', matchLabels: ['Kannada'] },
            { category: 'marathi', label: 'Marathi', matchLabels: ['Marathi'] },
            { category: 'punjabi', label: 'Punjabi', matchLabels: ['Punjabi'] },
            { category: 'arabic', label: 'Arabic', matchLabels: ['Arabic', 'ArabicDub'] },
            { category: 'urdu', label: 'Urdu', matchLabels: ['Urdu'] }
        ];

        function parseCatalogTitle(raw) {
            const languages = [];
            const pattern = /\[([^\]]+)\]/g;
            let match;
            while ((match = pattern.exec(raw || '')) !== null) {
                const tag = match[1].trim();
                if (tag && !languages.includes(tag)) languages.push(tag);
            }
            const displayTitle = String(raw || '')
                .replace(/\[([^\]]+)\]/g, '')
                .replace(/\bS\d+(?:-S\d+)?\b/gi, '')
                .replace(/\s{2,}/g, ' ')
                .trim();
            return { displayTitle, languages };
        }

        function partyEscapeHtml(value) {
            return String(value || '').replace(/[&<>"']/g, (ch) => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[ch]));
        }

        function languageLabelForItem(item) {
            const parsed = parseCatalogTitle(item.title || '');
            if (parsed.languages.length) return parsed.languages.join(' · ');
            for (const lang of NETFLIX_LANGUAGE_TAGS) {
                const titleLower = String(item.title || '').toLowerCase();
                const channelLower = String(item.channel || '').toLowerCase();
                if (lang.matchLabels.some((label) => {
                    const needle = label.toLowerCase();
                    return titleLower.includes(`[${needle}]`) || channelLower.includes(needle);
                })) {
                    return lang.label;
                }
            }
            return 'Original';
        }

        function partyNfLoaderActive() {
            const loader = document.getElementById('party-nf-loader');
            return Boolean(loader?.classList.contains('is-active'));
        }

        function partyNfEpisodesPanelOpen() {
            const panel = document.getElementById('party-nf-episodes');
            return Boolean(panel && !panel.hidden);
        }

        function partyNfMenusOpen() {
            const shell = document.getElementById('party-nf-watch');
            return Boolean(
                shell?.classList.contains('is-menu-open') ||
                shell?.classList.contains('is-episodes-open') ||
                partyNfEpisodesPanelOpen()
            );
        }

        function partyNfIsPlaying() {
            const video = netflixArt?.video;
            return Boolean(video && !video.paused && !video.ended);
        }

        function clearPartyNfControlsTimer() {
            if (netflixControlsTimer) {
                clearTimeout(netflixControlsTimer);
                netflixControlsTimer = null;
            }
        }

        function hidePartyNfControls() {
            const shell = document.getElementById('party-nf-watch');
            if (!shell) return;
            if (partyNfMenusOpen() || !partyNfIsPlaying() || partyNfLoaderActive()) return;
            shell.classList.add('is-controls-hidden');
        }

        function schedulePartyNfControlsHide() {
            clearPartyNfControlsTimer();
            if (!partyNfIsPlaying() || partyNfMenusOpen() || partyNfLoaderActive()) return;
            netflixControlsTimer = setTimeout(() => {
                netflixControlsTimer = null;
                hidePartyNfControls();
            }, PARTY_NF_CONTROLS_HIDE_MS);
        }

        function revealPartyNfControls() {
            const shell = document.getElementById('party-nf-watch');
            if (!shell) return;
            shell.classList.remove('is-controls-hidden');
            schedulePartyNfControlsHide();
        }

        function setPartyNfMenuOpen(open) {
            const shell = document.getElementById('party-nf-watch');
            if (shell) shell.classList.toggle('is-menu-open', Boolean(open));
            if (open) {
                clearPartyNfControlsTimer();
                if (shell) shell.classList.remove('is-controls-hidden');
                return;
            }
            schedulePartyNfControlsHide();
        }

        function bindPartyNfControlsIdle() {
            if (partyNfControlsIdleBound) return;
            partyNfControlsIdleBound = true;

            const shell = document.getElementById('party-nf-watch');
            if (!shell) return;

            const onActivity = () => revealPartyNfControls();
            shell.addEventListener('mousemove', onActivity);
            shell.addEventListener('touchstart', onActivity, { passive: true });
            shell.addEventListener('pointermove', onActivity);

            document.addEventListener('fullscreenchange', () => {
                revealPartyNfControls();
            });
        }

        function partyExtensionRoots() {
            const roots = [document.documentElement];
            try {
                if (window.parent && window.parent !== window) roots.push(window.parent.document.documentElement);
                if (window.top && window.top !== window) roots.push(window.top.document.documentElement);
            } catch (e) {}
            return roots;
        }

        function refreshPartyExtensionState() {
            partyExtensionActive = partyExtensionRoots().some((root) =>
                root?.getAttribute('data-moovie-ext') === 'active' || root?.dataset?.moovieExt === 'active'
            );
            window.dispatchEvent(new CustomEvent('moovie-ext-ping'));
            try {
                if (window.parent && window.parent !== window) {
                    window.parent.dispatchEvent(new CustomEvent('moovie-ext-ping'));
                }
            } catch (e) {}
            return partyExtensionActive;
        }

        function formatPartyTime(seconds) {
            if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            return `${m}:${String(s).padStart(2, '0')}`;
        }

        function pickDefaultNetflixStreamIndex(streams) {
            if (!streams.length) return 0;
            let best = 0;
            let bestRank = NETFLIX_QUALITY_RANK[streams[0].quality] ?? -1;
            for (let i = 1; i < streams.length; i++) {
                const rank = NETFLIX_QUALITY_RANK[streams[i].quality] ?? -1;
                if (rank > bestRank) {
                    bestRank = rank;
                    best = i;
                }
            }
            return best;
        }

        function setNetflixPartyStage(active) {
            document.body.classList.toggle('netflix-party-active', Boolean(active));
            if (active) {
                document.body.classList.add('cinema-mode');
            }
            const stage = document.querySelector('.player-stage');
            if (stage) stage.classList.toggle('player-stage--netflix', Boolean(active));
        }

        function resetPartyNfVideoContentArea() {
            const content = document.getElementById('party-nf-video-area');
            if (!content) return;
            content.style.width = '';
            content.style.height = '';
        }

        function syncPartyNfVideoContentArea() {
            const viewport = document.querySelector('.party-nf-watch__video');
            const content = document.getElementById('party-nf-video-area');
            const video = netflixArt?.video;
            if (!viewport || !content || !video) {
                resetPartyNfVideoContentArea();
                return;
            }

            const vw = video.videoWidth;
            const vh = video.videoHeight;
            const cw = viewport.clientWidth;
            const ch = viewport.clientHeight;
            if (!vw || !vh || !cw || !ch) {
                resetPartyNfVideoContentArea();
                return;
            }

            const videoRatio = vw / vh;
            const containerRatio = cw / ch;
            let width;
            let height;

            if (videoRatio > containerRatio) {
                width = cw;
                height = cw / videoRatio;
            } else {
                height = ch;
                width = ch * videoRatio;
            }

            content.style.width = `${Math.round(width)}px`;
            content.style.height = `${Math.round(height)}px`;
        }

        function bindPartyNfVideoContentArea() {
            if (partyNfContentResizeObserver) return;
            const viewport = document.querySelector('.party-nf-watch__video');
            if (!viewport || typeof ResizeObserver === 'undefined') return;

            partyNfContentResizeObserver = new ResizeObserver(() => {
                syncPartyNfVideoContentArea();
            });
            partyNfContentResizeObserver.observe(viewport);
            document.addEventListener('fullscreenchange', syncPartyNfVideoContentArea);
        }

        function setPartyNfLoading(active) {
            const loader = document.getElementById('party-nf-loader');
            if (loader) loader.classList.toggle('is-active', Boolean(active));
            if (active) {
                clearPartyNfControlsTimer();
                const shell = document.getElementById('party-nf-watch');
                if (shell) shell.classList.remove('is-controls-hidden');
            } else {
                schedulePartyNfControlsHide();
            }
        }

        function setPartyNfError(message) {
            const el = document.getElementById('party-nf-error');
            if (!el) return;
            if (message) {
                el.textContent = message;
                el.hidden = false;
            } else {
                el.textContent = '';
                el.hidden = true;
            }
        }

        function netflixPlaybackUrl(stream) {
            refreshPartyExtensionState();
            const direct = stream?.url || '';
            const proxied = stream?.proxiedUrl || '';
            const candidate = partyExtensionActive ? direct : (proxied || direct);
            if (!candidate) return '';
            const abs = /^https?:\/\//i.test(candidate)
                ? candidate
                : `${window.location.origin}${candidate.startsWith('/') ? candidate : `/${candidate}`}`;
            const sep = abs.includes('?') ? '&' : '?';
            return `${abs}${sep}_cb=${Date.now()}`;
        }

        function loadArtplayerAssets() {
            if (window.Artplayer) return Promise.resolve();
            return new Promise((resolve, reject) => {
                if (!document.querySelector('link[data-party-art-css]')) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = 'https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.css';
                    link.setAttribute('data-party-art-css', '1');
                    document.head.appendChild(link);
                }
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.min.js';
                script.onload = () => resolve();
                script.onerror = () => reject(new Error('ArtPlayer failed to load'));
                document.head.appendChild(script);
            });
        }

        async function fetchNetflixMeta() {
            const type = (isTv || (isAnime && isNetflix)) ? 'tv' : 'movie';
            const res = await fetch(`/api/moovie-catalog?action=meta&type=${type}&id=${encodeURIComponent(String(mediaId))}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Meta failed (${res.status})`);
            return data.meta || null;
        }

        async function fetchNetflixLanguageVariants(meta) {
            const parsed = parseCatalogTitle(meta?.title || '');
            const displayTitle = parsed.displayTitle;
            if (!displayTitle) return [meta].filter(Boolean);

            const res = await fetch(`/api/moovie-catalog?action=search&q=${encodeURIComponent(displayTitle)}`);
            const data = await res.json();
            const results = data?.results || [];
            const normalized = displayTitle.toLowerCase();
            const variants = results.filter((item) => {
                const itemParsed = parseCatalogTitle(item.title || '');
                return itemParsed.displayTitle.toLowerCase() === normalized;
            });
            if (!variants.length && meta) return [meta];
            const seen = new Set();
            return variants.filter((item) => {
                const id = String(item.id);
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
            });
        }

        async function fetchNetflixResolve() {
            const type = (isTv || (isAnime && isNetflix)) ? 'tv' : 'movie';
            const params = new URLSearchParams({
                action: 'resolve',
                type,
                id: String(mediaId),
                se: String(type === 'tv' ? season : 0),
                ep: String(type === 'tv' ? episode : 0),
                server: '1'
            });
            const res = await fetch(`/api/moovie-catalog?${params.toString()}`);
            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error('Catalogue resolver returned an invalid response.');
            }
            if (!res.ok) throw new Error(data.error || `Resolve failed (${res.status})`);
            if (!data.streams || !data.streams.length) {
                throw new Error('No playable streams were found for this catalogue title.');
            }
            return data;
        }

        function updatePartyNfProgress() {
            const video = netflixArt?.video;
            if (!video) return;
            const current = video.currentTime || 0;
            const total = video.duration || 0;
            const pct = total ? Math.min(100, (current / total) * 100) : 0;
            let bufferPct = 0;
            if (video.buffered.length && total) {
                bufferPct = Math.min(100, (video.buffered.end(video.buffered.length - 1) / total) * 100);
            }
            const fill = document.getElementById('party-nf-progress-fill');
            const buffer = document.getElementById('party-nf-progress-buffer');
            const time = document.getElementById('party-nf-time');
            if (fill) fill.style.width = `${pct}%`;
            if (buffer) buffer.style.width = `${bufferPct}%`;
            if (time) time.textContent = `${formatPartyTime(current)} / ${formatPartyTime(total)}`;
            const playBtn = document.getElementById('party-nf-play');
            if (playBtn) {
                playBtn.innerHTML = video.paused
                    ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'
                    : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
            }
        }

        function populatePartyNfQualityMenu() {
            const menu = document.getElementById('party-nf-quality-menu');
            const label = document.getElementById('party-nf-quality-label');
            const wrap = document.getElementById('party-nf-quality-wrap');
            if (!menu || !wrap) return;
            if (!netflixStreams.length) {
                wrap.hidden = true;
                return;
            }
            wrap.hidden = false;
            menu.innerHTML = netflixStreams.map((stream, index) => `
                <li>
                    <button type="button" class="party-nf-watch__quality-item ${index === netflixStreamIndex ? 'is-active' : ''}" onclick="switchPartyNfQuality(${index})">
                        ${stream.quality || 'Auto'}
                    </button>
                </li>
            `).join('');
            if (label) label.textContent = netflixStreams[netflixStreamIndex]?.quality || 'Quality';
        }

        function populatePartyNfAudioMenu() {
            const menu = document.getElementById('party-nf-audio-menu');
            const label = document.getElementById('party-nf-audio-label');
            const wrap = document.getElementById('party-nf-audio-wrap');
            if (!menu || !wrap) return;

            if (!netflixLanguageVariants.length && netflixCatalogMeta) {
                netflixLanguageVariants = [{
                    id: mediaId,
                    title: netflixCatalogMeta.title || '',
                    channel: netflixCatalogMeta.channel || ''
                }];
            }

            wrap.hidden = false;
            menu.innerHTML = netflixLanguageVariants.map((item) => {
                const active = String(item.id) === String(mediaId);
                const audioLabel = languageLabelForItem(item);
                return `
                    <li>
                        <button type="button" class="party-nf-watch__quality-item ${active ? 'is-active' : ''}" onclick="switchPartyNfAudio('${item.id}')">
                            ${audioLabel}
                        </button>
                    </li>
                `;
            }).join('');

            const current = netflixLanguageVariants.find((item) => String(item.id) === String(mediaId));
            if (label) {
                label.textContent = current ? languageLabelForItem(current) : 'Audio';
            }
        }

        function partyHasEpisodeRail() {
            return isNetflix && (isTv || isAnime || netflixSupportsEpisodes);
        }

        function partySupportsEpisodeControl() {
            if (isNetflix) return partyHasEpisodeRail();
            return isAnime || isTv;
        }

        function updatePartyNfAutoNextButton() {
            const btn = document.getElementById('party-nf-autonext');
            if (!btn) return;
            const show = isHost && partyHasEpisodeRail();
            btn.hidden = !show;
            if (!show) return;
            btn.setAttribute('aria-pressed', partyAutoNext ? 'true' : 'false');
            btn.setAttribute('aria-label', partyAutoNext ? 'AutoNext on' : 'AutoNext off');
        }

        function updatePartyNfEpisodesButton() {
            const btn = document.getElementById('party-nf-episodes-btn');
            if (!btn) return;
            btn.hidden = !(isHost && partyHasEpisodeRail());
        }

        async function fetchPartyTmdb(path) {
            const sep = path.includes('?') ? '&' : '?';
            const res = await fetch(
                `/api/tmdb/3/${path}${sep}api_key=${PARTY_TMDB_API_KEY}&language=en-US`
            );
            if (!res.ok) throw new Error(`TMDB failed (${res.status})`);
            return res.json();
        }

        function partyStillUrl(path) {
            if (!path) return '';
            const clean = path.startsWith('/') ? path : `/${path}`;
            return `/api/img?path=${encodeURIComponent(`/w342${clean}`)}`;
        }

        function partySeasonCacheKey(seasonNum = season) {
            return `${mediaId}-s${seasonNum}`;
        }

        function applyPartyEpisodeTitle(meta) {
            const showTitle = document.getElementById('party-nf-episodes-show');
            if (!showTitle || !meta) return;
            const parsed = parseCatalogTitle(meta.title || '');
            showTitle.textContent = parsed.displayTitle || meta.title || '';
        }

        function setPartyEpisodesLoading(active) {
            netflixEpisodesLoading = Boolean(active);
            const loading = document.getElementById('party-nf-episodes-loading');
            if (loading) loading.hidden = !netflixEpisodesLoading;
        }

        async function resolvePartyTmdbShowId(meta) {
            const parsed = parseCatalogTitle(meta?.title || '');
            const title = parsed.displayTitle;
            if (!title) return null;
            const search = await fetchPartyTmdb(`search/tv?query=${encodeURIComponent(title)}`);
            const results = search?.results || [];
            if (!results.length) return null;
            const normalized = title.toLowerCase();
            const exact = results.find((row) => {
                const names = [row.name, row.original_name].filter(Boolean).map((v) => v.toLowerCase());
                return names.includes(normalized);
            });
            return (exact || results[0]).id;
        }

        function renderPartySeasonSelect() {
            const select = document.getElementById('party-nf-season-select');
            if (!select) return;
            if (!netflixSeasons.length || isAnime) {
                select.hidden = true;
                return;
            }
            select.hidden = false;
            select.innerHTML = netflixSeasons.map((row) => `
                <option value="${row.season_number}" ${row.season_number === partyViewingSeason ? 'selected' : ''}>
                    ${row.name || `Season ${row.season_number}`}${row.episode_count ? ` (${row.episode_count})` : ''}
                </option>
            `).join('');
        }

        const PARTY_EP_PLAYING_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';

        function renderPartyEpisodeList() {
            const list = document.getElementById('party-nf-episodes-list');
            if (!list) return;
            setPartyEpisodesLoading(netflixEpisodesLoading);

            if (!netflixEpisodes.length) {
                list.innerHTML = netflixEpisodesLoading
                    ? ''
                    : '<p class="party-nf-watch__episodes-empty">No episodes found.</p>';
                return;
            }

            list.innerHTML = netflixEpisodes.map((ep) => {
                const active = ep.episode_number === episode && partyViewingSeason === season;
                const thumb = ep.still_path
                    ? `<img src="${partyStillUrl(ep.still_path)}" alt="Episode ${ep.episode_number}" loading="lazy" decoding="async" />`
                    : `<div class="party-nf-watch__episode-thumb-fallback">${ep.episode_number}</div>`;
                const playing = active
                    ? `<span class="party-nf-watch__episode-playing" aria-hidden="true">${PARTY_EP_PLAYING_SVG}</span>`
                    : '';
                return `
                    <button
                        type="button"
                        class="party-nf-watch__episode-card ${active ? 'is-active' : ''}"
                        data-episode="${ep.episode_number}"
                        data-season="${partyViewingSeason}"
                        role="option"
                        aria-selected="${active ? 'true' : 'false'}"
                    >
                        <div class="party-nf-watch__episode-thumb">${thumb}${playing}</div>
                        <div class="party-nf-watch__episode-meta">
                            <span class="party-nf-watch__episode-num">${ep.episode_number}</span>
                            <span class="party-nf-watch__episode-name">${partyEscapeHtml(ep.name || `Episode ${ep.episode_number}`)}</span>
                        </div>
                    </button>
                `;
            }).join('');
        }

        function scrollPartyEpisodeIntoView() {
            const list = document.getElementById('party-nf-episodes-list');
            if (!list) return;
            requestAnimationFrame(() => {
                const active = list.querySelector('.party-nf-watch__episode-card.is-active');
                if (active) {
                    active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    return;
                }
                list.scrollTop = 0;
            });
        }

        async function loadPartySeasonEpisodes(showId, seasonNum, opts = {}) {
            const cacheKey = partySeasonCacheKey(seasonNum);
            if (opts.useCache !== false && partySeasonEpisodesCache.has(cacheKey)) {
                netflixEpisodes = partySeasonEpisodesCache.get(cacheKey);
                renderPartyEpisodeList();
                return;
            }

            const data = await fetchPartyTmdb(`tv/${showId}/season/${seasonNum}`);
            netflixEpisodes = (data?.episodes || []).map((ep) => ({
                episode_number: ep.episode_number,
                name: ep.name || `Episode ${ep.episode_number}`,
                still_path: ep.still_path,
                runtime: ep.runtime
            }));
            partySeasonEpisodesCache.set(cacheKey, netflixEpisodes);
            renderPartyEpisodeList();
        }

        function buildPartyPlaceholderEpisodes(count, startSeason) {
            const safe = Math.max(2, Math.min(count, 48));
            if (!netflixSeasons.length) {
                netflixSeasons = [{
                    season_number: startSeason,
                    name: `Season ${startSeason}`,
                    episode_count: safe
                }];
            }
            netflixEpisodes = Array.from({ length: safe }, (_, index) => ({
                episode_number: index + 1,
                name: `Episode ${index + 1}`
            }));
            netflixSupportsEpisodes = true;
            renderPartySeasonSelect();
            renderPartyEpisodeList();
        }

        function applyPartyEpisodeCache(meta) {
            const cachedShow = partyShowMetaCache.get(String(mediaId));
            if (!cachedShow) return false;

            netflixTmdbShowId = cachedShow.tmdbId;
            netflixSeasons = cachedShow.seasons || [];
            partyViewingSeason = season;

            const cacheKey = partySeasonCacheKey(season);
            if (partySeasonEpisodesCache.has(cacheKey)) {
                netflixEpisodes = partySeasonEpisodesCache.get(cacheKey);
            } else {
                const seasonRow = netflixSeasons.find((row) => row.season_number === season);
                buildPartyPlaceholderEpisodes(seasonRow?.episode_count || 12, season);
            }

            netflixSupportsEpisodes = netflixEpisodes.length > 1 || isTv;
            applyPartyEpisodeTitle(meta);
            renderPartySeasonSelect();
            renderPartyEpisodeList();
            return true;
        }

        function syncPartyEpisodeUi(meta) {
            partyViewingSeason = season;
            netflixSupportsEpisodes = isTv || isAnime;
            applyPartyEpisodeTitle(meta);

            if (!partyHasEpisodeRail()) {
                netflixSeasons = [];
                netflixEpisodes = [];
                renderPartySeasonSelect();
                renderPartyEpisodeList();
                updatePartyNfEpisodesButton();
                updatePartyNfAutoNextButton();
                return;
            }

            if (isAnime) {
                buildPartyPlaceholderEpisodes(Math.max(episode + 12, 24), 1);
            } else if (isTv) {
                if (!applyPartyEpisodeCache(meta)) {
                    buildPartyPlaceholderEpisodes(12, season);
                }
            } else {
                netflixSupportsEpisodes = false;
            }

            updatePartyNfEpisodesButton();
            updatePartyNfAutoNextButton();
        }

        async function fetchPartyShowMeta(meta) {
            const cacheId = String(mediaId);
            if (partyShowMetaCache.has(cacheId)) {
                return partyShowMetaCache.get(cacheId);
            }

            const showId = await resolvePartyTmdbShowId(meta);
            if (!showId) return null;

            const show = await fetchPartyTmdb(`tv/${showId}`);
            const seasons = (show?.seasons || [])
                .filter((row) => row.season_number > 0)
                .map((row) => ({
                    season_number: row.season_number,
                    name: row.name || `Season ${row.season_number}`,
                    episode_count: row.episode_count
                }));

            const payload = { tmdbId: showId, seasons };
            partyShowMetaCache.set(cacheId, payload);
            return payload;
        }

        async function ensurePartySeasonEpisodes(seasonNum) {
            partyViewingSeason = seasonNum;
            renderPartySeasonSelect();

            if (netflixTmdbShowId) {
                const cacheKey = partySeasonCacheKey(seasonNum);
                if (partySeasonEpisodesCache.has(cacheKey)) {
                    netflixEpisodes = partySeasonEpisodesCache.get(cacheKey);
                    renderPartyEpisodeList();
                    return;
                }

                setPartyEpisodesLoading(true);
                try {
                    await loadPartySeasonEpisodes(netflixTmdbShowId, seasonNum, { useCache: false });
                } catch (err) {
                    console.warn('party:season:fail', err);
                    const seasonRow = netflixSeasons.find((row) => row.season_number === seasonNum);
                    buildPartyPlaceholderEpisodes(seasonRow?.episode_count || 12, seasonNum);
                } finally {
                    setPartyEpisodesLoading(false);
                }
                scrollPartyEpisodeIntoView();
                return;
            }

            const seasonRow = netflixSeasons.find((row) => row.season_number === seasonNum);
            buildPartyPlaceholderEpisodes(seasonRow?.episode_count || 12, seasonNum);
            scrollPartyEpisodeIntoView();
        }

        async function upgradePartyEpisodeCatalog(meta) {
            if (!meta || !isTv || isAnime) return;

            const token = ++partyEpisodeUpgradeToken;
            const hadEpisodes = netflixEpisodes.length > 0;

            try {
                const showMeta = await fetchPartyShowMeta(meta);
                if (token !== partyEpisodeUpgradeToken) return;

                if (!showMeta) {
                    if (!hadEpisodes) buildPartyPlaceholderEpisodes(12, season);
                    return;
                }

                netflixTmdbShowId = showMeta.tmdbId;
                netflixSeasons = showMeta.seasons;

                if (!netflixSeasons.length) {
                    if (!hadEpisodes) buildPartyPlaceholderEpisodes(12, season);
                    return;
                }

                const activeSeason = netflixSeasons.some((row) => row.season_number === partyViewingSeason)
                    ? partyViewingSeason
                    : (netflixSeasons.some((row) => row.season_number === season)
                        ? season
                        : netflixSeasons[0].season_number);
                partyViewingSeason = activeSeason;

                const cacheKey = partySeasonCacheKey(activeSeason);
                if (!partySeasonEpisodesCache.has(cacheKey)) {
                    setPartyEpisodesLoading(true);
                    await loadPartySeasonEpisodes(showMeta.tmdbId, activeSeason, { useCache: false });
                    if (token !== partyEpisodeUpgradeToken) return;
                    setPartyEpisodesLoading(false);
                } else {
                    netflixEpisodes = partySeasonEpisodesCache.get(cacheKey);
                }

                netflixSupportsEpisodes = netflixEpisodes.length > 1 || isTv;
                renderPartySeasonSelect();
                renderPartyEpisodeList();
                updatePartyNfEpisodesButton();
                updatePartyNfAutoNextButton();
                scrollPartyEpisodeIntoView();
            } catch (err) {
                if (token !== partyEpisodeUpgradeToken) return;
                console.warn('party:episodes:upgrade:fail', err);
                setPartyEpisodesLoading(false);
                if (!hadEpisodes) buildPartyPlaceholderEpisodes(12, season);
            }
        }

        function bindPartyEpisodesList() {
            if (partyEpisodesListBound) return;
            partyEpisodesListBound = true;
            const list = document.getElementById('party-nf-episodes-list');
            if (!list) return;
            list.addEventListener('click', (e) => {
                const card = e.target.closest('.party-nf-watch__episode-card');
                if (!card || !list.contains(card)) return;
                e.preventDefault();
                e.stopPropagation();
                const epNum = parseInt(card.dataset.episode, 10);
                const seasonNum = parseInt(card.dataset.season, 10);
                if (!Number.isFinite(epNum)) return;
                selectPartyEpisode(epNum, Number.isFinite(seasonNum) ? seasonNum : partyViewingSeason);
            });
        }

        function openPartyEpisodesPanel() {
            if (!isHost) return;
            const panel = document.getElementById('party-nf-episodes');
            const btn = document.getElementById('party-nf-episodes-btn');
            const shell = document.getElementById('party-nf-watch');
            if (!panel) return;
            closePartyNfMenus();
            partyViewingSeason = season;
            panel.hidden = false;
            if (btn) btn.setAttribute('aria-expanded', 'true');
            if (shell) {
                shell.classList.add('is-episodes-open');
                shell.classList.remove('is-controls-hidden');
            }
            clearPartyNfControlsTimer();
            setPartyNfMenuOpen(true);
            renderPartySeasonSelect();
            renderPartyEpisodeList();
            scrollPartyEpisodeIntoView();
            void upgradePartyEpisodeCatalog(netflixCatalogMeta);
        }

        function closePartyEpisodesPanel() {
            const panel = document.getElementById('party-nf-episodes');
            const btn = document.getElementById('party-nf-episodes-btn');
            const shell = document.getElementById('party-nf-watch');
            if (panel) panel.hidden = true;
            if (btn) btn.setAttribute('aria-expanded', 'false');
            if (shell) shell.classList.remove('is-episodes-open');
            setPartyNfMenuOpen(false);
            schedulePartyNfControlsHide();
        }

        function getNextPartyEpisodeTarget() {
            if (!partyHasEpisodeRail()) return null;

            if (netflixEpisodes.length) {
                const maxEpisode = Math.max(...netflixEpisodes.map((ep) => ep.episode_number));
                if (episode < maxEpisode) {
                    return { season, episode: episode + 1 };
                }
                const hasNextSeason = netflixSeasons.some((row) => row.season_number === season + 1);
                if (hasNextSeason) {
                    return { season: season + 1, episode: 1 };
                }
                return null;
            }

            return { season, episode: episode + 1 };
        }

        function onNetflixPartyVideoEnded() {
            if (!partyAutoNext) return;
            const target = getNextPartyEpisodeTarget();
            if (!target) return;

            if (isHost) {
                changePartyEpisode(target.episode, target.season);
                return;
            }

            season = target.season;
            episode = target.episode;
            updateBannerText();
            loadNetflixPartyPlayer();
            appendChatMessage('System', `AutoNext — Episode ${episode}`, 'system');
        }

        function selectPartyEpisode(epNum, seasonNum) {
            if (!isHost) return;
            closePartyEpisodesPanel();
            changePartyEpisode(epNum, seasonNum);
        }

        const PARTY_NF_MUTE_ON_SVG = '<path d="M3 10v4h4l5 5V5L7 10H3zm11 4.17L15.83 14H18v-4h-2.17l1.17-1.17L16.17 8 14 10.17 11.83 8 10 9.83 11.17 11H9v2h2.17L10 14.17 11.83 16 14 13.83 16.17 16 18 14.17 16.83 13H19v-2h-2.17z"/>';
        const PARTY_NF_MUTE_OFF_SVG = '<path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.06c1.48-.74 2.5-2.26 2.5-4.03z"/>';

        function updatePartyNfVolumeUi() {
            const video = netflixArt?.video;
            const slider = document.getElementById('party-nf-volume');
            const icon = document.getElementById('party-nf-mute-icon');
            if (!video || !slider || !icon) return;
            const level = video.muted ? 0 : video.volume;
            slider.value = String(level);
            icon.innerHTML = video.muted || level === 0 ? PARTY_NF_MUTE_ON_SVG : PARTY_NF_MUTE_OFF_SVG;
        }

        function setPartyNfVolumePop(open) {
            const pop = document.getElementById('party-nf-volume-pop');
            const btn = document.getElementById('party-nf-mute');
            if (!pop || !btn) return;
            pop.hidden = !open;
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            const audioMenu = document.getElementById('party-nf-audio-menu');
            const qualityMenu = document.getElementById('party-nf-quality-menu');
            const menuOpen =
                open ||
                (audioMenu && !audioMenu.hidden) ||
                (qualityMenu && !qualityMenu.hidden);
            setPartyNfMenuOpen(menuOpen);
        }

        function closePartyNfMenus() {
            const audioMenu = document.getElementById('party-nf-audio-menu');
            const qualityMenu = document.getElementById('party-nf-quality-menu');
            if (audioMenu) audioMenu.hidden = true;
            if (qualityMenu) qualityMenu.hidden = true;
            setPartyNfVolumePop(false);
            setPartyNfMenuOpen(false);
        }

        function bindPartyNfButton(el, handler) {
            if (!el) return;
            let lastAt = 0;
            const run = (e) => {
                const now = Date.now();
                if (now - lastAt < 280) return;
                lastAt = now;
                e.preventDefault();
                e.stopPropagation();
                revealPartyNfControls();
                handler(e);
            };
            el.addEventListener('pointerup', run);
        }

        function bindPartyNfUi() {
            if (partyNfUiBound) return;
            partyNfUiBound = true;
            bindPartyEpisodesList();
            bindPartyNfControlsIdle();
            bindPartyNfVideoContentArea();

            const progress = document.getElementById('party-nf-progress');
            const playBtn = document.getElementById('party-nf-play');
            const rewindBtn = document.getElementById('party-nf-rewind');
            const muteBtn = document.getElementById('party-nf-mute');
            const volumeSlider = document.getElementById('party-nf-volume');
            const tapLayer = document.getElementById('party-nf-tap');
            const fsBtn = document.getElementById('party-nf-fullscreen');
            const qualityBtn = document.getElementById('party-nf-quality-btn');
            const audioBtn = document.getElementById('party-nf-audio-btn');
            const autoNextBtn = document.getElementById('party-nf-autonext');
            const inviteBtn = document.getElementById('party-nf-invite-btn');
            const episodesBtn = document.getElementById('party-nf-episodes-btn');
            const episodesBackdrop = document.getElementById('party-nf-episodes-backdrop');
            const episodesClose = document.getElementById('party-nf-episodes-close');
            const seasonSelect = document.getElementById('party-nf-season-select');
            const controls = document.getElementById('party-nf-controls');
            const shell = document.getElementById('party-nf-watch');

            if (progress) {
                const seekAt = (clientX) => {
                    const video = netflixArt?.video;
                    if (!video || !video.duration) return;
                    const rect = progress.getBoundingClientRect();
                    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
                    video.currentTime = ratio * video.duration;
                    updatePartyNfProgress();
                };
                bindPartyNfButton(progress, (e) => seekAt(e.clientX));
            }

            bindPartyNfButton(playBtn, () => netflixArt?.toggle());
            bindPartyNfButton(rewindBtn, () => {
                const video = netflixArt?.video;
                if (video) video.currentTime = Math.max(0, (video.currentTime || 0) - 10);
            });

            bindPartyNfButton(muteBtn, () => {
                const pop = document.getElementById('party-nf-volume-pop');
                const video = netflixArt?.video;
                if (!video) return;
                if (pop?.hidden) {
                    setPartyNfVolumePop(true);
                    return;
                }
                video.muted = !video.muted;
                if (!video.muted && video.volume === 0) video.volume = 0.75;
                updatePartyNfVolumeUi();
            });

            if (volumeSlider) {
                volumeSlider.addEventListener('input', () => {
                    revealPartyNfControls();
                    const video = netflixArt?.video;
                    if (!video) return;
                    const level = Math.min(1, Math.max(0, Number(volumeSlider.value) || 0));
                    video.volume = level;
                    video.muted = level === 0;
                    updatePartyNfVolumeUi();
                });
                volumeSlider.addEventListener('pointerdown', (e) => {
                    revealPartyNfControls();
                    e.stopPropagation();
                });
            }

            bindPartyNfButton(tapLayer, () => {
                revealPartyNfControls();
                netflixArt?.toggle();
            });

            bindPartyNfButton(fsBtn, async () => {
                if (!shell) return;
                if (!document.fullscreenElement) await shell.requestFullscreen?.();
                else await document.exitFullscreen?.();
            });

            bindPartyNfButton(qualityBtn, () => {
                const menu = document.getElementById('party-nf-quality-menu');
                const audioMenu = document.getElementById('party-nf-audio-menu');
                if (audioMenu) audioMenu.hidden = true;
                setPartyNfVolumePop(false);
                if (menu) {
                    menu.hidden = !menu.hidden;
                    setPartyNfMenuOpen(!menu.hidden);
                }
            });

            bindPartyNfButton(audioBtn, () => {
                const menu = document.getElementById('party-nf-audio-menu');
                const qualityMenu = document.getElementById('party-nf-quality-menu');
                if (qualityMenu) qualityMenu.hidden = true;
                setPartyNfVolumePop(false);
                if (menu) {
                    menu.hidden = !menu.hidden;
                    setPartyNfMenuOpen(!menu.hidden);
                }
            });

            bindPartyNfButton(autoNextBtn, () => {
                togglePartyAutoNext();
                updatePartyNfAutoNextButton();
            });

            bindPartyNfButton(inviteBtn, () => copyShareLink('party-nf-invite-btn'));

            bindPartyNfButton(episodesBtn, () => {
                const panel = document.getElementById('party-nf-episodes');
                if (panel && !panel.hidden) closePartyEpisodesPanel();
                else openPartyEpisodesPanel();
            });

            bindPartyNfButton(episodesBackdrop, () => closePartyEpisodesPanel());
            bindPartyNfButton(episodesClose, () => closePartyEpisodesPanel());

            if (seasonSelect) {
                seasonSelect.addEventListener('change', () => {
                    const nextSeason = parseInt(seasonSelect.value, 10);
                    if (!Number.isFinite(nextSeason) || nextSeason === partyViewingSeason) return;
                    void ensurePartySeasonEpisodes(nextSeason);
                });
            }

            const episodesRoot = document.getElementById('party-nf-episodes');
            if (episodesRoot) {
                episodesRoot.addEventListener('pointerdown', (e) => e.stopPropagation());
                episodesRoot.addEventListener('pointerup', (e) => e.stopPropagation());
            }

            document.addEventListener('pointerup', (e) => {
                const target = e.target;
                if (!target || !target.closest) return;
                if (target.closest('#party-nf-controls, #party-nf-episodes')) return;
                closePartyNfMenus();
                closePartyEpisodesPanel();
            });

            if (controls) {
                controls.addEventListener('pointerdown', (e) => e.stopPropagation());
                controls.addEventListener('pointerup', (e) => e.stopPropagation());
            }
        }

        async function mountPartyNetflixPlayer(stream, resume = {}) {
            await loadArtplayerAssets();
            const container = document.getElementById('party-native-player');
            if (!container) throw new Error('Player container missing');

            if (netflixArt) {
                try { netflixArt.destroy(false); } catch (e) {}
                netflixArt = null;
            }
            container.innerHTML = '';

            const playUrl = netflixPlaybackUrl(stream);
            if (!playUrl) throw new Error('Stream URL unavailable.');

            const resumeAt = Number(resume.resumeAt) || 0;
            const resumePlaying = resume.resumePlaying !== false;

            netflixArt = new Artplayer({
                container,
                url: playUrl,
                type: 'mp4',
                autoplay: resumePlaying,
                preload: 'auto',
                theme: '#4eb5ff',
                autoSize: false,
                autoMini: false,
                pip: false,
                fullscreen: false,
                fullscreenWeb: false,
                playbackRate: false,
                aspectRatio: false,
                setting: false,
                miniProgressBar: false,
                fastForward: false,
                hotkey: false,
                clickPause: false,
                controls: []
            });

            const applyResume = () => {
                const video = netflixArt?.video;
                if (!video) return;
                if (resumeAt > 0) {
                    video.currentTime = resumeAt;
                }
                if (!resumePlaying) {
                    netflixArt.pause();
                }
            };

            const syncProgress = () => {
                updatePartyNfProgress();
                updatePartyNfVolumeUi();
            };
            netflixArt.on('video:timeupdate', syncProgress);
            netflixArt.on('video:loadedmetadata', () => {
                setPartyNfError('');
                applyResume();
                syncProgress();
                syncPartyNfVideoContentArea();
                revealPartyNfControls();
            });
            netflixArt.on('video:canplay', () => {
                applyResume();
                syncPartyNfVideoContentArea();
            });
            netflixArt.on('resize', syncPartyNfVideoContentArea);
            netflixArt.on('video:play', () => {
                syncProgress();
                revealPartyNfControls();
            });
            netflixArt.on('video:pause', () => {
                syncProgress();
                clearPartyNfControlsTimer();
                const shell = document.getElementById('party-nf-watch');
                if (shell) shell.classList.remove('is-controls-hidden');
            });
            netflixArt.on('error', () => {
                setPartyNfError(
                    partyExtensionActive
                        ? 'Playback failed — try another quality.'
                        : 'Playback failed. Install the Moovie extension and reload the party room.'
                );
            });
            netflixArt.on('video:ended', onNetflixPartyVideoEnded);

            if (netflixUiTimer) clearInterval(netflixUiTimer);
            netflixUiTimer = setInterval(syncProgress, 500);
        }

        function switchPartyNfQuality(index) {
            if (!netflixStreams[index]) return;
            const video = netflixArt?.video;
            const resume = {
                resumeAt: video?.currentTime || 0,
                resumePlaying: video ? !video.paused : true
            };
            netflixStreamIndex = index;
            populatePartyNfQualityMenu();
            closePartyNfMenus();
            mountPartyNetflixPlayer(netflixStreams[index], resume).catch((err) => {
                setPartyNfError(err.message || 'Could not switch quality.');
            });
        }
        window.switchPartyNfQuality = switchPartyNfQuality;

        function switchPartyNfAudio(variantId) {
            if (!variantId || String(variantId) === String(mediaId)) {
                closePartyNfMenus();
                return;
            }
            const video = netflixArt?.video;
            const resume = {
                resumeAt: video?.currentTime || 0,
                resumePlaying: video ? !video.paused : true
            };
            mediaId = String(variantId);
            closePartyNfMenus();
            loadNetflixPartyPlayer({ resume }).catch((err) => {
                setPartyNfError(err.message || 'Could not switch audio.');
            });
        }
        window.switchPartyNfAudio = switchPartyNfAudio;

        function destroyNetflixPlayer() {
            setNetflixPartyStage(false);
            resetPartyNfVideoContentArea();
            setPartyNfLoading(false);
            setPartyNfError('');
            if (netflixUiTimer) {
                clearInterval(netflixUiTimer);
                netflixUiTimer = null;
            }
            clearPartyNfControlsTimer();
            const shell = document.getElementById('party-nf-watch');
            if (shell) shell.classList.remove('is-controls-hidden');
            if (netflixArt) {
                try { netflixArt.destroy(false); } catch (e) {}
                netflixArt = null;
            }
            netflixStreams = [];
            netflixStreamIndex = 0;
            closePartyEpisodesPanel();
            const container = document.getElementById('party-native-player');
            if (container) container.innerHTML = '';
        }

        async function loadNetflixPartyPlayer(opts = {}) {
            const iframe = document.getElementById('video-player-iframe');
            const nativeStage = document.getElementById('party-native-stage');
            if (iframe) {
                iframe.style.display = 'none';
                iframe.src = '';
            }
            if (nativeStage) nativeStage.style.display = 'block';
            setNetflixPartyStage(true);
            setPartyNfLoading(true);
            setPartyNfError('');
            refreshPartyExtensionState();
            bindPartyNfUi();
            revealPartyNfControls();

            try {
                const [resolved, meta] = await Promise.all([
                    fetchNetflixResolve(),
                    fetchNetflixMeta().catch(() => null)
                ]);
                netflixCatalogMeta = meta;
                if (meta) {
                    netflixLanguageVariants = await fetchNetflixLanguageVariants(meta);
                } else {
                    netflixLanguageVariants = [];
                }
                netflixStreams = resolved.streams || [];
                netflixStreamIndex = pickDefaultNetflixStreamIndex(netflixStreams);
                await mountPartyNetflixPlayer(
                    netflixStreams[netflixStreamIndex],
                    opts.resume || {}
                );
                populatePartyNfQualityMenu();
                populatePartyNfAudioMenu();
                syncPartyEpisodeUi(meta);
                updatePartyNfAutoNextButton();
                updatePartyNfEpisodesButton();
                updatePartyNfInviteButton();
                revealPartyNfControls();
                if (resolved.streamWarning) {
                    appendChatMessage('System', resolved.streamWarning, 'system');
                }
            } catch (err) {
                console.error('Netflix party playback failed:', err);
                destroyNetflixPlayer();
                if (nativeStage) nativeStage.style.display = 'block';
                setPartyNfError(err.message || 'Could not start Netflix playback.');
                appendChatMessage('System', err.message || 'Could not start Netflix playback.', 'system');
            } finally {
                setPartyNfLoading(false);
            }
        }

        // Available Stream Servers
        const serversList = [
            { id: 'rasmalai', name: 'Rasmalai', movie: 'https://peachify.top/embed/movie/{tmdbId}', tv: 'https://peachify.top/embed/tv/{tmdbId}/{season}/{episode}' },
            { id: 'cinemaos', name: 'Gulab Jamun', movie: 'https://cinemaos.live/player/{tmdbId}', tv: 'https://cinemaos.live/player/{tmdbId}/{season}/{episode}' },
            { id: 'smashy', name: 'Jalebi', movie: 'https://player.smashystream.com/movie/{tmdbId}?autoplay=true', tv: 'https://player.smashystream.com/tv/{tmdbId}?s={season}&e={episode}' },
            { id: 'mappletv', name: 'Kaju Katli', movie: 'https://mappletv.uk/watch/movie/{tmdbId}', tv: 'https://mappletv.uk/watch/tv/{tmdbId}/{season}/{episode}' },
            { id: 'vidking', name: 'Kheer', movie: 'https://www.vidking.net/embed/movie/{tmdbId}?autoPlay=true', tv: 'https://www.vidking.net/embed/tv/{tmdbId}/{season}/{episode}?autoPlay=true&nextEpisode=true&episodeSelector=true' },
            { id: 'videasy', name: 'Barfi', movie: 'https://player.videasy.net/movie/{tmdbId}?color=#4eb5ff', tv: 'https://player.videasy.net/tv/{tmdbId}/{season}/{episode}?color=#4eb5ff&nextEpisode=true&autoplayNextEpisode=true&episodeSelector=true' },
            { id: 'vidsrc_ru', name: 'Laddu', movie: 'https://vidsrc-embed.ru/embed/movie/{tmdbId}', tv: 'https://vidsrc-embed.ru/embed/tv/{tmdbId}/{season}/{episode}' },
            { id: 'vidsrc_su', name: 'Peda', movie: 'https://vidsrc-embed.su/embed/movie/{tmdbId}', tv: 'https://vidsrc-embed.su/embed/tv/{tmdbId}/{season}/{episode}' },
            { id: 'vidsrcme', name: 'Gajar Ka Halwa', movie: 'https://vidsrcme.su/embed/movie/{tmdbId}', tv: 'https://vidsrcme.su/embed/tv/{tmdbId}/{season}/{episode}' },
            { id: 'multiembed', name: 'Soan Papdi', movie: 'https://multiembed.mov/?video_id={tmdbId}&tmdb=1', tv: 'https://multiembed.mov/?video_id={tmdbId}&tmdb=1&s={season}&e={episode}' },
            { id: 'vsrc', name: 'Sandesh', movie: 'https://vsrc.su/embed/movie/{tmdbId}', tv: 'https://vsrc.su/embed/tv/{tmdbId}/{season}/{episode}' },
            { id: 'vidlink', name: 'Cham Cham', movie: 'https://vidlink.pro/movie/{tmdbId}', tv: 'https://vidlink.pro/tv/{tmdbId}/{season}/{episode}' },
            { id: 'autoembed', name: 'Kulfi', movie: 'https://player.autoembed.app/embed/movie/{tmdbId}', tv: 'https://player.autoembed.app/embed/tv/{tmdbId}/{season}/{episode}' },
            { id: 'vidfast', name: 'Mysore Pak', movie: 'https://vidfast.pro/movie/{tmdbId}', tv: 'https://vidfast.pro/tv/{tmdbId}/{season}/{episode}' },
            { id: 'movies111', name: 'Imarti', movie: 'https://111movies.com/movie/{tmdbId}', tv: 'https://111movies.com/tv/{tmdbId}/{season}/{episode}' },
            { id: 'vidora', name: 'Ghevar', movie: 'https://vidora.su/movie/{tmdbId}?parameters', tv: 'https://vidora.su/tv/{tmdbId}/{season}/{episode}?autoplay=true' }
        ];

        let activeProvider = 'rasmalai';
        let partyBufferingTimer = null;

        // Session Setup
        let currentUserName = safeLocalStorage.getItem('movora_username');
        if (!currentUserName) {
            const funnyPrefixes = [
                'butter', 'bread', 'popcorn', 'jelly', 'cheese', 'chilli', 'garlic', 'honey',
                'maple', 'cream', 'peanut', 'banana', 'coconut', 'potato', 'cookie', 'waffle',
                'tomato', 'onion', 'pepper', 'ginger', 'lemon', 'berry', 'apple', 'grape'
            ];
            const funnySuffixes = [
                'sauce', 'jam', 'butter', 'bean', 'ball', 'paste', 'dip', 'glaze',
                'syrup', 'cheese', 'shake', 'toast', 'crunch', 'whip', 'cake', 'fry',
                'soup', 'juice', 'tart', 'pie', 'cookie', 'bread', 'oil', 'salt'
            ];
            const randomPrefix = funnyPrefixes[Math.floor(Math.random() * funnyPrefixes.length)];
            const randomSuffix = funnySuffixes[Math.floor(Math.random() * funnySuffixes.length)];
            currentUserName = randomPrefix + randomSuffix;
        }

        // Initialize Supabase Client
        const supabaseClient = supabase.createClient(defaultUrl, defaultKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVleWlyYWd0eWxvdGl3b3piZ3FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzAyNzYsImV4cCI6MjA5NDk0NjI3Nn0.YB_alc7kt5l09eTfNH0x5q-ayBx-dHS1qE-yzHbRTFg');

        // Application State variables
        let activeRoom = null;
        let channel = null;
        let isHost = false;
        let lobbyChannels = [];

        // Update Header user badge
        function updateHeaderBadge() {
            const container = document.getElementById('header-user');
            container.innerHTML = `
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span class="watching-as-badge" style="font-size: 0.875rem; color: var(--bone-200);">👤 Watching as <strong>${currentUserName}</strong></span>
                    <button class="btn btn-secondary" style="padding: 0.4rem 0.85rem; font-size:0.75rem;" onclick="changeNickname()">Rename</button>
                </div>
            `;
            document.getElementById('chat-my-name').textContent = currentUserName;
        }

        function changeNickname() {
            const next = prompt('Enter a new display name:', currentUserName);
            if (next && next.trim()) {
                currentUserName = next.trim();
                safeLocalStorage.setItem('movora_username', currentUserName);
                updateHeaderBadge();
                if (isHost && activeRoom?.id) markAsPartyHost(activeRoom.id);
                if (channel) {
                    channel.track({ user: currentUserName, joinedAt: new Date().toISOString(), isHost: isHost });
                }
            }
        }

        // View Toggling
        function showLobbyView() {
            // Cancel Cinema Mode & active view height locks
            document.body.classList.remove('room-view-active');
            document.body.classList.remove('cinema-mode');

            
            const iframe = document.getElementById('video-player-iframe');
            if (iframe) {
                iframe.src = '';
                iframe.style.display = 'block';
            }
            const nativeStage = document.getElementById('party-native-stage');
            if (nativeStage) nativeStage.style.display = 'none';
            destroyNetflixPlayer();

            // Disconnect from realtime channel
            if (channel) {
                supabaseClient.removeChannel(channel);
                channel = null;
            }

            // Reset room state
            activeRoom = null;
            isHost = false;

            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById('lobby-view').classList.add('active');
            window.history.pushState({}, '', window.location.pathname);
            loadActiveRooms();
        }

        function showCreateView(title = '', embedUrl = '') {
            if (lobbyChannels && lobbyChannels.length) {
                lobbyChannels.forEach(c => supabaseClient.removeChannel(c));
                lobbyChannels = [];
            }
            document.body.classList.remove('room-view-active');
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            
            document.getElementById('form-room-name').value = `${currentUserName}'s Watch Lounge`;
            document.getElementById('form-movie-title').value = title;
            document.getElementById('form-embed-url').value = embedUrl;
            
            document.getElementById('create-view').classList.add('active');
        }

        async function resolvePartyAnilistId(rawId) {
            const numeric = Number.parseInt(String(rawId), 10);
            if (!Number.isFinite(numeric) || numeric <= 0) return String(rawId);

            try {
                const res = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: 'query ($id: Int) { Media(id: $id, type: ANIME) { id } }',
                        variables: { id: numeric }
                    })
                });
                const json = await res.json();
                const anilistId = json?.data?.Media?.id;
                if (anilistId) return String(anilistId);
            } catch (err) {
                console.warn('party:anilist:lookup:fail', err);
            }

            try {
                const tmdbRes = await fetch(
                    `/api/tmdb/3/tv/${numeric}?api_key=${PARTY_TMDB_API_KEY}&language=en-US`
                );
                if (!tmdbRes.ok) return String(rawId);
                const show = await tmdbRes.json();
                const searchTitle = show?.name || show?.original_name;
                if (!searchTitle) return String(rawId);

                const searchRes = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: `query ($search: String) {
                          Page(page: 1, perPage: 5) {
                            media(search: $search, type: ANIME, format_in: [TV, ONA, SPECIAL, MOVIE]) {
                              id
                              title { romaji english native }
                            }
                          }
                        }`,
                        variables: { search: searchTitle }
                    })
                });
                const searchJson = await searchRes.json();
                const results = searchJson?.data?.Page?.media || [];
                const normalized = searchTitle.toLowerCase();
                const exact = results.find((row) => {
                    const titles = [row.title?.english, row.title?.romaji, row.title?.native]
                        .filter(Boolean)
                        .map((v) => v.toLowerCase());
                    return titles.includes(normalized);
                });
                const match = exact || results[0];
                if (match?.id) return String(match.id);
            } catch (err) {
                console.warn('party:anilist:resolve:tmdb:fail', err);
            }

            return String(rawId);
        }

        async function showRoomView(room) {
            if (lobbyChannels && lobbyChannels.length) {
                lobbyChannels.forEach(c => supabaseClient.removeChannel(c));
                lobbyChannels = [];
            }
            document.body.classList.add('room-view-active');
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById('room-view').classList.add('active');
            
            // Resolve media params and URLs first
            parseMediaParams(room.embed_sources);

            if (isAnime && !isNetflix) {
                const resolvedAnilistId = await resolvePartyAnilistId(mediaId);
                if (resolvedAnilistId && resolvedAnilistId !== String(mediaId)) {
                    mediaId = resolvedAnilistId;
                }
            }

            document.body.classList.add('cinema-mode');

            // Update Banner details
            updateBannerText();
            
            if (isNetflix) {
                await loadNetflixPartyPlayer();
            } else {
                const nativeStage = document.getElementById('party-native-stage');
                if (nativeStage) nativeStage.style.display = 'none';
                const iframe = document.getElementById('video-player-iframe');
                if (iframe) iframe.style.display = 'block';
                destroyNetflixPlayer();

                populateServerDropdown();

                if (isAnime) {
                    activeProvider = 'animeplay_sub';
                } else {
                    try {
                        const { data, error } = await supabaseClient
                            .from('app_settings')
                            .select('value')
                            .eq('key', 'default_provider')
                            .single();
                        if (data && data.value) {
                            const matched = serversList.find(s => s.id === data.value.toLowerCase());
                            if (matched) {
                                activeProvider = data.value.toLowerCase();
                            } else {
                                activeProvider = 'rasmalai';
                            }
                        } else {
                            activeProvider = 'rasmalai';
                        }
                    } catch (e) {
                        console.warn('Failed to fetch default provider, using rasmalai:', e);
                        activeProvider = 'rasmalai';
                    }
                }
                switchStreamProvider(activeProvider);
            }

            // Update URL to the shareable room short code link
            const displayId = uuidToShortCode(room.id) || room.id;
            window.history.pushState({}, '', `?room=${displayId}`);
            
            // Connect to real-time chat & presence channel
            connectToRealtimeRoom(room);
            
            // Update Controls visibility
            updateControlsVisibility();
        }

        // Dropdown toggle logic
        function toggleServerDropdown(e) {
            e.stopPropagation();
            document.getElementById('server-dropdown-menu').classList.toggle('active');
        }

        window.addEventListener('click', () => {
            const menu = document.getElementById('server-dropdown-menu');
            if (menu) menu.classList.remove('active');
            const nfMenu = document.getElementById('party-netflix-quality-menu');
            if (nfMenu) nfMenu.classList.remove('active');
        });

        function populateServerDropdown() {
            const menu = document.getElementById('server-dropdown-menu');
            if (isAnime) {
                const animeServers = [
                    { id: 'videasy', name: 'Barfi (Sub/Dub)' },
                    { id: 'animeplay_sub', name: 'Shrikhand (Sub)' },
                    { id: 'animeplay_dub', name: 'Shrikhand (Dub)' },
                    { id: 'megaplay_sub', name: 'Rabri (Sub)' },
                    { id: 'megaplay_dub', name: 'Rabri (Dub)' }
                ];
                menu.innerHTML = animeServers.map(srv => `
                    <button class="server-dropdown-item ${srv.id === activeProvider ? 'active' : ''}" onclick="switchStreamProvider('${srv.id}')">
                        ${srv.name}
                    </button>
                `).join('');
                return;
            }
            menu.innerHTML = serversList.map(srv => {
                const tooltip = srv.id === 'cinemaos' ? ` title="Gulab Jamun - If server does not load or takes time, click on gear icon - select server - and choose ultrafast"` : ` title="${srv.name}"`;
                return `
                <button class="server-dropdown-item ${srv.id === activeProvider ? 'active' : ''}"${tooltip} onclick="switchStreamProvider('${srv.id}')">
                    ${srv.name}
                </button>
            `}).join('');
        }

        function showEmbedPlayer(embedUrl) {
            const oldIframe = document.getElementById('video-player-iframe');
            if (oldIframe) {
                const parent = oldIframe.parentNode;
                const newIframe = document.createElement('iframe');
                newIframe.id = 'video-player-iframe';
                newIframe.className = oldIframe.className;
                newIframe.style.display = 'block';
                newIframe.allowFullscreen = true;

                const lowerUrl = embedUrl.toLowerCase();
                const isAnimeplay = lowerUrl.includes('animeplay.cfd') || lowerUrl.includes('megaplay.buzz');
                newIframe.setAttribute(
                    'allow',
                    isAnimeplay
                        ? 'autoplay; fullscreen; picture-in-picture'
                        : 'autoplay; fullscreen; encrypted-media; picture-in-picture'
                );
                if (isAnimeplay) {
                    newIframe.referrerPolicy = 'origin';
                }
                if (
                    lowerUrl.includes('cinemaos.live') ||
                    lowerUrl.includes('smashystream.com')
                ) {
                    newIframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-presentation');
                }

                newIframe.src = embedUrl;
                parent.replaceChild(newIframe, oldIframe);

                // Add server tip overlay for CinemaOS
                let existingTip = parent.querySelector('.party-server-tip');
                if (existingTip) existingTip.remove();
                
                if (lowerUrl.includes('cinemaos.live')) {
                    const tip = document.createElement('div');
                    tip.className = 'party-server-tip';
                    let secondsLeft = 15;
                    
                    const renderTip = () => {
                        tip.innerHTML = `<p>If server does not load or takes time, click on gear icon <span>&rarr;</span> select server <span>&rarr;</span> choose <strong>ultrafast</strong>. <span style="color: var(--ember); margin-left: 0.35rem; font-weight: 700; font-variant-numeric: tabular-nums;">(${secondsLeft}s)</span></p>`;
                    };
                    
                    renderTip();
                    parent.appendChild(tip);
                    
                    const interval = setInterval(() => {
                        secondsLeft--;
                        if (secondsLeft >= 0 && tip.parentNode) {
                            renderTip();
                        }
                    }, 1000);
                    
                    setTimeout(() => {
                        if (tip.parentNode) {
                            tip.classList.add('fade-out');
                            clearInterval(interval);
                            setTimeout(() => tip.remove(), 600);
                        }
                    }, 15000);
                }
            }
        }

        function getEmbedUrlForServer(srv, mediaIdForEmbed, isTvShow, s, e) {
            if (isAnime) {
                const anilistId = mediaIdForEmbed;
                if (activeProvider === 'videasy') {
                    const isAnimeMovie = !activeRoom?.embed_sources?.includes('_ep');
                    return isAnimeMovie
                        ? `https://player.videasy.net/anime/${anilistId}?color=E05A47&autoplayNextEpisode=true&overlay=true`
                        : `https://player.videasy.net/anime/${anilistId}/${e}?color=E05A47&autoplayNextEpisode=true&overlay=true`;
                }
                const lang = (activeProvider === 'animeplay_dub' || activeProvider === 'megaplay_dub') ? 'dub' : 'sub';
                const domain = (activeProvider === 'megaplay_sub' || activeProvider === 'megaplay_dub') ? 'https://megaplay.buzz' : 'https://animeplay.cfd';
                return `${domain}/stream/ani/${anilistId}/${e}/${lang}`;
            }
            let template = isTvShow ? srv.tv : srv.movie;
            return template
                .replaceAll('{tmdbId}', mediaIdForEmbed)
                .replaceAll('{season}', s)
                .replaceAll('{episode}', e);
        }

        // Switch stream server locally
        function switchStreamProvider(providerId) {
            activeProvider = providerId;

            // Update trigger active text
            if (isAnime) {
                const matchedName = providerId === 'videasy' ? 'Barfi (Sub/Dub)' : (
                    providerId === 'animeplay_dub' ? 'Shrikhand (Dub)' : (
                        providerId === 'megaplay_sub' ? 'Rabri (Sub)' : (
                            providerId === 'megaplay_dub' ? 'Rabri (Dub)' : 'Shrikhand (Sub)'
                        )
                    )
                );
                document.getElementById('active-server-name').textContent = matchedName;
                populateServerDropdown();

                showEmbedPlayer(getEmbedUrlForServer(null, mediaId, false, 1, episode));
                return;
            }

            const matched = serversList.find(s => s.id === providerId);
            if (matched) {
                document.getElementById('active-server-name').textContent = matched.name;
            }

            populateServerDropdown();

            if (matched) {
                const embedUrl = getEmbedUrlForServer(matched, mediaId, isTv, season, episode);
                
                    showEmbedPlayer(embedUrl);
                
            }
        }

        // Cinema Mode toggler
        function toggleCinemaMode() {
            document.body.classList.toggle('cinema-mode');
        }

        // Direct Stream Downloader


        // Watch Together Controls Helper methods
        let partyAutoNext = true;

        function togglePartyAutoNext() {
            partyAutoNext = !partyAutoNext;
            const dot = document.querySelector('#party-auto-next-btn .indicator-dot');
            const btn = document.getElementById('party-auto-next-btn');
            if (partyAutoNext) {
                if (dot) {
                    dot.style.background = 'var(--violet)';
                    dot.style.boxShadow = '0 0 6px var(--violet)';
                }
                if (btn) btn.style.borderColor = 'rgba(139, 92, 246, 0.4)';
            } else {
                if (dot) {
                    dot.style.background = '#6b7280';
                    dot.style.boxShadow = 'none';
                }
                if (btn) btn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            }
            updatePartyNfAutoNextButton();
        }

        function handlePrevEpisode() {
            if (!isHost) return;
            if (episode > 1) {
                changePartyEpisode(episode - 1);
            }
        }

        function handleNextEpisode() {
            if (!isHost) return;
            const target = getNextPartyEpisodeTarget();
            if (!target) return;
            changePartyEpisode(target.episode, target.season);
        }

        function updatePartyEpNavButtons() {
            const showNav = isHost && partySupportsEpisodeControl();
            const epLabel = isTv && season > 1
                ? `S${season}·${episode}`
                : `Ep ${episode}`;
            const hasNext = Boolean(getNextPartyEpisodeTarget());

            document.querySelectorAll('.party-ep-nav').forEach((nav) => {
                nav.hidden = !showNav;
            });
            document.querySelectorAll('.party-ep-nav__btn--prev').forEach((btn) => {
                btn.disabled = episode <= 1;
            });
            document.querySelectorAll('.party-ep-nav__btn--next').forEach((btn) => {
                btn.disabled = !hasNext;
            });
            document.querySelectorAll('.party-ep-nav__label').forEach((label) => {
                label.textContent = epLabel;
            });
        }

        function bindPartyEpNavButtons() {
            document.querySelectorAll('.party-ep-nav__btn--prev').forEach((btn) => {
                bindPartyNfButton(btn, () => handlePrevEpisode());
            });
            document.querySelectorAll('.party-ep-nav__btn--next').forEach((btn) => {
                bindPartyNfButton(btn, () => handleNextEpisode());
            });
        }

        function changePartyEpisode(nextEp, nextSeason = null) {
            if (nextSeason != null && Number.isFinite(nextSeason)) {
                season = nextSeason;
            }
            episode = nextEp;
            partyViewingSeason = season;
            
            // Update UI Banner Text
            updateBannerText();
            updatePartyEpNavButtons();

            if (isNetflix) {
                loadNetflixPartyPlayer();
            } else {
                switchStreamProvider(activeProvider);
            }

            // 2. Update Supabase rooms record for late joiners
            if (isHost && activeRoom) {
                let nextSource;
                if (isNetflix) {
                    if (isAnime) nextSource = `nf_anime_${mediaId}_ep${episode}`;
                    else if (isTv) nextSource = `nf_${mediaId}_s${season}e${episode}`;
                    else nextSource = `nf_${mediaId}`;
                } else if (isAnime) {
                    nextSource = `anime_${mediaId}_ep${episode}`;
                } else if (isTv) {
                    nextSource = `${mediaId}_s${season}e${episode}`;
                } else {
                    nextSource = String(mediaId);
                }
                supabaseClient
                    .from('rooms')
                    .update({ embed_sources: nextSource })
                    .eq('id', activeRoom.id)
                    .then(() => {});
            }

            // 3. Broadcast update to all room occupants
            if (channel) {
                channel.send({
                    type: 'broadcast',
                    event: 'next_episode',
                    payload: { episode, season }
                });
            }

            const epLabel = isTv && season > 1
                ? `Season ${season} Episode ${episode}`
                : `Episode ${episode}`;
            appendChatMessage('System', `You advanced the watch party to ${epLabel}!`, 'system');
        }

        function updatePartyNfInviteButton() {
            const btn = document.getElementById('party-nf-invite-btn');
            if (!btn) return;
            btn.hidden = !(isNetflix && activeRoom);
        }

        function updateControlsVisibility() {
            const controlsBar = document.querySelector('.player-controls-bar');
            if (!controlsBar) return;

            if (isNetflix) {
                controlsBar.style.display = 'none';
                updatePartyNfInviteButton();
                updatePartyNfAutoNextButton();
                updatePartyNfEpisodesButton();
                updatePartyEpNavButtons();
                return;
            }

            controlsBar.style.display = 'flex';

            const serverDropdown = document.getElementById('party-server-dropdown');
            const nfQualityWrap = document.getElementById('party-netflix-quality-wrap');
            if (serverDropdown) {
                serverDropdown.style.display = '';
            }
            if (nfQualityWrap) {
                nfQualityWrap.style.display = 'none';
            }

            const inviteBtn = document.getElementById('party-nf-invite-btn');
            if (inviteBtn) inviteBtn.hidden = true;

            const autoNextBtn = document.getElementById('party-auto-next-btn');
            if (autoNextBtn) autoNextBtn.style.display = 'none';
            updatePartyEpNavButtons();
        }

        function updateBannerText() {
            let baseTitle = activeRoom ? activeRoom.movie_title : 'Feature';
            // Strip out any trailing " - Episode X" or " - Episode Y" from the baseTitle
            const epIndex = baseTitle.indexOf(' - Episode');
            if (epIndex !== -1) {
                baseTitle = baseTitle.substring(0, epIndex);
            }
            
            // Build the updated title
            let updatedTitle = baseTitle;
            if (isAnime || isTv) {
                updatedTitle = isTv && season > 1
                    ? `${baseTitle} - S${season}E${episode}`
                    : `${baseTitle} - Episode ${episode}`;
            }
            
            document.getElementById('banner-playing-text').textContent = `🍿 Watching: ${updatedTitle}`;
            const titleEl = document.getElementById('room-playing-title');
            if (titleEl) {
                titleEl.textContent = updatedTitle;
            }
        }

        // Copy shared link
        function copyShareLink(btnId = 'share-link-btn') {
            if (!activeRoom) return;
            const displayId = uuidToShortCode(activeRoom.id) || activeRoom.id;
            const shareUrl = `${window.location.origin}${window.location.pathname}?room=${displayId}`;
            navigator.clipboard.writeText(shareUrl).then(() => {
                const btn = document.getElementById(btnId);
                if (!btn) return;
                const oldText = btn.innerHTML;
                btn.innerHTML = '✨ Invite Link Copied!';
                btn.style.color = '#10b981';
                setTimeout(() => {
                    btn.innerHTML = oldText;
                    btn.style.color = '';
                }, 2500);
            }).catch(err => {
                alert('Copy this URL to invite friends:\n' + shareUrl);
            });
        }

        // Emoji Picker functions
        function toggleEmojiPicker(e) {
            if (e) e.stopPropagation();
            const picker = document.getElementById('chat-emoji-picker');
            if (picker) picker.classList.toggle('active');
        }

        function insertEmoji(emoji) {
            const input = document.getElementById('chat-input');
            if (input) {
                const start = input.selectionStart || 0;
                const end = input.selectionEnd || 0;
                const text = input.value;
                input.value = text.substring(0, start) + emoji + text.substring(end);
                
                // Position cursor after inserted emoji
                const newPos = start + emoji.length;
                input.setSelectionRange(newPos, newPos);
                input.focus();
                
                input.required = false;
            }
        }

        // Close emoji picker when clicking outside
        window.addEventListener('click', (e) => {
            const picker = document.getElementById('chat-emoji-picker');
            const emojiBtn = document.querySelector('.chat-emoji-btn');
            if (picker && picker.classList.contains('active')) {
                if (!picker.contains(e.target) && (!emojiBtn || !emojiBtn.contains(e.target))) {
                    picker.classList.remove('active');
                }
            }
        });

        // Database Rooms queries
        async function loadActiveRooms() {
            const container = document.getElementById('rooms-container');
            
            if (lobbyChannels && lobbyChannels.length) {
                lobbyChannels.forEach(c => supabaseClient.removeChannel(c));
                lobbyChannels = [];
            }
            
            try {
                // Automatically prune rooms older than 24 hours from the database on page load
                const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                await supabaseClient
                    .from('rooms')
                    .delete()
                    .lt('created_at', twentyFourHoursAgo);

                const activeThreshold = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
                const { data: rooms, error } = await supabaseClient
                    .from('rooms')
                    .select('*')
                    .gt('created_at', activeThreshold)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                if (!rooms || rooms.length === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-icon">🍿</div>
                            <h3>No active parties right now.</h3>
                            <p>Be the first to start a party room and share the link with friends!</p>
                        </div>
                    `;
                    return;
                }

                container.innerHTML = rooms.map(room => `
                    <div class="room-card">
                        <div class="room-header">
                            <div class="room-name">${room.name}</div>
                            <span class="room-status">LIVE</span>
                        </div>
                        <div class="room-info">
                            <div class="room-info-item">🎬 <strong>Playing:</strong> ${room.movie_title}</div>
                            <div class="room-info-item">🕒 <strong>Started:</strong> ${new Date(room.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        </div>
                        <div class="room-footer">
                            <span class="room-participants skeleton-shimmer-inline" data-room-id="${room.id}">👥 Open lobby</span>
                            <button class="btn btn-primary" onclick="joinExistingRoom('${room.id}')">Join Party</button>
                        </div>
                    </div>
                `).join('');

                // Connect to presence channel for each room to display online count dynamically
                rooms.forEach(room => {
                    const tempChannel = supabaseClient.channel(`lobby_presence_${room.id}`, {
                        config: {
                            presence: {
                                key: 'lobby_viewer'
                            }
                        }
                    });

                    // Match the actual room presence channel
                    const roomPresenceChannel = supabaseClient.channel(`party_room_${room.id}`);
                    
                    roomPresenceChannel.on('presence', { event: 'sync' }, () => {
                        const state = roomPresenceChannel.presenceState();
                        let count = 0;
                        Object.keys(state).forEach(k => {
                            if (k !== 'lobby_viewer') {
                                count += state[k].length || 1;
                            }
                        });
                        
                        const countEl = document.querySelector(`.room-participants[data-room-id="${room.id}"]`);
                        if (countEl) {
                            countEl.classList.remove('skeleton-shimmer-inline');
                            countEl.textContent = `👥 ${count} ${count === 1 ? 'person' : 'people'} online`;
                        }
                    });

                    roomPresenceChannel.subscribe();
                    lobbyChannels.push(roomPresenceChannel);
                });

            } catch (err) {
                console.error('Error fetching rooms:', err);
            }
        }

        async function joinExistingRoom(roomId) {
            try {
                const { data: room, error } = await supabaseClient
                    .from('rooms')
                    .select('*')
                    .eq('id', roomId)
                    .single();

                if (error) throw error;
                activeRoom = room;
                applyRoomHostRole(room);
                showRoomView(room);
            } catch (err) {
                alert('Party room not found or has been closed.');
                showLobbyView();
            }
        }

        // Create Room logic
        async function handleCreateRoom(e) {
            e.preventDefault();
            const name = document.getElementById('form-room-name').value.trim();
            const movieTitle = document.getElementById('form-movie-title').value.trim();
            const embedUrl = document.getElementById('form-embed-url').value.trim();

            const shortCode = generateShortCode();
            const uuid = shortCodeToUuid(shortCode);

            try {
                const { data: room, error } = await supabaseClient
                    .from('rooms')
                    .insert([{
                        id: uuid,
                        name: name,
                        movie_title: movieTitle,
                        embed_sources: embedUrl,
                        scheduled_start_time: new Date().toISOString()
                    }])
                    .select()
                    .single();

                if (error) throw error;

                activeRoom = room;
                applyRoomHostRole(room, true);
                showRoomView(room);

            } catch (err) {
                alert('Failed to launch party room: ' + err.message);
            }
        }

        // Realtime social communication via WebSockets
        function connectToRealtimeRoom(room) {
            if (channel) {
                supabaseClient.removeChannel(channel);
            }

            // Chat & User presence channels
            channel = supabaseClient.channel(`party_room_${room.id}`, {
                config: {
                    presence: {
                        key: currentUserName
                    }
                }
            });

            // Listen for system Broadcast events (Realtime Lobby Chat)
            channel
                .on('broadcast', { event: 'chat' }, (payload) => {
                    appendChatMessage(payload.payload.user, payload.payload.message, 'other', payload.payload.image);
                })
                .on('broadcast', { event: 'next_episode' }, (payload) => {
                    if (isHost) return;
                    const nextEp = payload.payload.episode;
                    const nextSeason = payload.payload.season;
                    if (nextSeason != null && Number.isFinite(nextSeason)) {
                        season = nextSeason;
                    }
                    episode = nextEp;
                    updateBannerText();
                    if (isNetflix) {
                        loadNetflixPartyPlayer();
                    } else {
                        switchStreamProvider(activeProvider);
                    }
                    const epLabel = isTv && season > 1
                        ? `Season ${season} Episode ${nextEp}`
                        : `Episode ${nextEp}`;
                    appendChatMessage('System', `The host advanced the watch party to ${epLabel}!`, 'system');
                })
                .on('presence', { event: 'sync' }, () => {
                    const state = channel.presenceState();
                    updateUsersCount(state);
                })
                .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                    appendChatMessage('System', `${key} joined the watch party!`, 'system');
                })
                .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                    appendChatMessage('System', `${key} left the watch party.`, 'system');
                });

            channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    // Track user presence
                    await channel.track({
                        user: currentUserName,
                        joinedAt: new Date().toISOString(),
                        isHost: isHost
                    });
                }
            });

            appendChatMessage('System', `Connected to party lobby. Welcome to "${room.name}"!`, 'system');
        }

        // Chat staging states & helpers
        let stagedImageBase64 = null;

        async function uploadBase64ToStorage(base64Str) {
            try {
                // Convert base64 to Blob using browser fetch API
                const res = await fetch(base64Str);
                const blob = await res.blob();
                
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.jpg`;
                const { data, error } = await supabaseClient.storage
                    .from('chat-images')
                    .upload(fileName, blob, {
                        contentType: 'image/jpeg',
                        cacheControl: '3600'
                    });

                if (error) {
                    console.warn('Storage upload error, using Base64 fallback:', error);
                    return base64Str;
                }

                const { data: { publicUrl } } = supabaseClient.storage
                    .from('chat-images')
                    .getPublicUrl(fileName);
                return publicUrl;
            } catch (err) {
                console.warn('Storage exception, using Base64 fallback:', err);
                return base64Str;
            }
        }

        async function handleSendChat(e) {
            e.preventDefault();
            const input = document.getElementById('chat-input');
            const val = input.value.trim();
            
            if (!val && !stagedImageBase64) return;

            const textToSend = val;
            const imageToSend = stagedImageBase64;

            // Clear input and staged image preview instantly for instant responsiveness
            input.value = '';
            if (imageToSend) {
                clearStagedImage();
            }

            // Render local message instantly
            appendChatMessage(currentUserName, textToSend, 'me', imageToSend);

            // Upload image to Supabase Storage in the background if present
            let finalImage = null;
            if (imageToSend) {
                finalImage = await uploadBase64ToStorage(imageToSend);
            }

            // Broadcast to the room
            if (channel) {
                channel.send({
                    type: 'broadcast',
                    event: 'chat',
                    payload: { 
                        user: currentUserName, 
                        message: textToSend, 
                        image: finalImage 
                    }
                });
            }
        }

        function appendChatMessage(user, msg, type, imageUrl) {
            const box = document.getElementById('chat-box');
            const bubble = document.createElement('div');
            bubble.className = `chat-bubble ${type}`;
            
            if (type === 'system') {
                bubble.textContent = msg;
            } else {
                let imgHtml = '';
                if (imageUrl) {
                    imgHtml = `
                        <div class="chat-image-wrapper">
                            <img src="${imageUrl}" class="chat-msg-image" onclick="viewChatImageFull(this.src)" title="Click to view full size">
                        </div>
                    `;
                }
                bubble.innerHTML = `
                    <span class="chat-sender">${user}</span>
                    ${imgHtml}
                    ${msg ? `<span>${msg}</span>` : ''}
                `;
            }
            
            box.appendChild(bubble);
            box.scrollTop = box.scrollHeight;
        }

        // Image Sending & Lightbox View Helpers
        function triggerImageUpload() {
            document.getElementById('chat-image-input').click();
        }

        function handleImageSelected(event) {
            const file = event.target.files[0];
            if (!file) return;

            // Reset selector so same file can be re-selected
            event.target.value = '';

            compressAndStageFile(file);
        }

        function compressAndStageFile(file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = new Image();
                img.onload = function () {
                    // Maximum boundaries to restrict payload bandwidth size
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress to JPEG with 0.6 quality (looks excellent but very small, typically ~20-40KB)
                    const base64Data = canvas.toDataURL('image/jpeg', 0.6);

                    // Stage the image
                    stagedImageBase64 = base64Data;

                    // Display staging preview
                    const previewContainer = document.getElementById('chat-staged-preview');
                    const previewImg = document.getElementById('staged-preview-img');
                    previewImg.src = base64Data;
                    previewContainer.style.display = 'flex';

                    // Auto-focus chat input to type a message/caption
                    document.getElementById('chat-input').focus();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        function clearStagedImage(event) {
            if (event) event.preventDefault();
            stagedImageBase64 = null;
            const previewContainer = document.getElementById('chat-staged-preview');
            const previewImg = document.getElementById('staged-preview-img');
            previewImg.src = '';
            previewContainer.style.display = 'none';
        }

        // Clipboard pasting for screenshotted images (Ctrl+V / Cmd+V)
        window.addEventListener('paste', (e) => {
            const items = (e.clipboardData || window.clipboardData).items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        compressAndStageFile(file);
                    }
                }
            }
        });

        function viewChatImageFull(src) {
            const modal = document.getElementById('image-view-modal');
            const img = document.getElementById('image-modal-img');
            img.src = src;
            modal.style.display = 'flex';
            
            // Allow DOM display layout render before applying active visibility transform
            setTimeout(() => {
                modal.classList.add('active');
            }, 10);
        }

        function closeImageModal() {
            const modal = document.getElementById('image-view-modal');
            modal.classList.remove('active');
            
            // Wait for smooth opacity fade transition
            setTimeout(() => {
                modal.style.display = 'none';
            }, 250);
        }

        // Close full size image modal on Escape key press
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('image-view-modal');
                if (modal && modal.classList.contains('active')) {
                    closeImageModal();
                }
            }
        });

        // Participants count status helper
        function updateUsersCount(presenceState) {
            const onlineCountEl = document.getElementById('chat-online-count');
            const count = Object.keys(presenceState).length;
            onlineCountEl.textContent = count;
        }



        // Page Init logic
        window.addEventListener('DOMContentLoaded', async () => {
            updateHeaderBadge();
            bindPartyEpNavButtons();

            // Fast navigation helper when leaving the party page back to home
            document.querySelectorAll('a[href="../index.html"]').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const href = link.href;
                    const iframe = document.getElementById('video-player-iframe');
                    if (iframe) {
                        iframe.src = 'about:blank';
                        try {
                            iframe.parentNode.removeChild(iframe);
                        } catch (err) {}
                    }
                    setTimeout(() => {
                        window.location.href = href;
                    }, 20);
                });
            });

            // Listen for complete event from iframe players to advance episodes for social host
            window.addEventListener('message', (event) => {
                let data = event.data;
                if (typeof data === 'string') {
                    try {
                        data = JSON.parse(data);
                    } catch (e) {
                        return;
                    }
                }
                if (!data) return;

                if (data.event === 'complete') {
                    if (isHost && (isAnime || isTv) && partyAutoNext) {
                        changePartyEpisode(episode + 1);
                    }
                }
            });

            try {
                if (joinRoomId) {
                    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(joinRoomId);
                    const isShortCode = isPartyShortCode(joinRoomId);

                    if (isUuid) {
                        await joinExistingRoom(joinRoomId);
                    } else if (isShortCode) {
                        const codeUuid = shortCodeToUuid(joinRoomId);
                        const { data: room, error } = await supabaseClient
                            .from('rooms')
                            .select('*')
                            .eq('id', codeUuid)
                            .single();

                        if (!error && room) {
                            activeRoom = room;
                            applyRoomHostRole(room);
                            showRoomView(room);
                        } else {
                            alert('Party room not found or has been closed.');
                            showLobbyView();
                        }
                    } else if (isCatalogMediaKey(joinRoomId)) {
                        await createCatalogPartyRoom(joinRoomId);
                    } else {
                        showLobbyView();
                    }
                } else if (catalogMediaId) {
                    await createCatalogPartyRoom(catalogMediaId);
                } else {
                    showLobbyView();
                }
            } catch (err) {
                console.error('Error booting watch party room:', err);
                showLobbyView();
            }
        });
    