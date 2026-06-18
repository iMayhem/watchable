<template>
    <section class="comments-panel">
        <header class="comments-panel__header">
            <h3 class="comments-panel__title">
                Discussion
                <span class="comments-panel__count" v-if="comments.length">· {{ comments.length }} comments</span>
            </h3>
        </header>

        <!-- Write comment form -->
        <form @submit.prevent="submitComment" class="comment-form">
            <div class="comment-form__meta-row">
                <div v-if="!isLoggedIn" class="guest-identity">
                    <label for="guest-name" class="eyebrow guest-identity__label">Comment as Guest</label>
                    <input
                        id="guest-name"
                        type="text"
                        v-model="guestName"
                        placeholder="Your display name..."
                        class="guest-identity__input"
                        maxlength="25"
                        required
                    />
                </div>
                <div v-else class="user-identity">
                    <div class="user-identity__avatar" :style="avatarStyle(currentUsername)">
                        {{ currentUsername[0]?.toUpperCase() }}
                    </div>
                    <span class="user-identity__name">@{{ currentUsername }}</span>
                </div>
            </div>

            <div class="comment-form__textarea-container">
                <textarea
                    v-model="newCommentText"
                    placeholder="Type your comment... Join the discussion!"
                    class="comment-form__textarea"
                    rows="3"
                    maxlength="500"
                    required
                ></textarea>
                
                <div class="comment-form__actions">
                    <span class="comment-form__char-count">{{ newCommentText.length }}/500</span>
                    <button
                        type="submit"
                        class="comment-form__submit-btn"
                        :disabled="submitting || !newCommentText.trim()"
                    >
                        <svg v-if="!submitting" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="btn-icon">
                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span class="spinner" v-else />
                        {{ submitting ? 'Posting...' : 'Post' }}
                    </button>
                </div>
            </div>
        </form>

        <!-- Comments List -->
        <div v-if="loading" class="comments-panel__loading">
            <div class="spinner" />
            <span class="meta">Retrieving comments...</span>
        </div>
        <div v-else-if="comments.length > 0" class="comments-list">
            <transition-group name="comment-fade">
                <article v-for="c in comments" :key="c.id" class="comment-card">
                    <div class="comment-card__header">
                        <div class="comment-card__author">
                            <div class="comment-card__avatar" :style="avatarStyle(c.username)">
                                {{ c.username[0]?.toUpperCase() }}
                            </div>
                            <span class="comment-card__username">{{ c.username }}</span>
                            <span v-if="c.isGuest" class="guest-badge meta">Guest</span>
                        </div>
                        <span class="comment-card__time">{{ formatTimeAgo(c.created_at) }}</span>
                    </div>
                    <p class="comment-card__body">{{ c.content }}</p>
                </article>
            </transition-group>
        </div>
    </section>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, watch } from 'vue';
import { getSupabaseClient } from '../../lib/supabase';

interface Comment {
    id: number;
    media_id: string;
    media_type: string;
    username: string;
    content: string;
    created_at: string;
    isGuest?: boolean;
}

export default defineComponent({
    name: 'CommentsSection',
    props: {
        mediaId: { type: [Number, String], required: true },
        mediaType: { type: String, required: true } // 'movie', 'tv', 'anime'
    },
    setup(props) {
        const comments = ref<Comment[]>([]);
        const loading = ref(false);
        const submitting = ref(false);
        const newCommentText = ref('');
        const guestName = ref('');
        const isLoggedIn = ref(false);
        const currentUsername = ref('');

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
                    guestName.value = savedGuest || 'Anonymous';
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
                const mId = String(props.mediaId);
                const { data, error } = await supabase
                    .from('movora_comments')
                    .select('*')
                    .eq('media_id', mId)
                    .eq('media_type', props.mediaType)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                // Simple check: if a username doesn't exist in movora_users, flag it as guest
                // For performance, we can also store isGuest locally or assume it.
                // We'll tag it by local heuristic: usernames not matching current user
                // or if it matches the localStorage guestName pattern.
                // In actual deployment, we tag it dynamically:
                comments.value = (data || []).map((c: any) => {
                    const isKnownUser = c.username === currentUsername.value;
                    return {
                        ...c,
                        isGuest: !isKnownUser && !c.username.startsWith('@')
                    };
                });
            } catch (e) {
                console.error('Failed to load comments:', e);
            } finally {
                loading.value = false;
            }
        };

        const submitComment = async () => {
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
                            media_id: String(props.mediaId),
                            media_type: props.mediaType,
                            username: nameToPost,
                            content: newCommentText.value.trim()
                        }
                    ])
                    .select()
                    .single();

                if (error) throw error;

                if (data) {
                    comments.value.unshift({
                        ...data,
                        isGuest: !isLoggedIn.value
                    });
                    newCommentText.value = '';
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
            checkAuth();
            fetchComments();
            window.addEventListener('movora_auth_change', checkAuth);
        });

        watch(() => props.mediaId, () => {
            fetchComments();
        });

        return {
            comments,
            loading,
            submitting,
            newCommentText,
            guestName,
            isLoggedIn,
            currentUsername,
            avatarStyle,
            submitComment,
            formatTimeAgo
        };
    }
});
</script>

<style lang="scss" scoped>
.comments-panel {
    background: var(--ink-800);
    border-radius: var(--r-lg);
    box-shadow: inset 0 0 0 1px var(--rule);
    padding: var(--s-5);
    display: flex;
    flex-direction: column;
    gap: var(--s-5);
    margin-top: var(--s-6);
    width: 100%;

    &__header {
        border-bottom: 1px solid var(--rule);
        padding-bottom: var(--s-3);
    }

    &__title {
        margin: 0;
        font-family: var(--font-display);
        font-size: var(--fs-xl);
        font-weight: 500;
        color: var(--bone-50);
    }

    &__count {
        font-family: var(--font-mono);
        font-size: var(--fs-sm);
        color: var(--bone-400);
        margin-left: var(--s-2);
    }

    &__loading, &__empty {
        text-align: center;
        padding: var(--s-8) var(--s-4);
        color: var(--bone-400);
        font-family: var(--font-ui);
    }

    &__loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--s-3);

        .spinner {
            width: 24px;
            height: 24px;
            border: 2px solid var(--rule-strong);
            border-top-color: var(--ember);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
    }
}

// Form styling
.comment-form {
    display: flex;
    flex-direction: column;
    gap: var(--s-3);

    &__meta-row {
        display: flex;
        align-items: center;
    }

    .guest-identity {
        display: flex;
        flex-direction: column;
        gap: var(--s-1);
        width: 100%;
        max-width: 280px;

        &__label {
            color: var(--bone-400);
            font-size: var(--fs-xs);
        }

        &__input {
            background: var(--ink-700);
            border: 1px solid var(--rule-strong);
            border-radius: var(--r-md);
            padding: 0.5rem 0.75rem;
            color: var(--bone-50);
            font-family: var(--font-ui);
            font-size: var(--fs-sm);
            outline: none;
            transition: border-color var(--dur-fast), box-shadow var(--dur-fast);

            &:focus {
                border-color: var(--ember);
                box-shadow: 0 0 8px var(--ember-glow);
            }
        }
    }

    .user-identity {
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        background: var(--ink-700);
        padding: var(--s-2) var(--s-3);
        border-radius: var(--r-pill);
        border: 1px solid var(--rule);

        &__avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: var(--fs-xs);
        }

        &__name {
            font-family: var(--font-mono);
            font-size: var(--fs-xs);
            color: var(--bone-100);
        }
    }

    &__textarea-container {
        display: flex;
        flex-direction: column;
        background: var(--ink-700);
        border: 1px solid var(--rule-strong);
        border-radius: var(--r-lg);
        overflow: hidden;
        transition: border-color var(--dur-fast), box-shadow var(--dur-fast);

        &:focus-within {
            border-color: var(--ember);
            box-shadow: 0 0 8px var(--ember-glow);
        }
    }

    &__textarea {
        background: transparent;
        border: none;
        padding: var(--s-3) var(--s-4);
        color: var(--bone-50);
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        resize: none;
        outline: none;

        &::placeholder {
            color: var(--bone-500);
        }
    }

    &__actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 1rem;
        background: rgba(0, 0, 0, 0.15);
        border-top: 1px solid var(--rule);
    }

    &__char-count {
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        color: var(--bone-500);
    }

    &__submit-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        background: var(--ember);
        color: var(--ink-950);
        font-weight: 600;
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        padding: 0.45rem 1.15rem;
        border-radius: var(--r-pill);
        cursor: pointer;
        transition: background-color var(--dur-fast), transform var(--dur-fast);
        box-shadow: 0 4px 12px var(--ember-glow);

        &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            box-shadow: none;
        }

        &:not(:disabled):hover {
            background: var(--ember-600);
            transform: translateY(-1px);
        }

        .btn-icon {
            width: 14px;
            height: 14px;
        }

        .spinner {
            width: 12px;
            height: 12px;
            border: 2px solid var(--ink-950);
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
        }
    }
}

// Comments list styling
.comments-list {
    display: flex;
    flex-direction: column;
    gap: var(--s-4);
    max-height: 480px;
    overflow-y: auto;
    padding-right: 4px;

    &::-webkit-scrollbar {
        width: 6px;
    }
    &::-webkit-scrollbar-track {
        background: transparent;
    }
    &::-webkit-scrollbar-thumb {
        background: var(--rule-strong);
        border-radius: var(--r-pill);
    }
}

.comment-card {
    background: var(--ink-750);
    border-radius: var(--r-md);
    padding: var(--s-4);
    border: 1px solid var(--rule);
    display: flex;
    flex-direction: column;
    gap: var(--s-2);

    &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    &__author {
        display: flex;
        align-items: center;
        gap: var(--s-2);
    }

    &__avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--fs-sm);
        flex-shrink: 0;
    }

    &__username {
        font-family: var(--font-ui);
        font-weight: 600;
        font-size: var(--fs-sm);
        color: var(--bone-100);
    }

    .guest-badge {
        font-size: 0.6rem;
        background: var(--rule-strong);
        color: var(--bone-400);
        padding: 1px 6px;
        border-radius: var(--r-sm);
        font-weight: 600;
    }

    &__time {
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        color: var(--bone-450);
    }

    &__body {
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        line-height: 1.5;
        color: var(--bone-200);
        word-break: break-word;
        white-space: pre-wrap;
    }
}

// Fade animations
.comment-fade-enter-active, .comment-fade-leave-active {
    transition: all 0.4s ease;
}
.comment-fade-enter-from {
    opacity: 0;
    transform: translateY(-20px);
}
.comment-fade-leave-to {
    opacity: 0;
    transform: translateY(20px);
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
</style>
