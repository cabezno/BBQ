/**
 * BBQ - Transporte P2P real (WebRTC DataChannel)
 *
 * El contenido (chat, estados, señales de comercio) viaja DIRECTO teléfono↔teléfono
 * por un DataChannel WebRTC (cifrado por DTLS de fábrica). El servidor solo se usa
 * para la SEÑALIZACIÓN transitoria (intercambiar offer/answer/ICE) y no ve el contenido.
 *
 * Modelo: malla. Abrís una conexión por cada peer con el que hablás.
 * Entrega: solo si el otro está online (sin buzón, por decisión de diseño).
 */
(function () {
    const ICE_SERVERS = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
        // TURN opcional se puede agregar acá para redes móviles muy cerradas.
    ];

    const BBQNet = {
        peerId: null,
        ws: null,
        wsReady: false,
        peers: new Map(),        // peerId → { pc, channel, ready }
        msgListeners: [],
        stateListeners: [],
        _reconnectDelay: 1000,

        // ── Init: conecta la señalización y se anuncia ──
        init(peerId) {
            this.peerId = peerId;
            this._connectSignaling();
        },

        onMessage(cb) { this.msgListeners.push(cb); },
        onPeerState(cb) { this.stateListeners.push(cb); },

        _emitMessage(fromPeerId, msg) { this.msgListeners.forEach(fn => fn(fromPeerId, msg)); },
        _emitState(peerId, state) { this.stateListeners.forEach(fn => fn(peerId, state)); },

        // ── Señalización (WebSocket con el server mínimo) ──
        _connectSignaling() {
            const base = window.BBQ_SERVER || location.origin;
            const wsUrl = base.replace(/^http/, 'ws') + '/ws';
            try {
                this.ws = new WebSocket(wsUrl);
            } catch (e) {
                this._scheduleReconnect();
                return;
            }

            this.ws.onopen = () => {
                this.wsReady = true;
                this._reconnectDelay = 1000;
                this.ws.send(JSON.stringify({ type: 'HELLO', peerId: this.peerId }));
                this._log('Señalización conectada');
            };

            this.ws.onmessage = async (ev) => {
                let m; try { m = JSON.parse(ev.data); } catch { return; }
                if (m.type === 'HELLO-ACK') { this._updateConnUI('online'); return; }
                if (m.type === 'PONG') return;
                if (m.type === 'PEER-OFFLINE') { this._emitState(m.to, 'offline'); return; }
                if (m.type === 'SIGNAL') { await this._onSignal(m); return; }
            };

            this.ws.onclose = () => {
                this.wsReady = false;
                this._updateConnUI('offline');
                this._scheduleReconnect();
            };
            this.ws.onerror = () => { this._updateConnUI('offline'); };
        },

        _scheduleReconnect() {
            this._updateConnUI('connecting');
            setTimeout(() => this._connectSignaling(), this._reconnectDelay);
            this._reconnectDelay = Math.min(this._reconnectDelay * 1.5, 20000);
        },

        _signal(to, data) {
            if (this.ws && this.wsReady) {
                this.ws.send(JSON.stringify({ type: 'SIGNAL', to, from: this.peerId, data }));
            }
        },

        // ── Crear/obtener conexión con un peer ──
        _getPeer(peerId) {
            let entry = this.peers.get(peerId);
            if (entry) return entry;

            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            entry = { pc, channel: null, ready: false };
            this.peers.set(peerId, entry);

            pc.onicecandidate = (e) => {
                if (e.candidate) this._signal(peerId, { kind: 'ice', candidate: e.candidate });
            };
            pc.onconnectionstatechange = () => {
                const st = pc.connectionState;
                if (st === 'failed' || st === 'disconnected' || st === 'closed') {
                    this._emitState(peerId, 'offline');
                }
            };
            pc.ondatachannel = (e) => this._bindChannel(peerId, e.channel);

            return entry;
        },

        _bindChannel(peerId, channel) {
            const entry = this.peers.get(peerId);
            if (entry) entry.channel = channel;
            channel.onopen = () => {
                if (entry) entry.ready = true;
                this._emitState(peerId, 'online');
                this._log('Canal P2P abierto con ' + peerId);
            };
            channel.onclose = () => { if (entry) entry.ready = false; this._emitState(peerId, 'offline'); };
            channel.onmessage = (ev) => {
                let msg; try { msg = JSON.parse(ev.data); } catch { return; }
                this._emitMessage(peerId, msg);
            };
        },

        // ── Iniciar conexión (yo llamo) ──
        async connect(peerId) {
            if (peerId === this.peerId) return;
            const entry = this._getPeer(peerId);
            if (entry.ready) return;
            if (!entry.channel) {
                const channel = entry.pc.createDataChannel('bbq');
                this._bindChannel(peerId, channel);
            }
            const offer = await entry.pc.createOffer();
            await entry.pc.setLocalDescription(offer);
            this._signal(peerId, { kind: 'offer', sdp: entry.pc.localDescription });
        },

        // ── Manejar señalización entrante ──
        async _onSignal(m) {
            const from = m.from;
            const data = m.data || {};
            const entry = this._getPeer(from);

            if (data.kind === 'offer') {
                await entry.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                const answer = await entry.pc.createAnswer();
                await entry.pc.setLocalDescription(answer);
                this._signal(from, { kind: 'answer', sdp: entry.pc.localDescription });
            } else if (data.kind === 'answer') {
                await entry.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            } else if (data.kind === 'ice') {
                try { await entry.pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) {}
            }
        },

        // ── Enviar un objeto JSON a un peer (lo conecta si hace falta) ──
        async send(peerId, obj) {
            let entry = this.peers.get(peerId);
            if (!entry || !entry.ready) {
                await this.connect(peerId);
                // Esperar a que abra el canal (hasta ~8s)
                const ok = await this._waitReady(peerId, 8000);
                if (!ok) return { ok: false, error: 'Peer no disponible (offline)' };
                entry = this.peers.get(peerId);
            }
            try {
                entry.channel.send(JSON.stringify(obj));
                return { ok: true };
            } catch (e) {
                return { ok: false, error: e.message };
            }
        },

        _waitReady(peerId, timeoutMs) {
            return new Promise((resolve) => {
                const start = Date.now();
                const iv = setInterval(() => {
                    const e = this.peers.get(peerId);
                    if (e && e.ready) { clearInterval(iv); resolve(true); }
                    else if (Date.now() - start > timeoutMs) { clearInterval(iv); resolve(false); }
                }, 150);
            });
        },

        isOnline(peerId) {
            const e = this.peers.get(peerId);
            return !!(e && e.ready);
        },

        _updateConnUI(state) {
            const el = document.getElementById('wsConnectionIndicator');
            if (!el) return;
            const map = {
                online: { t: '🟢 Conectado', c: 'conn-online' },
                offline: { t: '🔴 Sin conexión', c: 'conn-offline' },
                connecting: { t: '🟡 Conectando...', c: 'conn-connecting' }
            };
            const s = map[state] || map.offline;
            el.textContent = s.t;
            el.className = `ws-connection-pill ${s.c}`;
        },

        _log(t) { console.log('[BBQNet] ' + t); }
    };

    window.BBQNet = BBQNet;
})();
