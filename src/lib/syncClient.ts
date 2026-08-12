// Self-hosted sync client — talks to the VPS sync server via hahaevilcraft.site
// (/api REST + /sync-ws realtime). Fluent API surface (from().select().eq(),
// channel().on().subscribe(), storage) so consumer code is concise.

const API_ORIGIN = 'https://hahaevilcraft.site';
const WS_URL = 'wss://hahaevilcraft.site/sync-ws';

export interface SyncResponse<T = any> {
    data: T | null;
    error: { message: string; code?: string } | null;
    count?: number;
}

interface Filters {
    eq: Record<string, string>;
    gte: Record<string, string>;
    lte: Record<string, string>;
    neq: Record<string, string>;
    in: Record<string, string[]>;
    order: string | null;
    limit: number | null;
    onConflict: string | null;
}

async function apiRequest(method: string, path: string, body?: unknown): Promise<any> {
    const headers: Record<string, string> = {};
    if (typeof window !== 'undefined') {
        const token = window.localStorage.getItem('movora_token');
        if (token) headers.Authorization = `Bearer ${token}`;
    }
    const opts: RequestInit = { method, headers };
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }
    if (method === 'GET') {
        path += (path.indexOf('?') >= 0 ? '&' : '?') + '_cb=' + Date.now();
    }
    const res = await fetch(API_ORIGIN + path, opts);
    let parsed: any = {};
    try {
        parsed = await res.json();
    } catch (e) {
        parsed = { data: null };
    }
    parsed.status = res.status;
    return parsed;
}

function projectRow(row: any, select: string): any {
    if (!select || select === '*') return row;
    const cols = select.split(',').map((c) => c.trim()).filter(Boolean);
    const out: Record<string, unknown> = {};
    for (const c of cols) if (row[c] !== undefined) out[c] = row[c];
    return out;
}

// ---------------------------------------------------------------- builder ----

class QueryBuilder {
    private table: string;
    private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
    private selectCols = '*';
    private head = false;
    private mode: 'single' | 'maybeSingle' | null = null;
    private filters: Filters = { eq: {}, gte: {}, lte: {}, neq: {}, in: {}, order: null, limit: null, onConflict: null };
    private body: unknown;

    constructor(table: string) {
        this.table = table;
    }

    eq(col: string, val: unknown) { this.filters.eq[col] = String(val); return this; }
    gte(col: string, val: unknown) { this.filters.gte[col] = String(val); return this; }
    lte(col: string, val: unknown) { this.filters.lte[col] = String(val); return this; }
    neq(col: string, val: unknown) { this.filters.neq[col] = String(val); return this; }
    in(col: string, vals: unknown[]) { this.filters.in[col] = vals.map(String); return this; }
    order(col: string, opts?: { ascending?: boolean }) {
        this.filters.order = opts && opts.ascending === false ? `${col}.desc` : `${col}.asc`;
        return this;
    }
    limit(n: number) { this.filters.limit = n; return this; }
    select(cols?: string, opts?: { count?: 'exact'; head?: boolean }) {
        if (this.op !== 'insert' && this.op !== 'update' && this.op !== 'upsert' && this.op !== 'delete') {
            this.op = 'select';
        }
        if (cols) this.selectCols = cols;
        if (opts?.head) this.head = true;
        return this;
    }
    single() { this.mode = 'single'; return this; }
    maybeSingle() { this.mode = 'maybeSingle'; return this; }
    insert(rows: unknown) { this.op = 'insert'; this.body = rows; return this; }
    update(patch: unknown) { this.op = 'update'; this.body = patch; return this; }
    upsert(row: unknown, opts?: { onConflict?: string }) {
        this.op = 'upsert';
        this.body = row;
        this.filters.onConflict = opts?.onConflict ?? null;
        return this;
    }
    delete() { this.op = 'delete'; return this; }

    private buildParams(): string {
        const params = new URLSearchParams();
        params.set('select', this.selectCols);
        for (const [k, v] of Object.entries(this.filters.eq)) params.set(`eq.${k}`, v);
        for (const [k, v] of Object.entries(this.filters.gte)) params.set(`gte.${k}`, v);
        for (const [k, v] of Object.entries(this.filters.lte)) params.set(`lte.${k}`, v);
        for (const [k, v] of Object.entries(this.filters.neq)) params.set(`neq.${k}`, v);
        for (const [k, v] of Object.entries(this.filters.in)) params.set(`in.${k}`, v.join(','));
        if (this.filters.order) params.set('order', this.filters.order);
        if (this.filters.limit != null) params.set('limit', String(this.filters.limit));
        if (this.head) params.set('head', 'true');
        if (this.mode === 'single') params.set('single', 'true');
        if (this.filters.onConflict) params.set('onConflict', this.filters.onConflict);
        // Cache-buster: Cloudflare caches /api/* responses (7-day edge TTL),
        // which can serve stale 404s/data. A fixed version param forces fresh URLs.
        params.set('_cb', '1');
        return params.toString();
    }

    private async execute(): Promise<SyncResponse> {
        const path = `/api/${this.table}?${this.buildParams()}`;
        let res: any;
        if (this.op === 'select') res = await apiRequest('GET', path);
        else if (this.op === 'insert') res = await apiRequest('POST', path, this.body);
        else if (this.op === 'update') res = await apiRequest('PATCH', path, this.body);
        else if (this.op === 'upsert') res = await apiRequest('PUT', path, this.body);
        else res = await apiRequest('DELETE', path);

        if (res?.error) {
            if (this.mode === 'maybeSingle') return { data: null, error: null };
            return { data: null, error: res.error, count: 0 };
        }
        if (this.head) return { data: [], error: null, count: res?.count ?? 0 };

        let data = res?.data ?? [];
        if (!Array.isArray(data)) data = [data];
        if (this.selectCols !== '*' && this.op === 'select') {
            data = data.map((r: any) => projectRow(r, this.selectCols));
        }
        if (this.op !== 'select' && this.selectCols !== '*') {
            data = data.map((r: any) => projectRow(r, this.selectCols));
        }
        if (this.mode === 'single') {
            if (!data.length) return { data: null, error: { message: 'No rows found' }, count: 0 };
            return { data: data[0], error: null, count: 1 };
        }
        if (this.mode === 'maybeSingle') {
            return { data: data.length ? data[0] : null, error: null, count: 0 };
        }
        return { data, error: null, count: data.length };
    }

    then<TResult1 = SyncResponse, TResult2 = never>(
        onfulfilled?: ((value: SyncResponse) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> {
        return this.execute().then(onfulfilled, onrejected);
    }
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null): Promise<SyncResponse | TResult> {
        return this.execute().catch(onrejected);
    }
}

// ---------------------------------------------------------------- realtime ----

type WsHandler = (msg: any) => void;

let sharedWs: WebSocket | null = null;
let wsQueue: unknown[] = [];
const wsListeners = new Set<WsHandler>();

function ensureWs(): WebSocket {
    if (sharedWs && (sharedWs.readyState === WebSocket.OPEN || sharedWs.readyState === WebSocket.CONNECTING)) {
        return sharedWs;
    }
    sharedWs = new WebSocket(WS_URL);
    sharedWs.onopen = () => {
        for (const msg of wsQueue) {
            try { sharedWs?.send(JSON.stringify(msg)); } catch (e) {}
        }
        wsQueue = [];
    };
    sharedWs.onmessage = (ev) => {
        let msg: any;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        wsListeners.forEach((fn) => fn(msg));
    };
    sharedWs.onclose = () => {
        wsListeners.forEach((fn) => fn({ type: 'ws_closed' }));
        sharedWs = null;
        setTimeout(ensureWs, 1500);
    };
    return sharedWs;
}

function wsSend(msg: unknown) {
    const ws = ensureWs();
    if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify(msg)); } catch (e) {}
    } else {
        wsQueue.push(msg);
    }
}

class RealtimeChannel {
    private name: string;
    private presenceKey: string | null;
    private broadcastHandlers: Record<string, Array<(payload: any) => void>> = {};
    private presenceHandlers: Record<string, Array<(args: any) => void>> = {};
    private pgHandlers: Array<(payload: any) => void> = [];
    private _presenceState: Record<string, any[]> = {};
    private subscribed = false;
    private subscribeCallbacks: Array<(status: string) => void> = [];

    constructor(name: string, opts?: any) {
        this.name = name;
        this.presenceKey = opts?.config?.presence?.key ?? null;
        wsListeners.add((msg) => this.onWsMessage(msg));
    }

    private onWsMessage(msg: any) {
        if (msg.type === 'ws_closed') {
            this.subscribed = false;
            return;
        }
        if (msg.type === 'broadcast' && msg.channel === this.name) {
            const cbs = this.broadcastHandlers[msg.event] || [];
            cbs.forEach((cb) => cb({ type: 'broadcast', event: msg.event, payload: msg.payload }));
            return;
        }
        if (msg.type === 'presence_sync' && msg.room === this.name) {
            this._presenceState = msg.members || {};
            this.firePresence('sync', null);
            this.maybeSubscribed();
            return;
        }
        if (msg.type === 'presence_diff' && msg.room === this.name) {
            const reAdded: Record<string, boolean> = {};
            if (msg.add) {
                for (const [key, presences] of Object.entries(msg.add as Record<string, any[]>)) {
                    this._presenceState[key] = presences;
                    reAdded[key] = true;
                    this.firePresence('join', { key, newPresences: presences });
                }
            }
            if (msg.remove) {
                for (const [key, presences] of Object.entries(msg.remove as Record<string, any[]>)) {
                    // A remove paired with an add for the same key is a re-track
                    // update, not a real leave — don't delete the entry.
                    if (reAdded[key]) continue;
                    delete this._presenceState[key];
                    this.firePresence('leave', { key, leftPresences: presences });
                }
            }
            return;
        }
        if (msg.type === 'rooms_changed') {
            this.pgHandlers.forEach((cb) => cb({ new: {} }));
            return;
        }
        if (msg.type === 'lobby_ready' && this.name === 'lobby_rooms_feed') {
            this.maybeSubscribed();
        }
    }

    private firePresence(event: string, args: any) {
        const cbs = this.presenceHandlers[event] || [];
        cbs.forEach((cb) => {
            try { cb(args); } catch (e) {}
        });
    }

    private maybeSubscribed() {
        if (this.subscribed) return;
        this.subscribed = true;
        this.subscribeCallbacks.forEach((cb) => {
            try { cb('SUBSCRIBED'); } catch (e) {}
        });
    }

    on(type: 'broadcast' | 'presence' | 'postgres_changes', cfg: any, cb: any) {
        if (type === 'broadcast') {
            const event = cfg?.event ?? '*';
            (this.broadcastHandlers[event] = this.broadcastHandlers[event] || []).push(cb);
        } else if (type === 'presence') {
            const event = cfg?.event ?? 'sync';
            (this.presenceHandlers[event] = this.presenceHandlers[event] || []).push(cb);
        } else if (type === 'postgres_changes') {
            this.pgHandlers.push(cb);
        }
        return this;
    }

    subscribe(cb?: (status: string) => void) {
        if (typeof cb === 'function') this.subscribeCallbacks.push(cb);
        wsSend({ type: 'join_room', room: this.name });
        return Promise.resolve({ ok: true });
    }

    send(msg: { type: 'broadcast'; event: string; payload?: unknown }) {
        if (!msg || msg.type !== 'broadcast') return;
        wsSend({ type: 'broadcast', room: this.name, event: msg.event, payload: msg.payload || {} });
    }

    track(payload: Record<string, unknown>) {
        if (!this.presenceKey) return Promise.resolve();
        wsSend({ type: 'presence_track', room: this.name, key: this.presenceKey, payload: payload || {} });
        return Promise.resolve();
    }

    untrack() {
        if (!this.presenceKey) return Promise.resolve();
        wsSend({ type: 'presence_untrack', room: this.name, key: this.presenceKey });
        return Promise.resolve();
    }

    presenceState() {
        return this._presenceState;
    }

    close() {
        wsSend({ type: 'leave_room', room: this.name });
        this.subscribed = false;
        wsListeners.delete((msg: any) => this.onWsMessage(msg));
    }
}

// ---------------------------------------------------------------- client ----

interface SyncClient {
    from(table: string): QueryBuilder;
    channel(name: string, opts?: any): RealtimeChannel;
    removeChannel(ch: RealtimeChannel): Promise<void>;
    storage: {
        from(bucket: string): {
            upload(name: string, blob: Blob, opts?: { contentType?: string }): Promise<SyncResponse<{ path: string }>>;
            getPublicUrl(name: string): { data: { publicUrl: string } };
        };
    };
}

let _clientPromise: Promise<SyncClient> | null = null;

export function getSyncClient(): Promise<SyncClient> {
    if (!_clientPromise) {
        _clientPromise = Promise.resolve({
            from: (table: string) => new QueryBuilder(table),
            channel: (name: string, opts?: any) => new RealtimeChannel(name, opts),
            removeChannel: (ch: RealtimeChannel) => {
                ch.close();
                return Promise.resolve();
            },
            storage: {
                from: (bucket: string) => ({
                    upload: (name: string, blob: Blob) =>
                        fetch(
                            `${API_ORIGIN}/api/uploads?bucket=${encodeURIComponent(bucket)}&name=${encodeURIComponent(String(name))}`,
                            { method: 'POST', body: blob }
                        )
                            .then((r) => r.json())
                            .then((res) => ({
                                data: res.error ? null : { path: `${bucket}/${String(name)}` },
                                error: res.error || null,
                            })),
                    getPublicUrl: (name: string) => ({
                        data: {
                            publicUrl: `${API_ORIGIN}/api/uploads/${encodeURIComponent(bucket)}/${encodeURIComponent(String(name))}`,
                        },
                    }),
                }),
            },
        });
    }
    return _clientPromise;
}
