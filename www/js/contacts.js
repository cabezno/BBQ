/**
 * BBQ - Contactos
 *
 * Flujo: leés tu agenda (en app nativa) → se hace match contra el directorio →
 * ves quién ya tiene BBQ y lo agregás. A los que no tienen, los invitás por
 * WhatsApp/SMS (share nativo). Los contactos viven en IndexedDB (en el teléfono).
 *
 * Contacto guardado: { peerId, phone, name, publicKey, addedAt }
 */
(function () {
    // URL de la app desplegada (o el link de descarga cuando publiques el APK).
    const INVITE_URL = 'https://bbq-9gbi.onrender.com';

    function normalizePhone(raw) {
        if (!raw) return '';
        let s = String(raw).replace(/[^\d+]/g, '');
        if (s.startsWith('+')) s = s.slice(1);
        return s.replace(/\D/g, '');
    }

    const Contacts = {
        // ── Guardar / listar ──
        async list() {
            const rows = await window.BBQDB.all('contacts');
            return rows.map(r => r.value).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        },
        get(peerId) { return window.BBQDB.get('contacts', peerId); },
        async save(contact) {
            if (!contact.peerId) return false;
            contact.addedAt = contact.addedAt || new Date().toISOString();
            await window.BBQDB.set('contacts', contact.peerId, contact);
            return true;
        },
        remove(peerId) { return window.BBQDB.del('contacts', peerId); },

        // ── Agregar UN contacto por número (consulta el directorio) ──
        async addByPhone(rawPhone, fallbackName) {
            const phone = normalizePhone(rawPhone);
            if (!phone || phone.length < 6) return { ok: false, error: 'Número inválido' };
            try {
                const res = await fetch(`${window.BBQ_SERVER}/api/user/${phone}`);
                if (res.status === 404) {
                    return { ok: false, notOnBBQ: true, phone, error: 'Ese número todavía no tiene BBQ' };
                }
                const data = await res.json();
                if (!data.ok) return { ok: false, error: data.error || 'Error' };
                const u = data.user;
                const contact = {
                    peerId: u.peerId,
                    phone: u.phone,
                    name: fallbackName || u.name || u.phone,
                    publicKey: u.publicKey
                };
                await this.save(contact);
                return { ok: true, contact };
            } catch (e) {
                return { ok: false, error: 'Servidor no disponible: ' + e.message };
            }
        },

        // ── Match masivo: le paso mi agenda, guardo los que tienen BBQ ──
        async matchAgenda(agenda /* [{name, phone}] */) {
            const phones = agenda.map(c => c.phone).filter(Boolean);
            if (!phones.length) return { ok: true, added: [] };
            try {
                const res = await fetch(`${window.BBQ_SERVER}/api/contacts/match`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phones })
                });
                const data = await res.json();
                const added = [];
                for (const m of (data.matches || [])) {
                    // Preferir el nombre que YO tengo en mi agenda
                    const mine = agenda.find(c => normalizePhone(c.phone) === m.phone);
                    const contact = {
                        peerId: m.peerId, phone: m.phone,
                        name: (mine && mine.name) || m.name || m.phone,
                        publicKey: m.publicKey
                    };
                    await this.save(contact);
                    added.push(contact);
                }
                return { ok: true, added };
            } catch (e) {
                return { ok: false, error: 'Servidor no disponible: ' + e.message };
            }
        },

        // ── Leer la agenda del teléfono (solo app nativa Capacitor) ──
        async readDeviceContacts() {
            // 1) Capacitor Contacts (nativo)
            const cap = window.Capacitor;
            if (cap && cap.Plugins && cap.Plugins.Contacts) {
                try {
                    const perm = await cap.Plugins.Contacts.requestPermissions();
                    if (perm && perm.contacts === 'denied') return { ok: false, error: 'Permiso de contactos denegado' };
                    const result = await cap.Plugins.Contacts.getContacts({ projection: { name: true, phones: true } });
                    const agenda = [];
                    for (const c of (result.contacts || [])) {
                        const name = c.name && (c.name.display || c.name.given) || '';
                        for (const ph of (c.phones || [])) {
                            if (ph.number) agenda.push({ name, phone: ph.number });
                        }
                    }
                    return { ok: true, agenda };
                } catch (e) {
                    return { ok: false, error: 'No se pudo leer la agenda: ' + e.message };
                }
            }
            // 2) Contact Picker API (Chrome Android en web) — el usuario elige
            if (navigator.contacts && navigator.contacts.select) {
                try {
                    const picked = await navigator.contacts.select(['name', 'tel'], { multiple: true });
                    const agenda = [];
                    for (const c of picked) {
                        const name = (c.name && c.name[0]) || '';
                        for (const t of (c.tel || [])) agenda.push({ name, phone: t });
                    }
                    return { ok: true, agenda };
                } catch (e) {
                    return { ok: false, error: 'Selección cancelada' };
                }
            }
            return { ok: false, error: 'La lectura de agenda requiere la app nativa (Android/iPhone).' };
        },

        // ── Invitar a alguien que no tiene BBQ (WhatsApp / SMS) ──
        async invite(rawPhone) {
            const phone = normalizePhone(rawPhone);
            const text = `¡Sumate a BBQ! Mensajería y comercio P2P. Descargala acá: ${INVITE_URL}`;
            const cap = window.Capacitor;
            // Capacitor Share (nativo)
            if (cap && cap.Plugins && cap.Plugins.Share) {
                try { await cap.Plugins.Share.share({ title: 'BBQ', text, url: INVITE_URL }); return { ok: true }; } catch (e) {}
            }
            // Web Share API
            if (navigator.share) {
                try { await navigator.share({ title: 'BBQ', text, url: INVITE_URL }); return { ok: true }; } catch (e) {}
            }
            // Fallback: abrir WhatsApp directo
            if (phone) {
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
                return { ok: true };
            }
            // Último fallback: copiar
            try { await navigator.clipboard.writeText(text); return { ok: true, copied: true }; } catch (e) {}
            return { ok: false, error: 'No se pudo compartir' };
        }
    };

    window.BBQContacts = Contacts;
})();
