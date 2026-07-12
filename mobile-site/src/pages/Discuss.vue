<template>
    <MobileShell immersive>
        <div class="m-discuss">
            <header class="m-discuss__head">
                <LmTabs
                    v-if="!selectedMovieId"
                    v-model="activeTab"
                    :tabs="tabs"
                    variant="pill"
                    aria-label="Discuss sections"
                />
                <button
                    v-else
                    type="button"
                    class="m-discuss__back"
                    @click="closeMovieDiscussion"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                    Back to reviews
                </button>
            </header>

            <section
                v-if="activeTab === 'lounge' && !selectedMovieId"
                class="m-discuss__panel"
                aria-label="Open chat"
            >
                <div class="m-discuss__panel-head">
                    <div>
                        <p class="eyebrow">Live now</p>
                        <h1 class="m-discuss__title">Open chat</h1>
                    </div>
                    <span v-if="isLoggedIn" class="meta m-discuss__badge">@{{ currentUsername }}</span>
                    <span v-else class="meta">Guest</span>
                </div>

                <div ref="chatBox" class="m-discuss__feed" @scroll="handleScroll">
                    <div v-if="loading" class="m-discuss__loading meta">Loading chat…</div>
                    <div v-else-if="!comments.length" class="m-discuss__empty meta">
                        No messages yet. Say hello below.
                    </div>
                    <div v-else class="m-discuss__messages">
                        <article
                            v-for="c in comments"
                            :key="c.id"
                            class="m-discuss__msg"
                            :class="{ 'is-self': isSelf(c.username) }"
                        >
                            <img v-if="!isSelf(c.username)" :src="getAvatarUrl(c.username)" :alt="c.username" class="m-discuss__avatar" />
                            <div class="m-discuss__bubble">
                                <div class="m-discuss__bubble-header" v-if="!isSelf(c.username)">
                                    <span class="m-discuss__user" :style="{ color: getUsernameColor(c.username) }">{{ c.username }}</span>
                                </div>
                                <p class="m-discuss__text">{{ c.content }}</p>
                                <div class="m-discuss__bubble-footer">
                                    <span class="m-discuss__time">{{ formatTimeAgo(c.created_at) }}</span>
                                    <span v-if="isSelf(c.username)" class="m-discuss__status">
                                        <svg viewBox="0 0 16 11" width="14" height="10" fill="currentColor">
                                            <path d="M15 1.084L5.672 10.375 1.5 6.22 2.583 5.14l3.089 3.076 8.243-8.212L15 1.084z M11.531 1.084l-4.7 4.697-0.781-0.78-1.085 1.082 1.866 1.866 5.785-5.782-1.085-1.083z"/>
                                        </svg>
                                    </span>
                                </div>
                            </div>
                            <button
                                v-if="!c.isReported && !isSelf(c.username)"
                                type="button"
                                class="m-discuss__report"
                                @click="openReportModal(c)"
                            >
                                Report
                            </button>
                        </article>
                    </div>
                </div>

                <footer class="m-discuss__composer">
                    <!-- Emoji Picker Popover -->
                    <div v-if="showLoungeEmojiPicker" class="m-discuss__emoji-picker">
                        <button 
                            v-for="emoji in popularEmojis" 
                            :key="emoji" 
                            type="button" 
                            class="m-discuss__emoji-btn" 
                            @click="insertEmoji(emoji, 'lounge')"
                        >
                            {{ emoji }}
                        </button>
                    </div>
                    <div v-if="!isLoggedIn" class="m-discuss__login-prompt">
                        <p class="meta">Sign in to post in the chat.</p>
                        <button type="button" class="m-discuss__signin" @click="showAuthModal = true">Sign In</button>
                    </div>
                    <form v-else class="m-discuss__form" @submit.prevent="handlePostComment">
                        <div class="m-discuss__input-wrapper">
                            <button type="button" class="m-discuss__composer-btn" aria-label="Emojis" @click.stop="toggleEmojiPicker('lounge')">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                                    <line x1="9" y1="9" x2="9.01" y2="9"></line>
                                    <line x1="15" y1="9" x2="15.01" y2="9"></line>
                                </svg>
                            </button>
                            <input
                                v-model="newCommentText"
                                type="text"
                                class="m-discuss__input"
                                placeholder="Type a message…"
                                :disabled="submitting"
                                required
                            />
                        </div>
                        <button type="submit" class="m-discuss__send" :disabled="submitting || !newCommentText.trim()">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                            </svg>
                        </button>
                    </form>
                </footer>
            </section>

            <section
                v-else-if="!selectedMovieId"
                class="m-discuss__panel"
                aria-label="Title reviews"
            >
                <div class="m-discuss__panel-head">
                    <div>
                        <p class="eyebrow">From the catalogue</p>
                        <h1 class="m-discuss__title">Title reviews</h1>
                    </div>
                </div>

                <div class="m-discuss__feed m-discuss__feed--reviews">
                    <div v-if="loadingMovie" class="m-discuss__loading meta">Loading reviews…</div>
                    <div v-else-if="!movieComments.length" class="m-discuss__empty meta">
                        No reviews yet. Start writing on film pages.
                    </div>
                    <div v-else class="m-discuss__messages">
                        <article
                            v-for="c in movieComments"
                            :key="c.id"
                            class="m-discuss__msg m-discuss__msg--review"
                        >
                            <img :src="getAvatarUrl(c.username)" :alt="c.username" class="m-discuss__avatar" />
                            <div class="m-discuss__bubble-wrap">
                                <div class="m-discuss__meta">
                                    <span class="m-discuss__user">{{ c.username }}</span>
                                    <span class="meta">{{ formatTimeAgo(c.created_at) }}</span>
                                </div>
                                <router-link :to="getMovieLink(c.media_type || 'movie', c.media_id || '')" class="m-discuss__topic m-discuss__topic--link">
                                    {{ getCategoryIcon(c.media_type || 'movie') }}
                                    {{ getMediaName(c.media_type || 'movie', c.media_id || '') }}
                                </router-link>
                                <p class="m-discuss__text">{{ c.content }}</p>
                                <div class="m-discuss__review-actions">
                                    <button
                                        type="button"
                                        class="m-discuss__thread-btn"
                                        @click="viewMovieDiscussion(c.media_type || 'movie', c.media_id || '')"
                                    >
                                        Open thread
                                    </button>
                                    <button
                                        v-if="!c.isReported"
                                        type="button"
                                        class="m-discuss__report"
                                        @click="openReportModal(c)"
                                    >
                                        Report
                                    </button>
                                </div>
                            </div>
                        </article>
                    </div>
                </div>
            </section>

            <section
                v-else
                class="m-discuss__panel"
                aria-label="Title thread"
            >
                <div class="m-discuss__panel-head">
                    <div>
                        <p class="eyebrow">Title thread</p>
                        <h1 class="m-discuss__title m-discuss__title--truncate">
                            <router-link :to="getMovieLink(selectedMovieType, selectedMovieId)" class="m-discuss__title-link">
                                {{ getMediaName(selectedMovieType, selectedMovieId) }}
                            </router-link>
                        </h1>
                    </div>
                </div>

                <div ref="movieChatBox" class="m-discuss__feed" @scroll="handleMovieChatScroll">
                    <div v-if="loadingSelectedMovie" class="m-discuss__loading meta">Loading thread…</div>
                    <div v-else-if="!selectedMovieComments.length" class="m-discuss__empty meta">
                        No replies yet. Be the first.
                    </div>
                    <div v-else class="m-discuss__messages">
                        <article
                            v-for="c in selectedMovieComments"
                            :key="c.id"
                            class="m-discuss__msg"
                            :class="{ 'is-self': isSelf(c.username) }"
                        >
                            <img v-if="!isSelf(c.username)" :src="getAvatarUrl(c.username)" :alt="c.username" class="m-discuss__avatar" />
                            <div class="m-discuss__bubble">
                                <div class="m-discuss__bubble-header" v-if="!isSelf(c.username)">
                                    <span class="m-discuss__user" :style="{ color: getUsernameColor(c.username) }">{{ c.username }}</span>
                                </div>
                                <p class="m-discuss__text">{{ c.content }}</p>
                                <div class="m-discuss__bubble-footer">
                                    <span class="m-discuss__time">{{ formatTimeAgo(c.created_at) }}</span>
                                    <span v-if="isSelf(c.username)" class="m-discuss__status">
                                        <svg viewBox="0 0 16 11" width="14" height="10" fill="currentColor">
                                            <path d="M15 1.084L5.672 10.375 1.5 6.22 2.583 5.14l3.089 3.076 8.243-8.212L15 1.084z M11.531 1.084l-4.7 4.697-0.781-0.78-1.085 1.082 1.866 1.866 5.785-5.782-1.085-1.083z"/>
                                        </svg>
                                    </span>
                                </div>
                            </div>
                        </article>
                    </div>
                </div>

                <footer class="m-discuss__composer">
                    <!-- Emoji Picker Popover -->
                    <div v-if="showThreadEmojiPicker" class="m-discuss__emoji-picker">
                        <button 
                            v-for="emoji in popularEmojis" 
                            :key="emoji" 
                            type="button" 
                            class="m-discuss__emoji-btn" 
                            @click="insertEmoji(emoji, 'thread')"
                        >
                            {{ emoji }}
                        </button>
                    </div>
                    <form class="m-discuss__form" @submit.prevent="postSelectedMovieComment">
                        <div class="m-discuss__input-wrapper">
                            <button type="button" class="m-discuss__composer-btn" aria-label="Emojis" @click.stop="toggleEmojiPicker('thread')">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                                    <line x1="9" y1="9" x2="9.01" y2="9"></line>
                                    <line x1="15" y1="9" x2="15.01" y2="9"></line>
                                </svg>
                            </button>
                            <input
                                v-model="newSelectedCommentText"
                                type="text"
                                class="m-discuss__input"
                                placeholder="Type a message…"
                                :disabled="submittingSelected"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            class="m-discuss__send"
                            :disabled="submittingSelected || !newSelectedCommentText.trim()"
                        >
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                            </svg>
                        </button>
                    </form>
                    <p v-if="!isLoggedIn" class="meta m-discuss__anon-hint">
                        Posting as Anonymous.
                        <button type="button" class="m-discuss__inline-signin" @click="showAuthModal = true">
                            Sign in
                        </button>
                    </p>
                </footer>
            </section>
        </div>

        <AuthModal :is-open="showAuthModal" @close="showAuthModal = false; checkAuth()" />

        <div v-if="showReportModal" class="m-discuss__modal" role="dialog" aria-modal="true">
            <div class="m-discuss__modal-backdrop" @click="closeReportModal" />
            <div class="m-discuss__modal-card">
                <h2 class="m-discuss__modal-title">Report post</h2>
                <p class="meta">Why are you flagging this post?</p>
                <form class="m-discuss__report-form" @submit.prevent="submitReport">
                    <label class="m-discuss__field">
                        <span class="eyebrow">Reason</span>
                        <select v-model="reportReason" class="m-discuss__select" required>
                            <option value="spam">Spam / Ad links</option>
                            <option value="abuse">Harassment or Abuse</option>
                            <option value="spoiler">Spoilers without warning</option>
                            <option value="inappropriate">Inappropriate text</option>
                            <option value="other">Other reason</option>
                        </select>
                    </label>
                    <label class="m-discuss__field">
                        <span class="eyebrow">Details</span>
                        <textarea v-model="reportDetails" class="m-discuss__textarea" rows="3" placeholder="Optional" />
                    </label>
                    <div class="m-discuss__modal-actions">
                        <button type="button" class="m-discuss__cancel" @click="closeReportModal">Cancel</button>
                        <button type="submit" class="m-discuss__send" :disabled="submittingReport">
                            {{ submittingReport ? 'Flagging…' : 'Submit' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </MobileShell>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import MobileShell from '../layout/MobileShell.vue';
import LmTabs from '@/components/primitives/Tabs.vue';
import AuthModal from '@/components/navigation/AuthModal.vue';
import { useDiscussPage } from '@/composables/useDiscussPage';
import { useSeo } from '../composables/useSeo';

const activeTab = ref<'lounge' | 'reviews'>('lounge');

const tabs = [
    { label: 'Open Chat', value: 'lounge' },
    { label: 'Reviews', value: 'reviews' }
];

const {
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
    showReportModal,
    reportReason,
    reportDetails,
    submittingReport,
    openReportModal,
    closeReportModal,
    submitReport,
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
    showLoungeEmojiPicker,
    showThreadEmojiPicker,
    popularEmojis,
    toggleEmojiPicker,
    insertEmoji,
    getMovieLink
} = useDiscussPage();

const { updateSeo } = useSeo();

onMounted(() => {
    updateSeo({
        title: 'Discuss — Moovie',
        description: 'Open chat and title reviews on Moovie.',
        canonical: 'https://m.moovie.fun/discuss'
    });
});
</script>

<style lang="scss" scoped>
.m-discuss {
    display: flex;
    flex-direction: column;
    height: calc(100dvh - max(env(safe-area-inset-top, 0px), var(--s-2)) - 2.85rem);
    min-height: 0;

    &__head {
        flex-shrink: 0;
        padding: var(--s-3) var(--s-3) 0;
    }

    &__back {
        display: inline-flex;
        align-items: center;
        gap: var(--s-1);
        min-height: 2.75rem;
        padding: 0 var(--s-3);
        border-radius: var(--r-pill);
        border: 1px solid var(--rule);
        background: var(--ink-850);
        color: var(--bone-100);
        font-family: var(--font-ui);
        font-size: 0.78rem;
        font-weight: 600;

        svg {
            width: 1rem;
            height: 1rem;
        }
    }

    &__panel {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        padding: var(--s-3);
        gap: var(--s-3);
    }

    &__panel-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--s-3);
        flex-shrink: 0;
    }

    &__title {
        margin: var(--s-1) 0 0;
        font-family: var(--font-display);
        font-size: 1.25rem;

        &--truncate {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 14rem;
        }
    }

    &__title-link {
        color: var(--bone-50);
        text-decoration: none;
        transition: color 0.2s ease;

        &:active,
        &:hover {
            color: var(--ember);
            text-decoration: underline;
            text-underline-offset: 4px;
        }
    }

    &__badge {
        flex-shrink: 0;
        padding: 0.2rem 0.55rem;
        border-radius: var(--r-pill);
        border: 1px solid var(--rule);
        background: var(--ink-850);
    }

    &__feed {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        border: 1px solid var(--rule);
        border-radius: var(--r-md);
        background-color: var(--ink-900); /* Match site aesthetics */
        background-image: radial-gradient(rgba(245, 239, 228, 0.02) 1.2px, transparent 0),
                          radial-gradient(rgba(245, 239, 228, 0.02) 1.2px, transparent 0);
        background-size: 24px 24px;
        background-position: 0 0, 12px 12px;
        padding: var(--s-3);

        &--reviews {
            margin-bottom: 0;
            background-color: var(--ink-850);
            background-image: none;
        }
    }

    &__loading,
    &__empty {
        display: grid;
        place-items: center;
        min-height: 8rem;
        text-align: center;
    }

    &__messages {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    &__msg {
        display: flex;
        gap: 8px;
        align-items: flex-end;
        max-width: 85%;
        margin-bottom: 2px;
        animation: messageFadeIn 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;

        &.is-self {
            align-self: flex-end;
            flex-direction: row-reverse;
            max-width: 85%;

            .m-discuss__bubble {
                background: rgba(255, 90, 31, 0.15); /* Ember tinted dark bubble */
                border: 1px solid rgba(255, 90, 31, 0.3);
                border-radius: 8px 0 8px 8px;
            }
        }

        &--review {
            display: grid;
            grid-template-columns: 2.25rem 1fr;
            max-width: 100%;
            animation: none;
            align-items: start;
        }
    }

    &__avatar {
        width: 1.75rem;
        height: 1.75rem;
        border-radius: var(--r-pill);
        background: var(--ink-800);
        flex-shrink: 0;
        margin-bottom: 2px;
    }

    &__bubble {
        background: var(--ink-800); /* Match site aesthetics */
        border: 1px solid var(--rule);
        border-radius: 0 8px 8px 8px;
        padding: 6px 8px 6px 10px;
        word-break: break-word;
        box-shadow: 0 1px 0.5px rgba(0, 0, 0, 0.13);
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 80px;
        max-width: 100%;
    }

    &__bubble-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 1px;
    }

    &__user {
        font-family: var(--font-ui);
        font-size: 0.72rem;
        font-weight: 600;
    }

    &__topic {
        display: inline-block;
        margin-bottom: 0.35rem;
        padding: 0.15rem 0.5rem;
        border-radius: var(--r-pill);
        background: var(--ink-800);
        font-size: 0.72rem;
        text-decoration: none;
        color: var(--bone-200);
        transition: all 0.2s ease;

        &--link:active,
        &--link:hover {
            background: rgba(255, 90, 31, 0.1);
            border-color: rgba(255, 90, 31, 0.3);
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
        font-size: 0.62rem;
        font-weight: 400;
        color: #8696a0;
    }

    &__status {
        display: flex;
        align-items: center;
        color: #53bdeb; /* WhatsApp blue ticks */
        flex-shrink: 0;
    }

    &__report,
    &__thread-btn {
        padding: 0;
        border: 0;
        background: none;
        color: var(--bone-400);
        font-size: 0.72rem;
        text-decoration: underline;
        align-self: center;
        margin-top: 2px;
    }

    &__review-actions {
        display: flex;
        gap: var(--s-3);
        align-items: center;
        margin-top: 0.35rem;
    }

    &__composer {
        flex-shrink: 0;
        display: grid;
        gap: var(--s-2);
        padding: 6px 4px;
        position: relative;
     }

    &__login-prompt {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-3);
        padding: var(--s-3);
        border-radius: var(--r-md);
        border: 1px dashed var(--rule);
    }

    &__signin {
        min-height: 2.5rem;
        padding: 0 var(--s-4);
        border-radius: var(--r-pill);
        border: 1px solid var(--ember);
        background: var(--ember);
        color: var(--ink-900);
        font-family: var(--font-ui);
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
    }

    &__send {
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

        &:disabled {
            background: var(--ink-800);
            color: var(--bone-500);
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        svg {
            width: 18px;
            height: 18px;
        }
    }

    &__form {
        display: flex;
        gap: 8px;
        align-items: center;
        width: 100%;
    }

    &__input-wrapper {
        display: flex;
        align-items: center;
        background: var(--ink-800); /* Match site aesthetics */
        border: none;
        border-radius: 24px;
        flex: 1;
        padding-inline: 12px;
        gap: 6px;
        box-shadow: 0 1px 1px rgba(0,0,0,0.1);
        min-width: 0;
    }

    &__composer-btn {
        background: transparent;
        border: none;
        color: #8696a0;
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

    &__input {
        flex: 1;
        min-height: 2.5rem;
        background: transparent !important;
        border: none !important;
        color: #e9edef !important;
        font-size: 16px;
        padding: 8px 4px;
        min-width: 0;

        &:focus {
            outline: none !important;
        }

        &::placeholder {
            color: #8696a0;
        }
    }

    &__anon-hint {
        text-align: center;
    }

    &__inline-signin {
        padding: 0;
        border: 0;
        background: none;
        color: var(--ember);
        text-decoration: underline;
    }

    &__modal {
        position: fixed;
        inset: 0;
        z-index: 200;
        display: grid;
        place-items: end center;
        padding: var(--s-4);
    }

    &__modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
    }

    &__modal-card {
        position: relative;
        width: min(100%, 24rem);
        padding: var(--s-4);
        border-radius: var(--r-md);
        border: 1px solid var(--rule-strong);
        background: var(--ink-850);
    }

    &__modal-title {
        margin: 0 0 var(--s-2);
        font-family: var(--font-display);
        font-size: 1.2rem;
    }

    &__report-form {
        display: grid;
        gap: var(--s-3);
        margin-top: var(--s-3);
    }

    &__field {
        display: grid;
        gap: var(--s-2);
    }

    &__select,
    &__textarea {
        width: 100%;
        min-height: 2.75rem;
        padding: var(--s-2) var(--s-3);
        border-radius: var(--r-md);
        border: 1px solid var(--rule-strong);
        background: var(--ink-800);
        color: var(--bone-50);
        font-size: 16px;
    }

    &__modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--s-2);
    }

    &__cancel {
        min-height: 2.75rem;
        padding: 0 var(--s-3);
        border-radius: var(--r-pill);
        border: 1px solid var(--rule);
        background: transparent;
        color: var(--bone-200);
        font-size: 0.78rem;
        font-weight: 600;
    }

    &__emoji-picker {
        position: absolute;
        bottom: calc(100% + 8px);
        left: 8px;
        right: 8px;
        background: var(--ink-800);
        border: 1px solid var(--rule);
        border-radius: 12px;
        padding: 6px;
        display: flex;
        justify-content: space-around;
        gap: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
        z-index: 100;
        animation: mobilePickerSlideUp 0.15s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
    }

    &__emoji-btn {
        background: transparent;
        border: none;
        font-size: 1.25rem;
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
}

@keyframes mobilePickerSlideUp {
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
</style>