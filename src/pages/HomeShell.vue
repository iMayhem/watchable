<template>
    <NetflixHome v-if="showNetflix" />
    <Home v-else />
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue';
import Home from './Home.vue';
import NetflixHome from './NetflixHome.vue';
import { getContentMode } from '../composables/useContentMode';

export default defineComponent({
    name: 'HomeShell',
    components: { Home, NetflixHome },
    setup() {
        const { contentMode } = getContentMode();
        const showNetflix = computed(() => contentMode.value === 'netflix');
        return { showNetflix };
    }
});
</script>