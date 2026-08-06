import { ref } from 'vue';

/**
 * Placeholder for the Discuss page composable (WIP).
 * Provides the full API surface the mobile Discuss page destructures so the
 * build stays green. Replace with the real implementation when ready.
 */

export interface DiscussComment {
    id: string | number;
    username: string;
    content: string;
    created_at: string;
    media_type?: string;
    media_id?: string | number;
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
    const selectedMovieId = ref<number | null>(null);
    const selectedMovieType = ref<'movie' | 'tv'>('movie');
    const selectedMovieComments = ref<DiscussComment[]>([]);
    const loadingSelectedMovie = ref(false);
    const submittingSelected = ref(false);
    const newSelectedCommentText = ref('');
    const movieChatBox = ref<HTMLElement | null>(null);
    const showLoungeEmojiPicker = ref(false);
    const showThreadEmojiPicker = ref(false);
    const popularEmojis = ref<string[]>([]);

    const getAvatarUrl = (_user: string) => '';
    const getUsernameColor = (_user: string) => '#58a6ff';
    const isSelf = (_user: string) => false;
    const formatTimeAgo = (_date: string) => '';
    const handleScroll = () => {};
    const getCategoryIcon = (_category: string) => '';
    const checkAuth = () => {};
    const handlePostComment = () => {};
    const getMediaName = (_type: string, _id: string | number | null) => '';
    const handleMovieChatScroll = () => {};
    const viewMovieDiscussion = (_type: string, _id: string | number) => {};
    const closeMovieDiscussion = () => {};
    const postSelectedMovieComment = () => {};
    const toggleEmojiPicker = (_picker: 'lounge' | 'thread') => {};
    const insertEmoji = (_emoji: string, _target?: string) => {};
    const getMovieLink = (_type: string, _id: string | number | null) => '';

    const computedExports = {
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
    return computedExports;
}
