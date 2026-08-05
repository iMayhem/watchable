
        // Anti-Ad / Anti-Popup Shield for WatchTogether
        try {
            window.open = function() {
                console.warn('[WatchTogether Anti-Ad] Suppressed ad popup window');
                return null;
            };
        } catch (e) {}

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
            },
            removeItem(key) {
                try {
                    localStorage.removeItem(key);
                } catch (e) {
                    console.warn('localStorage removeItem failed:', e);
                }
            }
        };

        function applyRoomHostRole(room, created = false) {
            isHost = created || (room?.host === currentUserName);
            if (activeRoom?.id === room?.id) updateRoomPrivacyButton();
            if (channel) void syncPresenceTrack();
            updateMakeHostButtonVisibility();
        }

        function isRoomPrivate(room) {
            return Boolean(room?.is_private);
        }

        function isMissingPrivacyColumnError(error) {
            const message = String(error?.message || '');
            return /is_private/i.test(message)
                || /column/i.test(message)
                || error?.code === 'PGRST204';
        }

        async function persistRoomPrivacy(nextPrivate) {
            const roomId = activeRoom.id;

            const { error: updateError } = await supabaseClient
                .from('rooms')
                .update({ is_private: nextPrivate })
                .eq('id', roomId);

            if (updateError) {
                if (isMissingPrivacyColumnError(updateError)) {
                    throw new Error(
                        'The rooms.is_private column is missing. Run docs/rooms_private_migration.sql in the Supabase SQL Editor.'
                    );
                }
                throw updateError;
            }

            const { data, error: fetchError } = await supabaseClient
                .from('rooms')
                .select('id, is_private')
                .eq('id', roomId)
                .maybeSingle();

            if (fetchError) throw fetchError;
            if (!data) throw new Error('Room not found.');

            if (Boolean(data.is_private) !== nextPrivate) {
                throw new Error(
                    'Room privacy could not be saved. Run docs/rooms_private_migration.sql in Supabase — the rooms table needs an UPDATE policy.'
                );
            }

            return { ...activeRoom, ...data };
        }

        function canJoinRoom(room) {
            if (!room) return false;
            return !isRoomPrivate(room) || room?.host === currentUserName;
        }

        function notifyPrivateRoomBlocked() {
            alert('This room is private. The host has locked it — no new guests can join.');
        }

        function buildPresencePayload() {
            return {
                user: currentUserName,
                joinedAt: new Date().toISOString(),
                isHost: isHost,
                sessionId: presenceSessionId
            };
        }

        async function syncPresenceTrack() {
            if (!channel) return;
            await channel.track(buildPresencePayload());
        }

        function updateRoomPrivacyButton() {
            const btn = document.getElementById('room-privacy-btn');
            if (!btn) return;

            if (!activeRoom || !document.body.classList.contains('room-view-active')) {
                btn.hidden = true;
                return;
            }

            btn.hidden = false;
            const locked = isRoomPrivate(activeRoom);
            btn.textContent = locked ? 'Make public' : 'Make private';
            btn.classList.toggle('is-private', locked);
            btn.setAttribute('aria-pressed', locked ? 'true' : 'false');
            btn.title = locked
                ? 'Open this room so new guests can join from the lobby'
                : 'Lock this room so no new guests can join';
        }

        async function toggleRoomPrivacy(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            if (!activeRoom) return false;
            if (!isHost) {
                alert('Only the room host can change privacy settings.');
                return false;
            }

            const nextPrivate = !isRoomPrivate(activeRoom);
            const btn = document.getElementById('room-privacy-btn');
            if (btn) btn.disabled = true;

            try {
                activeRoom = await persistRoomPrivacy(nextPrivate);
                updateRoomPrivacyButton();
                appendChatMessage(
                    'System',
                    nextPrivate
                        ? 'Room is now private — new guests cannot join.'
                        : 'Room is now public — anyone can join from the lobby.',
                    'system'
                );
            } catch (err) {
                console.error('Failed to toggle room privacy:', err);
                alert('Could not update room privacy. ' + (err.message || 'Please try again.'));
            } finally {
                if (btn) btn.disabled = false;
            }

            return false;
        }

        window.toggleRoomPrivacy = toggleRoomPrivacy;
        window.openPartyEpisodesPanel = openPartyEpisodesPanel;

        /**
         * giveHostControlTo(targetUser)
         * Allows the current host to transfer host control to another participant.
         * Broadcasts a 'moovie_host_transfer' event so all clients update host state.
         * Also exposed globally so the inline "Make Host" button in chat can call it.
         */
        // Flag to prevent the sender from double-processing their own host transfer broadcast echo
        let _hostTransferInFlight = false;

        async function giveHostControlTo(targetUser) {
            if (!isHost) {
                alert('Only the current host can transfer host control.');
                return;
            }
            if (!targetUser || targetUser === currentUserName) return;
            if (!channel) return;

            const prevHost = currentUserName;

            // Update local state BEFORE broadcasting so the echo (if received) is ignored
            isHost = false;
            _hostTransferInFlight = true;
            if (activeRoom) activeRoom.host = targetUser;
            await syncPresenceTrack();
            updateRoomPrivacyButton();

            // Persist the new host in the database
            try {
                await supabaseClient
                    .from('rooms')
                    .update({ host: targetUser })
                    .eq('id', activeRoom.id);
            } catch (err) {
                console.error('[Party] Failed to persist host transfer to database:', err);
            }

            // Broadcast the transfer to all other participants
            channel.send({
                type: 'broadcast',
                event: 'moovie_host_transfer',
                payload: {
                    newHost: targetUser,
                    prevHost: prevHost
                }
            });

            appendChatMessage('System', `👑 You transferred host control to ${targetUser}.`, 'system');
            if (channel) updateParticipantsPanel(channel.presenceState());
            closeMakeHostMenu();

            // Clear the in-flight flag after a short debounce
            setTimeout(() => { _hostTransferInFlight = false; }, 2000);
        }

        window.giveHostControlTo = giveHostControlTo;

        function toggleMakeHostMenu(event) {
            if (event) event.stopPropagation();
            const menu = document.getElementById('make-host-menu');
            if (!menu) return;
            if (!menu.hidden) { closeMakeHostMenu(); return; }
            populateMakeHostMenu();
            menu.hidden = false;
            positionMakeHostMenu();
        }

        function closeMakeHostMenu() {
            const menu = document.getElementById('make-host-menu');
            if (menu) menu.hidden = true;
        }

        function positionMakeHostMenu() {
            const menu = document.getElementById('make-host-menu');
            const btn = document.getElementById('make-host-btn');
            if (!menu || !btn) return;
            const rect = btn.getBoundingClientRect();
            menu.style.right = '0';
            menu.style.bottom = (rect.height + 4) + 'px';
        }

        function populateMakeHostMenu() {
            const menu = document.getElementById('make-host-menu');
            if (!menu) return;
            menu.innerHTML = '';
            const state = channel ? channel.presenceState() : {};
            Object.entries(state).forEach(([key, entries]) => {
                if (isLobbyObserverKey(key)) return;
                const presence = Array.isArray(entries) ? entries[0] : entries;
                if (!presence) return;
                const name = presence.user || key.split(':')[0] || key || 'Guest';
                if (name === currentUserName) return;
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'make-host-dropup__item';
                item.textContent = name;
                item.onclick = () => giveHostControlTo(name);
                menu.appendChild(item);
            });
            if (!menu.children.length) {
                const empty = document.createElement('div');
                empty.className = 'make-host-dropup__empty';
                empty.textContent = 'No other participants';
                menu.appendChild(empty);
            }
        }

        function updateMakeHostButtonVisibility() {
            const btn = document.getElementById('make-host-btn');
            if (!btn) return;
            btn.hidden = !isHost;
            if (!isHost) closeMakeHostMenu();
        }

        document.addEventListener('click', (e) => {
            const menu = document.getElementById('make-host-menu');
            const btn = document.getElementById('make-host-btn');
            if (menu && !menu.hidden && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
                closeMakeHostMenu();
            }
        });
        function formatDuration(seconds) {
            const sec = Math.max(0, Math.floor(seconds));
            const hrs = Math.floor(sec / 3600);
            const mins = Math.floor((sec % 3600) / 60);
            const secs = sec % 60;
            const pad = (num) => String(num).padStart(2, '0');
            if (hrs > 0) {
                return `${hrs}:${pad(mins)}:${pad(secs)}`;
            }
            return `${mins}:${pad(secs)}`;
        }

        function getSeekDescription(newTime, oldTime) {
            const diff = newTime - oldTime;
            if (Math.abs(diff) < 2) return null;
            if (diff > 0) {
                if (diff < 65) {
                    return `forward by ${Math.round(diff)}s`;
                } else {
                    return `to ${formatDuration(newTime)}`;
                }
            } else {
                if (diff > -65) {
                    return `backward by ${Math.round(Math.abs(diff))}s`;
                } else {
                    return `to ${formatDuration(newTime)}`;
                }
            }
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
        const defaultUrl = 'https://jagmmmnxgbinlugxeinc.supabase.co';
        const PUBLISHABLE_KEY = 'sb_publishable_sEdjXoX50ZSu2mY_gJEq4A_O0WzMf1D';
        const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphZ21tbW54Z2Jpbmx1Z3hlaW5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDExOTcsImV4cCI6MjA5OTAxNzE5N30.9oLJOU-HTk-YnhSckPxe_UnBG2yFIT9quAt_mYnMZH4';
        
        let defaultKey = safeLocalStorage.getItem('supabase_anon_key') || safeLocalStorage.getItem('supabase_key') || '';
        if (!defaultKey || defaultKey === 'undefined' || defaultKey === 'null' || defaultKey.trim() === '' || defaultKey.includes('idwjvciofkvspmumgzmg') || defaultKey.includes('eeyiragtylotiwozbgqp')) {
            defaultKey = PUBLISHABLE_KEY;
            safeLocalStorage.removeItem('supabase_anon_key');
            safeLocalStorage.removeItem('supabase_key');
            safeLocalStorage.removeItem('supabase_url');
        }

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

        async function insertPartyRoom(row) {
            let attemptRow = { ...row };
            let result = await supabaseClient
                .from('rooms')
                .insert([attemptRow])
                .select()
                .single();

            // Dynamic retry loop: strip any column missing in the Supabase schema cache
            let maxRetries = 5;
            while (result.error && maxRetries > 0 && (result.error.code === 'PGRST204' || /column/i.test(result.error.message || ''))) {
                maxRetries--;
                const msg = result.error.message || '';
                const match = msg.match(/could not find the '([^']+)' column/i) || msg.match(/column "([^"]+)"/i) || msg.match(/column '([^']+)'/i);
                if (match && match[1] && attemptRow[match[1]] !== undefined) {
                    delete attemptRow[match[1]];
                } else if (attemptRow.host !== undefined && /host/i.test(msg)) {
                    delete attemptRow.host;
                } else if (attemptRow.media_id !== undefined && /media_id/i.test(msg)) {
                    delete attemptRow.media_id;
                } else if (attemptRow.is_private !== undefined && /is_private/i.test(msg)) {
                    delete attemptRow.is_private;
                } else {
                    // Fallback strip order if exact name parsing missed
                    if (attemptRow.host !== undefined) delete attemptRow.host;
                    else if (attemptRow.media_id !== undefined) delete attemptRow.media_id;
                    else if (attemptRow.is_private !== undefined) delete attemptRow.is_private;
                    else break;
                }

                result = await supabaseClient
                    .from('rooms')
                    .insert([attemptRow])
                    .select()
                    .single();
            }

            if (result.error) throw result.error;
            return result.data;
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
            const newRoom = await insertPartyRoom({
                id: uuid,
                name: roomName,
                movie_title: prefillTitle || 'Feature Title',
                embed_sources: catalogKey,
                media_id: catalogKey,
                scheduled_start_time: new Date().toISOString(),
                host: currentUserName
            });

            activeRoom = newRoom;
            applyRoomHostRole(newRoom, true);
            showRoomView(newRoom);
        }

        function isPartyEmbedded() {
            if (urlParams.get('embedded') === '1') return true;
            try {
                return window.self !== window.top;
            } catch (e) {
                return false;
            }
        }

        const partyEmbedded = isPartyEmbedded();

        function normalizeSitePath(path) {
            const url = new URL(path, window.location.origin);
            let pathname = url.pathname.replace(/\/+$/, '');
            if (!pathname) pathname = '/';
            return `${pathname}${url.search}`;
        }

        function syncParentPartyUrl(path) {
            if (!partyEmbedded) return;
            try {
                const parent = window.parent.location;
                const parentPath = `${parent.pathname}${parent.search}`;
                if (normalizeSitePath(parentPath) === normalizeSitePath(path)) return;

                window.parent.postMessage({
                    type: 'watchable-party-nav',
                    path
                }, window.location.origin);
            } catch (e) {}
        }

        function finishPartyBoot() {
            document.body.classList.remove('party-booting');
            document.documentElement.classList.remove('party-joining');
            document.documentElement.classList.add('party-ready');
        }

        function navigateParentSite(path, event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            const target = path || '/';
            if (!partyEmbedded) {
                window.location.href = target;
                return false;
            }

            try {
                window.parent.postMessage({
                    type: 'watchable-site-nav',
                    path: target
                }, window.location.origin);
            } catch (e) {
                window.location.href = target;
            }
            return false;
        }

        window.navigateParentSite = navigateParentSite;

        const CHAT_SYNC_NOTICE_KEY = 'watchable_party_sync_notice_dismissed';

        function dismissChatSyncNotice(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            const notice = document.getElementById('chat-sync-notice');
            if (notice) notice.classList.add('is-dismissed');
            safeLocalStorage.setItem(CHAT_SYNC_NOTICE_KEY, '1');
            return false;
        }

        function restoreChatSyncNoticeState() {
            if (safeLocalStorage.getItem(CHAT_SYNC_NOTICE_KEY) !== '1') return;
            const notice = document.getElementById('chat-sync-notice');
            if (notice) notice.classList.add('is-dismissed');
        }

        function updateSyncNoticeText() {
            const textEl = document.querySelector('#chat-sync-notice .chat-sync-notice__text');
            if (!textEl) return;

            if (activeProvider === 'moovie') {
                textEl.innerHTML = `
                    🎉 <strong>Moovie server is active!</strong> Playback is auto-synced to the host.
                    Any actions (play, pause, seek) by the host will keep everyone in sync.
                `;
                // Temporarily show the notice for Moovie server even if it was dismissed
                const notice = document.getElementById('chat-sync-notice');
                if (notice) notice.classList.remove('is-dismissed');
            } else {
                textEl.innerHTML = `
                    Video isn’t auto-synced — we skipped sync to avoid buffering issues. Pick the
                    <strong>same server</strong>, count down <strong>3, 2, 1</strong> in chat, then hit
                    play together. Chat is live and synced for everyone in the room.
                `;
                // Restore dismissed state if it was previously dismissed
                restoreChatSyncNoticeState();
            }
        }

        window.dismissChatSyncNotice = dismissChatSyncNotice;

        // Parsing room parameter for custom player URLs
        let isAnime = false;
        let isTv = false;
        let isNetflix = false;
        let mediaId = joinRoomId;
        let season = 1;
        let episode = 1;
        function parseMediaParams(idString) {
            isNetflix = false;
            const payload = idString.startsWith('nf_') ? idString.slice(3) : idString;

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
            const candidate = stream?.url || '';
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
            const res = await fetch(`${PARTY_CATALOG_META_API}/${type}/${encodeURIComponent(String(mediaId))}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || `Meta failed (${res.status})`);
            return data?.results?.[0] || null;
        }

        async function fetchNetflixLanguageVariants(meta) {
            const parsed = parseCatalogTitle(meta?.title || '');
            const displayTitle = parsed.displayTitle;
            if (!displayTitle) return [meta].filter(Boolean);

            const encoded = encodeURIComponent(displayTitle).replace(/%20/g, '+');
            const res = await fetch(`${PARTY_CATALOG_BROWSE_API}/search2/${encoded}?page=0`);
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

        const PARTY_TMDB_API_BASE = 'https://proxy.moovie.fun/tmdb-api/3/';
        const PARTY_CATALOG_META_API = 'https://api2.imdb4.shop/api';
        const PARTY_CATALOG_BROWSE_API = 'https://api2.imdb4.shop/api';

        async function fetchPartyTmdb(path) {
            const sep = path.includes('?') ? '&' : '?';
            const res = await fetch(
                `${PARTY_TMDB_API_BASE}${path}${sep}api_key=${PARTY_TMDB_API_KEY}&language=en-US`
            );
            if (!res.ok) throw new Error(`TMDB failed (${res.status})`);
            return res.json();
        }

        function partyStillUrl(path) {
            if (!path) return '';
            const clean = path.startsWith('/') ? path : `/${path}`;
            return `https://image.tmdb.org/t/p/w342${clean}`;
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
                renderBarEpisodeList();
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
            renderBarEpisodeList();
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
            renderBarSeasonSelect();
            renderBarEpisodeList();
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
            renderBarSeasonSelect();
            renderBarEpisodeList();
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
                renderBarSeasonSelect();
                renderBarEpisodeList();
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
                    renderBarEpisodeList();
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
                renderBarSeasonSelect();
                renderBarEpisodeList();
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
                renderBarSeasonSelect();
                renderBarEpisodeList();
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
                if (!isNetflix) shell.hidden = false;
            }
            clearPartyNfControlsTimer();
            setPartyNfMenuOpen(true);
            renderPartySeasonSelect();
            renderPartyEpisodeList();
            scrollPartyEpisodeIntoView();

            if (isNetflix) {
                void upgradePartyEpisodeCatalog(netflixCatalogMeta);
            } else if (activeRoom?.movie_title) {
                void upgradePartyEpisodeCatalog({ title: activeRoom.movie_title });
            }
        }

        function closePartyEpisodesPanel() {
            const panel = document.getElementById('party-nf-episodes');
            const btn = document.getElementById('party-nf-episodes-btn');
            const shell = document.getElementById('party-nf-watch');
            if (panel) panel.hidden = true;
            if (btn) btn.setAttribute('aria-expanded', 'false');
            if (shell) {
                shell.classList.remove('is-episodes-open');
                if (!isNetflix) shell.hidden = true;
            }
            setPartyNfMenuOpen(false);
            schedulePartyNfControlsHide();
        }

        // ── Bar Episodes Drop-up (moovie player) ──────────────────────────────

        function renderBarEpisodeList() {
            const list = document.getElementById('party-bar-episodes-list');
            if (!list) return;
            if (!netflixEpisodes.length) {
                list.innerHTML = '<p class="party-nf-watch__episodes-empty">No episodes found.</p>';
                return;
            }
            list.innerHTML = netflixEpisodes.map((ep) => {
                const active = ep.episode_number === episode && partyViewingSeason === season;
                const thumb = ep.still_path
                    ? `<img src="${partyStillUrl(ep.still_path)}" alt="" loading="lazy" />`
                    : `<div class="party-nf-watch__episode-thumb-fallback">${ep.episode_number}</div>`;
                const playing = active
                    ? `<span class="party-nf-watch__episode-playing" aria-hidden="true">${PARTY_EP_PLAYING_SVG}</span>`
                    : '';
                return `
                    <button type="button"
                        class="party-nf-watch__episode-card ${active ? 'is-active' : ''}"
                        data-episode="${ep.episode_number}"
                        data-season="${partyViewingSeason}"
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

        function renderBarSeasonSelect() {
            const select = document.getElementById('party-bar-season-select');
            if (!select) return;
            if (!netflixSeasons.length || isAnime) {
                select.closest('.bar-episodes-dropup__season').hidden = true;
                return;
            }
            const seasonWrap = select.closest('.bar-episodes-dropup__season');
            if (seasonWrap) seasonWrap.hidden = false;
            select.innerHTML = netflixSeasons.map((row) => `
                <option value="${row.season_number}" ${row.season_number === partyViewingSeason ? 'selected' : ''}>
                    ${row.name || `Season ${row.season_number}`}${row.episode_count ? ` (${row.episode_count})` : ''}
                </option>
            `).join('');
        }

        function openPartyBarEpisodesPanel() {
            if (!isHost) return;
            const panel = document.getElementById('party-bar-episodes-panel');
            if (!panel) return;
            if (!panel.hidden) { closePartyBarEpisodesPanel(); return; }
            panel.hidden = false;
            partyViewingSeason = season;
            renderBarSeasonSelect();
            renderBarEpisodeList();
            requestAnimationFrame(() => {
                const active = panel.querySelector('.party-nf-watch__episode-card.is-active');
                if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            });
            if (activeRoom?.movie_title) {
                void upgradePartyEpisodeCatalog({ title: activeRoom.movie_title });
            }
        }

        function closePartyBarEpisodesPanel() {
            const panel = document.getElementById('party-bar-episodes-panel');
            if (panel) panel.hidden = true;
        }

        function onPartyBarSeasonChange(select) {
            const nextSeason = parseInt(select?.value, 10);
            if (!Number.isFinite(nextSeason) || nextSeason === partyViewingSeason) return;
            partyViewingSeason = nextSeason;
            if (netflixTmdbShowId) {
                void ensurePartySeasonEpisodes(nextSeason);
            } else if (activeRoom?.movie_title) {
                void upgradePartyEpisodeCatalog({ title: activeRoom.movie_title });
            }
        }

        window.openPartyBarEpisodesPanel = openPartyBarEpisodesPanel;
        window.closePartyBarEpisodesPanel = closePartyBarEpisodesPanel;
        window.onPartyBarSeasonChange = onPartyBarSeasonChange;

        function initPartyBarEpisodesPanel() {
            const list = document.getElementById('party-bar-episodes-list');
            if (!list) return;
            list.addEventListener('click', (e) => {
                const card = e.target.closest('.party-nf-watch__episode-card');
                if (!card || !list.contains(card)) return;
                e.preventDefault();
                e.stopPropagation();
                const epNum = parseInt(card.dataset.episode, 10);
                const seasonNum = parseInt(card.dataset.season, 10);
                if (!Number.isFinite(epNum)) return;
                closePartyBarEpisodesPanel();
                selectPartyEpisode(epNum, Number.isFinite(seasonNum) ? seasonNum : partyViewingSeason);
            });
            document.addEventListener('pointerdown', (e) => {
                const panel = document.getElementById('party-bar-episodes-panel');
                if (!panel || panel.hidden) return;
                if (e.target.closest('#party-bar-episodes-panel, #party-bar-episodes-btn')) return;
                closePartyBarEpisodesPanel();
            });
        }

        function getNextPartyEpisodeTarget() {
            if (!isNetflix) {
                if (isAnime || isTv) {
                    return { season, episode: episode + 1 };
                }
                return null;
            }
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
            initPartyBarEpisodesPanel();
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
            setPlayerStagePending(true);
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
                setPlayerStagePending(false);
            }
        }

        // Available Stream Servers
        const serversList = [
            { id: 'moovie', name: 'Moovie', movie: '/embed/movie/{tmdbId}?provider=moovie', tv: '/embed/tv-show/{tmdbId}/season/{season}/episode/{episode}?provider=moovie' },
        ];
        
        let activeProvider = 'moovie';
        let partyBufferingTimer = null;
        let lastMooviePlayerTime = 0;
        let lastMooviePlayerPlaying = false;

        // Session Setup
        let currentUserName = safeLocalStorage.getItem('movora_username');
        if (!currentUserName || !/_\d{4}$/.test(currentUserName)) {
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
            currentUserName = randomPrefix + randomSuffix + '_' + Math.floor(1000 + Math.random() * 9000);
            safeLocalStorage.setItem('movora_username', currentUserName);
        }

        // Initialize Supabase Client
        const supabaseClient = supabase.createClient(defaultUrl, defaultKey || PUBLISHABLE_KEY);

        // Application State variables
        let activeRoom = null;
        let channel = null;
        let isHost = false;
        let pendingGuestSyncRequest = false; // Set when guest player is ready but channel not yet subscribed

        let lobbyChannels = [];
        let lobbyRoomsChannel = null;
        let lobbyRefreshInterval = null;
        let loadRoomsTimer = null;
        let roomActivityHeartbeat = null;

        const PARTY_INACTIVE_HOURS = 6;

        function partyInactiveThresholdIso() {
            return new Date(Date.now() - PARTY_INACTIVE_HOURS * 60 * 60 * 1000).toISOString();
        }

        const PARTY_SESSION_KEY = 'watchable_party_session_id';
        let presenceSessionId = safeLocalStorage.getItem(PARTY_SESSION_KEY);
        if (!presenceSessionId) {
            presenceSessionId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
            safeLocalStorage.setItem(PARTY_SESSION_KEY, presenceSessionId);
        }

        function getPresenceKey() {
            return `${currentUserName}:${presenceSessionId}`;
        }

        function displayNameFromPresence(key, presences) {
            if (presences?.[0]?.user) return presences[0].user;
            if (typeof key === 'string' && key.includes(':')) return key.split(':')[0];
            return key || 'Someone';
        }

        const LOBBY_OBSERVER_PREFIX = 'lobby_observer_';

        function isLobbyObserverKey(key) {
            return typeof key === 'string' && key.startsWith(LOBBY_OBSERVER_PREFIX);
        }

        function countPresenceMembers(presenceState) {
            let count = 0;
            Object.entries(presenceState || {}).forEach(([key, entries]) => {
                if (isLobbyObserverKey(key)) return;
                const present = Array.isArray(entries) ? entries.length > 0 : Boolean(entries);
                if (present) count += 1;
            });
            return count;
        }

        function formatParticipantLabel(count) {
            const safeCount = Number.isFinite(count) && count >= 0 ? count : 0;
            return `👥 ${safeCount} ${safeCount === 1 ? 'user' : 'users'}`;
        }

        function updateLobbyParticipantLabel(roomId, count) {
            const countEl = document.querySelector(`.room-participants[data-room-id="${roomId}"]`);
            if (!countEl) return;
            countEl.classList.remove('skeleton-shimmer-inline');
            countEl.textContent = formatParticipantLabel(count);
        }

        // Subscribe to a room's presence channel as a passive observer so the lobby can
        // show how many people are actually in it right now (0 if empty).
        function observeLobbyRoomPresence(roomId) {
            if (!roomId) return;
            const ch = supabaseClient.channel(`party_room_${roomId}`, {
                config: {
                    presence: {
                        key: `${LOBBY_OBSERVER_PREFIX}${presenceSessionId}`
                    }
                }
            });

            const refresh = () => {
                const state = ch.presenceState();
                let count = 0;
                Object.entries(state || {}).forEach(([key, entries]) => {
                    if (isLobbyObserverKey(key)) return;
                    const present = Array.isArray(entries) ? entries.length > 0 : Boolean(entries);
                    if (present) count += 1;
                });
                updateLobbyParticipantLabel(roomId, count);
            };

            ch.on('presence', { event: 'sync' }, refresh);
            ch.on('presence', { event: 'join' }, refresh);
            ch.on('presence', { event: 'leave' }, refresh);
            ch.on('broadcast', { event: 'lobby_count' }, (payload) => {
                const count = payload?.payload?.count;
                if (Number.isFinite(count)) updateLobbyParticipantLabel(roomId, count);
            });
            ch.subscribe((status) => {
                // Give the observer a presence entry so realtime delivers presence_sync.
                void ch.track({ lobby_observer: true });
                if (status === 'SUBSCRIBED' || status === 'CHANNEL_ESTABLISHED') {
                    refresh();
                }
            });

            lobbyChannels.push(ch);
        }

        function broadcastLobbyParticipantCount(activeChannel, presenceState) {
            if (!activeChannel) return;
            const count = countPresenceMembers(presenceState);
            activeChannel.send({
                type: 'broadcast',
                event: 'lobby_count',
                payload: { count }
            });
        }

        function teardownLobbyPresence() {
            if (lobbyChannels && lobbyChannels.length) {
                lobbyChannels.forEach(c => supabaseClient.removeChannel(c));
                lobbyChannels = [];
            }
        }

        function teardownLobbyFeed() {
            if (lobbyRoomsChannel) {
                supabaseClient.removeChannel(lobbyRoomsChannel);
                lobbyRoomsChannel = null;
            }
            if (lobbyRefreshInterval) {
                clearInterval(lobbyRefreshInterval);
                lobbyRefreshInterval = null;
            }
            if (loadRoomsTimer) {
                clearTimeout(loadRoomsTimer);
                loadRoomsTimer = null;
            }
        }

        function scheduleLoadActiveRooms() {
            clearTimeout(loadRoomsTimer);
            loadRoomsTimer = setTimeout(() => loadActiveRooms(), 350);
        }

        function setupLobbyFeed() {
            if (!lobbyRoomsChannel) {
                lobbyRoomsChannel = supabaseClient
                    .channel('lobby_rooms_feed')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
                        scheduleLoadActiveRooms();
                    })
                    .subscribe();
            }

            if (!lobbyRefreshInterval) {
                lobbyRefreshInterval = setInterval(() => {
                    if (document.getElementById('lobby-view')?.classList.contains('active')) {
                        loadActiveRooms();
                    }
                }, 30000);
            }
        }

        async function touchRoomActivity(roomId) {
            if (!roomId) return;
            try {
                await supabaseClient
                    .from('rooms')
                    .update({ scheduled_start_time: new Date().toISOString() })
                    .eq('id', roomId);
            } catch (err) {
                console.warn('Failed to update room activity:', err);
            }
        }

        let lastStaleCleanupRun = 0;

        async function cleanupStaleRooms() {
            const now = Date.now();
            if (now - lastStaleCleanupRun < 5 * 60 * 1000) return;
            lastStaleCleanupRun = now;
            try {
                const cutoff = new Date(now - PARTY_INACTIVE_HOURS * 60 * 60 * 1000).toISOString();
                const { data: stale, error } = await supabaseClient
                    .from('rooms')
                    .select('id')
                    .lte('scheduled_start_time', cutoff);
                if (error) throw error;
                if (!stale || !stale.length) return;

                for (const row of stale) {
                    const roomId = row?.id;
                    if (!roomId) continue;
                    try {
                        await purgePartyChat(roomId);
                    } catch (e) {
                        console.warn('Room chat cleanup failed:', e);
                    }
                    try {
                        await supabaseClient.from('rooms').delete().eq('id', roomId);
                    } catch (e) {
                        console.warn('Room delete failed:', e);
                    }
                }
            } catch (err) {
                console.warn('Stale room cleanup failed:', err);
            }
        }

        function startRoomActivityHeartbeat(roomId) {
            if (roomActivityHeartbeat) {
                clearInterval(roomActivityHeartbeat);
            }
            roomActivityHeartbeat = setInterval(() => touchRoomActivity(roomId), 10 * 60 * 1000);
        }

        function stopRoomActivityHeartbeat() {
            if (roomActivityHeartbeat) {
                clearInterval(roomActivityHeartbeat);
                roomActivityHeartbeat = null;
            }
        }

        // Update Header user badge
        function updateHeaderBadge() {
            const container = document.getElementById('header-user');
            container.innerHTML = `
                <div class="party-header__user-inner">
                    <span class="watching-as-badge">Watching as <strong>${currentUserName}</strong></span>
                    <button class="btn btn-secondary party-header__rename" onclick="changeNickname()">Rename</button>
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
                if (channel) {
                    void syncPresenceTrack();
                }
            }
        }

        // View Toggling
        function bootstrapLobbyView() {
            document.body.classList.remove('room-view-active');
            document.body.classList.remove('cinema-mode');
            updateCinemaModeButton();

            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById('lobby-view').classList.add('active');

            syncParentPartyUrl('/party');
            scheduleLoadActiveRooms();
            setupLobbyFeed();
            updateRoomPrivacyButton();
            finishPartyBoot();
        }

        function showLobbyView() {
            // Cancel Cinema Mode & active view height locks
            cancelScheduledEmbedLoad();
            setPlayerStagePending(false);
            document.body.classList.remove('room-view-active');
            document.body.classList.remove('cinema-mode');
            updateCinemaModeButton();

            const iframe = document.getElementById('video-player-iframe');
            if (iframe) {
                iframe.src = '';
                iframe.style.display = 'block';
            }
            const nativeStage = document.getElementById('party-native-stage');
            if (nativeStage) nativeStage.style.display = 'none';
            destroyNetflixPlayer();

            void leaveCurrentPartyRoom({ purgeChatIfLast: true });
            stopRoomActivityHeartbeat();

            // Reset room state
            activeRoom = null;
            isHost = false;

            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById('lobby-view').classList.add('active');
            if (partyEmbedded) {
                window.history.pushState({}, '', '/party/app.html');
            } else {
                window.history.pushState({}, '', window.location.pathname);
            }
            syncParentPartyUrl('/party');
            scheduleLoadActiveRooms();
            setupLobbyFeed();
            updateRoomPrivacyButton();
            finishPartyBoot();
        }

        function showCreateView(title = '', embedUrl = '') {
            teardownLobbyFeed();
            teardownLobbyPresence();
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
                    `${PARTY_TMDB_API_BASE}tv/${numeric}?api_key=${PARTY_TMDB_API_KEY}&language=en-US`
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

        let embedLoadFrame = 0;

        function setPlayerStagePending(active) {
            const stage = document.getElementById('player-stage');
            if (stage) stage.classList.toggle('player-stage--pending', Boolean(active));
        }

        function prepareRoomPlayerShell() {
            const iframe = document.getElementById('video-player-iframe');
            const nativeStage = document.getElementById('party-native-stage');

            if (iframe) {
                iframe.style.display = 'block';
                iframe.removeAttribute('src');
            }
            if (nativeStage) nativeStage.style.display = 'none';
            destroyNetflixPlayer();
            setPlayerStagePending(true);
        }

        function cancelScheduledEmbedLoad() {
            if (!embedLoadFrame) return;
            cancelAnimationFrame(embedLoadFrame);
            embedLoadFrame = 0;
        }

        function scheduleRoomEmbedLoad() {
            cancelScheduledEmbedLoad();
            embedLoadFrame = requestAnimationFrame(() => {
                embedLoadFrame = requestAnimationFrame(() => {
                    embedLoadFrame = 0;
                    void loadRoomEmbed();
                });
            });
        }

        async function resolveDefaultStreamProvider() {
            activeProvider = 'moovie';
        }

        async function loadRoomEmbed() {
            setPlayerStagePending(true);

            try {
                if (isNetflix) {
                    await loadNetflixPartyPlayer();
                    return;
                }
                resolveDefaultStreamProvider();
                populateServerDropdown();
                switchStreamProvider(activeProvider);
            } catch (err) {
                console.error('Failed to load room embed:', err);
            } finally {
                setPlayerStagePending(false);
            }
        }

        async function showRoomView(room) {
            document.documentElement.classList.remove('party-joining');
            teardownLobbyFeed();
            teardownLobbyPresence();
            document.body.classList.add('room-view-active');
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById('room-view').classList.add('active');
            
            parseMediaParams(room.embed_sources);

            document.body.classList.remove('cinema-mode');
            updateCinemaModeButton();
            updateBannerText();
            prepareRoomPlayerShell();

            const displayId = uuidToShortCode(room.id) || room.id;
            if (partyEmbedded) {
                window.history.pushState({}, '', `/party/app.html?room=${displayId}`);
            } else {
                window.history.pushState({}, '', `?room=${displayId}`);
            }
            const parentRoomParams = new URLSearchParams({ room: displayId });
            if (prefillTitle) parentRoomParams.set('title', prefillTitle);
            syncParentPartyUrl(`/party?${parentRoomParams.toString()}`);
            
            connectToRealtimeRoom(room);
            updateControlsVisibility();
            updateRoomPrivacyButton();
            finishPartyBoot();
            scheduleRoomEmbedLoad();
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
            menu.innerHTML = serversList.map(srv => `
                <button class="server-dropdown-item ${srv.id === activeProvider ? 'active' : ''}" onclick="switchStreamProvider('${srv.id}')">
                    ${srv.name}
                </button>
            `).join('');
        }

        function showEmbedPlayer(embedUrl) {
            setPlayerStagePending(false);
            const oldIframe = document.getElementById('video-player-iframe');
            if (oldIframe) {
                const parent = oldIframe.parentNode;
                const newIframe = document.createElement('iframe');
                newIframe.id = 'video-player-iframe';
                newIframe.className = oldIframe.className;
                newIframe.style.display = 'block';
                newIframe.allowFullscreen = true;
                newIframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
                newIframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-presentation allow-downloads');
                newIframe.src = embedUrl;
                parent.replaceChild(newIframe, oldIframe);
            }
        }

        function getEmbedUrlForServer(srv, mediaIdForEmbed, isTvShow, s, e) {
            let template = isTvShow ? srv.tv : srv.movie;
            return template
                .replaceAll('{tmdbId}', mediaIdForEmbed)
                .replaceAll('{season}', s)
                .replaceAll('{episode}', e);
        }

        // Switch stream server locally
        function switchStreamProvider(providerId) {
            activeProvider = providerId;
            updateSyncNoticeText();

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

        // Cinema mode toggler
        function updateCinemaModeButton() {
            const btn = document.getElementById('cinema-mode-btn');
            if (!btn) return;
            const on = document.body.classList.contains('cinema-mode');
            btn.classList.toggle('is-active', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            btn.textContent = 'Cinema mode';
        }

        function toggleCinemaMode() {
            document.body.classList.toggle('cinema-mode');
            updateCinemaModeButton();
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
                updateRoomPrivacyButton();
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

            const barEpisodesBtn = document.getElementById('party-bar-episodes-btn');
            if (barEpisodesBtn) {
                barEpisodesBtn.hidden = !(isHost && (isTv || isAnime));
            }

            updatePartyEpNavButtons();
            updateRoomPrivacyButton();
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
            if (!container) return;

            teardownLobbyPresence();
            void cleanupStaleRooms();
            
            try {
                // Only list rooms active in the last 12 hours.
                // Stale rows are removed server-side (see docs/rooms_cleanup_migration.sql).
                const inactiveThreshold = partyInactiveThresholdIso();

                const { data: rooms, error } = await supabaseClient
                    .from('rooms')
                    .select('*')
                    .gte('scheduled_start_time', inactiveThreshold)
                    .order('scheduled_start_time', { ascending: false });

                if (error) throw error;

                if (!rooms || rooms.length === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-icon" aria-hidden="true">🍿</div>
                            <h3>No active rooms</h3>
                            <p>Create a party and share the invite link — your lobby will show up here for others to join.</p>
                        </div>
                    `;
                    return;
                }

                container.innerHTML = rooms.map(room => {
                    const safeName = partyEscapeHtml(room.name);
                    const safeTitle = partyEscapeHtml(room.movie_title);
                    const startedAt = room.created_at || room.scheduled_start_time;
                    const startedLabel = startedAt
                        ? new Date(startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Just now';
                    const privateRoom = isRoomPrivate(room);
                    const joinable = canJoinRoom(room);
                    const statusBadge = privateRoom
                        ? '<span class="room-status room-status--private">Private</span>'
                        : '<span class="room-status">Live</span>';
                    const joinControl = joinable
                        ? `<button class="btn btn-primary" onclick="joinExistingRoom('${room.id}')">Join Party</button>`
                        : `<button class="btn btn-primary room-join-btn--locked" type="button" disabled>Locked</button>`;
                    return `
                    <div class="room-card${privateRoom ? ' room-card--private' : ''}">
                        <div class="room-header">
                            <div class="room-name">${safeName}</div>
                            ${statusBadge}
                        </div>
                        <div class="room-info">
                            <div class="room-info-item">🎬 <strong>Playing:</strong> ${safeTitle}</div>
                            <div class="room-info-item">🕒 <strong>Started:</strong> ${startedLabel}</div>
                            ${privateRoom ? '<div class="room-info-item">🔒 <strong>Access:</strong> Invite only</div>' : ''}
                        </div>
                        <div class="room-footer">
                            <span class="room-participants" data-room-id="${room.id}">${formatParticipantLabel(0)}</span>
                            ${joinControl}
                        </div>
                    </div>
                `;
                }).join('');

                // Live participant counts via presence observers on each room's realtime channel.
                // Channels are created only for listed (recently active) rooms.
                rooms.forEach(room => {
                    observeLobbyRoomPresence(room.id);
                });

            } catch (err) {
                console.error('Error fetching rooms:', err);
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon" aria-hidden="true">⚠️</div>
                        <h3>Could not load rooms</h3>
                        <p>${partyEscapeHtml(err.message || 'Please check your connection and try again.')}</p>
                        <button class="btn btn-primary" type="button" onclick="loadActiveRooms()" style="margin-top: 1rem;">Retry</button>
                    </div>
                `;
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
                if (!canJoinRoom(room)) {
                    notifyPrivateRoomBlocked();
                    return;
                }
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
                        scheduled_start_time: new Date().toISOString(),
                        host: currentUserName
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

        function resetChatPanel() {
            const box = document.getElementById('chat-box');
            if (box) box.innerHTML = '';
        }

        async function persistPartyChatMessage(roomId, user, message, imageUrl) {
            if (!roomId) return;
            const { error } = await supabaseClient
                .from('party_chat_messages')
                .insert([{
                    room_id: roomId,
                    user_name: user,
                    message: message || '',
                    image_url: imageUrl || null
                }]);
            if (error) throw error;
        }

        async function purgePartyChat(roomId) {
            if (!roomId) return;
            try {
                const { error } = await supabaseClient
                    .from('party_chat_messages')
                    .delete()
                    .eq('room_id', roomId);
                if (error) throw error;
            } catch (err) {
                console.warn('Failed to purge party chat:', err);
            }
        }

        function maybePurgePartyChatWhenEmpty(presenceState) {
            if (!activeRoom?.id) return;
            if (countPresenceMembers(presenceState) > 0) return;
            void purgePartyChat(activeRoom.id);
        }

        async function leaveCurrentPartyRoom({ purgeChatIfLast = false } = {}) {
            const roomId = activeRoom?.id;
            if (!channel) return;

            if (purgeChatIfLast && roomId) {
                const state = channel.presenceState();
                if (countPresenceMembers(state) <= 1) {
                    await purgePartyChat(roomId);
                }
            }

            supabaseClient.removeChannel(channel);
            channel = null;
        }

        // Realtime social communication via WebSockets
        async function connectToRealtimeRoom(room) {
            await leaveCurrentPartyRoom({ purgeChatIfLast: true });

            resetChatPanel();

            touchRoomActivity(room.id);
            startRoomActivityHeartbeat(room.id);

            // Chat & User presence channels
            channel = supabaseClient.channel(`party_room_${room.id}`, {
                config: {
                    presence: {
                        key: getPresenceKey()
                    }
                }
            });

            // Listen for system Broadcast events (Realtime Lobby Chat)
            channel
                .on('broadcast', { event: 'chat' }, (payload) => {
                    const data = payload.payload || {};
                    if (data.user === currentUserName) return;
                    appendChatMessage(data.user, data.message, 'other', data.image);
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
                .on('broadcast', { event: 'moovie_playback_sync' }, (payload) => {
                    console.warn('[Party] Received broadcast moovie_playback_sync:', payload, 'isHost:', isHost, 'activeProvider:', activeProvider);
                    if (isHost) return;
                    if (activeProvider !== 'moovie') return;
                    const data = payload.payload || {};
                    if (data.sender === currentUserName) return;

                    // If host seeked, show in chat
                    if (data.event === 'seek' && data.seekDesc) {
                        appendChatMessage('System', `👑 ${data.sender || 'Host'} seeked ${data.seekDesc}`, 'system');
                    }

                    const iframe = document.getElementById('video-player-iframe');
                    if (iframe && iframe.contentWindow) {
                        console.warn('[Party] Forwarding to iframe: moovie-command-sync', data);
                        iframe.contentWindow.postMessage({
                            type: 'moovie-command-sync',
                            time: data.time,
                            playing: data.playing,
                            event: data.event,
                            force: data.event === 'seek' || data.event === 'play' || data.event === 'pause'
                        }, '*');
                    }
                })
                .on('broadcast', { event: 'moovie_sync_request' }, (payload) => {
                    console.warn('[Party] Received broadcast moovie_sync_request:', payload, 'isHost:', isHost, 'activeProvider:', activeProvider);
                    if (!isHost) return;
                    if (activeProvider !== 'moovie') return;
                    const data = payload.payload || {};
                    if (data.sender === currentUserName) return;

                    // Query the live player time before responding for accuracy
                    if (channel) {
                        const iframe = document.getElementById('video-player-iframe');
                        const liveTime = (iframe && iframe.contentWindow)
                            ? null  // will use lastMooviePlayerTime updated by heartbeat
                            : null;
                        const syncTime = lastMooviePlayerTime ?? 0;
                        const syncPlaying = lastMooviePlayerPlaying ?? false;
                        console.warn('[Party] Replying to sync request with seek event. time:', syncTime, 'playing:', syncPlaying);
                        channel.send({
                            type: 'broadcast',
                            event: 'moovie_playback_sync',
                            payload: {
                                event: 'seek',  // force-seek so guest always jumps to exact timestamp
                                time: syncTime,
                                playing: syncPlaying,
                                sender: currentUserName
                            }
                        });
                    }
                })
                .on('broadcast', { event: 'moovie_host_transfer' }, async (payload) => {
                    const data = payload.payload || {};
                    console.warn('[Party] Received moovie_host_transfer:', data, 'currentUser:', currentUserName, 'isHost:', isHost);
                    if (!data.newHost) return;

                    if (activeRoom) {
                        activeRoom.host = data.newHost;
                    }

                    if (data.newHost === currentUserName) {
                        // We are the new host
                        isHost = true;
                        await syncPresenceTrack();
                        updateRoomPrivacyButton();
                        if (channel) updateParticipantsPanel(channel.presenceState());
                        appendChatMessage('System', '\ud83d\udc51 You are now the host! You control playback for everyone.', 'system');
                    } else if (data.prevHost === currentUserName) {
                        // We were the host but gave it away — skip if already handled locally
                        if (_hostTransferInFlight) {
                            console.warn('[Party] Skipping host transfer echo — already handled locally');
                            return;
                        }
                        isHost = false;
                        await syncPresenceTrack();
                        updateRoomPrivacyButton();
                        if (channel) updateParticipantsPanel(channel.presenceState());
                        appendChatMessage('System', `\ud83d\udc51 You transferred host control to ${data.newHost}.`, 'system');
                    } else {
                        // Spectator — just notify
                        appendChatMessage('System', `\ud83d\udc51 ${data.newHost} is now the host.`, 'system');
                    }
                })
                .on('presence', { event: 'sync' }, () => {
                    const state = channel.presenceState();
                    updateUsersCount(state);
                    broadcastLobbyParticipantCount(channel, state);
                })
                .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                    if (isLobbyObserverKey(key)) return;
                    const state = channel.presenceState();
                    updateUsersCount(state);
                    broadcastLobbyParticipantCount(channel, state);
                    const name = displayNameFromPresence(key, newPresences);
                    if (name !== currentUserName) {
                        const box = document.getElementById('chat-box');
                        const bubble = document.createElement('div');
                        bubble.className = 'chat-bubble system';
                        bubble.textContent = `${name} joined the watch party!`;
                        if (box) { box.appendChild(bubble); box.scrollTop = box.scrollHeight; }

                        // If we are the host, immediately force-seek the new guest to current timestamp
                        if (isHost && activeProvider === 'moovie' && channel) {
                            setTimeout(() => {
                                if (channel && activeProvider === 'moovie') {
                                    channel.send({
                                        type: 'broadcast',
                                        event: 'moovie_playback_sync',
                                        payload: {
                                            event: 'seek',  // force-seek so new guest jumps to exact timestamp
                                            time: lastMooviePlayerTime ?? 0,
                                            playing: lastMooviePlayerPlaying ?? false,
                                            sender: currentUserName
                                        }
                                    });
                                }
                            }, 1200);
                        }
                    } else {
                        // This is US joining the room!
                        // Append a clean system message for ourselves
                        if (!isHost) {
                            setTimeout(() => {
                                const box = document.getElementById('chat-box');
                                const bubble = document.createElement('div');
                                bubble.className = 'chat-bubble system';
                                bubble.textContent = `You joined the watch party!`;
                                if (box) { box.appendChild(bubble); box.scrollTop = box.scrollHeight; }
                            }, 600);
                        }
                    }
                })
                .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                    if (isLobbyObserverKey(key)) return;
                    const state = channel.presenceState();
                    updateUsersCount(state);
                    broadcastLobbyParticipantCount(channel, state);
                    maybePurgePartyChatWhenEmpty(state);
                    const name = displayNameFromPresence(key, leftPresences);
                    appendChatMessage('System', `${name} left the watch party.`, 'system');
                });

            channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await syncPresenceTrack();
                    const state = channel.presenceState();
                    updateUsersCount(state);
                    broadcastLobbyParticipantCount(channel, state);
                    updateRoomPrivacyButton();

                    // If guest had a pending sync request (player was ready before channel), send it now
                    if (!isHost && activeProvider === 'moovie' && pendingGuestSyncRequest) {
                        pendingGuestSyncRequest = false;
                        console.warn('[Party] Channel now subscribed, sending deferred moovie_sync_request');
                        channel.send({
                            type: 'broadcast',
                            event: 'moovie_sync_request',
                            payload: { sender: currentUserName }
                        });
                    }
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

            if (activeRoom?.id) {
                void persistPartyChatMessage(activeRoom.id, currentUserName, textToSend, finalImage)
                    .catch((err) => console.warn('party chat persist failed:', err));
            }

            // Broadcast to everyone currently in the room (no history for late joiners).
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

        // Keyboard shortcuts for Watch Together player
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('image-view-modal');
                if (modal && modal.classList.contains('active')) {
                    closeImageModal();
                    return;
                }
            }

            const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
            const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);
            if (isEditable) return;

            const video = netflixArt?.video;
            const k = e.key;

            if (k === ' ' || k === 'Spacebar' || k === 'k' || k === 'K') {
                e.preventDefault();
                netflixArt?.toggle();
                revealPartyNfControls();
            } else if (k === 'ArrowRight' || k === 'l' || k === 'L') {
                e.preventDefault();
                if (video) video.currentTime = Math.min(video.duration || 0, (video.currentTime || 0) + 5);
                revealPartyNfControls();
            } else if (k === 'ArrowLeft' || k === 'j' || k === 'J') {
                e.preventDefault();
                if (video) video.currentTime = Math.max(0, (video.currentTime || 0) - 5);
                revealPartyNfControls();
            } else if (k === 'ArrowUp') {
                e.preventDefault();
                if (video) {
                    video.volume = Math.min(1, video.volume + 0.1);
                    video.muted = false;
                    updatePartyNfVolumeUi();
                }
                revealPartyNfControls();
            } else if (k === 'ArrowDown') {
                e.preventDefault();
                if (video) {
                    video.volume = Math.max(0, video.volume - 0.1);
                    if (video.volume === 0) video.muted = true;
                    updatePartyNfVolumeUi();
                }
                revealPartyNfControls();
            } else if (k === 'f' || k === 'F') {
                e.preventDefault();
                const shell = document.getElementById('party-nf-watch');
                if (!document.fullscreenElement) {
                    shell?.requestFullscreen?.();
                } else {
                    document.exitFullscreen?.();
                }
            } else if (k === 'm' || k === 'M') {
                e.preventDefault();
                if (video) {
                    video.muted = !video.muted;
                    updatePartyNfVolumeUi();
                }
                revealPartyNfControls();
            }
        });

        // Participants count status helper
        function updateUsersCount(presenceState) {
            const onlineCountEl = document.getElementById('chat-online-count');
            if (onlineCountEl) {
                onlineCountEl.textContent = String(countPresenceMembers(presenceState));
            }
            updateParticipantsPanel(presenceState);
        }

        function updateParticipantsPanel(presenceState) {
            const list = document.getElementById('participants-list');
            if (!list) return;

            list.innerHTML = '';

            Object.entries(presenceState || {}).forEach(([key, entries]) => {
                if (isLobbyObserverKey(key)) return;
                const presence = Array.isArray(entries) ? entries[0] : entries;
                if (!presence) return;

                const name = presence.user || key.split(':')[0] || key || 'Guest';
                const isThisPersonHost = !!presence.isHost;
                const isSelf = name === currentUserName;

                const row = document.createElement('div');
                row.className = 'participants-panel__row';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'participants-panel__name';
                nameSpan.textContent = name + (isSelf ? ' (you)' : '') + (isThisPersonHost ? ' 👑' : '');
                row.appendChild(nameSpan);

                list.appendChild(row);
            });
        }

        function toggleParticipantsPanel() {
            const panel = document.getElementById('participants-panel');
            if (!panel) return;
            panel.hidden = !panel.hidden;
            const btn = document.getElementById('chat-online-count-btn');
            if (btn) btn.classList.toggle('active', !panel.hidden);
        }

        window.toggleParticipantsPanel = toggleParticipantsPanel;


        // Listen for events from iframe players
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
            } else if (data.type === 'watchable-player-sync') {
                console.warn('[Party] Received watchable-player-sync from iframe:', data, 'isHost:', isHost);
                if (isHost) {
                    let seekDesc = null;
                    if (data.event === 'seek') {
                        seekDesc = getSeekDescription(data.time, lastMooviePlayerTime);
                        if (seekDesc) {
                            appendChatMessage('System', `👑 You seeked ${seekDesc}`, 'system');
                        }
                    }

                    // Store the host's player time and state
                    lastMooviePlayerTime = data.time;
                    lastMooviePlayerPlaying = data.playing;

                    // Broadcast the event to guests
                    if (channel) {
                        channel.send({
                            type: 'broadcast',
                            event: 'moovie_playback_sync',
                            payload: {
                                event: data.event,
                                time: data.time,
                                playing: data.playing,
                                sender: currentUserName,
                                seekDesc: seekDesc
                            }
                        });
                    }
                }
            } else if (data.event === 'ready') {
                // Guest player loaded: request the latest state from the host
                console.warn('[Party] Guest player ready, sending sync request... channel subscribed?', !!channel);
                if (channel) {
                    channel.send({
                        type: 'broadcast',
                        event: 'moovie_sync_request',
                        payload: {
                            sender: currentUserName
                        }
                    });
                } else {
                    // Channel not ready yet — defer until it connects
                    console.warn('[Party] Channel not yet available, deferring sync request...');
                    pendingGuestSyncRequest = true;
                }
            }
        });

        // Page Init logic
        window.addEventListener('DOMContentLoaded', async () => {
            restoreChatSyncNoticeState();
            updateSyncNoticeText();
            updateHeaderBadge();
            bindPartyEpNavButtons();
            void cleanupStaleRooms();

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
                            if (!canJoinRoom(room)) {
                                notifyPrivateRoomBlocked();
                                showLobbyView();
                                return;
                            }
                            activeRoom = room;
                            applyRoomHostRole(room);
                            showRoomView(room);
                        } else {
                            alert('Party room not found or has been closed.');
                            showLobbyView();
                        }
                    } else if (isCatalogMediaKey(joinRoomId)) {
                        // Legacy links used ?room=1084244 for the movie — always create a new lounge
                        await createCatalogPartyRoom(joinRoomId);
                    } else {
                        showLobbyView();
                    }
                } else if (catalogMediaId) {
                    await createCatalogPartyRoom(catalogMediaId);
                } else {
                    bootstrapLobbyView();
                }
            } catch (err) {
                console.error('Error booting watch party room:', err);
                showLobbyView();
            }
        });
    