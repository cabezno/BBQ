/**
 * BBQ - Integración P2P real
 *
 * Une las piezas nuevas (identidad, contactos, WebRTC) con la UI existente:
 *  - Onboarding al iniciar (nombre + número → identidad → registro).
 *  - Carga los contactos reales en la lista de chats.
 *  - Escucha mensajes P2P entrantes y los guarda/renderiza.
 *  - UI para agregar contactos (por número / agenda) e invitar.
 *
 * Se carga DESPUÉS de app.js para poder usar sus funciones globales
 * (CONTACTS_DATA, renderMobileChatList, selectMobileChat, renderMobileMessages).
 */
(function () {
    const BBQ = {
        async boot() {
            try {
                const profile = await window.BBQOnboarding.start();
                window.MY_PEER_ID = profile.peerId;

                await this.loadRealContacts();
                this.initNetListener();
                this.initContactsUI();

                if (typeof renderMobileChatList === 'function') renderMobileChatList();
                console.log('[BBQ] Listo. peerId=' + profile.peerId);
            } catch (e) {
                console.error('[BBQ] Error en boot:', e);
            }
        },

        // ── Cargar contactos reales (IndexedDB) en la UI ──
        async loadRealContacts() {
            const list = await window.BBQContacts.list();
            for (const c of list) this._mergeContact(c);
        },

        _mergeContact(c) {
            if (!c || !c.peerId) return;
            // CONTACTS_DATA es global (definido en app.js). Lo mutamos (no reasignamos).
            if (typeof CONTACTS_DATA !== 'undefined') {
                CONTACTS_DATA[c.peerId] = {
                    name: c.name || c.phone || 'Contacto BBQ',
                    avatar: '👤',
                    status: 'en línea · P2P',
                    phone: c.phone,
                    publicKey: c.publicKey,
                    isReal: true
                };
            }
        },

        // ── Escuchar mensajes P2P entrantes ──
        initNetListener() {
            if (!window.BBQNet) return;
            window.BBQNet.onMessage(async (fromPeerId, msg) => {
                // Vivos: aviso de inicio/fin de transmisión de un contacto.
                if (msg && (msg.type === 'live_start' || msg.type === 'live_end')) {
                    window.LIVE_HOSTS = window.LIVE_HOSTS || {};
                    const info = msg.message || {};
                    const hostId = info.hostId || fromPeerId;
                    if (msg.type === 'live_start') {
                        const name = info.hostName || (typeof CONTACTS_DATA !== 'undefined' && CONTACTS_DATA[hostId] && CONTACTS_DATA[hostId].name) || 'Contacto';
                        window.LIVE_HOSTS[hostId] = { hostName: name, product: info.product };
                        bbqToast('🔴 ' + name + ' está en vivo');
                    } else {
                        delete window.LIVE_HOSTS[hostId];
                    }
                    if (typeof initInstagramStoriesBar === 'function') initInstagramStoriesBar();
                    return;
                }

                if (!msg || !['chat', 'voice', 'attachment'].includes(msg.type) || !msg.message) return;

                // Asegurar que el remitente exista como contacto
                if (typeof CONTACTS_DATA !== 'undefined' && !CONTACTS_DATA[fromPeerId]) {
                    let known = await window.BBQContacts.get(fromPeerId);
                    if (!known) known = { peerId: fromPeerId, name: 'Nuevo contacto BBQ' };
                    this._mergeContact(known);
                }

                // Nota de voz entrante: decodificar el audio (base64) y guardarlo en IndexedDB.
                if (msg.type === 'voice' && msg.audio && msg.message.payloadCard) {
                    try {
                        const blob = await (await fetch(msg.audio)).blob();
                        await window.BBQDB.set('messages', msg.message.payloadCard.id, blob);
                    } catch (e) { console.warn('[BBQ] No se pudo guardar audio entrante', e); }
                }

                // Adjunto entrante (imagen/archivo): guardar los bytes en IndexedDB.
                if (msg.type === 'attachment' && msg.data && msg.message.payloadCard) {
                    try {
                        const blob = await (await fetch(msg.data)).blob();
                        await window.BBQDB.set('messages', msg.message.payloadCard.id, blob);
                    } catch (e) { console.warn('[BBQ] No se pudo guardar adjunto entrante', e); }
                }

                const incoming = msg.message;
                incoming.sender = fromPeerId; // el remitente real
                window.buyerStorage.appendChatMessage(fromPeerId, incoming);

                if (typeof currentChatId !== 'undefined' && fromPeerId === currentChatId) {
                    if (typeof renderMobileMessages === 'function') renderMobileMessages();
                }
                if (typeof renderMobileChatList === 'function') renderMobileChatList();
                bbqToast('💬 ' + (CONTACTS_DATA[fromPeerId]?.name || fromPeerId));
            });

            window.BBQNet.onPeerState((peerId, state) => {
                if (typeof CONTACTS_DATA !== 'undefined' && CONTACTS_DATA[peerId]) {
                    CONTACTS_DATA[peerId].status = state === 'online' ? 'en línea · P2P' : 'desconectado';
                }
            });
        },

        // ── UI: modal para agregar/invitar contactos ──
        // El disparador es el FAB contextual EXISTENTE de la app (pestaña Chats →
        // "Nuevo Número / Contacto"), que llama a openAddContactModal(). No inyectamos
        // un FAB propio para no tapar el de la app.
        initContactsUI() {
            // Limpieza defensiva: si quedó un FAB duplicado de una versión anterior, lo saco.
            const stray = document.getElementById('bbqAddContactFab');
            if (stray) stray.remove();
            this._buildAddContactModal();
        },

        _buildAddContactModal() {
            if (document.getElementById('bbqAddContactModal')) return;
            const m = document.createElement('div');
            m.id = 'bbqAddContactModal';
            m.style.cssText = `position:fixed; inset:0; z-index:150000; background:rgba(0,0,0,0.7);
                display:none; align-items:flex-end; justify-content:center; font-family:Inter,system-ui,sans-serif;`;
            m.innerHTML = `
                <div style="background:#111b21; width:100%; max-width:440px; border-radius:20px 20px 0 0; padding:20px; color:#e9edef;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                        <div style="font-size:1.1rem; font-weight:900;">Agregar contacto</div>
                        <button id="bbqAddClose" style="background:none; border:none; color:#8696a0; font-size:1.4rem; cursor:pointer;">✕</button>
                    </div>
                    <input id="bbqAddPhone" type="tel" placeholder="Número (ej: +54 9 11 5555-1234)"
                        style="width:100%; padding:13px; margin-bottom:10px; border-radius:12px; border:1px solid #2a3942; background:#0b141a; color:#e9edef; font-size:1rem; outline:none;">
                    <button id="bbqAddSearch" style="width:100%; padding:13px; border-radius:12px; border:none; cursor:pointer; background:linear-gradient(90deg,#f59e0b,#f97316); color:#0b141a; font-weight:900; margin-bottom:10px;">
                        Buscar en BBQ y agregar
                    </button>
                    <button id="bbqImportAgenda" style="width:100%; padding:12px; border-radius:12px; border:1px solid #2a3942; cursor:pointer; background:#0b141a; color:#e9edef; font-weight:600; margin-bottom:8px;">
                        📇 Importar de mi agenda
                    </button>
                    <div id="bbqAddResult" style="font-size:0.85rem; min-height:20px; margin-top:6px;"></div>
                </div>`;
            document.body.appendChild(m);

            document.getElementById('bbqAddClose').onclick = () => { m.style.display = 'none'; };
            document.getElementById('bbqAddSearch').onclick = () => this._handleAdd();
            document.getElementById('bbqImportAgenda').onclick = () => this._handleImportAgenda();
        },

        openAddContactModal() {
            this._buildAddContactModal();
            const m = document.getElementById('bbqAddContactModal');
            document.getElementById('bbqAddResult').innerHTML = '';
            document.getElementById('bbqAddPhone').value = '';
            m.style.display = 'flex';
        },

        async _handleAdd() {
            const phone = document.getElementById('bbqAddPhone').value.trim();
            const result = document.getElementById('bbqAddResult');
            result.style.color = '#8696a0';
            result.textContent = 'Buscando...';

            const r = await window.BBQContacts.addByPhone(phone);
            if (r.ok) {
                this._mergeContact(r.contact);
                if (typeof renderMobileChatList === 'function') renderMobileChatList();
                result.style.color = '#22c55e';
                result.innerHTML = `✅ ${r.contact.name} agregado. <a href="#" id="bbqOpenChat" style="color:#f59e0b;">Abrir chat</a>`;
                document.getElementById('bbqOpenChat').onclick = (e) => {
                    e.preventDefault();
                    document.getElementById('bbqAddContactModal').style.display = 'none';
                    if (typeof selectMobileChat === 'function') selectMobileChat(r.contact.peerId);
                };
            } else if (r.notOnBBQ) {
                result.style.color = '#f59e0b';
                result.innerHTML = `⚠️ Ese número no tiene BBQ. <a href="#" id="bbqInvite" style="color:#f59e0b;">Invitar por WhatsApp/SMS</a>`;
                document.getElementById('bbqInvite').onclick = async (e) => {
                    e.preventDefault();
                    await window.BBQContacts.invite(phone);
                };
            } else {
                result.style.color = '#f87171';
                result.textContent = '❌ ' + (r.error || 'Error');
            }
        },

        async _handleImportAgenda() {
            const result = document.getElementById('bbqAddResult');
            result.style.color = '#8696a0';
            result.textContent = 'Leyendo agenda...';
            const read = await window.BBQContacts.readDeviceContacts();
            if (!read.ok) { result.style.color = '#f87171'; result.textContent = '❌ ' + read.error; return; }

            const match = await window.BBQContacts.matchAgenda(read.agenda);
            if (!match.ok) { result.style.color = '#f87171'; result.textContent = '❌ ' + match.error; return; }

            for (const c of match.added) this._mergeContact(c);
            if (typeof renderMobileChatList === 'function') renderMobileChatList();
            result.style.color = '#22c55e';
            result.textContent = `✅ ${match.added.length} de tus contactos ya usan BBQ y fueron agregados.`;
        }
    };

    // Toast mínimo
    window.bbqToast = function (text) {
        let t = document.getElementById('bbqToast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'bbqToast';
            t.style.cssText = `position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
                background:#2a3942; color:#e9edef; padding:10px 18px; border-radius:20px; z-index:300000;
                font-family:Inter,system-ui,sans-serif; font-size:0.85rem; box-shadow:0 6px 18px rgba(0,0,0,0.5);
                transition:opacity .3s; opacity:0;`;
            document.body.appendChild(t);
        }
        t.textContent = text;
        t.style.opacity = '1';
        clearTimeout(t._h);
        t._h = setTimeout(() => { t.style.opacity = '0'; }, 2500);
    };

    window.BBQ = BBQ;
})();
