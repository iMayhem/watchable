import { readonly, ref } from 'vue';

const splashActive = ref(false);
const splashHandoff = ref(false);

export function useOpeningSplash() {
    return {
        splashActive: readonly(splashActive),
        splashHandoff: readonly(splashHandoff),
        setSplashActive: (active: boolean) => {
            splashActive.value = active;
        },
        setSplashHandoff: (handoff: boolean) => {
            splashHandoff.value = handoff;
        }
    };
}