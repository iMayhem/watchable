
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

            const { error: updateError } = await syncClient
                .from('rooms')
                .update({ is_private: nextPrivate })
                .eq('id', roomId);

            if (updateError) {
                if (isMissingPrivacyColumnError(updateError)) {
                    throw new Error(
                        'The rooms.is_private field is missing. Contact the site admin.'
                    );
                }
                throw updateError;
            }

            const { data, error: fetchError } = await syncClient
                .from('rooms')
                .select('id, is_private')
                .eq('id', roomId)
                .maybeSingle();

            if (fetchError) throw fetchError;
            if (!data) throw new Error('Room not found.');

            if (Boolean(data.is_private) !== nextPrivate) {
                throw new Error(
                    'Room privacy could not be saved. The rooms table needs an UPDATE policy.'
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
                sessionId: presenceSessionId,
                lastSeen: Date.now()
            };
        }

        async function syncPresenceTrack() {
            if (!channel) return;
            await channel.track(buildPresencePayload());
        }

        // Refresh our presence entry periodically so the lastSeen staleness filter
        // above never mistakes a live participant for a ghost.
        let presenceHeartbeat = null;

        function startPresenceHeartbeat() {
            if (presenceHeartbeat) clearInterval(presenceHeartbeat);
            presenceHeartbeat = setInterval(() => {
                if (channel) void syncPresenceTrack();
            }, 20 * 1000);
        }

        function stopPresenceHeartbeat() {
            if (presenceHeartbeat) {
                clearInterval(presenceHeartbeat);
                presenceHeartbeat = null;
            }
        }

        // When the tab is hidden (phone lock, app switch) we keep our presence
        // entry and let the heartbeat continue — the server sweeps stale entries
        // after 90s, so a genuinely dead socket is cleaned up there. Untracking on
        // every hide caused "left/joined" chat spam on mobile.
        function onPartyPageVisibility() {
            if (document.visibilityState === 'visible') {
                if (channel) void syncPresenceTrack();
                startPresenceHeartbeat();
            }
        }

        window.addEventListener('pagehide', () => {
            stopPresenceHeartbeat();
            stopRoomActivityHeartbeat();
            if (channel) void channel.untrack();
            if (lobbyRefreshInterval) {
                clearInterval(lobbyRefreshInterval);
                lobbyRefreshInterval = null;
            }
        });
        document.addEventListener('visibilitychange', onPartyPageVisibility);

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

            // Persist the new host in the database FIRST. The rooms row is the
            // source of truth (server host normalization, reconnects and reloads
            // all read from it), so local state must not flip until it succeeds.
            let persisted = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const { error } = await syncClient
                        .from('rooms')
                        .update({ host: targetUser })
                        .eq('id', activeRoom.id);
                    persisted = !error;
                    if (error) {
                        console.error(`[Party] Host transfer PATCH failed (attempt ${attempt}/3):`, error);
                    }
                } catch (err) {
                    console.error(`[Party] Host transfer PATCH threw (attempt ${attempt}/3):`, err);
                }
                if (persisted) break;
                if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * attempt));
            }

            if (!persisted) {
                alert('Host transfer failed — the new host could not be saved. Nothing was changed.');
                return;
            }

            // DB now says targetUser is host — flip local state and presence.
            isHost = false;
            _hostTransferInFlight = true;
            if (activeRoom) activeRoom.host = targetUser;
            await syncPresenceTrack();
            updateRoomPrivacyButton();

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
                if (keyIsStale(entries)) return;
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

        // Sync client configuration
        const defaultUrl = 'https://hahaevilcraft.site';
        const PUBLISHABLE_KEY = 'sb_publishable_sEdjXoX50ZSu2mY_gJEq4A_O0WzMf1D';
        let defaultKey = safeLocalStorage.getItem('moovie_sync_key') || '';
        if (!defaultKey || defaultKey === 'undefined' || defaultKey === 'null' || defaultKey.trim() === '' || defaultKey.includes('idwjvciofkvspmumgzmg') || defaultKey.includes('eeyiragtylotiwozbgqp')) {
            defaultKey = PUBLISHABLE_KEY;
            safeLocalStorage.removeItem('moovie_sync_key');
            safeLocalStorage.removeItem('moovie_sync_url');
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
            let result = await syncClient
                .from('rooms')
                .insert([attemptRow])
                .select()
                .single();

            // Dynamic retry loop: strip any field missing in the backend schema cache
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

                result = await syncClient
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
        let mediaId = joinRoomId;
        let season = 1;
        let episode = 1;
        function parseMediaParams(idString) {
            const payload = idString;

            isAnime = payload.startsWith('anime_') || payload.includes('_ep');
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

        const PARTY_TMDB_API_KEY = 'dfa4c2c7c1de1005adee824dc5593672';


        function partyEscapeHtml(value) {
            return String(value || '').replace(/[&<>"']/g, (ch) => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[ch]));
        }













        function partySupportsEpisodeControl() {
            return isAnime || isTv;
        }


        const PARTY_TMDB_API_BASE = 'https://hahaevilcraft.site/tmdb-api/3/';




        function getNextPartyEpisodeTarget() {
            if (isAnime || isTv) {
                return { season, episode: episode + 1 };
            }
            return null;
        }





        // Available Stream Servers
        const serversList = [
            { id: 'moovie', name: 'Moovie', movie: '/embed/movie/{tmdbId}?provider=moovie', tv: '/embed/tv-show/{tmdbId}/season/{season}/episode/{episode}?provider=moovie' },
        ];
        
        let activeProvider = 'moovie';
        let partyBufferingTimer = null;
        let lastMooviePlayerTime = 0;
        let lastMooviePlayerPlaying = false;
        let lastMooviePlayerDuration = 0;

        // Guard against seek targets beyond the media length (e.g. a heartbeat
        // captured before the next episode finished loading).
        function clampSyncTime(t) {
            if (!Number.isFinite(t)) return 0;
            if (typeof lastMooviePlayerDuration === 'number' && Number.isFinite(lastMooviePlayerDuration) && lastMooviePlayerDuration > 0) {
                return Math.min(Math.max(t, 0), lastMooviePlayerDuration);
            }
            return Math.max(t, 0);
        }

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

        // Initialize Sync Client
        const syncClient = moovieSync.createClient(defaultUrl, defaultKey || PUBLISHABLE_KEY);

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

        const PARTY_INACTIVE_HOURS = 12;

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

        // ── Stale presence filtering ────────────────────────────────────────────
        // Presence entries are tied to WebSockets. When a tab/iframe dies without
        // a clean disconnect (mobile backgrounding, laptop sleep, iframe replaced
        // by the parent page), the server can keep the entry alive for a long time,
        // making empty rooms look populated. Live clients refresh their entry via
        // a heartbeat (see startPresenceHeartbeat), so entries whose lastSeen is
        // old are ghosts and are excluded from every count/panel.
        const PRESENCE_STALE_MS = 90 * 1000;

        function isPresenceStale(presence) {
            if (!presence || typeof presence !== 'object') return false;
            if (Number.isFinite(presence.lastSeen)) {
                return Date.now() - presence.lastSeen > PRESENCE_STALE_MS;
            }
            // Legacy entries (pre-heartbeat) have no lastSeen. Live clients now
            // refresh their entry every 20s, so entries claiming to have joined
            // more than 3 minutes ago are very likely ghosts.
            const joinedAt = Date.parse(presence.joinedAt || '');
            if (Number.isFinite(joinedAt)) {
                return Date.now() - joinedAt > 3 * 60 * 1000;
            }
            return false;
        }

        function keyIsStale(entries) {
            const list = Array.isArray(entries) ? entries : [entries];
            if (!list.length) return false;
            return list.every(e => isPresenceStale(e));
        }

        function countPresenceMembers(presenceState) {
            let count = 0;
            Object.entries(presenceState || {}).forEach(([key, entries]) => {
                if (isLobbyObserverKey(key)) return;
                if (keyIsStale(entries)) return;
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
            const ch = syncClient.channel(`party_room_${roomId}`, {
                config: {
                    presence: {
                        key: `${LOBBY_OBSERVER_PREFIX}${presenceSessionId}`
                    }
                }
            });

            const refresh = () => {
                updateLobbyParticipantLabel(roomId, countPresenceMembers(ch.presenceState()));
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
                lobbyChannels.forEach(c => syncClient.removeChannel(c));
                lobbyChannels = [];
            }
        }

        function teardownLobbyFeed() {
            if (lobbyRoomsChannel) {
                syncClient.removeChannel(lobbyRoomsChannel);
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
                lobbyRoomsChannel = syncClient
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
                await syncClient
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
                const { data: stale, error } = await syncClient
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
                        await syncClient.from('rooms').delete().eq('id', roomId);
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

            if (iframe) {
                iframe.style.display = 'block';
                iframe.removeAttribute('src');
            }
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
            if (document.documentElement.classList.contains('party-native-mode')) {
                setPlayerStagePending(false);
                return;
            }
            setPlayerStagePending(true);

            try {
                resolveDefaultStreamProvider();
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
            
            // An explicit media key in the join URL represents the title/episode
            // the user chose. Prefer it over stale room metadata.
            const effectiveMediaKey = catalogMediaId || room.media_id || room.embed_sources;
            parseMediaParams(effectiveMediaKey);

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
            const nativeMediaKey = effectiveMediaKey;
            if (nativeMediaKey) {
                parentRoomParams.set('media', String(nativeMediaKey));
            }
            syncParentPartyUrl(`/party?${parentRoomParams.toString()}`);
            
            connectToRealtimeRoom(room);
            updateControlsVisibility();
            updateRoomPrivacyButton();
            finishPartyBoot();
            scheduleRoomEmbedLoad();
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
                btn.addEventListener('click', () => handlePrevEpisode());
            });
            document.querySelectorAll('.party-ep-nav__btn--next').forEach((btn) => {
                btn.addEventListener('click', () => handleNextEpisode());
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

            switchStreamProvider(activeProvider);

            // 2. Update Supabase rooms record for late joiners
            if (isHost && activeRoom) {
                let nextSource;
                if (isAnime) {
                    nextSource = `anime_${mediaId}_ep${episode}`;
                } else if (isTv) {
                    nextSource = `${mediaId}_s${season}e${episode}`;
                } else {
                    nextSource = String(mediaId);
                }
                syncClient
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

        function updateControlsVisibility() {
            const controlsBar = document.querySelector('.player-controls-bar');
            if (!controlsBar) return;

            controlsBar.style.display = 'flex';

            const autoNextBtn = document.getElementById('party-auto-next-btn');
            if (autoNextBtn) autoNextBtn.style.display = 'none';

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

                const { data: rooms, error } = await syncClient
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
                const { data: room, error } = await syncClient
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

        let tmdbSearchDebounceTimer = null;
        let selectedTmdbItem = null;

        function handleTmdbSearchInput(e) {
            const query = e.target.value.trim();
            const dropdown = document.getElementById('tmdb-results-dropdown');
            
            if (tmdbSearchDebounceTimer) clearTimeout(tmdbSearchDebounceTimer);
            if (!query || query.length < 2) {
                dropdown.hidden = true;
                dropdown.innerHTML = '';
                return;
            }

            tmdbSearchDebounceTimer = setTimeout(async () => {
                try {
                    const res = await fetch(`https://hahaevilcraft.site/tmdb-api/3/search/multi?api_key=dfa4c2c7c1de1005adee824dc5593672&query=${encodeURIComponent(query)}`);
                    const data = await res.json();
                    const results = (data.results || []).filter(item => item.media_type === 'movie' || item.media_type === 'tv').slice(0, 6);

                    if (results.length === 0) {
                        dropdown.innerHTML = '<div style="padding: 0.75rem; color: var(--bone-400); font-size: 0.85rem;">No movies or TV shows found</div>';
                        dropdown.hidden = false;
                        return;
                    }

                    dropdown.innerHTML = results.map(item => {
                        const title = partyEscapeHtml(item.title || item.name || '');
                        const year = (item.release_date || item.first_air_date || '').substring(0, 4);
                        const mediaType = item.media_type.toUpperCase();
                        const posterPath = item.poster_path ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : '';
                        
                        return `
                            <div class="tmdb-result-item" onclick="selectTmdbItem(${item.id}, '${item.media_type}', '${escapeHTML(title.replace(/'/g, "\\'"))}', '${item.poster_path || ''}')">
                                ${posterPath ? `<img src="${posterPath}" class="tmdb-result-poster">` : '<div class="tmdb-result-poster-placeholder">🍿</div>'}
                                <div class="tmdb-result-info">
                                    <div class="tmdb-result-title">${title}</div>
                                    <div class="tmdb-result-meta">${mediaType} ${year ? `· ${year}` : ''}</div>
                                </div>
                            </div>
                        `;
                    }).join('');
                    dropdown.hidden = false;
                } catch (err) {
                    console.warn('TMDB search error:', err);
                }
            }, 300);
        }

        window.selectTmdbItem = function(tmdbId, mediaType, title, posterPath) {
            selectedTmdbItem = { id: tmdbId, mediaType, title, posterPath };
            document.getElementById('form-movie-title').value = title;
            document.getElementById('form-room-name').value = `${title} Watch Party`;
            document.getElementById('form-tmdb-search').value = title;
            document.getElementById('tmdb-results-dropdown').hidden = true;

            // Auto-generate Moovie player embed URL if user hasn't typed a custom embed URL
            const embedInput = document.getElementById('form-embed-url');
            if (!embedInput.value.trim()) {
                if (mediaType === 'movie') {
                    embedInput.value = `${window.location.origin}/embed/movie/${tmdbId}`;
                } else {
                    embedInput.value = `${window.location.origin}/embed/tv/${tmdbId}/1/1`;
                }
            }
        };

        // Create Room logic
        async function handleCreateRoom(e) {
            e.preventDefault();
            const name = document.getElementById('form-room-name').value.trim();
            const movieTitle = document.getElementById('form-movie-title').value.trim();
            let embedUrl = document.getElementById('form-embed-url').value.trim();

            if (!embedUrl && selectedTmdbItem) {
                if (selectedTmdbItem.mediaType === 'movie') {
                    embedUrl = `${window.location.origin}/embed/movie/${selectedTmdbItem.id}`;
                } else {
                    embedUrl = `${window.location.origin}/embed/tv/${selectedTmdbItem.id}/1/1`;
                }
            }

            const shortCode = generateShortCode();
            const uuid = shortCodeToUuid(shortCode);

            try {
                const { data: room, error } = await syncClient
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
            const { error } = await syncClient
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
                const { error } = await syncClient
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

            stopPresenceHeartbeat();
            stopRoomActivityHeartbeat();

            if (purgeChatIfLast && roomId) {
                const state = channel.presenceState();
                if (countPresenceMembers(state) <= 1) {
                    await purgePartyChat(roomId);
                }
            }

            syncClient.removeChannel(channel);
            channel = null;
        }

        // Realtime social communication via WebSockets
        async function connectToRealtimeRoom(room) {
            await leaveCurrentPartyRoom({ purgeChatIfLast: true });

            resetChatPanel();

            touchRoomActivity(room.id);
            startRoomActivityHeartbeat(room.id);

            // Chat & User presence channels
            channel = syncClient.channel(`party_room_${room.id}`, {
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
                    switchStreamProvider(activeProvider);
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
                    if (document.documentElement.classList.contains('party-native-mode')) {
                        window.parent.postMessage({
                            type: 'moovie-command-sync',
                            time: data.time,
                            playing: data.playing,
                            event: data.event,
                            force: data.event === 'seek' || data.event === 'play' || data.event === 'pause'
                        }, window.location.origin);
                    } else if (iframe && iframe.contentWindow) {
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
                    if (!isHost) return;
                    if (activeProvider !== 'moovie') return;
                    const data = payload.payload || {};
                    if (data.sender === currentUserName) return;

                    // Ask our player for a fresh position instead of relying on the
                    // (up to 3s stale) cached heartbeat time. The player replies
                    // with an immediate heartbeat that updates lastMooviePlayerTime.
                    const iframe = document.getElementById('video-player-iframe');
                    if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.postMessage({ type: 'moovie-sync-poll' }, '*');
                    }
                    setTimeout(() => {
                        if (!channel) return;
                        const syncTime = clampSyncTime(lastMooviePlayerTime ?? 0);
                        const syncPlaying = lastMooviePlayerPlaying ?? false;
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
                    }, 150);
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
                    if (!channel) return;
                    const state = channel.presenceState();
                    updateUsersCount(state);
                    broadcastLobbyParticipantCount(channel, state);
                })
                .on('presence', { event: 'update' }, () => {
                    if (!channel) return;
                    const state = channel.presenceState();
                    updateUsersCount(state);
                })
                .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                    if (isLobbyObserverKey(key)) return;
                    if (!channel) return;
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
                    if (!channel) return;
                    const state = channel.presenceState();
                    updateUsersCount(state);
                    broadcastLobbyParticipantCount(channel, state);
                    maybePurgePartyChatWhenEmpty(state);
                    const name = displayNameFromPresence(key, leftPresences);
                    if (name !== currentUserName) {
                        appendChatMessage('System', `${name} left the watch party.`, 'system');
                    }
                })
                .on('presence', { event: 'host-elected' }, ({ key, payload }) => {
                    if (!channel) return;
                    const state = channel.presenceState();
                    updateUsersCount(state);
                    const name = payload && payload.user ? payload.user : 'A member';
                    if (key === getPresenceKey()) {
                        // We've been elected — take over host duties.
                        isHost = true;
                        if (activeRoom) activeRoom.host = currentUserName;
                        void syncPresenceTrack();
                        updateRoomPrivacyButton();
                        appendChatMessage('System', '\ud83d\udc51 You are now the host.', 'system');
                        // Give the re-track a beat to land, then refresh the crown.
                        setTimeout(() => {
                            if (channel) updateParticipantsPanel(channel.presenceState());
                        }, 600);
                        // Force-seek guests to our position now that we host.
                        if (activeProvider === 'moovie' && channel) {
                            setTimeout(() => {
                                if (channel && activeProvider === 'moovie') {
                                    channel.send({
                                        type: 'broadcast',
                                        event: 'moovie_playback_sync',
                                        payload: {
                                            event: 'seek',
                                            time: lastMooviePlayerTime ?? 0,
                                            playing: lastMooviePlayerPlaying ?? false,
                                            sender: currentUserName
                                        }
                                    });
                                }
                            }, 1200);
                        }
                    } else {
                        if (activeRoom && payload && payload.user) activeRoom.host = payload.user;
                        updateParticipantsPanel(state);
                        appendChatMessage('System', `\ud83d\udc51 ${name} is now the host.`, 'system');
                    }
                });

            channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await syncPresenceTrack();
                    startPresenceHeartbeat();
                    const state = channel.presenceState();
                    updateUsersCount(state);
                    broadcastLobbyParticipantCount(channel, state);
                    updateRoomPrivacyButton();

                    // Load past chat messages for late joiners
                    await loadPartyChatHistory(room.id);

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
                const { data, error } = await syncClient.storage
                    .from('chat-images')
                    .upload(fileName, blob, {
                        contentType: 'image/jpeg',
                        cacheControl: '3600'
                    });

                if (error) {
                    console.warn('Storage upload error, using Base64 fallback:', error);
                    return base64Str;
                }

                const { data: { publicUrl } } = syncClient.storage
                    .from('chat-images')
                    .getPublicUrl(fileName);
                return publicUrl;
            } catch (err) {
                console.warn('Storage exception, using Base64 fallback:', err);
                return base64Str;
            }
        }

        const MAX_CHAT_DOM_BUBBLES = 100;
        const MAX_CHAT_MESSAGE_LENGTH = 1000;

        function escapeHTML(str) {
            if (typeof str !== 'string') return '';
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function trimChatBoxBubbles(box) {
            if (!box) return;
            while (box.children.length > MAX_CHAT_DOM_BUBBLES) {
                box.removeChild(box.firstChild);
            }
        }

        async function loadPartyChatHistory(roomId) {
            if (!roomId) return;
            try {
                const { data, error } = await syncClient
                    .from('party_chat_messages')
                    .select('user_name, message, image_url, created_at')
                    .eq('room_id', roomId)
                    .order('created_at', { ascending: true })
                    .limit(50);

                if (error) {
                    console.warn('Failed to load chat history:', error);
                    return;
                }

                if (data && data.length > 0) {
                    const box = document.getElementById('chat-box');
                    data.forEach((item) => {
                        const type = (item.user_name === currentUserName) ? 'me' : 'other';
                        appendChatMessage(item.user_name, item.message, type, item.image_url, { skipCollapseCheck: true });
                    });
                }
            } catch (err) {
                console.warn('Error loading chat history:', err);
            }
        }

        async function handleSendChat(e) {
            e.preventDefault();
            const input = document.getElementById('chat-input');
            let val = input.value.trim();
            
            if (!val && !stagedImageBase64) return;

            if (val.length > MAX_CHAT_MESSAGE_LENGTH) {
                val = val.substring(0, MAX_CHAT_MESSAGE_LENGTH);
            }

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

            // Broadcast to everyone currently in the room.
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

        function appendChatMessage(user, msg, type, imageUrl, options = {}) {
            const box = document.getElementById('chat-box');
            if (!box) return;

            // Collapse consecutive system bubbles if text matches previous bubble
            if (type === 'system' && !options.skipCollapseCheck) {
                const lastBubble = box.lastElementChild;
                if (lastBubble && lastBubble.classList.contains('system')) {
                    if (lastBubble.textContent.trim() === String(msg).trim()) {
                        return; // Suppress duplicate consecutive system notification
                    }
                }
            }

            const bubble = document.createElement('div');
            bubble.className = `chat-bubble ${type}`;
            
            if (type === 'system') {
                bubble.textContent = msg;
            } else {
                const safeUser = escapeHTML(user);
                const safeMsg = escapeHTML(msg);
                let imgHtml = '';
                if (imageUrl) {
                    const safeImgUrl = escapeHTML(imageUrl);
                    imgHtml = `
                        <div class="chat-image-wrapper">
                            <img src="${safeImgUrl}" class="chat-msg-image" onclick="viewChatImageFull(this.src)" title="Click to view full size">
                        </div>
                    `;
                }
                bubble.innerHTML = `
                    <span class="chat-sender">${safeUser}</span>
                    ${imgHtml}
                    ${safeMsg ? `<span>${safeMsg}</span>` : ''}
                `;
            }
            
            box.appendChild(bubble);
            trimChatBoxBubbles(box);
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
                if (keyIsStale(entries)) return;
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
        // Native Watch Together shell controls call the same room actions from
        // outside this legacy chat iframe.
        window.toggleCinemaMode = toggleCinemaMode;
        window.togglePartyAutoNext = togglePartyAutoNext;
        window.copyShareLink = copyShareLink;
        window.showLobbyView = showLobbyView;
        window.toggleMakeHostMenu = toggleMakeHostMenu;


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
                if (isHost) {
                    let seekDesc = null;
                    if (data.event === 'seek') {
                        seekDesc = getSeekDescription(data.time, lastMooviePlayerTime);
                        if (seekDesc) {
                            appendChatMessage('System', `👑 You seeked ${seekDesc}`, 'system');
                        }
                    }

                    // Store the host's player time and state (clamped)
                    const clampedTime = clampSyncTime(data.time);
                    lastMooviePlayerTime = clampedTime;
                    lastMooviePlayerPlaying = data.playing;
                    if (typeof data.duration === 'number' && Number.isFinite(data.duration) && data.duration > 0) {
                        lastMooviePlayerDuration = data.duration;
                    }

                    // Broadcast the event to guests
                    if (channel) {
                        channel.send({
                            type: 'broadcast',
                            event: 'moovie_playback_sync',
                            payload: {
                                event: data.event,
                                time: clampedTime,
                                playing: data.playing,
                                sender: currentUserName,
                                seekDesc: seekDesc
                            }
                        });
                    }
                }
            } else if (data.event === 'ready') {
                // Guest player loaded: request the latest state from the host
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
                        const { data: room, error } = await syncClient
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
