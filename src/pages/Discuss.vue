<template>
    <div class="discuss-page">
        <SiteHeader />

        <main id="main" class="discuss-page__main" role="main">


            <!-- Split Layout Container -->
            <div class="discuss-page__content">
                <div class="discuss-layout">
                    
                    <!-- Left Side: Discussion -->
                    <div class="discuss-chat">
                        <header class="discuss-chat__header">
                            <div class="discuss-chat__header-info">
                                <span class="discuss-chat__status-dot"></span>
                                <span class="discuss-chat__panel-title">💬 Discussion</span>
                            </div>
                            <div class="discuss-chat__user-badge">
                                <span v-if="isLoggedIn">Logged in as <strong>@{{ currentUsername }}</strong></span>
                                <span v-else>Viewing as guest</span>
                            </div>
                        </header>

                        <!-- Scrollable General Chat Feed -->
                        <div ref="chatBox" class="discuss-chat__messages" @scroll="handleScroll">
                            <div v-if="loading" class="discuss-chat__loading" role="status">
                                <div class="discuss-chat__spinner" aria-hidden="true" />
                                <span class="meta">Loading lounge feed…</span>
                            </div>

                            <div v-else-if="!comments.length" class="discuss-chat__empty">
                                <p class="meta">No messages here yet. Type something below to kick off the chat!</p>
                            </div>

                            <div v-else class="discuss-chat__message-list">
                                <div 
                                    v-for="c in comments" 
                                    :key="c.id" 
                                    class="discuss-msg"
                                    :class="{ 
                                        'discuss-msg--self': isSelf(c.username),
                                        'discuss-msg--reported': c.isReported 
                                    }"
                                >
                                    <div class="discuss-msg__avatar" :style="avatarStyle(c.username)">
                                        {{ (c.username.replace('@', '') || 'A')[0].toUpperCase() }}
                                    </div>

                                    <div class="discuss-msg__body">
                                        <div class="discuss-msg__meta">
                                            <span class="discuss-msg__username">{{ c.username }}</span>
                                            <span v-if="c.username.startsWith('@')" class="discuss-msg__badge">Member</span>
                                            <span class="discuss-msg__time meta">{{ formatTimeAgo(c.created_at) }}</span>
                                        </div>
                                        <div class="discuss-msg__bubble">
                                            <p class="discuss-msg__text">{{ c.content }}</p>
                                        </div>
                                        <div class="discuss-msg__actions">
                                            <button 
                                                v-if="!c.isReported"
                                                @click="openReportModal(c)" 
                                                class="discuss-msg__report-btn"
                                            >
                                                Report
                                            </button>
                                            <span v-else class="discuss-msg__reported-tag">⚠️ Reported</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Chat Composer Bar -->
                        <footer class="discuss-chat__composer">
                            <div v-if="!isLoggedIn" class="discuss-chat__login-prompt">
                                <p class="meta">You must be signed in to post comments in the live lounge.</p>
                                <button @click="showAuthModal = true" class="btn btn-primary btn-sm login-prompt-btn">
                                    Sign In
                                </button>
                            </div>

                            <template v-else>
                                <form @submit.prevent="handlePostComment" class="discuss-composer-form">
                                    <input 
                                        type="text" 
                                        v-model="newCommentText" 
                                        placeholder="Say something in the general lounge..." 
                                        required
                                        class="discuss-chat__message-input"
                                        :disabled="submitting"
                                    />
                                    <button 
                                        type="submit" 
                                        class="btn btn-primary discuss-chat__send-btn"
                                        :disabled="submitting || !newCommentText.trim()"
                                    >
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                            <line x1="22" y1="2" x2="11" y2="13"></line>
                                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                        </svg>
                                    </button>
                                </form>
                            </template>
                        </footer>
                    </div>

                    <!-- Right Side: Movie Reviews Feed (Newest first, clickable redirects) -->
                    <div class="discuss-chat">
                        <header class="discuss-chat__header">
                            <div class="discuss-chat__header-info">
                                <span class="discuss-chat__status-dot" style="background: var(--ember); box-shadow: 0 0 6px var(--ember);"></span>
                                <span class="discuss-chat__panel-title">🎬 Movie & Series Activity</span>
                            </div>
                            <div class="discuss-chat__user-badge">
                                <span class="meta">Click to watch/discuss</span>
                            </div>
                        </header>

                        <!-- Scrollable Movies Feed -->
                        <div class="discuss-chat__messages">
                            <div v-if="loadingMovie" class="discuss-chat__loading" role="status">
                                <div class="discuss-chat__spinner" aria-hidden="true" />
                                <span class="meta">Retrieving latest reviews…</span>
                            </div>

                            <div v-else-if="!movieComments.length" class="discuss-chat__empty">
                                <p class="meta">No movie or TV comments exist yet. Start writing reviews on film pages!</p>
                            </div>

                            <div v-else class="discuss-chat__message-list">
                                <div 
                                    v-for="c in movieComments" 
                                    :key="c.id" 
                                    class="discuss-msg discuss-msg--movie-card"
                                    :class="{ 'discuss-msg--reported': c.isReported }"
                                >
                                    <div class="discuss-msg__avatar" :style="avatarStyle(c.username)">
                                        {{ (c.username.replace('@', '') || 'A')[0].toUpperCase() }}
                                    </div>

                                    <div class="discuss-msg__body" style="width: 100%;">
                                        <div class="discuss-msg__meta">
                                            <span class="discuss-msg__username">{{ c.username }}</span>
                                            <span class="discuss-msg__time meta">{{ formatTimeAgo(c.created_at) }}</span>
                                            
                                            <!-- Category tag displaying target movie name/ID -->
                                            <span class="discuss-msg__topic-badge">
                                                {{ getCategoryIcon(c.media_type) }} {{ c.media_type.toUpperCase() }} #{{ c.media_id }}
                                            </span>
                                        </div>

                                        <div class="discuss-msg__bubble discuss-msg__bubble--movie">
                                            <p class="discuss-msg__text">{{ c.content }}</p>
                                        </div>

                                        <div class="discuss-msg__movie-footer">
                                            <router-link :to="getMovieLink(c.media_type, c.media_id)" class="discuss-msg__redirect-link btn btn-secondary btn-xs">
                                                Go to Discussion Page →
                                            </router-link>

                                            <button 
                                                v-if="!c.isReported"
                                                @click="openReportModal(c)" 
                                                class="discuss-msg__report-btn"
                                            >
                                                Report
                                            </button>
                                            <span v-else class="discuss-msg__reported-tag">⚠️ Reported</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </main>

        <!-- Auth Modal Dialog -->
        <AuthModal :isOpen="showAuthModal" @close="showAuthModal = false; checkAuth()" />

        <!-- Report Modal Dialog -->
        <div v-if="showReportModal" class="report-modal" role="dialog" aria-modal="true">
            <div class="report-modal__backdrop" @click="closeReportModal"></div>
            <div class="report-modal__content">
                <h3 class="report-modal__title">Report Post</h3>
                <p class="report-modal__desc meta">Why are you flag-reporting this post? It will be saved for moderation.</p>
                
                <div class="report-modal__post-preview">
                    <strong class="meta">{{ reportingComment?.username }}:</strong>
                    <p class="meta">{{ reportingComment?.content }}</p>
                </div>

                <form @submit.prevent="submitReport" class="report-form">
                    <div class="report-form__group">
                        <label class="report-form__label eyebrow">Reason</label>
                        <select v-model="reportReason" class="report-form__select" required>
                            <option value="spam">Spam / Ad links</option>
                            <option value="abuse">Harassment or Abuse</option>
                            <option value="spoiler">Spoilers without warning</option>
                            <option value="inappropriate">Inappropriate text</option>
                            <option value="other">Other reason</option>
                        </select>
                    </div>

                    <div class="report-form__group">
                        <label class="report-form__label eyebrow">Explanation</label>
                        <textarea 
                            v-model="reportDetails" 
                            placeholder="Add details (optional)..."
                            rows="3"
                            class="report-form__textarea"
                        ></textarea>
                    </div>

                    <div class="report-modal__buttons">
                        <button type="button" @click="closeReportModal" class="btn btn-secondary">Cancel</button>
                        <button type="submit" class="btn btn-primary" :disabled="submittingReport">
                            {{ submittingReport ? 'Flagging...' : 'Submit Report' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, onBeforeUnmount, ref, nextTick } from 'vue';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import AuthModal from '../components/navigation/AuthModal.vue';
import { getSupabaseClient } from '../lib/supabase';
import { useSeo } from '../composables/useSeo';

interface Comment {
    id: string;
    media_id: string;
    media_type: string;
    username: string;
    content: string;
    created_at: string;
    isReported?: boolean;
}

export default defineComponent({
    name: 'Discuss',
    components: { SiteHeader, AuthModal },
    setup() {
        const { updateSeo } = useSeo();
        
        // Message lists and load states
        const comments = ref<Comment[]>([]);
        const movieComments = ref<Comment[]>([]);
        const loading = ref(false);
        const loadingMovie = ref(false);
        const submitting = ref(false);
        const submittingMovie = ref(false);
        const newCommentText = ref('');
        const newMovieCommentText = ref('');
        
        const isLoggedIn = ref(false);
        const currentUsername = ref('');
        const showAuthModal = ref(false);
        
        // Element references
        const chatBox = ref<HTMLElement | null>(null);

        // Reporting State
        const showReportModal = ref(false);
        const reportingComment = ref<Comment | null>(null);
        const reportReason = ref('spam');
        const reportDetails = ref('');
        const submittingReport = ref(false);

        // Realtime Subscription references
        let realtimeChannel: any = null;
        let movieRealtimeChannel: any = null;
        let isAtBottom = true;

        const checkAuth = () => {
            if (typeof window !== 'undefined') {
                const user = localStorage.getItem('movora_current_user');
                if (user) {
                    isLoggedIn.value = true;
                    currentUsername.value = user;
                    showAuthModal.value = false;
                } else {
                    isLoggedIn.value = false;
                    currentUsername.value = '';
                }
            }
        };

        const isSelf = (username: string) => {
            if (isLoggedIn.value) {
                return username === `@${currentUsername.value}`;
            }
            return false;
        };

        const avatarStyle = (name: string) => {
            const colors = [
                'linear-gradient(135deg, #ff5a1f 0%, #ff8a00 100%)',
                'linear-gradient(135deg, #7b2cbf 0%, #9d4edd 100%)',
                'linear-gradient(135deg, #1a75ff 0%, #00d2ff 100%)',
                'linear-gradient(135deg, #2ec4b6 0%, #00f5d4 100%)',
                'linear-gradient(135deg, #ff007f 0%, #ff758c 100%)',
                'linear-gradient(135deg, #e65c00 0%, #f9d423 100%)'
            ];
            let hash = 0;
            for (let i = 0; i < name.length; i++) {
                hash = name.charCodeAt(i) + ((hash << 5) - hash);
            }
            const colorIndex = Math.abs(hash) % colors.length;
            return {
                background: colors[colorIndex],
                color: '#000000',
                fontWeight: 'bold'
            };
        };

        const getCategoryIcon = (type: string) => {
            switch (type) {
                case 'tv': return '📺';
                case 'anime': return '🌟';
                default: return '🎬';
            }
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

        const scrollToBottom = () => {
            nextTick(() => {
                if (chatBox.value) {
                    chatBox.value.scrollTop = chatBox.value.scrollHeight;
                }
            });
        };

        const handleScroll = () => {
            if (chatBox.value) {
                const threshold = 60;
                const position = chatBox.value.scrollHeight - chatBox.value.clientHeight - chatBox.value.scrollTop;
                isAtBottom = position < threshold;
            }
        };

        // Comments Loader (General Lounge)
        const fetchComments = async () => {
            loading.value = true;
            try {
                const supabase = await getSupabaseClient();
                const { data, error } = await supabase
                    .from('movora_chat')
                    .select('*')
                    .order('created_at', { ascending: true })
                    .limit(100);

                if (error) throw error;
                comments.value = data || [];
                scrollToBottom();
            } catch (e) {
                console.error('Failed to load global discussions:', e);
            } finally {
                loading.value = false;
            }
        };

        // Comments Loader (Movies & Shows - Newest first)
        const fetchMovieComments = async () => {
            loadingMovie.value = true;
            try {
                const supabase = await getSupabaseClient();
                const { data, error } = await supabase
                    .from('movora_comments')
                    .select('*')
                    .in('media_type', ['movie', 'tv', 'anime'])
                    .order('created_at', { ascending: false })
                    .limit(100);

                if (error) throw error;
                movieComments.value = (data || []).filter((c: any) => c.media_id !== 'lounge');
            } catch (e) {
                console.error('Failed to load movie reviews:', e);
            } finally {
                loadingMovie.value = false;
            }
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
                        (payload: any) => {
                            const newMsg = payload.new as Comment;
                            if (!comments.value.some(c => c.id === newMsg.id)) {
                                comments.value.push(newMsg);
                                if (comments.value.length > 150) {
                                    comments.value.shift();
                                }
                                if (isAtBottom) {
                                    scrollToBottom();
                                }
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
                        (payload: any) => {
                            const newMsg = payload.new as Comment;
                            if (['movie', 'tv', 'anime'].includes(newMsg.media_type) && newMsg.media_id !== 'lounge') {
                                if (!movieComments.value.some(c => c.id === newMsg.id)) {
                                    movieComments.value.unshift(newMsg);
                                    if (movieComments.value.length > 150) {
                                        movieComments.value.pop();
                                    }
                                }
                            }
                        }
                    )
                    .subscribe();
            } catch (e) {
                console.error('Failed to bind movies realtime channel:', e);
            }
        };

        const handlePostComment = async () => {
            if (!isLoggedIn.value) {
                showAuthModal.value = true;
                return;
            }
            if (!newCommentText.value.trim()) return;
            submitting.value = true;

            const nameToPost = `@${currentUsername.value}`;

            try {
                const supabase = await getSupabaseClient();
                const { data, error } = await supabase
                    .from('movora_chat')
                    .insert([
                        {
                            username: nameToPost,
                            content: newCommentText.value.trim()
                        }
                    ])
                    .select()
                    .single();

                if (error) throw error;

                if (data) {
                    newCommentText.value = '';
                    if (!comments.value.some(c => c.id === data.id)) {
                        comments.value.push(data);
                        scrollToBottom();
                    }
                }
            } catch (e) {
                console.error('Failed to post comment:', e);
            } finally {
                submitting.value = false;
            }
        };

        // Report actions
        const openReportModal = (comment: Comment) => {
            reportingComment.value = comment;
            reportReason.value = 'spam';
            reportDetails.value = '';
            showReportModal.value = true;
        };

        const closeReportModal = () => {
            showReportModal.value = false;
            reportingComment.value = null;
        };

        const submitReport = async () => {
            if (!reportingComment.value) return;
            submittingReport.value = true;

            const reporterName = isLoggedIn.value ? `@${currentUsername.value}` : 'Anonymous Guest';

            try {
                const supabase = await getSupabaseClient();
                await supabase
                    .from('movora_reports')
                    .insert([
                        {
                            comment_id: reportingComment.value.id,
                            reported_by: reporterName,
                            reason: reportReason.value,
                            details: reportDetails.value.trim(),
                            comment_content: reportingComment.value.content,
                            comment_author: reportingComment.value.username,
                            created_at: new Date().toISOString()
                        }
                    ]);

                // Update UI states
                const target = comments.value.find(c => c.id === reportingComment.value!.id);
                if (target) target.isReported = true;
                const mTarget = movieComments.value.find(c => c.id === reportingComment.value!.id);
                if (mTarget) mTarget.isReported = true;

                alert('Thank you. The post has been flagged and reported.');
                closeReportModal();
            } catch (e) {
                console.error('Report submission failed:', e);
            } finally {
                submittingReport.value = false;
            }
        };

        const formatTimeAgo = (dateStr: string) => {
            const date = new Date(dateStr);
            const now = new Date();
            const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

            if (seconds < 60) return 'Just now';
            const minutes = Math.floor(seconds / 60);
            if (minutes < 60) return `${minutes}m ago`;
            const hours = Math.floor(minutes / 60);
            if (hours < 24) return `${hours}h ago`;
            const days = Math.floor(hours / 24);
            if (days === 1) return 'Yesterday';
            if (days < 7) return `${days}d ago`;
            
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };

        onMounted(async () => {
            updateSeo({
                title: 'Live Chat Lounge — Moovie',
                description: 'Join watch lounge conversations in real-time, discuss reviews and talk about movies on Moovie.',
                canonical: 'https://moovie.fun/discuss'
            });
            checkAuth();
            
            // Load and bind default general lounge
            await fetchComments();
            await setupRealtimeChannel();

            // Load and bind movies feed
            await fetchMovieComments();
            await setupMovieRealtimeChannel();
            
            window.addEventListener('movora_auth_change', checkAuth);
        });

        onBeforeUnmount(async () => {
            window.removeEventListener('movora_auth_change', checkAuth);
            if (realtimeChannel) {
                const supabase = await getSupabaseClient();
                supabase.removeChannel(realtimeChannel);
            }
            if (movieRealtimeChannel) {
                const supabase = await getSupabaseClient();
                supabase.removeChannel(movieRealtimeChannel);
            }
        });

        return {
            comments,
            movieComments,
            loading,
            loadingMovie,
            submitting,
            newCommentText,
            newMovieCommentText,
            submittingMovie,
            isLoggedIn,
            currentUsername,
            showAuthModal,
            chatBox,
            avatarStyle,
            isSelf,
            formatTimeAgo,
            handleScroll,
            getCategoryIcon,
            getMovieLink,
            checkAuth,
            
            // Composer Actions
            handlePostComment,

            // Reporting
            showReportModal,
            reportingComment,
            reportReason,
            reportDetails,
            submittingReport,
            openReportModal,
            closeReportModal,
            submitReport
        };
    }
});
</script>

<style lang="scss" scoped>
.discuss-page {
    position: relative;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--ink-900);
    color: var(--bone-50);

    &__main {
        flex: 1;
        display: flex;
        flex-direction: column;
        padding-top: var(--s-3);
        padding-bottom: var(--s-3);
        overflow: hidden;
    }

    &__masthead {
        padding-inline: clamp(var(--s-2), 2vw, var(--s-5));
        margin-bottom: var(--s-3);
        flex-shrink: 0;
    }

    &__masthead-flex {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--s-4);
        flex-wrap: wrap;
    }

    &__eyebrow {
        color: var(--ember);
        margin: 0 0 2px;
    }

    &__title {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: clamp(1.8rem, 4vw, 2.6rem);
        line-height: 1;
        letter-spacing: -0.01em;
        color: var(--bone-50);
        margin: 0;
        font-variation-settings: 'opsz' 144, 'SOFT' 30;
    }

    &__content {
        flex: 1;
        display: flex;
        overflow: hidden;
        width: 100%;
        max-width: 100%;
        padding-inline: clamp(var(--s-2), 2vw, var(--s-5));
        margin: 0 auto;
    }
}

.discuss-layout {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    width: 100%;
    height: 100%;
    border: 1px solid var(--rule);
    border-radius: var(--r-lg);
    overflow: hidden;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55);

    @media (max-width: 900px) {
        grid-template-columns: 1fr;
        grid-template-rows: 1fr 1fr;
    }
}

/* Chat Lounge Panel style */
.discuss-chat {
    display: flex;
    flex-direction: column;
    background: var(--surface-tint);
    height: 100%;
    overflow: hidden;
    position: relative;

    &:first-child {
        border-right: 1px solid var(--rule);

        @media (max-width: 900px) {
            border-right: none;
            border-bottom: 1px solid var(--rule);
        }
    }

    &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--s-3) var(--s-4);
        background: rgba(255, 255, 255, 0.01);
        border-bottom: 1px solid var(--rule);
        height: 52px;
        flex-shrink: 0;
    }

    &__header-info {
        display: flex;
        align-items: center;
        gap: var(--s-2);
        min-width: 0;
    }

    &__status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--ember);
        box-shadow: 0 0 6px var(--ember);
        display: inline-block;
        animation: pulse 2s infinite;
        flex-shrink: 0;
    }

    &__panel-title {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: var(--fs-sm);
        color: var(--bone-50);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__user-badge {
        font-size: var(--fs-xs);
        color: var(--bone-300);
        font-family: var(--font-ui);
        flex-shrink: 0;
    }

    &__messages {
        flex: 1;
        overflow-y: auto;
        padding: var(--s-4);
        display: flex;
        flex-direction: column;
        gap: var(--s-4);
        background: rgba(4, 6, 10, 0.2);
        position: relative;

        &::-webkit-scrollbar {
            width: 6px;
        }
        &::-webkit-scrollbar-track {
            background: transparent;
        }
        &::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.08);
            border-radius: 3px;
        }
    }

    &__loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--s-3);
        margin: auto;
        color: var(--bone-300);
    }

    &__spinner {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid var(--rule-strong);
        border-top-color: var(--ember);
        animation: spin 0.8s linear infinite;
    }

    &__empty {
        text-align: center;
        margin: auto;
        color: var(--bone-400);
        padding: var(--s-6);
        font-family: var(--font-ui);
    }

    &__message-list {
        display: flex;
        flex-direction: column;
        gap: var(--s-4);
    }

    /* Composer area */
    &__composer {
        background: rgba(255, 255, 255, 0.01);
        border-top: 1px solid var(--rule);
        padding: var(--s-3);
        display: flex;
        flex-direction: column;
        gap: var(--s-3);
        flex-shrink: 0;
    }

    &__message-input {
        flex: 1;
        background: var(--ink-950);
        border: 1px solid var(--rule);
        border-radius: var(--r-pill);
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        padding: 0.65rem var(--s-4);
        transition: border-color var(--dur-fast) var(--ease-out);

        &:focus {
            border-color: var(--ember);
            outline: none;
        }
    }

    &__send-btn {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        flex-shrink: 0;
    }

    /* Login prompt styling */
    &__login-prompt {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--s-2) var(--s-3);
        background: rgba(255, 255, 255, 0.02);
        border-radius: var(--r-md);
        border: 1px solid var(--rule);
        gap: var(--s-4);
        width: 100%;

        p {
            margin: 0;
            color: var(--bone-300);
            font-size: var(--fs-xs);
        }

        .login-prompt-btn {
            white-space: nowrap;
        }
    }
}

.discuss-composer-form {
    display: flex;
    gap: var(--s-2);
    align-items: center;
    width: 100%;
}

/* Chat bubble styling */
.discuss-msg {
    display: flex;
    gap: var(--s-3);
    align-items: flex-start;
    max-width: 85%;

    &--self {
        align-self: flex-end;
        flex-direction: row-reverse;
        max-width: 85%;

        .discuss-msg__body {
            align-items: flex-end;
        }

        .discuss-msg__bubble {
            background: linear-gradient(135deg, rgba(255, 90, 31, 0.15) 0%, rgba(255, 90, 31, 0.05) 100%);
            border-color: rgba(255, 90, 31, 0.25);
            border-radius: 12px 1px 12px 12px;
        }

        .discuss-msg__meta {
            flex-direction: row-reverse;
        }

        .discuss-msg__actions {
            justify-content: flex-end;
        }
    }

    &--movie-card {
        max-width: 100%;
        width: 100%;
    }

    &--reported {
        opacity: 0.6;
        .discuss-msg__bubble {
            background: rgba(239, 68, 68, 0.03) !important;
            border-color: rgba(239, 68, 68, 0.2) !important;
        }
    }

    &__avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-ui);
        font-size: var(--fs-xs);
        flex-shrink: 0;
        box-shadow: 0 4px 10px rgba(0,0,0,0.15);
    }

    &__body {
        display: flex;
        flex-direction: column;
        gap: var(--s-1);
    }

    &__meta {
        display: flex;
        align-items: center;
        gap: var(--s-2);
        flex-wrap: wrap;
    }

    &__username {
        font-family: var(--font-ui);
        font-weight: 600;
        font-size: var(--fs-xs);
        color: var(--bone-100);
    }

    &__badge {
        font-family: var(--font-mono);
        font-size: 0.55rem;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        color: var(--ember);
        background: rgba(255, 90, 31, 0.06);
        padding: 0px 4px;
        border-radius: var(--r-pill);
        border: 1px solid rgba(255, 90, 31, 0.15);
    }

    &__topic-badge {
        font-family: var(--font-mono);
        font-size: 0.62rem;
        background: rgba(255, 255, 255, 0.04);
        color: var(--ember);
        padding: 1px 8px;
        border-radius: var(--r-pill);
        border: 1px solid var(--rule);
    }

    &__time {
        font-size: 0.65rem;
        color: var(--bone-400);
    }

    &__bubble {
        background: var(--surface-tint-hover);
        border: 1px solid var(--rule-strong);
        border-radius: 1px 12px 12px 12px;
        padding: 0.5rem 0.85rem;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        word-break: break-word;

        &--movie {
            border-radius: 4px var(--r-md) var(--r-md) var(--r-md);
        }
    }

    &__text {
        margin: 0;
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        line-height: 1.4;
        color: var(--bone-100);
    }

    &__movie-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: var(--s-1);
        width: 100%;
    }

    &__redirect-link {
        font-size: 0.62rem;
        padding: 0.25rem 0.65rem;
        border-radius: var(--r-pill);
        text-decoration: none;
        color: var(--bone-100);

        &:hover {
            color: var(--ember);
            background: rgba(255, 90, 31, 0.05);
        }
    }

    &__actions {
        display: flex;
        width: 100%;
        margin-top: 2px;
    }

    &__report-btn {
        display: flex;
        align-items: center;
        gap: var(--s-1);
        font-family: var(--font-ui);
        font-size: 0.65rem;
        color: var(--bone-400);
        background: transparent;
        border: 0;
        cursor: pointer;
        padding: 2px 4px;
        border-radius: var(--r-sm);
        transition: all var(--dur-fast) var(--ease-out);

        &:hover {
            color: #ef4444;
            background: rgba(239, 68, 68, 0.06);
        }
    }

    &__reported-tag {
        font-family: var(--font-ui);
        font-size: 0.65rem;
        color: #ef4444;
        font-weight: 500;
    }
}

/* Report Modal styling */
.report-modal {
    position: fixed;
    inset: 0;
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--s-4);

    &__backdrop {
        position: absolute;
        inset: 0;
        background: rgba(4, 6, 10, 0.85);
        backdrop-filter: blur(10px);
    }

    &__content {
        position: relative;
        background: var(--ink-850);
        border: 1px solid var(--rule-strong);
        border-radius: var(--r-md);
        padding: var(--s-6);
        max-width: 460px;
        width: 100%;
        box-shadow: 0 30px 80px rgba(0,0,0,0.6);
    }

    &__title {
        font-family: var(--font-display);
        font-size: var(--fs-lg);
        margin: 0 0 var(--s-1);
    }

    &__desc {
        margin: 0 0 var(--s-4);
    }

    &__post-preview {
        background: var(--ink-950);
        border-left: 2px solid var(--ember);
        padding: var(--s-3);
        margin-bottom: var(--s-4);
        border-radius: 0 var(--r-sm) var(--r-sm) 0;

        p {
            margin: var(--s-1) 0 0;
            font-style: italic;
        }
    }

    &__buttons {
        display: flex;
        justify-content: flex-end;
        gap: var(--s-3);
        margin-top: var(--s-5);
    }
}

.report-form {
    display: flex;
    flex-direction: column;
    gap: var(--s-4);

    &__group {
        display: flex;
        flex-direction: column;
        gap: var(--s-2);
    }

    &__select,
    &__textarea {
        background: var(--ink-950);
        border: 1px solid var(--rule);
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        padding: var(--s-3);
        border-radius: var(--r-sm);
        width: 100%;

        &:focus {
            border-color: var(--ember);
            outline: none;
        }
    }
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

@keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.15); opacity: 0.6; }
    100% { transform: scale(1); opacity: 1; }
}
</style>
