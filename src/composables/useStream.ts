import { useStorage } from "@vueuse/core";
import { ref } from "vue";
import { getSyncClient } from "../lib/syncClient";

export const serverOrder = ref<string[] | null>(null);

interface MovieServer {
  serverIndex: number;
  type: 'movie' | 'tv';
  season: number;
  episode: number;
}

interface StreamData {
  movieServerMap: Record<string, MovieServer>;
  version?: number;
}

export interface Server {
  name: string;
  urlTemplate: string;
  isApiProvider?: boolean; // Flag for providers that need API calls instead of direct URLs
}

const defaultStreamData: StreamData = {
  movieServerMap: {}
};

export const streamData = useStorage<StreamData>('streamData', defaultStreamData);

// Keep the single first-party Moovie player as the only playback server.
if (typeof window !== 'undefined') {
  localStorage.setItem('watchable_server_v', '17');
  localStorage.setItem('default_server_id', 'moovie');
}

export const movieServers = ref<Server[]>([
  { name: 'Moovie', urlTemplate: '', isApiProvider: true }
]);

export const tvServers = ref<Server[]>([
  { name: 'Moovie', urlTemplate: '', isApiProvider: true }
]);

const idToNameMap: Record<string, string> = {
  moovie: 'Moovie'
};

export const isDefaultServerLoaded = ref(false);

// Synchronously load default server from cache on module evaluation
const cachedDefaultServer = typeof window !== 'undefined' ? localStorage.getItem('default_server_id') : null;
if (cachedDefaultServer) {
  const targetName = idToNameMap[cachedDefaultServer.toLowerCase()];
  if (targetName) {
    const targetNameLower = targetName.toLowerCase();
    const movieIndex = movieServers.value.findIndex(s => s.name.toLowerCase() === targetNameLower);
    if (movieIndex > 0) {
      const [server] = movieServers.value.splice(movieIndex, 1);
      movieServers.value.unshift(server);
    }
    const tvIndex = tvServers.value.findIndex(s => s.name.toLowerCase() === targetNameLower);
    if (tvIndex > 0) {
      const [server] = tvServers.value.splice(tvIndex, 1);
      tvServers.value.unshift(server);
    }
  }
}

function isMobileClient(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.startsWith('m.') || 
         /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(window.navigator.userAgent);
}

async function fetchDefaultServerId() {
  try {
    const sync = await getSyncClient();
    const settingsKey = isMobileClient() ? 'default_provider_mobile' : 'default_provider';
    const { data } = await sync
      .from('app_settings')
      .select('value')
      .eq('key', settingsKey)
      .single();
    if (data && data.value) {
      return data.value;
    }
  } catch (e) {
    console.warn('Failed to fetch default provider from Sync, using local default:', e);
  }
  return 'moovie';
}

export async function loadDefaultServer() {
  try {
    const defaultServerId = await fetchDefaultServerId();
    if (!defaultServerId) return;

    if (typeof window !== 'undefined') {
      localStorage.setItem('default_server_id', defaultServerId);
    }

    const targetName = idToNameMap[defaultServerId.toLowerCase()];
    if (!targetName) return;

    const targetNameLower = targetName.toLowerCase();
    
    // Rearrange movieServers
    const movieIndex = movieServers.value.findIndex(s => s.name.toLowerCase() === targetNameLower);
    if (movieIndex > 0) {
      const [server] = movieServers.value.splice(movieIndex, 1);
      movieServers.value.unshift(server);
    }

    // Rearrange tvServers
    const tvIndex = tvServers.value.findIndex(s => s.name.toLowerCase() === targetNameLower);
    if (tvIndex > 0) {
      const [server] = tvServers.value.splice(tvIndex, 1);
      tvServers.value.unshift(server);
    }
  } catch (e) {
    console.error('Error loading default server:', e);
  } finally {
    isDefaultServerLoaded.value = true;
  }
}

// Call loadDefaultServer immediately
loadDefaultServer();
fetchServerOrder();

export const currentStreamData = ref({
  currentStreamId: 0,
  currentServer: 0,
  currentType: 'movie' as 'movie' | 'tv',
  currentSeason: 0,
  currentEpisode: 0
});

export function getPreferredStreamData(mediaId: number | string, type: 'movie' | 'tv' = 'movie'): MovieServer | null {
  const id = String(mediaId);

  if (!id) {
    console.warn('Invalid media ID provided');
    return null;
  }

  const savedData = streamData.value.movieServerMap[id];

  if (savedData) {
    currentStreamData.value = {
      currentStreamId: Number(id),
      currentServer: savedData.serverIndex,
      currentType: savedData.type,
      currentSeason: savedData.season,
      currentEpisode: savedData.episode
    };
    return savedData;
  }

  currentStreamData.value = {
    currentStreamId: Number(id),
    currentServer: 0,
    currentType: type,
    currentSeason: type === 'tv' ? 1 : 0,
    currentEpisode: type === 'tv' ? 1 : 0
  };

  return null;
}

export function savePreferredServer(mediaId: string | number, serverIndex: number, type: 'movie' | 'tv' = 'movie'): void {
  if (serverIndex < 0 || serverIndex >= (type === 'movie' ? movieServers.value : tvServers.value).length) {
    console.warn('Invalid server index');
    return;
  }

  const id = String(mediaId);

  streamData.value.movieServerMap[id] = {
    serverIndex,
    type,
    season: type === 'tv' ? (streamData.value.movieServerMap[id]?.season || 1) : 0,
    episode: type === 'tv' ? (streamData.value.movieServerMap[id]?.episode || 1) : 0
  };

  currentStreamData.value.currentServer = serverIndex;
  currentStreamData.value.currentType = type;
}

export function saveLastWatchedMetaData(
  mediaId: string | number,
  type: 'movie' | 'tv',
  meta: {
    season: number;
    episode: number;
  }
): void {
  if (type === 'tv' && (meta.season < 1 || meta.episode < 1)) {
    console.warn('Invalid season or episode number');
    return;
  }

  const id = String(mediaId);

  streamData.value.movieServerMap[id] = {
    serverIndex: streamData.value.movieServerMap[id]?.serverIndex || 0,
    type,
    season: meta.season,
    episode: meta.episode
  };

  currentStreamData.value.currentType = type;
  currentStreamData.value.currentSeason = meta.season;
  currentStreamData.value.currentEpisode = meta.episode;
}

export function getLastWatchedMetaData(mediaId: string | number): MovieServer | null {
  const id = String(mediaId);
  return streamData.value.movieServerMap[id] || null;
}

export function getServers(type: 'movie' | 'tv' = 'movie'): Server[] {
  const servers = type === 'movie' ? movieServers.value : tvServers.value;
  return servers.filter(s => s.isApiProvider);
}

export async function fetchServerOrder() {
  try {
    const sync = await getSyncClient();
    const { data } = await sync
      .from('app_settings')
      .select('value')
      .eq('key', 'server_order')
      .single();
    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed)) serverOrder.value = parsed;
    }
  } catch {
    // ignore
  }
}

export function setServerOrder(order: string[]) {
  serverOrder.value = order;
}

export function buildStreamUrl(
  mediaId: string | number,
  type: 'movie' | 'tv' = 'movie',
  serverIndex: number = 0,
  season: number = 1,
  episode: number = 1,
  timestamp?: number,
  _movieTitle?: string,
  _year?: number
): string {
  const id = String(mediaId);
  const servers = getServers(type);

  if (serverIndex < 0 || serverIndex >= servers.length) {
    console.warn('Invalid server index, using default');
    serverIndex = 0;
  }

  const server = servers[serverIndex] || servers[0];
  
  // Handle regular URL template providers
  let url: string;

  if (type === 'movie') {
    url = server.urlTemplate.replace('{tmdbId}', id);
  } else {
    url = server.urlTemplate
      .replace('{externalId}', id)
      .replace('{season}', String(Math.max(1, season)))
      .replace('{episode}', String(Math.max(1, episode)));
  }

  // Add timestamp parameter for sync functionality
  if (timestamp !== undefined && timestamp > 0) {
    const timestampSeconds = Math.floor(timestamp);
    const serverName = server.name.toLowerCase();
    
    // Different servers use different timestamp parameters
    if (serverName.includes('vidking')) {
      // VidKing uses 'progress' parameter
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}progress=${timestampSeconds}`;
    } else if (serverName.includes('111movies')) {
      url += `?progress=${timestampSeconds}`;
    } else if (serverName.includes('vidlink')) {
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}startAt=${timestampSeconds}`;
    }
  }

  return url;
}
