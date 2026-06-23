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
                aria-label="General lounge"
            >
                <div class="m-discuss__panel-head">
                    <div>
                        <p class="eyebrow">Live now</p>
                        <h1 class="m-discuss__title">General lounge</h1>
                    </div>
                    <span v-if="isLoggedIn" class="meta m-discuss__badge">@{{ currentUsername }}</span>
                    <span v-else class="meta">Guest</span>
                </div>

                <div ref="chatBox" class="m-discuss__feed" @scroll="handleScroll">
                    <div v-if="loading" class="m-discuss__loading meta">Loading lounge…</div>
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
                            <img :src="getAvatarUrl(c.username)" :alt="c.username" class="m-discuss__avatar" />
                            <div class="m-discuss__bubble-wrap">
                                <div class="m-discuss__meta">
                                    <span class="m-discuss__user">{{ c.username }}</span>
                                    <span class="meta">{{ formatTimeAgo(c.created_at) }}</span>
                                </div>
                                <p class="m-discuss__text">{{ c.content }}</p>
                                <button
                                    v-if="!c.isReported"
                                    type="button"
                                    class="m-discuss__report"
                                    @click="openReportModal(c)"
                                >
                                    Report
                                </button>
                            </div>
                        </article>
                    </div>
                </div>

                <footer class="m-discuss__composer">
                    <div v-if="!isLoggedIn" class="m-discuss__login-prompt">
                        <p class="meta">Sign in to post in the lounge.</p>
                        <button type="button" class="m-discuss__signin" @click="showAuthModal = true">Sign In</button>
                    </div>
                    <form v-else class="m-discuss__form" @submit.prevent="handlePostComment">
                        <input
                            v-model="newCommentText"
                            type="text"
                            class="m-discuss__input"
                            placeholder="Share something with the lounge…"
                            :disabled="submitting"
                            required
                        />
                        <button type="submit" class="m-discuss__send" :disabled="submitting || !newCommentText.trim()">
                            Send
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
                                <span class="m-discuss__topic">
                                    {{ getCategoryIcon(c.media_type || 'movie') }}
                                    {{ getMediaName(c.media_type || 'movie', c.media_id || '') }}
                                </span>
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
                            {{ getMediaName(selectedMovieType, selectedMovieId) }}
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
                            <img :src="getAvatarUrl(c.username)" :alt="c.username" class="m-discuss__avatar" />
                            <div class="m-discuss__bubble-wrap">
                                <div class="m-discuss__meta">
                                    <span class="m-discuss__user">{{ c.username }}</span>
                                    <span class="meta">{{ formatTimeAgo(c.created_at) }}</span>
                                </div>
                                <p class="m-discuss__text">{{ c.content }}</p>
                            </div>
                        </article>
                    </div>
                </div>

                <footer class="m-discuss__composer">
                    <form class="m-discuss__form" @submit.prevent="postSelectedMovieComment">
                        <input
                            v-model="newSelectedCommentText"
                            type="text"
                            class="m-discuss__input"
                            placeholder="Reply to discussion…"
                            :disabled="submittingSelected"
                            required
                        />
                        <button
                            type="submit"
                            class="m-discuss__send"
                            :disabled="submittingSelected || !newSelectedCommentText.trim()"
                        >
                            Send
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
    { label: 'Lounge', value: 'lounge' },
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
    postSelectedMovieComment
} = useDiscussPage();

const { updateSeo } = useSeo();

onMounted(() => {
    updateSeo({
        title: 'Discuss — Moovie',
        description: 'Community lounge and title reviews on Moovie.',
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
        background: var(--ink-850);
        padding: var(--s-3);

        &--reviews {
            margin-bottom: 0;
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
        display: grid;
        gap: var(--s-3);
    }

    &__msg {
        display: grid;
        grid-template-columns: 2.25rem 1fr;
        gap: var(--s-2);

        &.is-self .m-discuss__text {
            background: rgba(232, 122, 58, 0.15);
            border-color: rgba(232, 122, 58, 0.35);
        }
    }

    &__avatar {
        width: 2.25rem;
        height: 2.25rem;
        border-radius: var(--r-pill);
        background: var(--ink-800);
    }

    &__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem 0.6rem;
        align-items: baseline;
        margin-bottom: 0.25rem;
    }

    &__user {
        font-family: var(--font-ui);
        font-size: 0.82rem;
        font-weight: 600;
    }

    &__topic {
        display: inline-block;
        margin-bottom: 0.35rem;
        padding: 0.15rem 0.5rem;
        border-radius: var(--r-pill);
        background: var(--ink-800);
        font-size: 0.72rem;
    }

    &__text {
        margin: 0;
        padding: var(--s-2) var(--s-3);
        border-radius: var(--r-md);
        border: 1px solid var(--rule);
        background: var(--ink-800);
        font-size: 0.9rem;
        line-height: 1.45;
        word-break: break-word;
    }

    &__report,
    &__thread-btn {
        margin-top: 0.35rem;
        padding: 0;
        border: 0;
        background: none;
        color: var(--bone-400);
        font-size: 0.72rem;
        text-decoration: underline;
    }

    &__review-actions {
        display: flex;
        gap: var(--s-3);
        align-items: center;
    }

    &__composer {
        flex-shrink: 0;
        display: grid;
        gap: var(--s-2);
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

    &__signin,
    &__send {
        min-height: 2.75rem;
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

    &__form {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: var(--s-2);
    }

    &__input {
        min-height: 2.75rem;
        padding: 0 var(--s-3);
        border-radius: var(--r-pill);
        border: 1px solid var(--rule-strong);
        background: var(--ink-800);
        color: var(--bone-50);
        font-size: 16px;
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
}
</style>