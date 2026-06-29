<template>
    <div v-if="isOpen" class="donation-modal" role="dialog" aria-modal="true" @click.self="close">
        <div class="donation-modal__card">
            <header class="donation-modal__header">
                <span class="donation-modal__headline">Help upgrading servers</span>
                <button type="button" class="donation-modal__close" @click="close" aria-label="Close modal">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>
            </header>

            <div class="donation-modal__body">
                <p class="donation-modal__subtitle">
                    I can survive on a $1 instant noodle... but the server can't. Even a few bucks helps me keep this thing running on a decent VPS. 🍜
                </p>

                <div class="donation-modal__addresses">
                    <div class="donation-modal__row donation-modal__row--featured">
                        <div class="donation-modal__row-head">
                            <span class="donation-modal__coin">USDT (TRC20 / TRON)</span>
                            <span class="donation-modal__badge">⭐ Recommended</span>
                        </div>
                        <div class="donation-modal__addr-row">
                            <code class="donation-modal__addr">TKfaywHdffM1iYdiSP3xFPajxgXwq2jmDG</code>
                            <div class="donation-modal__actions">
                                <button type="button" class="donation-modal__action-btn" @click="showQr('usdt')" title="Show QR code">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                                </button>
                                <button type="button" class="donation-modal__action-btn donation-modal__action-btn--copy" @click="copy('usdt')" :title="copied === 'usdt' ? 'Copied!' : 'Copy address'">
                                    <svg v-if="copied !== 'usdt'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                </button>
                            </div>
                        </div>
                        <p class="donation-modal__warning">Only send USDT via the TRON (TRC20) network.</p>
                    </div>
                    <div class="donation-modal__row">
                        <span class="donation-modal__coin">BTC</span>
                        <div class="donation-modal__addr-row">
                            <code class="donation-modal__addr">bc1qkk0yyu8efu2gep5y59ev7s4j0wxnpxsfh4ympk</code>
                            <div class="donation-modal__actions">
                                <button type="button" class="donation-modal__action-btn" @click="showQr('btc')" title="Show QR code">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                                </button>
                                <button type="button" class="donation-modal__action-btn donation-modal__action-btn--copy" @click="copy('btc')" :title="copied === 'btc' ? 'Copied!' : 'Copy address'">
                                    <svg v-if="copied !== 'btc'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                </button>
                            </div>
                        </div>
                        <p class="donation-modal__warning">Only send BTC via the Bitcoin network.</p>
                    </div>
                    <div class="donation-modal__row">
                        <span class="donation-modal__coin">LTC</span>
                        <div class="donation-modal__addr-row">
                            <code class="donation-modal__addr">ltc1qpnurrqnv466wa4uh6urh0ul5n4wu0rf8k5l25z</code>
                            <div class="donation-modal__actions">
                                <button type="button" class="donation-modal__action-btn" @click="showQr('ltc')" title="Show QR code">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                                </button>
                                <button type="button" class="donation-modal__action-btn donation-modal__action-btn--copy" @click="copy('ltc')" :title="copied === 'ltc' ? 'Copied!' : 'Copy address'">
                                    <svg v-if="copied !== 'ltc'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                </button>
                            </div>
                        </div>
                        <p class="donation-modal__warning">Only send LTC via the Litecoin network.</p>
                    </div>
                </div>
            </div>

            <Teleport to="body">
                <div v-if="qrId" class="donation-qr-overlay" @click.self="qrId = null">
                    <div class="donation-qr-card">
                        <button type="button" class="donation-qr__close" @click="qrId = null">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                        <img :src="`/${qrId.toUpperCase()}.png`" :alt="`${qrId} QR code`" class="donation-qr__img" />
                        <p class="donation-qr__label">{{ qrLabels[qrId] }}</p>
                    </div>
                </div>
            </Teleport>


        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { useToast } from '../../composables/useToast';

const ADDRESSES: Record<string, string> = {
    usdt: 'TKfaywHdffM1iYdiSP3xFPajxgXwq2jmDG',
    btc: 'bc1qkk0yyu8efu2gep5y59ev7s4j0wxnpxsfh4ympk',
    ltc: 'ltc1qpnurrqnv466wa4uh6urh0ul5n4wu0rf8k5l25z'
};

const LABELS: Record<string, string> = {
    usdt: 'USDT',
    btc: 'BTC',
    ltc: 'LTC'
};

export default defineComponent({
    name: 'DonationModal',
    props: {
        isOpen: {
            type: Boolean,
            required: true
        }
    },
    emits: ['close'],
    setup(_props, { emit }) {
        const { addToast } = useToast();
        const copied = ref<string | null>(null);
        const qrId = ref<string | null>(null);
        const qrLabels: Record<string, string> = {
            usdt: 'USDT (TRC20 / TRON)',
            btc: 'Bitcoin (BTC)',
            ltc: 'Litecoin (LTC)'
        };

        const close = () => {
            emit('close');
        };

        const showQr = (id: string) => {
            qrId.value = id;
        };

        const copy = async (id: string) => {
            try {
                await navigator.clipboard.writeText(ADDRESSES[id]);
                copied.value = id;
                addToast(`${LABELS[id]} address copied`, 'success', 2000);
                setTimeout(() => {
                    if (copied.value === id) copied.value = null;
                }, 2000);
            } catch {
                // fallback
                const ta = document.createElement('textarea');
                ta.value = ADDRESSES[id];
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                copied.value = id;
                addToast(`${LABELS[id]} address copied`, 'success', 2000);
                setTimeout(() => {
                    if (copied.value === id) copied.value = null;
                }, 2000);
            }
        };

        return {
            copied,
            qrId,
            qrLabels,
            close,
            showQr,
            copy
        };
    }
});
</script>

<style scoped>
.donation-modal {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(11, 10, 8, 0.72);
    backdrop-filter: blur(4px);
    padding: var(--s-4);
}

.donation-modal__card {
    width: 100%;
    max-width: 440px;
    background: var(--ink-800);
    border: 1px solid var(--rule-strong);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
}

.donation-modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--s-3) var(--s-3) 0;
}

.donation-modal__headline {
    font-family: var(--font-display);
    font-size: var(--fs-lg);
    font-weight: 700;
    color: var(--bone-50);
}

.donation-modal__title {
    font-family: var(--font-display);
    font-size: var(--fs-lg);
    font-weight: 700;
    color: var(--bone-50);
    margin: 0 0 var(--s-1);
}

.donation-modal__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: none;
    border: 1px solid var(--rule);
    border-radius: var(--r-pill);
    color: var(--bone-400);
    cursor: pointer;
    transition: color var(--dur-fast), border-color var(--dur-fast);
}

.donation-modal__close:hover {
    color: var(--bone-50);
    border-color: var(--rule-strong);
}

.donation-modal__close svg {
    width: 16px;
    height: 16px;
}

.donation-modal__body {
    padding: var(--s-4);
}

.donation-modal__subtitle {
    font-size: var(--fs-sm);
    color: var(--bone-100);
    line-height: var(--lh-base);
    margin: 0 0 var(--s-3);
    font-weight: 500;
}

.donation-modal__desc {
    font-size: var(--fs-xs);
    color: var(--bone-400);
    line-height: var(--lh-base);
    margin: 0 0 var(--s-4);
}

.donation-modal__addresses {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
}

.donation-modal__row {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    padding: var(--s-3);
    background: var(--ink-700);
    border-radius: var(--r-md);
}

.donation-modal__row--featured {
    background: rgba(255, 90, 31, 0.06);
    border: 1px solid rgba(255, 90, 31, 0.2);
}

.donation-modal__row-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
}

.donation-modal__coin {
    flex-shrink: 0;
    font-family: var(--font-ui);
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--ember);
}

.donation-modal__badge {
    font-family: var(--font-ui);
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 2px 6px;
    color: var(--ember);
    border-radius: 4px;
}

.donation-modal__addr-row {
    display: flex;
    align-items: center;
    gap: var(--s-2);
}

.donation-modal__addr {
    flex: 1;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--bone-200);
    word-break: break-all;
    background: none;
    padding: 0;
}

.donation-modal__actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}

.donation-modal__action-btn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: var(--surface-tint);
    border: 1px solid var(--rule);
    border-radius: var(--r-md);
    color: var(--bone-400);
    cursor: pointer;
    transition: color var(--dur-fast), border-color var(--dur-fast), background-color var(--dur-fast);
}

.donation-modal__action-btn:hover {
    color: var(--bone-50);
    border-color: var(--rule-strong);
    background: var(--surface-tint-hover);
}

.donation-modal__action-btn svg {
    width: 14px;
    height: 14px;
}

.donation-modal__action-btn--copy svg {
    width: 13px;
    height: 13px;
}

/* QR lightbox */
.donation-qr-overlay {
    position: fixed;
    inset: 0;
    z-index: 11000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(11, 10, 8, 0.8);
    backdrop-filter: blur(8px);
    padding: var(--s-4);
}

.donation-qr-card {
    position: relative;
    background: var(--ink-800);
    border: 1px solid var(--rule-strong);
    border-radius: var(--r-lg);
    padding: var(--s-5);
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--s-3);
}

.donation-qr__close {
    position: absolute;
    top: var(--s-2);
    right: var(--s-2);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: var(--surface-tint);
    border: 1px solid var(--rule);
    border-radius: var(--r-pill);
    color: var(--bone-400);
    cursor: pointer;
    transition: color var(--dur-fast), border-color var(--dur-fast);
}

.donation-qr__close:hover {
    color: var(--bone-50);
    border-color: var(--rule-strong);
}

.donation-qr__close svg {
    width: 14px;
    height: 14px;
}

.donation-qr__img {
    width: 200px;
    height: 200px;
    border-radius: var(--r-md);
    object-fit: contain;
}

.donation-qr__label {
    font-family: var(--font-ui);
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--bone-200);
    margin: 0;
}

.donation-modal__warning {
    margin: 0;
    font-size: 0.65rem;
    color: var(--warn);
    line-height: 1.4;
}

.donation-modal__footer {
    padding: 0 var(--s-4) var(--s-4);
    display: flex;
    justify-content: flex-end;
}

.donation-modal__btn {
    padding: var(--s-2) var(--s-4);
    border: none;
    border-radius: var(--r-md);
    font-family: var(--font-ui);
    font-size: var(--fs-sm);
    font-weight: 600;
    cursor: pointer;
    transition: background-color var(--dur-fast);
}

.donation-modal__btn--close {
    background: var(--surface-tint-hover);
    color: var(--bone-200);
}

.donation-modal__btn--close:hover {
    background: var(--ink-600);
    color: var(--bone-50);
}
</style>
