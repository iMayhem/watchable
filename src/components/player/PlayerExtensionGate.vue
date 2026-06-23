<template>
    <div
        class="nf-ext-gate"
        :class="{ 'nf-ext-gate--compact': compact }"
        role="dialog"
        aria-labelledby="nf-ext-gate-title"
        :aria-modal="!compact"
    >
        <button
            v-if="!compact"
            type="button"
            class="nf-ext-gate__slow"
            @click="$emit('stream-slow')"
        >
            Let's stream slow server
        </button>

        <div class="nf-ext-gate__card">
            <header class="nf-ext-gate__head">
                <span class="nf-ext-gate__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                        <path d="M12 2 2 7l10 5 10-5-10-5Z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                    </svg>
                </span>

                <h2 id="nf-ext-gate-title" class="nf-ext-gate__title">
                    {{ compact ? 'Faster playback available' : 'Extension needed' }}
                </h2>
                <p class="nf-ext-gate__lead">
                    <template v-if="compact">
                        Install the Moovie extension for faster starts and fewer playback errors.
                    </template>
                    <template v-else>
                        Install the Moovie extension to play Netflix catalogue streams — faster
                        starts, fewer playback errors. Install it first, then reload this page.
                    </template>
                </p>
            </header>

            <div class="nf-ext-gate__body">
                <a
                    class="nf-ext-gate__download"
                    :href="browser.url"
                    :download="browser.installType === 'download' ? browser.fileName : undefined"
                    rel="noopener"
                    target="_blank"
                    @click="trackDownload"
                >
                    <ExtensionBrowserIcon :browser="browser.id" />
                    <span class="nf-ext-gate__download-copy">
                        <strong>
                            {{ browser.installType === 'store' ? 'Get for' : 'Download for' }}
                            {{ browser.name }}
                        </strong>
                        <small>v{{ extensionVersion }} · {{ browser.fileName }}</small>
                    </span>
                </a>

                <ol v-if="!compact" class="nf-ext-gate__steps">
                    <template v-if="browser.id === 'chrome'">
                        <li>Download <code>extension.crx</code>.</li>
                        <li>Open <code>chrome://extensions</code> and ensure <strong>Developer mode</strong> (top-right) is turned <strong>ON</strong>.</li>
                        <li>Drag and drop the downloaded <code>extension.crx</code> file from your Files app (Downloads folder) directly onto the middle of the <code>chrome://extensions</code> page.</li>
                        <li>Confirm the installation prompt and reload this page.</li>
                        <li style="margin-top: 0.75rem; list-style-type: none;">
                            <details style="font-size: 0.74rem; opacity: 0.85; border-top: 1px dashed rgba(255,255,255,0.15); padding-top: 0.5rem;">
                                <summary style="cursor: pointer; color: var(--ember); font-weight: 600;">Alternative: Install via ZIP (Load Unpacked)</summary>
                                <ol style="padding-left: 1.1rem; margin-top: 0.35rem; display: flex; flex-direction: column; gap: 0.25rem;">
                                    <li>Download the <a :href="browser.url.replace('.crx', '.zip')" download="extension.zip" style="color: #fff; text-decoration: underline;">extension.zip</a> package.</li>
                                    <li>Unzip the downloaded folder.</li>
                                    <li>On <code>chrome://extensions</code>, click <strong>Load unpacked</strong> in the top-left.</li>
                                    <li>Select the unzipped folder containing <code>manifest.json</code>.</li>
                                </ol>
                            </details>
                        </li>
                    </template>
                    <template v-else-if="browser.id === 'firefox'">
                        <li>
                            Open
                            <a :href="browser.url" rel="noopener" target="_blank">Firefox Add-ons</a>
                            and click <strong>Add to Firefox</strong>.
                        </li>
                        <li>Confirm the install prompt, then hard-refresh this page.</li>
                    </template>
                    <template v-else>
                        <li>Unzip the download and load it in <code>{{ browser.extensionsPage }}</code>.</li>
                        <li>
                            Set site access to <strong>On moovie.fun</strong>, then hard-refresh this page.
                        </li>
                    </template>
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

            <p v-if="!compact" class="nf-ext-gate__note">
                Playback in the player requires the Moovie extension.
            </p>
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
    props: {
        compact: { type: Boolean, default: false }
    },
    emits: ['recheck', 'stream-slow'],
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

    &--compact {
        align-items: flex-start;
        justify-content: flex-end;
        padding:
            max(0.75rem, env(safe-area-inset-top))
            max(0.75rem, env(safe-area-inset-right))
            max(0.75rem, env(safe-area-inset-bottom))
            0.75rem;
        background: transparent;
        backdrop-filter: none;
        pointer-events: none;
        overflow: visible;

        .nf-ext-gate__card {
            width: min(100%, 300px);
            margin: 0;
            padding: 0.9rem 0.85rem 0.8rem;
            gap: 0.7rem;
            pointer-events: auto;
            box-shadow: 0 10px 32px rgba(0, 0, 0, 0.55);
        }

        .nf-ext-gate__head {
            align-items: flex-start;
            text-align: left;
        }

        .nf-ext-gate__icon {
            width: 40px;
            height: 40px;

            svg {
                width: 20px;
                height: 20px;
            }
        }

        .nf-ext-gate__title {
            font-size: 0.92rem;
        }

        .nf-ext-gate__lead {
            font-size: 0.76rem;
            max-width: none;
        }

        .nf-ext-gate__download {
            padding: 0.65rem 0.75rem;
        }

        .nf-ext-gate__btn {
            padding: 0.55rem 0.75rem;
            font-size: 0.78rem;
        }
    }

    &__slow {
        position: absolute;
        right: max(1rem, env(safe-area-inset-right));
        bottom: max(1rem, env(safe-area-inset-bottom));
        z-index: 2;
        margin: 0;
        padding: 0.55rem 0.85rem;
        border: 1px solid rgba(255, 255, 255, 0.22);
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.72);
        color: rgba(255, 255, 255, 0.88);
        font-size: 0.78rem;
        font-weight: 600;
        line-height: 1.3;
        cursor: pointer;
        transition:
            background 0.15s ease,
            border-color 0.15s ease,
            transform 0.15s ease;

        &:hover {
            background: rgba(24, 24, 24, 0.92);
            border-color: rgba(255, 255, 255, 0.38);
            transform: translateY(-1px);
        }
    }

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