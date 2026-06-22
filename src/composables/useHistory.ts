export interface ViewedItem {
  id: number | string;
  title: string;
  image: string | null;
  rating: number;
  categories: number[];
  adult: boolean;
  type: 'movie' | 'tv' | 'anime';
}
const MAX_HISTORY_LENGTH = 20;

import { useStorage } from '@vueuse/core';
import { watch } from 'vue';
import { getCurrentUser, pushUserDataToSupabase } from '../lib/auth';

export const searchHistory = useStorage<string[]>('searchHistory', []);
export const netflixSearchHistory = useStorage<string[]>('netflixSearchHistory', []);
export const viewHistory = useStorage<ViewedItem[]>('viewHistory', []);

function pushSearchTerm(store: typeof searchHistory, value: string): void {
  const index = store.value.indexOf(value);
  if (index !== -1) store.value.splice(index, 1);
  store.value.unshift(value);
  if (store.value.length > MAX_HISTORY_LENGTH) {
    store.value = store.value.slice(0, 20);
  }
}

export function addSearchTerm(term: string): void {
  const value = term.trim();
  if (!value) return;
  pushSearchTerm(searchHistory, value);

  const user = getCurrentUser();
  if (user) {
    pushUserDataToSupabase(user, undefined, undefined, searchHistory.value);
  }
}

export function addNetflixSearchTerm(term: string): void {
  const value = term.trim();
  if (!value) return;
  pushSearchTerm(netflixSearchHistory, value);
}

export function addViewedItem(item: ViewedItem): void {
  const index = viewHistory.value.findIndex(
    i => i.id === item.id && i.type === item.type
  );
  if (index !== -1) viewHistory.value.splice(index, 1);
  viewHistory.value.unshift(item);
  if (viewHistory.value.length > MAX_HISTORY_LENGTH) {
    viewHistory.value = viewHistory.value.slice(0, 20);
  }
  
  // Sync to Supabase if user is logged in
  const user = getCurrentUser();
  if (user) {
    pushUserDataToSupabase(user, undefined, viewHistory.value, undefined);
  }
}

// Auto-sync watch history with Supabase when user is logged in
if (typeof window !== 'undefined') {
  watch(
    viewHistory,
    (newVal) => {
      const user = getCurrentUser();
      if (user) {
        pushUserDataToSupabase(user, undefined, newVal, undefined);
      }
    },
    { deep: true }
  );
}

export function useHistory() {
  return {
    searchHistory,
    netflixSearchHistory,
    viewHistory,
    addSearchTerm,
    addNetflixSearchTerm,
    addViewedItem
  };
}
