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
                Install our free Moovie Stream Boost extension for direct CDN playback on moovie.fun.
            </p>

            <div v-if="extensionActive" class="ext-prompt__status ext-prompt__status--ok">
                Extension detected · direct CDN streaming enabled
            </div>
            <div v-else class="ext-prompt__status ext-prompt__status--warn">
                Extension not detected · playback will use the moovie proxy (slower)
            </div>

            <ol class="ext-prompt__steps">
                <li>Open <code>chrome://extensions</code> in Chrome or Edge</li>
                <li>Enable <strong>Developer mode</strong></li>
                <li>Click <strong>Load unpacked</strong> and select the <code>extension/</code> folder from the moovie repo</li>
                <li>Under Moovie, set site access to <strong>On moovie.fun</strong> (or <strong>On all sites</strong>)</li>
                <li>Click the extension <strong>Reload</strong> button, then hard-refresh this page</li>
            </ol>

            <p class="ext-prompt__note">
                The extension sets the CDN Referer header so streams play without buffering through our proxy.
            </p>
        </LmDialog>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref, watch } from 'vue';
import LmDialog from '../primitives/Dialog.vue';
import { getContentMode } from '../../composables/useContentMode';
import { useStreamExtension } from '../../composables/useStreamExtension';
import { nfDebug } from '../../composables/useNetflixDebug';

export default defineComponent({
    name: 'ExtensionPrompt',
    components: { LmDialog },
    setup() {
        const open = ref(false);
        const { extensionActive } = useStreamExtension();
        const { isNetflix } = getContentMode();

        const showPrompt = computed(() => isNetflix());

        const openDialog = () => {
            nfDebug('extension-prompt:open', { active: extensionActive.value });
            open.value = true;
        };

        watch(extensionActive, (active) => {
            nfDebug('extension-prompt:status', { active });
        });

        return { open, extensionActive, showPrompt, openDialog };
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

    &__steps {
        margin: 0 0 var(--s-4);
        padding-left: 1.2rem;
        color: var(--bone-300);
        font-size: var(--fs-sm);
        line-height: 1.6;

        li + li {
            margin-top: 0.35rem;
        }

        code {
            font-family: var(--font-mono);
            font-size: 0.78rem;
            color: var(--bone-100);
        }
    }

    &__note {
        margin: 0;
        color: var(--bone-400);
        font-size: 0.78rem;
    }
}
</style>