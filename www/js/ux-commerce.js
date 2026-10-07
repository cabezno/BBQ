/**
 * BBQ - UX de comercio: directorio real de tiendas/entregas, publicar mi ficha, pedidos,
 * bandeja "El agente propone", fidelidad (programa, sellos, mis tarjetas) y código de seguridad.
 *
 * Extiende window.BBQUX (ux.js). Todo dato ajeno se pinta con escHtml()/safeId().
 */
(function () {
    const UX = window.BBQUX;
    if (!UX) return;
    const esc = (s) => window.escHtml(s);
    const sid = (s) => window.safeId(s);
    const money = (n) => '$' + (Number(n) || 0).toFixed(2);
    const sheet = (...a) => UX._sheet(...a);
    const close = (id) => UX._closeSheet(id);
    const toast = (t) => window.bbqToast && window.bbqToast(t);

    function realContacts() {
        if (typeof CONTACTS_DATA === 'undefined') return [];
        return Object.keys(CONTACTS_DATA).filter(id => CONTACTS_DATA[id].isReal && id.indexOf('bbq_') === 0 && id !== 'bbq_testbot' && id !== 'bbq_claude')
            .map(id => ({ id, name: CONTACTS_DATA[id].name }));
    }
    function contactName(id) { return (typeof CONTACTS_DATA !== 'undefined' && CONTACTS_DATA[id] && CONTACTS_DATA[id].name) || 'Cliente'; }

    Object.assign(UX, {
        _listingCache: {},

        // ── Directorio real de tiendas (arriba de los ejemplos) ──
        async renderRealStores() {
            const c = document.getElementById('storesMainListContainer');
            if (!c || !window.BBQListings) return;
            const real = await window.BBQListings.fetch('store');
            const old = c.querySelector('.bbq-real-stores');
            if (old) old.remove();
            if (!real.length) return;
            real.forEach(l => { this._listingCache['store:' + l.peerId] = l; });
            const html = `<div class="bbq-real-stores"><div class="bbq-section-title">En BBQ</div>` + real.map(l => `
                <div class="bbq-del-card" style="margin-bottom:10px;">
                    <div class="bbq-del-head">
                        <span class="bbq-del-avatar">${esc(l.icon || '🏪')}</span>
                        <span style="flex:1; min-width:0;"><span class="bbq-del-name">${esc(l.name)}</span><span class="bbq-me-sub">${esc([l.category, l.region].filter(Boolean).join(' · '))}</span></span>
                        <span class="bbq-verified-pill" title="Ficha firmada por su dueño"><i class="bi bi-patch-check-fill"></i></span>
                    </div>
                    ${l.description ? `<div class="bbq-me-sub" style="margin-bottom:8px;">${esc(l.description)}</div>` : ''}
                    <div style="display:flex; gap:8px;">
                        <button class="bbq-btn-secondary" onclick="BBQUX.openStoreDetail('${sid(l.peerId)}')"><i class="bi bi-bag"></i> Catálogo (${(l.products || []).length})</button>
                        <button class="bbq-empty-btn" style="flex:1; justify-content:center;" onclick="BBQUX.chatWithListing('store','${sid(l.peerId)}')"><i class="bi bi-chat-dots"></i> Chatear</button>
                    </div>
                </div>`).join('') + `<div class="bbq-section-title">Ejemplos</div></div>`;
            const banner = c.querySelector('.bbq-demo-banner');
            if (banner) banner.insertAdjacentHTML('beforebegin', html); else c.insertAdjacentHTML('afterbegin', html);
        },

        openStoreDetail(peerId) {
            const l = this._listingCache['store:' + peerId];
            if (!l) return;
            const items = (l.products || []).map(p => `<div class="bbq-del-zone"><span>${esc(p.name)}</span><span>${money(p.price)}${p.stock != null ? ' · stock ' + esc(p.stock) : ''}</span></div>`).join('')
                || '<div class="bbq-me-sub">Esta tienda todavía no cargó productos.</div>';
            sheet('bbqStoreDetail', `${esc(l.icon || '🏪')} ${esc(l.name)}`, `
                <div class="bbq-me-sub" style="margin-bottom:10px;">${esc(l.description || '')}</div>
                <div class="bbq-del-card">${items}</div>
                <button class="bbq-empty-btn" style="width:100%; justify-content:center; margin-top:14px;" onclick="BBQUX.chatWithListing('store','${sid(l.peerId)}')"><i class="bi bi-chat-dots"></i> Chatear con la tienda</button>
                <div class="bbq-me-sub" style="text-align:center; margin-top:10px;"><i class="bi bi-shield-lock"></i> El chat es cifrado de punta a punta.</div>`);
        },

        async chatWithListing(kind, peerId) {
            const l = this._listingCache[kind + ':' + peerId];
            if (!l) return;
            if (window.MY_PEER_ID === peerId) { toast('Esta es tu propia ficha'); return; }
            await window.BBQListings.addOwnerAsContact(l);
            close('bbqStoreDetail');
            if (typeof selectMobileChat === 'function') selectMobileChat(peerId);
        },

        // ── Publicar MI tienda en el directorio ──
        async openPublishStore() {
            const L = window.BBQListings;
            const listing = L.buildMyStoreListing();
            const published = await L.isPublished('store');
            sheet('bbqPublish', '<i class="bi bi-broadcast"></i> Publicar en el directorio', `
                <div class="bbq-me-sub" style="margin-bottom:12px;">Tu tienda aparece en la pestaña Tiendas de todos. La ficha va firmada con tu clave: nadie puede cambiarla ni hacerse pasar por vos.</div>
                <div class="bbq-del-card" style="margin-bottom:12px;">
                    <div class="bbq-del-head"><span class="bbq-del-avatar">${esc(listing.icon)}</span><span><span class="bbq-del-name">${esc(listing.name)}</span><span class="bbq-me-sub">${esc([listing.category, listing.region].filter(Boolean).join(' · '))}</span></span></div>
                    <div class="bbq-me-sub">${listing.products.length} producto(s) en el catálogo público</div>
                </div>
                <div class="bbq-me-sub" style="margin-bottom:12px;">Para cambiar nombre, rubro o productos: <a href="#" onclick="openModal('modalCreateStore'); return false;">Mi tienda</a>. Después volvé a publicar.</div>
                <button class="bbq-empty-btn" style="width:100%; justify-content:center;" onclick="BBQUX._doPublish()"><i class="bi bi-broadcast"></i> ${published ? 'Actualizar publicación' : 'Publicar mi tienda'}</button>
                ${published ? `<button class="bbq-btn-secondary" style="width:100%; margin-top:8px;" onclick="BBQUX._doUnpublish('store')">Dejar de publicar</button>` : ''}
                <div id="bbqPublishMsg" class="bbq-me-sub" style="text-align:center; margin-top:10px;"></div>`);
        },
        async _doPublish() {
            const msg = document.getElementById('bbqPublishMsg');
            if (msg) msg.textContent = 'Publicando…';
            const r = await window.BBQListings.publish('store', window.BBQListings.buildMyStoreListing());
            if (msg) msg.textContent = r.ok ? '✅ Publicada. Ya aparece en Tiendas.' : '⚠️ ' + (r.error || 'No se pudo publicar');
            this.refreshBadges();
        },
        async _doUnpublish(kind) {
            const r = await window.BBQListings.unpublish(kind);
            toast(r.ok ? 'Se quitó del directorio' : '⚠️ ' + (r.error || 'No se pudo'));
            close(kind === 'store' ? 'bbqPublish' : 'bbqDelivery');
            this.refreshBadges();
        },

        // ── Mi servicio de entrega ──
        async openDeliveryForm() {
            const L = window.BBQListings;
            const d = (await L.getMyDelivery()) || { name: '', description: '', zones: [{ zone: '', fee: '', eta: '' }] };
            const published = await L.isPublished('delivery');
            const zoneRow = (z, i) => `<div class="bbq-zone-row" data-i="${i}">
                <input class="bbq-input" placeholder="Zona (ej: Centro)" value="${esc(z.zone)}" data-k="zone">
                <input class="bbq-input" placeholder="$" inputmode="decimal" value="${esc(z.fee)}" data-k="fee" style="max-width:80px;">
                <input class="bbq-input" placeholder="Demora" value="${esc(z.eta)}" data-k="eta" style="max-width:96px;">
            </div>`;
            sheet('bbqDelivery', '<i class="bi bi-truck"></i> Mi servicio de entrega', `
                <div class="bbq-me-sub" style="margin-bottom:12px;">Publicá tus zonas y tarifas. Las tiendas y los clientes te encuentran en Tiendas → Entregas y te escriben por chat cifrado.</div>
                <label class="bbq-label">Nombre del servicio</label>
                <input id="bbqDelName" class="bbq-input" maxlength="60" placeholder="Ej: Mensajería Rápida Sur" value="${esc(d.name)}">
                <label class="bbq-label">Descripción</label>
                <input id="bbqDelDesc" class="bbq-input" maxlength="300" placeholder="Ej: Moto, entregas en el día" value="${esc(d.description)}">
                <label class="bbq-label">Zonas, precio y demora</label>
                <div id="bbqDelZones">${(d.zones || []).map(zoneRow).join('')}</div>
                <button class="bbq-btn-secondary" style="width:100%; margin:6px 0 14px;" onclick="BBQUX._addZoneRow()"><i class="bi bi-plus"></i> Agregar zona</button>
                <button class="bbq-empty-btn" style="width:100%; justify-content:center;" onclick="BBQUX._saveDelivery(true)"><i class="bi bi-broadcast"></i> ${published ? 'Guardar y actualizar publicación' : 'Guardar y publicar'}</button>
                <button class="bbq-btn-secondary" style="width:100%; margin-top:8px;" onclick="BBQUX._saveDelivery(false)">Solo guardar</button>
                ${published ? `<button class="bbq-btn-secondary" style="width:100%; margin-top:8px;" onclick="BBQUX._doUnpublish('delivery')">Dejar de publicar</button>` : ''}
                <div id="bbqDelMsg" class="bbq-me-sub" style="text-align:center; margin-top:10px;"></div>`);
            this._zoneRow = zoneRow;
        },
        _addZoneRow() {
            const box = document.getElementById('bbqDelZones');
            if (box && box.children.length < 30) box.insertAdjacentHTML('beforeend', this._zoneRow({ zone: '', fee: '', eta: '' }, box.children.length));
        },
        async _saveDelivery(publish) {
            const zones = Array.from(document.querySelectorAll('#bbqDelZones .bbq-zone-row')).map(r => ({
                zone: r.querySelector('[data-k=zone]').value.trim().slice(0, 80),
                fee: Number(String(r.querySelector('[data-k=fee]').value).replace(',', '.')) || 0,
                eta: r.querySelector('[data-k=eta]').value.trim().slice(0, 40)
            })).filter(z => z.zone);
            const d = { name: document.getElementById('bbqDelName').value.trim().slice(0, 60), description: document.getElementById('bbqDelDesc').value.trim().slice(0, 300), zones };
            const msg = document.getElementById('bbqDelMsg');
            if (!d.name) { if (msg) msg.textContent = '⚠️ Poné un nombre'; return; }
            await window.BBQListings.saveMyDelivery(d);
            if (!publish) { if (msg) msg.textContent = '✅ Guardado'; return; }
            if (!zones.length) { if (msg) msg.textContent = '⚠️ Agregá al menos una zona'; return; }
            if (msg) msg.textContent = 'Publicando…';
            const r = await window.BBQListings.publish('delivery', { name: d.name, description: d.description, icon: '🚚', zones });
            if (msg) msg.textContent = r.ok ? '✅ Publicado. Aparece en Tiendas → Entregas.' : '⚠️ ' + (r.error || 'No se pudo publicar');
        },

        // ── Pedidos de mi tienda ──
        async openOrders() {
            const O = window.BBQOrders;
            const orders = await O.list();
            const body = orders.length ? orders.map(o => {
                const next = O.NEXT[o.status];
                const closed = o.status === 'entregado' || o.status === 'cancelado';
                return `<div class="bbq-del-card" style="margin-bottom:10px;">
                    <div class="bbq-order-head">🧾 ${esc(o.buyerName || 'Cliente')} <span class="bbq-order-status s-${esc(o.status)}">${O.LABEL[o.status]}</span></div>
                    <div class="bbq-order-items">${o.items.map(it => `${esc(it.qty)}× ${esc(it.name)}`).join(' · ')}</div>
                    <div class="bbq-order-total">${money(o.total)} · ${o.deliveryMode === 'PICKUP' ? '🏪 Retiro' : '🚚 Envío'} · #${esc(o.id.slice(-6))}</div>
                    ${closed ? '' : `<div style="display:flex; gap:8px; margin-top:10px;">
                        ${next ? `<button class="bbq-empty-btn" style="flex:1; justify-content:center; padding:10px;" onclick="BBQUX._orderStatus('${sid(o.id)}','${next}')">Marcar ${esc(O.LABEL[next])}</button>` : ''}
                        <button class="bbq-btn-secondary" onclick="BBQUX._orderStatus('${sid(o.id)}','cancelado')">Cancelar</button>
                    </div>`}
                </div>`;
            }).join('') : UX._empty('🧾', 'Sin pedidos todavía', 'Creá un pedido desde un chat (📎 → Crear pedido) o dejá que tu agente los proponga.', '', '');
            sheet('bbqOrders', '<i class="bi bi-receipt"></i> Pedidos', `
                <button class="bbq-empty-btn" style="width:100%; justify-content:center; margin-bottom:12px;" onclick="BBQUX.openNewOrder()"><i class="bi bi-plus-lg"></i> Nuevo pedido</button>
                ${body}
                <div class="bbq-me-sub" style="text-align:center; margin-top:6px;">Cada cambio de estado le llega al cliente por chat cifrado.</div>`);
        },
        async _orderStatus(id, status) {
            const r = await window.BBQOrders.setStatus(id, status);
            if (!r.ok) toast('⚠️ ' + r.error); else toast('Estado actualizado y avisado al cliente');
            this.openOrders(); this.refreshBadges();
        },

        openNewOrder(presetBuyer) {
            const buyers = realContacts();
            const products = (window.merchantStorage && window.merchantStorage.getProducts && window.merchantStorage.getProducts()) || [];
            if (!buyers.length) { toast('Primero agregá al cliente como contacto'); return; }
            if (!products.length) { toast('Cargá productos en Mi tienda primero'); return; }
            sheet('bbqNewOrder', '<i class="bi bi-plus-lg"></i> Nuevo pedido', `
                <label class="bbq-label">Cliente</label>
                <select id="bbqNoBuyer" class="bbq-input">${buyers.map(b => `<option value="${esc(b.id)}" ${b.id === presetBuyer ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
                <label class="bbq-label">Producto</label>
                <select id="bbqNoProduct" class="bbq-input">${products.map((p, i) => `<option value="${i}">${esc(p.name)} — ${money(p.price)}</option>`).join('')}</select>
                <label class="bbq-label">Cantidad</label>
                <input id="bbqNoQty" class="bbq-input" type="number" min="1" value="1" inputmode="numeric">
                <label class="bbq-label">Entrega</label>
                <select id="bbqNoMode" class="bbq-input"><option value="COURIER">🚚 Envío</option><option value="PICKUP">🏪 Retiro en el local</option></select>
                <button class="bbq-empty-btn" style="width:100%; justify-content:center; margin-top:14px;" onclick="BBQUX._createOrder()"><i class="bi bi-send"></i> Crear y avisar al cliente</button>`);
        },
        async _createOrder() {
            const products = window.merchantStorage.getProducts() || [];
            const p = products[Number(document.getElementById('bbqNoProduct').value)];
            const buyer = document.getElementById('bbqNoBuyer').value;
            if (!p || !buyer) return;
            await window.BBQOrders.create({
                buyerPeerId: buyer, buyerName: contactName(buyer),
                items: [{ name: p.name, qty: Number(document.getElementById('bbqNoQty').value) || 1, price: p.price }],
                deliveryMode: document.getElementById('bbqNoMode').value
            });
            close('bbqNewOrder'); toast('Pedido creado y enviado al cliente');
            this.openOrders(); this.refreshBadges();
            if (typeof currentChatId !== 'undefined' && currentChatId === buyer && typeof renderMobileMessages === 'function') renderMobileMessages();
        },

        // ── Bandeja "El agente propone" ──
        async openProposals() {
            const all = (await window.BBQProposals.list()).slice().reverse();
            const describe = (p) => (window.BBQFlowRunner && window.BBQFlowRunner.describeProposal) ? window.BBQFlowRunner.describeProposal(p) : p.toolId;
            const body = all.length ? all.slice(0, 50).map(p => `
                <div class="bbq-del-card" style="margin-bottom:10px;">
                    <div style="font-weight:700; margin-bottom:4px;">${esc(describe(p))}</div>
                    <div class="bbq-me-sub">${esc(new Date(p.ts || Date.now()).toLocaleString())}${p.agentId ? ' · ' + esc(p.agentId) : ''}</div>
                    ${p.state === 'pendiente' ? `<div style="display:flex; gap:8px; margin-top:10px;">
                        <button class="bbq-empty-btn" style="flex:1; justify-content:center; padding:10px;" onclick="BBQUX._resolveProposal('${sid(p.id)}', true)"><i class="bi bi-check-lg"></i> Confirmar</button>
                        <button class="bbq-btn-secondary" onclick="BBQUX._resolveProposal('${sid(p.id)}', false)">Rechazar</button>
                    </div>` : `<div class="bbq-me-sub" style="margin-top:6px;">${p.state === 'confirmada' ? '✅ Confirmada' : '✖️ Rechazada'}</div>`}
                </div>`).join('')
                : UX._empty('🤖', 'Nada para confirmar', 'Cuando tu agente quiera cobrar, crear un pedido, cambiar precios o dar un sello, te lo propone acá y vos decidís.', '', '');
            sheet('bbqProposals', '<i class="bi bi-robot"></i> El agente propone', body);
        },
        async _resolveProposal(id, accept) {
            const r = await window.BBQProposals.resolve(id, accept);
            toast(r.ok ? (accept ? '✅ Hecho' : 'Rechazada') : '⚠️ ' + r.error);
            this.openProposals(); this.refreshBadges();
        },

        // ── Fidelidad: mi programa (tienda) ──
        async openLoyaltyProgram() {
            const p = await window.BBQLoyalty.getProgram();
            sheet('bbqLoyalty', '<i class="bi bi-award"></i> Programa de fidelidad', `
                <div class="bbq-me-sub" style="margin-bottom:12px;">Tus clientes juntan sellos firmados por tu tienda y los guardan en su teléfono. Nadie puede falsificarlos. Para dar un sello: en el chat con el cliente, 📎 → Dar sello.</div>
                <label class="bbq-toggle"><input type="checkbox" id="bbqLoyEnabled" ${p.enabled ? 'checked' : ''}> Programa activo</label>
                <label class="bbq-label">Sellos para completar la tarjeta</label>
                <input id="bbqLoyNeeded" class="bbq-input" type="number" min="2" max="50" value="${esc(p.needed)}" inputmode="numeric">
                <label class="bbq-label">Premio</label>
                <input id="bbqLoyReward" class="bbq-input" maxlength="120" placeholder="Ej: un café gratis / 20% off" value="${esc(p.reward)}">
                <button class="bbq-empty-btn" style="width:100%; justify-content:center; margin-top:14px;" onclick="BBQUX._saveLoyalty()"><i class="bi bi-check-lg"></i> Guardar</button>
                <div class="bbq-placeholder" style="margin-top:14px;"><b>Fidelización de tiendas</b> (beneficios por volumen, reputación con reseñas de compras reales): se define con el modelo de negocio. Ver docs/MODELO-NEGOCIO.md.</div>`);
        },
        async _saveLoyalty() {
            await window.BBQLoyalty.saveProgram({
                enabled: document.getElementById('bbqLoyEnabled').checked,
                needed: document.getElementById('bbqLoyNeeded').value,
                reward: document.getElementById('bbqLoyReward').value.trim()
            });
            toast('Programa guardado'); close('bbqLoyalty');
        },

        // ── Acciones dentro de un chat (menú 📎) ──
        async giveStampHere() {
            if (typeof hideAttachPopup === 'function') hideAttachPopup();
            const cid = typeof currentChatId !== 'undefined' ? currentChatId : null;
            if (!cid || !realContacts().some(c => c.id === cid)) { toast('Los sellos se dan en el chat con un cliente'); return; }
            const r = await window.BBQLoyalty.giveStamp(cid);
            if (!r.ok) { toast('⚠️ ' + r.error); if (/Activá/.test(r.error)) this.openLoyaltyProgram(); return; }
            toast(`🎟️ Sello ${r.n}/${r.needed} enviado`);
            if (typeof renderMobileMessages === 'function') renderMobileMessages();
        },
        newOrderHere() {
            if (typeof hideAttachPopup === 'function') hideAttachPopup();
            this.openNewOrder(typeof currentChatId !== 'undefined' ? currentChatId : null);
        },

        // ── Lado comprador ──
        async openMyOrders() {
            const O = window.BBQOrders;
            const mine = await O.myOrders();
            const body = mine.length ? mine.map(o => `
                <div class="bbq-del-card" style="margin-bottom:10px;">
                    <div class="bbq-order-head">🛍️ ${esc(o.storeName || 'Tienda')} <span class="bbq-order-status s-${esc(o.status)}">${O.LABEL[o.status] || esc(o.status)}</span></div>
                    <div class="bbq-order-items">${(o.items || []).map(it => `${esc(it.qty)}× ${esc(it.name)}`).join(' · ')}</div>
                    <div class="bbq-order-total">${money(o.total)} · #${esc(String(o.id).slice(-6))}</div>
                    <div class="bbq-order-steps">${['nuevo', 'confirmado', 'preparando', 'enviado', 'entregado'].map(s => `<span class="${(o.history || []).some(h => h.status === s) ? 'on' : ''}"></span>`).join('')}</div>
                </div>`).join('')
                : UX._empty('🛍️', 'Todavía no tenés pedidos', 'Cuando una tienda te arme un pedido, vas a ver acá cada paso: confirmado, preparando, enviado y entregado.', '', '');
            sheet('bbqMyOrders', '<i class="bi bi-bag"></i> Mis pedidos', body);
        },
        async openMyCards() {
            const cards = await window.BBQLoyalty.myCards();
            const ids = Object.keys(cards);
            const body = ids.length ? ids.map(id => {
                const c = cards[id];
                const need = Math.max(1, c.needed);
                const dots = Array.from({ length: Math.min(need, 20) }, (_, i) => `<span class="bbq-stamp-dot ${i < c.n ? 'on' : ''}"></span>`).join('');
                return `<div class="bbq-stamp-card" style="margin-bottom:10px;">
                    <div class="bbq-stamp-head">🎟️ ${esc(c.storeName)} <span>${esc(c.n)}/${esc(need)}</span></div>
                    <div class="bbq-stamp-dots">${dots}</div>
                    <div class="bbq-stamp-reward">Premio: ${esc(c.reward)}</div>
                    ${c.n >= need ? `<button class="bbq-empty-btn" style="width:100%; justify-content:center; margin-top:10px;" onclick="BBQUX._redeem('${sid(id)}')"><i class="bi bi-gift"></i> Pedir mi premio</button>` : ''}
                </div>`;
            }).join('') : UX._empty('🎟️', 'Sin tarjetas todavía', 'Cuando una tienda te dé un sello, aparece acá verificado con la firma de la tienda.', '', '');
            sheet('bbqMyCards', '<i class="bi bi-ticket-perforated"></i> Mis tarjetas de fidelidad', body);
        },
        async _redeem(storeId) {
            const r = await window.BBQLoyalty.requestRedeem(storeId);
            toast(r.ok ? '🎁 Pedido de canje enviado a la tienda' : '⚠️ ' + r.error);
        },

        // ── Código de seguridad (tocar la línea de estado del chat) ──
        async openSafety(peerId) {
            peerId = peerId || (typeof currentChatId !== 'undefined' ? currentChatId : null);
            const E = window.BBQE2E;
            if (!E || !peerId) return;
            const num = await E.safetyNumber(peerId);
            if (!num) { toast('Este chat no está cifrado de punta a punta (bot, agente o contacto sin claves)'); return; }
            const verified = await E.isVerified(peerId);
            sheet('bbqSafety', '<i class="bi bi-shield-lock-fill"></i> Código de seguridad', `
                <div class="bbq-me-sub" style="margin-bottom:12px;">Compará este código con el de <b>${esc(contactName(peerId))}</b>, en persona o por otra vía. Si es igual en los dos teléfonos, nadie está en el medio.</div>
                <div class="bbq-safety-number">${esc(num)}</div>
                <div class="bbq-me-sub" style="text-align:center; margin:10px 0 14px;">${verified ? '✅ Marcado como verificado' : 'Sin verificar'}</div>
                <button class="bbq-empty-btn" style="width:100%; justify-content:center;" onclick="BBQUX._setVerified('${sid(peerId)}', ${!verified})">${verified ? 'Quitar verificación' : '<i class="bi bi-check2-circle"></i> Es igual: marcar como verificado'}</button>
                <div class="bbq-placeholder" style="margin-top:14px;">Escaneo por QR con la cámara: próximamente. Por ahora se comparan los números.</div>`);
        },
        async _setVerified(peerId, yes) {
            await window.BBQE2E.setVerified(peerId, yes);
            close('bbqSafety'); toast(yes ? '✅ Contacto verificado' : 'Verificación quitada');
            this.updateChatHeader(peerId);
        },
        async updateChatHeader(peerId) {
            const el = document.getElementById('mActiveStatus');
            const E = window.BBQE2E;
            if (!el || !E || !E.knows(peerId)) return;
            const contact = (typeof CONTACTS_DATA !== 'undefined' && CONTACTS_DATA[peerId]) || {};
            const v = await E.isVerified(peerId);
            if (typeof currentChatId !== 'undefined' && currentChatId !== peerId) return;
            el.textContent = (v ? '🔒 Verificado · ' : '🔒 Cifrado · ') + (contact.status || '');
        }
    });

    // Al abrir un chat: estado de verificación en la cabecera.
    const origSelect = window.selectMobileChat;
    if (typeof origSelect === 'function') {
        window.selectMobileChat = function (chatId) { const r = origSelect.apply(this, arguments); UX.updateChatHeader(chatId); return r; };
    }
})();
