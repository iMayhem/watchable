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
import { getCurrentUser, pushUserDataToSync } from '../lib/auth';

export const searchHistory = useStorage<string[]>('searchHistory', []);
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
    pushUserDataToSync(user, undefined, undefined, searchHistory.value);
  }
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
  
  // Sync to Sync if user is logged in
  const user = getCurrentUser();
  if (user) {
    pushUserDataToSync(user, undefined, viewHistory.value, undefined);
  }
}

let syncTimeout: any = null;

function debouncedSyncToSync(viewedItems: ViewedItem[]) {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    const user = getCurrentUser();
    if (user) {
      pushUserDataToSync(user, undefined, viewedItems, undefined);
    }
  }, 5000);
}

// Event-driven auto-sync watch history with Sync when user is logged in
if (typeof window !== 'undefined') {
  watch(
    viewHistory,
    (newVal) => {
      debouncedSyncToSync(newVal);
    },
    { deep: true }
  );
}

export function useHistory() {
  return {
    searchHistory,
    viewHistory,
    addSearchTerm,
    addViewedItem
  };
}
