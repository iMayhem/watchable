<template>
    <div class="discuss">
        <SiteHeader />

        <main id="main" class="discuss__main" role="main">
            <div class="discuss__wrap container-lm">
                <div v-if="selectedMovieId === null" class="discuss__tabs" role="tablist" aria-label="Discuss sections">
                    <button
                        type="button"
                        class="discuss__tab"
                        :class="{ 'is-active': activeTab === 'lounge' }"
                        role="tab"
                        :aria-selected="activeTab === 'lounge'"
                        @click="activeTab = 'lounge'"
                    >
                        <span class="discuss__tab-label">Open Chat</span>
                        <span class="discuss__tab-badge">💬</span>
                    </button>
                    <button
                        type="button"
                        class="discuss__tab"
                        :class="{ 'is-active': activeTab === 'reviews' }"
                        role="tab"
                        :aria-selected="activeTab === 'reviews'"
                        @click="activeTab = 'reviews'"
                    >
                        <span class="discuss__tab-label">Title Reviews</span>
                        <span class="discuss__tab-badge">🎬</span>
                    </button>
                </div>

                <div v-else class="discuss__thread-head">
                    <button type="button" class="discuss__back" @click="closeMovieDiscussion">← Back to reviews</button>
                    <p class="eyebrow">Title thread</p>
                    <h1 class="discuss__thread-title">
                        <router-link :to="getMovieLink(selectedMovieType, selectedMovieId)">
                            {{ getMediaName(selectedMovieType, selectedMovieId) }}
                        </router-link>
                    </h1>
                </div>

                <!-- Lounge -->
                <section v-if="activeTab === 'lounge' && selectedMovieId === null" class="discuss__panel" aria-label="Open chat">
                    <header class="discuss__panel-head">
                        <div>
                            <p class="eyebrow">Live now</p>
                            <h2 class="discuss__title">Open chat</h2>
                        </div>
                        <span class="discuss__who">
                            <template v-if="isLoggedIn">@{{ currentUsername }}</template>
                            <template v-else>Guest</template>
                        </span>
                    </header>

                    <div ref="chatBox" class="discuss__feed" @scroll="handleScroll">
                        <div v-if="loading" class="discuss__status meta">Loading chat…</div>
                        <div v-else-if="!comments.length" class="discuss__status meta">No messages yet. Be the first to say hi!</div>
                        <article
                            v-for="c in comments"
                            :key="c.id"
                            class="discuss__msg"
                            :class="{ 'is-self': isSelf(c.username) }"
                        >
                            <img v-if="!isSelf(c.username)" :src="getAvatarUrl(c.username)" :alt="c.username" class="discuss__avatar" />
                            <div class="discuss__bubble">
                                <div v-if="!isSelf(c.username)" class="discuss__bubble-header">
                                    <span class="discuss__user" :style="{ color: getUsernameColor(c.username) }">{{ c.username }}</span>
                                </div>
                                <p class="discuss__text">{{ c.content }}</p>
                                <div class="discuss__bubble-footer">
                                    <span class="discuss__time">{{ formatTimeAgo(c.created_at) }}</span>
                                    <span v-if="isSelf(c.username)" class="discuss__status-ticks">✓✓</span>
                                </div>
                            </div>
                        </article>
                    </div>

                    <footer class="discuss__composer">
                        <div v-if="showLoungeEmojiPicker" class="discuss__emoji-picker">
                            <button v-for="emoji in popularEmojis" :key="emoji" type="button" class="discuss__emoji-btn" @click="insertEmoji(emoji, 'lounge')">
                                {{ emoji }}
                            </button>
                        </div>
                        <form class="discuss__form" @submit.prevent="handlePostComment">
                            <div class="discuss__input-wrapper">
                                <button type="button" class="discuss__composer-btn" aria-label="Emojis" @click.stop="toggleEmojiPicker('lounge')">
                                    😊
                                </button>
                                <input
                                    v-model="newCommentText"
                                    class="discuss__input"
                                    type="text"
                                    maxlength="500"
                                    placeholder="Say something…"
                                    :disabled="submitting"
                                />
                            </div>
                            <button type="submit" class="discuss__send" :disabled="submitting || !newCommentText.trim()">
                                {{ submitting ? 'Sending…' : 'Send' }}
                            </button>
                        </form>
                    </footer>
                </section>

                <!-- Reviews -->
                <section v-else-if="activeTab === 'reviews' && selectedMovieId === null" class="discuss__panel" aria-label="Title reviews">
                    <header class="discuss__panel-head">
                        <div>
                            <p class="eyebrow">From the catalogue</p>
                            <h2 class="discuss__title">Title reviews</h2>
                        </div>
                    </header>

                    <div class="discuss__reviews">
                        <div v-if="loadingMovie" class="discuss__status meta">Loading reviews…</div>
                        <div v-else-if="!movieComments.length" class="discuss__status meta">No reviews yet. Start writing on film pages.</div>
                        <article v-for="c in movieComments" :key="c.id" class="discuss__review">
                            <header class="discuss__review-head">
                                <span class="discuss__review-user" :style="{ color: getUsernameColor(c.username) }">
                                    {{ c.username }}
                                </span>
                                <span class="meta">{{ formatTimeAgo(c.created_at) }}</span>
                            </header>
                            <router-link :to="getMovieLink(c.media_type || 'movie', c.media_id || '')" class="discuss__review-topic">
                                {{ getCategoryIcon(c.media_type || 'movie') }}
                                {{ getMediaName(c.media_type || 'movie', c.media_id || '') }}
                            </router-link>
                            <p class="discuss__review-text">{{ c.content }}</p>
                            <button type="button" class="discuss__review-thread" @click="viewMovieDiscussion(c.media_type || 'movie', c.media_id || '')">
                                Open thread
                            </button>
                        </article>
                    </div>
                </section>

                <!-- Movie thread -->
                <section v-else class="discuss__panel" aria-label="Title thread">
                    <div ref="movieChatBox" class="discuss__feed" @scroll="handleMovieChatScroll">
                        <div v-if="loadingSelectedMovie" class="discuss__status meta">Loading thread…</div>
                        <div v-else-if="!selectedMovieComments.length" class="discuss__status meta">No comments on this title yet. Start the thread!</div>
                        <article
                            v-for="c in selectedMovieComments"
                            :key="c.id"
                            class="discuss__msg"
                            :class="{ 'is-self': isSelf(c.username) }"
                        >
                            <img v-if="!isSelf(c.username)" :src="getAvatarUrl(c.username)" :alt="c.username" class="discuss__avatar" />
                            <div class="discuss__bubble">
                                <div v-if="!isSelf(c.username)" class="discuss__bubble-header">
                                    <span class="discuss__user" :style="{ color: getUsernameColor(c.username) }">{{ c.username }}</span>
                                </div>
                                <p class="discuss__text">{{ c.content }}</p>
                                <div class="discuss__bubble-footer">
                                    <span class="discuss__time">{{ formatTimeAgo(c.created_at) }}</span>
                                    <span v-if="isSelf(c.username)" class="discuss__status-ticks">✓✓</span>
                                </div>
                            </div>
                        </article>
                    </div>

                    <footer class="discuss__composer">
                        <div v-if="showThreadEmojiPicker" class="discuss__emoji-picker">
                            <button v-for="emoji in popularEmojis" :key="emoji" type="button" class="discuss__emoji-btn" @click="insertEmoji(emoji, 'thread')">
                                {{ emoji }}
                            </button>
                        </div>
                        <form class="discuss__form" @submit.prevent="postSelectedMovieComment">
                            <div class="discuss__input-wrapper">
                                <button type="button" class="discuss__composer-btn" aria-label="Emojis" @click.stop="toggleEmojiPicker('thread')">
                                    😊
                                </button>
                                <input
                                    v-model="newSelectedCommentText"
                                    class="discuss__input"
                                    type="text"
                                    maxlength="500"
                                    placeholder="Comment on this title…"
                                    :disabled="submittingSelected"
                                />
                            </div>
                            <button type="submit" class="discuss__send" :disabled="submittingSelected || !newSelectedCommentText.trim()">
                                {{ submittingSelected ? 'Sending…' : 'Send' }}
                            </button>
                        </form>
                    </footer>
                </section>
            </div>
        </main>

        <AuthModal :is-open="showAuthModal" @close="showAuthModal = false; checkAuth()" />
    </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import AuthModal from '../components/navigation/AuthModal.vue';
import { useDiscussPage } from '../composables/useDiscussPage';
import { useSeo } from '../composables/useSeo';

const activeTab = ref<'lounge' | 'reviews'>('lounge');

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
} = useDiscussPage();

const { updateSeo } = useSeo();

updateSeo({
    title: 'Discuss — Moovie',
    description: 'Chat with the Moovie community and review movies, TV shows and anime.',
    canonical: 'https://moovie.fun/discuss',
});
</script>

<style lang="scss" scoped>
.discuss {
    min-height: 100vh;
    background: var(--bg, #0b0a08);
}

.discuss__main {
    padding: 2rem 0 4rem;
}

.discuss__wrap {
    max-width: 860px;
    margin: 0 auto;
}

.discuss__tabs {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
}

.discuss__tab {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1.1rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: var(--text, #f5efe4);
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.2s, border-color 0.2s;

    &.is-active {
        background: var(--accent, #c9a227);
        border-color: transparent;
        color: #0b0a08;
        font-weight: 600;
    }
}

.discuss__thread-head {
    margin-bottom: 1.25rem;
}

.discuss__back {
    background: none;
    border: none;
    color: var(--accent, #c9a227);
    cursor: pointer;
    font-size: 0.9rem;
    padding: 0 0 0.75rem;
}

.discuss__thread-title {
    margin: 0.25rem 0 0;
    font-size: 1.5rem;
}

.discuss__thread-title a {
    color: inherit;
    text-decoration: none;
}

.discuss__panel {
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.03);
    overflow: hidden;
}

.discuss__panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.1rem 1.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.discuss__title {
    margin: 0;
    font-size: 1.2rem;
}

.discuss__who {
    font-size: 0.85rem;
    opacity: 0.7;
}

.discuss__feed {
    height: 420px;
    overflow-y: auto;
    padding: 1.1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
}

.discuss__status {
    text-align: center;
    padding: 2rem 0;
    opacity: 0.6;
}

.discuss__msg {
    display: flex;
    gap: 0.6rem;

    &.is-self {
        justify-content: flex-end;

        .discuss__bubble {
            background: rgba(201, 162, 39, 0.14);
            border-color: rgba(201, 162, 39, 0.3);
        }
    }
}

.discuss__avatar {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: #333;
    flex-shrink: 0;
}

.discuss__bubble {
    max-width: 72%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 0.6rem 0.8rem;
}

.discuss__bubble-header {
    margin-bottom: 0.25rem;
}

.discuss__user {
    font-size: 0.8rem;
    font-weight: 600;
}

.discuss__text {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.45;
    word-break: break-word;
    white-space: pre-wrap;
}

.discuss__bubble-footer {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.3rem;
}

.discuss__time {
    font-size: 0.72rem;
    opacity: 0.55;
}

.discuss__status-ticks {
    font-size: 0.72rem;
    color: #4cc38a;
}

.discuss__composer {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.85rem 1.25rem;
    position: relative;
}

.discuss__emoji-picker {
    position: absolute;
    bottom: 100%;
    left: 1.25rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    max-width: 320px;
    background: #161412;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    padding: 0.5rem;
    z-index: 5;
}

.discuss__emoji-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.2rem;
    border-radius: 6px;

    &:hover {
        background: rgba(255, 255, 255, 0.1);
    }
}

.discuss__form {
    display: flex;
    gap: 0.6rem;
}

.discuss__input-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    padding: 0 0.85rem;
}

.discuss__composer-btn {
    background: none;
    border: none;
    font-size: 1.1rem;
    cursor: pointer;
    padding: 0.35rem 0;
}

.discuss__input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: var(--text, #f5efe4);
    font-size: 0.92rem;
    padding: 0.6rem 0;
}

.discuss__send {
    padding: 0.6rem 1.2rem;
    border-radius: 999px;
    border: none;
    background: var(--accent, #c9a227);
    color: #0b0a08;
    font-weight: 600;
    cursor: pointer;

    &:disabled {
        opacity: 0.45;
        cursor: not-allowed;
    }
}

.discuss__reviews {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 1.1rem 1.25rem;
    max-height: 480px;
    overflow-y: auto;
}

.discuss__review {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 0.9rem 1rem;
    background: rgba(255, 255, 255, 0.03);
}

.discuss__review-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.35rem;
}

.discuss__review-user {
    font-size: 0.85rem;
    font-weight: 600;
}

.discuss__review-topic {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.85rem;
    color: var(--accent, #c9a227);
    text-decoration: none;
    margin-bottom: 0.45rem;
}

.discuss__review-text {
    margin: 0 0 0.6rem;
    font-size: 0.95rem;
    line-height: 1.5;
}

.discuss__review-thread {
    background: none;
    border: 1px solid rgba(201, 162, 39, 0.4);
    color: var(--accent, #c9a227);
    border-radius: 999px;
    padding: 0.35rem 0.9rem;
    font-size: 0.8rem;
    cursor: pointer;

    &:hover {
        background: rgba(201, 162, 39, 0.12);
    }
}
</style>
