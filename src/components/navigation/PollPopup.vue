<template>
    <Teleport to="body">
        <div v-if="show" class="poll-overlay" @click.self="handleDismiss">
            <div class="poll-modal">
                <button type="button" class="poll-modal__close" @click="handleDismiss" aria-label="Dismiss poll">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
                <div class="poll-modal__question">{{ activePoll?.question }}</div>
                <div class="poll-modal__options">
                    <button
                        v-for="(opt, i) in activePoll?.options"
                        :key="i"
                        type="button"
                        class="poll-modal__option"
                        :disabled="voting"
                        @click="handleVote(i)"
                    >
                        {{ opt }}
                    </button>
                </div>
                <button type="button" class="poll-modal__later" @click="handleDismiss">
                    Maybe later
                </button>
            </div>
        </div>
    </Teleport>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { usePolls } from '../../composables/usePolls'

const { activePoll, voting, fetchActivePoll, vote, hasVoted, hasDismissed, dismissPoll } = usePolls()

const show = ref(false)

async function checkPoll() {
    await fetchActivePoll()
    if (!activePoll.value) return
    if (!activePoll.value.is_active) return
    const id = activePoll.value.id
    if (hasVoted(id) || hasDismissed(id)) return
    show.value = true
}

async function handleVote(optionIndex: number) {
    if (!activePoll.value) return
    await vote(activePoll.value.id, optionIndex)
    show.value = false
}

function handleDismiss() {
    if (activePoll.value) {
        dismissPoll(activePoll.value.id)
    }
    show.value = false
}

onMounted(() => {
    checkPoll()
})
</script>

<style scoped>
.poll-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--s-4);
    animation: poll-fade-in 0.22s var(--ease-out);
}

@keyframes poll-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
}

.poll-modal {
    background: var(--ink-800);
    border: 1px solid var(--rule);
    border-radius: var(--r-lg);
    padding: var(--s-6);
    max-width: 420px;
    width: 100%;
    position: relative;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.04);
    animation: poll-spring-up 0.38s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes poll-spring-up {
    from { opacity: 0; transform: translateY(24px) scale(0.94); }
    to   { opacity: 1; transform: translateY(0)   scale(1); }
}

.poll-modal__close {
    position: absolute;
    top: var(--s-2);
    right: var(--s-2);
    background: none;
    border: none;
    color: var(--bone-400);
    cursor: pointer;
    padding: 6px;
    border-radius: 50%;
    display: flex;
    transition:
        color var(--dur-fast) var(--ease-out),
        background-color var(--dur-fast) var(--ease-out),
        transform var(--dur-fast) var(--ease-spring);
}

.poll-modal__close:hover {
    color: var(--bone-50);
    background: var(--surface-tint-hover);
    transform: scale(1.1);
}

.poll-modal__close:active {
    transform: scale(0.92);
}

.poll-modal__question {
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--bone-50);
    margin-bottom: var(--s-4);
    text-align: center;
    line-height: 1.4;
}

.poll-modal__options {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
}

.poll-modal__option {
    padding: var(--s-2) var(--s-4);
    background: var(--surface-tint);
    border: 1px solid var(--rule);
    border-radius: var(--r-pill);
    color: var(--bone-200);
    font-family: var(--font-ui);
    font-size: var(--fs-sm);
    font-weight: 600;
    cursor: pointer;
    transition:
        background-color var(--dur-fast) var(--ease-out),
        border-color var(--dur-fast) var(--ease-out),
        color var(--dur-fast) var(--ease-out),
        transform var(--dur-fast) var(--ease-spring),
        box-shadow var(--dur-fast) var(--ease-out);
    text-align: center;
}

.poll-modal__option:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--ember);
    color: var(--bone-50);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(255, 255, 255, 0.2);
}

.poll-modal__option:active:not(:disabled) {
    transform: translateY(0) scale(0.98);
}

.poll-modal__option:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.poll-modal__later {
    display: block;
    margin: var(--s-3) auto 0;
    background: none;
    border: none;
    color: var(--bone-400);
    font-family: var(--font-ui);
    font-size: var(--fs-xs);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
    transition:
        color var(--dur-fast) var(--ease-out),
        transform var(--dur-fast) var(--ease-out);
}

.poll-modal__later:hover {
    color: var(--bone-50);
    transform: translateY(-1px);
}
</style>
