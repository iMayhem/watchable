import { useStorage } from '@vueuse/core';
import { computed, watch } from 'vue';
import { getCurrentUser, pushUserDataToSupabase, syncUserDataWithSupabase } from '../lib/auth';

export interface WatchlistItem {
  id: number | string;
  title: string;
  image: string | null;
  rating: number;
  categories: number[];
  adult: boolean;
  type: 'movie' | 'tv' | 'anime';
  addedAt?: number;
  watched?: boolean;
  watchedAt?: number;
}

export interface WatchlistList {
  id: string;
  name: string;
  items: WatchlistItem[];
  createdAt: number;
  updatedAt: number;
}

export interface WatchlistCollection {
  version: 2;
  activeListId: string;
  lists: WatchlistList[];
}

export const MAIN_WATCHLIST_ID = 'main';

const WATCHLIST_KEY = 'watchlist';
const SYNC_REMINDER_KEY = 'watchlist_sync_reminder_shown';

export function createDefaultCollection(): WatchlistCollection {
  const now = Date.now();
  return {
    version: 2,
    activeListId: MAIN_WATCHLIST_ID,
    lists: [{
      id: MAIN_WATCHLIST_ID,
      name: 'Watchlist',
      items: [],
      createdAt: now,
      updatedAt: now
    }]
  };
}

function normalizeList(raw: Partial<WatchlistList>): WatchlistList {
  const now = Date.now();
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `list-${now}`,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Watchlist',
    items: Array.isArray(raw.items) ? raw.items : [],
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now
  };
}

export function normalizeWatchlistStorage(raw: unknown): WatchlistCollection {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Partial<WatchlistCollection>;
    if (Array.isArray(obj.lists) && obj.lists.length > 0) {
      const lists = obj.lists.map(normalizeList);
      const activeListId = lists.some(list => list.id === obj.activeListId)
        ? (obj.activeListId as string)
        : lists[0].id;
      return {
        version: 2,
        activeListId,
        lists
      };
    }
  }

  if (Array.isArray(raw)) {
    const now = Date.now();
    return {
      version: 2,
      activeListId: MAIN_WATCHLIST_ID,
      lists: [{
        id: MAIN_WATCHLIST_ID,
        name: 'Watchlist',
        items: raw as WatchlistItem[],
        createdAt: now,
        updatedAt: now
      }]
    };
  }

  return createDefaultCollection();
}

function mergeItems(existing: WatchlistItem[], incoming: WatchlistItem[]): WatchlistItem[] {
  const seen = new Set(existing.map(item => `${item.type}-${item.id}`));
  const merged = [...existing];
  for (const item of incoming) {
    const key = `${item.type}-${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

function mergeCollections(
  local: WatchlistCollection,
  cloud: WatchlistCollection
): WatchlistCollection {
  const listsById = new Map<string, WatchlistList>();

  for (const list of cloud.lists) {
    listsById.set(list.id, { ...list, items: [...list.items] });
  }

  for (const localList of local.lists) {
    const existing = listsById.get(localList.id);
    if (!existing) {
      listsById.set(localList.id, { ...localList, items: [...localList.items] });
      continue;
    }

    const mergedItems = localList.id === MAIN_WATCHLIST_ID
      ? mergeItems(existing.items, localList.items)
      : (localList.updatedAt >= existing.updatedAt ? localList.items : existing.items);

    listsById.set(localList.id, {
      ...existing,
      name: localList.updatedAt >= existing.updatedAt ? localList.name : existing.name,
      items: mergedItems,
      updatedAt: Math.max(existing.updatedAt, localList.updatedAt)
    });
  }

  const lists = Array.from(listsById.values());
  const activeListId = lists.some(list => list.id === local.activeListId)
    ? local.activeListId
    : (lists.some(list => list.id === cloud.activeListId) ? cloud.activeListId : MAIN_WATCHLIST_ID);

  return {
    version: 2,
    activeListId,
    lists
  };
}

function nextImportListName(lists: WatchlistList[]): string {
  const used = new Set(lists.map(list => list.name.trim().toLowerCase()));
  let n = 1;
  while (used.has(`watchlist ${n}`)) n += 1;
  return `Watchlist ${n}`;
}

function createImportListId(): string {
  return `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getList(collection: WatchlistCollection, listId: string): WatchlistList | undefined {
  return collection.lists.find(list => list.id === listId);
}

function updateCollection(mutator: (collection: WatchlistCollection) => WatchlistCollection) {
  watchlistCollection.value = mutator(watchlistCollection.value);
}

function updateList(
  listId: string,
  mutator: (list: WatchlistList) => WatchlistList
) {
  updateCollection(collection => ({
    ...collection,
    lists: collection.lists.map(list =>
      list.id === listId
        ? mutator({ ...list, updatedAt: Date.now() })
        : list
    )
  }));
}

const initialCollection = typeof window !== 'undefined'
  ? normalizeWatchlistStorage(
      JSON.parse(localStorage.getItem(WATCHLIST_KEY) || 'null')
    )
  : createDefaultCollection();

export const watchlistCollection = useStorage<WatchlistCollection>(
  WATCHLIST_KEY,
  initialCollection
);

if (typeof window !== 'undefined') {
  watchlistCollection.value = normalizeWatchlistStorage(watchlistCollection.value);
}

export const watchlistLists = computed(() => watchlistCollection.value.lists);

export const activeWatchlistId = computed({
  get: () => watchlistCollection.value.activeListId,
  set: (listId: string) => {
    if (!getList(watchlistCollection.value, listId)) return;
    watchlistCollection.value = {
      ...watchlistCollection.value,
      activeListId: listId
    };
  }
});

export const activeWatchlist = computed(
  () => getList(watchlistCollection.value, watchlistCollection.value.activeListId)
    ?? watchlistCollection.value.lists[0]
);

export const watchlist = computed(() => getMainListItems());

function getMainListItems(): WatchlistItem[] {
  return getList(watchlistCollection.value, MAIN_WATCHLIST_ID)?.items ?? [];
}

function showSyncReminder() {
  if (typeof window === 'undefined') return;

  const user = getCurrentUser();
  if (user) return;

  const reminderShown = sessionStorage.getItem(SYNC_REMINDER_KEY);
  if (reminderShown) return;

  sessionStorage.setItem(SYNC_REMINDER_KEY, 'true');
  window.dispatchEvent(new CustomEvent('watchlist_sync_reminder', {
    detail: { message: 'Sign in to sync your watchlist to the cloud and access it from any device.' }
  }));
}

if (typeof window !== 'undefined') {
  watch(
    watchlistCollection,
    (newVal) => {
      const user = getCurrentUser();
      if (user) {
        void pushUserDataToSupabase(user, newVal);
      }
    },
    { deep: true }
  );

  const handleAuthOrDataChange = () => {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return;
    try {
      watchlistCollection.value = normalizeWatchlistStorage(JSON.parse(raw));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAuthChange = async () => {
    const user = getCurrentUser();
    if (user) {
      const localCollection = normalizeWatchlistStorage(watchlistCollection.value);
      await syncUserDataWithSupabase(user);
      const cloudCollection = normalizeWatchlistStorage(watchlistCollection.value);
      const merged = mergeCollections(localCollection, cloudCollection);
      watchlistCollection.value = merged;
      await pushUserDataToSupabase(user, merged);

      window.dispatchEvent(new CustomEvent('watchlist_synced', {
        detail: { message: 'Watchlist synced to cloud successfully!' }
      }));
    }

    handleAuthOrDataChange();
  };

  window.addEventListener('movora_auth_change', handleAuthChange);
  window.addEventListener('movora_userdata_change', handleAuthOrDataChange);

  const currentUser = getCurrentUser();
  if (currentUser) {
    void syncUserDataWithSupabase(currentUser);
  }
}

export function setActiveWatchlist(listId: string): void {
  activeWatchlistId.value = listId;
}

export function renameWatchlistList(listId: string, name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || !getList(watchlistCollection.value, listId)) return false;

  updateList(listId, list => ({ ...list, name: trimmed }));
  return true;
}

export function importWatchlistAsNewList(items: WatchlistItem[]): string {
  const id = createImportListId();
  const name = nextImportListName(watchlistCollection.value.lists);
  const now = Date.now();
  const newList: WatchlistList = {
    id,
    name,
    items,
    createdAt: now,
    updatedAt: now
  };

  watchlistCollection.value = {
    ...watchlistCollection.value,
    activeListId: id,
    lists: [...watchlistCollection.value.lists, newList]
  };

  return name;
}

export function deleteWatchlistList(listId: string): boolean {
  if (listId === MAIN_WATCHLIST_ID) return false;
  const lists = watchlistCollection.value.lists.filter(list => list.id !== listId);
  if (lists.length === watchlistCollection.value.lists.length) return false;

  const nextActive = watchlistCollection.value.activeListId === listId
    ? MAIN_WATCHLIST_ID
    : watchlistCollection.value.activeListId;

  watchlistCollection.value = {
    version: 2,
    activeListId: nextActive,
    lists
  };
  return true;
}

export function isInWatchlist(id: number | string, type: 'movie' | 'tv' | 'anime'): boolean {
  return getMainListItems().some(item => String(item.id) === String(id) && item.type === type);
}

export function addToWatchlist(item: WatchlistItem): void {
  if (!isInWatchlist(item.id, item.type)) {
    updateList(MAIN_WATCHLIST_ID, list => ({
      ...list,
      items: [{
        ...item,
        addedAt: item.addedAt ?? Date.now()
      }, ...list.items]
    }));
    showSyncReminder();
  }
}

export function removeFromWatchlist(
  id: number | string,
  type: 'movie' | 'tv' | 'anime',
  listId = watchlistCollection.value.activeListId
): void {
  updateList(listId, list => ({
    ...list,
    items: list.items.filter(item => !(String(item.id) === String(id) && item.type === type))
  }));
}

export function toggleWatchlistItem(item: WatchlistItem): void {
  if (isInWatchlist(item.id, item.type)) {
    removeFromWatchlist(item.id, item.type, MAIN_WATCHLIST_ID);
  } else {
    addToWatchlist(item);
  }
}

export function setWatched(
  id: number | string,
  type: 'movie' | 'tv' | 'anime',
  watched: boolean,
  listId = watchlistCollection.value.activeListId
): void {
  updateList(listId, list => {
    const idx = list.items.findIndex(
      item => String(item.id) === String(id) && item.type === type
    );
    if (idx === -1) return list;

    const nextItems = [...list.items];
    nextItems[idx] = {
      ...nextItems[idx],
      watched,
      watchedAt: watched ? Date.now() : undefined
    };
    return { ...list, items: nextItems };
  });
}

export function isWatched(id: number | string, type: 'movie' | 'tv' | 'anime'): boolean {
  return getMainListItems().some(
    item => String(item.id) === String(id) && item.type === type && item.watched === true
  );
}

export function clearWatchlist(listId = watchlistCollection.value.activeListId): void {
  updateList(listId, list => ({ ...list, items: [] }));
}

export async function syncWatchlistToSupabase(): Promise<boolean> {
  const user = getCurrentUser();
  if (!user) return false;
  return pushUserDataToSupabase(user, watchlistCollection.value);
}

export function useWatchlist() {
  return {
    watchlistCollection,
    watchlistLists,
    activeWatchlistId,
    activeWatchlist,
    watchlist,
    setActiveWatchlist,
    renameWatchlistList,
    importWatchlistAsNewList,
    deleteWatchlistList,
    isInWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    toggleWatchlistItem,
    setWatched,
    isWatched,
    clearWatchlist,
    syncWatchlistToSupabase
  };
}