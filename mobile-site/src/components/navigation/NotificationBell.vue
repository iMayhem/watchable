<template>
    <div class="m-notif-bell">
        <button
            type="button"
            class="m-app__icon-btn"
            :class="{ 'is-open': isOpen, 'is-compact': compact }"
            aria-label="Notifications"
            @click="toggleDropdown"
        >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span v-if="unreadCount > 0" class="m-notif-bell__badge">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
        </button>

        <Teleport to="body">
            <div v-if="isOpen" class="m-notif-bell__backdrop" @click="closeDropdown" />

            <div v-if="isOpen" class="m-notif-bell__dropdown" @click.stop>
                <div class="m-notif-bell__header">
                    <span class="m-notif-bell__title">Notifications</span>
                    <button
                        v-if="unreadCount > 0"
                        type="button"
                        class="m-notif-bell__mark-read"
                        @click="handleMarkAllRead"
                    >
                        Mark all read
                    </button>
                    <button type="button" class="m-notif-bell__close-btn" @click="closeDropdown" aria-label="Close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <!-- Active poll results -->
                <div v-if="!showOldPolls && pollData" class="m-notif-bell__poll">
                    <div class="m-notif-bell__poll-question">{{ pollData.question }}</div>
                    <div class="m-notif-bell__poll-results">
                        <div
                            v-for="(r, i) in pollData.results"
                            :key="i"
                            class="m-notif-bell__poll-result"
                            :class="{ 'is-clickable': !votedThisPoll, 'is-disabled': votedThisPoll }"
                            :title="votedThisPoll ? 'Already voted' : 'Click to vote'"
                            @click="handlePollVote(i)"
                        >
                            <div class="m-notif-bell__poll-result-label">
                                <span>{{ r.option }}</span>
                                <span>{{ r.count }} ({{ r.percentage }}%)</span>
                            </div>
                            <div class="m-notif-bell__poll-bar">
                                <div class="m-notif-bell__poll-bar-fill" :style="{ width: r.percentage + '%' }" />
                            </div>
                        </div>
                    </div>
                    <div class="m-notif-bell__poll-total">{{ pollData.totalVotes }} total votes</div>
                    <button
                        v-if="hasOldPolls"
                        type="button"
                        class="m-notif-bell__old-polls-btn"
                        @click.stop="openOldPolls"
                    >
                        Old Polls
                    </button>
                </div>

                <!-- Old polls list -->
                <div v-if="showOldPolls" class="m-notif-bell__poll m-notif-bell__poll--old">
                    <div class="m-notif-bell__poll-header">
                        <span class="m-notif-bell__poll-question">All Polls</span>
                        <button
                            type="button"
                            class="m-notif-bell__poll-back"
                            @click.stop="showOldPolls = false"
                        >
                            Back
                        </button>
                    </div>
                    <div v-if="oldPollsLoading" class="m-notif-bell__old-shimmer">
                        <div v-for="n in 3" :key="n" class="m-notif-bell__old-shimmer-item">
                            <div class="shimmer-line w-60" />
                            <div class="shimmer-line w-40" />
                            <div class="shimmer-line w-100" />
                        </div>
                    </div>
                    <div v-for="p in allPollsData" :key="p.id" class="m-notif-bell__old-poll">
                        <div class="m-notif-bell__poll-question m-notif-bell__poll-question--sm">{{ p.question }}</div>
                        <div v-if="!p.is_active" class="m-notif-bell__poll-inactive-badge">closed</div>
                        <div class="m-notif-bell__poll-results">
                            <div v-for="(r, i) in p.results" :key="i" class="m-notif-bell__poll-result">
                                <div class="m-notif-bell__poll-result-label">
                                    <span>{{ r.option }}</span>
                                    <span>{{ r.count }} ({{ r.percentage }}%)</span>
                                </div>
                                <div class="m-notif-bell__poll-bar">
                                    <div class="m-notif-bell__poll-bar-fill" :style="{ width: r.percentage + '%' }" />
                                </div>
                            </div>
                        </div>
                        <div class="m-notif-bell__poll-total">{{ p.totalVotes }} total votes</div>
                    </div>
                </div>

                <div class="m-notif-bell__list">
                    <div v-if="notifications.length === 0 && !pollData" class="m-notif-bell__empty">
                        No notifications yet
                    </div>
                    <button
                        v-for="n in notifications"
                        :key="n.id"
                        type="button"
                        class="m-notif-bell__item"
                        :class="{ 'is-unread': !n.read }"
                        @click="handleClick(n)"
                    >
                        <div class="m-notif-bell__item-dot" :class="`is-${n.type}`" />
                        <div class="m-notif-bell__item-content">
                            <div class="m-notif-bell__item-title">{{ n.title }}</div>
                            <div v-if="n.message" class="m-notif-bell__item-message">{{ n.message }}</div>
                            <div class="m-notif-bell__item-time">{{ timeAgo(n.created_at) }}</div>
                        </div>
                    </button>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useNotifications } from '@/composables/useNotifications'
import { usePolls } from '@/composables/usePolls'

const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead } = useNotifications()
const { activePoll, pollResults, totalVotes, allPolls, fetchActivePoll, fetchAllPolls, vote, hasVoted, voting } = usePolls()

defineProps<{ compact?: boolean }>()

const isOpen = ref(false)
const showOldPolls = ref(false)
const oldPollsLoading = ref(false)
let allPollsPromise: Promise<void> | null = null
const pollData = ref<{ question: string; results: { option: string; count: number; percentage: number }[]; totalVotes: number } | null>(null)
const allPollsData = ref<{ id: number; question: string; is_active: boolean; results: { option: string; count: number; percentage: number }[]; totalVotes: number }[]>([])
const hasOldPolls = ref(false)
const votedThisPoll = computed(() => activePoll.value ? hasVoted(activePoll.value.id) : false)

function ensureAllPollsFetched() {
    if (!allPollsPromise) allPollsPromise = fetchAllPolls()
    return allPollsPromise
}

async function handlePollVote(optionIndex: number) {
    if (votedThisPoll.value || voting.value || !activePoll.value) return
    await vote(activePoll.value.id, optionIndex)
    await loadPollData()
}

async function loadPollData() {
    const p1 = fetchActivePoll().then(() => {
        if (activePoll.value) {
            pollData.value = {
                question: activePoll.value.question,
                results: pollResults.value,
                totalVotes: totalVotes.value
            }
        } else {
            pollData.value = null
        }
    })
    const p2 = ensureAllPollsFetched().then(() => {
        const old = allPolls.value.filter(p => !p.is_active || p.id !== activePoll.value?.id)
        hasOldPolls.value = old.length > 0
    })
    await Promise.all([p1, p2])
}

async function openOldPolls() {
    if (showOldPolls.value) {
        showOldPolls.value = false
        return
    }
    showOldPolls.value = true
    oldPollsLoading.value = true
    await ensureAllPollsFetched()
    allPollsData.value = allPolls.value.map(p => ({
        id: p.id,
        question: p.question,
        is_active: p.is_active,
        results: p.results,
        totalVotes: p.totalVotes
    }))
    oldPollsLoading.value = false
}

function toggleDropdown() {
    isOpen.value = !isOpen.value
    if (isOpen.value) {
        showOldPolls.value = false
        fetchNotifications()
        loadPollData()
    }
}

function closeDropdown() {
    isOpen.value = false
}

function handleClick(n: any) {
    if (!n.read) {
        markAsRead(n.id)
    }
}

function handleMarkAllRead() {
    markAllAsRead()
}

function timeAgo(dateStr: string) {
    const now = Date.now()
    const date = new Date(dateStr).getTime()
    const diff = now - date
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString()
}

onMounted(() => {
    fetchNotifications()
    ensureAllPollsFetched()
})
</script>

<style scoped>
.m-notif-bell {
    position: relative;
    display: inline-flex;
}

.m-app__icon-btn {
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: var(--r-pill);
    color: var(--bone-200);
    background: var(--ink-800);
    border: 1px solid var(--rule);
}

.m-app__icon-btn svg {
    width: 1.05rem;
    height: 1.05rem;
}

.m-app__icon-btn.is-open {
    background: var(--surface-tint-hover);
    border-color: var(--rule-strong);
    color: var(--bone-50);
}

.m-app__icon-btn.is-compact {
    width: 2.25rem;
    height: 2.25rem;
}

.m-notif-bell__badge {
    position: absolute;
    top: -1px;
    right: -1px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    background: var(--ember);
    color: var(--ink-950);
    font-size: 0.625rem;
    font-weight: 800;
    line-height: 16px;
    text-align: center;
    border-radius: 8px;
    pointer-events: none;
}

.m-notif-bell__backdrop {
    position: fixed;
    inset: 0;
    z-index: 998;
    background: transparent;
}

.m-notif-bell__dropdown {
    position: fixed;
    top: 0;
    right: 0;
    width: min(400px, 100vw);
    height: 100dvh;
    background: rgba(26, 24, 21, 0.98);
    backdrop-filter: blur(16px) saturate(180%);
    border-left: 1px solid var(--rule);
    box-shadow: -8px 0 40px rgba(0, 0, 0, 0.5);
    z-index: 999;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: m-slide-in 0.2s ease-out;
}

@keyframes m-slide-in {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
}

.m-notif-bell__header {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    padding: max(env(safe-area-inset-top, 0px), var(--s-4)) var(--s-4) var(--s-2);
    border-bottom: 1px solid var(--rule);
}

.m-notif-bell__title {
    font-family: var(--font-ui);
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--bone-50);
    margin-right: auto;
}

.m-notif-bell__mark-read {
    background: none;
    border: none;
    color: var(--ember);
    font-family: var(--font-ui);
    font-size: var(--fs-xs);
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    white-space: nowrap;
}

.m-notif-bell__mark-read:hover {
    text-decoration: underline;
}

.m-notif-bell__close-btn {
    background: none;
    border: none;
    color: var(--bone-400);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--r-xs);
    display: flex;
}

.m-notif-bell__close-btn:hover {
    color: var(--bone-50);
}

.m-notif-bell__poll {
    padding: var(--s-3) var(--s-4);
    border-bottom: 1px solid var(--rule);
    background: rgba(255, 90, 31, 0.03);
}

.m-notif-bell__poll-question {
    font-family: var(--font-display);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--bone-50);
    margin-bottom: var(--s-2);
}

.m-notif-bell__poll-results {
    display: flex;
    flex-direction: column;
    gap: var(--s-1);
}

.m-notif-bell__poll-result.is-clickable {
    cursor: pointer;
    padding: 2px 4px;
    margin: -2px -4px;
    border-radius: var(--r-sm);
    transition: background var(--dur-fast);
}

.m-notif-bell__poll-result.is-clickable:hover {
    background: var(--ink-700);
}

.m-notif-bell__poll-result.is-disabled {
    opacity: 0.7;
}

.m-notif-bell__poll-result-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.65rem;
    color: var(--bone-400);
    margin-bottom: 1px;
}

.m-notif-bell__poll-bar {
    height: 5px;
    background: var(--ink-700);
    border-radius: 3px;
    overflow: hidden;
}

.m-notif-bell__poll-bar-fill {
    height: 100%;
    background: var(--ember);
    border-radius: 3px;
    transition: width 0.3s ease;
}

.m-notif-bell__poll-total {
    text-align: center;
    font-size: 0.6rem;
    color: var(--bone-500);
    margin-top: var(--s-1);
}

.m-notif-bell__list {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: var(--s-1) 0;
}

.m-notif-bell__empty {
    padding: var(--s-6) var(--s-4);
    text-align: center;
    color: var(--bone-500);
    font-size: var(--fs-sm);
}

.m-notif-bell__item {
    display: flex;
    gap: var(--s-3);
    width: 100%;
    padding: var(--s-3) var(--s-4);
    background: none;
    border: none;
    border-bottom: 1px solid var(--rule);
    cursor: pointer;
    text-align: left;
    transition: background-color var(--dur-fast);
    font-family: var(--font-ui);
}

.m-notif-bell__item:last-child {
    border-bottom: none;
}

.m-notif-bell__item:hover {
    background: var(--surface-tint);
}

.m-notif-bell__item.is-unread {
    background: rgba(255, 90, 31, 0.04);
}

.m-notif-bell__item-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-top: 6px;
    flex-shrink: 0;
}

.m-notif-bell__item-dot.is-info { background: var(--ember); }
.m-notif-bell__item-dot.is-success { background: #6ba368; }
.m-notif-bell__item-dot.is-warning { background: #e8a838; }
.m-notif-bell__item-dot.is-error { background: #c94e3d; }

.m-notif-bell__item-content {
    flex: 1;
    min-width: 0;
}

.m-notif-bell__item-title {
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--bone-50);
    line-height: 1.3;
}

.m-notif-bell__item-message {
    font-size: var(--fs-xs);
    color: var(--bone-400);
    margin-top: 2px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.m-notif-bell__item-time {
    font-size: 0.625rem;
    color: var(--bone-500);
    margin-top: 4px;
}

.m-notif-bell__old-polls-btn {
    display: block;
    width: 100%;
    margin-top: var(--s-2);
    padding: var(--s-1) 0;
    background: none;
    border: 1px solid var(--rule);
    border-radius: var(--r-sm);
    color: var(--bone-400);
    font-family: var(--font-ui);
    font-size: var(--fs-xs);
    font-weight: 600;
    cursor: pointer;
    text-align: center;
}

.m-notif-bell__old-polls-btn:hover {
    color: var(--bone-50);
    border-color: var(--rule-strong);
}

.m-notif-bell__poll--old {
    max-height: 60vh;
    overflow-y: auto;
}

.m-notif-bell__poll-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--s-2);
}

.m-notif-bell__poll-back {
    background: none;
    border: none;
    color: var(--ember);
    font-family: var(--font-ui);
    font-size: var(--fs-xs);
    font-weight: 600;
    cursor: pointer;
    padding: 0;
}

.m-notif-bell__poll-back:hover {
    text-decoration: underline;
}

.m-notif-bell__old-poll {
    padding: var(--s-2) 0;
    border-bottom: 1px solid var(--rule);
}

.m-notif-bell__old-poll:last-child {
    border-bottom: none;
}

.m-notif-bell__poll-question--sm {
    font-size: var(--fs-xs);
    margin-bottom: var(--s-1);
}

.m-notif-bell__poll-inactive-badge {
    display: inline-block;
    font-size: 0.55rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--bone-500);
    background: var(--ink-700);
    padding: 1px 6px;
    border-radius: var(--r-pill);
    margin-bottom: var(--s-1);
}

.m-notif-bell__old-shimmer {
    padding: var(--s-2) 0;
    display: flex;
    flex-direction: column;
    gap: var(--s-4);
}

.m-notif-bell__old-shimmer-item {
    display: flex;
    flex-direction: column;
    gap: var(--s-1);
}

.m-notif-bell__old-shimmer-item .shimmer-line {
    height: 8px;
    border-radius: 4px;
    background: linear-gradient(90deg, var(--ink-700) 25%, var(--ink-600) 50%, var(--ink-700) 75%);
    background-size: 200% 100%;
    animation: m-shimmer 1.4s ease-in-out infinite;
}

.m-notif-bell__old-shimmer-item .shimmer-line.w-60 { width: 60%; }
.m-notif-bell__old-shimmer-item .shimmer-line.w-40 { width: 40%; }
.m-notif-bell__old-shimmer-item .shimmer-line.w-100 { width: 100%; }

@keyframes m-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
</style>
