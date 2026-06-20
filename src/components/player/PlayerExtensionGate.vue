<template>
    <div class="nf-ext-gate" role="dialog" aria-labelledby="nf-ext-gate-title" aria-modal="true">
        <div class="nf-ext-gate__card">
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
                <button type="button" class="nf-ext-gate__btn nf-ext-gate__btn--primary" @click="$emit('recheck')">
                    I installed it — check again
                </button>
                <button type="button" class="nf-ext-gate__btn nf-ext-gate__btn--ghost" @click="$emit('continue')">
                    Continue without extension
                </button>
            </div>

            <p class="nf-ext-gate__note">We can't run videos without the extension.</p>
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
    emits: ['recheck', 'continue'],
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
    display: grid;
    place-content: center;
    padding: 1.25rem;
    background: rgba(0, 0, 0, 0.82);
    backdrop-filter: blur(6px);

    &__card {
        width: min(100%, 420px);
        padding: 1.5rem 1.35rem;
        border-radius: 12px;
        background: rgba(16, 16, 16, 0.96);
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5);
        text-align: center;
    }

    &__icon {
        display: grid;
        place-items: center;
        width: 52px;
        height: 52px;
        margin: 0 auto 0.85rem;
        border-radius: 50%;
        background: rgba(78, 181, 255, 0.14);
        color: #8fd0ff;

        svg {
            width: 26px;
            height: 26px;
        }
    }

    &__title {
        margin: 0 0 0.45rem;
        font-size: 1.15rem;
        font-weight: 700;
        color: #fff;
    }

    &__lead {
        margin: 0 0 1rem;
        font-size: 0.86rem;
        line-height: 1.5;
        color: rgba(255, 255, 255, 0.72);
    }

    &__download {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;
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
        gap: 0.15rem;
        min-width: 0;

        strong {
            font-size: 0.9rem;
        }

        small {
            font-family: var(--font-mono);
            font-size: 0.68rem;
            color: rgba(255, 255, 255, 0.55);
        }
    }

    &__steps {
        margin: 0 0 1rem;
        padding-left: 1.15rem;
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
        }
    }

    &__actions {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
    }

    &__btn {
        width: 100%;
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

        &--ghost {
            border: 1px solid rgba(255, 255, 255, 0.18);
            background: transparent;
            color: rgba(255, 255, 255, 0.72);

            &:hover {
                color: #fff;
                background: rgba(255, 255, 255, 0.06);
            }
        }
    }

    &__note {
        margin: 0.85rem 0 0;
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.45);
    }
}
</style>