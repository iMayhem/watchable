<template>
    <div class="discuss-page">
        <SiteHeader />

        <main id="main" class="discuss-page__main" role="main">
            <div class="discuss-page__content container-lm">
                <div class="discuss-layout">
                    <section class="discuss-chat discuss-chat--lounge" aria-label="Open chat">
                        <header class="discuss-chat__header">
                            <div class="discuss-chat__header-copy">
                                <p class="eyebrow discuss-chat__eyebrow">Live now</p>
                                <h2 class="discuss-chat__panel-title">Open chat</h2>
                            </div>
                            <div class="discuss-chat__user-badge">
                                <span class="meta">Chatting as <strong>{{ isLoggedIn ? '@' + currentUsername : 'Anonymous' }}</strong></span>
                            </div>
                        </header>

                        <div ref="chatBox" class="discuss-chat__messages" @scroll="handleScroll">
                            <div v-if="loading" class="discuss-chat__shimmer-list" role="status" aria-label="Loading open chat feed…">
                                <div v-for="i in 6" :key="`lounge-skel-${i}`" class="discuss-msg discuss-msg--shimmer">
                                    <div class="discuss-msg__avatar discuss-msg__avatar--shimmer" />
                                    <div class="discuss-msg__body discuss-msg__body--full">
                                        <div class="discuss-msg__meta">
                                            <div class="shimmer-bar shimmer-bar--username" />
                                            <div class="shimmer-bar shimmer-bar--time" />
                                        </div>
                                        <div class="discuss-msg__bubble discuss-msg__bubble--shimmer">
                                            <div class="shimmer-bar shimmer-bar--line1" />
                                            <div class="shimmer-bar shimmer-bar--line2" />
                                        </div>
                                    </div>
                                </div>
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
                                        'discuss-msg--reported': c.isReported || isCommentBlockedOrReported(c)
                                    }"
                                >
                                    <div class="discuss-msg__avatar" v-if="!isSelf(c.username)">
                                        <img :src="getAvatarUrl(c.username)" :alt="c.username" class="discuss-msg__avatar-img" />
                                    </div>

                                    <div class="discuss-msg__body">
                                        <div class="discuss-msg__bubble">
                                            <div class="discuss-msg__bubble-header" v-if="!isSelf(c.username)">
                                                <span class="discuss-msg__username" :style="{ color: getUsernameColor(c.username) }">{{ c.username }}</span>
                                                <span v-if="c.username.startsWith('@')" class="discuss-msg__badge">Member</span>
                                            </div>
                                            <p v-if="c.is_hidden || isCommentBlockedOrReported(c)" class="discuss-msg__text discuss-msg__text--blocked">
                                                <em>[Comment hidden by user or moderation]</em>
                                            </p>
                                            <p v-else class="discuss-msg__text" v-html="formatCommentContent(c.content)"></p>
                                            <div class="discuss-msg__bubble-footer">
                                                <span class="discuss-msg__time">{{ formatTimeAgo(c.created_at) }}</span>
                                                <span v-if="isSelf(c.username)" class="discuss-msg__status">
                                                    <svg viewBox="0 0 16 11" width="14" height="10" fill="currentColor">
                                                        <path d="M15 1.084L5.672 10.375 1.5 6.22 2.583 5.14l3.089 3.076 8.243-8.212L15 1.084z M11.531 1.084l-4.7 4.697-0.781-0.78-1.085 1.082 1.866 1.866 5.785-5.782-1.085-1.083z"/>
                                                    </svg>
                                                </span>
                                            </div>
                                        </div>

                                        <div class="discuss-msg__actions" v-if="!isSelf(c.username)">
                                            <button type="button" class="discuss-msg__report-btn" @click.stop="openReportModal(c)" title="Report message or block user">
                                                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                                                    <line x1="4" y1="22" x2="4" y2="15"></line>
                                                </svg>
                                                <span>Report</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Chat Composer Bar -->
                        <footer class="discuss-chat__composer">
                            <!-- Emoji Picker Popover -->
                            <div v-if="showLoungeEmojiPicker" class="discuss-emoji-picker">
                                <button 
                                    v-for="emoji in popularEmojis" 
                                    :key="emoji" 
                                    type="button" 
                                    class="discuss-emoji-btn" 
                                    @click="insertEmoji(emoji, 'lounge')"
                                >
                                    {{ emoji }}
                                </button>
                            </div>
                            <form @submit.prevent="handlePostComment" class="discuss-composer-form discuss-composer-form--stacked">
                                <div class="discuss-composer-toolbar">
                                    <button type="button" class="fmt-btn" title="Bold" @click="wrapText('lounge', '**')"><strong>B</strong></button>
                                    <button type="button" class="fmt-btn" title="Italic" @click="wrapText('lounge', '*')"><em>I</em></button>
                                    <button type="button" class="fmt-btn" title="Strikethrough" @click="wrapText('lounge', '~~')"><s>S</s></button>
                                    <button type="button" class="fmt-btn fmt-btn--spoiler" title="Spoiler" @click="wrapText('lounge', '||')">Spoiler</button>
                                </div>
                                <div class="discuss-composer-input-row">
                                    <div class="discuss-composer-input-wrapper">
                                        <button type="button" class="discuss-composer-btn discuss-composer-btn--emoji" aria-label="Emojis" @click.stop="toggleEmojiPicker('lounge')">
                                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                                                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                                                <line x1="15" y1="9" x2="15.01" y2="9"></line>
                                            </svg>
                                        </button>
                                        <input 
                                            ref="loungeInput"
                                            type="text" 
                                            v-model="newCommentText" 
                                            placeholder="Type a message…"
                                            required
                                            class="discuss-chat__message-input"
                                            :disabled="submitting"
                                        />
                                    </div>
                                    <button 
                                        type="submit" 
                                        class="discuss-chat__send-btn"
                                        :disabled="submitting || !newCommentText.trim()"
                                    >
                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                                        </svg>
                                    </button>
                                </div>
                            </form>
                        </footer>
                    </section>

                    <section class="discuss-chat discuss-chat--reviews" aria-label="Title reviews">
                        <template v-if="selectedMovieId">
                            <header class="discuss-chat__header">
                                <div class="discuss-chat__header-copy discuss-chat__header-copy--thread">
                                    <button
                                        type="button"
                                        class="btn btn-secondary btn-xs discuss-chat__back-btn"
                                        @click="closeMovieDiscussion"
                                    >
                                        Back
                                    </button>
                                    <div class="discuss-chat__thread-copy">
                                        <p class="eyebrow discuss-chat__eyebrow">Title thread</p>
                                        <h2 class="discuss-chat__panel-title discuss-chat__panel-title--truncate">
                                            <router-link :to="getMovieLink(selectedMovieType, selectedMovieId)" class="discuss-chat__panel-title-link">
                                                {{ getMediaName(selectedMovieType, selectedMovieId) }}
                                            </router-link>
                                        </h2>
                                    </div>
                                </div>
                                <div class="discuss-chat__user-badge">
                                    <span class="meta">Review room</span>
                                </div>
                            </header>

                            <!-- Scrollable Movie Chat Messages -->
                            <div ref="movieChatBox" class="discuss-chat__messages" @scroll="handleMovieChatScroll">
                                <div v-if="loadingSelectedMovie" class="discuss-chat__shimmer-list" role="status" aria-label="Loading comments...">
                                    <div v-for="i in 5" :key="i" class="discuss-msg discuss-msg--shimmer">
                                        <div class="discuss-msg__avatar discuss-msg__avatar--shimmer"></div>
                                        <div class="discuss-msg__body discuss-msg__body--full">
                                            <div class="discuss-msg__meta">
                                                <div class="shimmer-bar shimmer-bar--username"></div>
                                                <div class="shimmer-bar shimmer-bar--time"></div>
                                            </div>
                                            <div class="discuss-msg__bubble discuss-msg__bubble--shimmer">
                                                <div class="shimmer-bar shimmer-bar--line1"></div>
                                                <div class="shimmer-bar shimmer-bar--line2"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div v-else-if="!selectedMovieComments.length" class="discuss-chat__empty">
                                    <p class="meta">No reviews yet for this title. Be the first to share your thoughts!</p>
                                </div>

                                <div v-else class="discuss-chat__message-list">
                                    <div 
                                        v-for="c in selectedMovieComments" 
                                        :key="c.id" 
                                        class="discuss-msg"
                                        :class="{ 
                                            'discuss-msg--self': isSelf(c.username),
                                            'discuss-msg--reported': c.isReported || isCommentBlockedOrReported(c)
                                        }"
                                    >
                                        <div class="discuss-msg__avatar" v-if="!isSelf(c.username)">
                                            <img :src="getAvatarUrl(c.username)" :alt="c.username" class="discuss-msg__avatar-img" />
                                        </div>

                                        <div class="discuss-msg__body">
                                            <div class="discuss-msg__bubble">
                                                <div class="discuss-msg__bubble-header" v-if="!isSelf(c.username)">
                                                    <span class="discuss-msg__username" :style="{ color: getUsernameColor(c.username) }">{{ c.username }}</span>
                                                    <span v-if="c.username.startsWith('@')" class="discuss-msg__badge">Member</span>
                                                </div>
                                                <p v-if="c.is_hidden || isCommentBlockedOrReported(c)" class="discuss-msg__text discuss-msg__text--blocked">
                                                    <em>[Comment hidden by user or moderation]</em>
                                                </p>
                                                <p v-else class="discuss-msg__text" v-html="formatCommentContent(c.content)"></p>
                                                <div class="discuss-msg__bubble-footer">
                                                    <span class="discuss-msg__time">{{ formatTimeAgo(c.created_at) }}</span>
                                                    <span v-if="isSelf(c.username)" class="discuss-msg__status">
                                                        <svg viewBox="0 0 16 11" width="14" height="10" fill="currentColor">
                                                            <path d="M15 1.084L5.672 10.375 1.5 6.22 2.583 5.14l3.089 3.076 8.243-8.212L15 1.084z M11.531 1.084l-4.7 4.697-0.781-0.78-1.085 1.082 1.866 1.866 5.785-5.782-1.085-1.083z"/>
                                                        </svg>
                                                    </span>
                                                </div>
                                            </div>

                                            <div class="discuss-msg__actions" v-if="!isSelf(c.username)">
                                                <button type="button" class="discuss-msg__report-btn" @click.stop="openReportModal(c)" title="Report message or block user">
                                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                                                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                                                        <line x1="4" y1="22" x2="4" y2="15"></line>
                                                    </svg>
                                                    <span>Report</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Movie Comment Composer -->
                            <footer class="discuss-chat__composer">
                                <!-- Emoji Picker Popover -->
                                <div v-if="showThreadEmojiPicker" class="discuss-emoji-picker">
                                    <button 
                                        v-for="emoji in popularEmojis" 
                                        :key="emoji" 
                                        type="button" 
                                        class="discuss-emoji-btn" 
                                        @click="insertEmoji(emoji, 'thread')"
                                    >
                                        {{ emoji }}
                                    </button>
                                </div>
                                <form @submit.prevent="postSelectedMovieComment" class="discuss-composer-form discuss-composer-form--stacked">
                                    <div class="discuss-composer-toolbar">
                                        <button type="button" class="fmt-btn" title="Bold" @click="wrapText('thread', '**')"><strong>B</strong></button>
                                        <button type="button" class="fmt-btn" title="Italic" @click="wrapText('thread', '*')"><em>I</em></button>
                                        <button type="button" class="fmt-btn" title="Strikethrough" @click="wrapText('thread', '~~')"><s>S</s></button>
                                        <button type="button" class="fmt-btn fmt-btn--spoiler" title="Spoiler" @click="wrapText('thread', '||')">Spoiler</button>
                                    </div>
                                    <div class="discuss-composer-input-row">
                                        <div class="discuss-composer-input-wrapper">
                                            <button type="button" class="discuss-composer-btn discuss-composer-btn--emoji" aria-label="Emojis" @click.stop="toggleEmojiPicker('thread')">
                                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                                                    <circle cx="12" cy="12" r="10"></circle>
                                                    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                                                    <line x1="9" y1="9" x2="9.01" y2="9"></line>
                                                    <line x1="15" y1="9" x2="15.01" y2="9"></line>
                                                </svg>
                                            </button>
                                            <input 
                                                ref="threadInput"
                                                type="text" 
                                                v-model="newSelectedCommentText" 
                                                placeholder="Type a message…"
                                                required
                                                class="discuss-chat__message-input"
                                                :disabled="submittingSelected"
                                            />
                                        </div>
                                        <button 
                                            type="submit" 
                                            class="discuss-chat__send-btn"
                                            :disabled="submittingSelected || !newSelectedCommentText.trim()"
                                        >
                                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                                            </svg>
                                        </button>
                                    </div>
                                </form>
                            </footer>
                        </template>

                        <template v-else>
                            <header class="discuss-chat__header">
                                <div class="discuss-chat__header-copy">
                                    <p class="eyebrow discuss-chat__eyebrow">From the catalogue</p>
                                    <h2 class="discuss-chat__panel-title">Title reviews</h2>
                                </div>
                                <div class="discuss-chat__user-badge">
                                    <span class="meta">Pick a thread to join</span>
                                </div>
                            </header>

                            <!-- Scrollable Movies Feed -->
                            <div class="discuss-chat__messages" @scroll="handleReviewsScroll">
                                <div v-if="loadingMovie" class="discuss-chat__shimmer-list" role="status" aria-label="Loading title reviews…">
                                    <div v-for="i in 5" :key="`review-skel-${i}`" class="discuss-msg discuss-msg--shimmer discuss-msg--movie-card">
                                        <div class="discuss-msg__avatar discuss-msg__avatar--shimmer" />
                                        <div class="discuss-msg__body discuss-msg__body--full">
                                            <div class="discuss-msg__meta">
                                                <div class="shimmer-bar shimmer-bar--username" />
                                                <div class="shimmer-bar shimmer-bar--time" />
                                                <div class="shimmer-bar shimmer-bar--topic" />
                                            </div>
                                            <div class="discuss-msg__bubble discuss-msg__bubble--shimmer discuss-msg__bubble--shimmer-wide">
                                                <div class="shimmer-bar shimmer-bar--line1" />
                                                <div class="shimmer-bar shimmer-bar--line2" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div v-else-if="!movieComments.length" class="discuss-chat__empty">
                                    <p class="meta">No movie or TV comments exist yet. Start writing reviews on film pages!</p>
                                </div>

                                <div v-else class="discuss-chat__message-list">
                                    <div 
                                        v-for="c in movieComments" 
                                        :key="c.id" 
                                        class="discuss-msg discuss-msg--movie-card"
                                        :class="{ 'discuss-msg--reported': c.isReported || isCommentBlockedOrReported(c) }"
                                    >
                                        <div class="discuss-msg__avatar">
                                            <img :src="getAvatarUrl(c.username)" :alt="c.username" class="discuss-msg__avatar-img" />
                                        </div>

                                        <div class="discuss-msg__body discuss-msg__body--full">
                                            <div class="discuss-msg__meta">
                                                <span class="discuss-msg__username">{{ c.username }}</span>
                                                
                                                <!-- Category tag displaying target movie name/ID -->
                                                <router-link :to="getMovieLink(c.media_type, c.media_id)" class="discuss-msg__topic-badge discuss-msg__topic-badge--link">
                                                    {{ getCategoryIcon(c.media_type) }} {{ getMediaName(c.media_type, c.media_id) }}
                                                </router-link>

                                                <span class="discuss-msg__time meta">{{ formatTimeAgo(c.created_at) }}</span>
                                            </div>

                                            <div class="discuss-msg__bubble discuss-msg__bubble--movie">
                                                <p v-if="c.is_hidden || isCommentBlockedOrReported(c)" class="discuss-msg__text discuss-msg__text--blocked">
                                                    <em>[Comment hidden by user or moderation]</em>
                                                </p>
                                                <p v-else class="discuss-msg__text" v-html="formatCommentContent(c.content)"></p>
                                            </div>

                                            <div class="discuss-msg__movie-footer">
                                                <button
                                                    type="button"
                                                    class="discuss-msg__redirect-link btn btn-secondary btn-xs"
                                                    @click="viewMovieDiscussion(c.media_type, c.media_id)"
                                                >
                                                    Open thread
                                                </button>
                                                <button
                                                    type="button"
                                                    class="discuss-msg__report-btn"
                                                    v-if="!isSelf(c.username)"
                                                    @click.stop="openReportModal(c)"
                                                    title="Report message or block user"
                                                >
                                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                                                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                                                        <line x1="4" y1="22" x2="4" y2="15"></line>
                                                    </svg>
                                                    <span>Report</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </section>
                </div>
            </div>
        </main>

        <!-- Report Modal Dialog -->
        <div v-if="showReportModal" class="report-modal">
            <div class="report-modal__backdrop" @click="closeReportModal"></div>
            <div class="report-modal__content" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
                <h3 id="report-modal-title" class="report-modal__title">Report Message / Block User</h3>
                <p class="report-modal__desc meta">Help us keep the community safe and spoiler-free.</p>
                
                <div v-if="reportingComment" class="report-modal__post-preview">
                    <span class="meta font-bold">{{ reportingComment.username }}</span>
                    <p class="meta">{{ reportingComment.content }}</p>
                </div>

                <form @submit.prevent="submitReport" class="report-form">
                    <div class="report-form__group">
                        <label for="report-reason" class="meta">Action / Reason</label>
                        <select id="report-reason" v-model="reportReason" class="report-form__select" required>
                            <option value="spoiler">Unmarked Spoiler</option>
                            <option value="inappropriate">Inappropriate / Offensive Content</option>
                            <option value="harassment">Harassment / Hate Speech</option>
                            <option value="spam">Spam or Self-promotion</option>
                            <option value="block_user">Block this user entirely</option>
                        </select>
                    </div>

                    <div class="report-form__group" v-if="reportReason !== 'block_user'">
                        <label for="report-details" class="meta">Additional details (optional)</label>
                        <textarea 
                            id="report-details" 
                            v-model="reportDetails" 
                            rows="2" 
                            placeholder="Explain the issue..."
                            class="report-form__textarea"
                        ></textarea>
                    </div>

                    <div class="report-modal__buttons">
                        <button type="button" class="btn btn-secondary btn-sm" @click="closeReportModal">Cancel</button>
                        <button type="submit" class="btn btn-primary btn-sm">
                            {{ reportReason === 'block_user' ? 'Block User' : 'Submit Report' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Auth Modal Dialog -->
        <AuthModal :isOpen="showAuthModal" @close="showAuthModal = false; checkAuth()" />


    </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, onBeforeUnmount, ref, computed, nextTick } from 'vue';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import AuthModal from '../components/navigation/AuthModal.vue';
import { getSyncClient } from '../lib/syncClient';
import { useSeo } from '../composables/useSeo';
import { useMovies } from '../composables/useMovies';
import { useTvShows } from '../composables/useTvShows';
import { useAniList } from '../composables/useAniList';
import { resolveAnimeTmdbMetaByTmdbId, getAnilistIdForTmdbId } from '../composables/useAnimeTmdbArtwork';
import { consumeLoungeFeed, consumeReviewsFeed, resetDiscussFeedCache } from '../composables/useDiscussPrefetch';
import { isToxic } from '../composables/useToxicityFilter';

interface Comment {
    id: string;
    media_id: string;
    media_type: string;
    username: string;
    content: string;
    created_at: string;
    isReported?: boolean;
    is_hidden?: boolean | number;
}

export default defineComponent({
    name: 'Discuss',
    components: { SiteHeader, AuthModal },
    setup() {
        const { updateSeo } = useSeo();
        
        // Message lists and load states
        const comments = ref<Comment[]>([]);
        const allMovieComments = ref<Comment[]>([]);
        const displayLimit = ref(20);
        const movieComments = computed(() => allMovieComments.value.slice(0, displayLimit.value));
        const loading = ref(true);
        const loadingMovie = ref(true);
        const submitting = ref(false);
        const submittingMovie = ref(false);
        const newCommentText = ref('');
        const newMovieCommentText = ref('');

        const loadMoreReviews = () => {
            if (displayLimit.value < allMovieComments.value.length) {
                displayLimit.value += 20;
            }
        };

        const showLoungeEmojiPicker = ref(false);
        const showThreadEmojiPicker = ref(false);
        const popularEmojis = ['😀', '😂', '😍', '🔥', '❤️', '👍', '🎉', '🎬', '📺', '🍿', '😮', '👏'];
        const loungeInput = ref<HTMLInputElement | null>(null);
        const threadInput = ref<HTMLInputElement | null>(null);

        // Reporting and Blocking State
        const showReportModal = ref(false);
        const reportingComment = ref<Comment | null>(null);
        const reportReason = ref('spoiler');
        const reportDetails = ref('');
        const reportedComments = ref<Set<string>>(new Set());
        const blockedUsers = ref<Set<string>>(new Set());

        const loadBlockedData = () => {
            if (typeof window === 'undefined') return;
            try {
                const savedReported = localStorage.getItem('movora_reported_comments');
                if (savedReported) {
                    reportedComments.value = new Set(JSON.parse(savedReported));
                }
                const savedBlocked = localStorage.getItem('movora_blocked_users');
                if (savedBlocked) {
                    blockedUsers.value = new Set(JSON.parse(savedBlocked));
                }
            } catch (e) {
                console.error('Failed to load blocked data:', e);
            }
        };

        const openReportModal = (comment: Comment) => {
            reportingComment.value = comment;
            reportReason.value = 'spoiler';
            reportDetails.value = '';
            showReportModal.value = true;
        };

        const closeReportModal = () => {
            showReportModal.value = false;
            reportingComment.value = null;
        };

        const submitReport = () => {
            if (!reportingComment.value) return;
            if (reportReason.value === 'block_user') {
                blockedUsers.value.add(reportingComment.value.username);
                if (typeof window !== 'undefined') {
                    localStorage.setItem('movora_blocked_users', JSON.stringify(Array.from(blockedUsers.value)));
                }
                alert(`User ${reportingComment.value.username} has been blocked.`);
            } else {
                reportedComments.value.add(reportingComment.value.id);
                if (typeof window !== 'undefined') {
                    localStorage.setItem('movora_reported_comments', JSON.stringify(Array.from(reportedComments.value)));
                }
                alert('Thank you. This comment has been reported and hidden.');
            }
            closeReportModal();
        };

        const isCommentBlockedOrReported = (comment: Comment): boolean => {
            if (!comment) return false;
            return reportedComments.value.has(comment.id) || blockedUsers.value.has(comment.username);
        };

        const wrapText = (field: 'lounge' | 'thread', wrapper: string) => {
            const el = field === 'lounge' ? loungeInput.value : threadInput.value;
            if (!el) return;

            const start = el.selectionStart ?? 0;
            const end = el.selectionEnd ?? 0;
            const text = field === 'lounge' ? newCommentText.value : newSelectedCommentText.value;
            const selected = text.slice(start, end);
            const wrapped = selected ? wrapper + selected + wrapper : wrapper + wrapper;
            const newText = text.slice(0, start) + wrapped + text.slice(end);

            if (field === 'lounge') newCommentText.value = newText;
            else newSelectedCommentText.value = newText;

            nextTick(() => {
                el.focus();
                const cursorPos = selected
                    ? start + wrapper.length + selected.length + wrapper.length
                    : start + wrapper.length;
                el.setSelectionRange(
                    selected ? start + wrapper.length : cursorPos,
                    selected ? start + wrapper.length + selected.length : cursorPos
                );
            });
        };

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
            if (!target.closest('.discuss-composer-btn--emoji') && !target.closest('.discuss-emoji-picker')) {
                showLoungeEmojiPicker.value = false;
                showThreadEmojiPicker.value = false;
            }
        };
        
        const isLoggedIn = ref(false);
        const currentUsername = ref('');
        const showAuthModal = ref(false);
        
        // Element references
        const chatBox = ref<HTMLElement | null>(null);



        // Movie-specific Discussion State
        const selectedMovieId = ref<string | null>(null);
        const selectedMovieType = ref<string>('movie');
        const selectedMovieComments = ref<Comment[]>([]);
        const loadingSelectedMovie = ref(false);
        const submittingSelected = ref(false);
        const newSelectedCommentText = ref('');

        const movieChatBox = ref<HTMLElement | null>(null);
        let selectedMovieRealtimeChannel: any = null;
        let isMovieChatAtBottom = true;

        const resolvedNames = ref<Record<string, string>>({});

        const getOrFetchMediaName = async (mediaType: string, mediaId: string) => {
            const key = `${mediaType}:${mediaId}`;
            if (resolvedNames.value[key]) return resolvedNames.value[key];

            resolvedNames.value[key] = `Loading...`;

            try {
                if (mediaType === 'movie') {
                    const { fetchMovie } = useMovies();
                    const { data } = await fetchMovie(mediaId);
                    if (data.value && data.value.title) {
                        resolvedNames.value[key] = data.value.title;
                    } else {
                        resolvedNames.value[key] = `Movie #${mediaId}`;
                    }
                } else if (mediaType === 'tv') {
                    const { fetchTvShow } = useTvShows();
                    const { data } = await fetchTvShow(mediaId);
                    if (data.value && data.value.name) {
                        resolvedNames.value[key] = data.value.name;
                    } else {
                        resolvedNames.value[key] = `TV Show #${mediaId}`;
                    }
                } else if (mediaType === 'anime') {
                    // Try resolving AniList ID if mediaId is a TMDB ID
                    try {
                        const numericId = Number(mediaId);
                        await resolveAnimeTmdbMetaByTmdbId(numericId);
                        const anilistId = getAnilistIdForTmdbId(numericId);
                        if (anilistId) {
                            const { fetchAnimeById } = useAniList();
                            const response = await fetchAnimeById(anilistId);
                            if (response && response.data && response.data.Media && response.data.Media.title) {
                                resolvedNames.value[key] = response.data.Media.title.english || response.data.Media.title.romaji || `Anime #${mediaId}`;
                                return resolvedNames.value[key];
                            }
                        }
                    } catch (resolveErr) {
                        console.warn('Failed to resolve AniList ID mapping for TMDB ID:', mediaId, resolveErr);
                    }

                    // Fallback to direct AniList query or TMDB TV show query
                    const { fetchAnimeById } = useAniList();
                    try {
                        const response = await fetchAnimeById(Number(mediaId));
                        if (response && response.data && response.data.Media && response.data.Media.title) {
                            resolvedNames.value[key] = response.data.Media.title.english || response.data.Media.title.romaji || `Anime #${mediaId}`;
                        } else {
                            const { fetchTvShow } = useTvShows();
                            const { data } = await fetchTvShow(mediaId);
                            if (data.value && data.value.name) {
                                resolvedNames.value[key] = data.value.name;
                            } else {
                                resolvedNames.value[key] = `Anime #${mediaId}`;
                            }
                        }
                    } catch (animeErr) {
                        const { fetchTvShow } = useTvShows();
                        const { data } = await fetchTvShow(mediaId);
                        if (data.value && data.value.name) {
                            resolvedNames.value[key] = data.value.name;
                        } else {
                            resolvedNames.value[key] = `Anime #${mediaId}`;
                        }
                    }
                }
            } catch (e) {
                resolvedNames.value[key] = `${mediaType.toUpperCase()} #${mediaId}`;
            }
            return resolvedNames.value[key];
        };

        const getMediaName = (type: string, id: string) => {
            const key = `${type}:${id}`;
            if (resolvedNames.value[key] && resolvedNames.value[key] !== 'Loading...') {
                return resolvedNames.value[key];
            }
            getOrFetchMediaName(type, id);
            return resolvedNames.value[key] || 'Loading...';
        };

        const scrollMovieChatToBottom = () => {
            nextTick(() => {
                if (movieChatBox.value) {
                    movieChatBox.value.scrollTop = movieChatBox.value.scrollHeight;
                }
            });
        };

        const handleMovieChatScroll = () => {
            if (movieChatBox.value) {
                const threshold = 60;
                const position = movieChatBox.value.scrollHeight - movieChatBox.value.clientHeight - movieChatBox.value.scrollTop;
                isMovieChatAtBottom = position < threshold;
            }
        };

        const viewMovieDiscussion = async (type: string, id: string) => {
            selectedMovieId.value = id;
            selectedMovieType.value = type;
            selectedMovieComments.value = [];
            
            // Clean up previous movie realtime sub
            if (selectedMovieRealtimeChannel) {
                const sync = await getSyncClient();
                sync.removeChannel(selectedMovieRealtimeChannel);
                selectedMovieRealtimeChannel = null;
            }

            // Trigger fetches in the background so the panel opens instantly and snappily!
            fetchSelectedMovieComments();
            setupSelectedMovieRealtime();
            scrollMovieChatToBottom();
        };

        const closeMovieDiscussion = async () => {
            selectedMovieId.value = null;
            if (selectedMovieRealtimeChannel) {
                const sync = await getSyncClient();
                sync.removeChannel(selectedMovieRealtimeChannel);
                selectedMovieRealtimeChannel = null;
            }
        };

        const fetchSelectedMovieComments = async () => {
            if (!selectedMovieId.value) return;
            loadingSelectedMovie.value = true;
            try {
                const sync = await getSyncClient();
                const { data, error } = await sync
                    .from('movora_comments')
                    .select('id, media_id, media_type, username, content, parent_id, likes, dislikes, created_at, is_pinned, is_hidden')
                    .eq('media_type', selectedMovieType.value)
                    .eq('media_id', selectedMovieId.value)
                    .order('created_at', { ascending: true })
                    .limit(500);

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
                const sync = await getSyncClient();
                selectedMovieRealtimeChannel = sync
                    .channel(`public:movora_selected_movie:${selectedMovieType.value}:${selectedMovieId.value}`)
                    .on(
                        'postgres_changes',
                        { event: 'INSERT', schema: 'public', table: 'movora_comments' },
                        (payload: any) => {
                            const newMsg = payload.new as Comment;
                            if (newMsg.media_type === selectedMovieType.value && newMsg.media_id === selectedMovieId.value) {
                                if (!selectedMovieComments.value.some(c => c.id === newMsg.id)) {
                                    selectedMovieComments.value.push(newMsg);
                                    if (isMovieChatAtBottom) {
                                        scrollMovieChatToBottom();
                                    }
                                }
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
            if (isToxic(newSelectedCommentText.value)) {
                alert('Your comment has been removed for violating our community guidelines.');
                submittingSelected.value = false;
                return;
            }
            submittingSelected.value = true;

            const nameToPost = isLoggedIn.value
                ? `@${currentUsername.value}`
                : 'Anonymous';

            try {
                const sync = await getSyncClient();
                const { data, error } = await sync
                    .from('movora_comments')
                    .insert([
                        {
                            media_id: selectedMovieId.value,
                            media_type: selectedMovieType.value,
                            username: nameToPost,
                            content: newSelectedCommentText.value.trim()
                        }
                    ])
                    .select()
                    .single();

                if (error) throw error;

                if (data) {
                    newSelectedCommentText.value = '';
                    if (!selectedMovieComments.value.some(c => c.id === data.id)) {
                        selectedMovieComments.value.push(data);
                        scrollMovieChatToBottom();
                    }
                }
            } catch (e) {
                console.error('Failed to post movie comment:', e);
            } finally {
                submittingSelected.value = false;
            }
        };

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
        const getAvatarUrl = (name: string) => {
            const cleanName = encodeURIComponent(name.replace(/[^a-zA-Z0-9]/g, ''));
            // Use premium character styles: adventurer (anime adventurers) and lorelei (anime-style portraits)
            const styles = ['adventurer', 'lorelei'];
            let hash = 0;
            for (let i = 0; i < name.length; i++) {
                hash = name.charCodeAt(i) + ((hash << 5) - hash);
            }
            const styleIndex = Math.abs(hash) % styles.length;
            const style = styles[styleIndex];
            
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
                comments.value = (await consumeLoungeFeed()) as Comment[];
                scrollToBottom();
            } catch (e) {
                console.error('Failed to load global discussions:', e);
            } finally {
                loading.value = false;
            }
        };

        const handleReviewsScroll = (e: Event) => {
            const el = e.target as HTMLElement;
            if (el) {
                const bottomDistance = el.scrollHeight - el.clientHeight - el.scrollTop;
                if (bottomDistance < 150) {
                    loadMoreReviews();
                }
            }
        };

        // Comments Loader (Movies & Shows - Newest first)
        const fetchMovieComments = async () => {
            loadingMovie.value = true;
            try {
                allMovieComments.value = (await consumeReviewsFeed()) as Comment[];
                displayLimit.value = 20;
            } catch (e) {
                console.error('Failed to load movie reviews:', e);
            } finally {
                loadingMovie.value = false;
            }
        };

        const bootstrapDiscuss = async () => {
            await Promise.all([
                fetchComments(),
                fetchMovieComments()
            ]);
            void setupRealtimeChannel();
            void setupMovieRealtimeChannel();
        };

        const setupRealtimeChannel = async () => {
            if (realtimeChannel) {
                const sync = await getSyncClient();
                sync.removeChannel(realtimeChannel);
                realtimeChannel = null;
            }

            try {
                const sync = await getSyncClient();
                realtimeChannel = sync
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
                const sync = await getSyncClient();
                sync.removeChannel(movieRealtimeChannel);
                movieRealtimeChannel = null;
            }

            try {
                const sync = await getSyncClient();
                movieRealtimeChannel = sync
                    .channel('public:movora_movie_comments')
                    .on(
                        'postgres_changes',
                        { event: 'INSERT', schema: 'public', table: 'movora_comments' },
                        (payload: any) => {
                            const newMsg = payload.new as Comment;
                            if (['movie', 'tv', 'anime'].includes(newMsg.media_type) && newMsg.media_id !== 'lounge') {
                                if (!allMovieComments.value.some(c => c.id === newMsg.id)) {
                                    allMovieComments.value.unshift(newMsg);
                                    if (allMovieComments.value.length > 500) {
                                        allMovieComments.value.pop();
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
            if (!newCommentText.value.trim()) return;
            if (isToxic(newCommentText.value)) {
                alert('Your message has been removed for violating our community guidelines.');
                submitting.value = false;
                return;
            }
            submitting.value = true;

            const nameToPost = isLoggedIn.value
                ? `@${currentUsername.value}`
                : 'Anonymous';

            try {
                const sync = await getSyncClient();
                const { data, error } = await sync
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



        const formatTimeAgo = (dateStr: string) => {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '';

            const dateFormatted = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            const timeFormatted = date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            return `${dateFormatted} at ${timeFormatted}`;
        };

        const escapeHtml = (str: string): string => {
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        const formatCommentContent = (content: string): string => {
            if (!content) return '';
            let safe = escapeHtml(content);

            // 1. Spoilers ||text||
            safe = safe.replace(/\|\|([^|]+)\|\|/g, (_match, p1) => {
                return `<span class="comment-spoiler" title="Click to reveal spoiler">${p1}</span>`;
            });

            // 2. Bold **text**
            safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

            // 3. Italic *text*
            safe = safe.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

            // 4. Strikethrough ~~text~~
            safe = safe.replace(/~~([^~]+)~~/g, '<s>$1</s>');

            // 5. Line breaks
            safe = safe.replace(/\n/g, '<br>');

            return safe;
        };

        checkAuth();

        let lastSpoilerTouch = 0;
        const handleSpoilerToggle = (e: Event) => {
            const target = (e.target as HTMLElement).closest('.comment-spoiler');
            if (!target) return;
            if (e.type === 'touchend') {
                lastSpoilerTouch = Date.now();
                target.classList.toggle('is-revealed');
            } else if (e.type === 'click') {
                if (Date.now() - lastSpoilerTouch < 500) return;
                target.classList.toggle('is-revealed');
            }
        };

        onMounted(() => {
            loadBlockedData();
            // A nav hover can prefetch an older cached feed. Always refresh the
            // reviews feed when the page itself is opened.
            resetDiscussFeedCache();
            void bootstrapDiscuss();
            updateSeo({
                title: 'Discuss — Moovie',
                description: 'Open chat and title-specific reviews on Moovie.',
                canonical: 'https://moovie.fun/discuss'
            });
            window.addEventListener('movora_auth_change', checkAuth);
            window.addEventListener('click', handleOutsideClick);
            window.addEventListener('click', handleSpoilerToggle);
            window.addEventListener('touchend', handleSpoilerToggle, { passive: true });
        });

        onBeforeUnmount(async () => {
            resetDiscussFeedCache();
            window.removeEventListener('movora_auth_change', checkAuth);
            window.removeEventListener('click', handleOutsideClick);
            window.removeEventListener('click', handleSpoilerToggle);
            window.removeEventListener('touchend', handleSpoilerToggle);
            if (realtimeChannel) {
                const sync = await getSyncClient();
                sync.removeChannel(realtimeChannel);
            }
            if (movieRealtimeChannel) {
                const sync = await getSyncClient();
                sync.removeChannel(movieRealtimeChannel);
            }
            if (selectedMovieRealtimeChannel) {
                const sync = await getSyncClient();
                sync.removeChannel(selectedMovieRealtimeChannel);
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
            getAvatarUrl,
            getUsernameColor,
            isSelf,
            formatTimeAgo,
            formatCommentContent,
            handleScroll,
            getCategoryIcon,
            getMovieLink,
            checkAuth,
            handleReviewsScroll,
            
            // Formatting and Inputs
            loungeInput,
            threadInput,
            wrapText,

            // Reporting and Blocking
            showReportModal,
            reportingComment,
            reportReason,
            reportDetails,
            openReportModal,
            closeReportModal,
            submitReport,
            isCommentBlockedOrReported,

            // Composer Actions
            handlePostComment,

            // Movie-specific Discussion
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
            
            // Emoji Picker additions
            showLoungeEmojiPicker,
            showThreadEmojiPicker,
            popularEmojis,
            toggleEmojiPicker,
            insertEmoji
        };
    }
});
</script>

<style lang="scss" scoped>
@mixin discuss-nav-type($color: var(--bone-300)) {
    font-family: var(--font-ui);
    font-size: var(--fs-sm);
    font-weight: 500;
    letter-spacing: var(--ls-snug);
    color: $color;
}

.discuss-page {
    position: relative;
    height: 100dvh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--ink-900);
    color: var(--bone-50);

    &__main {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        padding-block: var(--s-3);
    }

    &__content {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        width: 100%;
    }
}

.discuss-layout {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: clamp(0.75rem, 2vw, 1rem);
    width: 100%;
    height: 100%;
    overflow: hidden;

    @media (max-width: 900px) {
        grid-template-columns: 1fr;
        grid-template-rows: repeat(2, minmax(0, 1fr));

        .discuss-chat--reviews {
            order: 1;
        }

        .discuss-chat--lounge {
            order: 2;
        }
    }
}

.discuss-chat {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    overflow: hidden;
    position: relative;
    background: var(--surface-tint);
    border: 1px solid var(--rule);
    border-radius: var(--r-md);

    &__header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--s-3);
        padding: var(--s-4);
        border-bottom: 1px solid var(--rule);
        flex-shrink: 0;
    }

    &__header-copy {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        min-width: 0;

        &--thread {
            flex-direction: row;
            align-items: center;
            gap: var(--s-3);
        }
    }

    &__thread-copy {
        min-width: 0;
    }

    &__eyebrow {
        margin: 0;
    }

    &__back-btn {
        flex-shrink: 0;
        padding: 0.3rem 0.7rem;
    }

    &__panel-title {
        @include discuss-nav-type(var(--bone-50));
        line-height: 1.25;
        margin: 0;

        &--truncate {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: min(24rem, 100%);
        }
    }

    &__panel-title-link {
        color: var(--bone-50);
        text-decoration: none;
        transition: color 0.2s ease;

        &:hover {
            color: var(--ember);
            text-decoration: underline;
            text-underline-offset: 4px;
        }
    }

    &__user-badge {
        @include discuss-nav-type(var(--bone-300));
        flex-shrink: 0;
        text-align: right;
    }

    &__messages {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        padding: var(--s-5);
        display: flex;
        flex-direction: column;
        gap: 8px;
        background-color: var(--ink-900); /* Match site aesthetics */
        background-image: radial-gradient(rgba(245, 239, 228, 0.02) 1.2px, transparent 0),
                          radial-gradient(rgba(245, 239, 228, 0.02) 1.2px, transparent 0);
        background-size: 24px 24px;
        background-position: 0 0, 12px 12px;
        position: relative;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;

        &::-webkit-scrollbar {
            width: 6px;
        }
        &::-webkit-scrollbar-track {
            background: transparent;
        }
        &::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
        }
    }

    &__loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--s-3);
        margin: auto;
        @include discuss-nav-type(var(--bone-300));
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
        padding: var(--s-6);
        @include discuss-nav-type(var(--bone-300));
    }

    &__message-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    &__composer {
        border-top: 1px solid var(--rule);
        padding: 10px 16px;
        display: flex;
        flex-direction: column;
        gap: var(--s-2);
        flex-shrink: 0;
        background: var(--ink-850); /* Match site aesthetics */
        position: relative;
    }

    &__message-input {
        flex: 1;
        background: transparent !important;
        border: none !important;
        color: #e9edef !important;
        font-family: var(--font-ui);
        font-size: 0.95rem;
        font-weight: 400;
        padding: 10px 4px;
        min-width: 0;

        &:focus {
            outline: none !important;
        }

        &::placeholder {
            color: #8696a0;
        }
    }

    &__send-btn {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: var(--ember); /* Match site aesthetics (ember) */
        color: #fff;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 0 0 2px;
        flex-shrink: 0;
        cursor: pointer;
        transition: transform 0.15s cubic-bezier(0.18, 0.89, 0.32, 1.28), background-color 0.15s ease;
        box-shadow: 0 1px 2px rgba(0,0,0,0.3);

        &:hover {
            transform: scale(1.06);
            background: var(--ember-600);
        }
        &:active {
            transform: scale(0.94);
        }
        &:disabled {
            background: var(--ink-800);
            color: var(--bone-500);
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        svg {
            width: 20px;
            height: 20px;
        }
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
            @include discuss-nav-type(var(--bone-300));
        }

        .login-prompt-btn {
            white-space: nowrap;
        }
    }
}

.discuss-composer-input-wrapper {
    display: flex;
    align-items: center;
    background: var(--ink-800); /* Match site aesthetics */
    border: none;
    border-radius: 24px;
    flex: 1;
    padding-inline: 12px;
    gap: 8px;
    box-shadow: 0 1px 1px rgba(0,0,0,0.1);
}

.discuss-composer-btn {
    background: transparent;
    border: none;
    color: #8696a0; /* WhatsApp icons */
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
    flex-shrink: 0;

    &:hover {
        color: #e9edef;
    }
}

.discuss-composer-form {
    display: flex;
    gap: var(--s-2);
    align-items: center;
    width: 100%;

    &--stacked {
        flex-direction: column;
        align-items: stretch;
    }
}

.discuss-composer-anon-hint {
    margin: 0;
    @include discuss-nav-type(var(--bone-300));
}

.discuss-composer-signin {
    all: unset;
    cursor: pointer;
    color: var(--ember);
    text-decoration: underline;
    text-underline-offset: 2px;
}

.discuss-composer-input-row {
    display: flex;
    gap: var(--s-2);
    width: 100%;
}

/* Chat bubble styling */
.discuss-msg {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    max-width: 75%;
    margin-bottom: 4px;
    animation: messageFadeIn 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;

    &--self {
        align-self: flex-end;
        flex-direction: row-reverse;
        max-width: 75%;

        .discuss-msg__body {
            align-items: flex-end;
        }

        .discuss-msg__bubble {
            background: rgba(255, 255, 255, 0.15); /* Ember tinted dark bubble */
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px 0 8px 8px;
            color: #e9edef;
            box-shadow: 0 1px 0.5px rgba(0, 0, 0, 0.13);
        }

        .discuss-msg__actions {
            justify-content: flex-end;
        }
    }

    &--movie-card {
        max-width: 100%;
        width: 100%;
        animation: none;
    }

    &--reported {
        opacity: 0.6;
        .discuss-msg__bubble {
            background: rgba(239, 68, 68, 0.1) !important;
            border: 1px solid rgba(239, 68, 68, 0.3) !important;
        }
    }

    &__avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        overflow: hidden;
        background: var(--ink-800);
        border: none;
        margin-bottom: 2px;
    }

    &__avatar-img {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
    }

    &__body {
        display: flex;
        flex-direction: column;
        gap: 2px;
        max-width: 100%;

        &--full {
            width: 100%;
        }
    }

    &__meta {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        margin-bottom: 4px;

        .discuss-msg__time {
            margin-left: auto;
            white-space: nowrap;
        }
    }

    &__bubble {
        background: rgba(255, 255, 255, 0.15); /* Ember tinted dark bubble */
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 0 8px 8px 8px;
        padding: 6px 8px 6px 10px;
        word-break: break-word;
        box-shadow: 0 1px 0.5px rgba(0, 0, 0, 0.13);
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 80px;

        &--movie {
            border-radius: 8px;
            background: rgba(245, 239, 228, 0.04);
            border: 1px solid var(--rule);
        }
    }

    &__bubble-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 2px;
    }

    &__username {
        font-family: var(--font-ui);
        font-size: 0.75rem;
        font-weight: 600;
    }

    &__badge {
        font-family: var(--font-ui);
        font-size: 0.65rem;
        font-weight: 500;
        background: rgba(255, 255, 255, 0.12);
        color: var(--ember);
        padding: 0px 5px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.25);
    }

    &__topic-badge {
        @include discuss-nav-type(var(--bone-50));
        background: var(--surface-tint);
        padding: 0.15rem 0.55rem;
        border-radius: var(--r-pill);
        border: 1px solid var(--rule);
        text-decoration: none;
        transition: all 0.2s ease;

        &--link:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.3);
            color: var(--ember) !important;
            text-decoration: none;
        }
    }

    &__text {
        margin: 0;
        font-family: var(--font-ui);
        font-size: 0.88rem;
        font-weight: 400;
        line-height: 1.4;
        color: #e9edef;
    }

    &__bubble-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;
        align-self: flex-end;
        margin-top: 1px;
    }

    &__time {
        font-family: var(--font-ui);
        font-size: 0.65rem;
        font-weight: 400;
        color: #8696a0;
        text-transform: none;
    }

    &__status {
        display: flex;
        align-items: center;
        color: #53bdeb; /* WhatsApp blue ticks */
        flex-shrink: 0;
    }

    &__movie-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: var(--s-1);
        width: 100%;
    }

    &__redirect-link {
        @include discuss-nav-type(var(--bone-300));
        padding: 0.35rem 0.75rem;
        border-radius: var(--r-pill);
        text-decoration: none;

        &:hover {
            color: var(--bone-50);
            background: var(--surface-tint);
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
        @include discuss-nav-type(var(--bone-300));
        background: transparent;
        border: 0;
        cursor: pointer;
        padding: 0.15rem 0.35rem;
        border-radius: var(--r-sm);
        transition: color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out);

        &:hover {
            color: #ef4444;
            background: rgba(239, 68, 68, 0.06);
        }
    }

    &__reported-tag {
        @include discuss-nav-type(#ef4444);
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
        background: var(--ink-800);
        border: 1px solid var(--rule);
        border-radius: var(--r-md);
        padding: var(--s-6);
        max-width: 460px;
        width: 100%;
        box-shadow: var(--shadow-lg);
    }

    &__title {
        font-family: var(--font-display);
        font-size: clamp(1.05rem, 1.4vw, 1.3rem);
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

/* Shimmering skeletons */
.discuss-msg--shimmer {
    opacity: 0.8;
    margin-bottom: var(--s-4);
}

.discuss-msg__avatar--shimmer {
    background: var(--surface-tint-hover) !important;
    position: relative;
    overflow: hidden;
    width: 32px;
    height: 32px;
    border-radius: var(--r-pill);
    
    &::after {
        content: '';
        position: absolute;
        inset: 0;
        transform: translateX(-100%);
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
        animation: shimmer 1.5s infinite;
    }
}

.discuss-msg__bubble--shimmer {
    background: var(--surface-tint-hover) !important;
    border-color: var(--rule) !important;
    width: 250px;
    height: 60px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    padding: 0.5rem 0.85rem;
}

.shimmer-bar {
    background: var(--rule-strong);
    border-radius: var(--r-sm);
    position: relative;
    overflow: hidden;

    &::after {
        content: '';
        position: absolute;
        inset: 0;
        transform: translateX(-100%);
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
        animation: shimmer 1.5s infinite;
    }

    &--username {
        width: 80px;
        height: 12px;
        margin-bottom: 4px;
    }

    &--time {
        width: 50px;
        height: 8px;
        margin-bottom: 4px;
    }

    &--line1 {
        width: 100%;
        height: 10px;
    }

    &--line2 {
        width: 60%;
        height: 10px;
    }

    &--topic {
        width: 110px;
        height: 18px;
        border-radius: var(--r-pill);
    }
}

.discuss-chat__shimmer-list {
    display: flex;
    flex-direction: column;
    gap: var(--s-4);
    width: 100%;
}

.discuss-msg__bubble--shimmer-wide {
    width: min(100%, 320px);
}

@keyframes shimmer {
    100% {
        transform: translateX(100%);
    }
}

.discuss-emoji-picker {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 16px;
    background: var(--ink-800);
    border: 1px solid var(--rule);
    border-radius: 12px;
    padding: 8px;
    display: flex;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
    z-index: 100;
    animation: pickerSlideUp 0.15s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
}

.discuss-emoji-btn {
    background: transparent;
    border: none;
    font-size: 1.35rem;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    transition: background-color 0.15s ease, transform 0.1s ease;

    &:hover {
        background: var(--surface-tint-hover);
        transform: scale(1.15);
    }
    &:active {
        transform: scale(0.9);
    }
}

@keyframes pickerSlideUp {
    from {
        opacity: 0;
        transform: translateY(8px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes messageFadeIn {
    from {
        opacity: 0;
        transform: translateY(12px) scale(0.97);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.discuss-composer-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 4px 4px;
}

.fmt-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 24px;
    background: transparent;
    border: none;
    color: var(--bone-400);
    font-family: var(--font-ui);
    font-size: var(--fs-xs);
    cursor: pointer;
    border-radius: var(--r-sm);
    transition: background var(--dur-fast), color var(--dur-fast);
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;

    &:hover {
        background: var(--ink-600);
        color: var(--bone-50);
    }

    &--spoiler {
        width: auto;
        padding: 0 6px;
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        background: rgba(255, 255, 255, 0.06);
        color: var(--bone-200);

        &:hover {
            background: rgba(255, 255, 255, 0.12);
            color: var(--bone-50);
        }
    }
}

.discuss-msg__text--blocked {
    color: var(--bone-400, #8a8270) !important;
    font-style: italic;
    opacity: 0.6;
    background: none;
    border: none;
    padding: 0;
    display: inline-block;
}

:deep(.comment-spoiler) {
    display: inline-block;
    background: var(--ink-700, #1c1915) !important;
    color: var(--ink-700, #1c1915) !important;
    text-shadow: none !important;
    border-radius: var(--r-xs, 6px);
    padding: 1px 7px;
    margin: 0 2px;
    cursor: pointer;
    touch-action: manipulation !important;
    -webkit-tap-highlight-color: transparent !important;
    user-select: none !important;
    -webkit-user-select: none !important;
    transition: all var(--dur-fast, 0.2s) ease;
    border: 1px dashed var(--rule-strong, rgba(245, 239, 228, 0.16));
    line-height: 1.4;
    font-size: 0.9em;

    &:hover {
        background: var(--ink-600, #2a251e) !important;
        color: var(--ink-600, #2a251e) !important;
        border-color: var(--ember, #ffffff);
        box-shadow: 0 0 10px rgba(255, 255, 255, 0.25);
    }

    &.is-revealed {
        background: rgba(255, 255, 255, 0.12) !important;
        color: var(--bone-50, #f5efe4) !important;
        text-shadow: none !important;
        user-select: text !important;
        -webkit-user-select: text !important;
        border: 1px solid rgba(255, 255, 255, 0.35);
        box-shadow: 0 0 12px rgba(255, 255, 255, 0.15);
    }
}
</style>
