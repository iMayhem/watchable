<template>
    <div v-if="activeBanner && activeBanner.message" class="banner-bar" :style="bannerStyle">
        <div class="banner-bar__inner">
            <a
                v-if="activeBanner.link"
                :href="activeBanner.link"
                target="_blank"
                rel="noopener noreferrer"
                class="banner-bar__link"
            >
                {{ activeBanner.message }}
            </a>
            <span v-else class="banner-bar__text">{{ activeBanner.message }}</span>
            <button type="button" class="banner-bar__close" @click="dismissBanner" aria-label="Dismiss banner">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue'
import { useBanner } from '../../composables/useBanner'

const { activeBanner, fetchActiveBanner } = useBanner()

const bannerStyle = computed(() => {
    if (!activeBanner.value) return {}
    return {
        backgroundColor: activeBanner.value.bg_color || 'var(--ember)',
        color: activeBanner.value.text_color || '#ffffff'
    }
})

function dismissBanner() {
    activeBanner.value = null
}

onMounted(() => {
    fetchActiveBanner()
})
</script>

<style scoped>
.banner-bar {
    position: relative;
    z-index: calc(var(--z-header) - 1);
    font-family: var(--font-ui);
    font-size: var(--fs-sm);
}

.banner-bar__inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--s-3);
    padding: var(--s-2) var(--s-4);
    max-width: 1200px;
    margin: 0 auto;
    position: relative;
}

.banner-bar__link {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
}

.banner-bar__link:hover {
    opacity: 0.85;
}

.banner-bar__text {
    font-weight: 500;
}

.banner-bar__close {
    position: absolute;
    right: var(--s-3);
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: inherit;
    opacity: 0.7;
    cursor: pointer;
    padding: 4px;
    border-radius: var(--r-xs);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity var(--dur-fast);
}

.banner-bar__close:hover {
    opacity: 1;
}
</style>
