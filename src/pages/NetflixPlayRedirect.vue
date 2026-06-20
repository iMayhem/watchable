<template>
    <div class="nf-play-redirect" aria-live="polite" aria-busy="true">
        <p>Opening player…</p>
    </div>
</template>

<script lang="ts">
import { defineComponent, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { catalogStreamTarget } from '../composables/useNetflixCatalogLookup';
import { resolveMoovieCatalogForAnilist } from '../composables/useNetflixAnimeResolve';
import { getNetflixLanguage, getLanguageOption } from '../composables/useNetflixLanguage';
import { netflixBrowsePath } from '../composables/useNetflixRails';
import { nfDebugError } from '../composables/useNetflixDebug';

export default defineComponent({
    name: 'NetflixPlayRedirect',
    setup() {
        const route = useRoute();
        const router = useRouter();
        const { language } = getNetflixLanguage();

        onMounted(async () => {
            const id = String(route.params.id || '');
            const type = String(route.params.type || '');

            try {
                if (route.name === 'NetflixAnimeDetail' || route.path.startsWith('/nf/anime/')) {
                    const anilistId = Number(id);
                    if (!Number.isFinite(anilistId)) {
                        router.replace('/');
                        return;
                    }

                    const lang = getLanguageOption(language.value);
                    const resolved = await resolveMoovieCatalogForAnilist(anilistId, lang);
                    if (resolved.item) {
                        router.replace(
                            catalogStreamTarget(
                                {
                                    id: resolved.item.id,
                                    title: resolved.item.title,
                                    media_type: resolved.item.media_type
                                },
                                { supportsEpisodes: true }
                            ).path
                        );
                        return;
                    }

                    router.replace(netflixBrowsePath('hollywood', 'anime'));
                    return;
                }

                if (type === 'tv' || route.path.startsWith('/nf/tv/')) {
                    router.replace(`/stream/nf/tv/${id}/season/1/episode/1`);
                    return;
                }

                router.replace(`/stream/nf/movie/${id}`);
            } catch (err) {
                nfDebugError('nf:play-redirect:fail', { id, type, err });
                router.replace('/');
            }
        });

        return {};
    }
});
</script>

<style lang="scss" scoped>
.nf-play-redirect {
    min-height: 40vh;
    display: grid;
    place-items: center;
    color: var(--bone-400);
    font-size: var(--fs-sm);
}
</style>