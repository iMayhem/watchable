<template>
    <div class="status-page">
        <SiteHeader />

        <main id="main" class="status-page__main" role="main">
            <section class="status-page__masthead container-lm">
                <p class="eyebrow status-page__eyebrow">Realtime Infrastructure Status</p>
                <h1 class="status-page__title display" data-reveal>AI Processing Core Cluster</h1>
                <p class="status-page__subtitle">
                    Monitor active semantic inference nodes, realtime processing rate-limits, failover status, and computational quotas.
                </p>
            </section>

            <div class="status-page__content container-lm">
                <div class="status-actions">
                    <button class="status-refresh-btn" @click="fetchStatus" :disabled="loading">
                        <span class="refresh-icon" :class="{ 'is-loading': loading }">🔄</span>
                        <span>{{ loading ? 'Updating Stats...' : 'Refresh Status' }}</span>
                    </button>
                </div>

                <div v-if="error" class="status-error">
                    <span>⚠️</span>
                    <p>{{ error }}</p>
                </div>

                <div class="keys-grid">
                    <div v-for="(stat, idx) in slots" :key="idx" class="status-card" :class="stat.status">
                        <div class="status-card__header">
                            <div class="status-card__title-group">
                                <span class="status-card__slot-badge">Slot {{ idx + 1 }}</span>
                                <h2 class="status-card__title">{{ maskKey(stat.rawKey) }}</h2>
                            </div>
                            <span class="status-badge" :class="stat.status">
                                {{ formatStatus(stat.status) }}
                            </span>
                        </div>

                        <div class="status-card__body">
                            <div class="stat-metrics">
                                <div class="metric-box">
                                    <span class="metric-label">Total Queries</span>
                                    <span class="metric-value">{{ stat.requests_count || 0 }}</span>
                                </div>
                                <div class="metric-box">
                                    <span class="metric-label">Quota Limit</span>
                                    <span class="metric-value">{{ stat.limit_requests !== null ? stat.limit_requests : 'N/A' }}</span>
                                </div>
                                <div class="metric-box">
                                    <span class="metric-label">Remaining</span>
                                    <span class="metric-value" :class="{ 'warning-text': stat.remaining_requests !== null && stat.remaining_requests < 10 }">
                                        {{ stat.remaining_requests !== null ? stat.remaining_requests : 'N/A' }}
                                    </span>
                                </div>
                                <div class="metric-box">
                                    <span class="metric-label">Reset In</span>
                                    <span class="metric-value font-mono">{{ stat.reset_time_seconds || 'N/A' }}</span>
                                </div>
                            </div>

                            <div class="meta-rows">
                                <div class="meta-row">
                                    <span class="meta-label">Last Activity</span>
                                    <span class="meta-value">{{ formatTime(stat.last_used) }}</span>
                                </div>
                                <div v-if="stat.error_message" class="meta-row error-row">
                                    <span class="meta-label">Last Error</span>
                                    <span class="meta-value error-text">{{ stat.error_message }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from 'vue';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import { getSupabaseClient } from '../lib/supabase';
import { useSeo } from '../composables/useSeo';

interface KeyStat {
    key_index: number;
    status: 'active' | 'quota_exceeded' | 'rate_limited' | 'invalid' | 'unknown';
    requests_count: number;
    error_message: string;
    remaining_requests: number | null;
    limit_requests: number | null;
    reset_time_seconds: string | null;
    last_used: string | null;
    rawKey?: string;
}

export default defineComponent({
    name: 'Status',
    components: { SiteHeader, SiteFooter },
    setup() {
        const { updateSeo } = useSeo();
        const loading = ref(false);
        const error = ref('');
        const slots = ref<KeyStat[]>([]);

        const fetchStatus = async () => {
            loading.value = true;
            error.value = '';
            try {
                const supabase = await getSupabaseClient();
                
                // Fetch the actual keys
                const { data: keysData } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'groq_keys')
                    .single();

                let keysList: string[] = [];
                if (keysData && keysData.value) {
                    try {
                        keysList = JSON.parse(keysData.value);
                    } catch {}
                }

                // Fetch their statistics
                const { data: statusData } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'groq_keys_status')
                    .single();

                let stats: KeyStat[] = [];
                if (statusData && statusData.value) {
                    try {
                        stats = JSON.parse(statusData.value);
                    } catch {}
                }

                // Initialize 3 slots
                const populatedSlots: KeyStat[] = [];
                for (let i = 0; i < 3; i++) {
                    const rawKey = keysList[i] || '';
                    const existingStat = stats.find(s => s.key_index === i) || {
                        key_index: i,
                        status: rawKey ? 'unknown' : 'invalid',
                        requests_count: 0,
                        error_message: rawKey ? '' : 'No key configured in this slot.',
                        remaining_requests: null,
                        limit_requests: null,
                        reset_time_seconds: null,
                        last_used: null
                    };
                    
                    populatedSlots.push({
                        ...existingStat,
                        status: rawKey ? (existingStat.status === 'invalid' ? 'unknown' : existingStat.status) : 'invalid',
                        rawKey
                    });
                }

                slots.value = populatedSlots;
            } catch (err: any) {
                console.error('[STATUS] Error loading status details:', err);
                error.value = err.message || 'Failed to fetch cluster status from database.';
            } finally {
                loading.value = false;
            }
        };

        const maskKey = (key?: string) => {
            if (!key) return 'Slot Empty';
            return `AI-NODE-${String(key).slice(-4).toUpperCase()}`;
        };

        const formatStatus = (status: string) => {
            switch (status) {
                case 'active': return '● Active';
                case 'quota_exceeded': return '▲ Quota Exceeded';
                case 'rate_limited': return '⌛ Rate Limited';
                case 'invalid': return '○ Inactive';
                default: return '⊖ Unknown';
            }
        };

        const formatTime = (isoString?: string | null) => {
            if (!isoString) return 'Never';
            try {
                const date = new Date(isoString);
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + date.toLocaleDateString();
            } catch {
                return 'Never';
            }
        };

        onMounted(() => {
            updateSeo({
                title: 'Infrastructure Cluster Status — Moovie',
                description: 'Realtime node failover stats, response rates and quota status for computational inference keys.',
                canonical: 'https://moovie.fun/status'
            });
            fetchStatus();
        });

        return {
            loading,
            error,
            slots,
            fetchStatus,
            maskKey,
            formatStatus,
            formatTime
        };
    }
});
</script>

<style lang="scss" scoped>
.status-page {
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
    }

    &__subtitle {
        margin: var(--s-4) 0 0;
        color: var(--bone-300);
        font-family: var(--font-ui);
        line-height: 1.55;
        max-width: 58ch;
    }
}

.status-actions {
    display: flex;
    justify-content: flex-end;
    margin-bottom: var(--s-6);
}

.status-refresh-btn {
    background: var(--ink-850);
    border: 1px solid var(--rule-strong);
    color: var(--bone-100);
    padding: var(--s-2) var(--s-4);
    border-radius: var(--r-pill);
    display: inline-flex;
    align-items: center;
    gap: var(--s-2);
    font-family: var(--font-ui);
    font-weight: 600;
    font-size: var(--fs-sm);
    cursor: pointer;
    transition: all var(--dur-fast) var(--ease-out);

    &:hover:not(:disabled) {
        background: var(--ink-800);
        border-color: var(--bone-600);
        color: var(--bone-50);
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
}

.refresh-icon {
    display: inline-block;
    transition: transform 0.5s ease;
    
    &.is-loading {
        animation: spin 1s infinite linear;
    }
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.status-error {
    background: rgba(220, 38, 38, 0.1);
    border: 1px solid rgba(220, 38, 38, 0.3);
    border-radius: var(--r-md);
    padding: var(--s-4);
    display: flex;
    align-items: center;
    gap: var(--s-3);
    margin-bottom: var(--s-6);
    color: var(--bone-200);
    font-family: var(--font-ui);
    font-size: var(--fs-sm);

    p { margin: 0; }
}

.keys-grid {
    display: grid;
    gap: var(--s-6);
    grid-template-columns: 1fr;

    @media (min-width: 992px) {
        grid-template-columns: repeat(3, 1fr);
    }
}

.status-card {
    background: var(--surface-tint);
    border: 1px solid var(--rule);
    border-radius: var(--r-md);
    padding: var(--s-5);
    display: flex;
    flex-direction: column;
    gap: var(--s-4);
    transition: border-color var(--dur-fast) var(--ease-out);

    &.active {
        border-top: 4px solid #10b981;
    }
    &.rate_limited {
        border-top: 4px solid #f59e0b;
    }
    &.quota_exceeded {
        border-top: 4px solid #ef4444;
    }
    &.invalid {
        border-top: 4px solid var(--rule-strong);
        opacity: 0.75;
    }
    &.unknown {
        border-top: 4px solid #6b7280;
    }

    &__header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 1px solid var(--rule);
        padding-bottom: var(--s-3);
    }

    &__slot-badge {
        font-family: var(--font-mono);
        font-size: 0.65rem;
        background: rgba(255,255,255,0.06);
        color: var(--bone-400);
        padding: 0.15rem 0.4rem;
        border-radius: 3px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        display: inline-block;
        margin-bottom: 0.25rem;
    }

    &__title {
        font-family: var(--font-mono);
        font-size: 0.85rem;
        color: var(--bone-50);
        margin: 0;
    }

    &__body {
        display: flex;
        flex-direction: column;
        gap: var(--s-4);
    }
}

.status-badge {
    font-family: var(--font-ui);
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    border-radius: var(--r-pill);
    text-transform: uppercase;
    letter-spacing: 0.02em;

    &.active {
        background: rgba(16, 185, 129, 0.15);
        color: #10b981;
    }
    &.rate_limited {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
    }
    &.quota_exceeded {
        background: rgba(239, 68, 68, 0.15);
        color: #ef4444;
    }
    &.invalid {
        background: rgba(255,255,255,0.05);
        color: var(--bone-400);
    }
    &.unknown {
        background: rgba(107, 114, 128, 0.15);
        color: #9ca3af;
    }
}

.stat-metrics {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--s-3);
}

.metric-box {
    background: rgba(255,255,255,0.02);
    border: 1px solid var(--rule);
    border-radius: var(--r-sm);
    padding: var(--s-3);
    display: flex;
    flex-direction: column;
    gap: 0.15rem;

    .metric-label {
        font-family: var(--font-ui);
        font-size: 0.65rem;
        color: var(--bone-400);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .metric-value {
        font-family: var(--font-mono);
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--bone-100);

        &.warning-text {
            color: #ef4444;
        }
    }
}

.meta-rows {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    border-top: 1px solid var(--rule);
    padding-top: var(--s-3);
}

.meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;

    &.error-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.2rem;
    }

    .meta-label {
        color: var(--bone-450);
        font-family: var(--font-ui);
    }

    .meta-value {
        color: var(--bone-200);
        font-family: var(--font-ui);
    }

    .error-text {
        color: #ef4444;
        font-family: var(--font-mono);
        font-size: 0.7rem;
        word-break: break-all;
        background: rgba(239, 68, 68, 0.05);
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        width: 100%;
    }
}
</style>
