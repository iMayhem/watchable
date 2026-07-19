// ── Safe localStorage ──
const safeLocalStorage = {
    getItem(key) { try { return localStorage.getItem(key); } catch { return null; } },
    setItem(key, value) { try { localStorage.setItem(key, value); } catch {} }
};
const safeSessionStorage = {
    getItem(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
    setItem(key, value) { try { sessionStorage.setItem(key, value); } catch {} }
};

// ── Config ──
const SUPABASE_URL = 'https://idwjvciofkvspmumgzmg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlkd2p2Y2lvZmt2c3BtdW1nem1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0NjkzNTAsImV4cCI6MjEwMDA0NTM1MH0.MY7UGcPNR3k1-WhdTPN5Mh7bwH_6ACD1XjKBoKb84cU';
const YOUTUBE_API_KEYS_STORAGE_KEY = 'yt_api_keys';
const YT_KEY_FAILED_INDEX_KEY = 'yt_key_failed_index';
const GLOBAL_ROOM_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const SKIP_THRESHOLD = 0.5;

let supabaseClient;
let channel = null;
let currentUserName = '';
let activeRoom = null;
let presenceSessionId = '';
let ytPlayer = null;
let ytReady = false;
let isSeeking = false;
let videoQueue = [];
let skipVotes = [];
let queueAdvancing = false;
let syncInterval = null;
let initialSync = true;

// ── YouTube API Key Rotation ──
function getYoutubeApiKeys() {
    try {
        const stored = safeLocalStorage.getItem(YOUTUBE_API_KEYS_STORAGE_KEY);
        if (stored) {
            const keys = JSON.parse(stored);
            if (Array.isArray(keys) && keys.length) return keys.filter(k => k.trim());
        }
    } catch {}
    return [];
}

function getCurrentYoutubeApiKey() {
    const keys = getYoutubeApiKeys();
    if (!keys.length) return null;
    const failedIndex = parseInt(safeSessionStorage.getItem(YT_KEY_FAILED_INDEX_KEY) || '-1');
    const nextIndex = failedIndex + 1;
    if (nextIndex >= keys.length) {
        safeSessionStorage.setItem(YT_KEY_FAILED_INDEX_KEY, '-1');
        return keys[0];
    }
    return keys[nextIndex];
}

function markYoutubeKeyFailed() {
    const keys = getYoutubeApiKeys();
    if (!keys.length) return;
    const currentIdx = parseInt(safeSessionStorage.getItem(YT_KEY_FAILED_INDEX_KEY) || '-1');
    safeSessionStorage.setItem(YT_KEY_FAILED_INDEX_KEY, String(currentIdx + 1));
}

function resetYoutubeKeyFailover() {
    safeSessionStorage.setItem(YT_KEY_FAILED_INDEX_KEY, '-1');
}

async function fetchYoutubeApiKeysFromSupabase() {
    try {
        const { data } = await supabaseClient
            .from('app_settings')
            .select('value')
            .eq('key', 'youtube_api_keys')
            .single();
        if (data?.value) {
            const keys = JSON.parse(data.value);
            if (Array.isArray(keys) && keys.length) {
                safeLocalStorage.setItem(YOUTUBE_API_KEYS_STORAGE_KEY, JSON.stringify(keys));
                return keys;
            }
        }
    } catch (e) {
        console.warn('Could not fetch YouTube API keys from Supabase:', e);
    }
    return getYoutubeApiKeys();
}

// ── YouTube Search ──
async function searchYoutube() {
    const input = document.getElementById('yt-search-input');
    const query = input.value.trim();
    if (!query) return;

    const resultsContainer = document.getElementById('yt-search-results');
    resultsContainer.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--bone-400)">Searching...</div>';

    const keys = getYoutubeApiKeys();
    if (!keys.length) {
        resultsContainer.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--bone-400)">No YouTube API keys configured.</div>';
        return;
    }

    let lastError = null;
    for (let attempt = 0; attempt < keys.length; attempt++) {
        const key = getCurrentYoutubeApiKey();
        if (!key) break;
        try {
            const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(query)}&type=video&key=${key}`);
            if (res.status === 403) {
                const errBody = await res.json().catch(() => ({}));
                if (errBody?.error?.errors?.[0]?.reason === 'quotaExceeded' || errBody?.error?.errors?.[0]?.reason === 'dailyLimitExceeded') {
                    markYoutubeKeyFailed();
                    lastError = 'quota';
                    continue;
                }
                lastError = 'forbidden';
                markYoutubeKeyFailed();
                continue;
            }
            if (!res.ok) {
                lastError = `HTTP ${res.status}`;
                markYoutubeKeyFailed();
                continue;
            }
            const data = await res.json();
            resetYoutubeKeyFailover();
            renderYoutubeResults(data.items || []);
            return;
        } catch (e) {
            lastError = e.message;
            markYoutubeKeyFailed();
        }
    }

    resultsContainer.innerHTML = `<div style="padding:1rem;text-align:center;color:var(--bone-400)">
        Search failed${lastError === 'quota' ? ' — API quota exceeded.' : '. Please try again.'}
    </div>`;
}

function renderYoutubeResults(items) {
    const container = document.getElementById('yt-search-results');
    if (!items.length) {
        container.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--bone-400)">No results found.</div>';
        return;
    }
    container.innerHTML = items.map(item => {
        const videoId = item.id?.videoId || '';
        const snippet = item.snippet || {};
        const title = snippet.title || 'Untitled';
        const channel = snippet.channelTitle || '';
        const thumb = snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '';
        const published = snippet.publishedAt ? new Date(snippet.publishedAt).toLocaleDateString() : '';
        return `
            <div class="yt-result-card" onclick="selectYoutubeVideo('${videoId}','${escapeHtml(title).replace(/'/g, "\\'")}','${escapeHtml(channel).replace(/'/g, "\\'")}','${thumb}')">
                <div class="yt-result-thumb">${thumb ? `<img src="${thumb}" alt="${escapeHtml(title)}" loading="lazy">` : ''}</div>
                <div class="yt-result-info">
                    <div class="yt-result-title">${escapeHtml(title)}</div>
                    <div class="yt-result-channel">${escapeHtml(channel)}</div>
                    <div class="yt-result-meta">${published}</div>
                </div>
                <button class="yt-add-queue-btn" onclick="event.stopPropagation();selectYoutubeVideo('${videoId}','${escapeHtml(title).replace(/'/g, "\\'")}','${escapeHtml(channel).replace(/'/g, "\\'")}','${thumb}')">+ Queue</button>
            </div>
        `;
    }).join('');
}

function selectYoutubeVideo(videoId, title, channel, thumb) {
    closeYtSearch();
    addToQueue({ videoId, title: title || 'Untitled', channel: channel || '', thumb: thumb || '', addedBy: currentUserName });
}

function openYtSearch() {
    document.getElementById('yt-search-overlay').classList.add('active');
    document.getElementById('yt-search-input').focus();
    document.getElementById('yt-search-results').innerHTML = '';
}

function closeYtSearch() {
    document.getElementById('yt-search-overlay').classList.remove('active');
}

// ── YouTube Player ──
let ytPlayerApiLoaded = false;
let ytPlayerApiCallbacks = [];

function onYouTubeIframeAPIReady() {
    ytPlayerApiLoaded = true;
    ytPlayerApiCallbacks.forEach(cb => cb());
    ytPlayerApiCallbacks = [];
}

function ensureYtPlayerApi() {
    if (ytPlayerApiLoaded) return Promise.resolve();
    if (typeof YT !== 'undefined' && YT.loaded) {
        ytPlayerApiLoaded = true;
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        ytPlayerApiCallbacks.push(resolve);
        if (!document.getElementById('yt-iframe-api')) {
            const tag = document.createElement('script');
            tag.id = 'yt-iframe-api';
            tag.src = 'https://www.youtube.com/iframe_api';
            const first = document.getElementsByTagName('script')[0];
            first.parentNode.insertBefore(tag, first);
        }
    });
}

function initYtPlayer(videoId) {
    ensureYtPlayerApi().then(() => {
        if (ytPlayer) {
            ytPlayer.loadVideoById(videoId);
            return;
        }
        ytPlayer = new YT.Player('yt-player', {
            height: '100%',
            width: '100%',
            videoId: videoId || '',
            playerVars: {
                autoplay: 0,
                controls: 1,
                modestbranding: 1,
                rel: 0,
                enablejsapi: 1,
                origin: window.location.origin
            },
            events: {
                onReady: onYtPlayerReady,
                onStateChange: onYtPlayerStateChange,
                onError: onYtPlayerError
            }
        });
    });
}

function loadYoutubeVideo(videoId) {
    if (!videoId) return;
    if (ytPlayer && ytReady) {
        ytPlayer.loadVideoById(videoId);
    } else {
        initYtPlayer(videoId);
    }
    updateYtRoomVideo(videoId);
}

function onYtPlayerReady() {
    ytReady = true;
    if (activeRoom?.video_id) {
        ytPlayer.loadVideoById(activeRoom.video_id);
        if (activeRoom.current_time > 0) {
            ytPlayer.seekTo(activeRoom.current_time, true);
        }
        if (activeRoom.is_playing) {
            ytPlayer.playVideo();
        } else {
            ytPlayer.pauseVideo();
        }
    }
    setTimeout(function() { initialSync = false; }, 3000);
}

function onYtPlayerStateChange(event) {
    if (isSeeking) return;
    if (event.data === YT.PlayerState.PLAYING) {
        if (!initialSync) {
            broadcastSync('play', ytPlayer.getCurrentTime());
        }
        startSyncTimer();
    } else if (event.data === YT.PlayerState.PAUSED) {
        broadcastSync('pause', ytPlayer.getCurrentTime());
        stopSyncTimer();
    } else if (event.data === YT.PlayerState.ENDED) {
        stopSyncTimer();
        scheduleAdvanceQueue();
    }
}

function onYtPlayerError(event) {
    console.warn('YouTube player error:', event.data);
    showToast('YouTube player error.', false);
}

// ── Queue ──
function addToQueue(item) {
    if (channel) {
        channel.send({
            type: 'broadcast',
            event: 'yt-queue-add',
            payload: { item, userId: presenceSessionId }
        });
    }
    videoQueue.push(item);
    if (!activeRoom?.video_id) {
        advanceQueue();
    } else {
        renderQueue();
        updateYtRoomQueue();
        showToast(`${escapeHtml(item.title)} added to queue`);
    }
}

function handleRemoteQueueAdd(payload) {
    if (payload.userId === presenceSessionId) return;
    videoQueue.push(payload.item);
    if (!activeRoom?.video_id) {
        advanceQueue();
    } else {
        renderQueue();
    }
}

function scheduleAdvanceQueue() {
    if (queueAdvancing) return;
    queueAdvancing = true;
    setTimeout(function() {
        advanceQueue();
        queueAdvancing = false;
    }, 1500);
}

function advanceQueue() {
    if (!videoQueue.length) {
        if (ytPlayer && ytReady) {
            ytPlayer.stopVideo();
        }
        activeRoom.video_id = '';
        activeRoom.is_playing = false;
        activeRoom.current_time = 0;
        skipVotes = [];
        if (channel) {
            channel.send({
                type: 'broadcast',
                event: 'yt-queue-next',
                payload: { item: null, remainingQueue: [], userId: presenceSessionId }
            });
        }
        updateYtRoomQueue();
        renderQueue();
        renderSkipButton();
        return;
    }
    const nextItem = videoQueue.shift();
    if (channel) {
        channel.send({
            type: 'broadcast',
            event: 'yt-queue-next',
            payload: { item: nextItem, remainingQueue: videoQueue, userId: presenceSessionId }
        });
    }
    applyQueueNext(nextItem);
    updateYtRoomQueue();
    renderQueue();
}

function handleRemoteQueueNext(payload) {
    if (payload.userId === presenceSessionId) return;
    queueAdvancing = false;
    videoQueue = payload.remainingQueue || [];
    skipVotes = [];
    if (!payload.item) {
        if (ytPlayer && ytReady) ytPlayer.stopVideo();
        activeRoom.video_id = '';
        activeRoom.is_playing = false;
        activeRoom.current_time = 0;
        renderQueue();
        renderSkipButton();
        return;
    }
    applyQueueNext(payload.item);
    renderQueue();
}

function applyQueueNext(item) {
    loadYoutubeVideo(item.videoId);
    activeRoom.video_id = item.videoId;
    activeRoom.is_playing = true;
    activeRoom.current_time = 0;
    skipVotes = [];
    renderSkipButton();
}

function updateYtRoomQueue() {
    if (!activeRoom) return;
    try {
        supabaseClient.from('youtube_rooms').update({
            video_id: activeRoom.video_id || '',
            is_playing: activeRoom.is_playing || false,
            current_time: activeRoom.current_time || 0,
            queue: JSON.stringify(videoQueue),
            skip_votes: JSON.stringify(skipVotes),
            last_updated: new Date().toISOString()
        }).eq('id', activeRoom.id).then(function() {}).catch(function() {});
    } catch (e) {}
}

async function updateYtRoomVideo(videoId) {
    if (!activeRoom) return;
    activeRoom.video_id = videoId;
    activeRoom.current_time = 0;
    try {
        await supabaseClient.from('youtube_rooms').update({
            video_id: videoId,
            current_time: 0,
            queue: JSON.stringify(videoQueue),
            skip_votes: JSON.stringify(skipVotes),
            last_updated: new Date().toISOString()
        }).eq('id', activeRoom.id);
    } catch (e) {}
}

function renderQueue() {
    const container = document.getElementById('queue-list');
    if (!container) return;
    if (!videoQueue.length) {
        container.innerHTML = '<div class="queue-empty">Queue is empty. Search and add videos!</div>';
        return;
    }
    container.innerHTML = videoQueue.map(function(item, i) {
        const thumb = item.thumb || '';
        const title = escapeHtml(item.title || 'Untitled');
        const channel = escapeHtml(item.channel || '');
        const addedBy = escapeHtml(item.addedBy || 'Someone');
        const canRemove = item.addedBy === currentUserName;
        return `
            <div class="queue-item">
                <div class="queue-item-thumb">${thumb ? `<img src="${thumb}" alt="${title}" loading="lazy">` : '<div class="queue-item-thumb--empty"></div>'}</div>
                <div class="queue-item-info">
                    <div class="queue-item-title">${title}</div>
                    <div class="queue-item-channel">${channel}</div>
                    <div class="queue-item-added">by ${addedBy}</div>
                </div>
                ${canRemove ? `<button class="queue-item-remove" onclick="removeFromQueue(${i})">&times;</button>` : ''}
            </div>
        `;
    }).join('');
    const count = document.getElementById('queue-count');
    if (count) count.textContent = String(videoQueue.length);
}

function removeFromQueue(index) {
    if (index < 0 || index >= videoQueue.length) return;
    const item = videoQueue[index];
    if (item.addedBy !== currentUserName) return;
    videoQueue.splice(index, 1);
    if (channel) {
        channel.send({
            type: 'broadcast',
            event: 'yt-queue-update',
            payload: { queue: videoQueue, userId: presenceSessionId }
        });
    }
    renderQueue();
    updateYtRoomQueue();
}

function handleRemoteQueueUpdate(payload) {
    if (payload.userId === presenceSessionId) return;
    videoQueue = payload.queue;
    renderQueue();
}

// ── Skip Voting ──
function voteSkip() {
    if (!activeRoom?.video_id) return;
    if (skipVotes.includes(presenceSessionId)) return;
    skipVotes.push(presenceSessionId);
    if (channel) {
        channel.send({
            type: 'broadcast',
            event: 'yt-vote-skip',
            payload: { sessionId: presenceSessionId, votes: skipVotes, userId: presenceSessionId }
        });
    }
    checkSkipThreshold();
}

function handleRemoteVoteSkip(payload) {
    if (payload.userId === presenceSessionId) return;
    if (!skipVotes.includes(payload.sessionId)) {
        skipVotes.push(payload.sessionId);
    }
    checkSkipThreshold();
}

function checkSkipThreshold() {
    renderSkipButton();
    const state = channel ? channel.presenceState() : {};
    const total = Math.max(Object.keys(state).length, 1);
    if (skipVotes.length / total >= SKIP_THRESHOLD && videoQueue.length) {
        advanceQueue();
    }
}

function renderSkipButton() {
    const el = document.getElementById('skip-btn');
    if (!el) return;
    if (!activeRoom?.video_id) {
        el.style.display = 'none';
        return;
    }
    el.style.display = 'inline-flex';
    const state = channel ? channel.presenceState() : {};
    const total = Math.max(Object.keys(state).length, 1);
    el.textContent = `Skip (${skipVotes.length}/${Math.ceil(total * SKIP_THRESHOLD)})`;
}

// ── Sync ──
function startSyncTimer() {
    if (syncInterval) return;
    syncInterval = setInterval(function() {
        if (!ytPlayer || !ytReady || !activeRoom) return;
        const state = ytPlayer.getPlayerState();
        if (state !== YT.PlayerState.PLAYING && state !== YT.PlayerState.PAUSED) return;
        const time = Math.round(ytPlayer.getCurrentTime());
        const isPlaying = state === YT.PlayerState.PLAYING;
        activeRoom.current_time = time;
        activeRoom.is_playing = isPlaying;
        supabaseClient.from('youtube_rooms').update({
            current_time: time,
            is_playing: isPlaying,
            last_updated: new Date().toISOString()
        }).eq('id', activeRoom.id).then(function() {}).catch(function() {});
    }, 3000);
}

function stopSyncTimer() {
    if (!syncInterval) return;
    clearInterval(syncInterval);
    syncInterval = null;
}

function broadcastSync(action, time) {
    if (!activeRoom || !channel) return;
    channel.send({
        type: 'broadcast',
        event: 'yt-sync',
        payload: { action, time: Math.round(time || 0), userId: presenceSessionId }
    });
}

function handleRemoteSync(payload) {
    if (!ytPlayer || !ytReady) return;
    if (payload.userId === presenceSessionId) return;
    const action = payload.action;
    const time = payload.time;
    if (action === 'play') {
        const currentTime = ytPlayer.getCurrentTime();
        if (Math.abs(currentTime - time) > 1.5) {
            ytPlayer.seekTo(time, true);
        }
        ytPlayer.playVideo();
    } else if (action === 'pause') {
        ytPlayer.pauseVideo();
    } else if (action === 'seek') {
        ytPlayer.seekTo(time, true);
    }
}

// ── Chat ──
function appendChatMessage(userName, message, type) {
    const box = document.getElementById('chat-box');
    if (!box) return;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${type || 'other'}`;
    if (type !== 'system') {
        const sender = document.createElement('div');
        sender.className = 'chat-sender';
        sender.textContent = userName;
        bubble.appendChild(sender);
    }
    const text = document.createElement('div');
    text.textContent = message;
    bubble.appendChild(text);
    box.appendChild(bubble);
    box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
}

async function handleSendChat(event) {
    event.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message || !activeRoom) return;

    appendChatMessage(currentUserName, message, 'me');
    input.value = '';
    input.focus();
    if (channel) {
        channel.send({
            type: 'broadcast',
            event: 'yt-chat',
            payload: { user_name: currentUserName, message, userId: presenceSessionId }
        });
    }
    try {
        await supabaseClient.from('yt_chat_messages').insert({
            room_id: activeRoom.id, user_name: currentUserName, message
        });
    } catch (e) {
        console.warn('[chat] db insert failed (non-critical):', e.message || e);
    }
}

async function loadChatHistory() {
    try {
        const { data, error } = await supabaseClient
            .from('yt_chat_messages')
            .select('*')
            .eq('room_id', GLOBAL_ROOM_ID)
            .order('created_at', { ascending: true })
            .limit(50);
        if (error) throw error;
        if (data) {
            data.forEach(function(msg) {
                appendChatMessage(msg.user_name, msg.message, msg.user_name === currentUserName ? 'me' : 'other');
            });
        }
    } catch (e) {
        console.warn('[chat] failed to load history:', e.message || e);
    }
}

function insertEmoji(emoji) {
    const input = document.getElementById('chat-input');
    input.value += emoji;
    input.focus();
    toggleEmojiPicker(null, true);
}

function toggleEmojiPicker(event, forceClose) {
    const picker = document.getElementById('chat-emoji-picker');
    if (!picker) return;
    if (forceClose) { picker.classList.remove('active'); return; }
    picker.classList.toggle('active');
}

// ── Supabase ──
function initSupabase() {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

// ── Global Room ──
async function refreshRoomState() {
    try {
        const { data, error } = await supabaseClient
            .from('youtube_rooms')
            .select('current_time, is_playing, video_id')
            .eq('id', GLOBAL_ROOM_ID)
            .maybeSingle();
        if (data && !error) {
            activeRoom.current_time = data.current_time || 0;
            activeRoom.is_playing = data.is_playing;
            if (data.video_id) activeRoom.video_id = data.video_id;
        }
    } catch (e) {
        console.warn('[sync] refreshRoomState failed:', e.message || e);
    }
}

async function ensureGlobalRoom() {
    try {
        const { data, error } = await supabaseClient
            .from('youtube_rooms')
            .select('*')
            .eq('id', GLOBAL_ROOM_ID)
            .maybeSingle();

        if (data) {
            activeRoom = data;
            try { videoQueue = JSON.parse(data.queue || '[]'); } catch(e) { videoQueue = []; }
            try { skipVotes = JSON.parse(data.skip_votes || '[]'); } catch(e) { skipVotes = []; }
        } else {
            const newRoom = {
                id: GLOBAL_ROOM_ID,
                name: 'Global YouTube Party',
                video_id: '',
                title: '',
                started_by: currentUserName,
                is_playing: true,
                current_time: 0,
                queue: JSON.stringify([]),
                skip_votes: JSON.stringify([]),
                created_at: new Date().toISOString(),
                last_updated: new Date().toISOString()
            };
            const { error: insertError } = await supabaseClient
                .from('youtube_rooms')
                .insert([newRoom]);
            if (insertError) throw insertError;
            activeRoom = newRoom;
            videoQueue = [];
            skipVotes = [];
        }
    } catch (e) {
        console.warn('Failed to setup global room:', e);
        showToast('Failed to connect to YouTube Party', false);
        return;
    }

    showRoomView(activeRoom);
    joinRealtimeChannel(activeRoom.id);
    loadChatHistory();
    await refreshRoomState();
    initYtPlayer(activeRoom.video_id || '');
    renderQueue();
    renderSkipButton();
}

function extractYoutubeVideoId(input) {
    if (!input) return null;
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match) return match[1];
    }
    return null;
}

function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

// ── Realtime ──
function joinRealtimeChannel(roomId) {
    if (channel) {
        supabaseClient.removeChannel(channel);
    }
    presenceSessionId = generateId();

    channel = supabaseClient.channel(`yt-room-${roomId}`, {
        config: { broadcast: { ack: false } }
    });

    channel.on('broadcast', { event: 'yt-sync' }, ({ payload }) => {
        handleRemoteSync(payload);
    });

    channel.on('broadcast', { event: 'yt-queue-add' }, ({ payload }) => {
        handleRemoteQueueAdd(payload);
    });

    channel.on('broadcast', { event: 'yt-queue-next' }, ({ payload }) => {
        handleRemoteQueueNext(payload);
    });

    channel.on('broadcast', { event: 'yt-queue-update' }, ({ payload }) => {
        handleRemoteQueueUpdate(payload);
    });

    channel.on('broadcast', { event: 'yt-vote-skip' }, ({ payload }) => {
        handleRemoteVoteSkip(payload);
    });

    channel.on('broadcast', { event: 'yt-chat' }, ({ payload }) => {
        if (payload.userId !== presenceSessionId) {
            appendChatMessage(payload.user_name, payload.message, 'other');
        }
    });

    channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        const countEl = document.getElementById('chat-online-count');
        if (countEl) countEl.textContent = String(count);
        renderSkipButton();
        renderPresenceFaces(Object.values(state).flatMap(function(p) { return p; }).filter(Boolean));
    });

    channel.on('presence', { event: 'join' }, ({ key }) => {
        if (key !== presenceSessionId) {
            appendChatMessage('System', 'Someone joined the party', 'system');
        }
    });

    channel.on('presence', { event: 'leave' }, ({ key }) => {
        appendChatMessage('System', 'Someone left the party', 'system');
    });

    channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            await channel.track({
                user: currentUserName,
                joinedAt: new Date().toISOString(),
                sessionId: presenceSessionId
            });
        }
    });
}

// ── Presence Faces ──
const FACE_COLORS = ['#ff5a1f','#e84817','#ff8a00','#6ba368','#4a9eff','#b47aff','#ff6b9d','#ffd93d'];

function renderPresenceFaces(users) {
    const container = document.getElementById('presence-faces');
    if (!container) return;
    const maxFaces = 5;
    const visible = users.slice(0, maxFaces);
    const remaining = users.length - maxFaces;
    let html = '';
    visible.forEach(function(u, i) {
        const name = u.user || 'Anonymous';
        const initial = name.charAt(0).toUpperCase();
        const color = FACE_COLORS[i % FACE_COLORS.length];
        html += `<div class="pf-avatar" style="background:${color}" title="${escapeHtml(name)}">${initial}</div>`;
    });
    if (remaining > 0) {
        html += `<div class="pf-avatar pf-avatar--overflow">+${remaining}</div>`;
    }
    container.innerHTML = html;
}

// ── Navigation ──
function showRoomView(room) {
    document.getElementById('room-view').classList.add('active');
    document.body.classList.add('room-view-active');
    const nameEl = document.getElementById('chat-my-name');
    if (nameEl) nameEl.textContent = currentUserName;
}

function toggleCinemaMode() {
    document.body.classList.toggle('cinema-mode');
}

function showToast(message, isSuccess = true) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${isSuccess ? 'success' : 'error'}`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── Share ──
function copyShareLink() {
    const url = `${window.location.origin}/youtube-party`;
    navigator.clipboard.writeText(url).then(() => {
        showToast('Invite link copied!');
    }).catch(() => {
        showToast('Failed to copy link', false);
    });
}

// ── Headless / Parent sync ──
function isPartyEmbedded() {
    if (new URLSearchParams(window.location.search).get('embedded') === '1') return true;
    try { return window.self !== window.top; } catch { return false; }
}

const partyEmbedded = isPartyEmbedded();

function navigateParentSite(path, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!partyEmbedded) { window.location.href = path; return false; }
    try { window.parent.postMessage({ type: 'watchable-site-nav', path }, window.location.origin); } catch {
        window.location.href = path;
    }
    return false;
}

window.navigateParentSite = navigateParentSite;

// ── Username ──
function getOrCreateUsername() {
    let name = safeLocalStorage.getItem('watchable_username');
    if (!name || name === 'null' || name.trim() === '') {
        const guests = ['MovieBuff', 'StreamQueen', 'BingeWatcher', 'PopcornLover', 'FilmNerd', 'SeriesFan', 'AnimeFan', 'CasualViewer'];
        name = guests[Math.floor(Math.random() * guests.length)] + Math.floor(Math.random() * 1000);
        safeLocalStorage.setItem('watchable_username', name);
    }
    return name;
}

// ── Initialization ──
async function init() {
    currentUserName = getOrCreateUsername();

    initSupabase();

    await fetchYoutubeApiKeysFromSupabase();

    const urlParams = new URLSearchParams(window.location.search);
    const videoParam = urlParams.get('video');
    const directVideoId = videoParam ? extractYoutubeVideoId(videoParam) : null;

    const userEl = document.getElementById('header-user');
    if (userEl) {
        userEl.innerHTML = `<span class="eyebrow watching-as-badge">🎥 <strong>${escapeHtml(currentUserName)}</strong></span>`;
    }

    await ensureGlobalRoom();

    if (directVideoId) {
        addToQueue({ videoId: directVideoId, title: 'YouTube Video', channel: '', thumb: '', addedBy: currentUserName });
    }

    finishYtBoot();
}

function finishYtBoot() {
    document.body.classList.remove('yt-booting');
}

// ── Start ──
document.addEventListener('DOMContentLoaded', init);
