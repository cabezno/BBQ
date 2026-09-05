/**
 * BBQ - TTS (voz on-device con Web Speech API) + panel de voces
 *
 * Usa las voces del sistema del teléfono (Android: Google TTS; iPhone: voces Apple).
 * Sin peso extra, sin API key. La voz elegida se guarda en el dispositivo.
 */
(function () {
    const ls = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };

    const BBQTTS = {
        _voices: [],
        chosen: ls('bbq_tts_voice', ''),
        mode: ls('bbq_tts_mode', 'system'),      // 'system' | 'neural'
        neuralVoice: ls('bbq_tts_neural', 'ef_dora'),

        init() {
            const load = () => { this._voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; };
            load();
            if (window.speechSynthesis && speechSynthesis.onvoiceschanged !== undefined) {
                speechSynthesis.onvoiceschanged = load;
            }
        },

        // Las voces cargan async en algunos navegadores: esperar hasta que aparezcan.
        ready() {
            return new Promise((resolve) => {
                if (!window.speechSynthesis) return resolve([]);
                let v = speechSynthesis.getVoices();
                if (v.length) { this._voices = v; return resolve(v); }
                let tries = 0;
                const iv = setInterval(() => {
                    v = speechSynthesis.getVoices();
                    tries++;
                    if (v.length || tries > 20) { clearInterval(iv); this._voices = v; resolve(v); }
                }, 100);
            });
        },

        list() { return this._voices; },
        spanish() { return this._voices.filter(v => (v.lang || '').toLowerCase().startsWith('es')); },

        setVoice(name) {
            this.chosen = name; this.mode = 'system';
            try { localStorage.setItem('bbq_tts_voice', name); localStorage.setItem('bbq_tts_mode', 'system'); } catch (e) {}
        },
        selectNeural(id) {
            this.neuralVoice = id; this.mode = 'neural';
            try { localStorage.setItem('bbq_tts_neural', id); localStorage.setItem('bbq_tts_mode', 'neural'); } catch (e) {}
        },
        getVoice() {
            return this._voices.find(v => v.name === this.chosen) || this.spanish()[0] || this._voices[0] || null;
        },

        speak(text, voiceName) {
            // Si está elegida la voz neural y no se pidió una voz de sistema específica, usar Kokoro.
            if (this.mode === 'neural' && !voiceName && window.BBQNeuralTTS) {
                window.BBQNeuralTTS.speak(text, this.neuralVoice);
                return;
            }
            if (!window.speechSynthesis) { if (window.bbqToast) window.bbqToast('Este dispositivo no tiene TTS'); return; }
            try { speechSynthesis.resume(); } catch (e) {} // iOS a veces queda "pausado"
            speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            const v = voiceName ? this._voices.find(x => x.name === voiceName) : this.getVoice();
            if (v) { u.voice = v; u.lang = v.lang; }
            u.rate = 1; u.pitch = 1; u.volume = 1;
            speechSynthesis.speak(u);
        }
    };

    BBQTTS.init();
    window.BBQTTS = BBQTTS;

    // ── Voz neural on-device (Kokoro-82M) — mucho mejor calidad, offline ──
    window.BBQNeuralTTS = {
        tts: null,
        loading: null,
        modelId: 'onnx-community/Kokoro-82M-v1.0-ONNX',
        voices: [
            { id: 'ef_dora', label: 'Dora — español (femenina)' },
            { id: 'em_alex', label: 'Alex — español (masculina)' },
            { id: 'em_santa', label: 'Santa — español (masculina)' }
        ],
        async ensure(progressCb) {
            if (this.tts) return this.tts;
            if (!this.loading) {
                this.loading = (async () => {
                    const mod = await import('https://esm.run/kokoro-js');
                    const KokoroTTS = mod.KokoroTTS || (mod.default && mod.default.KokoroTTS);
                    const device = (typeof navigator !== 'undefined' && navigator.gpu) ? 'webgpu' : 'wasm';
                    this.tts = await KokoroTTS.from_pretrained(this.modelId, { dtype: 'q8', device });
                    return this.tts;
                })();
            }
            return this.loading;
        },
        async speak(text, voiceId) {
            const first = !this.tts;
            if (first && window.bbqToast) window.bbqToast('✨ Cargando voz neural (1ª vez ~80MB)...');
            try {
                const tts = await this.ensure();
                const audio = await tts.generate(text, { voice: voiceId || 'ef_dora' });
                const blob = audio.toBlob();
                const url = URL.createObjectURL(blob);
                const a = new Audio(url);
                a.onended = () => URL.revokeObjectURL(url);
                await a.play();
                return true;
            } catch (e) {
                if (window.bbqToast) window.bbqToast('Voz neural: ' + e.message);
                return false;
            }
        }
    };

    // Panel para ver/elegir/probar las voces del dispositivo.
    window.openVoicesPanel = async function () {
        const voices = await BBQTTS.ready();

        // Sección de voz neural (Kokoro) — mejor calidad, se muestra siempre.
        const neuralSection = (window.BBQNeuralTTS ? window.BBQNeuralTTS.voices : []).map(nv => {
            const checked = BBQTTS.mode === 'neural' && BBQTTS.neuralVoice === nv.id;
            return `<div style="display:flex; align-items:center; gap:10px; padding:10px; border-bottom:1px solid var(--wa-border-light); background:rgba(245,158,11,0.06);">
                <input type="radio" name="bbqVoice" ${checked ? 'checked' : ''} data-nv="${nv.id}" onchange="window.BBQTTS.selectNeural(this.getAttribute('data-nv'))" style="accent-color:var(--wa-green);">
                <div style="flex:1; min-width:0;">
                    <div style="font-size:0.85rem; font-weight:700;">✨ ${nv.label}</div>
                    <div style="font-size:0.7rem; color:var(--wa-text-secondary);">neural on-device · mejor calidad · ~80MB la 1ª vez</div>
                </div>
                <button data-nv="${nv.id}" onclick="window.BBQNeuralTTS.speak('Hola, soy la voz neural de BBQ. Asi sueno.', this.getAttribute('data-nv'))" style="border:1px solid var(--wa-border-light); background:var(--wa-dark-bg); color:var(--wa-text-primary); border-radius:10px; padding:6px 10px; font-size:0.8rem; cursor:pointer;">▶️</button>
            </div>`;
        }).join('');
        const neuralHeader = neuralSection ? '<div style="font-size:0.72rem; font-weight:700; color:var(--wa-green); margin:4px 0 2px;">✨ Voz neural (recomendada)</div>' : '';

        let ov = document.getElementById('bbqVoicesPanel');
        if (!ov) { ov = document.createElement('div'); ov.id = 'bbqVoicesPanel'; document.body.appendChild(ov); }
        ov.style.cssText = 'position:fixed; inset:0; z-index:180000; background:rgba(0,0,0,0.7); display:flex; align-items:flex-end; justify-content:center; font-family:Inter,system-ui,sans-serif;';

        if (!voices.length) {
            ov.innerHTML = `<div style="background:var(--wa-header-bg); color:var(--wa-text-primary); width:100%; max-width:440px; border-radius:20px 20px 0 0; padding:20px;">
                <div style="font-weight:900; margin-bottom:10px;">Voces</div>
                <div style="font-size:0.8rem; color:var(--wa-text-secondary); margin-bottom:8px;">No hay voces de sistema en este dispositivo, pero podés usar la voz neural:</div>
                ${neuralHeader}${neuralSection}
                <button onclick="document.getElementById('bbqVoicesPanel').remove()" style="width:100%; margin-top:14px; padding:12px; border-radius:12px; border:none; background:var(--wa-green); color:#0b141a; font-weight:900; cursor:pointer;">Cerrar</button>
            </div>`;
            return;
        }

        // Español primero, luego el resto.
        const es = voices.filter(v => (v.lang || '').toLowerCase().startsWith('es'));
        const rest = voices.filter(v => !(v.lang || '').toLowerCase().startsWith('es'));
        const ordered = [...es, ...rest];

        // Escape para meter el nombre de la voz en un atributo (evita romper el onclick).
        const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const rows = ordered.map((v) => {
            const onDevice = v.localService ? '📴 on-device' : '☁️ nube';
            const checked = (BBQTTS.chosen ? v.name === BBQTTS.chosen : (es[0] && v.name === es[0].name));
            const dv = esc(v.name);
            return `<div style="display:flex; align-items:center; gap:10px; padding:10px; border-bottom:1px solid var(--wa-border-light);">
                <input type="radio" name="bbqVoice" ${checked ? 'checked' : ''} data-voice="${dv}" onchange="window.BBQTTS.setVoice(this.getAttribute('data-voice'))" style="accent-color:var(--wa-green);">
                <div style="flex:1; min-width:0;">
                    <div style="font-size:0.85rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(v.name)}</div>
                    <div style="font-size:0.7rem; color:var(--wa-text-secondary);">${esc(v.lang)} · ${onDevice}${v.default ? ' · por defecto' : ''}</div>
                </div>
                <button data-voice="${dv}" onclick="window.BBQTTS.speak('Hola, soy la voz de BBQ. Asi sueno.', this.getAttribute('data-voice'))" style="border:1px solid var(--wa-border-light); background:var(--wa-dark-bg); color:var(--wa-text-primary); border-radius:10px; padding:6px 10px; font-size:0.8rem; cursor:pointer;">▶️</button>
            </div>`;
        }).join('');

        ov.innerHTML = `<div style="background:var(--wa-header-bg); color:var(--wa-text-primary); width:100%; max-width:440px; border-radius:20px 20px 0 0; padding:16px 16px 20px; max-height:80vh; display:flex; flex-direction:column;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div style="font-weight:900; font-size:1.05rem;">🔊 Voces del dispositivo (${voices.length})</div>
                <button onclick="document.getElementById('bbqVoicesPanel').remove()" style="background:none; border:none; color:var(--wa-text-secondary); font-size:1.3rem; cursor:pointer;">✕</button>
            </div>
            <div style="font-size:0.72rem; color:var(--wa-text-secondary); margin-bottom:8px;">Elegí una voz (radio), después escribí abajo y tocá 🔊 para probarla con cualquier texto.</div>
            <div style="display:flex; gap:8px; margin-bottom:10px;">
                <input id="bbqTtsTest" type="text" value="Hola, así suena la voz elegida en BBQ." style="flex:1; padding:10px; border-radius:10px; border:1px solid var(--wa-border-light); background:var(--wa-dark-bg); color:var(--wa-text-primary); font-size:0.85rem; outline:none;">
                <button onclick="window.BBQTTS.speak(document.getElementById('bbqTtsTest').value)" style="border:none; background:var(--wa-green); color:#0b141a; border-radius:10px; padding:0 14px; font-weight:900; cursor:pointer;">🔊</button>
            </div>
            <div style="overflow-y:auto; flex:1;">
                ${neuralHeader}${neuralSection}
                ${rows ? '<div style="font-size:0.72rem; font-weight:700; color:var(--wa-text-secondary); margin:10px 0 2px;">Voces del sistema</div>' : ''}
                ${rows}
            </div>
        </div>`;
    };
})();
