/**
 * BBQ - Directorio de tiendas y servicios de entrega.
 *
 * Cada dueño publica su ficha FIRMADA con su clave de identidad. El server la guarda tal cual;
 * acá cada ficha se vuelve a verificar (peerId = hash de la clave, firma válida) antes de mostrarla,
 * así nadie (ni el server) puede inventar o modificar una tienda.
 *
 * La ficha incluye la clave de cifrado del dueño (firmada), para chatear cifrado desde el primer mensaje.
 */
(function () {
    const enc = new TextEncoder();
    const KV_DELIVERY = 'my_delivery_service';
    const KV_PUBLISHED = 'my_listings_published'; // { store: bool, delivery: bool }

    function b64ToBuf(b64) { const bin = atob(b64); const o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o; }
    function toHex(buf) { return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''); }

    async function verifyEntry(e) {
        try {
            const spkRaw = b64ToBuf(e.signPublicKey);
            const hash = await crypto.subtle.digest('SHA-256', spkRaw);
            if ('bbq_' + toHex(hash).slice(0, 24) !== e.peerId) return null;
            const pub = await crypto.subtle.importKey('raw', spkRaw, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
            const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64ToBuf(e.sig),
                enc.encode(`bbq-listing-v1|${e.peerId}|${e.kind}|${e.ts}|${e.listingJson}`));
            if (!ok) return null;
            const l = JSON.parse(e.listingJson);
            return Object.assign({}, l, { kind: e.kind, peerId: e.peerId, signPublicKey: e.signPublicKey, updatedAt: e.updatedAt });
        } catch (err) { return null; }
    }

    const Listings = {
        /** Trae y VERIFICA las fichas publicadas de un tipo ('store' | 'delivery'). */
        async fetch(kind) {
            try {
                const r = await fetch(`${window.BBQ_SERVER}/api/stores?kind=${encodeURIComponent(kind)}`);
                const j = await r.json();
                const out = [];
                for (const e of (j.listings || [])) { const v = await verifyEntry(e); if (v) out.push(v); }
                return out;
            } catch (e) { return []; }
        },

        async _signed(kind, listing) {
            const me = window.BBQIdentity;
            const p = await me.ensure();
            const full = Object.assign({}, listing, {
                ownerName: p.name || '',
                ecdhPublicKey: p.ecdhPublicKeyB64,
                ecdhSig: await me.getEcdhSig()
            });
            const listingJson = JSON.stringify(full);
            const ts = Date.now();
            const sig = await me.sign(`bbq-listing-v1|${p.peerId}|${kind}|${ts}|${listingJson}`);
            return { kind, peerId: p.peerId, signPublicKey: p.signPublicKeyB64, listingJson, ts, sig };
        },

        async publish(kind, listing) {
            try {
                const body = await this._signed(kind, listing);
                const r = await fetch(`${window.BBQ_SERVER}/api/stores`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                const j = await r.json();
                if (j.ok) await this._setPublished(kind, true);
                return j;
            } catch (e) { return { ok: false, error: 'Servidor no disponible: ' + e.message }; }
        },

        async unpublish(kind) {
            try {
                const me = window.BBQIdentity;
                const p = await me.ensure();
                const ts = Date.now();
                const sig = await me.sign(`bbq-unlist-v1|${p.peerId}|${kind}|${ts}`);
                const r = await fetch(`${window.BBQ_SERVER}/api/stores/unpublish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, peerId: p.peerId, signPublicKey: p.signPublicKeyB64, ts, sig }) });
                const j = await r.json();
                if (j.ok) await this._setPublished(kind, false);
                return j;
            } catch (e) { return { ok: false, error: 'Servidor no disponible: ' + e.message }; }
        },

        async isPublished(kind) {
            try { const s = await window.BBQDB.kvGet(KV_PUBLISHED); return !!(s && s[kind]); } catch (e) { return false; }
        },
        async _setPublished(kind, v) {
            let s = {}; try { s = (await window.BBQDB.kvGet(KV_PUBLISHED)) || {}; } catch (e) {}
            s[kind] = v; try { await window.BBQDB.kvSet(KV_PUBLISHED, s); } catch (e) {}
        },

        /** Ficha pública de MI tienda, armada con lo que ya está cargado en "Mi tienda". */
        buildMyStoreListing() {
            const ms = window.merchantStorage;
            const st = (ms && ms.getUserStore && ms.getUserStore()) || {};
            const products = ((ms && ms.getProducts && ms.getProducts()) || []).slice(0, 100).map(p => ({
                name: String(p.name || '').slice(0, 80),
                price: Number(p.price) || 0,
                shippingFee: Number(p.shippingFee) || 0,
                stock: p.stock != null ? Number(p.stock) : null
            }));
            return {
                name: String(st.name || 'Mi tienda').slice(0, 60),
                category: String(st.category || '').slice(0, 100),
                region: String(st.region || '').slice(0, 100),
                description: String(st.bio || '').slice(0, 300),
                icon: String(st.icon || '🏪').slice(0, 8),
                products
            };
        },

        // ── Mi servicio de entrega (configuración local + publicación) ──
        async getMyDelivery() {
            try { return (await window.BBQDB.kvGet(KV_DELIVERY)) || null; } catch (e) { return null; }
        },
        async saveMyDelivery(d) {
            try { await window.BBQDB.kvSet(KV_DELIVERY, d); } catch (e) {}
        },

        /** Agrega al dueño de una ficha como contacto (con sus claves de cifrado verificadas). */
        async addOwnerAsContact(l) {
            const c = { peerId: l.peerId, name: l.name, phone: '', publicKey: l.ecdhPublicKey, signPublicKey: l.signPublicKey, ecdhSig: l.ecdhSig };
            try { await window.BBQContacts.save(c); } catch (e) {}
            if (window.BBQ) window.BBQ._mergeContact(c);
            if (window.BBQE2E && l.ecdhSig) await window.BBQE2E.learn(l.peerId, l.signPublicKey, l.ecdhPublicKey, l.ecdhSig);
            return c;
        }
    };

    window.BBQListings = Listings;
})();
