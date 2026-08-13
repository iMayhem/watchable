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

                <!-- Archive access — always visible, even with no active poll/suggestion -->
                <div class="notification-bell__archive-bar">
                    <button type="button" class="notification-bell__archive-btn" @click="openOldPolls">
                        {{ showOldPolls ? 'Close Old Polls' : 'Old Polls' }}
                    </button>
                    <button type="button" class="notification-bell__archive-btn" @click="openOldSuggestions">
                        {{ showOldSuggestions ? 'Close Old Suggestions' : 'Old Suggestions' }}
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
                </div>

                <!-- Active suggestion form -->
                <div v-if="activeSuggestion" class="notification-bell__suggestion">
                    <div class="notification-bell__suggestion-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        Suggestions
                    </div>
                    <div class="notification-bell__suggestion-prompt">{{ activeSuggestion.prompt }}</div>

                    <!-- submitted thanks -->
                    <div v-if="suggestionSubmitted || alreadySubmittedSuggestion" class="notification-bell__suggestion-thanks">
                        ✓ Thanks for your feedback!
                    </div>

                    <!-- form -->
                    <template v-else-if="showSuggestionForm">
                        <textarea
                            v-model="suggestionText"
                            class="notification-bell__suggestion-textarea"
                            :placeholder="activeSuggestion.placeholder || 'Write your feedback here…'"
                            :maxlength="activeSuggestion.max_length || 500"
                            rows="3"
                        />
                        <div class="notification-bell__suggestion-footer">
                            <span class="notification-bell__suggestion-charcount">{{ suggestionText.length }}/{{ activeSuggestion.max_length || 500 }}</span>
                            <div style="display:flex;gap:6px;align-items:center">
                                <button type="button" class="notification-bell__suggestion-dismiss" @click="handleSuggestionDismiss">skip</button>
                                <button
                                    type="button"
                                    class="notification-bell__suggestion-submit"
                                    :disabled="submitting || suggestionText.trim().length === 0"
                                    @click="handleSuggestionSubmit"
                                >
                                    {{ submitting ? '…' : 'Send' }}
                                </button>
                            </div>
                        </div>
                    </template>

                    <!-- dismissed / already submitted -->
                </div>

                <div class="notification-bell__list">
                    <div v-if="notifications.length === 0 && !pollData && !activeSuggestion" class="notification-bell__empty">
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

            <!-- Old polls panel (to the left of main dropdown) — stays open after the bell closes -->
            <div v-if="showOldPolls" class="notification-bell__panel-backdrop" @click="showOldPolls = false" />
            <div v-if="showOldPolls" class="notification-bell__old-panel" :style="oldPanelStyle" @click.stop>
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
            <!-- Old suggestions panel — stays open after the bell closes -->
            <div v-if="showOldSuggestions" class="notification-bell__panel-backdrop" @click="showOldSuggestions = false" />
            <div v-if="showOldSuggestions" class="notification-bell__old-panel" :style="{ top: dropdownStyle.top, right: `calc(${dropdownStyle.right} + 368px)` }" @click.stop>
                <div class="notification-bell__old-header">
                    <span class="notification-bell__title">Active Suggestions</span>
                    <button type="button" class="notification-bell__poll-back" @click="showOldSuggestions = false">Close</button>
                </div>
                <div class="notification-bell__old-list">
                    <div v-if="oldSuggestions.length === 0" class="notification-bell__empty" style="padding:16px;text-align:center;color:var(--bone-500);font-size:12px">No suggestions yet</div>
                    <div v-for="s in oldSuggestions" :key="s.id" class="notification-bell__old-poll">
                        <div class="notification-bell__poll-question notification-bell__poll-question--sm">{{ s.prompt }}</div>
                        <div v-if="s.is_active" style="display:inline-block;font-size:0.55rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#6ba368;background:rgba(107,163,104,0.12);padding:1px 6px;border-radius:999px;margin-bottom:6px">active</div>
                        <div v-else class="notification-bell__poll-inactive-badge">closed</div>
                        <div style="font-size:0.65rem;color:var(--bone-500)">{{ new Date(s.created_at).toLocaleDateString() }}</div>
                        <button
                            type="button"
                            class="notification-bell__responses-toggle"
                            @click="toggleResponses(s.id)"
                        >
                            {{ expandedSuggestionId === s.id ? 'Hide responses' : `Show responses (${(suggestionResponsesMap[s.id] || []).length})` }}
                        </button>
                        <div v-if="expandedSuggestionId === s.id" class="notification-bell__responses">
                            <div v-if="(suggestionResponsesMap[s.id] || []).length === 0" class="notification-bell__responses-empty">
                                No responses yet — be the first!
                            </div>
                            <div v-for="r in suggestionResponsesMap[s.id] || []" :key="r.id" class="notification-bell__response">
                                <div class="notification-bell__response-head">
                                    <span class="notification-bell__response-user">{{ r.user_fingerprint || 'Anonymous' }}</span>
                                    <span class="notification-bell__response-time">{{ timeAgo(r.created_at) }}</span>
                                </div>
                                <div class="notification-bell__response-text">{{ r.response_text }}</div>
                            </div>
                        </div>
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
import { useSuggestions } from '../../composables/useSuggestions'

const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead } = useNotifications()
const { activePoll, pollResults, totalVotes, allPolls, fetchActivePoll, fetchAllPolls, vote, hasVoted, voting } = usePolls()
const { activeSuggestion, submitting, fetchActiveSuggestion, submitResponse, hasSubmitted, hasDismissed, dismiss } = useSuggestions()

const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const showOldPolls = ref(false)
const oldPollsLoading = ref(false)
const dropdownStyle = ref<Record<string, string>>({})
const oldPanelStyle = ref<Record<string, string>>({})

// Suggestion state
const suggestionText = ref('')
const suggestionSubmitted = ref(false)
const showOldSuggestions = ref(false)
const oldSuggestions = ref<any[]>([])
const expandedSuggestionId = ref<number | null>(null)
const suggestionResponsesMap = ref<Record<number, any[]>>({})

const pollData = computed(() => {
    if (!activePoll.value) return null
    return {
        question: activePoll.value.question,
        results: pollResults.value,
        totalVotes: totalVotes.value
    }
})

const allPollsData = computed(() => {
    return allPolls.value.map(p => ({
        id: p.id,
        question: p.question,
        is_active: p.is_active,
        results: p.results,
        totalVotes: p.totalVotes
    }))
})

async function loadPollData() {
    await Promise.all([fetchActivePoll(), fetchAllPolls()])
}

const votedThisPoll = computed(() => activePoll.value ? hasVoted(activePoll.value.id) : false)

async function handlePollVote(optionIndex: number) {
    if (votedThisPoll.value || voting.value || !activePoll.value) return
    await vote(activePoll.value.id, optionIndex)
    await loadPollData()
}

// Suggestion computed + handlers
const showSuggestionForm = computed(() => {
    if (!activeSuggestion.value) return false
    const id = activeSuggestion.value.id
    return !hasSubmitted(id) && !hasDismissed(id)
})

const alreadySubmittedSuggestion = computed(() => {
    if (!activeSuggestion.value) return false
    return hasSubmitted(activeSuggestion.value.id)
})

async function handleSuggestionSubmit() {
    if (!activeSuggestion.value || !suggestionText.value.trim()) return
    const ok = await submitResponse(activeSuggestion.value.id, suggestionText.value)
    if (ok) {
        suggestionSubmitted.value = true
        suggestionText.value = ''
    }
}

function handleSuggestionDismiss() {
    if (activeSuggestion.value) dismiss(activeSuggestion.value.id)
}

async function openOldSuggestions() {
    if (showOldSuggestions.value) { showOldSuggestions.value = false; return }
    showOldPolls.value = false
    showOldSuggestions.value = true
    nextTick(positionDropdown)
    try {
        const { getSyncClient } = await import('../../lib/syncClient')
        const sync = await getSyncClient()
        const [sugRes, respRes] = await Promise.all([
            sync
                .from('suggestions')
                .select('*')
                .order('created_at', { ascending: false }),
            sync
                .from('suggestion_responses')
                .select('*')
        ])
        oldSuggestions.value = sugRes.data || []
        const map: Record<number, any[]> = {}
        for (const r of (respRes.data || [])) {
            if (!map[r.suggestion_id]) map[r.suggestion_id] = []
            map[r.suggestion_id].push(r)
        }
        suggestionResponsesMap.value = map
    } catch (e) {
        oldSuggestions.value = []
    }
}

function toggleResponses(id: number) {
    expandedSuggestionId.value = expandedSuggestionId.value === id ? null : id
}

async function openOldPolls() {
    if (showOldPolls.value) {
        showOldPolls.value = false
        return
    }
    showOldSuggestions.value = false
    showOldPolls.value = true
    oldPollsLoading.value = true
    nextTick(positionDropdown)
    await fetchAllPolls()
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
        suggestionSubmitted.value = false
        fetchNotifications()
        loadPollData()
        fetchActiveSuggestion()
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
    fetchAllPolls()
    fetchActiveSuggestion()
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
    width: auto;
    height: auto;
    padding: var(--s-2);
    background: transparent;
    border: 0;
    border-radius: 0;
    color: var(--bone-300);
    cursor: pointer;
    position: relative;
    transition: background-color var(--dur-fast), border-color var(--dur-fast), color var(--dur-fast);
}

.notification-bell__btn {
    background: transparent !important;
    border: 0 !important;
    box-shadow: none !important;
}

.notification-bell__btn svg {
    width: 18px;
    height: 18px;
    flex: 0 0 auto;
}

.notification-bell__btn:hover,
.notification-bell__btn.is-open {
    background: transparent !important;
    background-color: transparent !important;
    border: 0 !important;
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

.notification-bell__panel-backdrop {
    position: fixed;
    inset: 0;
    z-index: 998;
    background: transparent;
}

.notification-bell__dropdown {
    position: fixed;
    width: 360px;
    max-height: 480px;
    background: var(--ink-700);
    border: 1px solid var(--glass-border);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-pane);
    backdrop-filter: var(--blur-pane);
    -webkit-backdrop-filter: var(--blur-pane);
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
    color: var(--bone-100);
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

.notification-bell__archive-bar {
    display: flex;
    gap: 6px;
    padding: var(--s-2) var(--s-4);
    border-bottom: 1px solid var(--rule);
}

.notification-bell__archive-btn {
    flex: 1;
    padding: 4px 8px;
    background: none;
    border: 1px solid var(--rule);
    border-radius: var(--r-pill);
    color: var(--bone-400);
    font-family: var(--font-ui);
    font-size: var(--fs-xs);
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    transition: color var(--dur-fast), border-color var(--dur-fast), background var(--dur-fast);
}

.notification-bell__archive-btn:hover {
    color: var(--bone-50);
    border-color: var(--rule-strong);
    background: var(--surface-tint);
}

.notification-bell__poll {
    padding: var(--s-3) var(--s-4);
    border-bottom: 1px solid var(--rule);
    background: rgba(255, 255, 255, 0.02);
}

.notification-bell__poll-question {
    font-family: var(--font-display);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--bone-100);
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
    background: rgba(255, 255, 255, 0.025);
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
    color: var(--bone-100);
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
    background: var(--glass);
    border: 1px solid var(--glass-border);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-pane);
    backdrop-filter: var(--blur-pane);
    -webkit-backdrop-filter: var(--blur-pane);
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

/* Suggestion form styles */
.notification-bell__suggestion {
    padding: var(--s-3) var(--s-4);
    border-bottom: 1px solid var(--rule);
    background: rgba(255, 255, 255, 0.02);
}

.notification-bell__suggestion-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #6ba368;
    margin-bottom: var(--s-2);
}

.notification-bell__suggestion-prompt {
    font-family: var(--font-display);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--bone-50);
    margin-bottom: var(--s-2);
    line-height: 1.4;
}

.notification-bell__suggestion-textarea {
    width: 100%;
    background: var(--ink-900, #0d1117);
    border: 1px solid var(--rule);
    border-radius: var(--r-sm);
    color: var(--bone-100);
    font-family: var(--font-ui);
    font-size: var(--fs-xs);
    padding: 8px 10px;
    resize: none;
    transition: border-color var(--dur-fast);
    line-height: 1.4;
}

.notification-bell__suggestion-textarea:focus {
    outline: none;
    border-color: #6ba368;
}

.notification-bell__suggestion-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 4px;
}

.notification-bell__suggestion-charcount {
    font-size: 0.6rem;
    color: var(--bone-500);
}

.notification-bell__suggestion-submit {
    padding: 3px 12px;
    background: #000;
    border: none;
    border-radius: var(--r-pill);
    color: var(--ember);
    font-family: var(--font-ui);
    font-size: var(--fs-xs);
    font-weight: 600;
    cursor: pointer;
    transition: opacity var(--dur-fast);
}

.notification-bell__suggestion-submit:hover:not(:disabled) {
    opacity: 0.85;
}

.notification-bell__suggestion-submit:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.notification-bell__suggestion-dismiss {
    background: none;
    border: none;
    color: var(--bone-500);
    font-family: var(--font-ui);
    font-size: var(--fs-xs);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
    padding: 0;
}

.notification-bell__suggestion-dismiss:hover {
    color: var(--bone-300);
}

.notification-bell__suggestion-thanks {
    font-size: var(--fs-xs);
    color: #6ba368;
    font-weight: 600;
    padding: var(--s-1) 0;
}

/* Public responses */
.notification-bell__responses-toggle {
    display: block;
    width: 100%;
    margin-top: 6px;
    padding: 4px 0;
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

.notification-bell__responses-toggle:hover {
    color: var(--bone-50);
    border-color: var(--rule-strong);
}

.notification-bell__responses {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 220px;
    overflow-y: auto;
    padding-right: 2px;
}

.notification-bell__responses-empty {
    font-size: var(--fs-xs);
    color: var(--bone-500);
    text-align: center;
    padding: 6px 0;
}

.notification-bell__response {
    background: var(--ink-700);
    border-radius: var(--r-sm);
    padding: 6px 8px;
}

.notification-bell__response-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    margin-bottom: 2px;
}

.notification-bell__response-user {
    font-size: 0.625rem;
    font-weight: 700;
    color: #6ba368;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.notification-bell__response-time {
    font-size: 0.55rem;
    color: var(--bone-500);
    flex-shrink: 0;
}

.notification-bell__response-text {
    font-size: var(--fs-xs);
    color: var(--bone-100);
    line-height: 1.4;
    word-break: break-word;
}
</style>
