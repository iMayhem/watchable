<template>
    <section class="comments-panel">
        <header class="comments-panel__header">
            <h3 class="comments-panel__title">
                Discussion
                <span class="comments-panel__count" v-if="rawComments.length">· {{ rawComments.length }} comments</span>
            </h3>
        </header>

        <!-- Write top-level comment form -->
        <form @submit.prevent="submitMainComment" class="comment-form">
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
                    <img :src="getAvatarUrl(currentUsername)" :alt="currentUsername" class="user-identity__avatar" />
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
        <div v-else-if="visibleComments.length > 0" class="comments-list">
            <div v-for="c in visibleComments" :key="c.id" class="comment-thread-wrapper">
                <article 
                    class="comment-card"
                    :class="{ 
                        'comment-card--collapsed': isDirectlyCollapsed(c.id),
                        'comment-card--reply': c.depth > 0
                    }"
                    :style="{ paddingLeft: `calc(${c.depth} * 40px + var(--s-4))` }"
                >
                    <!-- Reddit/9anime style connection lines representing ancestors -->
                    <div 
                        v-for="i in c.depth" 
                        :key="i"
                        class="comment-card__thread-line"
                        :style="{ left: `calc(${i - 1} * 40px + 28px)` }"
                        @click="toggleCollapse(getAncestorIdAtDepth(c, i - 1))"
                        title="Collapse thread"
                    />

                    <!-- Comment Card Core Content -->
                    <div class="comment-card__content-wrapper">
                        <!-- Top header row -->
                        <div class="comment-card__header">
                            <div class="comment-card__author">
                                <img :src="getAvatarUrl(c.username)" :alt="c.username" class="comment-card__avatar" />
                                <span class="comment-card__username">{{ c.username }}</span>
                                <span v-if="c.parentUsername" class="comment-card__reply-arrow">
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
                                        <polyline points="9 18 15 12 9 6"></polyline>
                                    </svg>
                                    {{ c.parentUsername }}
                                </span>
                                <span v-if="c.isGuest" class="guest-badge meta">Guest</span>
                                <span class="comment-card__time">{{ formatTimeAgo(c.created_at) }}</span>
                            </div>

                            <!-- Top right controls -->
                            <div class="comment-card__controls">
                                <button 
                                    @click="toggleCollapse(c.id)" 
                                    class="comment-card__collapse-btn" 
                                    :title="isDirectlyCollapsed(c.id) ? 'Expand comment' : 'Collapse comment'"
                                >
                                    {{ isDirectlyCollapsed(c.id) ? '[+]' : '[—]' }}
                                </button>
                                <button @click="flagComment(c)" class="comment-card__flag-btn" title="Report post">
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                                        <line x1="4" y1="22" x2="4" y2="15"></line>
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <!-- Main comment text & actions (hidden if directly collapsed) -->
                        <template v-if="!isDirectlyCollapsed(c.id)">
                            <p class="comment-card__body">{{ c.content }}</p>
                            
                            <div class="comment-card__footer">
                                <!-- Reply action -->
                                <button @click="activeReplyId = activeReplyId === c.id ? null : c.id; replyText = '';" class="comment-card__reply-action-btn">
                                    Reply
                                </button>
                            </div>
                        </template>
                        <template v-else>
                            <span class="comment-card__collapsed-tag meta">Comment collapsed ({{ countReplies(c.id) }} replies hidden)</span>
                        </template>
                    </div>
                </article>

                <!-- Nested Reply Input (Inline composer) -->
                <transition name="reply-fade">
                    <form 
                        v-if="activeReplyId === c.id && !isDirectlyCollapsed(c.id)" 
                        @submit.prevent="submitReply(c.id)" 
                        class="reply-composer-form" 
                        :style="{ paddingLeft: `calc(${(c.depth + 1)} * 40px + var(--s-4))` }"
                    >
                        <div 
                            v-for="i in (c.depth + 1)" 
                            :key="i"
                            class="comment-card__thread-line"
                            :style="{ left: `calc(${i - 1} * 40px + 28px)` }"
                        />
                        <div class="reply-composer-form__content">
                            <textarea 
                                v-model="replyText" 
                                placeholder="Write a reply..." 
                                class="reply-composer-form__textarea" 
                                rows="2"
                                maxlength="500"
                                required
                            ></textarea>
                            <div class="reply-composer-form__buttons">
                                <button type="button" @click="activeReplyId = null" class="btn btn-secondary btn-xs">Cancel</button>
                                <button type="submit" class="btn btn-primary btn-xs" :disabled="submittingReply || !replyText.trim()">
                                    {{ submittingReply ? 'Posting...' : 'Reply' }}
                                </button>
                            </div>
                        </div>
                    </form>
                </transition>
            </div>
        </div>
        <div v-else class="comments-panel__empty">
            <p class="meta">No comments here yet. Start the conversation!</p>
        </div>
    </section>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, watch, computed } from 'vue';
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

interface RenderComment extends Comment {
    parentId?: number;
    parentUsername?: string;
    depth: number;
    likes: number;
    userLiked: boolean;
    replies: RenderComment[];
}

export default defineComponent({
    name: 'CommentsSection',
    props: {
        mediaId: { type: [Number, String], required: true },
        mediaType: { type: String, required: true }
    },
    setup(props) {
        const rawComments = ref<Comment[]>([]);
        const processedComments = ref<RenderComment[]>([]);
        const loading = ref(false);
        const submitting = ref(false);
        const submittingReply = ref(false);
        const newCommentText = ref('');
        const replyText = ref('');
        const guestName = ref('');
        const isLoggedIn = ref(false);
        const currentUsername = ref('');
        const activeReplyId = ref<number | null>(null);
        const collapsedComments = ref<Set<number>>(new Set());

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

        const getAvatarUrl = (name: string) => {
            const cleanName = encodeURIComponent(name.replace(/[^a-zA-Z0-9]/g, ''));
            const styles = ['adventurer', 'lorelei'];
            let hash = 0;
            for (let i = 0; i < name.length; i++) {
                hash = name.charCodeAt(i) + ((hash << 5) - hash);
            }
            const styleIndex = Math.abs(hash) % styles.length;
            const style = styles[styleIndex];
            return `https://api.dicebear.com/7.x/${style}/svg?seed=${cleanName}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
        };

        const buildCommentTree = (flatComments: Comment[]): RenderComment[] => {
            const parsedComments: RenderComment[] = flatComments.map(c => {
                const match = c.content.match(/^\[reply:(\d+)\](.*)/s);
                let parentId: number | undefined;
                let content = c.content;
                if (match) {
                    parentId = parseInt(match[1], 10);
                    content = match[2];
                }
                
                return {
                    ...c,
                    content,
                    parentId,
                    depth: 0,
                    likes: 0,
                    userLiked: false,
                    replies: []
                };
            });

            const commentMap = new Map<number, RenderComment>();
            parsedComments.forEach(c => commentMap.set(c.id, c));

            const rootNodes: RenderComment[] = [];

            // Sort chronically (ascending) so conversations thread logic aligns correctly
            parsedComments.sort((a, b) => a.id - b.id);

            parsedComments.forEach(c => {
                if (c.parentId && commentMap.has(c.parentId)) {
                    const parent = commentMap.get(c.parentId)!;
                    c.parentUsername = parent.username;
                    parent.replies.push(c);
                } else {
                    rootNodes.push(c);
                }
            });

            // Sort root level threads descending by ID (newest conversations first)
            rootNodes.sort((a, b) => b.id - a.id);

            const finalResult: RenderComment[] = [];
            const traverse = (node: RenderComment, depth: number) => {
                node.depth = depth;
                finalResult.push(node);
                // Sort replies chronologically (ascending) so reading replies reads naturally top to bottom
                node.replies.sort((a, b) => a.id - b.id);
                node.replies.forEach(child => traverse(child, depth + 1));
            };

            rootNodes.forEach(root => traverse(root, 0));

            return finalResult;
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

                rawComments.value = data || [];
                processedComments.value = buildCommentTree(rawComments.value.map((c: any) => {
                    const isKnownUser = c.username === currentUsername.value;
                    return {
                        ...c,
                        isGuest: !isKnownUser && !c.username.startsWith('@')
                    };
                }));
            } catch (e) {
                console.error('Failed to load comments:', e);
            } finally {
                loading.value = false;
            }
        };

        const submitMainComment = async () => {
            if (!newCommentText.value.trim()) return;
            submitting.value = true;

            const nameToPost = isLoggedIn.value 
                ? `@${currentUsername.value}` 
                : guestName.value.trim() || 'Anonymous';

            if (!isLoggedIn.value && typeof window !== 'undefined') {
                localStorage.setItem('movora_guest_name', nameToPost);
            }

            const text = newCommentText.value.trim()
            const optimistic: RenderComment = {
                id: -Date.now(),
                media_id: String(props.mediaId),
                media_type: props.mediaType,
                username: nameToPost,
                content: text,
                created_at: new Date().toISOString(),
                depth: 0,
                likes: 0,
                userLiked: false,
                replies: []
            }
            newCommentText.value = ''
            processedComments.value = [optimistic, ...processedComments.value]

            try {
                const supabase = await getSupabaseClient();
                const { data, error } = await supabase
                    .from('movora_comments')
                    .insert([
                        {
                            media_id: String(props.mediaId),
                            media_type: props.mediaType,
                            username: nameToPost,
                            content: text
                        }
                    ])
                    .select()
                    .single();

                if (error) throw error;

                if (data) {
                    await fetchComments();
                }
            } catch (e) {
                console.error('Failed to post comment:', e);
                processedComments.value = processedComments.value.filter(c => c.id !== optimistic.id)
            } finally {
                submitting.value = false;
            }
        };

        const submitReply = async (parentId: number) => {
            if (!replyText.value.trim()) return;
            submittingReply.value = true;

            const nameToPost = isLoggedIn.value 
                ? `@${currentUsername.value}` 
                : guestName.value.trim() || 'Anonymous';

            if (!isLoggedIn.value && typeof window !== 'undefined') {
                localStorage.setItem('movora_guest_name', nameToPost);
            }

            const text = replyText.value.trim()
            const prefixedContent = `[reply:${parentId}]${text}`;

            const optimistic: RenderComment = {
                id: -Date.now(),
                media_id: String(props.mediaId),
                media_type: props.mediaType,
                username: nameToPost,
                content: text,
                created_at: new Date().toISOString(),
                parentId,
                depth: 1,
                likes: 0,
                userLiked: false,
                replies: []
            }
            replyText.value = ''
            activeReplyId.value = null
            processedComments.value = [optimistic, ...processedComments.value]

            try {
                const supabase = await getSupabaseClient();
                const { data, error } = await supabase
                    .from('movora_comments')
                    .insert([
                        {
                            media_id: String(props.mediaId),
                            media_type: props.mediaType,
                            username: nameToPost,
                            content: prefixedContent
                        }
                    ])
                    .select()
                    .single();

                if (error) throw error;

                if (data) {
                    await fetchComments();
                }
            } catch (e) {
                console.error('Failed to post reply:', e);
                processedComments.value = processedComments.value.filter(c => c.id !== optimistic.id)
            } finally {
                submittingReply.value = false;
            }
        };

        const toggleCollapse = (id: number) => {
            if (collapsedComments.value.has(id)) {
                collapsedComments.value.delete(id);
            } else {
                collapsedComments.value.add(id);
            }
        };

        const isDirectlyCollapsed = (id: number): boolean => {
            return collapsedComments.value.has(id);
        };

        const getAncestorIdAtDepth = (c: RenderComment, targetDepth: number): number => {
            let current = c;
            while (current && current.depth > targetDepth) {
                if (!current.parentId) break;
                const parent = processedComments.value.find(p => p.id === current.parentId);
                if (!parent) break;
                current = parent;
            }
            return current.id;
        };

        const countReplies = (id: number): number => {
            // Count all nested replies under a collapsed comment
            let count = 0;
            const countNode = (nodeId: number) => {
                const children = processedComments.value.filter(p => p.parentId === nodeId);
                count += children.length;
                children.forEach(child => countNode(child.id));
            };
            countNode(id);
            return count;
        };

        const flagComment = (c: RenderComment) => {
            alert(`Comment by ${c.username} has been reported for moderation.`);
        };

        const visibleComments = computed(() => {
            return processedComments.value.filter(c => {
                if (!c.parentId) return true;
                
                let parentId = c.parentId;
                while (parentId) {
                    if (collapsedComments.value.has(parentId)) {
                        return false;
                    }
                    const parent = processedComments.value.find(p => p.id === parentId);
                    if (!parent) break;
                    parentId = parent.parentId!;
                }
                return true;
            });
        });

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
            rawComments,
            processedComments,
            visibleComments,
            loading,
            submitting,
            submittingReply,
            newCommentText,
            replyText,
            guestName,
            isLoggedIn,
            currentUsername,
            activeReplyId,
            collapsedComments,
            getAvatarUrl,
            submitMainComment,
            submitReply,
            toggleCollapse,
            isDirectlyCollapsed,
            getAncestorIdAtDepth,
            countReplies,
            flagComment,
            formatTimeAgo
        };
    }
});
</script>

<style lang="scss" scoped>
.comments-panel {
    background: var(--ink-850);
    border-radius: var(--r-lg);
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4), inset 0 0 0 1px var(--rule);
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
            background: var(--ink-900);
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
        background: var(--ink-750);
        padding: var(--s-2) var(--s-3);
        border-radius: var(--r-pill);
        border: 1px solid var(--rule);

        &__avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            object-fit: cover;
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
        background: var(--ink-750);
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

// Comments list container
.comments-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

// Reddit/9anime Threaded Comment Card
.comment-card {
    position: relative;
    padding-top: var(--s-3);
    padding-bottom: var(--s-3);
    padding-right: var(--s-4);
    display: flex;
    flex-direction: column;
    transition: background-color var(--dur-fast) ease;

    &:hover {
        background-color: rgba(255, 255, 255, 0.015);
    }

    &--reply {
        margin-top: 2px;
    }

    &--collapsed {
        opacity: 0.75;
        padding-bottom: var(--s-1);
    }

    // Ancestor connection lines
    &__thread-line {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 1.5px;
        background-color: rgba(255, 255, 255, 0.08);
        cursor: pointer;
        transition: background-color var(--dur-fast) ease, width var(--dur-fast) ease;

        &:hover {
            background-color: var(--ember);
            width: 2px;
        }
    }

    &__content-wrapper {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: var(--font-ui);
    }

    &__author {
        display: flex;
        align-items: center;
        gap: var(--s-2);
        flex-wrap: wrap;
    }

    &__avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        object-fit: cover;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        flex-shrink: 0;
    }

    &__username {
        font-weight: 600;
        font-size: var(--fs-sm);
        color: #b388ff; // Reddit-style premium violet username tag
    }

    &__reply-arrow {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: var(--fs-xs);
        color: var(--bone-450);
        background: rgba(255, 255, 255, 0.03);
        padding: 1px 6px;
        border-radius: var(--r-sm);
        
        svg {
            opacity: 0.6;
        }
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
        font-size: var(--fs-xs);
        color: var(--bone-500);
        margin-left: 2px;
    }

    &__controls {
        display: flex;
        align-items: center;
        gap: var(--s-2);
    }

    &__collapse-btn,
    &__flag-btn {
        background: transparent;
        border: none;
        color: var(--bone-500);
        cursor: pointer;
        padding: 4px;
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        border-radius: var(--r-sm);
        transition: color var(--dur-fast), background-color var(--dur-fast);

        &:hover {
            color: var(--bone-100);
            background-color: rgba(255, 255, 255, 0.05);
        }
    }

    &__flag-btn:hover {
        color: #ef4444;
        background-color: rgba(239, 68, 68, 0.08);
    }

    &__body {
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        line-height: 1.5;
        color: var(--bone-200);
        word-break: break-word;
        white-space: pre-wrap;
        margin: 0;
        padding-left: 36px;
    }

    &__footer {
        display: flex;
        align-items: center;
        gap: var(--s-4);
        padding-left: 36px;
        margin-top: 2px;
    }

    &__vote-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: transparent;
        border: none;
        color: var(--bone-450);
        cursor: pointer;
        padding: 3px 6px;
        border-radius: var(--r-sm);
        transition: all var(--dur-fast) var(--ease-out);

        svg {
            transition: transform var(--dur-fast);
        }

        &:hover {
            color: var(--ember);
            background: rgba(255, 90, 31, 0.05);
            
            svg {
                transform: translateY(-1px);
            }
        }

        &--active {
            color: var(--ember) !important;
            background: rgba(255, 90, 31, 0.08) !important;
        }
    }

    &__vote-count {
        font-family: var(--font-mono);
        font-size: var(--fs-xs);
        font-weight: 600;
    }

    &__reply-action-btn {
        background: transparent;
        border: none;
        color: var(--bone-450);
        font-family: var(--font-ui);
        font-size: var(--fs-xs);
        font-weight: 500;
        cursor: pointer;
        padding: 3px 8px;
        border-radius: var(--r-sm);
        transition: all var(--dur-fast);

        &:hover {
            color: var(--bone-100);
            background-color: rgba(255, 255, 255, 0.05);
        }
    }

    &__collapsed-tag {
        font-style: italic;
        color: var(--bone-500);
        padding-left: 36px;
        font-size: var(--fs-xs);
    }
}

// Inline Reply Composer
.reply-composer-form {
    position: relative;
    padding-top: var(--s-1);
    padding-bottom: var(--s-3);
    padding-right: var(--s-4);
    display: flex;
    flex-direction: column;

    &__content {
        background: var(--ink-750);
        border: 1px solid var(--rule-strong);
        border-radius: var(--r-lg);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        margin-left: 36px;
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

    &__buttons {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--s-2);
        padding: 0.5rem 1rem;
        background: rgba(0, 0, 0, 0.15);
        border-top: 1px solid var(--rule);
    }
}

// Transitions
.reply-fade-enter-active, .reply-fade-leave-active {
    transition: all var(--dur-base) var(--ease-out);
}
.reply-fade-enter-from, .reply-fade-leave-to {
    opacity: 0;
    transform: translateY(-8px);
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
</style>
