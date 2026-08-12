/* global window, fetch, WebSocket */
/**
 * Moovie self-hosted sync client.
 * Exposes window.moovieSync for party.js / admin.html:
 *   - REST: /api/* on hahaevilcraft.site (rooms, chat, settings, polls, ...)
 *   - Realtime: WebSocket /sync-ws (broadcast events, presence, lobby feed)
 *   - Storage: avatar / chat-image uploads served from the VPS
 * Zero dependencies.
 */
(function () {
    'use strict';

    var API_ORIGIN = 'https://proxy.moovie.fun';
    var WS_URL = 'wss://proxy.moovie.fun/sync-ws';

    function apiRequest(method, path, body, isRawBody) {
        var opts = {
            method: method,
            headers: {},
        };
        if (body !== undefined) {
            if (isRawBody) {
                opts.body = body;
            } else {
                opts.headers['Content-Type'] = 'application/json';
                opts.body = JSON.stringify(body);
            }
        }
        if (method === 'GET') {
            path += (path.indexOf('?') >= 0 ? '&' : '?') + '_cb=' + Date.now();
        }
        return fetch(API_ORIGIN + path, opts).then(function (res) {
            return res.json().catch(function () {
                return { data: null };
            }).then(function (parsed) {
                parsed.status = res.status;
                return parsed;
            });
        });
    }

    function projectRow(row, select) {
        if (!select || select === '*') return row;
        var cols = select.split(',').map(function (c) { return c.trim(); }).filter(Boolean);
        var out = {};
        cols.forEach(function (c) { if (row[c] !== undefined) out[c] = row[c]; });
        return out;
    }

    // ------------------------------------------------------------------ REST builder

    function QueryBuilder(client, table) {
        this.client = client;
        this.table = table;
        this.op = 'select';
        this.selectCols = '*';
        this.head = false;
        this.mode = null; // 'single' | 'maybeSingle'
        this.filters = {
            eq: {}, gte: {}, lte: {}, neq: {}, in: {},
            order: null, limit: null, onConflict: null,
        };
        this.body = undefined;
    }

    QueryBuilder.prototype.eq = function (col, val) { this.filters.eq[col] = val; return this; };
    QueryBuilder.prototype.gte = function (col, val) { this.filters.gte[col] = val; return this; };
    QueryBuilder.prototype.lte = function (col, val) { this.filters.lte[col] = val; return this; };
    QueryBuilder.prototype.neq = function (col, val) { this.filters.neq[col] = val; return this; };
    QueryBuilder.prototype.in = function (col, vals) { this.filters.in[col] = vals; return this; };
    QueryBuilder.prototype.order = function (col, opts) {
        this.filters.order = opts && opts.ascending === false ? col + '.desc' : col + '.asc';
        return this;
    };
    QueryBuilder.prototype.limit = function (n) { this.filters.limit = n; return this; };
    QueryBuilder.prototype.select = function (cols, opts) {
        // Preserve write ops so `.insert().select().single()` still POSTs with the
        // body and returns the inserted row instead of degrading into a bare select.
        if (this.op !== 'insert' && this.op !== 'update' && this.op !== 'upsert' && this.op !== 'delete') {
            this.op = 'select';
        }
        if (cols) this.selectCols = cols;
        if (opts && opts.head) this.head = true;
        return this;
    };
    QueryBuilder.prototype.single = function () { this.mode = 'single'; return this; };
    QueryBuilder.prototype.maybeSingle = function () { this.mode = 'maybeSingle'; return this; };
    QueryBuilder.prototype.insert = function (rows) {
        this.op = 'insert';
        this.body = rows;
        return this;
    };
    QueryBuilder.prototype.update = function (patch) {
        this.op = 'update';
        this.body = patch;
        return this;
    };
    QueryBuilder.prototype.upsert = function (row, opts) {
        this.op = 'upsert';
        this.body = row;
        this.filters.onConflict = opts && opts.onConflict ? opts.onConflict : null;
        return this;
    };
    QueryBuilder.prototype.delete = function () { this.op = 'delete'; return this; };
    QueryBuilder.prototype.rpc = function () {
        return { data: null, error: { message: 'rpc not supported by self-hosted client' } };
    };

    QueryBuilder.prototype.buildParams = function () {
        var params = new URLSearchParams();
        params.set('select', this.selectCols);
        Object.keys(this.filters.eq).forEach(function (k) { params.set('eq.' + k, String(this.filters.eq[k])); }, this);
        Object.keys(this.filters.gte).forEach(function (k) { params.set('gte.' + k, String(this.filters.gte[k])); }, this);
        Object.keys(this.filters.lte).forEach(function (k) { params.set('lte.' + k, String(this.filters.lte[k])); }, this);
        Object.keys(this.filters.neq).forEach(function (k) { params.set('neq.' + k, String(this.filters.neq[k])); }, this);
        Object.keys(this.filters.in).forEach(function (k) { params.set('in.' + k, this.filters.in[k].join(',')); }, this);
        if (this.filters.order) params.set('order', this.filters.order);
        if (this.filters.limit != null) params.set('limit', String(this.filters.limit));
        if (this.head) params.set('head', 'true');
        if (this.mode === 'single') params.set('single', 'true');
        if (this.filters.onConflict) params.set('onConflict', this.filters.onConflict);
        return params.toString();
    };

    QueryBuilder.prototype.execute = function () {
        var self = this;
        var params = this.buildParams();
        var path = '/api/' + this.table + '?' + params;
        var promise;

        if (this.op === 'select') {
            promise = apiRequest('GET', path);
        } else if (this.op === 'insert') {
            promise = apiRequest('POST', path, this.body);
        } else if (this.op === 'update') {
            promise = apiRequest('PATCH', path, this.body);
        } else if (this.op === 'upsert') {
            promise = apiRequest('PUT', path, this.body);
        } else if (this.op === 'delete') {
            promise = apiRequest('DELETE', path);
        } else {
            promise = Promise.resolve({ data: null, error: { message: 'unknown op' } });
        }

        return promise.then(function (res) {
            if (res.error) {
                if (self.mode === 'maybeSingle') return { data: null, error: null };
                return { data: null, error: res.error, count: 0 };
            }
            var data = res.data;
            var result = { data: data, error: null, count: res.count != null ? res.count : 0 };

            if (self.head) {
                return { data: [], error: null, count: res.count != null ? res.count : 0 };
            }
            if (self.op === 'insert' || self.op === 'update' || self.op === 'upsert') {
                var rows = Array.isArray(data) ? data : data ? [data] : [];
                if (self.selectCols !== '*') {
                    rows = rows.map(function (r) { return projectRow(r, self.selectCols); });
                }
                if (self.mode === 'single') {
                    if (!rows.length) return { data: null, error: { message: 'No rows found' }, count: 0 };
                    return { data: rows[0], error: null, count: rows.length };
                }
                if (self.mode === 'maybeSingle') {
                    return { data: rows[0] || null, error: null, count: rows.length };
                }
                result.data = rows;
                result.count = rows.length;
                return result;
            }
            // select
            if (self.selectCols !== '*' && Array.isArray(data)) {
                data = data.map(function (r) { return projectRow(r, self.selectCols); });
            }
            if (self.mode === 'single') {
                if (Array.isArray(data)) {
                    if (!data.length) return { data: null, error: { message: 'No rows found' }, count: 0 };
                    return { data: data[0], error: null, count: 1 };
                }
                if (data && typeof data === 'object') return { data: data, error: null, count: 1 };
                return { data: null, error: { message: 'No rows found' }, count: 0 };
            }
            if (self.mode === 'maybeSingle') {
                if (Array.isArray(data)) return { data: data.length ? data[0] : null, error: null, count: 0 };
                return { data: data || null, error: null, count: 0 };
            }
            result.data = Array.isArray(data) ? data : [];
            result.count = result.data.length;
            return result;
        });
    };

    QueryBuilder.prototype.then = function (resolve, reject) {
        return this.execute().then(resolve, reject);
    };
    QueryBuilder.prototype.catch = function (reject) {
        return this.execute().catch(reject);
    };

    // ------------------------------------------------------------------ realtime

    var sharedWs = null;
    var wsReady = false;
    var wsQueue = [];
    var sharedListeners = [];

    function ensureWs() {
        if (sharedWs && (sharedWs.readyState === WebSocket.OPEN || sharedWs.readyState === WebSocket.CONNECTING)) {
            return sharedWs;
        }
        sharedWs = new WebSocket(WS_URL);
        wsReady = false;
        sharedWs.onopen = function () {
            wsQueue.forEach(function (msg) {
                try { sharedWs.send(JSON.stringify(msg)); } catch (e) {}
            });
            wsQueue = [];
            wsReady = true;
        };
        sharedWs.onmessage = function (ev) {
            var msg;
            try { msg = JSON.parse(ev.data); } catch (e) { return; }
            sharedListeners.forEach(function (fn) { fn(msg); });
        };
        sharedWs.onclose = function () {
            wsReady = false;
            sharedListeners.forEach(function (fn) { fn({ type: 'ws_closed' }); });
            sharedWs = null;
            setTimeout(ensureWs, 1500);
        };
        sharedWs.onerror = function () {};
        return sharedWs;
    }

    function wsSend(msg) {
        var ws = ensureWs();
        if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify(msg)); } catch (e) {}
        } else {
            wsQueue.push(msg);
        }
    }

    function RealtimeChannel(client, name, opts) {
        this.client = client;
        this.name = name;
        this.opts = opts || {};
        this.broadcastHandlers = {}; // event -> [fn]
        this.presenceHandlers = {};  // event -> [fn]
        this.pgHandlers = [];        // postgres_changes handlers
        this.presenceKey = (this.opts.config && this.opts.config.presence && this.opts.config.presence.key) || null;
        this._presenceState = {};
        this.subscribed = false;
        this.subscribeCallbacks = [];
        this._listen();
    }

    RealtimeChannel.prototype._listen = function () {
        var self = this;
        sharedListeners.push(function (msg) {
            if (msg.type === 'ws_closed') {
                self.subscribed = false;
                return;
            }
            if (msg.type === 'broadcast' && msg.channel === self.name) {
                var cbs = self.broadcastHandlers[msg.event] || [];
                cbs.forEach(function (cb) { cb({ type: 'broadcast', event: msg.event, payload: msg.payload }); });
                return;
            }
            if (msg.type === 'presence_sync' && msg.room === self.name) {
                self._presenceState = msg.members || {};
                self._firePresence('sync', null);
                self._maybeSubscribe();
                return;
            }
            if (msg.type === 'presence_diff' && msg.room === self.name) {
                var changed = false;
                var reAdded = {};
                if (msg.add) {
                    Object.keys(msg.add).forEach(function (key) {
                        // Only announce a join for keys we don't already know —
                        // heartbeat re-tracks and reconnects of existing members
                        // must not re-fire 'join' (chat spam).
                        var isNew = !self._presenceState[key];
                        self._presenceState[key] = msg.add[key];
                        reAdded[key] = true;
                        if (isNew) {
                            self._firePresence('join', { key: key, newPresences: msg.add[key] });
                        } else {
                            self._firePresence('update', { key: key, newPresences: msg.add[key] });
                        }
                        changed = true;
                    });
                }
                if (msg.remove) {
                    Object.keys(msg.remove).forEach(function (key) {
                        // A remove paired with an add for the same key is a re-track
                        // update, not a real leave — don't delete the entry.
                        if (reAdded[key]) return;
                        if (self._presenceState[key]) delete self._presenceState[key];
                        self._firePresence('leave', { key: key, leftPresences: msg.remove[key] });
                        changed = true;
                    });
                }
                return;
            }
            if (msg.type === 'rooms_changed') {
                self.pgHandlers.forEach(function (cb) { cb({ new: {} }); });
                return;
            }
            if (msg.type === 'lobby_ready' && self.name === 'lobby_rooms_feed') {
                self._maybeSubscribe();
                return;
            }
        });
    };

    RealtimeChannel.prototype._firePresence = function (event, args) {
        var cbs = this.presenceHandlers[event] || [];
        cbs.forEach(function (cb) { try { cb(args); } catch (e) {} });
    };

    RealtimeChannel.prototype._maybeSubscribe = function () {
        if (this.subscribed) return;
        this.subscribed = true;
        this.subscribeCallbacks.forEach(function (cb) { try { cb('SUBSCRIBED'); } catch (e) {} });
    };

    RealtimeChannel.prototype.on = function (type, cfg, cb) {
        if (type === 'broadcast') {
            var event = (cfg && cfg.event) || '*';
            (this.broadcastHandlers[event] = this.broadcastHandlers[event] || []).push(cb);
        } else if (type === 'presence') {
            var pev = (cfg && cfg.event) || 'sync';
            (this.presenceHandlers[pev] = this.presenceHandlers[pev] || []).push(cb);
        } else if (type === 'postgres_changes') {
            this.pgHandlers.push(cb);
        }
        return this;
    };

    RealtimeChannel.prototype.subscribe = function (cb) {
        if (typeof cb === 'function') this.subscribeCallbacks.push(cb);
        wsSend({ type: 'join_room', room: this.name });
        return Promise.resolve({ ok: true });
    };

    RealtimeChannel.prototype.send = function (msg) {
        if (!msg || msg.type !== 'broadcast') return;
        wsSend({ type: 'broadcast', room: this.name, event: msg.event, payload: msg.payload || {} });
    };

    RealtimeChannel.prototype.track = function (payload) {
        if (!this.presenceKey) return Promise.resolve();
        wsSend({ type: 'presence_track', room: this.name, key: this.presenceKey, payload: payload || {} });
        return Promise.resolve();
    };

    RealtimeChannel.prototype.untrack = function () {
        if (!this.presenceKey) return Promise.resolve();
        wsSend({ type: 'presence_untrack', room: this.name, key: this.presenceKey });
        return Promise.resolve();
    };

    RealtimeChannel.prototype.presenceState = function () {
        return this._presenceState;
    };

    RealtimeChannel.prototype.close = function () {
        wsSend({ type: 'leave_room', room: this.name });
        this.subscribed = false;
    };

    // ------------------------------------------------------------------ client

    function MiniClient(url, key) {
        this.url = url;
        this.key = key;
    }

    MiniClient.prototype.from = function (table) {
        return new QueryBuilder(this, table);
    };

    MiniClient.prototype.channel = function (name, opts) {
        return new RealtimeChannel(this, name, opts);
    };

    MiniClient.prototype.removeChannel = function (ch) {
        if (ch && typeof ch.close === 'function') ch.close();
        return Promise.resolve();
    };

    MiniClient.prototype.storage = {
        from: function (bucket) {
            return {
                upload: function (name, blob, opts) {
                    var fileName = String(name);
                    var body = blob;
                    return apiRequest('POST', '/api/uploads?bucket=' + encodeURIComponent(bucket) + '&name=' + encodeURIComponent(fileName), body, true)
                        .then(function (res) {
                            if (res.error) return { data: null, error: res.error };
                            return { data: { path: res.data.path }, error: null };
                        });
                },
                getPublicUrl: function (name) {
                    return { data: { publicUrl: API_ORIGIN + '/api/uploads/' + encodeURIComponent(bucket) + '/' + encodeURIComponent(String(name)) } };
                },
            };
        },
    };

    MiniClient.prototype.auth = {
        getSession: function () {
            return { data: { session: null }, error: null };
        },
    };

    MiniClient.prototype.rpc = function () {
        return { data: null, error: { message: 'rpc not supported by self-hosted client' } };
    };

    MiniClient.prototype.realtime = {
        disconnect: function () {
            if (sharedWs) { try { sharedWs.close(); } catch (e) {} }
            sharedWs = null;
        },
    };

    window.moovieSync = {
        createClient: function (url, key) {
            return new MiniClient(url, key);
        },
    };
})();
