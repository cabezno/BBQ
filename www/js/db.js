/**
 * BBQ - IndexedDB (DB local del teléfono)
 * Helper mínimo key-value + colecciones. El teléfono es dueño de sus datos.
 *
 * Guarda de todo: identidad (incluida la CryptoKey privada NO exportable),
 * contactos, chats, perfil, productos. Nada de esto sale del dispositivo.
 */
(function () {
    const DB_NAME = 'bbq_db';
    const DB_VERSION = 1;
    const STORES = ['kv', 'contacts', 'chats', 'messages', 'products', 'status'];

    let dbPromise = null;

    function open() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                for (const name of STORES) {
                    if (!db.objectStoreNames.contains(name)) {
                        db.createObjectStore(name);
                    }
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return dbPromise;
    }

    function tx(store, mode) {
        return open().then((db) => db.transaction(store, mode).objectStore(store));
    }

    const BBQDB = {
        async get(store, key) {
            const os = await tx(store, 'readonly');
            return new Promise((res, rej) => {
                const r = os.get(key);
                r.onsuccess = () => res(r.result);
                r.onerror = () => rej(r.error);
            });
        },
        async set(store, key, value) {
            const os = await tx(store, 'readwrite');
            return new Promise((res, rej) => {
                const r = os.put(value, key);
                r.onsuccess = () => res(true);
                r.onerror = () => rej(r.error);
            });
        },
        async del(store, key) {
            const os = await tx(store, 'readwrite');
            return new Promise((res, rej) => {
                const r = os.delete(key);
                r.onsuccess = () => res(true);
                r.onerror = () => rej(r.error);
            });
        },
        async all(store) {
            const os = await tx(store, 'readonly');
            return new Promise((res, rej) => {
                const out = [];
                const r = os.openCursor();
                r.onsuccess = (e) => {
                    const cur = e.target.result;
                    if (cur) { out.push({ key: cur.key, value: cur.value }); cur.continue(); }
                    else res(out);
                };
                r.onerror = () => rej(r.error);
            });
        },
        // Atajos key-value sobre el store 'kv'
        kvGet(key) { return this.get('kv', key); },
        kvSet(key, value) { return this.set('kv', key, value); }
    };

    window.BBQDB = BBQDB;
})();
