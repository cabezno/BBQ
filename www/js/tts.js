/**
 * BBQ - TTS (voz on-device con Web Speech API) + panel de voces
 *
 * Usa las voces del sistema del teléfono (Android: Google TTS; iPhone: voces Apple).
 * Sin peso extra, sin API key. La voz elegida se guarda en el dispositivo.
 */
(function () {
    const BBQTTS = {
        _voices: [],
        chosen: (function () { try { return localStorage.getItem('bbq_tts_voice') || ''; } catch (e) { return ''; } })(),

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

        setVoice(name) { this.chosen = name; try { localStorage.setItem('bbq_tts_voice', name); } catch (e) {} },
        getVoice() {
            return this._voices.find(v => v.name === this.chosen) || this.spanish()[0] || this._voices[0] || null;
        },

        speak(text, voiceName) {
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

    // Panel para ver/elegir/probar las voces del dispositivo.
    window.openVoicesPanel = async function () {
        const voices = await BBQTTS.ready();
        let ov = document.getElementById('bbqVoicesPanel');
        if (!ov) { ov = document.createElement('div'); ov.id = 'bbqVoicesPanel'; document.body.appendChild(ov); }
        ov.style.cssText = 'position:fixed; inset:0; z-index:180000; background:rgba(0,0,0,0.7); display:flex; align-items:flex-end; justify-content:center; font-family:Inter,system-ui,sans-serif;';

        if (!voices.length) {
            ov.innerHTML = `<div style="background:var(--wa-header-bg); color:var(--wa-text-primary); width:100%; max-width:440px; border-radius:20px 20px 0 0; padding:20px;">
                <div style="font-weight:900; margin-bottom:10px;">Voces del dispositivo</div>
                <div style="font-size:0.85rem; color:var(--wa-text-secondary);">Este dispositivo/navegador no reportó voces TTS. En Android probá con Chrome; en iPhone con Safari.</div>
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
            <div style="font-size:0.72rem; color:var(--wa-text-secondary); margin-bottom:8px;">Español primero. Tocá ▶️ para escuchar; elegí una para usar en la app.</div>
            <div style="overflow-y:auto; flex:1;">${rows}</div>
        </div>`;
    };
})();
