/**
 * NEXUS P2P - Network & Transport Layer (P2P Node Core)
 * Manages direct peer sockets, WebRTC DataChannels, BroadcastChannel mesh,
 * on-demand sync handshake, and regional store catalog broadcasting.
 */
class P2PNetworkNode {
    constructor(nodeId, storageEngine) {
        this.nodeId = nodeId;
        this.storage = storageEngine;
        this.channelName = 'nexus_p2p_mesh_network';
        this.listeners = [];
        this.initChannel();
    }

    initChannel() {
        if (typeof BroadcastChannel !== 'undefined') {
            this.broadcastChannel = new BroadcastChannel(this.channelName);
            this.broadcastChannel.onmessage = (event) => this.handleIncomingP2PEvent(event.data);
        }
    }

    onMessage(callback) {
        this.listeners.push(callback);
    }

    // --- REGIONAL STORE PUSH BROADCAST ---
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
        this.logSystemEvent(`[P2P BROADCAST] Tienda ${profile.name} transmitió su catálogo a la región ${payload.region}`);
    }

    // --- ON-DEMAND PEER HANDSHAKE & DIRECT MESSAGING ---
    sendDirectMessage(targetNodeId, text, isAiGenerated = false) {
        const message = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            sender: this.nodeId,
            target: targetNodeId,
            text: text,
            isAiGenerated: isAiGenerated,
            timestamp: new Date().toISOString()
        };

        // Save locally to sender database
        this.storage.appendChatMessage(targetNodeId, message);

        // Send over P2P mesh
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
        if (this.broadcastChannel) {
            this.broadcastChannel.postMessage(payload);
        }
    }

    handleIncomingP2PEvent(payload) {
        // Ignore self-emitted messages
        if (payload.senderId === this.nodeId) return;

        this.logSystemEvent(`[P2P INCOMING] Evento recibido: ${payload.type} de ${payload.senderId}`);

        if (payload.type === 'DIRECT_MESSAGE' && (payload.targetId === this.nodeId || payload.targetId === 'all')) {
            // Save incoming message to receiver local DB
            this.storage.appendChatMessage(payload.senderId, payload.message);

            // Notify registered UI / AI listeners
            this.listeners.forEach(fn => fn(payload));
        } else if (payload.type === 'STORE_REGIONAL_PUSH') {
            this.listeners.forEach(fn => fn(payload));
        } else if (payload.type === 'ESCROW_SETTLED_EVENT') {
            this.listeners.forEach(fn => fn(payload));
        }
    }

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
}

// Global nodes initialized for 3-node simulation cockpit
window.buyerNode = new P2PNetworkNode('p2p_buyer_7721', window.buyerStorage);
window.merchantNode = new P2PNetworkNode('p2p_store_techzone', window.merchantStorage);
window.logisticsNode = new P2PNetworkNode('p2p_courier_express', window.logisticsStorage);
