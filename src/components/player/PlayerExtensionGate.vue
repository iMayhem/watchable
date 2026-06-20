<template>
    <div class="nf-ext-gate" role="dialog" aria-labelledby="nf-ext-gate-title" aria-modal="true">
        <div class="nf-ext-gate__card">
            <header class="nf-ext-gate__head">
                <span class="nf-ext-gate__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                        <path d="M12 2 2 7l10 5 10-5-10-5Z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                    </svg>
                </span>

                <h2 id="nf-ext-gate-title" class="nf-ext-gate__title">Extension needed</h2>
                <p class="nf-ext-gate__lead">
                    Install the Moovie extension to play Netflix catalogue streams — faster starts,
                    fewer playback errors. Install it first, then reload this page.
                </p>
            </header>

            <div class="nf-ext-gate__body">
                <a
                    class="nf-ext-gate__download"
                    :href="browser.url"
                    :download="browser.fileName"
                    rel="noopener"
                    target="_blank"
                    @click="trackDownload"
                >
                    <ExtensionBrowserIcon :browser="browser.id" />
                    <span class="nf-ext-gate__download-copy">
                        <strong>Download for {{ browser.name }}</strong>
                        <small>v{{ extensionVersion }} · {{ browser.fileName }}</small>
                    </span>
                </a>

                <ol class="nf-ext-gate__steps">
                    <li>Unzip the download and load it in <code>{{ browser.extensionsPage }}</code>.</li>
                    <li>
                        Set site access to <strong>On moovie.fun</strong>, then hard-refresh this page.
                    </li>
                </ol>

                <div class="nf-ext-gate__actions">
                    <button
                        type="button"
                        class="nf-ext-gate__btn nf-ext-gate__btn--primary"
                        @click="$emit('recheck')"
                    >
                        I installed it — check again
                    </button>
                </div>
            </div>

            <p class="nf-ext-gate__note">Playback in the player requires the Moovie extension.</p>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import ExtensionBrowserIcon from '../navigation/ExtensionBrowserIcon.vue';
import { nfDebug } from '../../composables/useNetflixDebug';
import {
    detectExtensionBrowser,
    getExtensionBrowser,
    MOOVIE_EXTENSION_VERSION
} from '../../constants/moovieExtension';

export default defineComponent({
    name: 'PlayerExtensionGate',
    components: { ExtensionBrowserIcon },
    emits: ['recheck'],
    setup() {
        const browser = ref(getExtensionBrowser(detectExtensionBrowser()));
        const extensionVersion = MOOVIE_EXTENSION_VERSION;

        const trackDownload = () => {
            nfDebug('player:extension-gate:download', { browser: browser.value.id });
        };

        return {
            browser,
            extensionVersion,
            trackDownload
        };
    }
});
</script>

<style lang="scss" scoped>
.nf-ext-gate {
    position: absolute;
    inset: 0;
    z-index: 6;
    display: flex;
    align-items: center;
    justify-content: center;
    padding:
        max(1.25rem, env(safe-area-inset-top))
        1.25rem
        max(1.5rem, env(safe-area-inset-bottom));
    box-sizing: border-box;
    background: rgba(0, 0, 0, 0.82);
    backdrop-filter: blur(6px);
    pointer-events: auto;
    overflow-y: auto;

    &__card {
        width: min(100%, 400px);
        margin: auto;
        padding: 1.5rem 1.25rem 1.35rem;
        box-sizing: border-box;
        border-radius: 12px;
        background: rgba(16, 16, 16, 0.96);
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 1rem;
    }

    &__head {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.45rem;
    }

    &__body {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0.85rem;
        width: 100%;
    }

    &__icon {
        display: grid;
        place-items: center;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: rgba(78, 181, 255, 0.14);
        color: #8fd0ff;
        flex-shrink: 0;

        svg {
            width: 26px;
            height: 26px;
        }
    }

    &__title {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 700;
        color: #fff;
        line-height: 1.25;
    }

    &__lead {
        margin: 0;
        font-size: 0.86rem;
        line-height: 1.5;
        color: rgba(255, 255, 255, 0.72);
        max-width: 34ch;
    }

    &__download {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
        box-sizing: border-box;
        padding: 0.85rem 1rem;
        border: 1px solid rgba(255, 90, 31, 0.4);
        border-radius: 8px;
        background: linear-gradient(135deg, rgba(255, 90, 31, 0.16), rgba(255, 90, 31, 0.05));
        color: #fff;
        text-decoration: none;
        text-align: left;
        transition:
            border-color 0.15s ease,
            transform 0.15s ease;

        &:hover {
            border-color: rgba(255, 90, 31, 0.65);
            transform: translateY(-1px);
        }
    }

    &__download-copy {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        gap: 0.15rem;
        min-width: 0;
        flex: 1;

        strong {
            font-size: 0.9rem;
            line-height: 1.3;
        }

        small {
            font-family: var(--font-mono);
            font-size: 0.68rem;
            line-height: 1.35;
            color: rgba(255, 255, 255, 0.55);
            word-break: break-all;
        }
    }

    &__steps {
        margin: 0;
        padding: 0 0 0 1.1rem;
        width: 100%;
        box-sizing: border-box;
        text-align: left;
        font-size: 0.78rem;
        line-height: 1.55;
        color: rgba(255, 255, 255, 0.62);

        li + li {
            margin-top: 0.35rem;
        }

        code {
            font-family: var(--font-mono);
            font-size: 0.72rem;
            color: rgba(255, 255, 255, 0.88);
            word-break: break-word;
        }
    }

    &__actions {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
        width: 100%;
    }

    &__btn {
        width: 100%;
        box-sizing: border-box;
        padding: 0.7rem 1rem;
        border-radius: 6px;
        font-size: 0.84rem;
        font-weight: 600;
        cursor: pointer;
        transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease;

        &--primary {
            border: 1px solid rgba(78, 181, 255, 0.45);
            background: rgba(78, 181, 255, 0.16);
            color: #b8e4ff;

            &:hover {
                background: rgba(78, 181, 255, 0.24);
            }
        }
    }

    &__note {
        margin: 0;
        text-align: center;
        font-size: 0.72rem;
        line-height: 1.45;
        color: rgba(255, 255, 255, 0.45);
    }
}
</style>