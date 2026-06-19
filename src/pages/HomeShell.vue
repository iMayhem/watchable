<template>
    <NetflixHome v-if="showNetflix" />
    <Home v-else />
</template>

<script lang="ts">
import { computed, defineComponent, watch } from 'vue';
import Home from './Home.vue';
import NetflixHome from './NetflixHome.vue';
import { getContentMode } from '../composables/useContentMode';
import { nfDebug } from '../composables/useNetflixDebug';

export default defineComponent({
    name: 'HomeShell',
    components: { Home, NetflixHome },
    setup() {
        const { contentMode } = getContentMode();
        const showNetflix = computed(() => contentMode.value === 'netflix');

        watch(
            showNetflix,
            (netflix) => {
                nfDebug('home-shell:render', { mode: netflix ? 'netflix' : 'global' });
            },
            { immediate: true }
        );

        return { showNetflix };
    }
});
</script>