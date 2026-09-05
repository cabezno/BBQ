/**
 * BBQ - Llamadas P2P (voz y video) por WebRTC
 *
 * Llamada bidireccional directa entre dos peers. La señalización (offer/answer/ICE)
 * viaja por BBQNet con data.ns='call'. El audio/video va directo teléfono↔teléfono.
 * Requiere que ambos estén online (sin buzón, igual que el chat).
 */
class CallEngine {
    constructor() {
        this.pc = null;
        this.localStream = null;
        this.remoteStream = null;
        this.peerId = null;
        this.withVideo = false;
        this.state = 'idle'; // idle | calling | incoming | active
        this.pendingOffer = null;
        this.timerInt = null;
        this.seconds = 0;
        this.iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ];
        this._initSignaling();
    }

    _initSignaling() {
        const attach = () => {
            if (window.BBQNet && window.BBQNet.onCallSignal) {
                window.BBQNet.onCallSignal((from, data) => this._onSignal(from, data));
                return true;
            }
            return false;
        };
        if (!attach()) { const iv = setInterval(() => { if (attach()) clearInterval(iv); }, 500); }
    }

    _name(peerId) {
        return (typeof CONTACTS_DATA !== 'undefined' && CONTACTS_DATA[peerId] && CONTACTS_DATA[peerId].name) || 'Contacto';
    }
    _avatar(peerId) {
        return (typeof CONTACTS_DATA !== 'undefined' && CONTACTS_DATA[peerId] && CONTACTS_DATA[peerId].avatar) || '👤';
    }

    // ── Iniciar llamada ──
    async startCall(peerId, withVideo = false) {
        if (this.state !== 'idle') { if (window.bbqToast) window.bbqToast('Ya hay una llamada en curso'); return; }
        if (!peerId) return;
        this.peerId = peerId;
        this.withVideo = withVideo;
        this.state = 'calling';
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo ? { facingMode: 'user' } : false });
        } catch (e) {
            if (window.bbqToast) window.bbqToast('🎤 Sin permiso de micrófono/cámara');
            this._reset();
            return;
        }
        this._buildUI('calling');
        this._newPc();
        this.localStream.getTracks().forEach(t => this.pc.addTrack(t, this.localStream));
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        const me = (window.BBQIdentity && window.BBQIdentity.getProfile && window.BBQIdentity.getProfile()) || {};
        window.BBQNet.sendSignal(peerId, { ns: 'call', kind: 'offer', sdp: this.pc.localDescription, withVideo, caller: me.name || '' });
    }

    _newPc() {
        this.pc = new RTCPeerConnection({ iceServers: this.iceServers });
        this.pc.onicecandidate = (e) => {
            if (e.candidate) window.BBQNet.sendSignal(this.peerId, { ns: 'call', kind: 'ice', candidate: e.candidate });
        };
        this.pc.ontrack = (e) => {
            this.remoteStream = e.streams[0];
            this._attachRemote();
        };
        this.pc.onconnectionstatechange = () => {
            if (['failed', 'closed', 'disconnected'].includes(this.pc.connectionState) && this.state === 'active') this.endCall(true);
        };
    }

    _attachRemote() {
        if (!this.remoteStream) return;
        const rv = document.getElementById('bbqCallRemoteVideo');
        const ra = document.getElementById('bbqCallRemoteAudio');
        if (rv) { rv.srcObject = this.remoteStream; rv.play().catch(() => {}); }
        if (ra) { ra.srcObject = this.remoteStream; ra.play().catch(() => {}); }
    }

    // ── Señalización entrante ──
    async _onSignal(from, data) {
        try {
            if (data.kind === 'offer') {
                if (this.state !== 'idle') { window.BBQNet.sendSignal(from, { ns: 'call', kind: 'busy' }); return; }
                this.peerId = from;
                this.withVideo = !!data.withVideo;
                this.state = 'incoming';
                this.pendingOffer = data.sdp;
                this._buildUI('incoming', data.caller);
            } else if (data.kind === 'answer') {
                if (this.pc) await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                this._setActive();
            } else if (data.kind === 'ice') {
                if (this.pc) { try { await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) {} }
            } else if (data.kind === 'reject') {
                if (window.bbqToast) window.bbqToast('Llamada rechazada'); this._reset();
            } else if (data.kind === 'busy') {
                if (window.bbqToast) window.bbqToast('Contacto ocupado'); this._reset();
            } else if (data.kind === 'end') {
                this.endCall(true);
            }
        } catch (e) { console.warn('[CALL] señal:', e); }
    }

    async accept() {
        if (this.state !== 'incoming') return;
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: this.withVideo ? { facingMode: 'user' } : false });
        } catch (e) { this.reject(); return; }
        this._newPc();
        this.localStream.getTracks().forEach(t => this.pc.addTrack(t, this.localStream));
        await this.pc.setRemoteDescription(new RTCSessionDescription(this.pendingOffer));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        window.BBQNet.sendSignal(this.peerId, { ns: 'call', kind: 'answer', sdp: this.pc.localDescription });
        this._setActive();
    }

    reject() {
        if (this.peerId) window.BBQNet.sendSignal(this.peerId, { ns: 'call', kind: 'reject' });
        this._reset();
    }

    endCall(remote = false) {
        if (!remote && this.peerId) window.BBQNet.sendSignal(this.peerId, { ns: 'call', kind: 'end' });
        this._reset();
    }

    toggleMute() {
        if (!this.localStream) return;
        const track = this.localStream.getAudioTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            const b = document.getElementById('bbqCallMute');
            if (b) b.textContent = track.enabled ? '🎤' : '🔇';
        }
    }

    _setActive() {
        this.state = 'active';
        this._buildUI('active');
        this._attachRemote();
        if (this.withVideo && this.localStream) {
            const lv = document.getElementById('bbqCallLocalVideo');
            if (lv) { lv.srcObject = this.localStream; lv.muted = true; lv.play().catch(() => {}); }
        }
        this.seconds = 0;
        if (this.timerInt) clearInterval(this.timerInt);
        this.timerInt = setInterval(() => {
            this.seconds++;
            const t = document.getElementById('bbqCallTimer');
            if (t) t.textContent = `${String(Math.floor(this.seconds / 60)).padStart(2, '0')}:${String(this.seconds % 60).padStart(2, '0')}`;
        }, 1000);
    }

    _reset() {
        if (this.timerInt) clearInterval(this.timerInt);
        this.timerInt = null;
        if (this.pc) { try { this.pc.close(); } catch (e) {} this.pc = null; }
        if (this.localStream) { this.localStream.getTracks().forEach(t => t.stop()); this.localStream = null; }
        this.remoteStream = null;
        this.state = 'idle';
        this.peerId = null;
        this.pendingOffer = null;
        this.withVideo = false;
        const ov = document.getElementById('bbqCallOverlay');
        if (ov) ov.remove();
    }

    _buildUI(mode, callerName) {
        let ov = document.getElementById('bbqCallOverlay');
        if (!ov) { ov = document.createElement('div'); ov.id = 'bbqCallOverlay'; document.body.appendChild(ov); }
        ov.style.cssText = `position:fixed; inset:0; z-index:250000; background:#0b141a; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:44px 20px; font-family:Inter,system-ui,sans-serif; color:#e9edef;`;
        const name = this._name(this.peerId) || callerName || 'Contacto';
        const videoArea = this.withVideo
            ? `<video id="bbqCallRemoteVideo" autoplay playsinline style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; background:#000; z-index:1;"></video>
               <video id="bbqCallLocalVideo" autoplay playsinline muted style="position:absolute; top:20px; right:16px; width:96px; height:132px; object-fit:cover; border-radius:12px; border:2px solid #fff; z-index:2;"></video>`
            : `<audio id="bbqCallRemoteAudio" autoplay></audio>`;

        const controls = (mode === 'incoming')
            ? `<div style="display:flex; gap:44px; z-index:3;">
                 <button onclick="window.BBQCall.reject()" style="width:64px;height:64px;border-radius:50%;border:none;background:#ef4444;color:#fff;font-size:1.6rem;cursor:pointer;">📵</button>
                 <button onclick="window.BBQCall.accept()" style="width:64px;height:64px;border-radius:50%;border:none;background:#22c55e;color:#fff;font-size:1.6rem;cursor:pointer;">📞</button>
               </div>`
            : `<div style="display:flex; gap:24px; z-index:3;">
                 <button id="bbqCallMute" onclick="window.BBQCall.toggleMute()" style="width:56px;height:56px;border-radius:50%;border:none;background:#2a3942;color:#fff;font-size:1.3rem;cursor:pointer;">🎤</button>
                 <button onclick="window.BBQCall.endCall()" style="width:56px;height:56px;border-radius:50%;border:none;background:#ef4444;color:#fff;font-size:1.4rem;cursor:pointer;">📵</button>
               </div>`;

        const status = mode === 'calling' ? 'Llamando…'
            : mode === 'incoming' ? (this.withVideo ? 'Videollamada entrante' : 'Llamada entrante')
            : `<span id="bbqCallTimer">00:00</span>`;

        ov.innerHTML = `
            ${this.withVideo ? videoArea : ''}
            <div style="z-index:3; text-align:center; margin-top:30px;">
                <div style="font-size:4rem;">${this._avatar(this.peerId)}</div>
                <div style="font-size:1.5rem; font-weight:900; margin-top:10px;">${name}</div>
                <div style="font-size:0.95rem; color:#8696a0; margin-top:6px;">${status}</div>
            </div>
            ${!this.withVideo ? videoArea : ''}
            ${controls}
        `;
    }
}

window.BBQCall = new CallEngine();
