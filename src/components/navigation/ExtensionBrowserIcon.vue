<template>
    <img
        class="ext-browser-icon"
        :src="icon"
        :alt="`${label} logo`"
        width="28"
        height="28"
        loading="lazy"
        decoding="async"
    />
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { getExtensionBrowser, type ExtensionBrowserId } from '../../constants/moovieExtension';

export default defineComponent({
    name: 'ExtensionBrowserIcon',
    props: {
        browser: {
            type: String as () => ExtensionBrowserId,
            required: true
        }
    },
    setup(props) {
        const row = getExtensionBrowser(props.browser);
        return {
            icon: row.icon,
            label: row.name
        };
    }
});
</script>

<style scoped>
.ext-browser-icon {
    width: 28px;
    height: 28px;
    flex: 0 0 auto;
    object-fit: contain;
}
</style>