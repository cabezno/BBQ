/**
 * BBQ - STT (transcripción de audio on-device) con Whisper vía Transformers.js
 *
 * Corre Whisper-tiny EN EL TELÉFONO (WASM/WebGPU), offline y sin API key. Se descarga
 * una vez (~40 MB) y queda cacheado. Pasa notas de voz o comandos a texto para el workflow.
 */
window.BBQSTT = {
    transcriber: null,
    loading: null,
    modelId: 'Xenova/whisper-tiny',

    async ensure(progressCb) {
        if (this.transcriber) return this.transcriber;
        if (!this.loading) {
            this.loading = (async () => {
                const { pipeline } = await import('https://esm.run/@huggingface/transformers');
                this.transcriber = await pipeline('automatic-speech-recognition', this.modelId, {
                    progress_callback: (p) => { if (progressCb) progressCb(p); }
                });
                return this.transcriber;
            })();
        }
        return this.loading;
    },

    // Decodifica el Blob de audio a Float32 mono a 16 kHz (lo que espera Whisper).
    async _decode(blob) {
        const buf = await blob.arrayBuffer();
        const AC = window.AudioContext || window.webkitAudioContext;
        const ctx = new AC({ sampleRate: 16000 });
        const audio = await ctx.decodeAudioData(buf);
        let data;
        if (audio.numberOfChannels > 1) {
            const a = audio.getChannelData(0), b = audio.getChannelData(1);
            data = new Float32Array(a.length);
            for (let i = 0; i < a.length; i++) data[i] = (a[i] + b[i]) / 2;
        } else {
            data = audio.getChannelData(0);
        }
        try { ctx.close(); } catch (e) {}
        return data;
    },

    async transcribe(blob, progressCb) {
        if (!blob) return '';
        const t = await this.ensure(progressCb);
        const audio = await this._decode(blob);
        const out = await t(audio, { language: 'spanish', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
        return (out && out.text || '').trim();
    }
};
