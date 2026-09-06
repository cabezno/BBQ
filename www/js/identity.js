/**
 * BBQ - Identidad del dispositivo (firma + cifrado)
 *
 * La identidad REAL son claves criptográficas generadas en este teléfono, con la
 * PRIVADA guardada en IndexedDB como CryptoKey NO EXPORTABLE (extractable:false):
 *   - Par ECDSA P-256 (FIRMA): prueba de identidad. El peerId es el hash de su
 *     clave pública ⇒ nadie puede reclamar tu peerId sin tu clave privada. Con
 *     ella el server verifica cada registro y cada conexión (challenge-response).
 *   - Par ECDH P-256 (CIFRADO): deriva secretos compartidos para E2E futuro.
 *
 * La privada nunca sale del aparato. Las públicas se publican en el directorio
 * (solo como etiquetas de búsqueda). El número de teléfono NO se verifica: es
 * únicamente una etiqueta para que tus contactos te encuentren.
 */
(function () {
    const KEY_SIGN_PRIV = 'device_signPrivateKey'; // CryptoKey ECDSA (firma), no exportable
    const KEY_ECDH_PRIV = 'device_privateKey';     // CryptoKey ECDH (E2E), no exportable
    const KEY_PROFILE = 'identity_profile';         // { peerId, phone, name, signPublicKeyB64, ecdhPublicKeyB64 }

    function bufToB64(buf) {
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
    }
    function toHex(buf) {
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    function normalizePhone(raw) {
        if (!raw) return '';
        let s = String(raw).replace(/[^\d+]/g, '');
        if (s.startsWith('+')) s = s.slice(1);
        return s.replace(/\D/g, '');
    }

    // Genera un par cuya PRIVADA queda no exportable pero permite exportar la pública:
    // se genera exportable, se saca la pública (raw) y se re-importa la privada bloqueada.
    async function genKeyPair(algo, usages) {
        const pair = await crypto.subtle.generateKey(algo, true, usages);
        const pubRaw = await crypto.subtle.exportKey('raw', pair.publicKey);
        const privJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
        const priv = await crypto.subtle.importKey('jwk', privJwk, algo, false, [usages[0]]);
        return { priv, pubB64: bufToB64(pubRaw), pubRaw };
    }

    const Identity = {
        _profile: null,
        _signPrivateKey: null,
        _ecdhPrivateKey: null,

        /** Devuelve la identidad, generándola (o migrándola) la primera vez. */
        async ensure() {
            if (this._profile && this._signPrivateKey) return this._profile;

            let profile = await window.BBQDB.kvGet(KEY_PROFILE);
            const signPriv = await window.BBQDB.kvGet(KEY_SIGN_PRIV);
            const ecdhPriv = await window.BBQDB.kvGet(KEY_ECDH_PRIV);

            // Identidad completa ya existente (con clave de firma).
            if (profile && profile.signPublicKeyB64 && signPriv && ecdhPriv) {
                this._profile = profile;
                this._signPrivateKey = signPriv;
                this._ecdhPrivateKey = ecdhPriv;
                return profile;
            }

            // Nuevo dispositivo (o migración desde la identidad vieja solo-ECDH):
            // generamos clave de firma + clave de cifrado y derivamos el peerId de la firma.
            const sign = await genKeyPair({ name: 'ECDSA', namedCurve: 'P-256' }, ['sign', 'verify']);
            const ecdh = await genKeyPair({ name: 'ECDH', namedCurve: 'P-256' }, ['deriveBits']);

            const hash = await crypto.subtle.digest('SHA-256', sign.pubRaw);
            const peerId = 'bbq_' + toHex(hash).slice(0, 24);

            profile = {
                peerId,
                phone: (profile && profile.phone) || '',
                name: (profile && profile.name) || '',
                signPublicKeyB64: sign.pubB64,
                ecdhPublicKeyB64: ecdh.pubB64
            };

            await window.BBQDB.kvSet(KEY_SIGN_PRIV, sign.priv); // CryptoKey no exportable
            await window.BBQDB.kvSet(KEY_ECDH_PRIV, ecdh.priv); // CryptoKey no exportable
            await window.BBQDB.kvSet(KEY_PROFILE, profile);

            this._profile = profile;
            this._signPrivateKey = sign.priv;
            this._ecdhPrivateKey = ecdh.priv;
            return profile;
        },

        getProfile() { return this._profile; },
        getPrivateKey() { return this._ecdhPrivateKey; }, // ECDH (E2E) — compat con nombre previo
        getSignPublicKeyB64() { return this._profile && this._profile.signPublicKeyB64; },
        getEcdhPublicKeyB64() { return this._profile && this._profile.ecdhPublicKeyB64; },

        /** Firma un texto con la clave privada de firma. Devuelve la firma en base64. */
        async sign(dataStr) {
            await this.ensure();
            const sig = await crypto.subtle.sign(
                { name: 'ECDSA', hash: 'SHA-256' },
                this._signPrivateKey,
                new TextEncoder().encode(String(dataStr))
            );
            return bufToB64(sig);
        },

        /** Setea teléfono + nombre (etiquetas) y persiste. */
        async setLabels(phone, name) {
            await this.ensure();
            this._profile.phone = (phone || '').toString();
            this._profile.name = (name || '').toString();
            await window.BBQDB.kvSet(KEY_PROFILE, this._profile);
            return this._profile;
        },

        /** Publica la identidad en el directorio del servidor (registro FIRMADO). */
        async registerInDirectory() {
            const p = await this.ensure();
            if (!p.phone) return { ok: false, error: 'Falta el número de teléfono' };
            try {
                const key = normalizePhone(p.phone);
                const ts = Date.now();
                const sig = await this.sign(`${p.peerId}|${key}|${ts}`);
                const res = await fetch(`${window.BBQ_SERVER}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone: p.phone,
                        name: p.name,
                        peerId: p.peerId,
                        signPublicKey: p.signPublicKeyB64,
                        ecdhPublicKey: p.ecdhPublicKeyB64,
                        ts,
                        sig
                    })
                });
                return await res.json();
            } catch (e) {
                return { ok: false, error: 'Servidor no disponible: ' + e.message };
            }
        }
    };

    // URL del servidor de directorio/señalización.
    // En PWA/desarrollo usa el mismo origen; en la app nativa se sobreescribe con la URL desplegada.
    window.BBQ_SERVER = window.BBQ_SERVER || (location.origin.startsWith('http') ? location.origin : 'http://localhost:3000');

    window.BBQIdentity = Identity;
})();
