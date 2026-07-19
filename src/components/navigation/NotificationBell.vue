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
            <span v-if="unreadCount > 0" class="notification-bell__dot" />
        </button>

        <Teleport to="body">
            <div v-if="isOpen" class="notification-bell__backdrop" @click="closeDropdown" />
            <div v-if="isOpen" ref="dropdownRef" class="notification-bell__dropdown" :style="dropdownStyle" @click.stop>
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

                <!-- Active poll results -->
                <div v-if="pollData" class="notification-bell__poll">
                    <div class="notification-bell__poll-question">{{ pollData.question }}</div>
                    <div class="notification-bell__poll-results">
                        <div
                            v-for="(r, i) in pollData.results"
                            :key="i"
                            class="notification-bell__poll-result"
                            :class="{ 'is-clickable': !votedThisPoll, 'is-disabled': votedThisPoll }"
                            :title="votedThisPoll ? 'Already voted' : 'Click to vote'"
                            @click="handlePollVote(i)"
                        >
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
                    <button
                        v-if="hasOldPolls"
                        type="button"
                        class="notification-bell__old-polls-btn"
                        @click="openOldPolls"
                    >
                        {{ showOldPolls ? 'Close Old Polls' : 'Old Polls' }}
                    </button>
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

            <!-- Old polls panel (to the left of main dropdown) -->
            <div v-if="isOpen && showOldPolls" class="notification-bell__old-panel" :style="oldPanelStyle" @click.stop>
                <div class="notification-bell__old-header">
                    <span class="notification-bell__title">All Polls</span>
                    <button type="button" class="notification-bell__poll-back" @click="showOldPolls = false">
                        Close
                    </button>
                </div>
                <div class="notification-bell__old-list">
                    <div v-if="oldPollsLoading" class="notification-bell__old-shimmer">
                        <div v-for="n in 3" :key="n" class="notification-bell__old-shimmer-item">
                            <div class="shimmer-line w-60" />
                            <div class="shimmer-line w-40" />
                            <div class="shimmer-line w-100" />
                        </div>
                    </div>
                    <div v-for="p in allPollsData" :key="p.id" class="notification-bell__old-poll">
                        <div class="notification-bell__poll-question notification-bell__poll-question--sm">{{ p.question }}</div>
                        <div v-if="!p.is_active" class="notification-bell__poll-inactive-badge">closed</div>
                        <div class="notification-bell__poll-results">
                            <div v-for="(r, i) in p.results" :key="i" class="notification-bell__poll-result">
                                <div class="notification-bell__poll-result-label">
                                    <span>{{ r.option }}</span>
                                    <span>{{ r.count }} ({{ r.percentage }}%)</span>
                                </div>
                                <div class="notification-bell__poll-bar">
                                    <div class="notification-bell__poll-bar-fill" :style="{ width: r.percentage + '%' }" />
                                </div>
                            </div>
                        </div>
                        <div class="notification-bell__poll-total">{{ p.totalVotes }} total votes</div>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useNotifications } from '../../composables/useNotifications'
import { usePolls } from '../../composables/usePolls'

const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead } = useNotifications()
const { activePoll, pollResults, totalVotes, allPolls, fetchActivePoll, fetchAllPolls, vote, hasVoted, voting } = usePolls()

const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const showOldPolls = ref(false)
const oldPollsLoading = ref(false)
const pollData = ref<{ question: string; results: { option: string; count: number; percentage: number }[]; totalVotes: number } | null>(null)
const allPollsData = ref<{ id: number; question: string; is_active: boolean; results: { option: string; count: number; percentage: number }[]; totalVotes: number }[]>([])
const hasOldPolls = ref(false)
const dropdownStyle = ref<Record<string, string>>({})
const oldPanelStyle = ref<Record<string, string>>({})

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
    const p2 = fetchAllPolls().then(() => {
        const old = allPolls.value.filter(p => !p.is_active || p.id !== activePoll.value?.id)
        hasOldPolls.value = old.length > 0
    })
    await Promise.all([p1, p2])
}

const votedThisPoll = computed(() => activePoll.value ? hasVoted(activePoll.value.id) : false)

async function handlePollVote(optionIndex: number) {
    if (votedThisPoll.value || voting.value || !activePoll.value) return
    await vote(activePoll.value.id, optionIndex)
    await loadPollData()
}

async function openOldPolls() {
    if (showOldPolls.value) {
        showOldPolls.value = false
        return
    }
    showOldPolls.value = true
    oldPollsLoading.value = true
    nextTick(positionDropdown)
    await fetchAllPolls()
    allPollsData.value = allPolls.value.map(p => ({
        id: p.id,
        question: p.question,
        is_active: p.is_active,
        results: p.results,
        totalVotes: p.totalVotes
    }))
    oldPollsLoading.value = false
}

function positionDropdown() {
    if (containerRef.value) {
        const rect = containerRef.value.getBoundingClientRect()
        const top = rect.bottom + 8 + 'px'
        const right = window.innerWidth - rect.right + 'px'
        dropdownStyle.value = { top, right }
        if (showOldPolls.value) {
            oldPanelStyle.value = {
                top,
                right: `calc(${right} + 368px)`
            }
        }
    }
}

function toggleDropdown() {
    isOpen.value = !isOpen.value
    if (isOpen.value) {
        showOldPolls.value = false
        fetchNotifications()
        loadPollData()
        handleMarkAllRead()
        nextTick(positionDropdown)
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

function handleReposition() {
    if (isOpen.value) {
        positionDropdown()
    }
}

onMounted(() => {
    fetchNotifications()
    window.addEventListener('scroll', handleReposition, { passive: true })
    window.addEventListener('resize', handleReposition, { passive: true })
})

onBeforeUnmount(() => {
    window.removeEventListener('scroll', handleReposition)
    window.removeEventListener('resize', handleReposition)
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

.notification-bell__dot {
    position: absolute;
    top: 0;
    right: 0;
    width: 10px;
    height: 10px;
    background: var(--ember);
    border: 2px solid var(--surface-tint);
    border-radius: 50%;
    pointer-events: none;
}

.notification-bell__backdrop {
    position: fixed;
    inset: 0;
    z-index: 998;
    background: transparent;
}

.notification-bell__dropdown {
    position: fixed;
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

.notification-bell__poll-result.is-clickable {
    cursor: pointer;
    padding: 2px 4px;
    margin: -2px -4px;
    border-radius: var(--r-sm);
    transition: background var(--dur-fast);
}

.notification-bell__poll-result.is-clickable:hover {
    background: var(--ink-700);
}

.notification-bell__poll-result.is-disabled {
    opacity: 0.7;
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

.notification-bell__old-polls-btn {
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
    transition: color var(--dur-fast), border-color var(--dur-fast);
}

.notification-bell__old-polls-btn:hover {
    color: var(--bone-50);
    border-color: var(--rule-strong);
}

.notification-bell__old-panel {
    position: fixed;
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

.notification-bell__old-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--s-4) var(--s-4) var(--s-2);
    border-bottom: 1px solid var(--rule);
}

.notification-bell__old-list {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: var(--s-1) 0;
}

.notification-bell__poll-back {
    background: none;
    border: none;
    color: var(--ember);
    font-family: var(--font-ui);
    font-size: var(--fs-xs);
    font-weight: 600;
    cursor: pointer;
    padding: 0;
}

.notification-bell__poll-back:hover {
    text-decoration: underline;
}

.notification-bell__old-poll {
    padding: var(--s-3) var(--s-4);
    border-bottom: 1px solid var(--rule);
}

.notification-bell__old-poll:last-child {
    border-bottom: none;
}

.notification-bell__poll-question--sm {
    font-size: var(--fs-xs);
    margin-bottom: var(--s-1);
}

.notification-bell__poll-inactive-badge {
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

.notification-bell__old-shimmer {
    padding: var(--s-3) var(--s-4);
    display: flex;
    flex-direction: column;
    gap: var(--s-4);
}

.notification-bell__old-shimmer-item {
    display: flex;
    flex-direction: column;
    gap: var(--s-1);
}

.notification-bell__old-shimmer-item .shimmer-line {
    height: 8px;
    border-radius: 4px;
    background: linear-gradient(90deg, var(--ink-700) 25%, var(--ink-600) 50%, var(--ink-700) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s ease-in-out infinite;
}

.shimmer-line.w-60 { width: 60%; }
.shimmer-line.w-40 { width: 40%; }
.shimmer-line.w-100 { width: 100%; }

@keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
</style>
