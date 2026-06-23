import { readonly, ref } from 'vue';

const splashActive = ref(false);

export function useOpeningSplash() {
    return {
        splashActive: readonly(splashActive),
        setSplashActive: (active: boolean) => {
            splashActive.value = active;
        }
    };
}