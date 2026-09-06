/**
 * bbq-tools.js — Registro de CAPACIDADES (tools) de la plataforma para agentes
 *
 * El motor bbq-flow.js soporta stages `tool` con firma (args, ctx) => resultado,
 * pero no traía ninguna tool registrada. Este módulo expone las acciones reales de
 * BBQ como tools con contrato, permisos y gate de confirmación humana.
 *
 * Contrato de una tool:
 *   register(id, { desc, input, output, permiso, sensible, run(args, ctx) })
 *     - desc:     una frase (el LLM la lee para decidir cuándo usarla)
 *     - permiso:  string; la tool solo corre si está en los permisos concedidos
 *     - sensible: true ⇒ NO se ejecuta sola; genera una PROPUESTA que el dueño confirma
 *     - run:      la acción real (cableada a los motores/funciones existentes)
 *
 * buildToolset(granted, { onProposal, agentId }) → { toolId: fn } listo para runFlow.
 *   Envuelve cada tool con: check de permiso + gate de confirmación (si es sensible).
 *
 * Ver docs/ARQUITECTURA-AGENTES.md
 */
(function () {
    const registry = {};

    function register(id, def) { registry[id] = Object.assign({ id }, def); }
    function get(id) { return registry[id]; }
    function all() { return Object.values(registry); }

    // Ejecuta una tool SIN gate ni permiso (uso interno: tras la confirmación humana).
    async function runDirect(id, args, ctx) {
        const t = registry[id];
        if (!t) return `(tool desconocida: ${id})`;
        try { return await t.run(args || {}, ctx || {}); }
        catch (e) { return '(tool error: ' + e.message + ')'; }
    }

    // Arma el conjunto de tools para un agente: aplica permisos y confirmación.
    function buildToolset(granted, opts) {
        granted = granted || [];
        opts = opts || {};
        const set = {};
        for (const t of all()) {
            set[t.id] = async (args, ctx) => {
                if (t.permiso && granted.indexOf(t.permiso) === -1) {
                    return `(permiso denegado: ${t.permiso})`;
                }
                if (t.sensible) {
                    const proposal = { toolId: t.id, desc: t.desc, args: args || {}, agentId: opts.agentId, ts: Date.now() };
                    if (typeof opts.onProposal === 'function') return await opts.onProposal(proposal);
                    return `(propuesta pendiente de confirmación: ${t.id})`;
                }
                try { return await t.run(args || {}, ctx); }
                catch (e) { return '(tool error: ' + e.message + ')'; }
            };
        }
        return set;
    }

    // ── Helpers de acceso a los motores (tolerantes: si no existen, error claro) ──
    function store() {
        const s = (typeof window !== 'undefined') && window.merchantStorage;
        if (!s) throw new Error('almacenamiento de tienda no disponible en este ejecutor');
        return s;
    }
    function findProduct(idOrName) {
        const q = String(idOrName || '').toLowerCase().trim();
        const products = store().getProducts() || [];
        return products.find(p => String(p.id).toLowerCase() === q)
            || products.find(p => String(p.name || '').toLowerCase().includes(q))
            || null;
    }
    function money(n) { return '$' + Number(n || 0).toLocaleString('es-AR'); }

    /* ════════════ CAPACIDADES DEL AGENTE TIENDA ════════════ */

    // ── Lectura (no sensibles: se ejecutan directo) ──
    register('store.info', {
        desc: 'Devuelve los datos de la tienda (nombre, categoría, región).',
        permiso: 'store.read', sensible: false,
        run: () => { const s = store().getUserStore() || {}; return { name: s.name, category: s.category, region: s.region, bio: s.bio }; }
    });

    register('store.listProducts', {
        desc: 'Lista los productos del catálogo con precio y stock.',
        permiso: 'store.read', sensible: false,
        run: () => (store().getProducts() || []).map(p => ({ id: p.id, name: p.name, price: p.price, stock: p.stock, category: p.category }))
    });

    register('store.getProduct', {
        desc: 'Devuelve un producto por id o por nombre (precio, stock, envío).',
        input: { idOrName: 'string' }, permiso: 'store.read', sensible: false,
        run: (a) => findProduct(a.idOrName) || `(no encontré el producto "${a.idOrName}")`
    });

    register('store.checkStock', {
        desc: 'Devuelve el stock disponible de un producto.',
        input: { idOrName: 'string' }, permiso: 'store.read', sensible: false,
        run: (a) => { const p = findProduct(a.idOrName); return p ? { name: p.name, stock: p.stock } : `(no encontré "${a.idOrName}")`; }
    });

    // Catálogo formateado como TEXTO para inyectar como contexto del LLM (datos reales).
    register('store.catalogText', {
        desc: 'Devuelve el catálogo como texto legible (para dar contexto real al modelo).',
        permiso: 'store.read', sensible: false,
        run: () => {
            const products = store().getProducts() || [];
            if (!products.length) return 'La tienda todavía no tiene productos cargados.';
            return products.map(p => `- ${p.name}: ${money(p.price)}${p.shippingFee ? ' (+ envío ' + money(p.shippingFee) + ')' : ''} — stock: ${p.stock != null ? p.stock : 's/d'}`).join('\n');
        }
    });

    // ── Escritura de catálogo (SENSIBLES: requieren confirmación) ──
    register('store.upsertProduct', {
        desc: 'Crea o edita un producto (nombre, precio, stock, categoría).',
        input: { name: 'string', price: 'number', stock: 'number', category: 'string' }, permiso: 'store.write', sensible: true,
        run: (a) => {
            const existing = a.id ? findProduct(a.id) : findProduct(a.name);
            const product = Object.assign({ id: (existing && existing.id) || 'p_' + Date.now(), image: '📦', shippingFee: 0 }, existing || {}, a);
            store().saveProduct(product);
            return { ok: true, product };
        }
    });

    register('store.setPrice', {
        desc: 'Cambia el precio de un producto.',
        input: { idOrName: 'string', price: 'number' }, permiso: 'store.write', sensible: true,
        run: (a) => { const p = findProduct(a.idOrName); if (!p) return `(no encontré "${a.idOrName}")`; p.price = Number(a.price); store().saveProduct(p); return { ok: true, product: p }; }
    });

    register('store.setStock', {
        desc: 'Ajusta el stock de un producto (valor absoluto o delta).',
        input: { idOrName: 'string', stock: 'number', delta: 'number' }, permiso: 'store.write', sensible: true,
        run: (a) => { const p = findProduct(a.idOrName); if (!p) return `(no encontré "${a.idOrName}")`; p.stock = a.delta != null ? Number(p.stock || 0) + Number(a.delta) : Number(a.stock); store().saveProduct(p); return { ok: true, product: p }; }
    });

    // ── Pedido (SENSIBLE) — entidad mínima; persistencia real en la próxima iteración ──
    register('order.create', {
        desc: 'Arma un pedido con los productos y el comprador indicados.',
        input: { items: 'array', buyer: 'string' }, permiso: 'commerce', sensible: true,
        run: (a) => {
            const items = (a.items || []).map(it => { const p = findProduct(it.idOrName || it.name); return { name: p ? p.name : (it.name || it.idOrName), qty: Number(it.qty || 1), price: p ? p.price : Number(it.price || 0) }; });
            const total = items.reduce((s, it) => s + it.price * it.qty, 0);
            return { id: 'ord_' + Date.now(), buyer: a.buyer || '', items, total, status: 'pendiente', ts: Date.now() };
        }
    });

    // ── Dinero (SENSIBLES) — hoy TEST/simulado; ver docs (hito v2 = dinero real) ──
    register('pay.charge', {
        desc: 'Genera un cobro por un monto (TEST: no cobra dinero real).',
        input: { amount: 'number', concept: 'string' }, permiso: 'commerce', sensible: true,
        run: async (a) => {
            const eng = (typeof window !== 'undefined') && window.googlePayEngine;
            if (!eng) throw new Error('motor de pago no disponible');
            const res = await eng.processPayment(Number(a.amount || 0), a.concept || 'Compra BBQ', a.deliveryMode || 'COURIER');
            return { ok: !!(res && res.success), mode: 'TEST', amount: a.amount, result: res };
        }
    });

    register('escrow.hold', {
        desc: 'Retiene el pago (AUTH_HOLD) hasta la entrega (TEST/simulado).',
        input: { price: 'number', shipping: 'number' }, permiso: 'commerce', sensible: true,
        run: (a) => { const e = window.escrowEngine; if (!e) throw new Error('motor de escrow no disponible'); e.createAuthAndHoldEscrow(Number(a.price || 0), Number(a.shipping || 0)); return { ok: true, status: 'AUTH_HOLD', mode: 'TEST' }; }
    });

    register('escrow.confirmDelivery', {
        desc: 'Confirma la entrega y libera el pago retenido (TEST/simulado).',
        input: { secret: 'string' }, permiso: 'commerce', sensible: true,
        run: (a) => { const e = window.escrowEngine; if (!e) throw new Error('motor de escrow no disponible'); e.verifyAndSettleScan(a.secret || '', a.role || 'courier'); return { ok: true, status: 'CAPTURED', mode: 'TEST' }; }
    });

    register('escrow.refund', {
        desc: 'Reembolsa el pago retenido (TEST/simulado).',
        permiso: 'commerce', sensible: true,
        run: () => { const e = window.escrowEngine; if (!e) throw new Error('motor de escrow no disponible'); e.simulateRefundTimeout(); return { ok: true, status: 'EXPIRED', mode: 'TEST' }; }
    });

    // ── Comunicación ──
    register('chat.reply', {
        desc: 'Envía un mensaje de texto de respuesta al cliente.',
        input: { text: 'string' }, permiso: 'chat', sensible: false,
        run: (a, ctx) => { if (ctx && typeof ctx.__onReply === 'function') ctx.__onReply(a.text || ''); return { ok: true }; }
    });

    // Perfiles de permisos por tipo de agente (composición de permisos).
    const PROFILES = {
        'store': ['store.read', 'store.write', 'commerce', 'chat'],   // Agente Tienda
        'store-readonly': ['store.read', 'chat']                       // solo atención
    };

    const BBQTools = { register, get, all, runDirect, buildToolset, PROFILES };
    if (typeof module !== 'undefined' && module.exports) module.exports = BBQTools;
    if (typeof window !== 'undefined') window.BBQTools = BBQTools;
})();
