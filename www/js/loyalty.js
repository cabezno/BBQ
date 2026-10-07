/**
 * BBQ - Fidelización P2P: tarjeta de sellos firmada por la tienda.
 *
 * - La tienda define su programa (sellos necesarios + premio) y entrega sellos por chat.
 * - Cada sello va FIRMADO con la clave de identidad de la tienda:
 *     `bbq-stamp-v1|${storeId}|${customer}|${n}|${needed}|${reward}|${ts}`
 *   El cliente lo verifica con la clave pública de la tienda (la misma que usa el cifrado E2E)
 *   y lo guarda en SU teléfono. No hay base central: nadie puede inventar sellos ajenos.
 * - Canje: el cliente pide el premio por chat; la tienda lo confirma y su contador vuelve a 0.
 */
(function () {
    const enc = new TextEncoder();
    const KV_PROGRAM = 'loyalty_program';   // tienda: { enabled, needed, reward }
    const KV_ISSUED = 'loyalty_issued';     // tienda: { customerPeerId: n }
    const KV_CARDS = 'loyalty_cards';       // cliente: { storeId: { storeName, n, needed, reward, last } }

    async function kvGet(k, def) { try { const v = await window.BBQDB.kvGet(k); return v == null ? def : v; } catch (e) { return def; } }
    async function kvSet(k, v) { try { await window.BBQDB.kvSet(k, v); } catch (e) {} }
    function b64ToBuf(b64) { const bin = atob(b64); const o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o; }

    function stampString(c) { return `bbq-stamp-v1|${c.storeId}|${c.customer}|${c.n}|${c.needed}|${c.reward}|${c.ts}`; }

    const Loyalty = {
        // ── Lado tienda ──
        async getProgram() { return await kvGet(KV_PROGRAM, { enabled: false, needed: 10, reward: '' }); },
        async saveProgram(p) {
            const prog = { enabled: !!p.enabled, needed: Math.min(50, Math.max(2, Number(p.needed) || 10)), reward: String(p.reward || '').slice(0, 120) };
            await kvSet(KV_PROGRAM, prog); return prog;
        },
        async issuedFor(customer) { return (await kvGet(KV_ISSUED, {}))[customer] || 0; },

        /** Entrega un sello firmado a un cliente (por chat, cifrado). */
        async giveStamp(customer) {
            const prog = await this.getProgram();
            if (!prog.enabled) return { ok: false, error: 'Activá primero tu programa de fidelidad' };
            if (!customer || !window.BBQNet) return { ok: false, error: 'Cliente inválido' };
            const issued = await kvGet(KV_ISSUED, {});
            const n = (issued[customer] || 0) + 1;
            const me = await window.BBQIdentity.ensure();
            const st = window.merchantStorage && window.merchantStorage.getUserStore && window.merchantStorage.getUserStore();
            const card = { type: 'stamp', storeId: me.peerId, storeName: (st && st.name) || me.name || 'Tienda', customer, n, needed: prog.needed, reward: prog.reward, ts: Date.now() };
            card.sig = await window.BBQIdentity.sign(stampString(card));
            card.id = 'stamp_' + card.ts;
            issued[customer] = n; await kvSet(KV_ISSUED, issued);
            const done = n >= prog.needed;
            const msg = { id: 'm_' + Date.now(), sender: me.peerId, text: done ? `🎉 ¡Completaste la tarjeta! Premio: ${prog.reward}` : `🎟️ Sello ${n}/${prog.needed}`, timestamp: new Date().toISOString(), payloadCard: card, status: 'pending' };
            window.buyerStorage.appendChatMessage(customer, msg);
            const payload = { type: 'chat', message: msg };
            if (window.BBQ && window.BBQ.outboxAdd) window.BBQ.outboxAdd(customer, payload);
            await window.BBQNet.send(customer, payload);
            return { ok: true, n, needed: prog.needed };
        },

        /** La tienda confirma un canje: el contador del cliente vuelve a 0. */
        async redeemFor(customer) {
            const issued = await kvGet(KV_ISSUED, {});
            issued[customer] = 0; await kvSet(KV_ISSUED, issued);
            return { ok: true };
        },

        // ── Lado cliente ──
        /** Verifica y guarda un sello recibido. Solo si vino cifrado de la tienda que lo firmó. */
        async receive(fromPeerId, card, wasE2E) {
            if (!card || card.type !== 'stamp' || card.storeId !== fromPeerId || !wasE2E) return false;
            const rec = window.BBQE2E && await window.BBQE2E._get(fromPeerId);
            if (!rec || !rec.spk) return false;
            try {
                const pub = await crypto.subtle.importKey('raw', b64ToBuf(rec.spk), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
                const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64ToBuf(card.sig), enc.encode(stampString(card)));
                if (!ok) return false;
            } catch (e) { return false; }
            const me = await window.BBQIdentity.ensure();
            if (card.customer !== me.peerId) return false;
            const cards = await kvGet(KV_CARDS, {});
            const cur = cards[fromPeerId];
            if (cur && cur.last && cur.last.ts >= card.ts) return true; // ya tengo uno igual o más nuevo
            cards[fromPeerId] = { storeName: String(card.storeName || '').slice(0, 60), n: Number(card.n) || 0, needed: Number(card.needed) || 0, reward: String(card.reward || '').slice(0, 120), last: card };
            await kvSet(KV_CARDS, cards);
            return true;
        },
        async myCards() { return await kvGet(KV_CARDS, {}); },

        /** Pide el premio a la tienda (mensaje normal, cifrado). */
        async requestRedeem(storeId) {
            const cards = await kvGet(KV_CARDS, {});
            const c = cards[storeId];
            if (!c || c.n < c.needed) return { ok: false, error: 'Todavía no completaste la tarjeta' };
            const msg = { id: 'm_' + Date.now(), sender: window.MY_PEER_ID, text: `🎁 Quiero canjear mi premio: ${c.reward} (tarjeta ${c.n}/${c.needed})`, timestamp: new Date().toISOString(), status: 'pending' };
            window.buyerStorage.appendChatMessage(storeId, msg);
            const payload = { type: 'chat', message: msg };
            if (window.BBQ && window.BBQ.outboxAdd) window.BBQ.outboxAdd(storeId, payload);
            await window.BBQNet.send(storeId, payload);
            return { ok: true };
        }
    };

    if (window.BBQTools) {
        window.BBQTools.register('loyalty.giveStamp', {
            desc: 'Entrega un sello de fidelidad firmado a un cliente.',
            input: { customer: 'string' }, permiso: 'commerce', sensible: true,
            run: (a) => Loyalty.giveStamp(a.customer)
        });
    }

    window.BBQLoyalty = Loyalty;
})();
