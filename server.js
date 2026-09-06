/**
 * BBQ MOBILE - Servidor Mínimo (Directorio + Señalización)
 *
 * Filosofía: el servidor es lo más "tonto" posible. Solo hace dos cosas:
 *   1) DIRECTORIO (guía telefónica): guarda { teléfono, nombre, peerId, publicKey }
 *      para que, cuando agregás un contacto, la app sepa si ya tiene BBQ.
 *   2) SEÑALIZACIÓN (transitoria): reenvía el "saludo" WebRTC (offer/answer/ICE)
 *      entre dos peers para que se conecten. NO guarda ningún mensaje.
 *
 * Los mensajes, media, estados y vivos viajan P2P (WebRTC) y cifrados E2E.
 * El servidor nunca ve el contenido.
 *
 * Uso: npm run server  →  http://<LAN-IP>:3000
 */

const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const path = require('path');
const os = require('os');
const { webcrypto, randomBytes } = require('crypto');
const subtle = webcrypto.subtle;
const BBQFlow = require('./www/js/bbq-flow.js'); // motor de flujos (isomórfico)
const store = require('./store.js');             // persistencia del directorio (Upstash/archivo)

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '256kb' }));

/* ══════════════════════════════════════════════════════════════
   AUTENTICACIÓN POR CLAVE DE DISPOSITIVO (firma ECDSA P-256)
   ──────────────────────────────────────────────────────────────
   La identidad real es un par de claves ECDSA en el teléfono (privada NO
   exportable). El peerId es el hash de la pública ⇒ nadie puede reclamar un
   peerId sin tener la privada que lo genera. El server verifica firmas y así:
     · /api/register solo acepta registros firmados por su propia clave.
     · el HELLO del WebSocket exige un reto firmado (challenge-response)
       antes de dar por online a un peer o reenviarle nada.
   ══════════════════════════════════════════════════════════════ */
function b64ToBuf(b64) { return Buffer.from(String(b64 || ''), 'base64'); }

// peerId determinista a partir de la clave pública de firma (igual que el cliente).
async function peerIdFromSignPub(signPubB64) {
    const raw = b64ToBuf(signPubB64);
    if (!raw.length) return null;
    const h = await subtle.digest('SHA-256', raw);
    return 'bbq_' + Buffer.from(h).toString('hex').slice(0, 24);
}

// Verifica una firma ECDSA(SHA-256) sobre `dataStr` con la pública dada (raw b64).
async function verifySig(signPubB64, dataStr, sigB64) {
    try {
        const key = await subtle.importKey(
            'raw', b64ToBuf(signPubB64),
            { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']
        );
        return await subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' }, key,
            b64ToBuf(sigB64), Buffer.from(String(dataStr), 'utf8')
        );
    } catch (e) { return false; }
}

// ─── Static Files (la web app vive en /www) ─────────────────────
app.use(express.static(path.join(__dirname, 'www'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('sw.js')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
        if (filePath.endsWith('.json')) {
            res.setHeader('Content-Type', 'application/json');
        }
    }
}));

/* ══════════════════════════════════════════════════════════════
   DIRECTORIO (guía telefónica persistente en JSON)
   ══════════════════════════════════════════════════════════════ */
let directory = {}; // phoneNormalized → { phone, name, peerId, publicKey, updatedAt }

// ── Puente Claude (bridge): mensajes al contacto "Claude" se encolan acá; Claude
//    (corriendo en la PC) los lee por /api/claude/inbox y responde por /api/claude/reply.
const CLAUDE_TOKEN = process.env.CLAUDE_TOKEN || 'bbq-bridge-7k2p';
let claudeInbox = [];
let claudeSeq = 0;
// Buzón corto SOLO para respuestas de asistentes/agentes: si el destinatario está
// desconectado (app en segundo plano), se guardan y se entregan al reconectar.
let pendingReplies = {}; // peerId → [payload, ...]

// ── Agentes/flujos: cola por agente + presencia de workers + flujos guardados ──
let flows = {};          // id → flujo JSON (portable)
let agentInbox = {};     // agentId → [{ id, from, text, ts }]
let agentSeq = 0;
let workerPresence = {}; // agentId → última vez que se vio su worker (ts)
function seedFlows() {
    if (!flows['store-assistant']) flows['store-assistant'] = BBQFlow.DEFAULT_STORE_FLOW;
}

// Contactos-bot siempre presentes en el directorio (aunque se reinicie el server).
function seedBots() {
    directory['5491100000000'] = { phone: '5491100000000', name: 'BBQ Test (bot)', peerId: 'bbq_testbot', publicKey: 'TESTKEY', updatedAt: new Date().toISOString() };
    directory['5491100000007'] = { phone: '5491100000007', name: '🤖 Claude (BBQ)', peerId: 'bbq_claude', publicKey: 'CLAUDEKEY', updatedAt: new Date().toISOString() };
}

async function loadDirectory() {
    try {
        directory = await store.loadAll();
        console.log(`\x1b[36m[DIR] Directorio cargado (${store.backend()}): ${Object.keys(directory).length} usuarios\x1b[0m`);
    } catch (e) {
        console.error('[DIR] Error cargando directorio:', e.message);
        directory = {};
    }
}

// Persiste una entrada del directorio (fire-and-forget; no bloquea la respuesta).
function persistUser(key) {
    store.put(key, directory[key]).catch(e => console.error('[DIR] Error persistiendo:', e.message));
}

// Normaliza un teléfono a solo dígitos (con código de país si viene con +)
function normalizePhone(raw) {
    if (!raw) return '';
    let s = String(raw).trim().replace(/[^\d+]/g, '');
    if (s.startsWith('+')) s = s.slice(1);
    return s.replace(/\D/g, '');
}

// ── Registro / actualización de identidad (FIRMADO) ──
// Body: { phone, name, peerId, signPublicKey, ecdhPublicKey, ts, sig }
// El cliente firma `${peerId}|${telefonoNormalizado}|${ts}` con su clave privada.
app.post('/api/register', async (req, res) => {
    const { phone, name, peerId, signPublicKey, ecdhPublicKey, ts, sig } = req.body || {};
    const key = normalizePhone(phone);
    if (!key || key.length < 6) {
        return res.status(400).json({ ok: false, error: 'Teléfono inválido' });
    }
    if (!signPublicKey || !sig || !peerId) {
        return res.status(400).json({ ok: false, error: 'Faltan credenciales de firma' });
    }
    // 1) Anti-replay: el registro debe ser reciente (±2 min).
    if (!ts || Math.abs(Date.now() - Number(ts)) > 120000) {
        return res.status(400).json({ ok: false, error: 'Registro caducado (revisá la hora del dispositivo)' });
    }
    // 2) El peerId TIENE que ser el hash de la clave pública (identidad autoautenticante).
    const expected = await peerIdFromSignPub(signPublicKey);
    if (expected !== peerId) {
        return res.status(403).json({ ok: false, error: 'peerId no corresponde a la clave' });
    }
    // 3) La firma prueba que el cliente posee la clave privada.
    const ok = await verifySig(signPublicKey, `${peerId}|${key}|${ts}`, sig);
    if (!ok) {
        return res.status(403).json({ ok: false, error: 'Firma inválida' });
    }
    // 4) El número es solo una etiqueta: primero que llega lo toma; otra identidad no lo pisa.
    if (directory[key] && directory[key].peerId && directory[key].peerId !== peerId) {
        return res.status(409).json({ ok: false, error: 'Ese número ya está tomado por otra identidad' });
    }
    directory[key] = {
        phone: key,
        name: (name || 'Usuario BBQ').toString().slice(0, 60),
        peerId: peerId.toString().slice(0, 128),
        signPublicKey: signPublicKey.toString().slice(0, 512),
        publicKey: (ecdhPublicKey || '').toString().slice(0, 2048), // ECDH para E2E (compat con campo previo)
        ecdhPublicKey: (ecdhPublicKey || '').toString().slice(0, 2048),
        updatedAt: new Date().toISOString()
    };
    persistUser(key);
    console.log(`\x1b[32m[DIR] Registrado (firmado): ${key} (${directory[key].name})\x1b[0m`);
    res.json({ ok: true, user: directory[key] });
});

// ── Match de contactos: le paso mi agenda, me devuelve quiénes tienen BBQ ──
// Body: { phones: ["+54911...", "..."] }
app.post('/api/contacts/match', (req, res) => {
    const phones = Array.isArray(req.body?.phones) ? req.body.phones : [];
    const matches = [];
    for (const p of phones.slice(0, 5000)) {
        const key = normalizePhone(p);
        if (key && directory[key]) {
            const u = directory[key];
            matches.push({ phone: u.phone, name: u.name, peerId: u.peerId, publicKey: u.publicKey, signPublicKey: u.signPublicKey });
        }
    }
    res.json({ ok: true, matches });
});

// ── Lookup de un solo usuario ──
app.get('/api/user/:phone', (req, res) => {
    const key = normalizePhone(req.params.phone);
    const u = directory[key];
    if (!u) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, user: { phone: u.phone, name: u.name, peerId: u.peerId, publicKey: u.publicKey, signPublicKey: u.signPublicKey } });
});

// ── Proxy de IA (evita CORS de los proveedores; la API key la manda el cliente) ──
// Body: { provider, apiKey, model, system, prompt, endpoint }
app.post('/api/ai', async (req, res) => {
    const { provider, apiKey, model, system, prompt, endpoint } = req.body || {};
    if (!prompt) return res.status(400).json({ ok: false, error: 'Falta el mensaje' });
    try {
        let text = '';
        if (provider === 'openai' || provider === 'deepseek') {
            const base = provider === 'deepseek' ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1';
            const r = await fetch(`${base}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: model || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini'),
                    messages: [
                        { role: 'system', content: system || 'Sos un asistente útil.' },
                        { role: 'user', content: prompt }
                    ]
                })
            });
            const j = await r.json();
            text = j.choices?.[0]?.message?.content || j.error?.message || 'Sin respuesta';
        } else if (provider === 'anthropic') {
            const r = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
                body: JSON.stringify({
                    model: model || 'claude-3-5-sonnet-20241022',
                    max_tokens: 1024,
                    system: system || '',
                    messages: [{ role: 'user', content: prompt }]
                })
            });
            const j = await r.json();
            text = j.content?.[0]?.text || j.error?.message || 'Sin respuesta';
        } else if (provider === 'gemini') {
            const m = model || 'gemini-1.5-flash';
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: (system ? system + '\n\n' : '') + prompt }] }] })
            });
            const j = await r.json();
            text = j.candidates?.[0]?.content?.parts?.[0]?.text || j.error?.message || 'Sin respuesta';
        } else if (provider === 'ollama') {
            const base = endpoint || 'http://localhost:11434';
            const r = await fetch(`${base}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: model || 'llama3', prompt: (system ? system + '\n\n' : '') + prompt, stream: false })
            });
            const j = await r.json();
            text = j.response || 'Sin respuesta';
        } else {
            return res.status(400).json({ ok: false, error: 'Proveedor no soportado' });
        }
        res.json({ ok: true, text });
    } catch (e) {
        console.error('[AI] Error:', e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ── Cobro (stub para Google Pay). ─────────────────────────────
// Recibe el token de Google Pay. En TEST no cobra. Para producción, integrar una
// pasarela (Mercado Pago/Stripe/…) acá con su clave secreta (nunca en el cliente),
// incluyendo el Auth & Hold del escrow (ej: Stripe captura manual).
app.post('/api/pay', async (req, res) => {
    const { amount, token, concept } = req.body || {};
    console.log(`[PAY] (TEST) solicitud de cobro: $${amount} — ${concept || ''} — token:${token ? 'sí' : 'no'}`);
    res.json({
        ok: true,
        mode: 'TEST',
        charged: false,
        message: 'Modo TEST: sin cobro real. Configurá una pasarela para producción.',
        amount: amount || 0
    });
});

// ── Puente Claude: bandeja de entrada (Claude la drena) y respuesta ──
app.get('/api/claude/inbox', (req, res) => {
    if (req.query.token !== CLAUDE_TOKEN) return res.status(403).json({ ok: false });
    const messages = claudeInbox;
    claudeInbox = [];
    res.json({ ok: true, messages });
});
app.post('/api/claude/reply', (req, res) => {
    const { token, to, text } = req.body || {};
    if (token !== CLAUDE_TOKEN) return res.status(403).json({ ok: false });
    const payload = { type: 'CHAT_RELAY', from: 'bbq_claude', payload: { type: 'chat', message: { id: 'claude_' + Date.now(), sender: 'bbq_claude', text: text || '', timestamp: new Date().toISOString() } } };
    const target = onlinePeers.get(to);
    if (target && target.readyState === WebSocket.OPEN) {
        target.send(JSON.stringify(payload));
        return res.json({ ok: true, delivered: true });
    }
    // Offline: guardar y entregar al reconectar.
    (pendingReplies[to] = pendingReplies[to] || []).push(payload);
    if (pendingReplies[to].length > 50) pendingReplies[to] = pendingReplies[to].slice(-50);
    res.json({ ok: true, delivered: false, queued: true });
});

// ── Flujos de agentes (guardar/sincronizar; portables PC↔móvil) ──
app.get('/api/flows', (req, res) => {
    res.json({ ok: true, flows: Object.keys(flows).map(id => ({ id, name: flows[id].name || id })) });
});
app.get('/api/flows/:id', (req, res) => {
    const f = flows[req.params.id];
    if (!f) return res.status(404).json({ ok: false });
    res.json({ ok: true, flow: f });
});
app.post('/api/flows', (req, res) => {
    const flow = req.body && req.body.flow;
    if (!flow || !flow.id) return res.status(400).json({ ok: false, error: 'Falta flow.id' });
    const err = BBQFlow.validate(flow);
    if (err) return res.status(400).json({ ok: false, error: err });
    flows[flow.id] = flow;
    res.json({ ok: true, id: flow.id });
});

// ── Cola genérica de agentes (los workers de PC la drenan) ──
app.get('/api/agent/inbox', (req, res) => {
    if (req.query.token !== CLAUDE_TOKEN) return res.status(403).json({ ok: false });
    const id = req.query.agent;
    if (id) workerPresence[id] = Date.now(); // el worker está vivo
    const messages = (id && agentInbox[id]) || [];
    if (id) agentInbox[id] = [];
    res.json({ ok: true, messages });
});
app.post('/api/agent/reply', (req, res) => {
    const { token, to, text, agent } = req.body || {};
    if (token !== CLAUDE_TOKEN) return res.status(403).json({ ok: false });
    const payload = { type: 'CHAT_RELAY', from: agent || 'agent', payload: { type: 'chat', message: { id: 'agent_' + Date.now(), sender: agent || 'agent', text: text || '', timestamp: new Date().toISOString() } } };
    const target = onlinePeers.get(to);
    if (target && target.readyState === WebSocket.OPEN) { target.send(JSON.stringify(payload)); return res.json({ ok: true, delivered: true }); }
    (pendingReplies[to] = pendingReplies[to] || []).push(payload);
    res.json({ ok: true, delivered: false, queued: true });
});
app.post('/api/agent/heartbeat', (req, res) => {
    if ((req.body && req.body.token) !== CLAUDE_TOKEN) return res.status(403).json({ ok: false });
    for (const a of (req.body.agents || [])) workerPresence[a] = Date.now();
    res.json({ ok: true });
});
app.get('/api/agent/online', (req, res) => {
    const ts = workerPresence[req.query.agent] || 0;
    res.json({ ok: true, online: (Date.now() - ts) < 20000 });
});

// ── Estado del servidor ──
app.get('/api/status', (req, res) => {
    res.json({
        status: 'ok',
        serverTime: new Date().toISOString(),
        usersRegistered: Object.keys(directory).length,
        peersOnline: onlinePeers.size,
        lanAddresses: getLanAddresses()
    });
});

// Bot de prueba (contacto "BBQ Test"): respuestas simples para verificar el chat.
function botReply(text) {
    const t = (text || '').toLowerCase().trim();
    if (!t) return '🤖 ¡Hola! Soy el BBQ Asistente (bot de prueba). Escribime algo.';
    if (t.includes('hola') || t.includes('buenas')) return '🤖 ¡Hola! Soy el bot de prueba de BBQ. El chat funciona ✅ ¿Qué querés probar?';
    if (t.includes('precio') || t.includes('cuánto') || t.includes('cuanto') || t.includes('stock')) return '🤖 Soy un bot de prueba (sin catálogo real), pero tu mensaje llegó perfecto 👍';
    if (t.includes('gracias') || t.includes('chau')) return '🤖 ¡De nada! Chat andando 🎉';
    return '🤖 Recibí: "' + text + '" — el chat funciona correctamente.';
}

/* ══════════════════════════════════════════════════════════════
   SEÑALIZACIÓN WebRTC (transitoria, no guarda mensajes)
   ══════════════════════════════════════════════════════════════ */
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const onlinePeers = new Map(); // peerId → ws

// Aviso de presencia a los demás (no guarda nada; solo "quién está online").
function broadcastPresence(type, peerId) {
    const raw = JSON.stringify({ type, peerId });
    onlinePeers.forEach((w, id) => {
        if (id !== peerId && w.readyState === WebSocket.OPEN) { try { w.send(raw); } catch (e) {} }
    });
}

wss.on('connection', (ws, req) => {
    let myPeerId = null;
    let authed = false;
    let pendingAuth = null; // { peerId, signPublicKey, nonce }
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`\x1b[36m[WS] Conexión desde ${ip}\x1b[0m`);

    // Da por online al peer YA autenticado: lo registra, avisa presencia y entrega pendientes.
    function goOnline() {
        onlinePeers.set(myPeerId, ws);
        console.log(`\x1b[32m[WS] Online: ${myPeerId} (${onlinePeers.size} conectados)\x1b[0m`);
        ws.send(JSON.stringify({ type: 'HELLO-ACK', peersOnline: onlinePeers.size }));
        const pend = pendingReplies[myPeerId];
        if (pend && pend.length) {
            pend.forEach(p => { try { ws.send(JSON.stringify(p)); } catch (e) {} });
            delete pendingReplies[myPeerId];
            console.log(`\x1b[35m[BRIDGE] entregadas ${pend.length} respuestas pendientes a ${myPeerId}\x1b[0m`);
        }
        broadcastPresence('PEER_ONLINE', myPeerId);
    }

    ws.on('message', async (raw) => {
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch { return; }

        // ── Paso 1: HELLO { peerId, signPublicKey } → el server manda un reto ──
        if (msg.type === 'HELLO') {
            const expected = await peerIdFromSignPub(msg.signPublicKey);
            if (!msg.signPublicKey || !msg.peerId || expected !== msg.peerId) {
                ws.send(JSON.stringify({ type: 'AUTH-FAIL', error: 'peerId/clave inválidos' }));
                try { ws.close(); } catch (e) {}
                return;
            }
            const nonce = randomBytes(24).toString('hex');
            pendingAuth = { peerId: msg.peerId, signPublicKey: msg.signPublicKey, nonce };
            ws.send(JSON.stringify({ type: 'CHALLENGE', nonce }));
            return;
        }

        // ── Paso 2: AUTH { sig } → el cliente firmó el nonce; lo verificamos ──
        if (msg.type === 'AUTH') {
            if (!pendingAuth) { ws.send(JSON.stringify({ type: 'AUTH-FAIL', error: 'sin reto previo' })); return; }
            const ok = await verifySig(pendingAuth.signPublicKey, pendingAuth.nonce, msg.sig);
            if (!ok) {
                ws.send(JSON.stringify({ type: 'AUTH-FAIL', error: 'firma inválida' }));
                try { ws.close(); } catch (e) {}
                return;
            }
            myPeerId = pendingAuth.peerId;
            authed = true;
            pendingAuth = null;
            goOnline();
            return;
        }

        if (msg.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG', ts: Date.now() }));
            return;
        }

        // A partir de acá, TODO exige estar autenticado (nadie reenvía/recibe sin probar identidad).
        if (!authed) { return; }

        // Confirmación de recepción (ACK): la reenvía al emisor para que marque ✓ y borre su outbox.
        if (msg.type === 'CHAT_ACK' && msg.to) {
            const t = onlinePeers.get(msg.to);
            if (t && t.readyState === WebSocket.OPEN) { try { t.send(JSON.stringify(msg)); } catch (e) {} }
            return;
        }

        // Señalización dirigida: SIGNAL { to, from, data }
        // Reenvía el offer/answer/ICE al peer destino. No inspecciona el contenido.
        if (msg.type === 'SIGNAL' && msg.to) {
            const target = onlinePeers.get(msg.to);
            if (target && target.readyState === WebSocket.OPEN) {
                target.send(JSON.stringify(msg));
            } else {
                ws.send(JSON.stringify({ type: 'PEER-OFFLINE', to: msg.to }));
            }
            return;
        }

        // Presencia: ¿está online este peer?
        if (msg.type === 'IS-ONLINE' && msg.peerId) {
            ws.send(JSON.stringify({
                type: 'PRESENCE',
                peerId: msg.peerId,
                online: onlinePeers.has(msg.peerId)
            }));
            return;
        }

        // Relay de chat por WS (respaldo cuando WebRTC no conecta). Transitorio: no se guarda.
        // CHAT_RELAY { to, from, payload }  (payload = {type:'chat'|'voice'|'attachment', message, ...})
        if (msg.type === 'CHAT_RELAY' && msg.to) {
            // Agente genérico (worker de PC lo atiende): encolar en su cola.
            if (typeof msg.to === 'string' && msg.to.indexOf('agent_') === 0) {
                const incoming = msg.payload && msg.payload.message;
                (agentInbox[msg.to] = agentInbox[msg.to] || []).push({ id: ++agentSeq, from: msg.from, text: (incoming && incoming.text) || '', ts: Date.now() });
                if (agentInbox[msg.to].length > 200) agentInbox[msg.to] = agentInbox[msg.to].slice(-200);
                return;
            }
            // Puente Claude: encolar el mensaje para que Claude (en la PC) lo lea y responda.
            if (msg.to === 'bbq_claude') {
                const incoming = msg.payload && msg.payload.message;
                claudeInbox.push({ id: ++claudeSeq, from: msg.from, text: (incoming && incoming.text) || '', ts: Date.now() });
                if (claudeInbox.length > 200) claudeInbox = claudeInbox.slice(-200);
                console.log(`\x1b[35m[CLAUDE] mensaje de ${msg.from}: ${(incoming && incoming.text) || ''}\x1b[0m`);
                return;
            }
            // Bot de prueba: responde solo.
            if (msg.to === 'bbq_testbot') {
                const incoming = msg.payload && msg.payload.message;
                const userText = (incoming && incoming.text) || '';
                const reply = botReply(userText);
                ws.send(JSON.stringify({
                    type: 'CHAT_RELAY',
                    from: 'bbq_testbot',
                    payload: { type: 'chat', message: { id: 'bot_' + Date.now(), sender: 'bbq_testbot', text: reply, timestamp: new Date().toISOString() } }
                }));
                return;
            }
            const target = onlinePeers.get(msg.to);
            if (target && target.readyState === WebSocket.OPEN) {
                target.send(JSON.stringify({ type: 'CHAT_RELAY', from: msg.from, payload: msg.payload }));
            } else {
                ws.send(JSON.stringify({ type: 'PEER-OFFLINE', to: msg.to }));
            }
            return;
        }
    });

    ws.on('close', () => {
        if (myPeerId) {
            onlinePeers.delete(myPeerId);
            console.log(`\x1b[31m[WS] Offline: ${myPeerId} (${onlinePeers.size} conectados)\x1b[0m`);
            broadcastPresence('PEER_OFFLINE', myPeerId);
        }
    });

    ws.on('error', (err) => console.error('[WS] Error:', err.message));

    const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.ping();
        else clearInterval(ping);
    }, 30000);
});

/* ══════════════════════════════════════════════════════════════
   Arranque
   ══════════════════════════════════════════════════════════════ */
function getLanAddresses() {
    const out = [];
    const ifaces = os.networkInterfaces();
    for (const name in ifaces) {
        for (const iface of ifaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) out.push(iface.address);
        }
    }
    return out;
}

async function start() {
    await loadDirectory();     // trae el directorio persistido (Upstash/archivo)
    seedBots();                // contactos "BBQ Test" y "Claude" siempre presentes (en memoria)
    seedFlows();               // flujo de agente por defecto (asistente de tienda)
    startServer();
}

function startServer() {
server.listen(PORT, '0.0.0.0', () => {
    const lan = getLanAddresses();
    console.log('\n\x1b[1m\x1b[32m' + '═'.repeat(60) + '\x1b[0m');
    console.log('\x1b[1m\x1b[32m  🔥 BBQ - SERVIDOR MÍNIMO (Directorio + Señalización)\x1b[0m');
    console.log('\x1b[1m\x1b[32m' + '═'.repeat(60) + '\x1b[0m');
    console.log(`\n  📍 Local:      \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
    lan.forEach(ip => console.log(`  📱 Teléfonos:  \x1b[36mhttp://${ip}:${PORT}\x1b[0m`));
    console.log(`\n  🔌 Señalización: \x1b[33mws://localhost:${PORT}/ws\x1b[0m`);
    console.log(`  📇 Directorio:   \x1b[33mPOST /api/register · POST /api/contacts/match\x1b[0m`);
    console.log(`  📊 Estado:       \x1b[33mGET /api/status\x1b[0m`);
    console.log(`  🔐 Directorio:   \x1b[33m${store.backend()}${store.backend() === 'file' ? ' (efímero en Render — configurá Upstash)' : ' (persistente)'}\x1b[0m`);
    console.log('\x1b[1m\x1b[32m' + '═'.repeat(60) + '\x1b[0m\n');
});
}

start();
