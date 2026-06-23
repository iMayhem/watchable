<template>
    <div v-if="showPrompt" class="ext-prompt">
        <button
            type="button"
            class="ext-prompt__btn"
            :class="{ 'is-active': extensionActive }"
            @click="openDialog"
        >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path d="M12 2 2 7l10 5 10-5-10-5Z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
            </svg>
            <span>{{ extensionActive ? 'Extension active' : 'Add extension' }}</span>
        </button>

        <LmDialog v-model="open" title="Moovie Stream Boost">
            <p class="ext-prompt__lead">
                Install Moovie for direct CDN playback on moovie.fun — smoother streams, less buffering.
            </p>

            <div v-if="extensionActive" class="ext-prompt__status ext-prompt__status--ok">
                Extension detected · direct CDN streaming enabled
            </div>
            <div v-else class="ext-prompt__status ext-prompt__status--warn">
                Extension not detected · we can't run videos without the extension
            </div>

            <section class="ext-prompt__downloads" aria-labelledby="ext-download-heading">
                <div class="ext-prompt__downloads-head">
                    <h3 id="ext-download-heading" class="ext-prompt__section-title">Download</h3>
                    <span class="ext-prompt__version">v{{ extensionVersion }}</span>
                </div>

                <div class="ext-prompt__heroes">
                    <a
                        v-for="browser in recommendedBrowsers"
                        :key="browser.id"
                        class="ext-prompt__hero"
                        :href="browser.url"
                        :download="browser.installType === 'download' ? browser.fileName : undefined"
                        rel="noopener"
                        target="_blank"
                        @click="trackDownload(browser.id)"
                    >
                        <ExtensionBrowserIcon :browser="browser.id" />
                        <span class="ext-prompt__hero-copy">
                            <strong>Get for {{ browser.name }}</strong>
                            <small>{{ browser.fileName }}</small>
                        </span>
                        <span class="ext-prompt__hero-cta" aria-hidden="true">→</span>
                    </a>
                </div>

                <p class="ext-prompt__grid-label">Other browsers</p>
                <div class="ext-prompt__grid">
                    <a
                        v-for="browser in otherBrowsers"
                        :key="browser.id"
                        class="ext-prompt__card"
                        :href="browser.url"
                        :download="browser.installType === 'download' ? browser.fileName : undefined"
                        rel="noopener"
                        target="_blank"
                        :title="`${browser.installType === 'store' ? 'Get' : 'Download'} Moovie for ${browser.name}`"
                        @click="trackDownload(browser.id)"
                    >
                        <ExtensionBrowserIcon :browser="browser.id" />
                        <span>{{ browser.name }}</span>
                    </a>
                </div>
            </section>

            <section class="ext-prompt__install" aria-labelledby="ext-install-heading">
                <h3 id="ext-install-heading" class="ext-prompt__section-title">How to install</h3>

                <ol class="ext-prompt__steps">
                    <template v-if="installGuide.installType === 'store'">
                        <li>
                            Click {{ installGuide.name }} above to open Moovie on
                            <a :href="installGuide.url" rel="noopener" target="_blank">{{ installGuide.fileName }}</a>.
                        </li>
                        <li v-if="installGuide.id === 'firefox'">
                            Click <strong>Add to Firefox</strong> and confirm the install prompt.
                        </li>
                        <li v-else>
                            Click <strong>Get</strong> and confirm the install prompt.
                        </li>
                    </template>
                    <template v-else>
                        <li>
                            Click your browser above — your browser will download the
                            <code>{{ installGuide.fileName }}</code> file.
                        </li>
                        <li>Open <code>{{ installGuide.extensionsPage }}</code> in your browser.</li>
                        <li>Turn on <strong>Developer mode</strong> (top-right toggle).</li>
                        <li>
                            Drag and drop the downloaded <code>{{ installGuide.fileName }}</code> file from your
                            file manager directly onto the middle of the extensions page.
                        </li>
                    </template>
                    <li v-if="installGuide.installType !== 'store'" style="margin-top: 0.5rem; list-style-type: none;">
                        <details style="font-size: 0.76rem; opacity: 0.85; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 0.35rem;">
                            <summary style="cursor: pointer; color: var(--ember); font-weight: 600;">Alternative: Install via ZIP (Load Unpacked)</summary>
                            <ol style="padding-left: 1.1rem; margin-top: 0.35rem; display: flex; flex-direction: column; gap: 0.25rem; list-style-type: decimal;">
                                <li>Download the <a :href="installGuide.url.replace('.crx', '.zip')" download="extension.zip" style="color: #fff; text-decoration: underline;">extension.zip</a> package.</li>
                                <li>Unzip the downloaded folder.</li>
                                <li>On the extensions page, click <strong>Load unpacked</strong> in the top-left.</li>
                                <li>Select the unzipped folder containing <code>manifest.json</code>.</li>
                            </ol>
                        </details>
                    </li>
                    <li>
                        In extension details, set site access to <strong>On moovie.fun</strong>
                        (or <strong>On all sites</strong>).
                    </li>
                    <li>Hard-refresh this page — the badge above should turn green.</li>
                </ol>

                <details class="ext-prompt__other-steps">
                    <summary>Steps for a different browser</summary>
                    <ul>
                        <li v-for="browser in allBrowsers" :key="`steps-${browser.id}`">
                            <strong>{{ browser.name }}:</strong>
                            <template v-if="browser.installType === 'store'">
                                get from
                                <a :href="browser.url" rel="noopener" target="_blank">{{ browser.fileName }}</a>
                            </template>
                            <template v-else>
                                download
                                <a
                                    :href="browser.url"
                                    :download="browser.fileName"
                                    rel="noopener"
                                    target="_blank"
                                >
                                    {{ browser.fileName }}
                                </a>
                                · open <code>{{ browser.extensionsPage }}</code>
                            </template>
                        </li>
                    </ul>
                </details>
            </section>

            <p class="ext-prompt__note">
                Netflix catalogue playback requires the extension — videos won't run without it.
            </p>
        </LmDialog>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref, watch } from 'vue';
import LmDialog from '../primitives/Dialog.vue';
import ExtensionBrowserIcon from './ExtensionBrowserIcon.vue';
import { getContentMode } from '../../composables/useContentMode';
import { useStreamExtension } from '../../composables/useStreamExtension';
import { nfDebug } from '../../composables/useNetflixDebug';
import {
    detectExtensionBrowser,
    EXTENSION_BROWSER_DOWNLOADS,
    getExtensionInstallGuide,
    getOtherExtensionBrowsers,
    getRecommendedExtensionBrowsers,
    MOOVIE_EXTENSION_VERSION,
    type ExtensionBrowserId
} from '../../constants/moovieExtension';

export default defineComponent({
    name: 'ExtensionPrompt',
    components: { LmDialog, ExtensionBrowserIcon },
    setup() {
        const open = ref(false);
        const detectedBrowser = ref<ExtensionBrowserId>(detectExtensionBrowser());
        const { extensionActive } = useStreamExtension();
        const { isNetflix } = getContentMode();

        const showPrompt = computed(() => isNetflix());
        const extensionVersion = MOOVIE_EXTENSION_VERSION;
        const allBrowsers = EXTENSION_BROWSER_DOWNLOADS;

        const recommendedBrowsers = getRecommendedExtensionBrowsers();
        const otherBrowsers = getOtherExtensionBrowsers();
        const installGuide = computed(() => getExtensionInstallGuide(detectedBrowser.value));

        const openDialog = () => {
            detectedBrowser.value = detectExtensionBrowser();
            nfDebug('extension-prompt:open', {
                active: extensionActive.value,
                browser: detectedBrowser.value
            });
            open.value = true;
        };

        const trackDownload = (browserId: ExtensionBrowserId) => {
            nfDebug('extension-prompt:download', { browser: browserId });
        };

        watch(extensionActive, (active) => {
            nfDebug('extension-prompt:status', { active });
        });

        return {
            open,
            extensionActive,
            showPrompt,
            openDialog,
            extensionVersion,
            recommendedBrowsers,
            otherBrowsers,
            allBrowsers,
            installGuide,
            trackDownload
        };
    }
});
</script>

<style lang="scss" scoped>
.ext-prompt {
    &__btn {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.45rem 0.85rem;
        border-radius: var(--r-pill);
        border: 1px solid var(--rule);
        background: var(--ink-800);
        color: var(--bone-200);
        font-family: var(--font-ui);
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        transition:
            border-color var(--dur-fast) var(--ease-out),
            color var(--dur-fast) var(--ease-out),
            background var(--dur-fast) var(--ease-out);

        svg {
            width: 15px;
            height: 15px;
        }

        &:hover {
            border-color: var(--rule-strong);
            color: var(--bone-50);
        }

        &.is-active {
            border-color: rgba(78, 181, 255, 0.45);
            color: #8fd0ff;
            background: rgba(78, 181, 255, 0.08);
        }
    }

    &__lead {
        margin: 0 0 var(--s-4);
        color: var(--bone-300);
        font-size: var(--fs-sm);
        line-height: var(--lh-base);
    }

    &__status {
        margin-bottom: var(--s-4);
        padding: 0.65rem 0.85rem;
        border-radius: var(--r-sm);
        font-size: 0.82rem;
        font-weight: 600;

        &--ok {
            background: rgba(78, 181, 255, 0.12);
            color: #8fd0ff;
        }

        &--warn {
            background: rgba(255, 138, 61, 0.12);
            color: var(--ember);
        }
    }

    &__downloads {
        margin-bottom: var(--s-5);
        padding: var(--s-4);
        border: 1px solid var(--rule);
        border-radius: var(--r-md);
        background: var(--ink-800);
    }

    &__downloads-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-3);
        margin-bottom: var(--s-3);
    }

    &__section-title {
        margin: 0;
        font-family: var(--font-ui);
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: var(--ls-micro);
        text-transform: uppercase;
        color: var(--bone-400);
    }

    &__version {
        font-family: var(--font-mono);
        font-size: 0.68rem;
        color: var(--bone-400);
    }

    &__heroes {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
        margin-bottom: var(--s-4);
    }

    &__hero {
        display: flex;
        align-items: center;
        gap: var(--s-3);
        padding: 0.85rem 1rem;
        border: 1px solid rgba(255, 90, 31, 0.35);
        border-radius: var(--r-md);
        background: linear-gradient(135deg, rgba(255, 90, 31, 0.14), rgba(255, 90, 31, 0.04));
        color: var(--bone-50);
        text-decoration: none;
        transition:
            border-color var(--dur-fast) var(--ease-out),
            transform var(--dur-fast) var(--ease-out),
            box-shadow var(--dur-fast) var(--ease-out);

        &:hover {
            border-color: rgba(255, 90, 31, 0.55);
            transform: translateY(-1px);
            box-shadow: 0 10px 24px rgba(255, 90, 31, 0.12);
        }
    }

    &__hero-copy {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 0.15rem;
        min-width: 0;

        strong {
            font-size: var(--fs-sm);
            font-weight: 700;
        }

        small {
            font-family: var(--font-mono);
            font-size: 0.68rem;
            color: var(--bone-300);
        }
    }

    &__hero-cta {
        font-size: 1.1rem;
        color: var(--ember);
        font-weight: 700;
    }

    &__grid-label {
        margin: 0 0 var(--s-2);
        font-size: 0.72rem;
        color: var(--bone-400);
    }

    &__grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.55rem;
    }

    &__card {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        min-height: 74px;
        padding: 0.55rem 0.35rem;
        border: 1px solid var(--rule);
        border-radius: var(--r-sm);
        background: var(--ink-700);
        color: var(--bone-200);
        font-size: 0.72rem;
        font-weight: 600;
        text-decoration: none;
        transition:
            border-color var(--dur-fast) var(--ease-out),
            color var(--dur-fast) var(--ease-out),
            background var(--dur-fast) var(--ease-out);

        &:hover {
            border-color: var(--rule-strong);
            color: var(--bone-50);
            background: rgba(245, 239, 228, 0.04);
        }
    }

    &__install {
        margin-bottom: var(--s-4);
    }

    &__steps {
        margin: var(--s-3) 0 0;
        padding-left: 1.2rem;
        color: var(--bone-300);
        font-size: var(--fs-sm);
        line-height: 1.6;

        li + li {
            margin-top: 0.45rem;
        }

        code {
            font-family: var(--font-mono);
            font-size: 0.78rem;
            color: var(--bone-100);
        }

        a {
            color: #8fd0ff;
            text-decoration: none;

            &:hover {
                text-decoration: underline;
            }
        }
    }

    &__other-steps {
        margin-top: var(--s-3);
        color: var(--bone-400);
        font-size: 0.78rem;

        summary {
            cursor: pointer;
            color: var(--bone-300);
            font-weight: 600;
        }

        ul {
            margin: var(--s-2) 0 0;
            padding-left: 1.1rem;
            line-height: 1.55;
        }

        li + li {
            margin-top: 0.35rem;
        }

        a {
            color: #8fd0ff;
            text-decoration: none;

            &:hover {
                text-decoration: underline;
            }
        }

        code {
            font-family: var(--font-mono);
            font-size: 0.72rem;
            color: var(--bone-200);
        }
    }

    &__note {
        margin: 0;
        color: var(--bone-400);
        font-size: 0.78rem;
    }
}

@media (max-width: 420px) {
    .ext-prompt__grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}
</style>