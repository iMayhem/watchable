import { createDefaultCollection, normalizeWatchlistStorage } from '../composables/useWatchlist';

export interface UserAccount {
    username: string;
    passwordHash: string;
    createdAt: string;
}

const API_ORIGIN = 'https://proxy.moovie.fun';

interface ApiResult {
    data: any;
    error: { message: string; code?: string } | null;
    status?: number;
}

async function apiCall(method: string, path: string, body?: unknown, auth = false): Promise<ApiResult> {
    const headers: Record<string, string> = {};
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }
    if (auth) {
        const token = typeof window !== 'undefined' ? window.localStorage.getItem('movora_token') : null;
        if (token) headers.Authorization = `Bearer ${token}`;
    }
    try {
        const res = await fetch(API_ORIGIN + path, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const parsed = await res.json().catch(() => ({ data: null }));
        return { data: parsed.data ?? null, error: parsed.error ?? null, status: res.status };
    } catch (e: any) {
        return { data: null, error: { message: e?.message || 'Network error' } };
    }
}

function applyLocalUserData(user: any) {
    if (user.watchlist) {
        window.localStorage.setItem('watchlist', JSON.stringify(normalizeWatchlistStorage(user.watchlist)));
    }
    if (user.watch_history) {
        window.localStorage.setItem('viewHistory', JSON.stringify(user.watch_history));
    }
    if (user.search_history) {
        window.localStorage.setItem('searchHistory', JSON.stringify(user.search_history));
    }
    window.dispatchEvent(new Event('movora_userdata_change'));
}

function completeLogin(username: string, token: string) {
    window.localStorage.setItem('movora_current_user', username);
    window.localStorage.setItem('watch_username', username);
    if (token) window.localStorage.setItem('movora_token', token);
    window.dispatchEvent(new Event('movora_auth_change'));
}

// Register Account
export async function registerUser(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (typeof window === 'undefined') return { success: false };

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || cleanUsername.length < 3) {
        return { success: false, error: 'Username must be at least 3 characters long.' };
    }
    if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    const res = await apiCall('POST', '/api/sync-auth/register', { username: cleanUsername, password });
    if (res.error || !res.data?.token) {
        return { success: false, error: res.error?.message || 'Failed to create account. Please try again.' };
    }

    completeLogin(cleanUsername, res.data.token);
    window.localStorage.setItem('watchlist', JSON.stringify(createDefaultCollection()));
    return { success: true };
}

// Login Account
export async function loginUser(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (typeof window === 'undefined') return { success: false };

    const cleanUsername = username.trim().toLowerCase();
    const res = await apiCall('POST', '/api/sync-auth/login', { username: cleanUsername, password });
    if (res.error || !res.data?.token) {
        return { success: false, error: res.error?.message || 'Incorrect username or password.' };
    }

    completeLogin(cleanUsername, res.data.token);

    const userRes = await apiCall('GET', `/api/user/${encodeURIComponent(cleanUsername)}`);
    if (userRes.data) {
        applyLocalUserData(userRes.data);
    }
    return { success: true };
}

// Logout Account
export function logoutUser() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem('movora_current_user');
    window.localStorage.removeItem('watch_username');
    window.localStorage.removeItem('watchlist');
    window.localStorage.removeItem('movora_token');
    window.dispatchEvent(new Event('movora_auth_change'));
}

// Get Active Session
export function getCurrentUser(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('movora_current_user');
}

// Helper to push user lists to the VPS sync server
export async function pushUserDataToSupabase(
    username: string,
    watchlist?: unknown,
    watchHistory?: any[],
    searchHistory?: string[]
): Promise<boolean> {
    const updateData: Record<string, unknown> = {};

    if (watchlist !== undefined) {
        updateData.watchlist = normalizeWatchlistStorage(watchlist);
    }
    if (watchHistory !== undefined) {
        updateData.watch_history = watchHistory;
    }
    if (searchHistory !== undefined) {
        updateData.search_history = searchHistory;
    }

    if (!Object.keys(updateData).length) return true;

    const res = await apiCall(
        'PUT',
        `/api/user/${encodeURIComponent(username.toLowerCase())}`,
        updateData,
        true
    );
    return !res.error;
}

// Helper to fetch user lists from the VPS sync server
export async function syncUserDataWithSupabase(username: string) {
    if (typeof window === 'undefined' || !username) return;
    const res = await apiCall('GET', `/api/user/${encodeURIComponent(username.toLowerCase())}`);
    if (res.data) {
        applyLocalUserData(res.data);
    }
}

// Clear watch history
export async function clearWatchHistory(username: string) {
    const res = await apiCall(
        'PUT',
        `/api/user/${encodeURIComponent(username.toLowerCase())}`,
        { watch_history: [] },
        true
    );
    if (res.error) return false;
    window.localStorage.setItem('viewHistory', '[]');
    window.dispatchEvent(new Event('movora_userdata_change'));
    return true;
}

// Clear search history
export async function clearSearchHistory(username: string) {
    const res = await apiCall(
        'PUT',
        `/api/user/${encodeURIComponent(username.toLowerCase())}`,
        { search_history: [] },
        true
    );
    if (res.error) return false;
    window.localStorage.setItem('searchHistory', '[]');
    window.dispatchEvent(new Event('movora_userdata_change'));
    return true;
}
