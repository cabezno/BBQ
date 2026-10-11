/**
 * BBQ - Cifrado de extremo a extremo (E2E) de los mensajes entre personas.
 *
 * - Cada teléfono tiene un par ECDH P-256 (identity.js). Su pública va firmada con la
 *   clave de identidad (ecdhSig), y el peerId es el hash de esa clave de identidad.
 *   => cualquiera verifica que una clave de cifrado es de un peerId SIN confiar en el server.
 * - Clave por contacto: ECDH(mi privada, su pública) → HKDF-SHA256 → AES-GCM 256.
 * - Cada sobre lleva las claves públicas del emisor (autoverificables), así el receptor
 *   puede descifrar y contestar cifrado aunque todavía no lo tenga como contacto.
 * - Se cifra igual por P2P o por relay: el server solo ve { type:'e2e', ... } opaco.
 * - Bots/agentes (sin claves publicadas) siguen en claro.
 */
(function () {
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    const KV_PREFIX = 'e2e_peer_';

    function b64ToBuf(b64) {
        const bin = atob(b64);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }
    function bufToB64(buf) {
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(bin);
    }
    function toHex(buf) {
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const E2E = {
        _peers: new Map(),   // peerId → { spk, epk, ksig }  (ya verificadas)
        _aes: new Map(),     // peerId|epk → Promise<CryptoKey>
        _learning: new Map(), // peerId → Promise (verificación en curso)

        /** Verifica que (spk, epk, ksig) pertenecen a peerId. No confía en nadie más. */
        async _verify(peerId, spk, epk, ksig) {
            if (!peerId || !spk || !epk || !ksig) return false;
            try {
                const spkRaw = b64ToBuf(spk);
                const hash = await crypto.subtle.digest('SHA-256', spkRaw);
                if ('bbq_' + toHex(hash).slice(0, 24) !== peerId) return false;
                const pub = await crypto.subtle.importKey('raw', spkRaw, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
                return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64ToBuf(ksig),
                    enc.encode(`bbq-ecdh-v1|${peerId}|${epk}`));
            } catch (e) { return false; }
        },

        /** Aprende (y guarda) las claves de un contacto si verifican. Devuelve true si quedaron. */
        async learn(peerId, spk, epk, ksig) {
            const cur = this._peers.get(peerId);
            if (cur && cur.epk === epk && cur.spk === spk) return true;
            const job = (async () => {
                if (!(await this._verify(peerId, spk, epk, ksig))) return false;
                const rec = { spk, epk, ksig };
                this._peers.set(peerId, rec);
                try { await window.BBQDB.kvSet(KV_PREFIX + peerId, rec); } catch (e) {}
                return true;
            })();
            this._learning.set(peerId, job);
            try { return await job; } finally { if (this._learning.get(peerId) === job) this._learning.delete(peerId); }
        },

        async _get(peerId) {
            // Si justo se está verificando la clave de este peer (contacto recién agregado), esperarla.
            if (this._learning.has(peerId)) { try { await this._learning.get(peerId); } catch (e) {} }
            if (this._peers.has(peerId)) return this._peers.get(peerId);
            let rec = null;
            try { rec = await window.BBQDB.kvGet(KV_PREFIX + peerId); } catch (e) {}
            if (rec && rec.epk) this._peers.set(peerId, rec);
            return rec || null;
        },

        /** ¿Puedo cifrarle a este peer? (tengo sus claves verificadas) */
        async canEncrypt(peerId) { return !!(await this._get(peerId)); },
        knows(peerId) { return this._peers.has(peerId); },

        _aesKey(peerId, epk) {
            const k = peerId + '|' + epk;
            if (!this._aes.has(k)) {
                this._aes.set(k, (async () => {
                    const me = window.BBQIdentity;
                    await me.ensure();
                    const theirPub = await crypto.subtle.importKey('raw', b64ToBuf(epk), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
                    const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: theirPub }, me.getPrivateKey(), 256);
                    const hk = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
                    const ids = [me.getProfile().peerId, peerId].sort().join('|');
                    return crypto.subtle.deriveKey(
                        { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(ids), info: enc.encode('bbq-e2e-v1') },
                        hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
                })());
            }
            return this._aes.get(k);
        },

        /** Cifra un payload para peerId. Devuelve el sobre, o null si no hay claves (→ va en claro). */
        async encrypt(peerId, obj) {
            const rec = await this._get(peerId);
            if (!rec) return null;
            const me = window.BBQIdentity;
            const p = await me.ensure();
            const key = await this._aesKey(peerId, rec.epk);
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const ct = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv, additionalData: enc.encode(`bbq-e2e-v1|${p.peerId}|${peerId}`) },
                key, enc.encode(JSON.stringify({ p: obj, sn: (p.name || '').slice(0, 60) })));
            return {
                type: 'e2e', v: 1,
                spk: p.signPublicKeyB64, epk: p.ecdhPublicKeyB64, ksig: await me.getEcdhSig(),
                iv: bufToB64(iv), ct: bufToB64(ct)
            };
        },

        /** Descifra un sobre de fromPeerId. Devuelve el payload o null si no es válido. */
        async decrypt(fromPeerId, env) {
            if (!env || env.type !== 'e2e' || env.v !== 1) return null;
            if (!(await this.learn(fromPeerId, env.spk, env.epk, env.ksig))) return null;
            try {
                const me = await window.BBQIdentity.ensure();
                const key = await this._aesKey(fromPeerId, env.epk);
                const pt = await crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv: b64ToBuf(env.iv), additionalData: enc.encode(`bbq-e2e-v1|${fromPeerId}|${me.peerId}`) },
                    key, b64ToBuf(env.ct));
                const inner = JSON.parse(dec.decode(pt));
                // Formato v1 con nombre del emisor adentro (cifrado: el server no lo ve).
                if (inner && inner.p && typeof inner.p === 'object') {
                    if (typeof inner.sn === 'string') inner.p._senderName = inner.sn.slice(0, 60);
                    return inner.p;
                }
                return inner;
            } catch (e) { return null; }
        }
    };

    // ── Código de seguridad (verificación en persona) ──
    // 60 dígitos derivados de las DOS claves de identidad (mismo resultado en ambos teléfonos).
    // Si coinciden al compararlos cara a cara, nadie está en el medio.
    E2E.safetyNumber = async function (peerId) {
        const rec = await this._get(peerId);
        const me = await window.BBQIdentity.ensure();
        if (!rec) return null;
        const keys = [me.signPublicKeyB64, rec.spk].sort().join('|');
        const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode('bbq-safety-v1|' + keys)));
        let digits = '';
        for (let i = 0; i < 30; i++) digits += String(((h[i] << 8) | h[(i + 1) % 32]) % 100).padStart(2, '0');
        return digits.match(/.{5}/g).join(' ');
    };
    // Verificado = marqué como igual el código con ESTA clave. Si el contacto cambia de clave, deja de estarlo.
    E2E.isVerified = async function (peerId) {
        const rec = await this._get(peerId);
        if (!rec) return false;
        try { return (await window.BBQDB.kvGet('e2e_verified_' + peerId)) === rec.spk; } catch (e) { return false; }
    };
    E2E.setVerified = async function (peerId, yes) {
        const rec = await this._get(peerId);
        if (!rec) return;
        try { await window.BBQDB.kvSet('e2e_verified_' + peerId, yes ? rec.spk : null); } catch (e) {}
    };

    window.BBQE2E = E2E;
})();
