import { ref, onMounted, onBeforeUnmount } from 'vue'
import { getSyncClient } from '../lib/syncClient'
import { getCurrentUser } from '../lib/auth'

export interface DiscussComment {
    id: number;
    username: string;
    content: string;
    created_at: string;
    media_type: string;
    media_id: string | number | null;
    is_hidden?: number;
}

const POPULAR_EMOJIS = ['😂', '😍', '🔥', '👍', '❤️', '😭', '🤯', '👏', '🎬', '🍿', '😎', '🥶'];

const AVATAR_COLORS = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4'];

function stableHash(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (h << 5) - h + str.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h);
}

const MOVIE_TITLE_CACHE = new Map<string, string>();
const TV_TITLE_CACHE = new Map<string, string>();
const ANIME_TITLE_CACHE = new Map<string, string>();
const TMDB_API = 'https://hahaevilcraft.site/tmdb-api/3/';
const TMDB_KEY = 'dfa4c2c7c1de1005adee824dc5593672';

async function resolveMediaName(mediaType: string, mediaId: string | number | null): Promise<string> {
    if (mediaId === null || mediaId === undefined || mediaId === '') return 'Lounge';
    let cache = MOVIE_TITLE_CACHE;
    if (mediaType === 'tv') cache = TV_TITLE_CACHE;
    if (mediaType === 'anime') cache = ANIME_TITLE_CACHE;
    const hit = cache.get(String(mediaId));
    if (hit) return hit;
    try {
        let res: Response;
        if (mediaType === 'anime') {
            res = await fetch(`https://api.jikan.moe/v4/anime/${encodeURIComponent(String(mediaId))}`);
        } else {
            res = await fetch(`${TMDB_API}${encodeURIComponent(mediaType)}/${encodeURIComponent(String(mediaId))}?api_key=${TMDB_KEY}`);
        }
        if (!res.ok) return `#${mediaId}`;
        const data = await res.json();
        const name = data?.title || data?.name || data?.data?.title || `#${mediaId}`;
        cache.set(String(mediaId), name);
        return name;
    } catch {
        return `#${mediaId}`;
    }
}

export function useDiscussPage() {
    const comments = ref<DiscussComment[]>([]);
    const movieComments = ref<DiscussComment[]>([]);
    const loading = ref(false);
    const loadingMovie = ref(false);
    const submitting = ref(false);
    const newCommentText = ref('');
    const isLoggedIn = ref(false);
    const currentUsername = ref('');
    const showAuthModal = ref(false);
    const chatBox = ref<HTMLElement | null>(null);
    const selectedMovieId = ref<string | number | null>(null);
    const selectedMovieType = ref<'movie' | 'tv' | 'anime'>('movie');
    const selectedMovieComments = ref<DiscussComment[]>([]);
    const loadingSelectedMovie = ref(false);
    const submittingSelected = ref(false);
    const newSelectedCommentText = ref('');
    const movieChatBox = ref<HTMLElement | null>(null);
    const showLoungeEmojiPicker = ref(false);
    const showThreadEmojiPicker = ref(false);
    const popularEmojis = ref<string[]>(POPULAR_EMOJIS);

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let activeFetchId = 0;

    const getAvatarUrl = (_user: string) => '';
    const getUsernameColor = (user: string) => AVATAR_COLORS[stableHash(user || '?') % AVATAR_COLORS.length];
    const isSelf = (user: string) => user === currentUsername.value;
    const formatTimeAgo = (dateStr: string) => {
        if (!dateStr) return '';
        const diff = Date.now() - new Date(dateStr).getTime();
        if (diff < 60000) return 'now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
        return new Date(dateStr).toLocaleDateString();
    };
    const handleScroll = () => {};
    const getCategoryIcon = (mediaType: string) => (mediaType === 'movie' ? '🎬' : mediaType === 'tv' ? '📺' : '🎌');

    function checkAuth() {
        const user = getCurrentUser();
        isLoggedIn.value = Boolean(user);
        currentUsername.value = user || '';
    }

    function requireLogin(): boolean {
        checkAuth();
        if (!isLoggedIn.value) {
            showAuthModal.value = true;
            return false;
        }
        return true;
    }

    async function fetchComments(): Promise<DiscussComment[]> {
        try {
            const client = await getSyncClient();
            const { data } = await client
                .from('movora_chat')
                .select('id, username, content, created_at')
                .order('created_at', { ascending: false })
                .limit(200);
            return data || [];
        } catch {
            return [];
        }
    }

    async function fetchMovieComments(): Promise<DiscussComment[]> {
        try {
            const client = await getSyncClient();
            const { data } = await client
                .from('movora_comments')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(200);
            return (data || []).filter((comment: DiscussComment) =>
                ['movie', 'tv', 'anime'].includes(String(comment.media_type)) && comment.media_id !== 'lounge'
            );
        } catch {
            return [];
        }
    }

    async function fetchThreadComments(mediaType: string, mediaId: string | number | null): Promise<DiscussComment[]> {
        if (mediaId === null || mediaId === undefined || mediaId === '') return [];
        try {
            const client = await getSyncClient();
            const { data } = await client
                .from('movora_comments')
                .select('*')
                .eq('media_type', mediaType)
                .eq('media_id', String(mediaId))
                .order('created_at', { ascending: false })
                .limit(200);
            return data || [];
        } catch {
            return [];
        }
    }

    async function refreshAll() {
        const id = ++activeFetchId;
        loading.value = true;
        loadingMovie.value = true;
        const [lounge, reviews] = await Promise.all([fetchComments(), fetchMovieComments()]);
        if (id !== activeFetchId) return;
        comments.value = lounge;
        movieComments.value = reviews;
        loading.value = false;
        loadingMovie.value = false;
        for (const c of reviews) {
            void resolveMediaName(c.media_type, c.media_id);
        }
    }

    async function handlePostComment() {
        const text = newCommentText.value.trim();
        if (!text) return;
        if (!requireLogin()) return;
        submitting.value = true;
        try {
            const client = await getSyncClient();
            const { data, error } = await client.from('movora_comments').insert([
                { username: currentUsername.value, content: text, media_type: 'lounge', media_id: null }
            ]);
            if (error) {
                console.warn('[Discuss] post failed:', error);
            } else if (data) {
                const row = Array.isArray(data) ? data[0] : data;
                comments.value = [{ ...row }, ...comments.value];
                newCommentText.value = '';
                showLoungeEmojiPicker.value = false;
            }
        } catch (e) {
            console.warn('[Discuss] post error:', e);
        } finally {
            submitting.value = false;
        }
    }

    async function postSelectedMovieComment() {
        const text = newSelectedCommentText.value.trim();
        if (!text) return;
        if (!requireLogin()) return;
        submittingSelected.value = true;
        try {
            const client = await getSyncClient();
            const { data, error } = await client.from('movora_comments').insert([
                { username: currentUsername.value, content: text, media_type: selectedMovieType.value, media_id: selectedMovieId.value }
            ]);
            if (error) {
                console.warn('[Discuss] thread post failed:', error);
            } else if (data) {
                const row = Array.isArray(data) ? data[0] : data;
                selectedMovieComments.value = [{ ...row }, ...selectedMovieComments.value];
                newSelectedCommentText.value = '';
                showThreadEmojiPicker.value = false;
            }
        } catch (e) {
            console.warn('[Discuss] thread post error:', e);
        } finally {
            submittingSelected.value = false;
        }
    }

    async function viewMovieDiscussion(mediaType: string, mediaId: string | number) {
        if (!mediaId) return;
        selectedMovieType.value = (mediaType === 'tv' || mediaType === 'anime' ? mediaType : 'movie') as 'movie' | 'tv' | 'anime';
        selectedMovieId.value = mediaId;
        loadingSelectedMovie.value = true;
        selectedMovieComments.value = await fetchThreadComments(selectedMovieType.value, mediaId);
        loadingSelectedMovie.value = false;
        stopPolling();
        startPolling();
    }

    function closeMovieDiscussion() {
        selectedMovieId.value = null;
        selectedMovieType.value = 'movie';
        selectedMovieComments.value = [];
        stopPolling();
        startPolling();
    }

    const handleMovieChatScroll = handleScroll;

    const toggleEmojiPicker = (picker: 'lounge' | 'thread') => {
        if (picker === 'lounge') showLoungeEmojiPicker.value = !showLoungeEmojiPicker.value;
        else showThreadEmojiPicker.value = !showThreadEmojiPicker.value;
    };

    const insertEmoji = (emoji: string, target: string) => {
        if (target === 'lounge') newCommentText.value += emoji;
        else newSelectedCommentText.value += emoji;
    };

    const getMovieLink = (mediaType: string, mediaId: string | number | null) => {
        if (!mediaId) return '/discuss';
        const id = String(mediaId);
        if (mediaType === 'tv') return `/tv-show/${id}`;
        if (mediaType === 'anime') return `/anime/${id}`;
        return `/movie/${id}`;
    };

    const getMediaName = (mediaType: string, mediaId: string | number | null) => {
        const cache = mediaType === 'tv' ? TV_TITLE_CACHE : mediaType === 'anime' ? ANIME_TITLE_CACHE : MOVIE_TITLE_CACHE;
        const hit = cache.get(String(mediaId));
        if (hit) return hit;
        if (mediaId) void resolveMediaName(mediaType, mediaId);
        return `#${mediaId}`;
    };

    function startPolling() {
        if (pollTimer) return;
        pollTimer = setInterval(() => {
            if (document.visibilityState !== 'visible') return;
            if (selectedMovieId.value !== null) {
                void fetchThreadComments(selectedMovieType.value, selectedMovieId.value).then((rows) => {
                    if (selectedMovieId.value !== null) selectedMovieComments.value = rows;
                });
            } else {
                void refreshAll();
            }
        }, 30000);
    }

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    onMounted(() => {
        checkAuth();
        void refreshAll();
        startPolling();
        window.addEventListener('movora_auth_change', checkAuth);
    });

    onBeforeUnmount(() => {
        stopPolling();
        activeFetchId++;
        window.removeEventListener('movora_auth_change', checkAuth);
    });

    return {
        comments,
        movieComments,
        loading,
        loadingMovie,
        submitting,
        newCommentText,
        isLoggedIn,
        currentUsername,
        showAuthModal,
        chatBox,
        selectedMovieId,
        selectedMovieType,
        selectedMovieComments,
        loadingSelectedMovie,
        submittingSelected,
        newSelectedCommentText,
        movieChatBox,
        showLoungeEmojiPicker,
        showThreadEmojiPicker,
        popularEmojis,
        getAvatarUrl,
        getUsernameColor,
        isSelf,
        formatTimeAgo,
        handleScroll,
        getCategoryIcon,
        checkAuth,
        handlePostComment,
        getMediaName,
        handleMovieChatScroll,
        viewMovieDiscussion,
        closeMovieDiscussion,
        postSelectedMovieComment,
        toggleEmojiPicker,
        insertEmoji,
        getMovieLink,
    };
}
