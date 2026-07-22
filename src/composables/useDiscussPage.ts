import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { getSupabaseClient } from '../lib/supabase';
import { useMovies } from './useMovies';
import { useTvShows } from './useTvShows';
import { useAniList } from './useAniList';
import { resolveAnimeTmdbMetaByTmdbId, getAnilistIdForTmdbId } from './useAnimeTmdbArtwork';
import { consumeLoungeFeed, consumeReviewsFeed, resetDiscussFeedCache } from './useDiscussPrefetch';

export interface DiscussComment {
    id: string;
    media_id?: string;
    media_type?: string;
    username: string;
    content: string;
    created_at: string;
    isReported?: boolean;
}

export function useDiscussPage() {
    const comments = ref<DiscussComment[]>([]);
    const movieComments = ref<DiscussComment[]>([]);
    const loading = ref(true);
    const loadingMovie = ref(true);
    const submitting = ref(false);
    const newCommentText = ref('');

    const showLoungeEmojiPicker = ref(false);
    const showThreadEmojiPicker = ref(false);
    const popularEmojis = ['😀', '😂', '😍', '🔥', '❤️', '👍', '🎉', '🎬', '📺', '🍿', '😮', '👏'];

    const toggleEmojiPicker = (type: 'lounge' | 'thread') => {
        if (type === 'lounge') {
            showLoungeEmojiPicker.value = !showLoungeEmojiPicker.value;
            showThreadEmojiPicker.value = false;
        } else {
            showThreadEmojiPicker.value = !showThreadEmojiPicker.value;
            showLoungeEmojiPicker.value = false;
        }
    };

    const insertEmoji = (emoji: string, type: 'lounge' | 'thread') => {
        if (type === 'lounge') {
            newCommentText.value += emoji;
            showLoungeEmojiPicker.value = false;
        } else {
            newSelectedCommentText.value += emoji;
            showThreadEmojiPicker.value = false;
        }
    };

    const handleOutsideClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.m-discuss__composer-btn') && !target.closest('.discuss-composer-btn--emoji') && !target.closest('.discuss-emoji-picker') && !target.closest('.m-discuss__emoji-picker')) {
            showLoungeEmojiPicker.value = false;
            showThreadEmojiPicker.value = false;
        }
    };

    const isLoggedIn = ref(false);
    const currentUsername = ref('');
    const showAuthModal = ref(false);

    const chatBox = ref<HTMLElement | null>(null);



    const selectedMovieId = ref<string | null>(null);
    const selectedMovieType = ref('movie');
    const selectedMovieComments = ref<DiscussComment[]>([]);
    const loadingSelectedMovie = ref(false);
    const submittingSelected = ref(false);
    const newSelectedCommentText = ref('');

    const movieChatBox = ref<HTMLElement | null>(null);
    let selectedMovieRealtimeChannel: ReturnType<Awaited<ReturnType<typeof getSupabaseClient>>['channel']> | null = null;
    let isMovieChatAtBottom = true;

    const resolvedNames = ref<Record<string, string>>({});

    let realtimeChannel: ReturnType<Awaited<ReturnType<typeof getSupabaseClient>>['channel']> | null = null;
    let movieRealtimeChannel: ReturnType<Awaited<ReturnType<typeof getSupabaseClient>>['channel']> | null = null;
    let isAtBottom = true;

    const getOrFetchMediaName = async (mediaType: string, mediaId: string) => {
        const key = `${mediaType}:${mediaId}`;
        if (resolvedNames.value[key]) return resolvedNames.value[key];

        resolvedNames.value[key] = 'Loading...';

        try {
            if (mediaType === 'movie') {
                const { fetchMovie } = useMovies();
                const { data } = await fetchMovie(mediaId);
                resolvedNames.value[key] = data.value?.title || `Movie #${mediaId}`;
            } else if (mediaType === 'tv') {
                const { fetchTvShow } = useTvShows();
                const { data } = await fetchTvShow(mediaId);
                resolvedNames.value[key] = data.value?.name || `TV Show #${mediaId}`;
            } else if (mediaType === 'anime') {
                try {
                    const numericId = Number(mediaId);
                    await resolveAnimeTmdbMetaByTmdbId(numericId);
                    const anilistId = getAnilistIdForTmdbId(numericId);
                    if (anilistId) {
                        const { fetchAnimeById } = useAniList();
                        const response = await fetchAnimeById(anilistId);
                        const title = response?.data?.Media?.title;
                        if (title) {
                            resolvedNames.value[key] = title.english || title.romaji || `Anime #${mediaId}`;
                            return resolvedNames.value[key];
                        }
                    }
                } catch {
                    /* fall through */
                }

                const { fetchAnimeById } = useAniList();
                try {
                    const response = await fetchAnimeById(Number(mediaId));
                    const title = response?.data?.Media?.title;
                    if (title) {
                        resolvedNames.value[key] = title.english || title.romaji || `Anime #${mediaId}`;
                    } else {
                        const { fetchTvShow } = useTvShows();
                        const { data } = await fetchTvShow(mediaId);
                        resolvedNames.value[key] = data.value?.name || `Anime #${mediaId}`;
                    }
                } catch {
                    const { fetchTvShow } = useTvShows();
                    const { data } = await fetchTvShow(mediaId);
                    resolvedNames.value[key] = data.value?.name || `Anime #${mediaId}`;
                }
            }
        } catch {
            resolvedNames.value[key] = `${mediaType.toUpperCase()} #${mediaId}`;
        }
        return resolvedNames.value[key];
    };

    const getMediaName = (type: string, id: string) => {
        const key = `${type}:${id}`;
        if (resolvedNames.value[key] && resolvedNames.value[key] !== 'Loading...') {
            return resolvedNames.value[key];
        }
        void getOrFetchMediaName(type, id);
        return resolvedNames.value[key] || 'Loading...';
    };

    const getMovieLink = (type: string, id: string) => {
        if (type === 'tv') {
            return `/tv-show/${id}`;
        } else if (type === 'anime') {
            return `/anime/${id}`;
        } else {
            return `/movie/${id}`;
        }
    };

    const scrollMovieChatToBottom = () => {
        nextTick(() => {
            if (movieChatBox.value) {
                movieChatBox.value.scrollTop = movieChatBox.value.scrollHeight;
            }
        });
    };

    const handleMovieChatScroll = () => {
        if (!movieChatBox.value) return;
        const threshold = 60;
        const position = movieChatBox.value.scrollHeight
            - movieChatBox.value.clientHeight
            - movieChatBox.value.scrollTop;
        isMovieChatAtBottom = position < threshold;
    };

    const viewMovieDiscussion = async (type: string, id: string) => {
        selectedMovieId.value = id;
        selectedMovieType.value = type;
        selectedMovieComments.value = [];

        if (selectedMovieRealtimeChannel) {
            const supabase = await getSupabaseClient();
            supabase.removeChannel(selectedMovieRealtimeChannel);
            selectedMovieRealtimeChannel = null;
        }

        void fetchSelectedMovieComments();
        void setupSelectedMovieRealtime();
        scrollMovieChatToBottom();
    };

    const closeMovieDiscussion = async () => {
        selectedMovieId.value = null;
        if (selectedMovieRealtimeChannel) {
            const supabase = await getSupabaseClient();
            supabase.removeChannel(selectedMovieRealtimeChannel);
            selectedMovieRealtimeChannel = null;
        }
    };

    const fetchSelectedMovieComments = async () => {
        if (!selectedMovieId.value) return;
        loadingSelectedMovie.value = true;
        try {
            const supabase = await getSupabaseClient();
            const { data, error } = await supabase
                .from('movora_comments')
                .select('id, media_id, media_type, username, content, parent_id, likes, dislikes, created_at, is_pinned')
                .eq('media_type', selectedMovieType.value)
                .eq('media_id', selectedMovieId.value)
                .order('created_at', { ascending: true })
                .limit(100);

            if (error) throw error;
            selectedMovieComments.value = data || [];
        } catch (e) {
            console.error(e);
        } finally {
            loadingSelectedMovie.value = false;
        }
    };

    const setupSelectedMovieRealtime = async () => {
        if (!selectedMovieId.value) return;
        try {
            const supabase = await getSupabaseClient();
            selectedMovieRealtimeChannel = supabase
                .channel(`public:movora_selected_movie:${selectedMovieType.value}:${selectedMovieId.value}`)
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'movora_comments' },
                    (payload: { new: DiscussComment }) => {
                        const newMsg = payload.new;
                        if (
                            newMsg.media_type === selectedMovieType.value
                            && newMsg.media_id === selectedMovieId.value
                            && !selectedMovieComments.value.some(c => c.id === newMsg.id)
                        ) {
                            selectedMovieComments.value.push(newMsg);
                            if (isMovieChatAtBottom) scrollMovieChatToBottom();
                        }
                    }
                )
                .subscribe();
        } catch (e) {
            console.error(e);
        }
    };

    const postSelectedMovieComment = async () => {
        if (!newSelectedCommentText.value.trim() || !selectedMovieId.value) return;
        submittingSelected.value = true;

        const nameToPost = isLoggedIn.value
            ? `@${currentUsername.value}`
            : 'Anonymous';

        try {
            const supabase = await getSupabaseClient();
            const { data, error } = await supabase
                .from('movora_comments')
                .insert([{
                    media_id: selectedMovieId.value,
                    media_type: selectedMovieType.value,
                    username: nameToPost,
                    content: newSelectedCommentText.value.trim()
                }])
                .select()
                .single();

            if (error) throw error;

            if (data && !selectedMovieComments.value.some(c => c.id === data.id)) {
                newSelectedCommentText.value = '';
                selectedMovieComments.value.push(data);
                scrollMovieChatToBottom();
            }
        } catch (e) {
            console.error('Failed to post movie comment:', e);
        } finally {
            submittingSelected.value = false;
        }
    };

    const checkAuth = () => {
        if (typeof window === 'undefined') return;
        const user = localStorage.getItem('movora_current_user');
        if (user) {
            isLoggedIn.value = true;
            currentUsername.value = user;
            showAuthModal.value = false;
        } else {
            isLoggedIn.value = false;
            currentUsername.value = '';
        }
    };

    const isSelf = (username: string) =>
        isLoggedIn.value && username === `@${currentUsername.value}`;

    const getAvatarUrl = (name: string) => {
        const cleanName = encodeURIComponent(name.replace(/[^a-zA-Z0-9]/g, ''));
        const styles = ['adventurer', 'lorelei'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const style = styles[Math.abs(hash) % styles.length];
        return `https://api.dicebear.com/7.x/${style}/svg?seed=${cleanName}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
    };

    const getUsernameColor = (username: string) => {
        const colors = ['#30c25b', '#e56c19', '#248cf6', '#d93a8d', '#a357f6', '#f64040', '#00bcd4', '#ffb300'];
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    const getCategoryIcon = (type: string) => {
        if (type === 'tv') return '📺';
        if (type === 'anime') return '🌟';
        return '🎬';
    };

    const scrollToBottom = () => {
        nextTick(() => {
            if (chatBox.value) {
                chatBox.value.scrollTop = chatBox.value.scrollHeight;
            }
        });
    };

    const handleScroll = () => {
        if (!chatBox.value) return;
        const threshold = 60;
        const position = chatBox.value.scrollHeight
            - chatBox.value.clientHeight
            - chatBox.value.scrollTop;
        isAtBottom = position < threshold;
    };

    const fetchComments = async () => {
        loading.value = true;
        try {
            comments.value = (await consumeLoungeFeed()) as DiscussComment[];
            scrollToBottom();
        } catch (e) {
            console.error('Failed to load global discussions:', e);
        } finally {
            loading.value = false;
        }
    };

    const fetchMovieComments = async () => {
        loadingMovie.value = true;
        try {
            movieComments.value = (await consumeReviewsFeed()) as DiscussComment[];
        } catch (e) {
            console.error('Failed to load movie reviews:', e);
        } finally {
            loadingMovie.value = false;
        }
    };

    const bootstrapDiscuss = async () => {
        await Promise.all([fetchComments(), fetchMovieComments()]);
        void setupRealtimeChannel();
        void setupMovieRealtimeChannel();
    };

    const setupRealtimeChannel = async () => {
        if (realtimeChannel) {
            const supabase = await getSupabaseClient();
            supabase.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }

        try {
            const supabase = await getSupabaseClient();
            realtimeChannel = supabase
                .channel('public:movora_chat')
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'movora_chat' },
                    (payload: { new: DiscussComment }) => {
                        const newMsg = payload.new;
                        if (!comments.value.some(c => c.id === newMsg.id)) {
                            comments.value.push(newMsg);
                            if (comments.value.length > 150) comments.value.shift();
                            if (isAtBottom) scrollToBottom();
                        }
                    }
                )
                .subscribe();
        } catch (e) {
            console.error('Failed to bind realtime comments channel:', e);
        }
    };

    const setupMovieRealtimeChannel = async () => {
        if (movieRealtimeChannel) {
            const supabase = await getSupabaseClient();
            supabase.removeChannel(movieRealtimeChannel);
            movieRealtimeChannel = null;
        }

        try {
            const supabase = await getSupabaseClient();
            movieRealtimeChannel = supabase
                .channel('public:movora_movie_comments')
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'movora_comments' },
                    (payload: { new: DiscussComment }) => {
                        const newMsg = payload.new;
                        if (
                            newMsg.media_type
                            && ['movie', 'tv', 'anime'].includes(newMsg.media_type)
                            && newMsg.media_id !== 'lounge'
                            && !movieComments.value.some(c => c.id === newMsg.id)
                        ) {
                            movieComments.value.unshift(newMsg);
                            if (movieComments.value.length > 150) movieComments.value.pop();
                        }
                    }
                )
                .subscribe();
        } catch (e) {
            console.error('Failed to bind movies realtime channel:', e);
        }
    };

    const handlePostComment = async () => {
        if (!newCommentText.value.trim()) return;
        submitting.value = true;

        const nameToPost = isLoggedIn.value ? `@${currentUsername.value}` : 'Anonymous';

        try {
            const supabase = await getSupabaseClient();
            const { data, error } = await supabase
                .from('movora_chat')
                .insert([{
                    username: nameToPost,
                    content: newCommentText.value.trim()
                }])
                .select()
                .single();

            if (error) throw error;

            if (data && !comments.value.some(c => c.id === data.id)) {
                newCommentText.value = '';
                comments.value.push(data);
                scrollToBottom();
            }
        } catch (e) {
            console.error('Failed to post comment:', e);
        } finally {
            submitting.value = false;
        }
    };



    const formatTimeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
        const days = Math.floor(hours / 24);
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;

        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const cleanup = async () => {
        resetDiscussFeedCache();
        window.removeEventListener('movora_auth_change', checkAuth);
        const supabase = await getSupabaseClient();
        if (realtimeChannel) supabase.removeChannel(realtimeChannel);
        if (movieRealtimeChannel) supabase.removeChannel(movieRealtimeChannel);
        if (selectedMovieRealtimeChannel) supabase.removeChannel(selectedMovieRealtimeChannel);
        window.removeEventListener('click', handleOutsideClick);
    };

    const init = () => {
        checkAuth();
        void bootstrapDiscuss();
        window.addEventListener('movora_auth_change', checkAuth);
        window.addEventListener('click', handleOutsideClick);
    };

    onMounted(init);
    onBeforeUnmount(() => {
        void cleanup();
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
        getAvatarUrl,
        getUsernameColor,
        isSelf,
        formatTimeAgo,
        handleScroll,
        getCategoryIcon,
        checkAuth,
        handlePostComment,
        selectedMovieId,
        selectedMovieType,
        selectedMovieComments,
        loadingSelectedMovie,
        submittingSelected,
        newSelectedCommentText,
        movieChatBox,
        getMediaName,
        handleMovieChatScroll,
        viewMovieDiscussion,
        closeMovieDiscussion,
        postSelectedMovieComment,
        getMovieLink,
        
        // Emoji Picker additions
        showLoungeEmojiPicker,
        showThreadEmojiPicker,
        popularEmojis,
        toggleEmojiPicker,
        insertEmoji
    };
}