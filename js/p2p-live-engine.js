/**
 * NEXUS P2P - Live Streams & Media Recording Engine
 * Enables P2P Live Shopping, Local MediaRecorder Video Capturing,
 * and Real-time Floating Emoji Reactions & Chat.
 */
class P2PLiveEngine {
    constructor() {
        this.activeStream = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isBroadcasting = false;
        this.isRecording = false;
        this.viewerCount = 14;
        this.pinnedProduct = null;
        this.activeLiveSession = null;
        this.initDefaultLiveSession();
    }

    initDefaultLiveSession() {
        // Pre-loaded live stream session demo (TechZone Store Live)
        this.activeLiveSession = {
            id: 'live_techzone_1',
            hostId: 'p2p_store_techzone',
            hostName: 'TechZone Store 🏬',
            hostAvatar: '🏬',
            title: '🔥 Live Shopping & Demostración de Auriculares Hi-Fi Pro en Vivo',
            viewerCount: 28,
            pinnedProduct: {
                id: 'prod_1',
                name: 'Auriculares Hi-Fi Wireless Pro',
                price: 100,
                shippingFee: 15,
                image: '🎧'
            },
            isLive: true,
            timestamp: new Date().toISOString()
        };
    }

    async startCameraStream(videoElementId) {
        try {
            this.activeStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 720 }, height: { ideal: 1280 }, facingMode: 'user' },
                audio: true
            });

            const videoEl = document.getElementById(videoElementId);
            if (videoEl) {
                videoEl.srcObject = this.activeStream;
                videoEl.play();
            }

            this.isBroadcasting = true;
            return { success: true, stream: this.activeStream };
        } catch (err) {
            console.warn('Cámara física no disponible, utilizando simulación de lienzo para transmisión live.', err);
            return this.startSimulatedLiveStream(videoElementId);
        }
    }

    startSimulatedLiveStream(videoElementId) {
        const canvas = document.createElement('canvas');
        canvas.width = 720;
        canvas.height = 1280;
        const ctx = canvas.getContext('2d');

        let frame = 0;
        const renderFrame = () => {
            if (!this.isBroadcasting) return;
            frame++;

            // Create colorful dynamic gradient background
            const grad = ctx.createLinearGradient(0, 0, 720, 1280);
            grad.addColorStop(0, '#121b22');
            grad.addColorStop(0.5, '#004538');
            grad.addColorStop(1, '#0b141a');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 720, 1280);

            // Pulsing live camera focus circle
            const radius = 120 + Math.sin(frame * 0.05) * 15;
            ctx.beginPath();
            ctx.arc(360, 500, radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 168, 132, 0.25)';
            ctx.fill();
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#00a884';
            ctx.stroke();

            // Store Host Avatar
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 70px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🏬', 360, 515);

            ctx.font = '900 28px Inter, sans-serif';
            ctx.fillText('🔴 TRANSMISIÓN P2P EN VIVO', 360, 700);

            ctx.font = '300 20px Inter, sans-serif';
            ctx.fillStyle = '#8696a0';
            ctx.fillText('TechZone Store - Demostración en Vivo', 360, 740);
            ctx.fillText(`Espectadores: ${this.viewerCount} conectados`, 360, 775);

            requestAnimationFrame(renderFrame);
        };

        this.isBroadcasting = true;
        renderFrame();

        this.activeStream = canvas.captureStream(30);
        const videoEl = document.getElementById(videoElementId);
        if (videoEl) {
            videoEl.srcObject = this.activeStream;
            videoEl.play();
        }

        return { success: true, stream: this.activeStream, simulated: true };
    }

    startRecording() {
        if (!this.activeStream) return { success: false, error: 'No hay flujo de transmisión activo' };

        this.recordedChunks = [];
        try {
            const options = { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' };
            this.mediaRecorder = new MediaRecorder(this.activeStream, options);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.saveRecordingToFile();
            };

            this.mediaRecorder.start(1000);
            this.isRecording = true;
            return { success: true };
        } catch (e) {
            console.error('Error al iniciar MediaRecorder:', e);
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
        a.download = `bbq_live_recording_${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);

        alert('📹 ¡GRABACIÓN COMPLETADA!\n\nEl video del Vivo P2P se ha descargado automáticamente a tu dispositivo.');
    }

    stopStream() {
        if (this.isRecording) {
            this.stopRecording();
        }
        this.isBroadcasting = false;
        if (this.activeStream) {
            this.activeStream.getTracks().forEach(track => track.stop());
            this.activeStream = null;
        }
    }

    sendFloatingEmoji(emoji, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const el = document.createElement('div');
        el.className = 'floating-emoji-item';
        el.textContent = emoji;

        // Random horizontal drift
        const randomX = Math.floor(Math.random() * 60) - 30;
        el.style.right = `${20 + randomX}px`;

        container.appendChild(el);

        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 2200);
    }
}

window.p2pLiveEngine = new P2PLiveEngine();
