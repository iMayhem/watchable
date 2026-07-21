<template>
    <Home />
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import Home from './Home.vue';

export default defineComponent({
    name: 'HomeShell',
    components: { Home }
});
</script>