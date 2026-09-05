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

    // ── Voz neural on-device (MMS-TTS por Transformers.js) — español, mismo runtime que el STT (que sí carga) ──
    window.BBQNeuralTTS = {
        synth: null,
        loading: null,
        DEFAULT: 'es_mms',
        voices: [
            { id: 'es_mms', name: 'Voz neural (MMS)' }
        ],
        get available() { return this.voices.map(v => v.id); },

        _load() {
            if (this.synth) return Promise.resolve(this.synth);
            if (!this.loading) {
                this.loading = (async () => {
                    const { pipeline } = await import('https://esm.run/@huggingface/transformers');
                    this.synth = await pipeline('text-to-speech', 'Xenova/mms-tts-spa');
                    return this.synth;
                })();
            }
            return this.loading;
        },

        // Respaldo: hablar con la mejor voz del sistema en español.
        _systemFallback(text) {
            try {
                if (!window.speechSynthesis) return;
                const sv = (window.BBQTTS && window.BBQTTS._voices || []).find(v => (v.lang || '').toLowerCase().startsWith('es'));
                speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance(text);
                if (sv) { u.voice = sv; u.lang = sv.lang; }
                speechSynthesis.speak(u);
            } catch (e) {}
        },

        // Lista para el panel (sin descargar nada).
        async listVoices() {
            const meta = {};
            for (const v of this.voices) meta[v.id] = { name: v.name, language: 'es' };
            return meta;
        },

        async speak(text) {
            const first = !this.synth;
            if (first && window.bbqToast) window.bbqToast('✨ Cargando voz neural (1ª vez ~40MB)...');
            try {
                const synth = await this._load();
                const out = await synth(text);
                const AC = window.AudioContext || window.webkitAudioContext;
                const ctx = new AC();
                const buf = ctx.createBuffer(1, out.audio.length, out.sampling_rate);
                buf.getChannelData(0).set(out.audio);
                const src = ctx.createBufferSource();
                src.buffer = buf;
                src.connect(ctx.destination);
                src.start();
                src.onended = () => { try { ctx.close(); } catch (e) {} };
                return true;
            } catch (e) {
                console.warn('[MMS-TTS] falló, uso voz del sistema:', e);
                if (window.bbqToast) window.bbqToast('Voz neural no disponible acá; uso la del sistema.');
                this._systemFallback(text); // que siempre hable algo
                return false;
            }
        }
    };
    // Migrar la voz elegida vieja a la válida actual.
    if (!window.BBQNeuralTTS.available.includes(BBQTTS.neuralVoice)) {
        BBQTTS.neuralVoice = window.BBQNeuralTTS.DEFAULT;
    }

    // Panel para ver/elegir/probar las voces del dispositivo.
    window.openVoicesPanel = async function () {
        const voices = await BBQTTS.ready();

        // Sección de voz neural (Kokoro). Si el modelo ya cargó, usa las voces REALES;
        // si no, muestra las sugeridas (se corrigen al primer uso).
        const nt = window.BBQNeuralTTS;
        let neuralList = [];
        if (nt) {
            let meta = {};
            try { meta = await nt.listVoices(); } catch (e) {}
            const LANGP = { a: 'Inglés (US)', b: 'Inglés (UK)', e: 'Español', f: 'Francés', h: 'Hindi', i: 'Italiano', j: 'Japonés', p: 'Portugués', z: 'Chino' };
            const label = (id) => {
                const m = meta[id] || {};
                const g = id[1] === 'f' ? 'F' : (id[1] === 'm' ? 'M' : '');
                const lang = LANGP[id[0]] || m.language || '';
                const nm = m.name || id;
                return `${nm} — ${lang}${g ? ' (' + g + ')' : ''}`;
            };
            const ids = Object.keys(meta);
            if (ids.length) {
                const es = ids.filter(id => id[0] === 'e');       // español primero
                const others = ids.filter(id => id[0] !== 'e');
                neuralList = [...es, ...others.slice(0, 8)].map(id => ({ id, label: label(id) }));
            } else {
                neuralList = nt.voices;
            }
        }
        const neuralSection = neuralList.map(nv => {
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
