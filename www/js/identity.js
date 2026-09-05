/**
 * BBQ - Identidad del dispositivo
 *
 * La identidad REAL es un par de claves criptográficas (ECDH P-256):
 *   - La clave PRIVADA se genera una vez y se guarda en IndexedDB como CryptoKey
 *     NO EXPORTABLE (extractable:false). No se puede copiar ni cambiar, y solo
 *     existe en este teléfono. => identidad atada al aparato.
 *   - La clave PÚBLICA se publica en el directorio del servidor (etiqueta de búsqueda).
 *
 * El peerId se deriva del hash de la clave pública (determinista).
 * El número de teléfono es solo una ETIQUETA para que otros te encuentren (sin verificar).
 *
 * La clave ECDH sirve además para cifrado E2E futuro (deriva secreto compartido).
 */
(function () {
    const KEY_PRIV = 'device_privateKey';
    const KEY_PUB = 'device_publicKeyJwk';
    const KEY_PROFILE = 'identity_profile'; // { peerId, phone, name, publicKeyB64 }

    function bufToB64(buf) {
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
    }
    function toHex(buf) {
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const Identity = {
        _profile: null,
        _privateKey: null,

        /** Devuelve la identidad, generándola la primera vez. */
        async ensure() {
            if (this._profile && this._privateKey) return this._profile;

            let profile = await window.BBQDB.kvGet(KEY_PROFILE);
            let privKey = await window.BBQDB.kvGet(KEY_PRIV);

            if (profile && privKey) {
                this._profile = profile;
                this._privateKey = privKey; // CryptoKey no exportable persistida por IndexedDB
                return profile;
            }

            // Generar par de claves nuevo (ECDH P-256). Privada NO exportable.
            const pair = await crypto.subtle.generateKey(
                { name: 'ECDH', namedCurve: 'P-256' },
                false,           // extractable = false → no se puede exportar la privada
                ['deriveBits']   // uso: derivar secreto compartido (E2E)
            );

            // Exportar la pública (JWK/raw) para publicarla y derivar el peerId
            const pubRaw = await crypto.subtle.exportKey('raw', pair.publicKey);
            const publicKeyB64 = bufToB64(pubRaw);
            const hash = await crypto.subtle.digest('SHA-256', pubRaw);
            const peerId = 'bbq_' + toHex(hash).slice(0, 24);

            profile = {
                peerId,
                phone: (profile && profile.phone) || '',
                name: (profile && profile.name) || '',
                publicKeyB64
            };

            await window.BBQDB.kvSet(KEY_PRIV, pair.privateKey); // CryptoKey directamente
            await window.BBQDB.kvSet(KEY_PUB, publicKeyB64);
            await window.BBQDB.kvSet(KEY_PROFILE, profile);

            this._profile = profile;
            this._privateKey = pair.privateKey;
            return profile;
        },

        getProfile() { return this._profile; },
        getPrivateKey() { return this._privateKey; },

        /** Setea teléfono + nombre (etiquetas) y persiste. */
        async setLabels(phone, name) {
            await this.ensure();
            this._profile.phone = (phone || '').toString();
            this._profile.name = (name || '').toString();
            await window.BBQDB.kvSet(KEY_PROFILE, this._profile);
            return this._profile;
        },

        /** Publica la identidad en el directorio del servidor. */
        async registerInDirectory() {
            const p = await this.ensure();
            if (!p.phone) return { ok: false, error: 'Falta el número de teléfono' };
            try {
                const res = await fetch(`${window.BBQ_SERVER}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone: p.phone,
                        name: p.name,
                        peerId: p.peerId,
                        publicKey: p.publicKeyB64
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
