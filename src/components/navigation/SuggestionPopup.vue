<template>
    <Teleport to="body">
        <div v-if="show" class="suggestion-overlay" @click.self="handleDismiss">
            <div class="suggestion-modal">
                <button type="button" class="suggestion-modal__close" @click="handleDismiss" aria-label="Dismiss">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                <div class="suggestion-modal__prompt">{{ activeSuggestion?.prompt }}</div>

                <template v-if="!submitted">
                    <textarea
                        v-model="text"
                        class="suggestion-modal__textarea"
                        :placeholder="activeSuggestion?.placeholder || 'Write your feedback here…'"
                        :maxlength="activeSuggestion?.max_length || 500"
                        rows="4"
                    />
                    <div class="suggestion-modal__charcount">
                        {{ text.length }} / {{ activeSuggestion?.max_length || 500 }}
                    </div>
                    <div class="suggestion-modal__actions">
                        <button
                            type="button"
                            class="suggestion-modal__submit"
                            :disabled="submitting || text.trim().length === 0"
                            @click="handleSubmit"
                        >
                            {{ submitting ? 'Sending…' : 'Send' }}
                        </button>
                        <button type="button" class="suggestion-modal__later" @click="handleDismiss">
                            Maybe later
                        </button>
                    </div>
                </template>

                <div v-else class="suggestion-modal__thanks">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" style="color: var(--ember)">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <p>Thanks for your feedback!</p>
                    <button type="button" class="suggestion-modal__later" @click="handleDismiss">Close</button>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useSuggestions } from '../../composables/useSuggestions'

const { activeSuggestion, submitting, fetchActiveSuggestion, submitResponse, hasSubmitted, hasDismissed, dismiss } = useSuggestions()

const show = ref(false)
const submitted = ref(false)
const text = ref('')

async function checkSuggestion() {
    await fetchActiveSuggestion()
    if (!activeSuggestion.value) return
    if (!activeSuggestion.value.is_active) return
    const id = activeSuggestion.value.id
    if (hasSubmitted(id) || hasDismissed(id)) return
    show.value = true
}

async function handleSubmit() {
    if (!activeSuggestion.value || !text.value.trim()) return
    const ok = await submitResponse(activeSuggestion.value.id, text.value)
    if (ok) {
        submitted.value = true
    }
}

function handleDismiss() {
    if (activeSuggestion.value) {
        dismiss(activeSuggestion.value.id)
    }
    show.value = false
}

onMounted(() => {
    checkSuggestion()
})
</script>

<style scoped>
.suggestion-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--s-4);
    animation: suggestion-fade-in 0.2s ease-out;
}

@keyframes suggestion-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
}

.suggestion-modal {
    background: var(--ink-800);
    border: 1px solid var(--rule);
    border-radius: var(--r-lg);
    padding: var(--s-6);
    max-width: 440px;
    width: 100%;
    position: relative;
    animation: suggestion-slide-up 0.25s ease-out;
}

@keyframes suggestion-slide-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
}

.suggestion-modal__close {
    position: absolute;
    top: var(--s-2);
    right: var(--s-2);
    background: none;
    border: none;
    color: var(--bone-400);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--r-xs);
    display: flex;
    transition: color var(--dur-fast);
}

.suggestion-modal__close:hover {
    color: var(--bone-50);
}

.suggestion-modal__prompt {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--bone-50);
    margin-bottom: var(--s-4);
    text-align: center;
    line-height: 1.4;
}

.suggestion-modal__textarea {
    width: 100%;
    background: var(--ink-900, #0d1117);
    border: 1px solid var(--rule);
    border-radius: var(--r-md);
    color: var(--bone-100);
    font-family: var(--font-ui);
    font-size: var(--fs-sm);
    padding: var(--s-3);
    resize: vertical;
    min-height: 100px;
    transition: border-color var(--dur-fast);
}

.suggestion-modal__textarea:focus {
    outline: none;
    border-color: var(--ember);
}

.suggestion-modal__charcount {
    text-align: right;
    font-size: var(--fs-xs);
    color: var(--bone-400);
    margin-top: var(--s-1);
    margin-bottom: var(--s-3);
}

.suggestion-modal__actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--s-2);
}

.suggestion-modal__submit {
    width: 100%;
    padding: var(--s-2) var(--s-4);
    background: var(--ember);
    border: 1px solid var(--ember);
    border-radius: var(--r-pill);
    color: var(--bone-50);
    font-family: var(--font-ui);
    font-size: var(--fs-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--dur-fast);
}

.suggestion-modal__submit:hover:not(:disabled) {
    opacity: 0.85;
}

.suggestion-modal__submit:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.suggestion-modal__later {
    background: none;
    border: none;
    color: var(--bone-400);
    font-family: var(--font-ui);
    font-size: var(--fs-xs);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color var(--dur-fast);
}

.suggestion-modal__later:hover {
    color: var(--bone-50);
}

.suggestion-modal__thanks {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--s-3);
    padding: var(--s-4) 0;
    text-align: center;
}

.suggestion-modal__thanks p {
    color: var(--bone-100);
    font-family: var(--font-ui);
    font-size: var(--fs-base);
    font-weight: 600;
}
</style>
