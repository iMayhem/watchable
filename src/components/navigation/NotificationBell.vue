<template>
    <div ref="containerRef" class="notification-bell">
        <button
            type="button"
            class="notification-bell__btn"
            :class="{ 'is-open': isOpen }"
            aria-label="Notifications"
            title="Notifications"
            @click="toggleDropdown"
        >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span v-if="unreadCount > 0" class="notification-bell__badge">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
        </button>

        <Teleport to="body">
            <div v-if="isOpen" class="notification-bell__backdrop" @click="closeDropdown" />
        </Teleport>

        <div v-if="isOpen" class="notification-bell__dropdown">
            <div class="notification-bell__header">
                <span class="notification-bell__title">Notifications</span>
                <button
                    v-if="unreadCount > 0"
                    type="button"
                    class="notification-bell__mark-read"
                    @click="handleMarkAllRead"
                >
                    Mark all read
                </button>
            </div>

            <div v-if="pollData" class="notification-bell__poll">
                <div class="notification-bell__poll-question">{{ pollData.question }}</div>
                <div class="notification-bell__poll-results">
                    <div v-for="(r, i) in pollData.results" :key="i" class="notification-bell__poll-result">
                        <div class="notification-bell__poll-result-label">
                            <span>{{ r.option }}</span>
                            <span>{{ r.count }} ({{ r.percentage }}%)</span>
                        </div>
                        <div class="notification-bell__poll-bar">
                            <div class="notification-bell__poll-bar-fill" :style="{ width: r.percentage + '%' }" />
                        </div>
                    </div>
                </div>
                <div class="notification-bell__poll-total">{{ pollData.totalVotes }} total votes</div>
            </div>

            <div class="notification-bell__list">
                <div v-if="notifications.length === 0 && !pollData" class="notification-bell__empty">
                    No notifications yet
                </div>
                <button
                    v-for="n in notifications"
                    :key="n.id"
                    type="button"
                    class="notification-bell__item"
                    :class="{ 'is-unread': !n.read }"
                    @click="handleClick(n)"
                >
                    <div class="notification-bell__item-dot" :class="`is-${n.type}`" />
                    <div class="notification-bell__item-content">
                        <div class="notification-bell__item-title">{{ n.title }}</div>
                        <div v-if="n.message" class="notification-bell__item-message">{{ n.message }}</div>
                        <div class="notification-bell__item-time">{{ timeAgo(n.created_at) }}</div>
                    </div>
                </button>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useNotifications } from '../../composables/useNotifications'
import { usePolls } from '../../composables/usePolls'

const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead } = useNotifications()
const { activePoll, pollResults, totalVotes, fetchActivePoll, fetchPollResults } = usePolls()

const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const pollData = ref<{ question: string; results: { option: string; count: number; percentage: number }[]; totalVotes: number } | null>(null)

async function loadPollData() {
    await fetchActivePoll()
    if (activePoll.value) {
        pollData.value = {
            question: activePoll.value.question,
            results: pollResults.value,
            totalVotes: totalVotes.value
        }
    } else {
        pollData.value = null
    }
}

function toggleDropdown() {
    isOpen.value = !isOpen.value
    if (isOpen.value) {
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

function handleClickOutside(e: MouseEvent) {
    if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
        closeDropdown()
    }
}

onMounted(() => {
    fetchNotifications()
    document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
    document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.notification-bell {
    position: relative;
    display: inline-flex;
}

.notification-bell__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    background: var(--surface-tint);
    border: 1px solid var(--rule);
    border-radius: var(--r-pill);
    color: var(--bone-300);
    cursor: pointer;
    position: relative;
    transition: background-color var(--dur-fast), border-color var(--dur-fast), color var(--dur-fast);
}

.notification-bell__btn svg {
    width: 18px;
    height: 18px;
    flex: 0 0 auto;
}

.notification-bell__btn:hover,
.notification-bell__btn.is-open {
    background: var(--surface-tint-hover);
    border-color: var(--rule-strong);
    color: var(--bone-50);
}

.notification-bell__badge {
    position: absolute;
    top: -2px;
    right: -2px;
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

.notification-bell__backdrop {
    position: fixed;
    inset: 0;
    z-index: 998;
    background: transparent;
}

.notification-bell__dropdown {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 360px;
    max-height: 480px;
    background: rgba(26, 24, 21, 0.97);
    backdrop-filter: blur(16px) saturate(180%);
    border: 1px solid var(--rule);
    border-radius: var(--r-lg);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
    z-index: 999;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.notification-bell__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--s-4) var(--s-4) var(--s-2);
    border-bottom: 1px solid var(--rule);
}

.notification-bell__title {
    font-family: var(--font-ui);
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--bone-50);
}

.notification-bell__mark-read {
    background: none;
    border: none;
    color: var(--ember);
    font-family: var(--font-ui);
    font-size: var(--fs-xs);
    font-weight: 600;
    cursor: pointer;
    padding: 0;
}

.notification-bell__mark-read:hover {
    text-decoration: underline;
}

.notification-bell__poll {
    padding: var(--s-3) var(--s-4);
    border-bottom: 1px solid var(--rule);
    background: rgba(255, 90, 31, 0.03);
}

.notification-bell__poll-question {
    font-family: var(--font-display);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--bone-50);
    margin-bottom: var(--s-2);
}

.notification-bell__poll-results {
    display: flex;
    flex-direction: column;
    gap: var(--s-1);
}

.notification-bell__poll-result-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.65rem;
    color: var(--bone-400);
    margin-bottom: 1px;
}

.notification-bell__poll-bar {
    height: 5px;
    background: var(--ink-700);
    border-radius: 3px;
    overflow: hidden;
}

.notification-bell__poll-bar-fill {
    height: 100%;
    background: var(--ember);
    border-radius: 3px;
    transition: width 0.3s ease;
}

.notification-bell__poll-total {
    text-align: center;
    font-size: 0.6rem;
    color: var(--bone-500);
    margin-top: var(--s-1);
}

.notification-bell__list {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: var(--s-1) 0;
}

.notification-bell__empty {
    padding: var(--s-6) var(--s-4);
    text-align: center;
    color: var(--bone-500);
    font-size: var(--fs-sm);
}

.notification-bell__item {
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

.notification-bell__item:last-child {
    border-bottom: none;
}

.notification-bell__item:hover {
    background: var(--surface-tint);
}

.notification-bell__item.is-unread {
    background: rgba(255, 90, 31, 0.04);
}

.notification-bell__item-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-top: 6px;
    flex-shrink: 0;
}

.notification-bell__item-dot.is-info { background: var(--ember); }
.notification-bell__item-dot.is-success { background: #6ba368; }
.notification-bell__item-dot.is-warning { background: #e8a838; }
.notification-bell__item-dot.is-error { background: #c94e3d; }

.notification-bell__item-content {
    flex: 1;
    min-width: 0;
}

.notification-bell__item-title {
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--bone-50);
    line-height: 1.3;
}

.notification-bell__item-message {
    font-size: var(--fs-xs);
    color: var(--bone-400);
    margin-top: 2px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.notification-bell__item-time {
    font-size: 0.625rem;
    color: var(--bone-500);
    margin-top: 4px;
}
</style>
