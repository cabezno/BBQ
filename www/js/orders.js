/**
 * BBQ - Operativa de tienda: pedidos con estados + bandeja "El agente propone".
 *
 * Todo vive en el teléfono del dueño (IndexedDB). Cada cambio de estado se le avisa al
 * comprador por chat (cifrado E2E) con una tarjeta 'order_update', que el comprador guarda
 * en "Mis pedidos". Las mismas acciones quedan expuestas como tools de BBQTools para que
 * un agente (IA o reglas) las use; las que cambian algo requieren confirmación del dueño.
 */
(function () {
    const KV_ORDERS = 'orders';            // pedidos de MI tienda
    const KV_MY_ORDERS = 'my_orders';      // pedidos que hice como comprador (por tarjetas recibidas)
    const KV_PROPOSALS = 'agent_proposals';

    const STATUSES = ['nuevo', 'confirmado', 'preparando', 'enviado', 'entregado', 'cancelado'];
    const LABEL = { nuevo: '🆕 Nuevo', confirmado: '✅ Confirmado', preparando: '📦 Preparando', enviado: '🚚 Enviado', entregado: '🎉 Entregado', cancelado: '✖️ Cancelado' };
    const NEXT = { nuevo: 'confirmado', confirmado: 'preparando', preparando: 'enviado', enviado: 'entregado' };

    async function kvGet(k, def) { try { const v = await window.BBQDB.kvGet(k); return v == null ? def : v; } catch (e) { return def; } }
    async function kvSet(k, v) { try { await window.BBQDB.kvSet(k, v); } catch (e) {} }

    function storeName() {
        const st = window.merchantStorage && window.merchantStorage.getUserStore && window.merchantStorage.getUserStore();
        return (st && st.name) || 'Tienda';
    }

    // Avisa al comprador (tarjeta en el chat, cifrada si hay claves).
    async function notifyBuyer(order) {
        if (!order.buyerPeerId || !window.BBQNet) return;
        const card = { type: 'order_update', id: order.id, status: order.status, storeName: storeName(), total: order.total, items: order.items };
        const msg = { id: 'm_' + Date.now(), sender: window.MY_PEER_ID, text: `${LABEL[order.status] || order.status} · Pedido ${order.id.slice(-6)}`, timestamp: new Date().toISOString(), payloadCard: card, status: 'pending' };
        window.buyerStorage.appendChatMessage(order.buyerPeerId, msg);
        const payload = { type: 'chat', message: msg };
        if (window.BBQ && window.BBQ.outboxAdd) window.BBQ.outboxAdd(order.buyerPeerId, payload);
        await window.BBQNet.send(order.buyerPeerId, payload);
    }

    const Orders = {
        STATUSES, LABEL, NEXT,

        async list() { return (await kvGet(KV_ORDERS, [])).sort((a, b) => b.createdAt - a.createdAt); },

        async create({ buyerPeerId, buyerName, items, deliveryMode, note }) {
            const its = (items || []).map(it => ({ name: String(it.name || ''), qty: Math.max(1, Number(it.qty) || 1), price: Number(it.price) || 0 }));
            const order = {
                id: 'ord_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                buyerPeerId: buyerPeerId || '', buyerName: buyerName || '',
                items: its, total: its.reduce((s, it) => s + it.qty * it.price, 0),
                deliveryMode: deliveryMode === 'PICKUP' ? 'PICKUP' : 'COURIER', note: note || '',
                status: 'nuevo', createdAt: Date.now(), history: [{ status: 'nuevo', ts: Date.now() }]
            };
            const all = await kvGet(KV_ORDERS, []);
            all.push(order); await kvSet(KV_ORDERS, all);
            await notifyBuyer(order);
            return order;
        },

        async setStatus(id, status) {
            if (!STATUSES.includes(status)) return { ok: false, error: 'Estado inválido' };
            const all = await kvGet(KV_ORDERS, []);
            const o = all.find(x => x.id === id);
            if (!o) return { ok: false, error: 'Pedido no encontrado' };
            if (o.status === 'entregado' || o.status === 'cancelado') return { ok: false, error: 'El pedido ya está cerrado' };
            o.status = status; o.history.push({ status, ts: Date.now() });
            await kvSet(KV_ORDERS, all);
            await notifyBuyer(o);
            return { ok: true, order: o };
        },

        // ── Lado comprador: guardar/actualizar lo que avisa la tienda ──
        async receiveUpdate(fromPeerId, card) {
            if (!card || !card.id || !STATUSES.includes(card.status)) return;
            const mine = await kvGet(KV_MY_ORDERS, []);
            let o = mine.find(x => x.id === card.id && x.storePeerId === fromPeerId);
            if (!o) { o = { id: card.id, storePeerId: fromPeerId, storeName: String(card.storeName || ''), items: Array.isArray(card.items) ? card.items.slice(0, 50) : [], total: Number(card.total) || 0, history: [] }; mine.push(o); }
            o.status = card.status; o.updatedAt = Date.now(); o.history.push({ status: card.status, ts: Date.now() });
            await kvSet(KV_MY_ORDERS, mine);
        },
        async myOrders() { return (await kvGet(KV_MY_ORDERS, [])).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); }
    };

    // ── Bandeja "El agente propone": propuestas de acciones sensibles a confirmar ──
    const Proposals = {
        async list() { return await kvGet(KV_PROPOSALS, []); },
        async pending() { return (await this.list()).filter(p => p.state === 'pendiente'); },
        async add(p) {
            const all = await kvGet(KV_PROPOSALS, []);
            all.push(Object.assign({ id: 'prop_' + Date.now().toString(36), state: 'pendiente' }, p));
            await kvSet(KV_PROPOSALS, all.slice(-200));
            if (window.BBQUX && window.BBQUX.refreshBadges) window.BBQUX.refreshBadges();
        },
        async resolve(id, accept) {
            const all = await kvGet(KV_PROPOSALS, []);
            const p = all.find(x => x.id === id);
            if (!p || p.state !== 'pendiente') return { ok: false, error: 'Ya resuelta' };
            let result = null;
            if (accept) result = await window.BBQTools.runDirect(p.toolId, p.args, {});
            p.state = accept ? 'confirmada' : 'rechazada'; p.resolvedAt = Date.now();
            p.result = typeof result === 'string' ? result : (result && result.ok === false ? (result.error || 'error') : 'ok');
            await kvSet(KV_PROPOSALS, all);
            return { ok: true, result };
        }
    };

    // ── Tools para agentes (contrato de BBQTools) ──
    if (window.BBQTools) {
        const T = window.BBQTools;
        // Reemplaza la versión mínima: ahora el pedido se guarda y se avisa al comprador.
        T.register('order.create', {
            desc: 'Crea un pedido para un comprador con los productos indicados y le avisa por chat.',
            input: { buyerPeerId: 'string', items: 'array', deliveryMode: 'string' }, permiso: 'commerce', sensible: true,
            run: (a) => Orders.create(a)
        });
        T.register('order.list', {
            desc: 'Lista los pedidos de la tienda con su estado.',
            permiso: 'store.read', sensible: false,
            run: async () => (await Orders.list()).map(o => ({ id: o.id, comprador: o.buyerName, estado: o.status, total: o.total }))
        });
        T.register('order.setStatus', {
            desc: 'Cambia el estado de un pedido (confirmado, preparando, enviado, entregado, cancelado) y le avisa al comprador.',
            input: { id: 'string', status: 'string' }, permiso: 'commerce', sensible: true,
            run: (a) => Orders.setStatus(a.id, a.status)
        });
    }

    window.BBQOrders = Orders;
    window.BBQProposals = Proposals;
})();
