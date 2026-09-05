/**
 * BBQ - Vivos P2P (Live Shopping) REAL por WebRTC
 *
 * El anfitrión transmite su cámara+micrófono DIRECTO a cada espectador (una conexión
 * de media por espectador). La señalización (offer/answer/ICE) viaja por BBQNet con
 * data.ns='media'. El descubrimiento: al ir en vivo se avisa a los contactos conectados.
 *
 * Límite honesto: es malla 1→N; el celular del anfitrión aguanta pocos espectadores
 * (para audiencias grandes haría falta un servidor de media/SFU).
 */
class P2PLiveEngine {
    constructor() {
        this.localStream = null;
        this.isHosting = false;
        this.isViewing = false;
        this.viewers = new Map();   // viewerPeerId -> RTCPeerConnection (lado anfitrión)
        this.viewerPc = null;       // RTCPeerConnection (lado espectador)
        this.currentHostId = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.viewerCount = 0;
        this.pinnedProduct = null;
        this.iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ];
        this._initSignaling();
    }

    _initSignaling() {
        const attach = () => {
            if (window.BBQNet && window.BBQNet.onMediaSignal) {
                window.BBQNet.onMediaSignal((from, data) => this._onMediaSignal(from, data));
                return true;
            }
            return false;
        };
        if (!attach()) {
            const iv = setInterval(() => { if (attach()) clearInterval(iv); }, 500);
        }
    }

    // ─────────── ANFITRIÓN ───────────
    async startCameraStream(videoElementId) {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } },
                audio: true
            });
        } catch (e) {
            if (window.bbqToast) window.bbqToast('🎥 Sin permiso de cámara/micrófono');
            return { success: false, error: e.message };
        }
        this.isHosting = true;
        this.viewers.clear();
        this.viewerCount = 0;
        const v = document.getElementById(videoElementId);
        if (v) { v.srcObject = this.localStream; v.muted = true; v.play().catch(() => {}); }
        this._notifyContacts('live_start');
        this._updateViewerCount();
        return { success: true, stream: this.localStream };
    }

    _notifyContacts(type) {
        try {
            if (!window.BBQNet) return;
            const me = (window.BBQIdentity && window.BBQIdentity.getProfile && window.BBQIdentity.getProfile()) || {};
            const ids = (typeof CONTACTS_DATA !== 'undefined')
                ? Object.keys(CONTACTS_DATA).filter(id => CONTACTS_DATA[id] && CONTACTS_DATA[id].isReal) : [];
            ids.forEach(pid => {
                window.BBQNet.send(pid, {
                    type,
                    message: { hostId: window.MY_PEER_ID, hostName: me.name || 'Contacto', product: this.pinnedProduct }
                }).catch(() => {});
            });
        } catch (e) {}
    }

    async _createViewerConnection(viewerId) {
        if (!this.localStream) return;
        const pc = new RTCPeerConnection({ iceServers: this.iceServers });
        this.viewers.set(viewerId, pc);
        this.localStream.getTracks().forEach(t => pc.addTrack(t, this.localStream));
        pc.onicecandidate = (e) => {
            if (e.candidate) window.BBQNet.sendSignal(viewerId, { ns: 'media', kind: 'ice', candidate: e.candidate });
        };
        pc.onconnectionstatechange = () => {
            if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
                this.viewers.delete(viewerId);
                this._updateViewerCount();
            }
        };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        window.BBQNet.sendSignal(viewerId, { ns: 'media', kind: 'offer', sdp: pc.localDescription });
        this._updateViewerCount();
    }

    _updateViewerCount() {
        this.viewerCount = this.viewers.size;
        const el = document.getElementById('hostLiveViewerCount');
        if (el) el.textContent = `👥 ${this.viewerCount} Espectadores conectados`;
    }

    // ─────────── ESPECTADOR ───────────
    async watch(hostId, videoElementId) {
        this.isViewing = true;
        this.currentHostId = hostId;
        this.viewerPc = new RTCPeerConnection({ iceServers: this.iceServers });
        this.viewerPc.ontrack = (e) => {
            const v = document.getElementById(videoElementId);
            if (v && e.streams && e.streams[0]) { v.srcObject = e.streams[0]; v.play().catch(() => {}); }
        };
        this.viewerPc.onicecandidate = (e) => {
            if (e.candidate) window.BBQNet.sendSignal(hostId, { ns: 'media', kind: 'ice', candidate: e.candidate });
        };
        window.BBQNet.sendSignal(hostId, { ns: 'media', kind: 'watch' });
        return { success: true };
    }

    async _handleHostOffer(from, data) {
        if (!this.viewerPc || from !== this.currentHostId) return;
        await this.viewerPc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await this.viewerPc.createAnswer();
        await this.viewerPc.setLocalDescription(answer);
        window.BBQNet.sendSignal(from, { ns: 'media', kind: 'answer', sdp: this.viewerPc.localDescription });
    }

    // ─────────── Señalización de media ───────────
    async _onMediaSignal(from, data) {
        try {
            if (data.kind === 'watch' && this.isHosting) {
                await this._createViewerConnection(from);
            } else if (data.kind === 'answer' && this.isHosting && this.viewers.has(from)) {
                await this.viewers.get(from).setRemoteDescription(new RTCSessionDescription(data.sdp));
            } else if (data.kind === 'offer' && this.isViewing) {
                await this._handleHostOffer(from, data);
            } else if (data.kind === 'ice') {
                if (this.isHosting && this.viewers.has(from)) {
                    await this.viewers.get(from).addIceCandidate(new RTCIceCandidate(data.candidate));
                } else if (this.isViewing && this.viewerPc) {
                    await this.viewerPc.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            } else if (data.kind === 'stop' && this.isViewing) {
                this.stopStream();
                if (window.bbqToast) window.bbqToast('El vivo terminó');
            }
        } catch (e) {
            console.warn('[LIVE] Error en señalización de media:', e);
        }
    }

    // ─────────── Grabación local (anfitrión) ───────────
    startRecording() {
        if (!this.localStream) return { success: false, error: 'No hay transmisión activa' };
        this.recordedChunks = [];
        try {
            const options = { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' };
            this.mediaRecorder = new MediaRecorder(this.localStream, options);
            this.mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) this.recordedChunks.push(e.data); };
            this.mediaRecorder.onstop = () => this.saveRecordingToFile();
            this.mediaRecorder.start(1000);
            this.isRecording = true;
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            return { success: true };
        }
        return { success: false };
    }

    saveRecordingToFile() {
        if (this.recordedChunks.length === 0) return;
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `bbq_live_${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
        if (window.bbqToast) window.bbqToast('📹 Grabación descargada');
    }

    // ─────────── Fin ───────────
    stopStream() {
        if (this.isRecording) this.stopRecording();
        if (this.isHosting) {
            if (window.BBQNet) {
                this.viewers.forEach((pc, vid) => {
                    try { window.BBQNet.sendSignal(vid, { ns: 'media', kind: 'stop' }); } catch (e) {}
                    try { pc.close(); } catch (e) {}
                });
            }
            this.viewers.clear();
            this._notifyContacts('live_end');
        }
        if (this.viewerPc) { try { this.viewerPc.close(); } catch (e) {} this.viewerPc = null; }
        if (this.localStream) { this.localStream.getTracks().forEach(t => t.stop()); this.localStream = null; }
        this.isHosting = false;
        this.isViewing = false;
        this.currentHostId = null;
        this.viewerCount = 0;
    }

    // ─────────── Reacciones flotantes ───────────
    sendFloatingEmoji(emoji, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const el = document.createElement('div');
        el.className = 'floating-emoji-item';
        el.textContent = emoji;
        const randomX = Math.floor(Math.random() * 60) - 30;
        el.style.right = `${20 + randomX}px`;
        container.appendChild(el);
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 2200);
    }
}

window.p2pLiveEngine = new P2PLiveEngine();
