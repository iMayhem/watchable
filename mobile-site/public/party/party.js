
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

        // Supabase Dynamic configuration
        const defaultUrl = 'https://eeyiragtylotiwozbgqp.supabase.co';
        const defaultKey = safeLocalStorage.getItem('supabase_anon_key') || ''; // Overrides can be in localStorage

        // Parse query params (Direct Join or Stream details transfer)
        const urlParams = new URLSearchParams(window.location.search);
        let joinRoomId = urlParams.get('room') || '';
        const prefillTitle = urlParams.get('title') || '';

        // Parsing room parameter for custom player URLs
        let isAnime = false;
        let isTv = false;
        let mediaId = joinRoomId;
        let season = 1;
        let episode = 1;

        function parseMediaParams(idString) {
            isAnime = idString.startsWith('anime_') || idString.includes('_ep');
            isTv = idString.includes('_s') && !isAnime;
            mediaId = idString;
            season = 1;
            episode = 1;

            if (isAnime) {
                const cleanId = idString.replace('anime_', '');
                if (cleanId.includes('_ep')) {
                    const parts = cleanId.split('_ep');
                    mediaId = parts[0];
                    episode = parseInt(parts[1]) || 1;
                } else {
                    mediaId = cleanId;
                }
            } else if (isTv) {
                const parts = idString.split('_s');
                mediaId = parts[0];
                const epParts = parts[1].split('e');
                season = parseInt(epParts[0]) || 1;
                episode = parseInt(epParts[1]) || 1;
            }
        }

        // Available Stream Servers
        const serversList = [
            { id: 'rasmalai', name: 'Rasmalai', movie: 'https://peachify.top/embed/movie/{tmdbId}?server=sweet', tv: 'https://peachify.top/embed/tv/{tmdbId}/{season}/{episode}?server=sweet' },
            { id: 'cinemaos', name: 'Gulab Jamun', movie: 'https://cinemaos.tech/player/{tmdbId}', tv: 'https://cinemaos.tech/player/{tmdbId}/{season}/{episode}' },
            { id: 'smashy', name: 'Jalebi', movie: 'https://player.smashystream.com/movie/{tmdbId}?autoplay=true', tv: 'https://player.smashystream.com/tv/{tmdbId}?s={season}&e={episode}' },
            { id: 'vidking', name: 'Kheer', movie: 'https://www.vidking.net/embed/movie/{tmdbId}?autoPlay=true', tv: 'https://www.vidking.net/embed/tv/{tmdbId}/{season}/{episode}?autoPlay=true' },
            { id: 'vidlink', name: 'Cham Cham', movie: 'https://vidlink.pro/movie/{tmdbId}?primaryColor=6366f1', tv: 'https://vidlink.pro/tv/{tmdbId}/{season}/{episode}?primaryColor=6366f1' },
            { id: 'videasy', name: 'Barfi', movie: 'https://player.videasy.net/movie/{tmdbId}?color=6366f1', tv: 'https://player.videasy.net/tv/{tmdbId}/{season}/{episode}?color=6366f1' },
            { id: 'vidsrc', name: 'VidSrc (to)', movie: 'https://vidsrc.to/embed/movie/{tmdbId}', tv: 'https://vidsrc.to/embed/tv/{tmdbId}/{season}/{episode}' },
            { id: 'vidsrc_ru', name: 'Laddu', movie: 'https://vidsrc-embed.ru/embed/movie/{tmdbId}', tv: 'https://vidsrc-embed.ru/embed/tv/{tmdbId}/{season}/{episode}' },
            { id: 'vidsrc_su', name: 'Peda', movie: 'https://vidsrc-embed.su/embed/movie/{tmdbId}', tv: 'https://vidsrc-embed.su/embed/tv/{tmdbId}/{season}/{episode}' },
            { id: 'vidsrcme', name: 'Gajar Ka Halwa', movie: 'https://vidsrcme.su/embed/movie/{tmdbId}', tv: 'https://vidsrcme.su/embed/tv/{tmdbId}/{season}/{episode}' },
            { id: 'multiembed', name: 'Soan Papdi', movie: 'https://multiembed.mov/?video_id={tmdbId}&tmdb=1', tv: 'https://multiembed.mov/?video_id={tmdbId}&tmdb=1&s={season}&e={episode}' },
            { id: 'vsrc', name: 'Sandesh', movie: 'https://vsrc.su/embed/movie/{tmdbId}', tv: 'https://vsrc.su/embed/tv/{tmdbId}/{season}/{episode}' },
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
                if (channel) {
                    channel.track({ user: currentUserName, joinedAt: new Date().toISOString() });
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
            document.body.classList.remove('room-view-active');
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            
            document.getElementById('form-room-name').value = `${currentUserName}'s Watch Lounge`;
            document.getElementById('form-movie-title').value = title;
            document.getElementById('form-embed-url').value = embedUrl;
            
            document.getElementById('create-view').classList.add('active');
        }

        async function showRoomView(room) {
            document.body.classList.add('room-view-active');
            document.body.classList.add('cinema-mode'); // Auto-enable Cinema Mode on room entry
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById('room-view').classList.add('active');
            
            // Resolve media params and URLs first
            parseMediaParams(room.embed_sources);

            // Update Banner details
            updateBannerText();
            
            // Populate server dropdown
            populateServerDropdown();
            
            // Select default provider and load iframe
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
            menu.innerHTML = serversList.map(srv => `
                <button class="server-dropdown-item ${srv.id === activeProvider ? 'active' : ''}" onclick="switchStreamProvider('${srv.id}')">
                    ${srv.name}
                </button>
            `).join('');
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
                newIframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');

                const lowerUrl = embedUrl.toLowerCase();
                if (
                    lowerUrl.includes('cinemaos.tech') ||
                    lowerUrl.includes('smashystream.com') ||
                    lowerUrl.includes('animeplay.cfd')
                ) {
                    newIframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
                }

                newIframe.src = embedUrl;
                parent.replaceChild(newIframe, oldIframe);
            }
        }

        function getEmbedUrlForServer(srv, tmdbId, isTvShow, s, e) {
            if (isAnime) {
                if (activeProvider === 'videasy') {
                    // Check if anime is movie or series in rooms record
                    const isAnimeMovie = !activeRoom?.embed_sources?.includes('_ep');
                    return isAnimeMovie
                        ? `https://player.videasy.net/anime/${tmdbId}?color=E05A47&autoplayNextEpisode=true&overlay=true`
                        : `https://player.videasy.net/anime/${tmdbId}/${e}?color=E05A47&autoplayNextEpisode=true&overlay=true`;
                }
                const lang = (activeProvider === 'animeplay_dub' || activeProvider === 'megaplay_dub') ? 'dub' : 'sub';
                const domain = (activeProvider === 'megaplay_sub' || activeProvider === 'megaplay_dub') ? 'https://megaplay.buzz' : 'https://animeplay.cfd';
                return `${domain}/stream/ani/${tmdbId}/${e}/${lang}`;
            }
            let template = isTvShow ? srv.tv : srv.movie;
            return template
                .replaceAll('{tmdbId}', tmdbId)
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
                dot.style.background = 'var(--violet)';
                dot.style.boxShadow = '0 0 6px var(--violet)';
                btn.style.borderColor = 'rgba(139, 92, 246, 0.4)';
            } else {
                dot.style.background = '#6b7280';
                dot.style.boxShadow = 'none';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            }
        }

        function handlePrevEpisode() {
            if (!isHost) {
                alert('Only the party host can change episodes!');
                return;
            }
            if (episode > 1) {
                changePartyEpisode(episode - 1);
            }
        }

        function handleNextEpisode() {
            if (!isHost) {
                alert('Only the party host can change episodes!');
                return;
            }
            changePartyEpisode(episode + 1);
        }

        function changePartyEpisode(nextEp) {
            episode = nextEp;
            
            // Update UI Banner Text
            updateBannerText();

            // 1. Switch local iframe src
            switchStreamProvider(activeProvider);

            // 2. Update Supabase rooms record for late joiners
            if (isHost && activeRoom) {
                const nextSource = isAnime ? `anime_${mediaId}_ep${episode}` : `${mediaId}_s${season}e${episode}`;
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
                    payload: { episode: episode }
                });
            }

            appendChatMessage('System', `You advanced the watch party to Episode ${episode}!`, 'system');
        }

        function updateControlsVisibility() {
            const controlsBar = document.querySelector('.player-controls-bar');
            controlsBar.style.display = 'flex';
            
            const autoNextBtn = document.getElementById('party-auto-next-btn');
            const prevBtn = document.getElementById('party-prev-btn');
            const nextBtn = document.getElementById('party-next-btn');
            
            if (isAnime || isTv) {
                autoNextBtn.style.display = 'flex';
                prevBtn.style.display = 'inline-block';
                nextBtn.style.display = 'inline-block';
            } else {
                autoNextBtn.style.display = 'none';
                prevBtn.style.display = 'none';
                nextBtn.style.display = 'none';
            }
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
                updatedTitle = `${baseTitle} - Episode ${episode}`;
            }
            
            document.getElementById('banner-playing-text').textContent = `🍿 Watching: ${updatedTitle}`;
            const titleEl = document.getElementById('room-playing-title');
            if (titleEl) {
                titleEl.textContent = updatedTitle;
            }
        }

        // Copy shared link
        function copyShareLink() {
            if (!activeRoom) return;
            const displayId = uuidToShortCode(activeRoom.id) || activeRoom.id;
            const shareUrl = `${window.location.origin}${window.location.pathname}?room=${displayId}`;
            navigator.clipboard.writeText(shareUrl).then(() => {
                const btn = document.getElementById('share-link-btn');
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
                            <span class="room-participants">👥 Open lobby</span>
                            <button class="btn btn-primary" onclick="joinExistingRoom('${room.id}')">Join Party</button>
                        </div>
                    </div>
                `).join('');

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
                isHost = false;
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
                isHost = true;
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
                    const nextEp = payload.payload.episode;
                    episode = nextEp;
                    updateBannerText();
                    switchStreamProvider(activeProvider);
                    appendChatMessage('System', `The host advanced the watch party to Episode ${nextEp}!`, 'system');
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

            if (joinRoomId) {
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(joinRoomId);
                const isShortCode = /^[a-z0-9]{5,6}$/i.test(joinRoomId);
                
                if (isUuid) {
                    joinExistingRoom(joinRoomId);
                } else if (isShortCode) {
                    // It's a short code! Try to find the corresponding UUID room
                    const codeUuid = shortCodeToUuid(joinRoomId);
                    try {
                        const { data: room, error } = await supabaseClient
                            .from('rooms')
                            .select('*')
                            .eq('id', codeUuid)
                            .single();
                        
                        if (!error && room) {
                            activeRoom = room;
                            isHost = false;
                            showRoomView(room);
                        } else {
                            alert('Party room not found or has been closed.');
                            showLobbyView();
                        }
                    } catch (err) {
                        alert('Party room not found or has been closed.');
                        showLobbyView();
                    }
                } else {
                    // TMDb ID. Let's automatically check if a room already exists.
                    try {
                        const { data: existingRooms, error } = await supabaseClient
                            .from('rooms')
                            .select('*')
                            .eq('embed_sources', joinRoomId)
                            .order('created_at', { ascending: false });

                        if (!error && existingRooms && existingRooms.length > 0) {
                            const room = existingRooms[0];
                            activeRoom = room;
                            isHost = false;
                            showRoomView(room);
                        } else {
                            // Check if bot/crawler to prevent automated room insertion
                            const isBot = /bot|googlebot|crawler|spider|robot|crawling|lighthouse/i.test(navigator.userAgent) || navigator.webdriver;
                            if (isBot) {
                                console.log('Bot detected. Skipping automatic room creation.');
                                showLobbyView();
                            } else {
                                // Real user! Auto-create the room instantly with zero resistance
                                const roomName = `${currentUserName}'s Watch Lounge`;
                                const shortCode = generateShortCode();
                                const uuid = shortCodeToUuid(shortCode);
                                const { data: newRoom, error: createError } = await supabaseClient
                                    .from('rooms')
                                    .insert([{
                                        id: uuid,
                                        name: roomName,
                                        movie_title: prefillTitle || 'Feature Title',
                                        embed_sources: joinRoomId,
                                        scheduled_start_time: new Date().toISOString()
                                    }])
                                    .select()
                                    .single();

                                if (createError) throw createError;

                                activeRoom = newRoom;
                                isHost = true;
                                showRoomView(newRoom);
                            }
                        }
                    } catch (err) {
                        console.error('Error auto-resolving watch party room:', err);
                        showLobbyView();
                    }
                }
            } else {
                // No room parameter - show lobby
                showLobbyView();
            }
        });
    