import { useStorage } from "@vueuse/core";
import { ref } from "vue";
import { getSupabaseClient } from "../lib/supabase";

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

// Force Moovie X (index 0) as hardcoded default and flush stale browser caches
if (typeof window !== 'undefined') {
  const currentVer = localStorage.getItem('watchable_server_v');
  if (currentVer !== '11') {
    localStorage.setItem('watchable_server_v', '11');
    localStorage.setItem('default_server_id', 'moovie_x');
    localStorage.removeItem('streamData');
    if (streamData.value) {
      streamData.value = {
        movieServerMap: {},
        version: 11
      };
    }
  }
}

export const movieServers = ref<Server[]>([
  { name: 'Moovie X', urlTemplate: 'https://peestream.in/embed/?tmdbId={tmdbId}&type=movie' },
  { name: 'Moovie', urlTemplate: '', isApiProvider: true },
  { name: 'Sugar', urlTemplate: 'https://vidcodin.net/embed/movie/{tmdbId}' },
  { name: 'Icecream', urlTemplate: 'https://player.videasy.to/movie/{tmdbId}' },
  { name: 'Rasmalai', urlTemplate: 'https://peachify.top/embed/movie/{tmdbId}?autoPlay=true&autoplay=true&autoplay=1' },
  { name: 'Gulab Jamun', urlTemplate: 'https://cinemaos.live/player/{tmdbId}' },
  { name: 'Jalebi', urlTemplate: 'https://player.smashystream.com/movie/{tmdbId}?autoplay=true' },
  { name: 'Kaju Katli', urlTemplate: 'https://mappletv.uk/watch/movie/{tmdbId}' },
  { name: 'Motichoor Ladoo', urlTemplate: 'https://vidsuper.net/movie/{tmdbId}' },
  { name: 'Kheer', urlTemplate: 'https://www.vidking.net/embed/movie/{tmdbId}?autoPlay=true' },
  { name: 'Barfi', urlTemplate: 'https://player.videasy.net/movie/{tmdbId}?color=#4eb5ff' },
  { name: 'Laddu', urlTemplate: 'https://vidsrc-embed.ru/embed/movie/{tmdbId}' },
  { name: 'Peda', urlTemplate: 'https://vidsrc-embed.su/embed/movie/{tmdbId}' },
  { name: 'Gajar Ka Halwa', urlTemplate: 'https://vidsrcme.su/embed/movie/{tmdbId}' },
  { name: 'Soan Papdi', urlTemplate: 'https://multiembed.mov/?video_id={tmdbId}&tmdb=1' },
  { name: 'Sandesh', urlTemplate: 'https://vsrc.su/embed/movie/{tmdbId}' },
  { name: 'Cham Cham', urlTemplate: 'https://vidlink.pro/movie/{tmdbId}' },
  { name: 'Kulfi', urlTemplate: 'https://player.autoembed.app/embed/movie/{tmdbId}' },
  { name: 'Mysore Pak', urlTemplate: 'https://vidfast.pro/movie/{tmdbId}' },
  { name: 'Imarti', urlTemplate: 'https://111movies.com/movie/{tmdbId}' },
  { name: 'Ghevar', urlTemplate: 'https://vidora.su/movie/{tmdbId}?parameters' },
  { name: 'Cheesecake', urlTemplate: 'https://player.cinezo.live/embed/movie/{tmdbId}?autoplay=true' },
  { name: 'Nankhatai', urlTemplate: 'https://www.NontonGo.win/embed/movie/{tmdbId}' },
  { name: 'Petha', urlTemplate: 'https://www.NontonGo.win/player/movie/{tmdbId}?autoplay=true' },
  { name: 'Spoider', urlTemplate: 'https://screenscape.me/embed?tmdb={tmdbId}&type=movie' }
]);

export const tvServers = ref<Server[]>([
  { name: 'Moovie X', urlTemplate: 'https://peestream.in/embed/?tmdbId={externalId}&type=show&season={season}&episode={episode}' },
  { name: 'Moovie', urlTemplate: '', isApiProvider: true },
  { name: 'Sugar', urlTemplate: 'https://vidcodin.net/embed/tv/{externalId}/{season}/{episode}' },
  { name: 'Icecream', urlTemplate: 'https://player.videasy.to/tv/{externalId}/{season}/{episode}' },
  { name: 'Rasmalai', urlTemplate: 'https://peachify.top/embed/tv/{externalId}/{season}/{episode}?autoPlay=true&autoplay=true&autoplay=1' },
  { name: 'Gulab Jamun', urlTemplate: 'https://cinemaos.live/player/{externalId}/{season}/{episode}' },
  { name: 'Jalebi', urlTemplate: 'https://player.smashystream.com/tv/{externalId}?s={season}&e={episode}' },
  { name: 'Kaju Katli', urlTemplate: 'https://mappletv.uk/watch/tv/{externalId}/{season}/{episode}' },
  { name: 'Motichoor Ladoo', urlTemplate: 'https://vidsuper.net/tv/{externalId}/{season}/{episode}' },
  { name: 'Kheer', urlTemplate: 'https://www.vidking.net/embed/tv/{externalId}/{season}/{episode}?autoPlay=true&nextEpisode=true&episodeSelector=true' },
  { name: 'Barfi', urlTemplate: 'https://player.videasy.net/tv/{externalId}/{season}/{episode}?color=#4eb5ff&nextEpisode=true&autoplayNextEpisode=true&episodeSelector=true' },
  { name: 'Laddu', urlTemplate: 'https://vidsrc-embed.ru/embed/tv/{externalId}/{season}/{episode}' },
  { name: 'Peda', urlTemplate: 'https://vidsrc-embed.su/embed/tv/{externalId}/{season}/{episode}' },
  { name: 'Gajar Ka Halwa', urlTemplate: 'https://vidsrcme.su/embed/tv/{externalId}/{season}/{episode}' },
  { name: 'Soan Papdi', urlTemplate: 'https://multiembed.mov/?video_id={externalId}&tmdb=1&s={season}&e={episode}' },
  { name: 'Sandesh', urlTemplate: 'https://vsrc.su/embed/tv/{externalId}/{season}/{episode}' },
  { name: 'Cham Cham', urlTemplate: 'https://vidlink.pro/tv/{externalId}/{season}/{episode}' },
  { name: 'Kulfi', urlTemplate: 'https://player.autoembed.app/embed/tv/{externalId}/{season}/{episode}' },
  { name: 'Mysore Pak', urlTemplate: 'https://vidfast.pro/tv/{externalId}/{season}/{episode}' },
  { name: 'Imarti', urlTemplate: 'https://111movies.com/tv/{externalId}/{season}/{episode}' },
  { name: 'Ghevar', urlTemplate: 'https://vidora.su/tv/{externalId}/{season}/{episode}?autoplay=true' },
  { name: 'Cheesecake', urlTemplate: 'https://player.cinezo.live/embed/tv/{externalId}/{season}/{episode}?autoplay=true' },
  { name: 'Nankhatai', urlTemplate: 'https://www.NontonGo.win/embed/tv/{externalId}/{season}/{episode}' },
  { name: 'Petha', urlTemplate: 'https://www.NontonGo.win/player/tv/{externalId}/{season}/{episode}?autoplay=true' },
  { name: 'Spoider', urlTemplate: 'https://screenscape.me/embed?tmdb={externalId}&type=tv&s={season}&e={episode}' }
]);

const idToNameMap: Record<string, string> = {
  moovie: 'Moovie',
  moovie_x: 'Moovie X',
  sugar: 'Sugar',
  rasmalai: 'Rasmalai',
  cinemaos: 'Gulab Jamun',
  smashy: 'Jalebi',
  mappletv: 'Kaju Katli',
  vidking: 'Kheer',
  videasy: 'Barfi',
  vidsrc_ru: 'Laddu',
  vidsrc_su: 'Peda',
  vidsrcme: 'Gajar Ka Halwa',
  multiembed: 'Soan Papdi',
  vsrc: 'Sandesh',
  vidlink: 'Cham Cham',
  autoembed: 'Kulfi',
  vidfast: 'Mysore Pak',
  movies111: 'Imarti',
  vidora: 'Ghevar',
  vidsuper: 'Motichoor Ladoo',
  icecream: 'Icecream',
  cinezo: 'Cheesecake',
  nankhatai: 'Nankhatai',
  petha: 'Petha',
  spoider: 'Spoider'
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
    const supabase = await getSupabaseClient();
    const settingsKey = isMobileClient() ? 'default_provider_mobile' : 'default_provider';
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', settingsKey)
      .single();
    if (data && data.value) {
      return data.value;
    }
  } catch (e) {
    console.warn('Failed to fetch default provider from Supabase, using local default:', e);
  }
  return 'moovie_x';
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

function applyOrder(servers: Server[]): Server[] {
  if (!serverOrder.value || serverOrder.value.length === 0) return servers;
  const orderMap = new Map<string, number>();
  serverOrder.value.forEach((id, i) => {
    const name = idToNameMap[id.toLowerCase()];
    if (name) orderMap.set(name.toLowerCase(), i);
  });
  if (orderMap.size === 0) return servers;
  const ordered: (Server | null)[] = new Array(serverOrder.value.length).fill(null);
  const remaining: Server[] = [];
  for (const s of servers) {
    const idx = orderMap.get(s.name.toLowerCase());
    if (idx !== undefined) {
      ordered[idx] = s;
    } else {
      remaining.push(s);
    }
  }
  return [...ordered.filter(Boolean) as Server[], ...remaining];
}

export function getServers(type: 'movie' | 'tv' = 'movie'): Server[] {
  const servers = type === 'movie' ? movieServers.value : tvServers.value;
  return applyOrder(servers);
}

export async function fetchServerOrder() {
  try {
    const supabase = await getSupabaseClient();
    const { data } = await supabase
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
    } else if (serverName.includes('vidlink') || serverName.includes('vidfast') || serverName.includes('rasmalai') || serverName.includes('icecream')) {
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}startAt=${timestampSeconds}`;
    }
  }

  return url;
}