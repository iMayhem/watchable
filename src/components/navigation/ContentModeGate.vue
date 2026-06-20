<template>
    <div
        v-if="visible"
        class="mode-gate"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mode-gate-title"
        aria-describedby="mode-gate-desc"
    >
        <span class="mode-gate__bloom" aria-hidden="true" />
        <span class="mode-gate__grain grain" aria-hidden="true" />

        <div class="mode-gate__layout container-lm">
            <header class="mode-gate__intro">
                <router-link to="/" class="mode-gate__brand" aria-label="moovie home" tabindex="-1">
                    <span class="mode-gate__wordmark">moovie</span>
                </router-link>

                <p class="eyebrow mode-gate__eyebrow">First visit · pick your edition</p>

                <h1 id="mode-gate-title" class="mode-gate__title display">
                    Two ways to <em class="mode-gate__title-em">watch.</em>
                </h1>

                <p id="mode-gate-desc" class="mode-gate__lede">
                    Pick a catalogue to start. Swap anytime from the header.
                </p>

                <p class="meta mode-gate__stamp">
                    <span aria-hidden="true">●</span>
                    Saved on this device · header toggle
                </p>
            </header>

            <div class="mode-gate__choices" role="group" aria-label="Choose catalogue">
                <button
                    type="button"
                    class="mode-gate__card mode-gate__card--netflix"
                    @click="choose('netflix')"
                >
                    <span class="mode-gate__card-accent" aria-hidden="true" />

                    <span class="mode-gate__card-head">
                        <span class="mode-gate__card-kicker">Stream</span>
                        <span class="mode-gate__card-title-row">
                            <span class="mode-gate__card-title">Netflix catalogue</span>
                            <span class="mode-gate__card-badge">Extension needed</span>
                        </span>
                    </span>

                    <p class="mode-gate__card-lede">
                        Dubbed films &amp; series in-browser. Install the Moovie extension first.
                    </p>

                    <ul class="mode-gate__features">
                        <li>Extension required for streaming</li>
                        <li>K-drama, Bollywood &amp; Hollywood dubs</li>
                        <li>Episode picker &amp; audio variants</li>
                    </ul>

                    <span class="mode-gate__enter">
                        Enter stream
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                            <path
                                fill="none"
                                stroke="currentColor"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M5 12h14M13 6l6 6-6 6"
                            />
                        </svg>
                    </span>
                </button>

                <button
                    type="button"
                    class="mode-gate__card mode-gate__card--global"
                    @click="choose('global')"
                >
                    <span class="mode-gate__card-accent" aria-hidden="true" />

                    <span class="mode-gate__card-head">
                        <span class="mode-gate__card-kicker">Discover</span>
                        <span class="mode-gate__card-title">Global edition</span>
                    </span>

                    <p class="mode-gate__card-lede">
                        TMDB-powered films, TV, anime, actors, and regional shelves.
                    </p>

                    <ul class="mode-gate__features">
                        <li>Movies, series &amp; anime detail pages</li>
                        <li>Watchlist, search &amp; filmography</li>
                        <li>Editorial rails &amp; critic-style browse</li>
                    </ul>

                    <span class="mode-gate__enter">
                        Enter global
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                            <path
                                fill="none"
                                stroke="currentColor"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M5 12h14M13 6l6 6-6 6"
                            />
                        </svg>
                    </span>
                </button>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import { getContentMode, type ContentMode } from '../../composables/useContentMode';
import { nfDebug } from '../../composables/useNetflixDebug';

export default defineComponent({
    name: 'ContentModeGate',
    setup() {
        const router = useRouter();
        const { contentMode, setContentMode } = getContentMode();

        const visible = computed(
            () => contentMode.value !== 'global' && contentMode.value !== 'netflix'
        );

        const syncBodyScroll = (locked: boolean) => {
            if (typeof document === 'undefined') return;
            document.documentElement.style.overflow = locked ? 'hidden' : '';
            document.body.style.overflow = locked ? 'hidden' : '';
        };

        watch(
            visible,
            (show) => syncBodyScroll(show),
            { immediate: true }
        );

        onBeforeUnmount(() => syncBodyScroll(false));

        const choose = (mode: ContentMode) => {
            nfDebug('gate:choose', { mode });
            setContentMode(mode);
            if (router.currentRoute.value.path !== '/') {
                router.push('/');
            }
        };

        return { visible, choose };
    }
});
</script>

<style lang="scss" scoped>
.mode-gate {
    position: fixed;
    inset: 0;
    z-index: 20000;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: max(var(--s-4), env(safe-area-inset-top)) var(--s-4) max(var(--s-4), env(safe-area-inset-bottom));
    background: var(--ink-900);
    color: var(--bone-50);
    isolation: isolate;
    overflow-y: auto;
    overflow-x: hidden;

    @media (min-width: 768px) {
        padding-inline: var(--s-6);
    }

    &__bloom {
        position: absolute;
        inset: -25% -15%;
        z-index: -2;
        background:
            radial-gradient(ellipse at 18% 12%, rgba(255, 90, 31, 0.2) 0%, transparent 52%),
            radial-gradient(ellipse at 82% 78%, rgba(201, 167, 106, 0.14) 0%, transparent 55%),
            radial-gradient(ellipse at 50% 100%, rgba(229, 9, 20, 0.08) 0%, transparent 48%),
            radial-gradient(ellipse at center, var(--ink-850) 0%, var(--ink-900) 72%);
        filter: blur(24px);
        pointer-events: none;
    }

    &__grain {
        position: absolute;
        inset: 0;
        z-index: -1;
        opacity: 0.45;
        pointer-events: none;
    }

    &__layout {
        width: min(100%, 56rem);
        margin: auto;
        display: grid;
        gap: clamp(var(--s-4), 3vh, var(--s-6));
        animation: modeGateFade var(--dur-slow) var(--ease-out);
    }

    &__intro {
        display: grid;
        gap: clamp(var(--s-2), 2vh, var(--s-3));
        text-align: center;
    }

    &__brand {
        justify-self: center;
        text-decoration: none;
        color: inherit;
    }

    &__wordmark {
        font-family: var(--font-display);
        font-weight: 800;
        font-size: clamp(1.9rem, 6vw, 2.75rem);
        letter-spacing: -0.07em;
        line-height: 0.9;
        text-transform: lowercase;
        background: linear-gradient(135deg, var(--ember) 0%, #ff8a00 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    &__eyebrow {
        color: var(--ember);
        justify-self: center;
    }

    &__title {
        margin: 0;
        font-size: clamp(1.65rem, 5vw, 2.5rem);
        line-height: var(--lh-tight);
        letter-spacing: var(--ls-tight);
        color: var(--bone-50);
    }

    &__title-em {
        font-style: italic;
        color: var(--bone-100);
    }

    &__lede {
        margin: 0 auto;
        max-width: 38ch;
        color: var(--bone-200);
        font-size: var(--fs-sm);
        line-height: var(--lh-base);
        justify-self: center;
    }

    &__stamp {
        margin: 0;
        color: var(--bone-400);
        font-family: var(--font-mono);
        font-size: 0.68rem;
        letter-spacing: var(--ls-micro);
        text-transform: uppercase;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        justify-self: center;

        > span {
            color: var(--ember);
            font-size: 0.6rem;
        }
    }

    &__choices {
        display: grid;
        gap: var(--s-3);
        align-items: stretch;

        @media (min-width: 560px) {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }

    &__card {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: var(--s-2);
        min-width: 0;
        min-height: 0;
        padding: clamp(0.85rem, 2.5vw, 1.15rem);
        border-radius: var(--r-lg);
        border: 1px solid var(--rule);
        background:
            linear-gradient(165deg, rgba(245, 239, 228, 0.05) 0%, transparent 42%),
            var(--ink-800);
        color: var(--bone-50);
        text-align: left;
        cursor: pointer;
        overflow: hidden;
        box-shadow: var(--shadow-md);
        transition:
            transform var(--dur-base) var(--ease-out),
            border-color var(--dur-base) var(--ease-out),
            box-shadow var(--dur-base) var(--ease-out),
            background-color var(--dur-base) var(--ease-out);

        &:hover {
            transform: translateY(-4px);
            border-color: var(--rule-strong);
            box-shadow: var(--shadow-lg);
        }

        &:focus-visible {
            outline: 2px solid var(--ember);
            outline-offset: 3px;
        }

        &--netflix:hover {
            border-color: rgba(229, 9, 20, 0.45);

            .mode-gate__card-accent {
                opacity: 1;
            }

            .mode-gate__enter {
                color: #ff6b6b;
            }
        }

        &--global:hover {
            border-color: rgba(255, 90, 31, 0.5);

            .mode-gate__card-accent {
                opacity: 1;
            }

            .mode-gate__enter {
                color: var(--ember);
            }
        }
    }

    &__card-accent {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        opacity: 0.65;
        transition: opacity var(--dur-base) var(--ease-out);
        pointer-events: none;
    }

    &__card--netflix &__card-accent {
        background: linear-gradient(90deg, #e50914 0%, #ff4d4d 55%, transparent 100%);
    }

    &__card--global &__card-accent {
        background: linear-gradient(90deg, var(--ember) 0%, var(--gold-leaf) 55%, transparent 100%);
    }

    &__card-head {
        display: grid;
        gap: 0.2rem;
    }

    &__card-title-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.45rem;
    }

    &__card-kicker {
        font-family: var(--font-mono);
        font-size: 0.65rem;
        letter-spacing: var(--ls-micro);
        text-transform: uppercase;
        color: var(--bone-400);
    }

    &__card-title {
        font-family: var(--font-display);
        font-size: clamp(1.05rem, 2.4vw, 1.35rem);
        font-weight: 500;
        letter-spacing: var(--ls-tight);
        line-height: var(--lh-snug);
        color: var(--bone-50);
    }

    &__card-badge {
        flex-shrink: 0;
        padding: 0.2rem 0.45rem;
        border-radius: var(--r-pill);
        border: 1px solid rgba(229, 9, 20, 0.45);
        background: rgba(229, 9, 20, 0.14);
        color: #ff8a8a;
        font-family: var(--font-ui);
        font-size: 0.58rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        white-space: nowrap;
    }

    &__card-lede {
        margin: 0;
        color: var(--bone-300);
        font-size: 0.8rem;
        line-height: 1.45;
    }

    &__features {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 0.3rem;
        flex: 1;

        li {
            position: relative;
            padding-left: 0.95rem;
            color: var(--bone-200);
            font-size: 0.78rem;
            line-height: 1.35;

            &::before {
                content: '';
                position: absolute;
                left: 0;
                top: 0.55em;
                width: 0.35rem;
                height: 0.35rem;
                border-radius: 50%;
                background: var(--bone-400);
            }
        }
    }

    &__card--netflix &__features li::before {
        background: rgba(229, 9, 20, 0.85);
    }

    &__card--global &__features li::before {
        background: var(--ember);
    }

    &__enter {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        margin-top: auto;
        padding-top: 0.15rem;
        font-family: var(--font-ui);
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--bone-100);
        transition: color var(--dur-fast) var(--ease-out);

        svg {
            transition: transform var(--dur-fast) var(--ease-out);
        }
    }

    &__card:hover &__enter svg {
        transform: translateX(3px);
    }
}

@keyframes modeGateFade {
    from {
        opacity: 0;
        transform: translateY(16px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@media (prefers-reduced-motion: reduce) {
    .mode-gate__layout {
        animation: none;
    }

    .mode-gate__card:hover {
        transform: none;
    }

    .mode-gate__card:hover .mode-gate__enter svg {
        transform: none;
    }
}
</style>