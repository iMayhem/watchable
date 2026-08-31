<template>
    <footer class="site-footer">
        <div class="container-lm">
            <!-- Masthead / colophon line -->
            <div class="site-footer__masthead">
                <div class="site-footer__logo" aria-hidden="true">
                    <span class="site-footer__wordmark">moovie</span>
                </div>

                <div class="site-footer__issue">
                    <span class="eyebrow">{{ month.toUpperCase() }} {{ year }}</span>
                </div>
            </div>

            <!-- Columns -->
            <div class="site-footer__cols">
                <nav
                    v-for="col in columns"
                    :key="col.title"
                    class="site-footer__col"
                    :aria-label="col.title"
                >
                    <h3 class="eyebrow site-footer__col-title">{{ col.title }}</h3>
                    <ul class="site-footer__list">
                        <li v-for="link in col.links" :key="link.label">
                            <component
                                :is="link.external ? 'a' : 'router-link'"
                                :to="!link.external ? link.href : undefined"
                                :href="link.external ? link.href : undefined"
                                :target="link.external ? '_blank' : undefined"
                                :rel="link.external ? 'noopener noreferrer' : undefined"
                                class="site-footer__link"
                            >
                                {{ link.label }}
                                <span v-if="link.label === 'Status'" class="site-footer__new-badge">NEW</span>
                            </component>
                        </li>
                    </ul>
                </nav>

                <div class="site-footer__col site-footer__col--wide">
                    <h3 class="eyebrow site-footer__col-title">Colophon</h3>
                    <p class="site-footer__colophon">
                        Streaming sources are provided by third-party embeds.
                        Moovie does not host, upload, or store any video
                        content.
                    </p>
                </div>
            </div>

            <hr class="hairline site-footer__rule" />

            <div class="site-footer__meta">
                <span class="meta">&copy; {{ year }} moovie</span>

                <div class="site-footer__social">
                    <!-- Reddit -->
                    <a
                        href="https://www.reddit.com/r/Moovie/"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="site-footer__social-btn site-footer__social-btn--reddit"
                        aria-label="Moovie on Reddit"
                        title="Join r/Moovie on Reddit"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                            <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                        </svg>
                    </a>

                    <!-- Discord -->
                    <a
                        href="https://discord.gg/CYphBERWvD"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="site-footer__social-btn site-footer__social-btn--discord"
                        aria-label="Moovie on Discord"
                        title="Join Moovie on Discord"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.955 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z"/>
                        </svg>
                    </a>

                    <!-- Email / Contact -->
                    <a
                        href="mailto:moovieadmin@proton.me"
                        class="site-footer__social-btn site-footer__social-btn--mail"
                        aria-label="Contact Moovie"
                        title="moovieadmin@proton.me"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="4" width="20" height="16" rx="2" />
                            <path d="m2 7 10 7 10-7" />
                        </svg>
                    </a>
                </div>
            </div>
        </div>
    </footer>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue';

interface FooterLink {
    label: string;
    href: string;
    external?: boolean;
}

interface FooterCol {
    title: string;
    links: FooterLink[];
}

const columns: FooterCol[] = [
    {
        title: 'Browse',
        links: [
            { label: 'Home', href: '/' },
            { label: 'Movies', href: '/movies' },
            { label: 'TV Shows', href: '/tv-shows' },
            { label: 'Actors', href: '/actors' },
            { label: 'Watchlist', href: '/watchlist' }
        ]
    },
    {
        title: 'About',
        links: [
            {
                label: 'Settings',
                href: '/settings',
                external: false
            },
            {
                label: 'Status',
                href: '/status',
                external: false
            }
        ]
    }
];

export default defineComponent({
    name: 'SiteFooter',
    setup() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.toLocaleString('en-US', { month: 'long' });

        // Vol = years since 2024 (launch) + 1; Issue = week of year.
        const launch = 2024;
        const volume = computed(() =>
            String(year - launch + 1).padStart(2, '0')
        );

        const getWeek = (d: Date) => {
            const start = new Date(d.getFullYear(), 0, 1);
            const diff = (d.getTime() - start.getTime()) / 86400000;
            return Math.ceil((diff + start.getDay() + 1) / 7);
        };
        const issue = String(getWeek(now)).padStart(2, '0');

        return { year, month, volume, issue, columns };
    }
});
</script>

<style lang="scss" scoped>
.site-footer {
    position: relative;
    padding: var(--s-10) 0 var(--s-7);
    background: var(--ink-900);
    border-top: 1px solid var(--rule);
    color: var(--bone-200);
    overflow: hidden;

    &::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(
            80% 60% at 10% 0%,
            rgba(255, 255, 255, 0.06) 0%,
            transparent 60%
        );
        pointer-events: none;
    }

    &__masthead {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--s-4);
        margin-bottom: var(--s-6);
        flex-wrap: wrap;
    }

    &__logo {
        display: inline-flex;
        align-items: center;
        gap: var(--s-3);
    }

    &__mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        background: var(--ember);
        color: var(--ink-900);
        border-radius: var(--r-sm);
    }

    &__wordmark {
        font-family: var(--font-display);
        font-weight: 500;
        font-size: var(--fs-xl);
        color: var(--bone-50);
        letter-spacing: var(--ls-tight);
        font-variation-settings: 'opsz' 72;
    }

    &__issue {
        display: inline-flex;
        align-items: center;
        gap: var(--s-2);
        color: var(--bone-300);

        .eyebrow { color: var(--bone-300); }
    }

    &__sep {
        color: var(--bone-500);
    }

    &__statement {
        font-family: var(--font-display);
        font-weight: 400;
        font-size: clamp(var(--fs-3xl), 5vw, var(--fs-5xl));
        line-height: 0.98;
        letter-spacing: -0.025em;
        max-width: 22ch;
        color: var(--bone-50);
        margin: var(--s-5) 0 var(--s-7);
        font-variation-settings: 'opsz' 144, 'SOFT' 30;

        .site-footer__statement-lede {
            display: block;
        }

        .site-footer__statement-body {
            display: block;
            font-size: clamp(var(--fs-lg), 2.2vw, var(--fs-xl));
            color: var(--bone-300);
            max-width: 36ch;
            margin-top: var(--s-4);
            line-height: var(--lh-snug);
            letter-spacing: var(--ls-snug);

            em {
                font-style: italic;
                color: var(--ember);
                font-variation-settings: 'opsz' 144, 'SOFT' 80;
            }
        }
    }

    &__rule {
        margin: var(--s-6) 0 var(--s-6);
    }

    &__cols {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--s-6);

        @media (max-width: 960px) {
            grid-template-columns: repeat(2, 1fr);
        }

        @media (max-width: 560px) {
            grid-template-columns: 1fr;
            gap: var(--s-5);
        }
    }

    &__col {
        &--wide {
            grid-column: span 2;

            @media (max-width: 960px) {
                grid-column: span 2;
            }

            @media (max-width: 560px) {
                grid-column: span 1;
            }
        }
    }

    &__col-title {
        color: var(--bone-300);
        margin-bottom: var(--s-4);
    }

    &__list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: var(--s-2);
    }

    &__link {
        font-family: var(--font-ui);
        font-size: var(--fs-base);
        color: var(--bone-200);
        transition: color var(--dur-fast) var(--ease-out);
        letter-spacing: var(--ls-snug);

        &:hover {
            color: var(--ember);
        }
    }

    &__new-badge {
        background: var(--ember);
        color: var(--ink-950) !important;
        font-size: 0.55rem;
        font-weight: 850;
        padding: 0.1rem 0.3rem;
        border-radius: 3px;
        margin-left: 0.25rem;
        vertical-align: middle;
        letter-spacing: 0.05em;
        display: inline-block;
        line-height: 1;
    }

    &__colophon {
        font-size: var(--fs-sm);
        color: var(--bone-300);
        line-height: var(--lh-base);
        max-width: 56ch;
        margin-bottom: var(--s-3);

        em {
            color: var(--bone-50);
            font-style: italic;
            font-family: var(--font-display);
            font-variation-settings: 'opsz' 144, 'SOFT' 80;
        }
    }

    &__inline-link {
        color: var(--bone-50);
        text-decoration: underline;
        text-decoration-color: var(--rule-strong);
        text-underline-offset: 3px;
        transition: color var(--dur-fast), text-decoration-color var(--dur-fast);

        &:hover {
            color: var(--ember);
            text-decoration-color: var(--ember);
        }
    }

    &__meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-3);
        color: var(--bone-300);
        flex-wrap: wrap;

        a { color: inherit; }
    }

    &__meta-divider {
        width: 3px;
        height: 3px;
        background: var(--bone-500);
        border-radius: 50%;
    }

    &__social {
        display: flex;
        align-items: center;
        gap: var(--s-2);
    }

    &__social-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: var(--r-pill);
        color: var(--bone-400);
        background: var(--surface-tint);
        border: 1px solid var(--rule);
        transition:
            color var(--dur-fast) var(--ease-out),
            background-color var(--dur-fast) var(--ease-out),
            border-color var(--dur-fast) var(--ease-out);

        svg { width: 18px; height: 18px; }

        &--reddit:hover {
            color: #ff4500;
            background: rgba(255, 69, 0, 0.1);
            border-color: rgba(255, 69, 0, 0.3);
        }

        &--mail:hover {
            color: #8b5cf6;
            background: rgba(139, 92, 246, 0.1);
            border-color: rgba(139, 92, 246, 0.3);
        }

        &--discord:hover {
            color: #5865f2;
            background: rgba(88, 101, 242, 0.1);
            border-color: rgba(88, 101, 242, 0.3);
        }
    }
}
</style>
