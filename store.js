/**
 * BBQ - Persistencia del directorio (el ÚNICO dato durable del servidor)
 *
 * El servidor no guarda mensajes. Lo único que debe sobrevivir a un reinicio es
 * el DIRECTORIO (guía telefónica: teléfono → { peerId, claves públicas }).
 *
 * Backends (se elige solo, sin tocar código):
 *   1) Upstash Redis (REST)  → producción. Disco NO efímero, free, sin tarjeta.
 *      Requiere env: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *      Guarda todo en un hash Redis: bbq:directory  (field=teléfono, value=JSON)
 *   2) Archivo JSON local    → desarrollo. directory.json junto al server.
 *
 * Interfaz async y mínima: loadAll(), put(key, value), del(key), backend().
 * Store.ns('stores') da otro espacio con la misma interfaz (hash bbq:stores / stores.json),
 * para el directorio de tiendas y servicios de entrega, sin mezclarlo con la guía telefónica.
 */
const fs = require('fs');
const path = require('path');

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const useUpstash = !!(URL && TOKEN);

// ── Backend Upstash (REST) ─────────────────────────────────────
async function redis(cmd) {
    const r = await fetch(URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd)
    });
    const j = await r.json();
    if (j.error) throw new Error('Upstash: ' + j.error);
    return j.result;
}

// Crea un espacio de persistencia: hash Redis `bbq:<name>` o archivo `<file>`.
function createStore(name, fileName) {
    const HASH = 'bbq:' + name;
    const FILE = path.join(__dirname, fileName || (name + '.json'));

    // ── Backend archivo (debounced) ────────────────────────────
    let fileCache = null;
    let saveTimer = null;
    function fileLoad() {
        if (fileCache) return fileCache;
        try { fileCache = JSON.parse(fs.readFileSync(FILE, 'utf8')) || {}; }
        catch (e) { fileCache = {}; }
        return fileCache;
    }
    function fileFlush() {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            try { fs.writeFileSync(FILE, JSON.stringify(fileCache, null, 2)); }
            catch (e) { console.error('[STORE] Error guardando archivo:', e.message); }
        }, 500);
    }

    return {
        backend() { return useUpstash ? 'upstash' : 'file'; },

        /** Carga todo el espacio como objeto { key → value }. */
        async loadAll() {
            if (useUpstash) {
                const flat = await redis(['HGETALL', HASH]); // [field, val, field, val, ...]
                const out = {};
                for (let i = 0; i < (flat || []).length; i += 2) {
                    try { out[flat[i]] = JSON.parse(flat[i + 1]); } catch (e) {}
                }
                return out;
            }
            return { ...fileLoad() };
        },

        /** Persiste una entrada. */
        async put(key, value) {
            if (useUpstash) {
                await redis(['HSET', HASH, key, JSON.stringify(value)]);
                return;
            }
            fileLoad()[key] = value;
            fileFlush();
        },

        /** Borra una entrada. */
        async del(key) {
            if (useUpstash) { await redis(['HDEL', HASH, key]); return; }
            delete fileLoad()[key];
            fileFlush();
        }
    };
}

// Espacio por defecto: el directorio (guía telefónica). Mismo hash/archivo de siempre.
const Store = createStore('directory', 'directory.json');
const namespaces = {};
Store.ns = (name) => (namespaces[name] = namespaces[name] || createStore(name));

module.exports = Store;
