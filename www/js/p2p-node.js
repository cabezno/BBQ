/**
 * NEXUS P2P - Network & Transport Layer (WebSocket + BroadcastChannel Fallback)
 * Manages real-time messaging between devices via WebSocket relay server.
 * Falls back to BroadcastChannel for same-browser tab communication.
 */
class P2PNetworkNode {
    constructor(nodeId, storageEngine) {
        this.nodeId = nodeId;
        this.storage = storageEngine;
        this.listeners = [];
        this.ws = null;
        this.wsConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 50;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        this.profile = {};

        // BroadcastChannel fallback for same-browser tabs
        this.broadcastChannel = null;
        this.initBroadcastChannel();
    }

    // ─── Initialize ─────────────────────────────────────────────
    init(profile) {
        this.profile = profile || {};
        this.connectWebSocket();
    }

    // ─── BroadcastChannel (same-browser fallback) ───────────────
    initBroadcastChannel() {
        if (typeof BroadcastChannel !== 'undefined') {
            this.broadcastChannel = new BroadcastChannel('nexus_p2p_mesh_network');
            this.broadcastChannel.onmessage = (event) => {
                if (event.data && event.data.senderId !== this.nodeId) {
                    this.handleIncomingP2PEvent(event.data);
                }
            };
        }
    }

    // ─── WebSocket Connection ───────────────────────────────────
    connectWebSocket() {
        // Auto-detect server URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host || 'localhost:3000';
        const wsUrl = `${protocol}//${host}/ws`;

        this.logSystemEvent(`[P2P] Conectando a ${wsUrl}...`);
        this.updateConnectionUI('connecting');

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.wsConnected = true;
                this.reconnectAttempts = 0;
                this.logSystemEvent(`[P2P] ✅ Conectado al servidor WebSocket`);
                this.updateConnectionUI('online');

                // Register this node with the server
                this.ws.send(JSON.stringify({
                    type: 'REGISTER',
                    nodeId: this.nodeId,
                    profile: this.profile
                }));

                // Start heartbeat
                this.startHeartbeat();
            };

            this.ws.onmessage = (event) => {
                let payload;
                try {
                    payload = JSON.parse(event.data);
                } catch (e) {
                    return;
                }

                // Handle server control messages
                if (payload.type === 'WELCOME') {
                    this.logSystemEvent(`[P2P] Bienvenido! ${payload.peersOnline} peers online`);
                    this.listeners.forEach(fn => fn({
                        type: 'PEERS_UPDATE',
                        peersOnline: payload.peersOnline,
                        peerList: payload.peerList
                    }));
                    return;
                }

                if (payload.type === 'PONG') return; // Heartbeat response

                if (payload.type === 'PEER_CONNECTED' || payload.type === 'PEER_DISCONNECTED') {
                    this.logSystemEvent(`[P2P] ${payload.type === 'PEER_CONNECTED' ? '🟢' : '🔴'} ${payload.nodeId} (${payload.peersOnline} online)`);
                    this.listeners.forEach(fn => fn(payload));
                    return;
                }

                if (payload.type === 'DELIVERY_STATUS') {
                    this.logSystemEvent(`[P2P] Mensaje a ${payload.targetId}: ${payload.status}`);
                    return;
                }

                // Handle P2P messages (same handler as BroadcastChannel)
                this.handleIncomingP2PEvent(payload);
            };

            this.ws.onclose = () => {
                this.wsConnected = false;
                this.stopHeartbeat();
                this.updateConnectionUI('offline');
                this.logSystemEvent('[P2P] ❌ Desconectado del servidor');
                this.scheduleReconnect();
            };

            this.ws.onerror = (err) => {
                this.logSystemEvent('[P2P] Error de conexión WebSocket');
                this.updateConnectionUI('offline');
            };
        } catch (e) {
            this.logSystemEvent('[P2P] WebSocket no disponible, usando modo local');
            this.updateConnectionUI('offline');
        }
    }

    // ─── Heartbeat ──────────────────────────────────────────────
    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'PING' }));
            }
        }, 25000);
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    // ─── Reconnection with Exponential Backoff ──────────────────
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logSystemEvent('[P2P] Máximo de reconexiones alcanzado. Modo offline.');
            return;
        }

        const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;
        this.logSystemEvent(`[P2P] Reintentando en ${Math.round(delay / 1000)}s... (intento ${this.reconnectAttempts})`);

        this.reconnectTimer = setTimeout(() => {
            this.connectWebSocket();
        }, delay);
    }

    // ─── Event Listeners ────────────────────────────────────────
    onMessage(callback) {
        this.listeners.push(callback);
    }

    // ─── Send Messages ──────────────────────────────────────────
    broadcastStoreToRegion(region) {
        const profile = this.storage.getDatabase().profile;
        const catalog = this.storage.getProducts();

        const payload = {
            type: 'STORE_REGIONAL_PUSH',
            senderId: this.nodeId,
            region: region || profile.region || 'metrosur',
            storeInfo: {
                id: this.nodeId,
                name: profile.name,
                avatar: '🏬',
                category: 'Tecnología & Gadgets',
                itemCount: catalog.length,
                catalogPreview: catalog,
                shippingService: 'Express Courier P2P'
            },
            timestamp: new Date().toISOString()
        };

        this.sendP2PPayload(payload);
        this.logSystemEvent(`[P2P BROADCAST] Tienda ${profile.name} transmitió catálogo a la región ${payload.region}`);
    }

    sendDirectMessage(targetNodeId, text, isAiGenerated = false) {
        const message = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            sender: this.nodeId,
            target: targetNodeId,
            text: text,
            isAiGenerated: isAiGenerated,
            timestamp: new Date().toISOString()
        };

        // Save locally
        this.storage.appendChatMessage(targetNodeId, message);

        // Send over network
        const payload = {
            type: 'DIRECT_MESSAGE',
            senderId: this.nodeId,
            targetId: targetNodeId,
            message: message
        };

        this.sendP2PPayload(payload);
        return message;
    }

    sendP2PPayload(payload) {
        // Primary: WebSocket
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(payload));
        }
        // Fallback: BroadcastChannel (same browser tabs)
        if (this.broadcastChannel) {
            this.broadcastChannel.postMessage(payload);
        }
    }

    // ─── Incoming Message Handler ───────────────────────────────
    handleIncomingP2PEvent(payload) {
        // Ignore self-emitted
        if (payload.senderId === this.nodeId) return;

        this.logSystemEvent(`[P2P INCOMING] ${payload.type} de ${payload.senderId}`);

        if (payload.type === 'DIRECT_MESSAGE' && (payload.targetId === this.nodeId || payload.targetId === 'all')) {
            // Save incoming message to local DB
            this.storage.appendChatMessage(payload.senderId, payload.message);
            // Notify UI listeners
            this.listeners.forEach(fn => fn(payload));
        } else if (payload.type === 'STORE_REGIONAL_PUSH') {
            this.listeners.forEach(fn => fn(payload));
        } else if (payload.type === 'ESCROW_SETTLED_EVENT') {
            this.listeners.forEach(fn => fn(payload));
        } else if (payload.type === 'STATUS_PUBLISHED') {
            this.listeners.forEach(fn => fn(payload));
        }
    }

    // ─── Connection UI Indicator ────────────────────────────────
    updateConnectionUI(state) {
        const indicator = document.getElementById('wsConnectionIndicator');
        if (!indicator) return;

        const states = {
            'online': { text: '🟢 Conectado', className: 'conn-online' },
            'offline': { text: '🔴 Sin conexión', className: 'conn-offline' },
            'connecting': { text: '🟡 Conectando...', className: 'conn-connecting' }
        };

        const s = states[state] || states['offline'];
        indicator.textContent = s.text;
        indicator.className = `ws-connection-pill ${s.className}`;
    }

    // ─── System Logger ──────────────────────────────────────────
    logSystemEvent(text) {
        console.log(`[P2P NODE ${this.nodeId}] ${text}`);
        const consoleEl = document.getElementById('consoleBody');
        if (consoleEl) {
            const div = document.createElement('div');
            div.className = 'console-log';
            div.textContent = text;
            consoleEl.appendChild(div);
            consoleEl.scrollTop = consoleEl.scrollHeight;
        }
    }

    // ─── Cleanup ────────────────────────────────────────────────
    destroy() {
        this.stopHeartbeat();
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        if (this.ws) this.ws.close();
        if (this.broadcastChannel) this.broadcastChannel.close();
    }
}

// ─── Single Node Initialization ─────────────────────────────────
// Each device creates ONE node with its unique device ID
// The old 3-node simulation is replaced by single-device identity
(function initSingleNode() {
    // Device ID: generated once, stored forever in localStorage
    let deviceId = localStorage.getItem('bbq_device_id');
    if (!deviceId) {
        deviceId = 'bbq_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
        localStorage.setItem('bbq_device_id', deviceId);
    }

    // Create the single storage engine for this device
    window.myStorage = new LocalStorageEngine(deviceId);

    // Keep backward compatibility for existing code
    window.buyerStorage = window.myStorage;
    window.merchantStorage = window.myStorage;
    window.logisticsStorage = window.myStorage;

    // Create the single P2P node for this device
    window.myNode = new P2PNetworkNode(deviceId, window.myStorage);

    // Keep backward compatibility
    window.buyerNode = window.myNode;
    window.merchantNode = window.myNode;
    window.logisticsNode = window.myNode;
})();
