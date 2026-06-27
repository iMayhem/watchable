<template>
    <MobileShell>
        <div class="m-more">
            <header class="m-more__head">
                <p class="eyebrow">Explore</p>
                <h1 class="m-more__title">More</h1>
            </header>

            <nav class="m-more__grid" aria-label="More destinations">
                <router-link
                    v-for="item in links"
                    :key="item.to"
                    :to="item.to"
                    class="m-more__card"
                >
                    <span class="m-more__icon" aria-hidden="true">
                        <component :is="item.icon" />
                    </span>
                    <span class="m-more__copy">
                        <span class="m-more__label">
                            {{ item.label }}
                            <span v-if="item.label === 'Status'" class="m-more__new-badge">NEW</span>
                        </span>
                        <span class="m-more__desc meta">{{ item.desc }}</span>
                    </span>
                    <svg class="m-more__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="m9 18 6-6-6-6" />
                    </svg>
                </router-link>
            </nav>
        </div>
    </MobileShell>
</template>

<script lang="ts" setup>
import { defineComponent, h } from 'vue';
import MobileShell from '../layout/MobileShell.vue';
import { useAppPaths } from '@/composables/useAppPaths';

const { actors, discuss, upcoming, party, help, watchlist, liveTv } = useAppPaths();

const iconCast = defineComponent({
    render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, [
        h('circle', { cx: '9', cy: '8', r: '3.5' }),
        h('path', { d: 'M3.5 20c.6-3 2.8-5 5.5-5s4.9 2 5.5 5' }),
        h('circle', { cx: '17.5', cy: '9', r: '2.5' }),
        h('path', { d: 'M15 20c.4-2 1.6-3.5 3.5-3.5' })
    ])
});

const iconDiscuss = defineComponent({
    render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, [
        h('path', { d: 'M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' })
    ])
});

const iconUpcoming = defineComponent({
    render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, [
        h('rect', { x: '3', y: '4', width: '18', height: '18', rx: '2' }),
        h('path', { d: 'M16 2v4M8 2v4M3 10h18' })
    ])
});

const iconParty = defineComponent({
    render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, [
        h('path', { d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' }),
        h('circle', { cx: '9', cy: '7', r: '4' }),
        h('path', { d: 'M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' })
    ])
});

const iconHelp = defineComponent({
    render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, [
        h('circle', { cx: '12', cy: '12', r: '10' }),
        h('path', { d: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3' }),
        h('circle', { cx: '12', cy: '17', r: '0.5', fill: 'currentColor', stroke: 'none' })
    ])
});

const iconStatus = defineComponent({
    render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, [
        h('path', { d: 'M22 12h-4l-3 9L9 3l-3 9H2' })
    ])
});

const iconWatchlist = defineComponent({
    render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, [
        h('path', { d: 'M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z' })
    ])
});

const iconLiveTv = defineComponent({
    render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, [
        h('rect', { x: '2', y: '7', width: '20', height: '13', rx: '2', ry: '2' }),
        h('path', { d: 'm17 2-5 5-5-5' })
    ])
});

const links = [
    { to: actors.value, label: 'Cast', desc: 'Browse actors and filmographies', icon: iconCast },
    { to: discuss.value, label: 'Discuss', desc: 'Lounge chat and title reviews', icon: iconDiscuss },
    { to: upcoming.value, label: 'Upcoming', desc: 'Movies and anime on the horizon', icon: iconUpcoming },
    { to: party.value, label: 'Together', desc: 'Watch parties with friends', icon: iconParty },
    { to: watchlist.value, label: 'Watchlist', desc: 'Saved titles across devices', icon: iconWatchlist },
    { to: liveTv.value, label: 'Live TV', desc: 'Free IPTV channels from around the world', icon: iconLiveTv },
    { to: help.value, label: 'Help', desc: 'Playback tips and shortcuts', icon: iconHelp },
    { to: '/status', label: 'Status', desc: 'Realtime node failover and rate limits', icon: iconStatus }
];
</script>

<style lang="scss" scoped>
.m-more {
    padding: var(--s-4) var(--s-4) var(--s-8);

    &__head {
        margin-bottom: var(--s-5);
    }

    &__title {
        margin: var(--s-1) 0 0;
        font-family: var(--font-display);
        font-size: 1.6rem;
    }

    &__grid {
        display: grid;
        gap: var(--s-3);
    }

    &__card {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: var(--s-3);
        min-height: 3.5rem;
        padding: var(--s-3) var(--s-4);
        border-radius: var(--r-md);
        border: 1px solid var(--rule);
        background: var(--ink-850);
        color: inherit;
        text-decoration: none;
        transition: border-color var(--dur-fast) var(--ease-out);

        &:active {
            border-color: var(--ember);
        }
    }

    &__icon {
        display: grid;
        place-items: center;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: var(--r-pill);
        background: rgba(232, 122, 58, 0.12);
        color: var(--ember);

        svg {
            width: 1.15rem;
            height: 1.15rem;
        }
    }

    &__copy {
        display: grid;
        gap: 0.15rem;
        min-width: 0;
    }

    &__label {
        font-family: var(--font-ui);
        font-size: 0.95rem;
        font-weight: 600;
        display: flex;
        align-items: center;
    }

    &__new-badge {
        background: var(--ember);
        color: var(--ink-950) !important;
        font-size: 0.55rem;
        font-weight: 850;
        padding: 0.1rem 0.3rem;
        border-radius: 3px;
        margin-left: 0.25rem;
        letter-spacing: 0.05em;
        line-height: 1;
        display: inline-block;
    }

    &__desc {
        font-size: 0.78rem;
        line-height: 1.35;
    }

    &__chevron {
        width: 1rem;
        height: 1rem;
        color: var(--bone-400);
    }
}
</style>