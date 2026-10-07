/**
 * BBQ - Capa de UX: pestaña "Yo", Centro de privacidad, Tiendas | Entregas,
 * pantallas vacías que guían y marcas de "ejemplo" en el contenido de demo.
 *
 * Se carga después de app.js y envuelve algunas funciones de render sin reescribirlas.
 * Todo dato ajeno se pinta con escHtml() (sanitize.js).
 */
(function () {
    const esc = (s) => window.escHtml(s);

    function row(icon, title, sub, onclick, badgeId) {
        return `<button class="bbq-me-row" onclick="${onclick}">
            <span class="bbq-me-icon"><i class="bi ${icon}"></i></span>
            <span class="bbq-me-text"><span class="bbq-me-title">${title}</span>${sub ? `<span class="bbq-me-sub">${sub}</span>` : ''}</span>
            ${badgeId ? `<span class="bbq-me-count" id="${badgeId}" style="display:none;"></span>` : ''}
            <i class="bi bi-chevron-right bbq-me-chev"></i>
        </button>`;
    }

    // Hoja inferior genérica (la usan privacidad, pedidos, fidelidad, etc.).
    function openSheet(id, title, bodyHtml) {
        let ov = document.getElementById(id);
        if (!ov) {
            ov = document.createElement('div');
            ov.id = id;
            ov.className = 'bbq-sheet-overlay';
            ov.onclick = (e) => { if (e.target === ov) ov.style.display = 'none'; };
            document.body.appendChild(ov);
        }
        ov.innerHTML = `<div class="bbq-sheet">
            <div class="bbq-sheet-head">
                <div class="bbq-sheet-title">${title}</div>
                <button class="bbq-sheet-close" onclick="document.getElementById('${id}').style.display='none'" aria-label="Cerrar">✕</button>
            </div>
            <div class="bbq-sheet-body">${bodyHtml}</div>
        </div>`;
        ov.style.display = 'flex';
        return ov;
    }
    function closeSheet(id) { const ov = document.getElementById(id); if (ov) ov.style.display = 'none'; }

    function emptyState(icon, title, text, btnLabel, btnAction) {
        return `<div class="bbq-empty">
            <div class="bbq-empty-icon">${icon}</div>
            <div class="bbq-empty-title">${title}</div>
            <div class="bbq-empty-text">${text}</div>
            ${btnLabel ? `<button class="bbq-empty-btn" onclick="${btnAction}">${btnLabel}</button>` : ''}
        </div>`;
    }

    function demoBanner(text) {
        return `<div class="bbq-demo-banner"><i class="bi bi-info-circle"></i> ${text}</div>`;
    }

    const UX = {
        // ── Pestaña "Yo" ──────────────────────────────────────────────
        renderMe() {
            const el = document.getElementById('viewMeSection');
            if (!el) return;
            const p = (window.BBQIdentity && window.BBQIdentity.getProfile && window.BBQIdentity.getProfile()) || {};
            const local = (window.buyerStorage && window.buyerStorage.getUserProfile && window.buyerStorage.getUserProfile()) || {};
            const avatar = local.avatar && String(local.avatar).startsWith('data:image')
                ? `<img src="${esc(local.avatar)}" alt="">` : esc(local.avatar || '👤');

            el.innerHTML = `
                <button class="bbq-me-card" onclick="openModal('modalProfile')">
                    <span class="bbq-me-avatar">${avatar}</span>
                    <span class="bbq-me-text">
                        <span class="bbq-me-name">${esc(p.name || 'Tu nombre')}</span>
                        <span class="bbq-me-sub">${esc(p.phone || 'Agregá tu número')}</span>
                        <span class="bbq-me-badge"><i class="bi bi-shield-lock-fill"></i> Identidad atada a este teléfono</span>
                    </span>
                    <i class="bi bi-pencil bbq-me-chev"></i>
                </button>

                <div class="bbq-me-group-title">Mi comercio</div>
                <div class="bbq-me-group">
                    ${row('bi-shop', 'Mi tienda', 'Catálogo, precios, stock y agente', "openModal('modalCreateStore')")}
                    ${row('bi-broadcast', 'Publicar en el directorio', 'Que te encuentren en Tiendas', 'BBQUX.openPublishStore()', 'meBadgePublished')}
                    ${row('bi-receipt', 'Pedidos', 'Estados y aviso automático al cliente', 'BBQUX.openOrders()', 'meBadgeOrders')}
                    ${row('bi-robot', 'El agente propone', 'Acciones del agente para confirmar', 'BBQUX.openProposals()', 'meBadgeProposals')}
                    ${row('bi-award', 'Programa de fidelidad', 'Sellos firmados por tu tienda', 'BBQUX.openLoyaltyProgram()')}
                    ${row('bi-credit-card', 'Cobrar a un cliente', 'Factura con compra protegida (modo prueba)', 'openMerchantChargeModal()')}
                    ${row('bi-truck', 'Mi servicio de entrega', 'Zonas, tarifas y publicación', 'BBQUX.openDeliveryForm()')}
                </div>

                <div class="bbq-me-group-title">Mis compras</div>
                <div class="bbq-me-group">
                    ${row('bi-bag', 'Mis pedidos', 'Lo que te avisan las tiendas', 'BBQUX.openMyOrders()', 'meBadgeMyOrders')}
                    ${row('bi-ticket-perforated', 'Mis tarjetas de fidelidad', 'Sellos verificados de cada tienda', 'BBQUX.openMyCards()')}
                </div>

                <div class="bbq-me-group-title">Inteligencia artificial</div>
                <div class="bbq-me-group">
                    ${row('bi-robot', 'Conectar IA', 'Tu API, en el teléfono o en tu PC. Sin IA también funciona', "openModal('modalAiSetup')")}
                    ${row('bi-cpu', 'Automatizaciones', 'Reglas para tu tienda', "openModal('modalAutomations')")}
                </div>

                <div class="bbq-me-group-title">Privacidad y seguridad</div>
                <div class="bbq-me-group">
                    ${row('bi-shield-lock', 'Centro de privacidad', 'Qué queda en tu teléfono y qué ve el servidor', 'BBQUX.openPrivacy()')}
                </div>

                <div class="bbq-me-group-title">Comunidad</div>
                <div class="bbq-me-group">
                    ${row('bi-gift', 'Referidos', 'Invitá a tus contactos', "openModal('modalReferrals')")}
                    ${row('bi-people', 'Comunidades', 'De ejemplo', "switchMobileTab('community')")}
                </div>

                <div class="bbq-me-group-title">General</div>
                <div class="bbq-me-group">
                    ${row('bi-gear', 'Ajustes', '', "openModal('modalSettings')")}
                </div>
                <div class="bbq-me-foot">BBQ · mensajería y comercio directo entre personas</div>`;
            this.refreshBadges();
        },

        // Contadores de la pestaña Yo (pedidos abiertos, propuestas pendientes, publicación).
        async refreshBadges() {
            const set = (id, n, text) => { const el = document.getElementById(id); if (!el) return; el.textContent = text || String(n); el.style.display = n ? '' : 'none'; };
            try {
                if (window.BBQOrders) {
                    const open = (await window.BBQOrders.list()).filter(o => o.status !== 'entregado' && o.status !== 'cancelado').length;
                    set('meBadgeOrders', open);
                    const mine = (await window.BBQOrders.myOrders()).filter(o => o.status !== 'entregado' && o.status !== 'cancelado').length;
                    set('meBadgeMyOrders', mine);
                }
                if (window.BBQProposals) set('meBadgeProposals', (await window.BBQProposals.pending()).length);
                if (window.BBQListings) set('meBadgePublished', (await window.BBQListings.isPublished('store')) ? 1 : 0, 'Publicada');
            } catch (e) {}
        },

        // ── Centro de privacidad ──────────────────────────────────────
        openPrivacy() {
            let ov = document.getElementById('bbqPrivacyCenter');
            if (!ov) {
                ov = document.createElement('div');
                ov.id = 'bbqPrivacyCenter';
                ov.className = 'bbq-sheet-overlay';
                ov.onclick = (e) => { if (e.target === ov) ov.style.display = 'none'; };
                document.body.appendChild(ov);
            }
            const p = (window.BBQIdentity && window.BBQIdentity.getProfile && window.BBQIdentity.getProfile()) || {};
            const nContacts = (typeof CONTACTS_DATA !== 'undefined') ? Object.values(CONTACTS_DATA).filter(c => c.isReal).length : 0;
            const nE2E = (window.BBQE2E && window.BBQE2E._peers) ? window.BBQE2E._peers.size : 0;
            ov.innerHTML = `
                <div class="bbq-sheet">
                    <div class="bbq-sheet-head">
                        <div class="bbq-sheet-title"><i class="bi bi-shield-lock-fill"></i> Centro de privacidad</div>
                        <button class="bbq-sheet-close" onclick="document.getElementById('bbqPrivacyCenter').style.display='none'" aria-label="Cerrar">✕</button>
                    </div>
                    <div class="bbq-sheet-body">
                        <div class="bbq-priv-block ok">
                            <div class="bbq-priv-h">📱 En tu teléfono (solo vos)</div>
                            <ul>
                                <li>Tus chats, fotos, audios y contactos</li>
                                <li>Tu clave de identidad (no se puede copiar ni exportar)</li>
                                <li>Tu tienda, productos y configuración de IA</li>
                            </ul>
                        </div>
                        <div class="bbq-priv-block">
                            <div class="bbq-priv-h">🌐 En el directorio (lo ven otros)</div>
                            <ul>
                                <li>Tu nombre: <b>${esc(p.name || '—')}</b></li>
                                <li>Tu número: <b>${esc(p.phone || '—')}</b>, para que te encuentren</li>
                                <li>Tus claves públicas (sirven para cifrarte mensajes)</li>
                            </ul>
                        </div>
                        <div class="bbq-priv-block">
                            <div class="bbq-priv-h">🔒 Lo que el servidor NO puede ver</div>
                            <ul>
                                <li>El contenido de tus mensajes con personas: van cifrados de punta a punta</li>
                                <li>Si el contacto directo falla, el servidor pasa el mensaje cerrado, sin guardarlo</li>
                            </ul>
                        </div>
                        <div class="bbq-priv-block warn">
                            <div class="bbq-priv-h">⚠️ Sin cifrar por ahora</div>
                            <ul>
                                <li>Chats con bots y agentes de IA (la app lo avisa en cada chat)</li>
                            </ul>
                        </div>
                        <div class="bbq-priv-stats">
                            <span><b>${nContacts}</b> contactos</span>
                            <span><b>${nE2E}</b> con cifrado verificado</span>
                        </div>
                    </div>
                </div>`;
            ov.style.display = 'flex';
        },

        // ── Tiendas | Entregas ────────────────────────────────────────
        showStoresMode(mode) {
            const isDel = mode === 'deliveries';
            const a = document.getElementById('storesModeStores');
            const b = document.getElementById('storesModeDeliveries');
            if (a) a.style.display = isDel ? 'none' : '';
            if (b) b.style.display = isDel ? '' : 'none';
            const sa = document.getElementById('segStores');
            const sb = document.getElementById('segDeliveries');
            if (sa) sa.classList.toggle('active', !isDel);
            if (sb) sb.classList.toggle('active', isDel);
            if (isDel) this.renderDeliveries();
        },

        async renderDeliveries() {
            const el = document.getElementById('storesModeDeliveries');
            if (!el) return;
            const real = window.BBQListings ? await window.BBQListings.fetch('delivery') : [];
            this._listingCache = this._listingCache || {};
            real.forEach(l => { this._listingCache['delivery:' + l.peerId] = l; });
            const realHtml = real.map(l => `
                <div class="bbq-del-card" style="margin-bottom:10px;">
                    <div class="bbq-del-head">
                        <span class="bbq-del-avatar">${esc(l.icon || '🚚')}</span>
                        <span style="flex:1;"><span class="bbq-del-name">${esc(l.name)}</span><span class="bbq-me-sub">${esc(l.description || l.region || '')}</span></span>
                        <span class="bbq-verified-pill" title="Ficha firmada por su dueño"><i class="bi bi-patch-check-fill"></i></span>
                    </div>
                    ${(l.zones || []).slice(0, 30).map(z => `<div class="bbq-del-zone"><span>${esc(z.zone)}</span><span>$${(Number(z.fee) || 0).toFixed(2)}${z.eta ? ' · ' + esc(z.eta) : ''}</span></div>`).join('')}
                    <button class="bbq-empty-btn" style="width:100%; justify-content:center; margin-top:10px;" onclick="BBQUX.chatWithListing('delivery','${safeId(l.peerId)}')"><i class="bi bi-chat-dots"></i> Chatear</button>
                </div>`).join('');
            const rates = (window.logisticsEngine && window.logisticsEngine.rateMatrix) || [];
            const zones = rates.map(r => `<div class="bbq-del-zone"><span>${esc(r.zone)}</span><span>$${Number(r.fee).toFixed(2)} · ${esc(r.estTime)}</span></div>`).join('');
            el.innerHTML = (realHtml ? `<div class="bbq-section-title">En BBQ</div>${realHtml}<div class="bbq-section-title">Ejemplo</div>` : '')
                + demoBanner('Servicio de entrega de ejemplo. Los servicios reales aparecen acá cuando se publican desde Yo → Mi servicio de entrega.') + `
                <div class="bbq-del-card">
                    <div class="bbq-del-head">
                        <span class="bbq-del-avatar">🚚</span>
                        <span><span class="bbq-del-name">Express Courier</span><span class="bbq-me-sub">Entregas con QR de compra protegida</span></span>
                        <span class="bbq-demo-pill">EJEMPLO</span>
                    </div>
                    ${zones || '<div class="bbq-me-sub">Sin zonas cargadas</div>'}
                </div>`;
        },

        // ── Envolturas de render: pantallas vacías y marcas de ejemplo ──
        _wrap() {
            const wrap = (name, after) => {
                const orig = window[name];
                if (typeof orig !== 'function' || orig._bbqWrapped) return;
                const fn = function () { const r = orig.apply(this, arguments); try { after.apply(this, arguments); } catch (e) { console.warn('[UX]', e); } return r; };
                fn._bbqWrapped = true;
                window[name] = fn;
            };

            wrap('renderMobileChatList', () => {
                const c = document.getElementById('mChatListContainer');
                if (c && !c.querySelector('.m-chat-item')) {
                    c.innerHTML = emptyState('💬', 'Todavía no tenés chats',
                        'Agregá a alguien por su número de teléfono. Si todavía no usa BBQ, lo podés invitar.',
                        '<i class="bi bi-person-plus"></i> Agregar contacto', 'window.BBQ && window.BBQ.openAddContactModal()');
                }
            });

            wrap('initInstagramStoriesFullGrid', () => {
                const g = document.getElementById('instagramStoriesFullGrid');
                if (g && !g.children.length) {
                    g.innerHTML = emptyState('✨', 'No hay estados todavía',
                        'Compartí una foto o un texto con tus contactos. Desaparece en 24 horas.',
                        '<i class="bi bi-camera"></i> Crear estado', "openModal('modalCreateStatus')");
                }
            });

            wrap('renderCallsSection', () => {
                const c = document.getElementById('callsListContainer');
                if (c && !(window.buyerStorage.getCalls() || []).length) {
                    c.innerHTML = emptyState('📞', 'Sin llamadas todavía',
                        'Las llamadas de voz y video van directo entre teléfonos y cifradas.',
                        '<i class="bi bi-telephone-plus"></i> Llamar a un contacto', 'handleFabClick()');
                }
            });

            wrap('renderStoresSection', () => {
                const c = document.getElementById('storesMainListContainer');
                if (c && !c.querySelector('.bbq-demo-banner')) {
                    c.insertAdjacentHTML('afterbegin', demoBanner('Estas tiendas son de ejemplo. Las tiendas reales aparecen arriba cuando sus dueños las publican desde Yo → Publicar en el directorio.'));
                }
                UX.renderRealStores();
            });

            wrap('renderCommunitySection', () => {
                const c = document.getElementById('communityListContainer');
                if (c && !c.querySelector('.bbq-demo-banner')) {
                    c.insertAdjacentHTML('afterbegin', demoBanner('Comunidades de ejemplo: todavía no se puede unirse a grupos reales.'));
                }
            });
        }
    };

    // Helpers compartidos con ux-commerce.js
    UX._sheet = openSheet; UX._closeSheet = closeSheet; UX._empty = emptyState; UX._demo = demoBanner;

    window.BBQUX = UX;
    UX._wrap();
})();
