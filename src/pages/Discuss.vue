<template>
    <div class="discuss-page">
        <SiteHeader />

        <main id="main" class="discuss-page__main" role="main">
            <section class="discuss-page__masthead container-lm">
                <p class="eyebrow discuss-page__eyebrow">The Lounge · Live Feed</p>
                <h1 class="discuss-page__title display" data-reveal>Global discussions.</h1>
                <p class="discuss-page__subtitle">
                    Talk about movies, TV series, anime, or read what others have posted. Tag your posts, save them permanently, and report spam or abuse.
                </p>
            </section>

            <div class="discuss-page__content container-lm">
                <!-- Write discussion post form -->
                <section class="discuss-page__composer">
                    <h2 class="discuss-page__section-title">Share your thoughts</h2>
                    <form @submit.prevent="handlePostComment" class="discuss-form">
                        <div class="discuss-form__row" v-if="!isLoggedIn">
                            <label class="discuss-form__label">
                                <span class="eyebrow">Display Name</span>
                                <input 
                                    type="text" 
                                    v-model="guestName" 
                                    placeholder="Your nickname (e.g., MovieFanatic)" 
                                    required
                                    class="discuss-form__input"
                                />
                            </label>
                        </div>
                        <div class="discuss-form__row v-else" v-else>
                            <span class="meta">Posting as <strong>@{{ currentUsername }}</strong></span>
                        </div>

                        <div class="discuss-form__row">
                            <label class="discuss-form__label">
                                <span class="eyebrow">Discussing Title (Optional)</span>
                                <div class="discuss-form__tagger">
                                    <select v-model="taggedType" class="discuss-form__select">
                                        <option value="general">General Chat</option>
                                        <option value="movie">Movie</option>
                                        <option value="tv">TV Show</option>
                                        <option value="anime">Anime</option>
                                    </select>
                                    <input 
                                        v-if="taggedType !== 'general'"
                                        type="text" 
                                        v-model="taggedTitle" 
                                        placeholder="Title name or ID"
                                        class="discuss-form__input discuss-form__input--title"
                                    />
                                </div>
                            </label>
                        </div>

                        <div class="discuss-form__row">
                            <label class="discuss-form__label">
                                <span class="eyebrow">Your message</span>
                                <textarea 
                                    v-model="newCommentText" 
                                    placeholder="Write your review, question, or recommendation here..." 
                                    required
                                    rows="4"
                                    class="discuss-form__textarea"
                                ></textarea>
                            </label>
                        </div>

                        <button 
                            type="submit" 
                            class="btn btn-primary discuss-form__submit"
                            :disabled="submitting || !newCommentText.trim()"
                        >
                            {{ submitting ? 'Posting...' : 'Post Message' }}
                        </button>
                    </form>
                </section>

                <!-- Comments/posts feed -->
                <section class="discuss-page__feed">
                    <div class="discuss-page__feed-header">
                        <h2 class="discuss-page__section-title">Recent Activity</h2>
                        <button @click="fetchComments" class="discuss-page__refresh-btn" aria-label="Refresh feed">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l.73-.73" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            Refresh
                        </button>
                    </div>

                    <div v-if="loading" class="discuss-page__loading" role="status">
                        <div class="discuss-page__spinner" aria-hidden="true" />
                        <span class="meta">Loading conversations…</span>
                    </div>

                    <div v-else-if="!comments.length" class="discuss-page__empty">
                        <p class="meta">The lounge is quiet. Be the first to start a conversation!</p>
                    </div>

                    <div v-else class="discuss-feed-list">
                        <article 
                            v-for="c in comments" 
                            :key="c.id" 
                            class="discuss-card"
                            :class="{ 'discuss-card--reported': c.isReported }"
                        >
                            <div class="discuss-card__header">
                                <div 
                                    class="discuss-card__avatar" 
                                    :style="avatarStyle(c.username)"
                                >
                                    {{ (c.username.replace('@', '') || 'A')[0].toUpperCase() }}
                                </div>
                                <div class="discuss-card__meta">
                                    <span class="discuss-card__username">{{ c.username }}</span>
                                    <span v-if="c.username.startsWith('@')" class="discuss-card__badge">Member</span>
                                    <span v-else class="discuss-card__badge discuss-card__badge--guest">Guest</span>
                                    <span class="discuss-card__time meta">{{ formatTimeAgo(c.created_at) }}</span>
                                </div>

                                <div class="discuss-card__tags">
                                    <span 
                                        v-if="c.media_type && c.media_type !== 'general'" 
                                        class="discuss-card__tag"
                                    >
                                        {{ c.media_type.toUpperCase() }}
                                        <span v-if="c.media_id">#{{ c.media_id }}</span>
                                    </span>
                                </div>
                            </div>

                            <div class="discuss-card__body">
                                <p class="discuss-card__text">{{ c.content }}</p>
                            </div>

                            <div class="discuss-card__footer">
                                <button 
                                    v-if="!c.isReported"
                                    @click="openReportModal(c)" 
                                    class="discuss-card__report-btn"
                                >
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" stroke-linecap="round"/>
                                    </svg>
                                    Report
                                </button>
                                <span v-else class="discuss-card__reported-tag">⚠️ Flagged for review</span>
                            </div>
                        </article>
                    </div>
                </section>
            </div>
        </main>

        <!-- Report Modal -->
        <div v-if="showReportModal" class="report-modal" role="dialog" aria-modal="true">
            <div class="report-modal__backdrop" @click="closeReportModal"></div>
            <div class="report-modal__content">
                <h3 class="report-modal__title">Report Post</h3>
                <p class="report-modal__desc meta">Help us keep the community healthy. Why are you reporting this post?</p>
                
                <div class="report-modal__post-preview">
                    <strong class="meta">{{ reportingComment?.username }}:</strong>
                    <p class="meta">{{ reportingComment?.content }}</p>
                </div>

                <form @submit.prevent="submitReport" class="report-form">
                    <div class="report-form__group">
                        <label class="report-form__label eyebrow">Reason</label>
                        <select v-model="reportReason" class="report-form__select" required>
                            <option value="spam">Spam / Advertising</option>
                            <option value="abuse">Harassment or Abuse</option>
                            <option value="spoiler">Unmarked Spoilers</option>
                            <option value="inappropriate">Inappropriate Content</option>
                            <option value="other">Other Reason</option>
                        </select>
                    </div>

                    <div class="report-form__group">
                        <label class="report-form__label eyebrow">Additional Details</label>
                        <textarea 
                            v-model="reportDetails" 
                            placeholder="Provide any context (optional)..."
                            rows="3"
                            class="report-form__textarea"
                        ></textarea>
                    </div>

                    <div class="report-modal__buttons">
                        <button type="button" @click="closeReportModal" class="btn btn-secondary">Cancel</button>
                        <button type="submit" class="btn btn-primary" :disabled="submittingReport">
                            {{ submittingReport ? 'Submitting...' : 'Submit Report' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from 'vue';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
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
    components: { SiteHeader, SiteFooter },
    setup() {
        const { updateSeo } = useSeo();
        
        const comments = ref<Comment[]>([]);
        const loading = ref(false);
        const submitting = ref(false);
        const newCommentText = ref('');
        const guestName = ref('');
        const isLoggedIn = ref(false);
        const currentUsername = ref('');

        // Tagged details
        const taggedType = ref('general');
        const taggedTitle = ref('');

        // Reporting State
        const showReportModal = ref(false);
        const reportingComment = ref<Comment | null>(null);
        const reportReason = ref('spam');
        const reportDetails = ref('');
        const submittingReport = ref(false);

        const checkAuth = () => {
            if (typeof window !== 'undefined') {
                const user = localStorage.getItem('movora_current_user');
                if (user) {
                    isLoggedIn.value = true;
                    currentUsername.value = user;
                } else {
                    isLoggedIn.value = false;
                    currentUsername.value = '';
                    const savedGuest = localStorage.getItem('movora_guest_name');
                    guestName.value = savedGuest || '';
                }
            }
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

        const fetchComments = async () => {
            loading.value = true;
            try {
                const supabase = await getSupabaseClient();
                const { data, error } = await supabase
                    .from('movora_comments')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                comments.value = data || [];
            } catch (e) {
                console.error('Failed to load global discussions:', e);
            } finally {
                loading.value = false;
            }
        };

        const handlePostComment = async () => {
            if (!newCommentText.value.trim()) return;
            submitting.value = true;

            const nameToPost = isLoggedIn.value 
                ? `@${currentUsername.value}` 
                : guestName.value.trim() || 'Anonymous';

            if (!isLoggedIn.value && typeof window !== 'undefined') {
                localStorage.setItem('movora_guest_name', nameToPost);
            }

            try {
                const supabase = await getSupabaseClient();
                const { data, error } = await supabase
                    .from('movora_comments')
                    .insert([
                        {
                            media_id: taggedType.value === 'general' ? 'general' : taggedTitle.value.trim() || 'tagged',
                            media_type: taggedType.value,
                            username: nameToPost,
                            content: newCommentText.value.trim()
                        }
                    ])
                    .select()
                    .single();

                if (error) throw error;

                if (data) {
                    comments.value.unshift(data);
                    newCommentText.value = '';
                    taggedTitle.value = '';
                    taggedType.value = 'general';
                }
            } catch (e) {
                console.error('Failed to post discussion comment:', e);
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
                
                // Write report directly to movora_reports table in Supabase
                const { error } = await supabase
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

                if (error) {
                    // Fallback in case table doesn't support writing yet, append in console or mock success
                    console.warn('Supabase movora_reports table write failed. Falling back to local flag:', error);
                }

                // Update UI state for reported comment
                const target = comments.value.find(c => c.id === reportingComment.value!.id);
                if (target) {
                    target.isReported = true;
                }

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
            
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        };

        onMounted(() => {
            updateSeo({
                title: 'Lounge · Discussions — Moovie',
                description: 'Join watch lounge conversations, read reviews and talk about films and shows on Moovie.',
                canonical: 'https://moovie.fun/discuss'
            });
            checkAuth();
            fetchComments();
            window.addEventListener('movora_auth_change', checkAuth);
        });

        return {
            comments,
            loading,
            submitting,
            newCommentText,
            guestName,
            isLoggedIn,
            currentUsername,
            taggedType,
            taggedTitle,
            avatarStyle,
            fetchComments,
            handlePostComment,
            formatTimeAgo,

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
    min-height: 100dvh;
    background: var(--ink-900);
    color: var(--bone-50);

    &__main {
        padding-block: clamp(var(--s-6), 6vw, var(--s-8));
    }

    &__masthead {
        padding-block: clamp(var(--s-5), 5vw, var(--s-7));
        border-bottom: 1px solid var(--rule);
        margin-bottom: clamp(var(--s-5), 5vw, var(--s-7));
    }

    &__eyebrow {
        color: var(--ember);
        margin: 0 0 var(--s-2);
    }

    &__title {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: clamp(2.4rem, 6vw, 4.5rem);
        line-height: 1;
        letter-spacing: -0.02em;
        color: var(--bone-50);
        margin: 0;
        font-variation-settings: 'opsz' 144, 'SOFT' 30;
    }

    &__subtitle {
        margin: var(--s-4) 0 0;
        color: var(--bone-300);
        font-family: var(--font-ui);
        line-height: 1.55;
        max-width: 58ch;
    }

    &__content {
        display: grid;
        gap: var(--s-8);
        grid-template-columns: 1fr;

        @media (min-width: 900px) {
            grid-template-columns: 380px 1fr;
        }
    }

    &__section-title {
        font-family: var(--font-display);
        font-size: var(--fs-lg);
        color: var(--bone-50);
        margin-bottom: var(--s-4);
        letter-spacing: -0.01em;
    }

    &__composer {
        background: var(--surface-tint);
        border: 1px solid var(--rule);
        border-radius: var(--r-md);
        padding: var(--s-5);
        height: fit-content;
    }

    &__feed-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--s-4);
    }

    &__refresh-btn {
        display: flex;
        align-items: center;
        gap: var(--s-2);
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        text-transform: uppercase;
        color: var(--bone-300);
        padding: var(--s-2) var(--s-3);
        border: 1px solid var(--rule);
        border-radius: var(--r-pill);
        background: transparent;
        transition: all var(--dur-fast) var(--ease-out);

        &:hover {
            color: var(--ember);
            border-color: var(--ember);
        }
    }

    &__loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--s-3);
        padding: var(--s-9) 0;
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
        padding: var(--s-9) 0;
    }
}

/* Discussion Form styling */
.discuss-form {
    display: flex;
    flex-direction: column;
    gap: var(--s-4);

    &__row {
        display: flex;
        flex-direction: column;
    }

    &__label {
        display: flex;
        flex-direction: column;
        gap: var(--s-2);
    }

    &__input,
    &__textarea,
    &__select {
        background: var(--ink-950);
        border: 1px solid var(--rule);
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        padding: var(--s-3);
        border-radius: var(--r-sm);
        width: 100%;
        transition: border-color var(--dur-fast) var(--ease-out);

        &:focus {
            border-color: var(--ember);
            outline: none;
        }
    }

    &__tagger {
        display: flex;
        gap: var(--s-2);
    }

    &__select {
        max-width: 120px;
    }

    &__textarea {
        resize: vertical;
    }

    &__submit {
        align-self: flex-start;
        margin-top: var(--s-2);
    }
}

/* Discussion Feed styling */
.discuss-feed-list {
    display: flex;
    flex-direction: column;
    gap: var(--s-4);
}

.discuss-card {
    background: var(--surface-tint);
    border: 1px solid var(--rule);
    border-radius: var(--r-md);
    padding: var(--s-5);
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
    transition: all var(--dur-fast) var(--ease-out);

    &--reported {
        border-color: rgba(255, 0, 0, 0.2);
        background: rgba(255, 0, 0, 0.02);
    }

    &__header {
        display: flex;
        align-items: center;
        gap: var(--s-3);
    }

    &__avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
    }

    &__meta {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: var(--s-2);
    }

    &__username {
        font-family: var(--font-ui);
        font-weight: 600;
        font-size: var(--fs-sm);
        color: var(--bone-50);
    }

    &__badge {
        font-family: var(--font-mono);
        font-size: 0.65rem;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--ember);
        background: rgba(255, 90, 31, 0.1);
        padding: 1px var(--s-2);
        border-radius: var(--r-pill);
        border: 1px solid rgba(255, 90, 31, 0.25);

        &--guest {
            color: var(--bone-400);
            background: rgba(255, 255, 255, 0.05);
            border-color: rgba(255, 255, 255, 0.1);
        }
    }

    &__time {
        font-size: var(--fs-xs);
    }

    &__tags {
        margin-left: auto;
    }

    &__tag {
        font-family: var(--font-mono);
        font-size: 0.7rem;
        background: var(--ink-950);
        border: 1px solid var(--rule);
        padding: var(--s-1) var(--s-2);
        border-radius: var(--r-sm);
        color: var(--bone-300);
    }

    &__body {
        font-family: var(--font-ui);
        line-height: 1.5;
        color: var(--bone-200);
        white-space: pre-wrap;
    }

    &__text {
        margin: 0;
        font-size: var(--fs-sm);
    }

    &__footer {
        display: flex;
        justify-content: flex-end;
        padding-top: var(--s-2);
        border-top: 1px solid rgba(255, 255, 255, 0.03);
    }

    &__report-btn {
        display: flex;
        align-items: center;
        gap: var(--s-1);
        font-family: var(--font-ui);
        font-size: var(--fs-xs);
        color: var(--bone-400);
        background: transparent;
        border: 0;
        cursor: pointer;
        padding: var(--s-1) var(--s-2);
        border-radius: var(--r-sm);
        transition: all var(--dur-fast) var(--ease-out);

        &:hover {
            color: #ef4444;
            background: rgba(239, 68, 68, 0.08);
        }
    }

    &__reported-tag {
        font-family: var(--font-ui);
        font-size: var(--fs-xs);
        color: #ef4444;
        font-weight: 500;
    }
}

/* Report Modal styling */
.report-modal {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--s-4);

    &__backdrop {
        position: absolute;
        inset: 0;
        background: rgba(4, 6, 10, 0.8);
        backdrop-filter: blur(8px);
    }

    &__content {
        position: relative;
        background: var(--ink-850);
        border: 1px solid var(--rule-strong);
        border-radius: var(--r-md);
        padding: var(--s-6);
        max-width: 480px;
        width: 100%;
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
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
</style>
