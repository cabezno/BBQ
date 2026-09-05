/**
 * BBQ - Onboarding (primera vez)
 *
 * 1) Genera la identidad del dispositivo (clave no exportable) si no existe.
 * 2) Si falta nombre/número, muestra una pantalla para pedirlos (el número es
 *    una etiqueta sin verificar, por decisión de diseño MVP).
 * 3) Registra la identidad en el directorio y arranca el transporte P2P (BBQNet).
 *
 * Devuelve el perfil { peerId, phone, name, publicKeyB64 }.
 */
(function () {
    function buildModal() {
        let overlay = document.getElementById('bbqOnboardingOverlay');
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = 'bbqOnboardingOverlay';
        overlay.style.cssText = `position:fixed; inset:0; z-index:200000; background:#0b141a;
            display:flex; align-items:center; justify-content:center; padding:24px;
            font-family:Inter,system-ui,sans-serif;`;
        overlay.innerHTML = `
            <div style="max-width:360px; width:100%; text-align:center; color:#e9edef;">
                <div style="font-size:3rem; margin-bottom:8px;">🔥</div>
                <div style="font-size:1.6rem; font-weight:900; margin-bottom:4px;">Bienvenido a BBQ</div>
                <div style="font-size:0.85rem; color:#8696a0; margin-bottom:24px;">
                    Mensajería y comercio P2P. Tus datos viven en tu teléfono.
                </div>
                <input id="bbqOnbName" type="text" placeholder="Tu nombre"
                    style="width:100%; padding:14px; margin-bottom:12px; border-radius:12px; border:1px solid #2a3942;
                    background:#111b21; color:#e9edef; font-size:1rem; outline:none;">
                <input id="bbqOnbPhone" type="tel" placeholder="Tu número (ej: +54 9 11 5555-1234)"
                    style="width:100%; padding:14px; margin-bottom:8px; border-radius:12px; border:1px solid #2a3942;
                    background:#111b21; color:#e9edef; font-size:1rem; outline:none;">
                <div style="font-size:0.7rem; color:#667781; margin-bottom:20px; text-align:left;">
                    🔒 Tu identidad se genera con una clave segura atada a este teléfono. El número solo
                    sirve para que tus contactos te encuentren.
                </div>
                <button id="bbqOnbSubmit"
                    style="width:100%; padding:14px; border-radius:12px; border:none; cursor:pointer;
                    background:linear-gradient(90deg,#f59e0b,#f97316); color:#0b141a; font-weight:900; font-size:1rem;">
                    Empezar
                </button>
                <div id="bbqOnbError" style="color:#f87171; font-size:0.8rem; margin-top:12px; min-height:18px;"></div>
            </div>`;
        document.body.appendChild(overlay);
        return overlay;
    }

    const Onboarding = {
        async start() {
            await window.BBQIdentity.ensure();
            const profile = window.BBQIdentity.getProfile();

            if (profile.phone && profile.name) {
                await this._goOnline(profile);
                return profile;
            }
            return await this._askLabels();
        },

        _askLabels() {
            return new Promise((resolve) => {
                const overlay = buildModal();
                overlay.style.display = 'flex';
                const nameEl = document.getElementById('bbqOnbName');
                const phoneEl = document.getElementById('bbqOnbPhone');
                const btn = document.getElementById('bbqOnbSubmit');
                const err = document.getElementById('bbqOnbError');

                btn.onclick = async () => {
                    const name = (nameEl.value || '').trim();
                    const phone = (phoneEl.value || '').trim();
                    if (!name) { err.textContent = 'Poné tu nombre'; return; }
                    if (phone.replace(/\D/g, '').length < 6) { err.textContent = 'Número inválido'; return; }

                    btn.disabled = true; btn.textContent = 'Creando identidad...';
                    await window.BBQIdentity.setLabels(phone, name);
                    const reg = await window.BBQIdentity.registerInDirectory();
                    if (!reg.ok) {
                        // Sin servidor igual dejamos entrar (identidad local ya existe)
                        err.textContent = '⚠️ ' + (reg.error || 'No se pudo registrar') + ' (seguís offline)';
                    }
                    const profile = window.BBQIdentity.getProfile();
                    overlay.style.display = 'none';
                    await this._goOnline(profile);
                    resolve(profile);
                };
            });
        },

        async _goOnline(profile) {
            // Reintentar registro (por si la primera vez no había server)
            window.BBQIdentity.registerInDirectory().catch(() => {});
            if (window.BBQNet) window.BBQNet.init(profile.peerId);
        }
    };

    window.BBQOnboarding = Onboarding;
})();
