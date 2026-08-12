<template>
    <div class="help-page">
        <SiteHeader />

        <main id="main" class="help-page__main" role="main">
            <section class="help-page__masthead container-lm">
                <p class="eyebrow help-page__eyebrow">The Manual · Documentation</p>
                <h1 class="help-page__title display" data-reveal>How to use Moovie.</h1>
                <p class="help-page__subtitle">
                    A quick reference guide for streaming, keyboard shortcuts, settings, and watch parties.
                </p>
            </section>

            <div class="help-page__content container-lm">
                <div class="help-grid">
                    <!-- Section: Playback & Media -->
                    <section class="help-card">
                        <div class="help-card__header">
                            <span class="help-card__icon">🎬</span>
                            <h2 class="help-card__title">Playback & Servers</h2>
                        </div>
                        <div class="help-card__body">
                            <p>Moovie indexes media streams from multiple open providers. If a video is buffering or fails to load, you can easily switch servers:</p>
                            <ul>
                                <li><strong>Server:</strong> Moovie is the single playback server. Scraper sources and audio tracks are managed inside the player.</li>
                                <li><strong>Subtitles & Audio:</strong> Click on the settings cog icon inside the video frame to choose audio languages and subtitles. For anime, dub and sub variants are sorted as separate providers in the server list.</li>
                            </ul>
                        </div>
                    </section>

                    <!-- Section: Watch Together (Party) -->
                    <section class="help-card">
                        <div class="help-card__header">
                            <span class="help-card__icon">👥</span>
                            <h2 class="help-card__title">Watch Together Parties</h2>
                        </div>
                        <div class="help-card__body">
                            <p>Synchronize your video playback in real-time with friends and chat while watching:</p>
                            <ul>
                                <li><strong>Start a Room:</strong> Click the "Party" button in the header, input a room name and feature title, and click "Launch Lobby".</li>
                                <li><strong>Invite Friends:</strong> Click the "Invite Friends" button inside the room to copy the invite link to your clipboard.</li>
                                <li><strong>AutoNext & Synchronization:</strong> Hosts have the ability to toggle autoplay on episode completion and trigger synchronizations. If you fall behind, click the sync indicator to catch up.</li>
                            </ul>
                        </div>
                    </section>

                    <!-- Section: Keyboard Shortcuts -->
                    <section class="help-card help-card--wide">
                        <div class="help-card__header">
                            <span class="help-card__icon">⌨️</span>
                            <h2 class="help-card__title">Keyboard Shortcuts</h2>
                        </div>
                        <div class="help-card__body">
                            <p class="meta">Control playback and navigate the interface instantly without using a mouse.</p>
                            
                            <div class="shortcuts-table-wrapper">
                                <table class="shortcuts-table">
                                    <thead>
                                        <tr>
                                            <th>Command</th>
                                            <th>Keybinding</th>
                                            <th>Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td><strong>Search Panel</strong></td>
                                            <td><kbd>Ctrl</kbd> + <kbd>K</kbd> or <kbd>⌘</kbd> + <kbd>K</kbd> / <kbd>/</kbd></td>
                                            <td>Open the search modal from any page</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Play / Pause</strong></td>
                                            <td><kbd>Space</kbd></td>
                                            <td>Toggle video playback inside player</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Skip Backwards</strong></td>
                                            <td><kbd>←</kbd></td>
                                            <td>Rewind 10 seconds</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Skip Forwards</strong></td>
                                            <td><kbd>→</kbd></td>
                                            <td>Fast-forward 10 seconds</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Mute / Unmute</strong></td>
                                            <td><kbd>M</kbd></td>
                                            <td>Toggle audio mute state</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Fullscreen</strong></td>
                                            <td><kbd>F</kbd></td>
                                            <td>Toggle full-screen mode</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Previous Episode</strong></td>
                                            <td><kbd>Ctrl</kbd> + <kbd>←</kbd></td>
                                            <td>Advance to previous episode in series</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Next Episode</strong></td>
                                            <td><kbd>Ctrl</kbd> + <kbd>→</kbd></td>
                                            <td>Advance to next episode in series</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Exit Modal / Panel</strong></td>
                                            <td><kbd>ESC</kbd></td>
                                            <td>Close any active search panel, menu, or dialog</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>

                    <!-- Section: Troubleshooting -->
                    <section class="help-card">
                        <div class="help-card__header">
                            <span class="help-card__icon">🔧</span>
                            <h2 class="help-card__title">Troubleshooting</h2>
                        </div>
                        <div class="help-card__body">
                            <ul>
                                <li><strong>Black Video Player:</strong> Check your browser's ad-blocker extensions or strict tracking protection. Some providers require unblocking dynamic player domains.</li>
                                <li><strong>Desynced Audio/Video:</strong> Pause and resume the video, or refresh the page to force the browser player's buffer to realign.</li>
                                <li><strong>Watch Together Sync Failure:</strong> If video synchronization stalls, the host can toggle pause/play once, which will force a broadcast seek command to all clients.</li>
                            </ul>
                        </div>
                    </section>
                </div>
            </div>
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { defineComponent, onMounted } from 'vue';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import { useSeo } from '../composables/useSeo';

export default defineComponent({
    name: 'Help',
    components: { SiteHeader, SiteFooter },
    setup() {
        const { updateSeo } = useSeo();

        onMounted(() => {
            updateSeo({
                title: 'Help & Documentation — Moovie',
                description: 'Learn how to use Moovie player, shortcuts, custom regional options, and sync lobbies.',
                canonical: 'https://moovie.fun/help'
            });
        });
    }
});
</script>

<style lang="scss" scoped>
.help-page {
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
        font-variation-settings: 'opsz' 144, 'SOFT' 30;
    }

    &__subtitle {
        margin: var(--s-4) 0 0;
        color: var(--bone-300);
        font-family: var(--font-ui);
        line-height: 1.55;
        max-width: 58ch;
    }
}

.help-grid {
    display: grid;
    gap: var(--s-6);
    grid-template-columns: 1fr;

    @media (min-width: 768px) {
        grid-template-columns: repeat(2, 1fr);
    }
}

.help-card {
    background: var(--surface-tint);
    border: 1px solid var(--rule);
    border-radius: var(--r-md);
    padding: var(--s-6);
    display: flex;
    flex-direction: column;
    gap: var(--s-4);
    height: fit-content;

    &--wide {
        @media (min-width: 768px) {
            grid-column: span 2;
        }
    }

    &__header {
        display: flex;
        align-items: center;
        gap: var(--s-3);
    }

    &__icon {
        font-size: 1.5rem;
    }

    &__title {
        font-family: var(--font-display);
        font-size: var(--fs-lg);
        color: var(--bone-50);
        margin: 0;
        letter-spacing: -0.01em;
    }

    &__body {
        font-family: var(--font-ui);
        font-size: var(--fs-sm);
        line-height: 1.6;
        color: var(--bone-200);

        p {
            margin: 0 0 var(--s-4);
        }

        ul {
            margin: 0;
            padding-left: var(--s-4);
            display: flex;
            flex-direction: column;
            gap: var(--s-3);

            li strong {
                color: var(--bone-50);
            }
        }
    }
}

/* Shortcuts Table styling */
.shortcuts-table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--rule);
    border-radius: var(--r-sm);
    background: var(--ink-950);
}

.shortcuts-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-family: var(--font-ui);
    font-size: var(--fs-sm);

    th, td {
        padding: var(--s-3) var(--s-4);
        border-bottom: 1px solid var(--rule);
    }

    th {
        background: rgba(255,255,255, 0.02);
        font-family: var(--font-mono);
        font-size: 0.72rem;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--bone-400);
    }

    tr:last-child td {
        border-bottom: 0;
    }

    td strong {
        color: var(--bone-50);
    }

    kbd {
        display: inline-block;
        padding: 0.2em 0.5em;
        font-family: var(--font-mono);
        font-size: 0.75rem;
        line-height: 1;
        color: var(--bone-100);
        background-color: var(--ink-850);
        border: 1px solid var(--rule-strong);
        border-radius: var(--r-sm);
        box-shadow: 0 1px 0 rgba(0,0,0,0.2), inset 0 0 0 1px rgba(255,255,255,0.05);
    }
}
</style>
