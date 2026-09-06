/**
 * BBQ MOBILE APP CONTROLLER (ANDROID & iPHONE PWA)
 * Real-time P2P messaging via WebSocket, PWA installable,
 * AI Connector, Escrow, Vivos, Voice Notes, Stories.
 */

document.addEventListener('DOMContentLoaded', () => {
    initMobileNavigation();
    initChatList();
    initMessageInput();
    initAttachmentPopup();
    initModals();
    initSimulatorControls();
    initNativeMenu();
    loadProfileData();
    loadAiSetupData();
    loadStoreData();
    if (window.buyerStorage.consolidateStatuses) window.buyerStorage.consolidateStatuses(); // agrupar estados por autor
    initInstagramStoriesBar();
    initP2PRealtimeListener();
    initMobileDetection();
    registerServiceWorker();

    // Trigger Automatic Daily Referral Pop-up on launch
    setTimeout(() => {
        initDailyReferralPopup();
    }, 600);

    // Arrancar el sistema P2P real: identidad del dispositivo + contactos + WebRTC.
    // (Reemplaza el viejo WS-relay. La señalización P2P la maneja BBQNet.)
    if (window.BBQ) window.BBQ.boot();

    // Sin chat demo por defecto: se muestra la lista (vacía hasta agregar contactos).
});

/* ==========================================================================
   0. SERVICE WORKER REGISTRATION & PWA INSTALL
   ========================================================================== */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => {
                console.log('[PWA] Service Worker registrado:', reg.scope);
            })
            .catch(err => {
                console.warn('[PWA] Service Worker no registrado:', err);
            });
    }

    // PWA Install prompt (Android)
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;

        // Show install banner
        const banner = document.getElementById('pwaInstallBanner');
        if (banner) {
            banner.style.display = 'flex';
            const btnInstall = document.getElementById('btnPwaInstall');
            if (btnInstall) {
                btnInstall.onclick = async () => {
                    deferredPrompt.prompt();
                    const result = await deferredPrompt.userChoice;
                    console.log('[PWA] Install result:', result.outcome);
                    banner.style.display = 'none';
                    deferredPrompt = null;
                };
            }
            const btnDismiss = document.getElementById('btnPwaDismiss');
            if (btnDismiss) {
                btnDismiss.onclick = () => { banner.style.display = 'none'; };
            }
        }
    });
}

/* ==========================================================================
   0b. REAL-TIME P2P MESSAGE LISTENER (WebSocket incoming)
   ========================================================================== */
function initP2PRealtimeListener() {
    window.myNode.onMessage((payload) => {
        if (payload.type === 'DIRECT_MESSAGE') {
            // Re-render chat if we're viewing the sender's conversation
            if (payload.senderId === currentChatId) {
                renderMobileMessages();
            }
            // Always update chat list (new message badge, reorder)
            renderMobileChatList();

            // Play notification sound
            playNotificationSound();

            // Show visual notification if chat is not active
            if (payload.senderId !== currentChatId) {
                showInAppNotification(payload);
            }
        }

        if (payload.type === 'STATUS_PUBLISHED') {
            initInstagramStoriesBar();
        }

        if (payload.type === 'PEERS_UPDATE' || payload.type === 'PEER_CONNECTED' || payload.type === 'PEER_DISCONNECTED') {
            updatePeersOnlineCount(payload.peersOnline);
        }
    });
}

function playNotificationSound() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
        }
    } catch (e) {}
}

function showInAppNotification(payload) {
    const contact = CONTACTS_DATA[payload.senderId];
    const name = contact ? contact.name : payload.senderId;
    const text = payload.message?.text || 'Nuevo mensaje';

    const notif = document.createElement('div');
    notif.className = 'in-app-notification';
    notif.innerHTML = `
        <div style="font-weight:700; font-size:0.85rem;">${name}</div>
        <div style="font-size:0.78rem; opacity:0.8;">${text.substring(0, 50)}</div>
    `;
    notif.onclick = () => {
        selectMobileChat(payload.senderId);
        notif.remove();
    };
    document.body.appendChild(notif);

    setTimeout(() => {
        notif.classList.add('fade-out');
        setTimeout(() => notif.remove(), 400);
    }, 3500);
}

function updatePeersOnlineCount(count) {
    const el = document.getElementById('peersOnlineCount');
    if (el) el.textContent = `${count || 0} online`;
}

/* ==========================================================================
   0c. MOBILE DETECTION & SIMULATOR HIDING
   ========================================================================== */
function initMobileDetection() {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    if (isMobile || isStandalone) {
        // Hide desktop simulator bar
        const simHeader = document.querySelector('.mobile-sim-header');
        if (simHeader) simHeader.style.display = 'none';

        // Make phone wrapper fullscreen
        const wrapper = document.getElementById('phoneWrapper');
        if (wrapper) wrapper.classList.add('fullscreen');
    }
}


let currentChatId = null;
let currentRole = 'buyer';

// Los contactos reales se cargan desde IndexedDB al iniciar (ver bbq-integration.js).
// Empieza vacío: el usuario agrega contactos por número o desde su agenda.
const CONTACTS_DATA = {};

/* ==========================================================================
   1. AUTOMATIC DAILY REFERRAL POP-UP
   ========================================================================== */
function initDailyReferralPopup() {
    const state = window.referralEngine.getState();
    const countEl = document.getElementById('dailyReferralCount');
    const barEl = document.getElementById('dailyReferralProgressBar');

    if (countEl) countEl.textContent = `${state.invitedCount} / 20`;
    if (barEl) {
        const pct = Math.min(100, (state.invitedCount / 20) * 100);
        barEl.style.width = `${pct}%`;
    }

    const btnDailyInv = document.getElementById('btnDailyInvite5');
    if (btnDailyInv) {
        btnDailyInv.onclick = () => {
            for(let i=0; i<5; i++) window.referralEngine.addReferral();
            const newState = window.referralEngine.getState();
            if (countEl) countEl.textContent = `${newState.invitedCount} / 20`;
            if (barEl) barEl.style.width = `${Math.min(100, (newState.invitedCount / 20) * 100)}%`;
            alert('🎉 ¡Se enviaron 5 invitaciones encriptadas! Tu barra de recompensas diarias ha avanzado.');
        };
    }

    openModal('modalDailyReferralPopup');
}

/* ==========================================================================
   2. IN-APP ENDPOINT SERVER 9090 & NATIVE INSTALLED AI APP CONNECTOR
   ========================================================================== */
// Prueba REAL de la IA configurada (usa el proveedor + API key guardados).
async function handleTestLocalEndpoint() {
    if (!window.merchantAiOrchestrator) return;
    if (window.bbqToast) window.bbqToast('Probando IA...');
    try {
        const res = await window.merchantAiOrchestrator.processIncomingMessage('Hola, ¿podés confirmarme que estás conectada?', 'test');
        if (window.BBQTTS && res.replyText) window.BBQTTS.speak(res.replyText); // leer la respuesta en voz
        alert('🤖 Respuesta de la IA:\n\n' + (res.replyText || 'sin respuesta') +
              (res.real ? '\n\n✅ Proveedor real conectado.' : '\n\n(Asistente local por reglas — configurá un proveedor + API key para IA real.)'));
    } catch (e) {
        alert('⚠️ Error probando la IA: ' + e.message);
    }
}

// No existe una API pública para "conectar" con las apps de Gemini/ChatGPT instaladas.
// La forma real de usar IA es configurar un proveedor con API key (o Ollama) en Ajustes de IA.
function handleLaunchNativeAiApp(provider) {
    if (window.bbqToast) window.bbqToast('Configurá la IA con API key en Ajustes');
    else alert('Para usar IA real, configurá un proveedor (OpenAI, Gemini, Claude, DeepSeek u Ollama) con su API key en Ajustes de IA. No es posible "conectar" directamente con las apps instaladas de Gemini/ChatGPT.');
}

/* ==========================================================================
   3. AI AUTOMATIONS ENGINE HANDLERS
   ========================================================================== */
// Crear una automatización con el modelo on-device (acotado: mapea a {trigger, action} fijos).
async function handleAiWorkflowRule() {
    const input = document.getElementById('aiWfInput');
    const status = document.getElementById('aiWfStatus');
    const desc = (input && input.value || '').trim();
    if (!desc) { if (status) status.textContent = 'Escribí una descripción.'; return; }
    if (!window.WorkflowAI || !window.WorkflowAI.supported()) {
        if (status) { status.style.color = '#f59e0b'; status.textContent = '⚠️ Tu dispositivo no soporta IA on-device (WebGPU). Probá un Android/Chrome reciente.'; }
        return;
    }
    if (status) { status.style.color = 'var(--wa-text-secondary)'; status.textContent = '⏳ Cargando modelo on-device (la 1ª vez descarga ~350MB)...'; }
    window.WorkflowAI.onProgress = (p) => {
        if (status) status.textContent = '⬇️ ' + (p && (p.text || ('Cargando ' + Math.round((p.progress || 0) * 100) + '%')) || 'Cargando...');
    };
    try {
        const rule = await window.WorkflowAI.describeRuleToWorkflow(desc);
        if (!rule) {
            if (status) { status.style.color = '#f59e0b'; status.textContent = 'No pude mapearlo a una regla conocida. Probá describirlo de otra forma.'; }
            return;
        }
        window.automationEngine.addRule(rule.name, desc, rule.trigger, rule.action);
        renderAutomationsModal();
        if (input) input.value = '';
        if (status) { status.style.color = '#22c55e'; status.textContent = `✅ Regla creada: ${rule.trigger} → ${rule.action}`; }
    } catch (e) {
        if (status) { status.style.color = '#f87171'; status.textContent = '⚠️ ' + e.message; }
    }
}

// Editor simple del flujo del agente (JSON). El flujo corre igual en PC o móvil.
async function openFlowEditor() {
    let ov = document.getElementById('bbqFlowEditor');
    if (!ov) { ov = document.createElement('div'); ov.id = 'bbqFlowEditor'; document.body.appendChild(ov); }
    ov.style.cssText = 'position:fixed; inset:0; z-index:190000; background:rgba(0,0,0,0.7); display:flex; align-items:flex-end; justify-content:center; font-family:Inter,system-ui,sans-serif;';
    ov.innerHTML = `<div style="background:var(--wa-header-bg); color:var(--wa-text-primary); width:100%; max-width:480px; border-radius:20px 20px 0 0; padding:16px; max-height:85vh; display:flex; flex-direction:column;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-weight:900;">✏️ Flujo del agente (JSON)</div>
            <button onclick="document.getElementById('bbqFlowEditor').remove()" style="background:none;border:none;color:var(--wa-text-secondary);font-size:1.3rem;cursor:pointer;">✕</button>
        </div>
        <div style="font-size:0.72rem; color:var(--wa-text-secondary); margin-bottom:8px;">Etapas acotadas (classify / llm / reply / tool). Corre igual en el worker de PC o en el móvil.</div>
        <textarea id="bbqFlowJson" spellcheck="false" style="flex:1; min-height:240px; width:100%; border-radius:12px; border:1px solid var(--wa-border-light); background:var(--wa-dark-bg); color:var(--wa-text-primary); font-family:monospace; font-size:0.75rem; padding:10px; outline:none;">Cargando…</textarea>
        <div id="bbqFlowMsg" style="font-size:0.75rem; min-height:18px; margin-top:6px;"></div>
        <button onclick="saveFlowEditor()" class="btn-wa-primary" style="width:100%; margin-top:8px;">Guardar flujo</button>
    </div>`;
    try {
        const r = await fetch(`${window.BBQ_SERVER}/api/flows/store-assistant`);
        const j = await r.json();
        const flow = j.ok ? j.flow : (window.BBQFlow && window.BBQFlow.DEFAULT_STORE_FLOW);
        document.getElementById('bbqFlowJson').value = JSON.stringify(flow, null, 2);
    } catch (e) {
        document.getElementById('bbqFlowJson').value = JSON.stringify((window.BBQFlow && window.BBQFlow.DEFAULT_STORE_FLOW) || {}, null, 2);
    }
}

async function saveFlowEditor() {
    const msg = document.getElementById('bbqFlowMsg');
    let flow;
    try { flow = JSON.parse(document.getElementById('bbqFlowJson').value); }
    catch (e) { msg.style.color = '#f87171'; msg.textContent = 'JSON inválido: ' + e.message; return; }
    if (window.BBQFlow) { const err = window.BBQFlow.validate(flow); if (err) { msg.style.color = '#f87171'; msg.textContent = err; return; } }
    try {
        const r = await fetch(`${window.BBQ_SERVER}/api/flows`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ flow }) });
        const j = await r.json();
        if (j.ok) { msg.style.color = '#22c55e'; msg.textContent = '✅ Flujo guardado (' + j.id + ')'; }
        else { msg.style.color = '#f87171'; msg.textContent = 'Error: ' + (j.error || '?'); }
    } catch (e) { msg.style.color = '#f87171'; msg.textContent = 'Error: ' + e.message; }
}

function renderAutomationsModal() {
    const container = document.getElementById('automationsList');
    if (!container) return;

    const rules = window.automationEngine.getRules();

    container.innerHTML = rules.map(r => `
        <div style="background:var(--wa-header-bg); border:1px solid ${r.enabled ? 'var(--wa-green)' : 'var(--wa-border-light)'}; border-radius:12px; padding:10px 12px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <div style="font-weight:600; font-size:0.88rem;">${r.name}</div>
                <button class="btn-wa-primary" style="font-size:0.72rem; padding:3px 8px; background:${r.enabled ? 'var(--wa-green)' : '#666'};" onclick="toggleAutomationRule('${r.id}')">
                    ${r.enabled ? 'ACTIVADA ✅' : 'DESACTIVADA ⏸️'}
                </button>
            </div>
            <div style="font-size:0.78rem; color:var(--wa-text-secondary); margin-bottom:6px;">${r.description}</div>
            <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:#06b6d4;">
                <span>Disparador: <code>${r.trigger}</code></span>
                <span>Ejecuciones: <strong>${r.executionCount} veces</strong></span>
            </div>
        </div>
    `).join('');
}

function toggleAutomationRule(ruleId) {
    window.automationEngine.toggleRule(ruleId);
    renderAutomationsModal();
}

function handleCreateCustomAutomation() {
    const name = prompt('Nombre de la Regla de Automatización:', '🚚 Auto-Notificación de Despacho');
    if (!name) return;

    const desc = prompt('Descripción de la acción:', 'Envía un mensaje P2P de seguimiento al cliente cuando el producto sale del almacén.');
    window.automationEngine.addRule(name, desc || 'Regla creada por el usuario', 'CUSTOM_TRIGGER', 'CUSTOM_ACTION');
    renderAutomationsModal();
}

/* ==========================================================================
   4. NATIVE POPUP MENU (⋮) & NAVIGATION
   ========================================================================== */
function initNativeMenu() {
    const btnMenu = document.getElementById('btnMobileMenu');
    const menu = document.getElementById('mobilePopupMenu');

    if (btnMenu && menu) {
        btnMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        });
    }

    document.addEventListener('click', () => hidePopupMenu());

    const selectEngine = document.getElementById('aiSelectEngine');
    if (selectEngine) {
        selectEngine.addEventListener('change', () => {
            const val = selectEngine.value;
            const isApiKeyNeeded = (val === 'gemini_api' || val === 'openai_api' || val === 'claude_api' || val === 'deepseek_api');
            const isEndpointNeeded = (val === 'ollama_local' || val === 'custom_api');

            document.getElementById('groupApiKey').style.display = isApiKeyNeeded ? 'block' : 'none';
            document.getElementById('groupEndpointUrl').style.display = isEndpointNeeded ? 'block' : 'none';
        });
    }
}

function hidePopupMenu() {
    const menu = document.getElementById('mobilePopupMenu');
    if (menu) menu.style.display = 'none';
}

function initMobileNavigation() {
    const btnBack = document.getElementById('btnBackToChats');
    const screenChats = document.getElementById('screenChatList');
    const screenConv = document.getElementById('screenConversation');

    if (btnBack) {
        btnBack.addEventListener('click', () => {
            screenConv.classList.remove('active');
            screenChats.classList.remove('slide-left');
        });
    }
}

function openMobileChatScreen() {
    const screenChats = document.getElementById('screenChatList');
    const screenConv = document.getElementById('screenConversation');

    screenChats.classList.add('slide-left');
    screenConv.classList.add('active');
}

function selectMobileChat(chatId) {
    currentChatId = chatId;
    renderMobileChatList();

    const contact = CONTACTS_DATA[chatId];
    if (!contact) return;

    document.getElementById('mActiveName').textContent = contact.name;
    document.getElementById('mActiveAvatar').textContent = contact.avatar;
    document.getElementById('mActiveStatus').textContent = contact.status;

    renderMobileMessages();
    openMobileChatScreen();
}

/* ==========================================================================
   5. SIM PHONE AUTO-DETECTION & GOOGLE / APPLE ID VERIFICATION
   ========================================================================== */
function handleDetectSimNumber() {
    // Por privacidad, ni iOS ni (de forma confiable) Android permiten leer el número de la SIM.
    if (window.bbqToast) window.bbqToast('Ingresá tu número manualmente');
    else alert('Por privacidad, la app no puede leer el número de la SIM. Ingresalo a mano.');
    const inputPhone = document.getElementById('profileInputPhone');
    if (inputPhone) inputPhone.focus();
}

function handleVerifyGoogleAccount() { handleSaveProfile(); }
function handleVerifyAppleId() { handleSaveProfile(); }

function _obsoleteVerify_unused() {
    return; // código muerto (verificación falsa eliminada)
    const phone = '';
    const profile = window.buyerStorage.getUserProfile();
    profile.phone = phone;
    updateVerificationBadge(profile);

    alert(`🌐 ¡AUTENTICACIÓN EXITOSA CON CUENTA DE GOOGLE!\n\n` +
          `Teléfono: ${phone}\n` +
          `Sello de Seguridad: Verificado con Google Play Services / One-Tap\n` +
          `Identificador Criptográfico P2P Vinculado ✅`);
}

function _deadAppleVerify_unused() {
    return; // código muerto (verificación falsa eliminada)
    const phone = document.getElementById('profileInputPhone').value || '';
    const profile = window.buyerStorage.getUserProfile();
    profile.phone = phone;
    profile.isVerified = true;
    profile.verificationProvider = 'Apple ID (Face ID)';
    profile.verifiedTimestamp = new Date().toISOString();

    window.buyerStorage.saveUserProfile(profile);
    updateVerificationBadge(profile);

    alert(` ¡AUTENTICACIÓN EXITOSA CON SIGN IN WITH APPLE!\n\n` +
          `Teléfono: ${phone}\n` +
          `Biometría: Verificado con Face ID / Touch ID\n` +
          `Sello Criptográfico Vinculado a iOS ✅`);
}

function updateVerificationBadge(profile) {
    const badge = document.getElementById('profileVerificationBadge');
    if (!badge) return;
    // La identidad es una clave criptográfica atada al dispositivo (no un "verificado" externo).
    badge.innerHTML = `
        <span style="color:var(--wa-green); font-size:1.1rem;">🔒</span>
        <span>Identidad protegida por <strong>clave de dispositivo</strong></span>
    `;
    badge.style.borderColor = 'var(--wa-green)';
    badge.style.background = 'rgba(0, 168, 132, 0.15)';
}

/* ==========================================================================
   6. CHAT LIST & MESSAGES STREAM
   ========================================================================== */
function initChatList() {
    renderMobileChatList();
}

function renderMobileChatList() {
    const container = document.getElementById('mChatListContainer');
    if (!container) return;

    const sortedContactIds = Object.keys(CONTACTS_DATA).sort((a, b) => {
        const msgsA = window.buyerStorage.getChatMessages(a);
        const msgsB = window.buyerStorage.getChatMessages(b);
        const timeA = msgsA.length > 0 ? new Date(msgsA[msgsA.length - 1].timestamp).getTime() : 0;
        const timeB = msgsB.length > 0 ? new Date(msgsB[msgsB.length - 1].timestamp).getTime() : 0;
        return timeB - timeA;
    });

    const html = sortedContactIds.map(id => {
        const c = CONTACTS_DATA[id];
        const messages = window.buyerStorage.getChatMessages(id);
        const lastMsg = messages.length > 0 ? messages[messages.length - 1] : { text: 'Iniciar chat P2P cifrado', timestamp: Date.now() };

        return `
            <div class="m-chat-item" onclick="selectMobileChat('${id}')">
                <div class="m-avatar">
                    ${c.avatar}
                    <div class="online-dot"></div>
                </div>
                <div class="m-chat-details">
                    <div class="m-chat-top">
                        <div class="m-chat-name">${c.name}</div>
                        <div class="m-chat-time">${formatTime(lastMsg.timestamp)}</div>
                    </div>
                    <div class="m-chat-bottom">
                        <div class="m-last-msg">
                            <span class="wa-tick read">✓✓</span>
                            <span>${truncateText(lastMsg.text, 30)}</span>
                        </div>
                        ${id === 'p2p_store_techzone' ? '<div class="m-unread-pill">1</div>' : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

// Escapa texto para meterlo en un atributo HTML (para el botón 🔊 de escuchar).
function escAttr(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, ' ');
}

function renderMobileMessages() {
    const container = document.getElementById('mChatMessages');
    if (!container) return;

    const messages = window.buyerStorage.getChatMessages(currentChatId);

    let html = `<div style="text-align:center; margin:10px 0; color:var(--wa-text-secondary); font-size:0.72rem; text-transform:uppercase;">HOY</div>`;

    if (messages.length === 0) {
        html += `
            <div style="text-align:center; margin:15px 0; color:var(--wa-text-secondary); font-size:0.78rem;">
                🔒 Chat P2P cifrado directamente entre terminales móviles.
            </div>
        `;
    }

    html += messages.map(m => {
        const isOutgoing = m.sender === 'p2p_buyer_7721' || m.sender === window.MY_PEER_ID;
        const isAi = m.isAiGenerated;

        return `
            <div class="wa-msg-row ${isOutgoing ? 'outgoing' : 'incoming'} ${isAi ? 'ai-msg' : ''}">
                <div class="wa-msg-bubble">
                    ${isAi ? '<div class="msg-author-tag">⚡ IA Local Tienda</div>' : ''}
                    <div>${m.text}</div>
                    ${m.payloadCard ? renderPayloadCard(m.payloadCard) : ''}
                    <div class="msg-footer-meta">
                        ${(m.text && !m.payloadCard) ? `<button onclick="window.BBQTTS && window.BBQTTS.speak(this.getAttribute('data-tts'))" data-tts="${escAttr(m.text)}" title="Escuchar" style="background:none; border:none; color:var(--wa-tick-gray); cursor:pointer; font-size:0.72rem; padding:0 4px;">🔊</button>` : ''}
                        <span class="msg-timestamp">${formatTime(m.timestamp)}</span>
                        ${isOutgoing ? '<span class="wa-tick read">✓✓</span>' : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
    hydrateAttachments(); // cargar imágenes/archivos desde IndexedDB
}

function renderPayloadCard(card) {
    if (card.type === 'image') {
        return `<img data-att="${card.id}" style="max-width:220px; max-height:280px; border-radius:10px; margin-top:6px; cursor:pointer; display:block; background:#0000001a;" onclick="openImageAttachment('${card.id}')">`;
    }
    if (card.type === 'file') {
        const kb = card.size ? Math.max(1, Math.round(card.size / 1024)) : '';
        const safeName = (card.name || 'Documento').replace(/'/g, '').replace(/"/g, '');
        return `<div data-att="${card.id}" onclick="downloadAttachment('${card.id}','${safeName}')" style="display:flex; align-items:center; gap:10px; background:rgba(0,0,0,0.25); border:1px solid var(--wa-border); border-radius:10px; padding:10px; margin-top:6px; cursor:pointer;">
            <i class="bi bi-file-earmark-arrow-down" style="font-size:1.6rem; color:var(--wa-green);"></i>
            <div><div style="font-size:0.82rem; font-weight:600;">${safeName}</div><div style="font-size:0.7rem; color:var(--wa-text-secondary);">${kb} KB · Tocar para descargar</div></div>
        </div>`;
    }
    if (card.type === 'escrow_payment') {
        const isPickup = card.deliveryMode === 'PICKUP';
        return `
            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--wa-border); border-radius:8px; padding:8px; margin-top:6px;">
                <div style="font-weight:bold; color:var(--wa-green); font-size:0.8rem; margin-bottom:4px;">
                    💳 Retención Google Wallet (${isPickup ? '🏪 Retiro en Local' : '🚚 Envío por Courier'})
                </div>
                <div style="font-size:0.82rem; margin-bottom:4px;">Total Retenido: <strong>$${card.total.toFixed(2)} USD</strong></div>
                <div style="font-size:0.72rem; color:var(--wa-text-secondary); margin-bottom:6px;">
                    ${isPickup ? '• Producto: $' + card.productPrice.toFixed(2) + ' | Envío: $0.00 (Gratis en Local)' : '• Producto: $' + card.productPrice.toFixed(2) + ' | Envío Courier: $' + card.shippingFee.toFixed(2)}
                </div>
                <button class="btn-wa-primary" style="width:100%; font-size:0.75rem; padding:5px 8px;" onclick="openEscrowModal()">
                    🔍 Ver Código QR (${isPickup ? 'Escaneo Vendedor' : 'Escaneo Repartidor'})
                </button>
            </div>
        `;
    } else if (card.type === 'merchant_charge_request') {
        const isPaid = card.status === 'PAID';
        const isPickup = card.deliveryMode === 'PICKUP';
        return `
            <div style="background:rgba(245, 158, 11, 0.08); border:1px solid ${isPaid ? '#22c55e' : '#f59e0b'}; border-radius:10px; padding:10px; margin-top:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span style="font-weight:bold; font-size:0.82rem; color:${isPaid ? '#22c55e' : '#f59e0b'};">
                        ${isPaid ? '✅ COBRO RECIBIDO & PAGADO' : '🧾 Factura / Solicitud de Cobro'}
                    </span>
                    <span style="font-size:0.68rem; background:${isPaid ? '#22c55e20' : '#f59e0b20'}; color:${isPaid ? '#22c55e' : '#f59e0b'}; padding:2px 6px; border-radius:6px; font-weight:bold;">
                        ${isPaid ? 'Google Pay OK' : 'Pendiente Pago'}
                    </span>
                </div>
                <div style="font-size:0.85rem; font-weight:bold; color:var(--wa-text-primary); margin-bottom:2px;">${card.concept}</div>
                <div style="font-size:0.95rem; font-weight:900; color:#38bdf8; margin-bottom:4px;">$${card.total.toFixed(2)} USD</div>
                <div style="font-size:0.7rem; color:var(--wa-text-secondary); margin-bottom:8px;">
                    ${isPickup ? '🏪 Retiro en Local ($0 Envío)' : '🚚 Envío Courier (+$' + card.shippingFee.toFixed(2) + ')'}
                </div>
                ${!isPaid ? `
                    <button class="btn-wa-primary" style="width:100%; font-size:0.8rem; padding:8px; display:flex; align-items:center; justify-content:center; gap:6px; background:#ffffff; color:#0f172a; border:none; font-weight:900;" onclick="handlePayMerchantInvoice('${card.id}', ${card.total}, '${card.concept.replace(/'/g, "\\'")}', '${card.deliveryMode}')">
                        <span style="font-weight:900; background:linear-gradient(90deg, #4285F4, #EA4335, #FBBC05, #34A853); -webkit-background-clip:text; -webkit-text-fill-color:transparent; font-size:0.95rem;">GPay</span>
                        <span>Pagar $${card.total.toFixed(2)} USD</span>
                    </button>
                ` : `
                    <button class="btn-wa-secondary" style="width:100%; font-size:0.75rem; padding:5px;" onclick="openEscrowModal()">
                        🔍 Ver QR & Estado Escrow
                    </button>
                `}
            </div>
        `;
    } else if (card.type === 'voice_note') {
        return `
            <div class="voice-note-bubble-card">
                <button class="voice-play-btn" id="btnPlayVoice_${card.id}" onclick="handlePlayVoiceNote('${card.id}')">
                    <i class="bi bi-play-fill"></i>
                </button>
                <div class="voice-wave-bar-container">
                    <div class="voice-waveform-visualizer">
                        <div class="voice-wave-bar active" style="height:60%;"></div>
                        <div class="voice-wave-bar active" style="height:90%;"></div>
                        <div class="voice-wave-bar active" style="height:40%;"></div>
                        <div class="voice-wave-bar active" style="height:80%;"></div>
                        <div class="voice-wave-bar" style="height:50%;"></div>
                        <div class="voice-wave-bar" style="height:30%;"></div>
                        <div class="voice-wave-bar" style="height:70%;"></div>
                    </div>
                    <div style="font-size:0.72rem; color:var(--wa-text-secondary); display:flex; justify-content:space-between; align-items:center;">
                        <span>🎤 Nota de voz (${card.durationStr || '00:04'})</span>
                        <button onclick="transcribeVoiceNote('${card.id}')" title="Transcribir" style="background:none; border:none; color:var(--wa-green); cursor:pointer; font-size:0.72rem; padding:0 4px;">📝</button>
                    </div>
                    <div id="vnText_${card.id}" style="font-size:0.75rem; color:var(--wa-text-primary); margin-top:4px;"></div>
                </div>
            </div>
        `;
    }
    return '';
}

/* ==========================================================================
   7. SEND MESSAGES & LOCAL AI AUTO-REPLY INTERCEPTOR
   ========================================================================== */
function initMessageInput() {
    const btnSend = document.getElementById('mSendBtn');
    const inputEl = document.getElementById('mTextInput');

    if (btnSend && inputEl) {
        btnSend.addEventListener('click', () => sendMessage());
        inputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
}

function sendMessage(textOverride = null) {
    const inputEl = document.getElementById('mTextInput');
    const text = textOverride || (inputEl ? inputEl.value.trim() : '');

    if (!text) return;

    if (inputEl) inputEl.value = '';

    // Contacto REAL (P2P/relay) o AGENTE (flujo): guardar local + enrutar.
    const activeContact = CONTACTS_DATA[currentChatId];
    if (activeContact && activeContact.isReal) {
        const cid = currentChatId;
        const msg = {
            id: 'm_' + Date.now(),
            sender: window.MY_PEER_ID,
            text: text,
            timestamp: new Date().toISOString()
        };
        window.buyerStorage.appendChatMessage(cid, msg);
        renderMobileMessages();
        renderMobileChatList();

        // ¿Es un AGENTE (tienda/asistente con flujo)? → routing worker/móvil.
        if (typeof cid === 'string' && cid.indexOf('agent_') === 0 && window.BBQFlowRunner) {
            window.BBQFlowRunner.isWorkerOnline(cid).then(online => {
                if (online && window.BBQNet) {
                    // El worker de PC atiende y responde.
                    window.BBQNet.send(cid, { type: 'chat', message: msg });
                } else {
                    // El teléfono corre el MISMO flujo localmente (on-device / API).
                    if (window.bbqToast) window.bbqToast('🤖 El agente responde desde el teléfono…');
                    window.BBQFlowRunner.runAgentLocally(cid, text, (replyText) => {
                        const inMsg = { id: 'ag_' + Date.now(), sender: cid, text: replyText, timestamp: new Date().toISOString() };
                        window.buyerStorage.appendChatMessage(cid, inMsg);
                        if (currentChatId === cid) renderMobileMessages();
                        renderMobileChatList();
                    });
                }
            });
            hideAttachPopup();
            return;
        }

        // Contacto humano normal.
        if (window.BBQNet) {
            window.BBQNet.send(cid, { type: 'chat', message: msg }).then(r => {
                if (!r.ok && window.bbqToast) window.bbqToast('⚠️ No entregado (contacto offline)');
            });
        }
        hideAttachPopup();
        return;
    }

    window.buyerNode.sendDirectMessage(currentChatId, text);
    renderMobileMessages();
    renderMobileChatList();

    if (currentChatId === 'p2p_ai_assistant' || CONTACTS_DATA[currentChatId]?.isStore || CONTACTS_DATA[currentChatId]?.isAi) {
        triggerAiReply(text, currentChatId);
    }

    hideAttachPopup();
}

// Respuesta de IA: usa el orquestador (real si hay API/Ollama configurado; si no,
// asistente local por reglas). Fix BUG-3: se guarda en el chat ACTUAL, no en 'p2p_buyer_7721'.
async function triggerAiReply(text, chatId) {
    try {
        const res = await window.merchantAiOrchestrator.processIncomingMessage(text, window.MY_PEER_ID || 'me');
        const replyText = (res && res.replyText) ? res.replyText : 'No pude generar una respuesta.';
        window.buyerStorage.appendChatMessage(chatId, {
            id: 'ai_' + Date.now(),
            sender: chatId,
            text: replyText,
            isAiGenerated: true,
            timestamp: new Date().toISOString()
        });
        if (currentChatId === chatId) renderMobileMessages();
        renderMobileChatList();
    } catch (e) {
        console.error('[AI] Error generando respuesta:', e);
    }
}

/* ==========================================================================
   8. ATTACHMENT POPUP (📎)
   ========================================================================== */
function initAttachmentPopup() {
    const btnAttach = document.getElementById('mBtnAttach');
    const popup = document.getElementById('mAttachPopup');

    if (btnAttach && popup) {
        btnAttach.addEventListener('click', (e) => {
            e.stopPropagation();
            popup.style.display = popup.style.display === 'none' ? 'grid' : 'none';
        });
    }

    document.addEventListener('click', () => hideAttachPopup());
}

function hideAttachPopup() {
    const popup = document.getElementById('mAttachPopup');
    if (popup) popup.style.display = 'none';
}

/* --- ADJUNTOS REALES (imágenes y documentos) --- */
const bbqAttURLs = {}; // id -> objectURL/dataURL en memoria

function pickAttachment(kind) {
    hideAttachPopup();
    if (!currentChatId || !CONTACTS_DATA[currentChatId]) { if (window.bbqToast) window.bbqToast('Abrí el chat de un contacto'); return; }
    const input = document.createElement('input');
    input.type = 'file';
    if (kind === 'image') input.accept = 'image/*';
    input.style.display = 'none';
    input.onchange = (e) => { const f = e.target.files[0]; if (f) handleAttachmentFile(f); if (input.parentNode) document.body.removeChild(input); };
    document.body.appendChild(input);
    input.click();
}

async function handleAttachmentFile(file) {
    const chatId = currentChatId;
    const contact = CONTACTS_DATA[chatId];
    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();
    reader.onload = async (e) => {
        let dataUrl = e.target.result;
        if (isImage) dataUrl = await compressDataURL(dataUrl, 1080, 0.7);
        const attId = 'att_' + Date.now();
        // El archivo va a IndexedDB (no a localStorage, que reventaría por tamaño).
        try { const blob = await (await fetch(dataUrl)).blob(); await window.BBQDB.set('messages', attId, blob); } catch (err) {}
        bbqAttURLs[attId] = dataUrl;
        const card = isImage
            ? { type: 'image', id: attId }
            : { type: 'file', id: attId, name: file.name, size: file.size, mime: file.type };
        const msg = {
            id: 'msg_' + Date.now(),
            sender: window.MY_PEER_ID || 'me',
            text: isImage ? '📷 Foto' : ('📄 ' + file.name),
            timestamp: new Date().toISOString(),
            payloadCard: card
        };
        window.buyerStorage.appendChatMessage(chatId, msg);
        renderMobileMessages();
        renderMobileChatList();
        // Enviar P2P (bytes en base64) al contacto real.
        if (contact && contact.isReal && window.BBQNet) {
            if (dataUrl.length > 1200000) {
                if (window.bbqToast) window.bbqToast('Archivo muy grande para enviar por P2P');
            } else {
                window.BBQNet.send(chatId, { type: 'attachment', message: msg, data: dataUrl }).then(r => {
                    if (!r.ok && window.bbqToast) window.bbqToast('⚠️ No entregado (contacto offline)');
                });
            }
        }
    };
    reader.readAsDataURL(file);
}

// Carga (async) las imágenes/archivos desde IndexedDB en los mensajes ya renderizados.
async function hydrateAttachments() {
    const els = document.querySelectorAll('[data-att]:not([data-att-loaded])');
    for (const el of els) {
        const id = el.getAttribute('data-att');
        el.setAttribute('data-att-loaded', '1');
        let url = bbqAttURLs[id];
        if (!url) {
            try { const blob = await window.BBQDB.get('messages', id); if (blob) { url = URL.createObjectURL(blob); bbqAttURLs[id] = url; } } catch (e) {}
        }
        if (url && el.tagName === 'IMG') el.src = url;
    }
}

function openImageAttachment(id) {
    const show = (u) => {
        let ov = document.getElementById('bbqImgOverlay');
        if (!ov) { ov = document.createElement('div'); ov.id = 'bbqImgOverlay'; ov.onclick = () => ov.remove(); document.body.appendChild(ov); }
        ov.style.cssText = 'position:fixed;inset:0;z-index:260000;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;';
        ov.innerHTML = `<img src="${u}" style="max-width:95%;max-height:95%;border-radius:8px;">`;
    };
    if (bbqAttURLs[id]) return show(bbqAttURLs[id]);
    window.BBQDB.get('messages', id).then(blob => { if (blob) { const u = URL.createObjectURL(blob); bbqAttURLs[id] = u; show(u); } });
}

function downloadAttachment(id, name) {
    const trigger = (u) => { const a = document.createElement('a'); a.href = u; a.download = name || 'archivo'; document.body.appendChild(a); a.click(); a.remove(); };
    if (bbqAttURLs[id]) return trigger(bbqAttURLs[id]);
    window.BBQDB.get('messages', id).then(blob => { if (blob) { const u = URL.createObjectURL(blob); bbqAttURLs[id] = u; trigger(u); } });
}

/* ==========================================================================
   9. HANDLERS FOR STORE MANAGER, UNIVERSAL AI SETUP & ACCESS LEVELS
   ========================================================================== */
function handleSaveProfile() {
    const name = document.getElementById('profileInputName').value;
    const phone = document.getElementById('profileInputPhone').value;

    const profile = window.buyerStorage.getUserProfile();
    profile.name = name;
    profile.phone = phone;
    if (currentSelectedProfileImageBase64) {
        profile.avatar = currentSelectedProfileImageBase64;
    }

    const saved = window.buyerStorage.saveUserProfile(profile);

    // Sincronizar con la identidad real del dispositivo (nombre/teléfono del directorio P2P).
    if (window.BBQIdentity) {
        window.BBQIdentity.setLabels(phone, name)
            .then(() => window.BBQIdentity.registerInDirectory())
            .catch(() => {});
    }

    updateVerificationBadge(profile);
    initInstagramStoriesBar();

    if (saved !== false) {
        if (window.bbqToast) window.bbqToast('✅ Perfil actualizado'); else alert('✅ Perfil actualizado');
        closeModals();
    }
}

// Comprime una imagen (dataURL) a un thumbnail para que quepa en el almacenamiento local
// y evite el QuotaExceededError que rompía el guardado de foto de perfil y estados.
function compressDataURL(dataURL, maxDim = 512, quality = 0.8) {
    return new Promise((resolve) => {
        try {
            const img = new Image();
            img.onload = () => {
                let w = img.width, h = img.height;
                if (w >= h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
                else if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => resolve(dataURL);
            img.src = dataURL;
        } catch (e) { resolve(dataURL); }
    });
}

function loadProfileData() {
    const p = window.buyerStorage.getUserProfile();
    if (p) {
        if (document.getElementById('profileInputName')) document.getElementById('profileInputName').value = p.name || '';
        if (document.getElementById('profileInputPhone')) document.getElementById('profileInputPhone').value = p.phone || '';

        const avatarDisplay = document.getElementById('profileAvatarDisplay');
        if (avatarDisplay) {
            if (p.avatar && p.avatar.startsWith('data:image')) {
                avatarDisplay.innerHTML = `<img src="${p.avatar}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            } else {
                avatarDisplay.textContent = p.avatar || '👤';
            }
        }
        updateVerificationBadge(p);
    }
}

function handleSaveStore() {
    const name = document.getElementById('storeInputName').value;
    const category = document.getElementById('storeInputCategory').value;
    const courierPartner = document.getElementById('storeInputCourierPartner').value;
    const region = document.getElementById('storeInputRegion').value;

    const prodName = document.getElementById('prodInputName').value;
    const prodImage = document.getElementById('prodInputImage').value || '📦';
    const prodDesc = document.getElementById('prodInputDesc').value || 'Producto disponible en catálogo P2P local.';
    const prodPrice = parseFloat(document.getElementById('prodInputPrice').value || '100.00');
    const prodShip = parseFloat(document.getElementById('prodInputShipping').value || '15.00');
    const prodStock = parseInt(document.getElementById('prodInputStock').value || '12', 10);

    const storeId = `p2p_store_${Date.now()}`;
    const store = {
        id: storeId,
        name: name,
        category: category,
        courierPartner: courierPartner,
        region: region,
        icon: '🏬',
        products: []
    };

    if (prodName && prodPrice > 0) {
        const newProd = {
            id: `prod_${Date.now()}`,
            name: prodName,
            image: prodImage,
            description: prodDesc,
            price: prodPrice,
            shippingFee: prodShip,
            stock: prodStock,
            category: category,
            courierPartner: courierPartner
        };
        window.merchantStorage.saveProduct(newProd);
        store.products.push(newProd);
    }

    window.merchantStorage.saveUserStore(store);

    CONTACTS_DATA[storeId] = {
        name: `${name} 🏬`,
        avatar: '🏬',
        status: `⚡ IA Activa | Courier: ${courierPartner}`,
        isStore: true
    };

    renderMobileChatList();

    alert(`🎉 ¡TIENDA CREADA CON COURIER E IMÁGENES INTEGRADAS!\n\n` +
          `Nombre: ${name}\n` +
          `Courier Vinculado: ${courierPartner}\n` +
          (prodName ? `Producto: ${prodName} ($${prodPrice.toFixed(2)} USD)\nDescripción: ${prodDesc.substring(0, 35)}...` : ''));

    closeModals();
    selectMobileChat(storeId);
}

function loadStoreData() {
    const s = window.merchantStorage.getUserStore();
    if (s && document.getElementById('storeInputName')) {
        document.getElementById('storeInputName').value = s.name || 'TechZone Store';
        if (s.courierPartner && document.getElementById('storeInputCourierPartner')) {
            document.getElementById('storeInputCourierPartner').value = s.courierPartner;
        }
    }
}

function handleSaveAiSetup() {
    const engine = document.getElementById('aiSelectEngine').value;
    const accessLevel = parseInt(document.getElementById('aiSelectAccessLevel').value || '3', 10);
    const apiKey = document.getElementById('aiInputApiKey').value;
    const endpointUrl = document.getElementById('aiInputEndpointUrl').value;
    const prompt = document.getElementById('aiInputPrompt').value;
    const autoReply = document.getElementById('aiCheckAutoReply').checked;

    const config = { engine, accessLevel, apiKey, endpointUrl, systemPrompt: prompt, autoReplyEnabled: autoReply };
    window.merchantStorage.saveAiConfig(config);

    const engineMap = {
        'gemini_api': 'Google Gemini 1.5',
        'openai_api': 'OpenAI GPT-4o / ChatGPT',
        'claude_api': 'Anthropic Claude 3.5 Sonnet',
        'deepseek_api': 'DeepSeek V3 / R1',
        'ollama_local': 'Ollama Local Endpoint',
        'wasm_local': 'IA In-App Local (WASM Offline)',
        'custom_api': 'API REST Personalizada'
    };

    const levelDescriptions = {
        1: '🔒 Nivel 1: Solo Lectura de Consultas Públicas',
        2: '📊 Nivel 2: Asistente de Ventas & Catálogo',
        3: '⚡ Nivel 3: Gestión Autónoma de Pedidos & Escrow',
        4: '🔑 Nivel 4: Administrador Total de Tienda'
    };

    alert(`⚡ ¡CONFIGURACIÓN DE IA & PERMISOS GUARDADOS!\n\n` +
          `Motor Seleccionado: ${engineMap[engine] || engine}\n` +
          `Permisos Asignados: ${levelDescriptions[accessLevel]}\n` +
          `Estado de Respuesta Autónoma: ${autoReply ? 'ACTIVADA ✅' : 'PAUSADA ⏸️'}\n\n` +
          `Cortafuegos de Privacidad configurado exitosamente.`);

    closeModals();
}

function loadAiSetupData() {
    const c = window.merchantStorage.getAiConfig();
    if (c) {
        if (document.getElementById('aiSelectEngine')) document.getElementById('aiSelectEngine').value = c.engine || 'gemini_api';
        if (document.getElementById('aiSelectAccessLevel')) document.getElementById('aiSelectAccessLevel').value = c.accessLevel || '3';
        if (document.getElementById('aiInputApiKey')) document.getElementById('aiInputApiKey').value = c.apiKey || '';
        if (document.getElementById('aiInputEndpointUrl')) document.getElementById('aiInputEndpointUrl').value = c.endpointUrl || 'http://localhost:11434';
        if (document.getElementById('aiInputPrompt')) document.getElementById('aiInputPrompt').value = c.systemPrompt || '';
        if (document.getElementById('aiCheckAutoReply')) document.getElementById('aiCheckAutoReply').checked = c.autoReplyEnabled !== false;

        const val = c.engine || 'gemini_api';
        const isApiKeyNeeded = (val === 'gemini_api' || val === 'openai_api' || val === 'claude_api' || val === 'deepseek_api');
        const isEndpointNeeded = (val === 'ollama_local' || val === 'custom_api');

        if (document.getElementById('groupApiKey')) document.getElementById('groupApiKey').style.display = isApiKeyNeeded ? 'block' : 'none';
        if (document.getElementById('groupEndpointUrl')) document.getElementById('groupEndpointUrl').style.display = isEndpointNeeded ? 'block' : 'none';
    }
}

/* ==========================================================================
   10. MODALS, CATALOG WITH STORE PICKUP ($0 SHIPPING) & AUTOMATIONS
   ========================================================================== */
function initModals() {
    const btnScanCourier = document.getElementById('btnModalScanCourier');
    const btnScanMerchant = document.getElementById('btnModalScanMerchant');
    const btnRefund = document.getElementById('btnModalTimeoutRefund');
    const btnInv5 = document.getElementById('btnModalInvite5');

    if (btnScanCourier) {
        btnScanCourier.addEventListener('click', () => {
            const escrow = window.escrowEngine.currentEscrow;
            const res = window.escrowEngine.verifyAndSettleScan(escrow.secretNonceKr, 'courier');
            if (res.success) {
                alert(`✅ ¡ENTREGA POR COURIER VERIFICADA!\n\n` +
                      `• Acreditado a Tienda: $${res.merchantPayout.toFixed(2)} USD\n` +
                      `• Acreditado a Courier: $${res.courierPayout.toFixed(2)} USD`);

                sendMessage('✅ [COURIER] Paquete entregado y verificado por QR. Fondos liquidados a la Tienda y al Repartidor.');
                closeModals();
            }
        });
    }

    if (btnScanMerchant) {
        btnScanMerchant.addEventListener('click', () => {
            const escrow = window.escrowEngine.currentEscrow;
            const res = window.escrowEngine.verifyAndSettleScan(escrow.secretNonceKr, 'merchant');
            if (res.success) {
                alert(`🏪 ¡RETIRO EN TIENDA VERIFICADO DIRECTAMENTE POR EL VENDEDOR!\n\n` +
                      `Criptografía: Secreto Kr escaneado por el comerciante en su local.\n` +
                      `• Acreditado a Tienda: $${res.merchantPayout.toFixed(2)} USD (100% de la venta)\n` +
                      `• Costo de Envío: $0.00 (Gratis en Local)`);

                sendMessage('🏪 [RETIRO EN LOCAL] El comprador retiró el producto en la tienda. El vendedor escaneó el QR y acreditó el 100% del pago.');
                closeModals();
            }
        });
    }

    if (btnRefund) {
        btnRefund.addEventListener('click', () => {
            const res = window.escrowEngine.simulateRefundTimeout();
            if (res.success) {
                alert('⏳ Tiempo expirado. Retención liberada y devuelta a la tarjeta Google Wallet.');
                closeModals();
            }
        });
    }

    if (btnInv5) {
        btnInv5.addEventListener('click', () => {
            for(let i=0; i<5; i++) window.referralEngine.addReferral();
            renderReferralsModal();
        });
    }
}

// Fix BUG-1: openEscrowModal se llamaba en 7 lugares pero nunca estaba definida.
// El modal de escrow se abre y renderiza vía openModal('modalEscrow').
function openEscrowModal() {
    openModal('modalEscrow');
}

function openModal(modalId) {
    closeModals();
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');

    if (modalId === 'modalEscrow') {
        window.escrowEngine.renderQrCode('modalQrCanvas');
        const escrow = window.escrowEngine.currentEscrow;
        const isPickup = escrow.deliveryMode === 'PICKUP';

        document.getElementById('modalEscrowAmount').textContent = `$${escrow.totalHeld.toFixed(2)} USD`;
        document.getElementById('modalKrSecret').textContent = escrow.secretNonceKr;
        
        const label = document.getElementById('modalEscrowModeLabel');
        if (label) {
            label.textContent = isPickup ? '🔒 Retención Auth & Hold (🏪 Retiro en Tienda - $0 Envío)' : '🔒 Retención Auth & Hold (🚚 Envío por Courier)';
        }
    } else if (modalId === 'modalCreateStore') {
        renderMerchantWallet();
    } else if (modalId === 'modalCreateStatus') {
        populateStatusProductsDropdowns();
        toggleStatusCreatorMode();
    } else if (modalId === 'modalStores') {
        renderStoresModal();
    } else if (modalId === 'modalReferrals') {
        renderReferralsModal();
    } else if (modalId === 'modalProfile') {
        loadProfileData();
    } else if (modalId === 'modalAiSetup') {
        loadAiSetupData();
    } else if (modalId === 'modalAutomations') {
        renderAutomationsModal();
    }
}

function closeModals() {
    document.querySelectorAll('.wa-modal-overlay').forEach(m => m.classList.remove('active'));
}

function openCatalogModal() {
    const content = document.getElementById('catalogModalContent');
    if (!content) return;

    const products = window.merchantStorage.getProducts();

    content.innerHTML = products.map(p => {
        const isImgUrl = p.image && (p.image.startsWith('http') || p.image.startsWith('data:'));
        
        return `
            <div class="wa-store-card" style="flex-direction:column; align-items:flex-start; gap:8px;">
                <div style="display:flex; gap:12px; align-items:center; width:100%;">
                    <div style="width:50px; height:50px; border-radius:10px; background:#2a3942; display:flex; align-items:center; justify-content:center; overflow:hidden; font-size:1.8rem; flex-shrink:0;">
                        ${isImgUrl ? `<img src="${p.image}" style="width:100%; height:100%; object-fit:cover;">` : (p.image || '📦')}
                    </div>
                    <div style="flex:1;">
                        <h4 style="font-size:0.95rem; margin-bottom:2px;">${p.name}</h4>
                        <div style="font-size:0.85rem; color:var(--wa-green); font-weight:bold;">$${p.price.toFixed(2)} USD</div>
                        <div style="font-size:0.72rem; color:var(--wa-text-secondary);">Stock: ${p.stock} unidades</div>
                    </div>
                </div>

                <div style="font-size:0.78rem; color:var(--wa-text-secondary); background:rgba(0,0,0,0.2); padding:6px 10px; border-radius:6px; width:100%;">
                    ${p.description || 'Producto disponible con catálogo autónomo P2P.'}
                </div>

                <div style="display:flex; gap:8px; width:100%; margin-top:4px;">
                    <button class="btn-wa-primary" style="flex:1; font-size:0.75rem; padding:6px 8px;" onclick="openProductCheckoutModal('${p.id}', 'COURIER')">
                        🚚 Comprar (Courier)
                    </button>
                    <button class="btn-wa-primary" style="flex:1; font-size:0.75rem; padding:6px 8px; background:#8b5cf6;" onclick="openProductCheckoutModal('${p.id}', 'PICKUP')">
                        🏪 Comprar (Retiro $0)
                    </button>
                </div>
            </div>
        `;
    }).join('');

    openModal('modalCatalog');
}

let currentCheckoutProduct = null;

function openProductCheckoutModal(productId, defaultDeliveryMode = 'COURIER') {
    const products = window.merchantStorage.getProducts();
    let product = products.find(p => p.id === productId);

    if (!product) {
        product = {
            id: productId || 'prod_hi_fi',
            name: 'Auriculares Wireless Hi-Fi Pro',
            price: 100.00,
            shippingFee: 15.00,
            stock: 12,
            image: '🎧'
        };
    }

    currentCheckoutProduct = product;

    const imgEl = document.getElementById('checkoutProdImage');
    const nameEl = document.getElementById('checkoutProdName');
    const priceEl = document.getElementById('checkoutProdPrice');
    const stockEl = document.getElementById('checkoutProdStock');
    const modeSelect = document.getElementById('checkoutDeliveryModeSelect');

    if (imgEl) {
        const isImgUrl = product.image && (product.image.startsWith('http') || product.image.startsWith('data:'));
        imgEl.innerHTML = isImgUrl ? `<img src="${product.image}" style="width:100%; height:100%; object-fit:cover;">` : (product.image || '📦');
    }
    if (nameEl) nameEl.textContent = product.name;
    if (priceEl) priceEl.textContent = `$${product.price.toFixed(2)} USD`;
    if (stockEl) stockEl.textContent = `Stock: ${product.stock || 10} unidades disponibles`;
    if (modeSelect) modeSelect.value = defaultDeliveryMode;

    updateCheckoutTotalSummary();
    openModal('modalProductCheckout');
}

function openProductCheckoutModalFromLive() {
    const pinned = window.p2pLiveEngine ? window.p2pLiveEngine.pinnedProduct : null;
    const prodId = pinned ? pinned.id : 'prod_hi_fi';
    openProductCheckoutModal(prodId, 'COURIER');
}

function updateCheckoutTotalSummary() {
    if (!currentCheckoutProduct) return;

    const modeSelect = document.getElementById('checkoutDeliveryModeSelect');
    const deliveryMode = modeSelect ? modeSelect.value : 'COURIER';
    const isPickup = deliveryMode === 'PICKUP';

    const subtotal = currentCheckoutProduct.price;
    const shippingFee = isPickup ? 0.00 : (currentCheckoutProduct.shippingFee || 15.00);
    const totalHeld = subtotal + shippingFee;

    const subEl = document.getElementById('summaryProdSubtotal');
    const shipEl = document.getElementById('summaryShippingFee');
    const totalEl = document.getElementById('summaryTotalHeld');
    const btnEl = document.getElementById('btnConfirmProductCheckout');

    if (subEl) subEl.textContent = `$${subtotal.toFixed(2)} USD`;
    if (shipEl) shipEl.textContent = isPickup ? '$0.00 USD (Gratis en Local)' : `$${shippingFee.toFixed(2)} USD`;
    if (totalEl) totalEl.textContent = `$${totalHeld.toFixed(2)} USD`;
    if (btnEl) {
        btnEl.innerHTML = `<span style="font-weight:900; background:linear-gradient(90deg, #4285F4, #EA4335, #FBBC05, #34A853); -webkit-background-clip:text; -webkit-text-fill-color:transparent; font-size:1.1rem;">GPay</span> <span>Pagar $${totalHeld.toFixed(2)} USD & Crear QR Escrow</span>`;
    }
}

async function executeProductCheckoutPayment() {
    if (!currentCheckoutProduct) return;

    const modeSelect = document.getElementById('checkoutDeliveryModeSelect');
    const deliveryMode = modeSelect ? modeSelect.value : 'COURIER';
    const isPickup = deliveryMode === 'PICKUP';
    const price = currentCheckoutProduct.price;
    const shippingFee = isPickup ? 0.00 : (currentCheckoutProduct.shippingFee || 15.00);
    const totalHeld = price + shippingFee;

    closeModals();

    // Trigger Google Pay Payment Sheet
    const payRes = await window.googlePayEngine.processPayment(totalHeld, `Compra: ${currentCheckoutProduct.name}`, deliveryMode);
    if (!payRes || !payRes.success) {
        showInAppNotification('⚠️ Pago Cancelado', payRes.message || 'La transacción con Google Pay no fue autorizada.');
        return;
    }

    // Create BBQ Cryptographic Dual-Phase Escrow (Auth & Hold)
    window.escrowEngine.createAuthAndHoldEscrow(price, shippingFee, deliveryMode);
    window.escrowEngine.currentEscrow.productName = currentCheckoutProduct.name;

    // Update merchant wallet pending balance
    if (window.escrowEngine.merchantWallet) {
        window.escrowEngine.merchantWallet.pendingHeld += price;
        window.escrowEngine.merchantWallet.history.unshift({
            id: 'tx_' + Date.now().toString().slice(-4),
            type: 'CHARGED_ESCROW',
            amount: totalHeld,
            description: `${currentCheckoutProduct.name} (${isPickup ? 'Retiro' : 'Courier'})`,
            status: 'HELD',
            date: new Date().toLocaleDateString()
        });
    }

    // Evaluate AI Automation Trigger
    if (window.automationEngine) {
        const autoRes = window.automationEngine.evaluateTrigger('ESCROW_PAYMENT_CREATED', { productId: currentCheckoutProduct.id, total: totalHeld, deliveryMode });
        if (autoRes.executed) {
            console.log(`⚡ [AUTOMACIÓN IA LOGRADA] ${autoRes.message}`);
        }
    }

    const msgObj = {
        id: 'msg_' + Date.now(),
        sender: 'p2p_buyer_7721',
        text: `🛒 Confirmo la compra autorizada con Google Pay para "${currentCheckoutProduct.name}" (Auth & Hold: $${totalHeld.toFixed(2)} USD).`,
        timestamp: Date.now(),
        payloadCard: {
            type: 'escrow_payment',
            productPrice: price,
            shippingFee: shippingFee,
            total: totalHeld,
            deliveryMode: deliveryMode,
            paymentMethod: 'GOOGLE_PAY'
        }
    };

    window.buyerStorage.appendChatMessage(currentChatId, msgObj);
    renderMobileMessages();
    openEscrowModal();
    showInAppNotification('✅ Pre-Autorización Google Pay OK', `Retención de $${totalHeld.toFixed(2)} USD creada en Escrow. Escanea el código QR para liberar fondos.`);
}

async function triggerEscrowPurchase(productId, price, shippingFee, deliveryMode = 'COURIER') {
    const isPickup = deliveryMode === 'PICKUP';
    const total = isPickup ? price : price + shippingFee;

    // Prompt Google Pay Sheet
    const payRes = await window.googlePayEngine.processPayment(total, `Compra Producto en Store`, deliveryMode);
    if (!payRes || !payRes.success) {
        showInAppNotification('⚠️ Pago Cancelado', payRes.message || 'La transacción con Google Pay no fue autorizada.');
        return;
    }

    window.escrowEngine.createAuthAndHoldEscrow(price, shippingFee, deliveryMode);

    if (window.escrowEngine.merchantWallet) {
        window.escrowEngine.merchantWallet.pendingHeld += price;
        window.escrowEngine.merchantWallet.history.unshift({
            id: 'tx_' + Date.now().toString().slice(-4),
            type: 'CHARGED_ESCROW',
            amount: total,
            description: `Compra en tienda (${isPickup ? 'Retiro' : 'Courier'})`,
            status: 'HELD',
            date: new Date().toLocaleDateString()
        });
    }

    // Evaluate AI Automation Trigger
    if (window.automationEngine) {
        const autoRes = window.automationEngine.evaluateTrigger('ESCROW_PAYMENT_CREATED', { productId, total, deliveryMode });
        if (autoRes.executed) {
            console.log(`⚡ [AUTOMACIÓN IA LOGRADA] ${autoRes.message}`);
        }
    }

    const msgObj = {
        id: 'msg_' + Date.now(),
        sender: 'p2p_buyer_7721',
        text: `🛒 Confirmo la compra autorizada con Google Pay (Auth & Hold: $${total.toFixed(2)} USD).`,
        timestamp: Date.now(),
        payloadCard: {
            type: 'escrow_payment',
            productPrice: price,
            shippingFee: shippingFee,
            total: total,
            deliveryMode: deliveryMode,
            paymentMethod: 'GOOGLE_PAY'
        }
    };

    window.buyerStorage.appendChatMessage(currentChatId, msgObj);
    renderMobileMessages();
    openEscrowModal();
    showInAppNotification('✅ Google Pay Autorizado', `Pre-autorización de $${total.toFixed(2)} USD retenida en Escrow.`);
}

function renderMerchantWallet() {
    if (!window.escrowEngine) return;
    const wallet = window.escrowEngine.getMerchantWallet();
    const heldEl = document.getElementById('storeWalletHeld');
    const availEl = document.getElementById('storeWalletAvailable');
    if (heldEl) heldEl.textContent = `$${wallet.pendingHeld.toFixed(2)} USD`;
    if (availEl) availEl.textContent = `$${wallet.settledAvailable.toFixed(2)} USD`;
}

function handleWithdrawMerchantWallet() {
    if (!window.escrowEngine) return;
    const res = window.escrowEngine.withdrawMerchantBalance();
    if (res.success) {
        showInAppNotification('💰 Retiro Exitoso', `Se transfirieron $${res.amount.toFixed(2)} USD a tu cuenta vinculada en Google Wallet.`);
        renderMerchantWallet();
    } else {
        showInAppNotification('⚠️ Fondo Insuficiente', res.message);
    }
}

function openMerchantChargeModal() {
    closeModals();
    openModal('modalMerchantCharge');
}

function handleSendMerchantCharge() {
    const conceptInput = document.getElementById('chargeInputConcept');
    const amountInput = document.getElementById('chargeInputAmount');
    const shippingInput = document.getElementById('chargeInputShipping');
    const deliveryInput = document.getElementById('chargeInputDelivery');

    if (!conceptInput || !amountInput) return;

    const concept = conceptInput.value.trim() || 'Servicio / Producto Tienda';
    const amount = parseFloat(amountInput.value) || 0;
    const shippingFee = parseFloat(shippingInput.value) || 0;
    const deliveryMode = deliveryInput ? deliveryInput.value : 'PICKUP';
    const isPickup = deliveryMode === 'PICKUP';
    const total = isPickup ? amount : amount + shippingFee;

    if (total <= 0) {
        showInAppNotification('⚠️ Monto Inválido', 'Ingrese un monto mayor a $0 USD.');
        return;
    }

    const invoiceId = 'inv_' + Date.now();
    const msgObj = {
        id: 'msg_' + Date.now(),
        sender: 'p2p_store_techzone',
        text: `🧾 Solicitud de Cobro emitida por TechZone Store 🏬: ${concept} ($${total.toFixed(2)} USD).`,
        timestamp: Date.now(),
        payloadCard: {
            id: invoiceId,
            type: 'merchant_charge_request',
            concept: concept,
            amount: amount,
            shippingFee: shippingFee,
            total: total,
            deliveryMode: deliveryMode,
            status: 'PENDING'
        }
    };

    window.buyerStorage.appendChatMessage(currentChatId, msgObj);
    renderMobileMessages();
    closeModals();
    showInAppNotification('🧾 Factura Enviada', `Solicitud de cobro enviada al chat por $${total.toFixed(2)} USD.`);
}

async function handlePayMerchantInvoice(invoiceId, totalAmount, concept, deliveryMode) {
    const payRes = await window.googlePayEngine.processPayment(totalAmount, concept, deliveryMode);
    if (!payRes || !payRes.success) {
        showInAppNotification('⚠️ Pago Cancelado', payRes.message || 'La transacción con Google Pay no fue autorizada.');
        return;
    }

    const isPickup = deliveryMode === 'PICKUP';
    const productPrice = isPickup ? totalAmount : Math.max(0, totalAmount - 15);
    const shippingFee = isPickup ? 0 : 15;

    window.escrowEngine.createAuthAndHoldEscrow(productPrice, shippingFee, deliveryMode);

    if (window.escrowEngine.merchantWallet) {
        window.escrowEngine.merchantWallet.pendingHeld += productPrice;
        window.escrowEngine.merchantWallet.history.unshift({
            id: 'tx_' + Date.now().toString().slice(-4),
            type: 'CHARGED_ESCROW',
            amount: totalAmount,
            description: `${concept} (Cobro Directo Google Pay)`,
            status: 'HELD',
            date: new Date().toLocaleDateString()
        });
    }

    const db = window.buyerStorage.getDatabase();
    const chat = db.chats.find(c => c.contactId === currentChatId);
    const messages = chat ? chat.messages : [];
    const msgIndex = messages.findIndex(m => m.payloadCard && m.payloadCard.id === invoiceId);
    if (msgIndex !== -1) {
        messages[msgIndex].payloadCard.status = 'PAID';
        window.buyerStorage.saveDatabase(db);
    }

    renderMobileMessages();
    openEscrowModal();
    showInAppNotification('✅ Pago con Google Pay OK', `Se pre-autorizaron $${totalAmount.toFixed(2)} USD en Escrow.`);
}

function renderStoresModal() {
    const list = document.getElementById('storesModalList');
    if (!list) return;

    const stores = [
        { id: 'p2p_store_techzone', name: 'TechZone Store 🏬', category: 'Electrónica & Audio', region: 'Zona Metro Sur', icon: '🏬' },
        { id: 'p2p_courier_express', name: 'Express Courier P2P 🚚', category: 'Servicio de Logística', region: 'Zona Metro Sur', icon: '🚚' },
        { id: 'p2p_store_ecobike', name: 'EcoBike Delivery 🚲', category: 'Reparto Sustentable', region: 'Zona Centro', icon: '🚲' }
    ];

    list.innerHTML = stores.map(s => `
        <div class="wa-store-card">
            <div style="display:flex; gap:10px; align-items:center;">
                <div style="font-size:1.6rem;">${s.icon}</div>
                <div>
                    <h4 style="font-size:0.9rem;">${s.name}</h4>
                    <span style="font-size:0.72rem; color:var(--wa-text-secondary);">${s.category} • ${s.region}</span>
                </div>
            </div>
            <button class="btn-wa-primary" style="padding:4px 10px; font-size:0.75rem;" onclick="selectMobileChat('${s.id}'); closeModals();">
                💬 Chat
            </button>
        </div>
    `).join('');
}

function renderReferralsModal() {
    const state = window.referralEngine.getState();
    const countEl = document.getElementById('modalReferralCount');
    const barEl = document.getElementById('modalReferralProgressBar');
    const rewardsList = document.getElementById('modalRewardsList');

    if (countEl) countEl.textContent = `${state.invitedCount} / 20`;
    if (barEl) {
        const pct = Math.min(100, (state.invitedCount / 20) * 100);
        barEl.style.width = `${pct}%`;
    }

    if (rewardsList) {
        const rewards = window.referralEngine.getRewards();
        rewardsList.innerHTML = rewards.map(r => `
            <div style="background:var(--wa-header-bg); border:1px solid ${r.isUnlocked ? 'var(--wa-green)' : 'var(--wa-border-light)'}; border-radius:10px; padding:8px 12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; gap:10px; align-items:center;">
                    <div style="font-size:1.4rem;">${r.icon}</div>
                    <div>
                        <div style="font-size:0.85rem; font-weight:600;">${r.title}</div>
                        <div style="font-size:0.72rem; color:var(--wa-text-secondary);">${r.storeName}</div>
                    </div>
                </div>
                <div>
                    ${r.isUnlocked ? 
                        `<button class="btn-wa-primary" style="font-size:0.72rem; padding:4px 8px;" onclick="alert('🎁 ¡Recompensa reclamada con éxito!')">🎁 Reclamar</button>` :
                        `<span style="font-size:0.72rem; color:var(--wa-accent-gold);">${r.requiredInvites} inv.</span>`
                    }
                </div>
            </div>
        `).join('');
    }
}

/* ==========================================================================
   11. SIMULATOR CONTROLS
   ========================================================================== */
function initSimulatorControls() {
    const btnToggle = document.getElementById('btnToggleFrame');
    const wrapper = document.getElementById('phoneWrapper');

    if (btnToggle && wrapper) {
        btnToggle.addEventListener('click', () => {
            wrapper.classList.toggle('fullscreen');
            btnToggle.classList.toggle('active');
            btnToggle.textContent = wrapper.classList.contains('fullscreen') ? '📱 Modo Pantalla Completa' : '📱 Modo Marco';
        });
    }

    const roleChips = document.querySelectorAll('.role-chip');
    roleChips.forEach(chip => {
        chip.addEventListener('click', () => {
            roleChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            currentRole = chip.dataset.role;
            if (currentRole === 'merchant') {
                selectMobileChat('p2p_contact_juan');
                alert('🏬 Cambiado a terminal Tienda: Chateando con Comprador.');
            } else if (currentRole === 'courier') {
                selectMobileChat('p2p_store_techzone');
                alert('🚚 Cambiado a terminal Repartidor: Listo para escanear QR de entregas.');
            } else {
                selectMobileChat('p2p_store_techzone');
            }
        });
    });
}

let currentActiveTab = 'chats';

function switchMobileTab(tabName) {
    currentActiveTab = tabName;
    document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    const chatsSection = document.getElementById('viewChatsSection');
    const updatesSection = document.getElementById('viewUpdatesSection');
    const storesSection = document.getElementById('viewStoresSection');
    const callsSection = document.getElementById('viewCallsSection');
    const communitySection = document.getElementById('viewCommunitySection');

    // Hide all views
    if (chatsSection) chatsSection.style.display = 'none';
    if (updatesSection) updatesSection.style.display = 'none';
    if (storesSection) storesSection.style.display = 'none';
    if (callsSection) callsSection.style.display = 'none';
    if (communitySection) communitySection.style.display = 'none';

    // Highlight bottom nav icon
    const activeBottomNav = document.getElementById(`navBtn${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    if (activeBottomNav) activeBottomNav.classList.add('active');

    // Update single active tab badge in sub-header top-nav-tabs
    const selectedTabBadge = document.getElementById('currentSelectedTabBadge');
    const badges = {
        'chats': '<i class="bi bi-chat-text-fill"></i> Chats',
        'calls': '<i class="bi bi-telephone-fill"></i> Llamadas',
        'updates': '<i class="bi bi-circle-square"></i> Estados',
        'stores': '<i class="bi bi-shop"></i> Tiendas P2P',
        'community': '<i class="bi bi-people-fill"></i> Comunidad',
        'profile': '<i class="bi bi-person-circle"></i> Perfil'
    };
    if (selectedTabBadge && badges[tabName]) {
        selectedTabBadge.innerHTML = badges[tabName];
    }

    // Switch view container
    if (tabName === 'chats') {
        if (chatsSection) chatsSection.style.display = 'block';
        renderMobileChatList();
    } else if (tabName === 'updates') {
        if (updatesSection) updatesSection.style.display = 'block';
        initInstagramStoriesFullGrid();
    } else if (tabName === 'stores') {
        if (storesSection) storesSection.style.display = 'block';
        renderStoresSection(currentStoresSubTab);
    } else if (tabName === 'calls') {
        if (callsSection) callsSection.style.display = 'block';
        renderCallsSection();
    } else if (tabName === 'community') {
        if (communitySection) communitySection.style.display = 'block';
        renderCommunitySection();
    }

    updateFabIcon(tabName);
    renderContextualFilters(tabName);
}


function renderContextualFilters(tabName) {
    const filterBar = document.getElementById('contextualFilterBar');
    if (!filterBar) return;

    let filters = [];
    if (tabName === 'chats') {
        filters = ['💬 Todos', '📩 No leídos', '🏬 Tiendas P2P', '⭐ Favoritos'];
    } else if (tabName === 'updates') {
        filters = ['🌟 Todas las historias', '🏬 Promos Tiendas', '👨‍💼 Amigos'];
    } else if (tabName === 'stores') {
        filters = ['🔥 Recientes', '🏷️ Ofertas', '🏪 Retiro $0', '🚚 Con Envíos', '🎧 Electrónica'];
    } else if (tabName === 'calls') {
        filters = ['📞 Todas', '📥 Entrantes', '📤 Salientes', '🔒 Encriptadas P2P'];
    } else if (tabName === 'community') {
        filters = ['🌐 Todas', '🏬 Comerciantes', '🚚 Logistics'];
    } else {
        filters = ['⚙️ Ajustes', '👤 Perfil'];
    }

    filterBar.innerHTML = filters.map((f, idx) => `
        <button class="filter-chip-pill ${idx === 0 ? 'active' : ''}" onclick="selectFilterChip(this, '${tabName}')">${f}</button>
    `).join('');
}

function selectFilterChip(btnEl, tabName) {
    const parent = btnEl.parentElement;
    if (parent) parent.querySelectorAll('.filter-chip-pill').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');

    const label = btnEl.textContent;
    if (tabName === 'stores' && label.includes('Recientes')) {
        switchStoresSubTab('recent');
    } else if (tabName === 'stores') {
        switchStoresSubTab('suggestions');
    }
}

/* ==========================================================================
   MARQUESINA ANIMADA DE TIENDAS & ALGORITMO DE VISITAS Y SUGERENCIAS
   ========================================================================== */
function renderStoresSection(filterMode = 'recent') {
    const container = document.getElementById('storesMainListContainer');
    if (!container) return;

    let stores = [];
    if (filterMode === 'suggestions') {
        stores = window.buyerStorage.getPersonalizedStoreSuggestions();
    } else {
        stores = window.buyerStorage.getStoresRankedByVisits();
    }

    const maxVisits = Math.max(...stores.map(s => s.visitCount || 0), 1);

    container.innerHTML = stores.map((st, idx) => {
        const isMostVisited = st.visitCount > 0 && st.visitCount >= maxVisits;
        const isSimilar = idx > 0 && stores[0] && st.category === stores[0].category;

        return `
            <div class="store-card-large">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                    <div style="display:flex; gap:12px; align-items:center;">
                        <div style="font-size:2rem; width:50px; height:50px; border-radius:50%; background:var(--wa-sidebar-bg); display:flex; align-items:center; justify-content:center; border:2px solid var(--wa-green);">${st.icon}</div>
                        <div>
                            <div class="font-inter-black" style="font-size:1rem; color:var(--wa-text-primary);">${st.name}</div>
                            <div class="font-inter-light" style="font-size:0.75rem; color:var(--wa-text-secondary);"><i class="bi bi-tag-fill"></i> Rubro: ${st.category}</div>
                        </div>
                    </div>
                    <div>
                        ${st.matchReason ? `<span class="badge-similar-store" style="background:rgba(139, 92, 246, 0.2); color:#a78bfa; border:1px solid #8b5cf6;"><i class="bi bi-magic"></i> ${st.matchReason}</span>` : ''}
                        ${isMostVisited && !st.matchReason ? `<span class="badge-most-visited"><i class="bi bi-fire"></i> MÁS VISITADA (${st.visitCount})</span>` : ''}
                        ${isSimilar && !isMostVisited && !st.matchReason ? `<span class="badge-similar-store"><i class="bi bi-diagram-3"></i> TIENDA SIMILAR</span>` : ''}
                    </div>
                </div>

                <div class="font-inter-light" style="font-size:0.8rem; color:var(--wa-text-primary); margin:6px 0;">
                    <strong>Vende:</strong> ${st.sellsText}
                </div>

                <!-- MARQUESINA ANIMADA DE PROMOCIONES DE LA TIENDA -->
                <div class="store-marquee-ticker">
                    <div class="marquee-content font-inter-black">
                        ${st.marqueeText}
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                    <span style="font-size:0.75rem; color:var(--wa-accent-gold);">${st.rating}</span>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-wa-secondary" style="font-size:0.75rem; padding:6px 12px;" onclick="openStoreCatalogFromList('${st.id}')">
                            <i class="bi bi-bag-check"></i> Ver Catálogo
                        </button>
                        <button class="btn-wa-primary" style="font-size:0.75rem; padding:6px 14px;" onclick="openStoreChatFromList('${st.id}')">
                            <i class="bi bi-chat-fill"></i> Ir al Chat P2P
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function openStoreChatFromList(storeId) {
    window.buyerStorage.recordStoreVisit(storeId);
    selectMobileChat(storeId);
    switchMobileTab('chats');
}

function openStoreCatalogFromList(storeId) {
    window.buyerStorage.recordStoreVisit(storeId);
    selectMobileChat(storeId);
    openCatalogModal();
}

/* ==========================================================================
   HISTORIAL DE BÚSQUEDAS LOCAL
   ========================================================================== */
function showSearchHistorySuggestions() {
    const historyBox = document.getElementById('searchHistoryBox');
    const chipsContainer = document.getElementById('searchHistoryChips');

    if (!historyBox || !chipsContainer) return;
    const history = window.buyerStorage.getSearchHistory();

    if (history.length === 0) {
        historyBox.style.display = 'none';
        return;
    }

    chipsContainer.innerHTML = history.map(item => `
        <span class="history-chip-item font-inter-light" onclick="useSearchSuggestion('${item}')">
            <i class="bi bi-clock"></i> ${item}
        </span>
    `).join('');

    historyBox.style.display = 'block';
}

function useSearchSuggestion(query) {
    const input = document.getElementById('mSearchInput');
    if (input) {
        input.value = query;
        handleLiveSearchFilter();
    }
}

function clearSearchHistory() {
    window.buyerStorage.clearSearchHistory();
    const historyBox = document.getElementById('searchHistoryBox');
    if (historyBox) historyBox.style.display = 'none';
}


/* ==========================================================================
   12. INSTAGRAM STORIES ENGINE (STORES & CONTACTS)
   ========================================================================== */
let currentActiveStatusObj = null;
let currentSlideIndex = 0;
let storySlideTimer = null;

function initInstagramStoriesBar() {
    const barContainer = document.getElementById('instagramStoriesHeaderBar');
    if (!barContainer) return;

    const statuses = window.buyerStorage.getStatuses();
    const userProfile = window.buyerStorage.getUserProfile();

    let html = `
        <!-- Mi Historia bubble -->
        <div class="story-item-bubble" onclick="openModal('modalCreateStatus')">
            <div class="story-avatar-container story-ring-none">
                <div class="story-avatar-img">${userProfile.avatar || '👤'}</div>
                <div class="story-add-badge">+</div>
            </div>
            <span class="story-label font-inter-light">Tu estado</span>
        </div>

    `;

    // Vivos REALES en curso (contactos que están transmitiendo ahora).
    const liveHosts = window.LIVE_HOSTS || {};
    Object.keys(liveHosts).forEach(hostId => {
        const h = liveHosts[hostId];
        const nombre = (h.hostName || 'En vivo').split(' ')[0];
        html += `
            <div class="story-item-bubble" onclick="openLiveViewer('${hostId}')">
                <div class="story-avatar-container story-ring-live">
                    <div class="story-avatar-img">📹</div>
                </div>
                <span class="story-label font-inter-black text-danger">🔴 ${nombre}</span>
            </div>
        `;
    });

    statuses.forEach(st => {
        const ringClass = st.isStore ? 'story-ring-store' : 'story-ring-contact';
        html += `
            <div class="story-item-bubble" onclick="openStatusViewer('${st.id}')">
                <div class="story-avatar-container ${ringClass}">
                    <div class="story-avatar-img">${st.authorAvatar}</div>
                </div>
                <span class="story-label font-inter-light">${st.authorName.split(' ')[0]}</span>
            </div>
        `;
    });

    barContainer.innerHTML = html;
}

function initInstagramStoriesFullGrid() {
    const gridContainer = document.getElementById('instagramStoriesFullGrid');
    if (!gridContainer) return;

    const statuses = window.buyerStorage.getStatuses();
    gridContainer.innerHTML = statuses.map(st => `
        <div class="story-card-item" onclick="openStatusViewer('${st.id}')">
            <div class="story-avatar-container ${st.isStore ? 'story-ring-store' : 'story-ring-contact'}" style="width:48px; height:48px;">
                <div class="story-avatar-img">${st.authorAvatar}</div>
            </div>
            <div>
                <div class="font-inter-black" style="font-size:0.85rem;">${st.authorName}</div>
                <div class="font-inter-light" style="font-size:0.72rem; color:var(--wa-text-secondary);">${st.slides.length} historia(s) disponible(s)</div>
            </div>
        </div>
    `).join('');
}

function openStatusViewer(statusId) {
    const statuses = window.buyerStorage.getStatuses();
    currentActiveStatusObj = statuses.find(s => s.id === statusId);
    if (!currentActiveStatusObj) return;

    currentSlideIndex = 0;
    const modal = document.getElementById('modalStatusViewer');
    if (modal) modal.style.display = 'flex';

    renderStorySlide();
}

function renderStorySlide() {
    if (!currentActiveStatusObj || !currentActiveStatusObj.slides[currentSlideIndex]) {
        closeStatusViewer();
        return;
    }

    const slide = currentActiveStatusObj.slides[currentSlideIndex];
    const totalSlides = currentActiveStatusObj.slides.length;

    // Render Progress Segments
    const progressContainer = document.getElementById('storyProgressSegments');
    if (progressContainer) {
        progressContainer.innerHTML = currentActiveStatusObj.slides.map((_, idx) => `
            <div class="story-segment-bar">
                <div class="story-segment-fill" id="storySegFill_${idx}" style="width: ${idx < currentSlideIndex ? '100%' : '0%'}"></div>
            </div>
        `).join('');
    }

    // Render Header Info
    const avatarEl = document.getElementById('storyViewerAvatar');
    const nameEl = document.getElementById('storyViewerName');
    const timeEl = document.getElementById('storyViewerTime');

    if (avatarEl) avatarEl.textContent = currentActiveStatusObj.authorAvatar;
    if (nameEl) nameEl.textContent = currentActiveStatusObj.authorName;
    if (timeEl) timeEl.textContent = formatTime(currentActiveStatusObj.timestamp);

    // Render Content Canvas
    const contentArea = document.getElementById('storyPlayerContent');
    const buyDrawer = document.getElementById('storyActionDrawer');

    if (contentArea) {
        if (slide.type === 'text') {
            contentArea.innerHTML = `
                <div class="story-text-canvas font-inter-black" style="background:${slide.bgColor || 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)'};">
                    ${slide.content}
                </div>
            `;
            if (buyDrawer) buyDrawer.style.display = 'none';
        } else {
            const iv = slide.imageUrl || '';
            let media;
            if (iv.startsWith('idb:')) {
                media = `<img data-att="${iv.slice(4)}" style="max-width:100%; max-height:60vh; border-radius:12px; margin-bottom:14px;">`;
            } else if (iv.startsWith('data:image')) {
                media = `<img src="${iv}" style="max-width:100%; max-height:60vh; border-radius:12px; margin-bottom:14px;">`;
            } else {
                media = `<div style="font-size:5rem; margin-bottom:14px;">${iv || '🎧'}</div>`;
            }
            contentArea.innerHTML = `
                <div style="text-align:center;">
                    ${media}
                    <div class="font-inter-black" style="font-size:1.3rem; color:#fff; text-shadow:0 4px 10px rgba(0,0,0,0.8);">${slide.caption}</div>
                </div>
            `;
            if (iv.startsWith('idb:') && typeof hydrateAttachments === 'function') hydrateAttachments();
            if (buyDrawer && slide.linkedProductId) {
                buyDrawer.style.display = 'block';
                const btnBuy = document.getElementById('btnStoryBuyNow');
                if (btnBuy) {
                    btnBuy.onclick = () => {
                        closeStatusViewer();
                        selectMobileChat('p2p_store_techzone');
                        openProductCheckoutModal(slide.linkedProductId, 'COURIER');
                    };
                }
            } else if (buyDrawer) {
                buyDrawer.style.display = 'none';
            }
        }
    }

    // Animate current segment fill
    if (storySlideTimer) clearInterval(storySlideTimer);
    let fillPct = 0;
    const currentFillEl = document.getElementById(`storySegFill_${currentSlideIndex}`);
    
    storySlideTimer = setInterval(() => {
        fillPct += 2;
        if (currentFillEl) currentFillEl.style.width = `${fillPct}%`;
        if (fillPct >= 100) {
            clearInterval(storySlideTimer);
            nextStorySlide();
        }
    }, 100);
}

function nextStorySlide() {
    if (!currentActiveStatusObj) return;
    if (currentSlideIndex < currentActiveStatusObj.slides.length - 1) {
        currentSlideIndex++;
        renderStorySlide();
    } else {
        closeStatusViewer();
    }
}

function prevStorySlide() {
    if (!currentActiveStatusObj) return;
    if (currentSlideIndex > 0) {
        currentSlideIndex--;
        renderStorySlide();
    }
}

function closeStatusViewer() {
    if (storySlideTimer) clearInterval(storySlideTimer);
    const modal = document.getElementById('modalStatusViewer');
    if (modal) modal.style.display = 'none';
    currentActiveStatusObj = null;
}

function sendStoryReply() {
    const replyInput = document.getElementById('storyReplyInput');
    if (!replyInput || !replyInput.value.trim() || !currentActiveStatusObj) return;

    const text = replyInput.value.trim();
    sendMessage(`Respuesta a tu historia ("${currentActiveStatusObj.authorName}"): ${text}`);
    replyInput.value = '';
    closeStatusViewer();
    alert('💬 Respuesta enviada directamente al chat P2P.');
}

function toggleStatusCreatorMode() {
    const typeSelect = document.getElementById('statusInputType');
    const textGroup = document.getElementById('statusTextGroup');
    const imgGroup = document.getElementById('statusImageGroup');

    if (typeSelect && typeSelect.value === 'text') {
        if (textGroup) textGroup.style.display = 'block';
        if (imgGroup) imgGroup.style.display = 'none';
    } else {
        if (textGroup) textGroup.style.display = 'none';
        if (imgGroup) imgGroup.style.display = 'block';
    }
}

let currentSelectedStatusImageBase64 = null;
let currentSelectedProfileImageBase64 = null;

function handleStatusPhotoSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        currentSelectedStatusImageBase64 = e.target.result;
        const previewBox = document.getElementById('statusPhotoPreviewBox');
        const previewImg = document.getElementById('statusPhotoPreviewImg');

        if (previewImg) previewImg.src = currentSelectedStatusImageBase64;
        if (previewBox) previewBox.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function handleSimulateCameraSnapshot() {
    // Generate simulated camera photo canvas DataURL
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    // Create camera lens effect background
    const grad = ctx.createRadialGradient(200, 200, 20, 200, 200, 250);
    grad.addColorStop(0, '#10b981');
    grad.addColorStop(0.5, '#047857');
    grad.addColorStop(1, '#064e3b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 400, 400);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📷 Foto en Vivo BBQ', 200, 180);
    ctx.font = '300 16px Inter, sans-serif';
    ctx.fillText(new Date().toLocaleTimeString(), 200, 220);

    currentSelectedStatusImageBase64 = canvas.toDataURL('image/jpeg');
    const previewBox = document.getElementById('statusPhotoPreviewBox');
    const previewImg = document.getElementById('statusPhotoPreviewImg');

    if (previewImg) previewImg.src = currentSelectedStatusImageBase64;
    if (previewBox) previewBox.style.display = 'block';
}

function handleProfilePhotoSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        // Comprimir a 256px para que la foto quepa en el almacenamiento local.
        currentSelectedProfileImageBase64 = await compressDataURL(e.target.result, 256, 0.8);
        const avatarDisplay = document.getElementById('profileAvatarDisplay');
        if (avatarDisplay) {
            avatarDisplay.innerHTML = `<img src="${currentSelectedProfileImageBase64}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        }
    };
    reader.readAsDataURL(file);
}

async function handlePublishStatus() {
    const typeSelect = document.getElementById('statusInputType');
    const userProfile = window.buyerStorage.getUserProfile();

    let newSlide = {};
    if (typeSelect && typeSelect.value === 'text') {
        const textVal = document.getElementById('statusInputText').value.trim();
        if (!textVal) {
            if (window.bbqToast) window.bbqToast('Ingresá un texto para tu estado'); else alert('Ingresá un texto para tu estado.');
            return;
        }
        newSlide = {
            type: 'text',
            content: textVal,
            bgColor: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)'
        };
    } else {
        let imgVal = currentSelectedStatusImageBase64 || document.getElementById('statusInputImageUrl').value.trim() || '📷';
        // Foto: comprimir y guardar en IndexedDB (referencia 'idb:<id>'), no base64 en localStorage.
        if (typeof imgVal === 'string' && imgVal.startsWith('data:image')) {
            const comp = await compressDataURL(imgVal, 1080, 0.7);
            const sid = 'status_img_' + Date.now();
            try {
                const blob = await (await fetch(comp)).blob();
                await window.BBQDB.set('messages', sid, blob);
                bbqAttURLs[sid] = comp;
                imgVal = 'idb:' + sid;
            } catch (e) {
                imgVal = comp; // respaldo: guardar el data URL comprimido
            }
        }
        const captionVal = document.getElementById('statusInputCaption').value.trim() || 'Publicación en BBQ';
        const linkProdVal = document.getElementById('statusLinkProductSelect').value;

        newSlide = {
            type: 'image',
            imageUrl: imgVal,
            caption: captionVal,
            linkedProductId: linkProdVal || null
        };
    }

    // Agrupar todos mis estados bajo un solo perfil (como WhatsApp): se agrega como slide.
    const author = {
        authorId: (window.MY_PEER_ID) || userProfile.p2pId || 'me',
        authorName: `${userProfile.name || 'Yo'} (Tú)`,
        authorAvatar: userProfile.avatar || '👤'
    };
    const saved = window.buyerStorage.addStatusSlide(author, newSlide);
    if (saved === false) return; // el toast de error ya lo mostró saveDatabase

    currentSelectedStatusImageBase64 = null;
    const previewBox = document.getElementById('statusPhotoPreviewBox');
    if (previewBox) previewBox.style.display = 'none';

    initInstagramStoriesBar();
    if (typeof initInstagramStoriesFullGrid === 'function') initInstagramStoriesFullGrid(); // refrescar la pestaña "Estados"
    closeModals();
    if (window.bbqToast) window.bbqToast('🎉 ¡Estado publicado!'); else alert('🎉 ¡Estado publicado!');
}

function toggleStatusCreatorMode() {
    const typeSelect = document.getElementById('statusInputType');
    const textGroup = document.getElementById('statusTextGroup');
    const imageGroup = document.getElementById('statusImageGroup');
    const liveGroup = document.getElementById('statusLiveGroup');
    const publishBtn = document.getElementById('btnPublishStatusSubmit');

    if (!typeSelect) return;
    const mode = typeSelect.value;

    if (textGroup) textGroup.style.display = mode === 'text' ? 'block' : 'none';
    if (imageGroup) imageGroup.style.display = mode === 'image' ? 'block' : 'none';
    if (liveGroup) liveGroup.style.display = mode === 'live' ? 'block' : 'none';
    if (publishBtn) publishBtn.style.display = mode === 'live' ? 'none' : 'block';

    if (mode === 'live' || mode === 'image') {
        populateStatusProductsDropdowns();
    }
}

function populateStatusProductsDropdowns() {
    const liveSelect = document.getElementById('statusLiveProductSelect');
    const imageSelect = document.getElementById('statusLinkProductSelect');
    if (!liveSelect && !imageSelect) return;

    const products = window.merchantStorage.getProducts();
    const optionsHtml = '<option value="">-- Sin Producto Vinculado --</option>' +
        products.map(p => `<option value="${p.id}">${p.name} ($${p.price.toFixed(2)} USD)</option>`).join('');

    if (liveSelect) liveSelect.innerHTML = optionsHtml;
    if (imageSelect) imageSelect.innerHTML = optionsHtml;
}

async function handleStartLiveFromStatusModal() {
    const liveSelect = document.getElementById('statusLiveProductSelect');
    const selectedProdId = liveSelect ? liveSelect.value : null;

    if (selectedProdId) {
        const products = window.merchantStorage.getProducts();
        const found = products.find(p => p.id === selectedProdId);
        if (found) {
            window.p2pLiveEngine.pinnedProduct = found;
        }
    } else {
        window.p2pLiveEngine.pinnedProduct = null;
    }

    closeModals();
    await handleStartLiveHostPrompt();
    if (window.p2pLiveEngine.pinnedProduct) {
        showInAppNotification('📌 Producto Vinculado al Vivo', `El producto "${window.p2pLiveEngine.pinnedProduct.name}" ya está fijado en pantalla.`);
    }
}

function toggleSearchBox() {
    const box = document.getElementById('mobileSearchBox');
    if (box) {
        const isHidden = box.style.display === 'none';
        box.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            const input = document.getElementById('mSearchInput');
            if (input) input.focus();
        }
    }
}

function handleLiveSearchFilter() {
    const input = document.getElementById('mSearchInput');
    if (!input) return;

    const query = input.value.toLowerCase().trim();
    const chatItems = document.querySelectorAll('.m-chat-item');

    chatItems.forEach(item => {
        const name = item.querySelector('.m-chat-name')?.textContent.toLowerCase() || '';
        const msg = item.querySelector('.m-last-msg')?.textContent.toLowerCase() || '';

        if (name.includes(query) || msg.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function truncateText(text, length) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
}

/* ==========================================================================
   13. CONTEXTUAL FAB (+), CONTACT PICKER, STORE SUGGESTIONS & INLINE SEARCH
   ========================================================================== */

let currentStoresSubTab = 'recent';

function handleFabClick() {
    if (currentActiveTab === 'chats') {
        renderContactPicker('chat');
        openModal('modalContactPicker');
    } else if (currentActiveTab === 'calls') {
        renderContactPicker('call');
        openModal('modalContactPicker');
    } else if (currentActiveTab === 'updates') {
        openModal('modalCreateStatus');
    } else if (currentActiveTab === 'stores') {
        renderStorePicker();
        openModal('modalStorePicker');
    } else if (currentActiveTab === 'community') {
        renderCommunityPicker();
        openModal('modalCommunityPicker');
    } else {
        openModal('modalProfile');
    }
}

function updateFabIcon(tabName) {
    const fab = document.getElementById('mobileFab');
    if (!fab) return;

    const icons = {
        'chats': '<i class="bi bi-chat-plus-fill"></i>',
        'calls': '<i class="bi bi-telephone-plus-fill"></i>',
        'updates': '<i class="bi bi-camera-fill"></i>',
        'stores': '<i class="bi bi-shop"></i>',
        'community': '<i class="bi bi-people-fill"></i>',
        'profile': '<i class="bi bi-gear-fill"></i>'
    };

    fab.innerHTML = icons[tabName] || '<i class="bi bi-plus-lg"></i>';
}

function renderContactPicker(mode = 'chat') {
    const titleEl = document.getElementById('modalContactPickerTitle');
    const topBtn = document.getElementById('btnCreateNewContactTop');
    const listEl = document.getElementById('contactPickerListContainer');

    if (!listEl) return;

    if (titleEl) {
        titleEl.innerHTML = mode === 'chat' ? 
            '<i class="bi bi-chat-plus-fill text-success"></i> Iniciar Nuevo Chat P2P' : 
            '<i class="bi bi-telephone-plus-fill text-info"></i> Iniciar Llamada P2P';
    }

    if (topBtn) {
        topBtn.textContent = mode === 'chat' ? 
            '➕ Iniciar Chat con Nuevo Número / Contacto' : 
            '➕ Llamar a Nuevo Número / Contacto';
    }

    const contactIds = Object.keys(CONTACTS_DATA);
    listEl.innerHTML = contactIds.map(id => {
        const c = CONTACTS_DATA[id];
        return `
            <div class="wa-store-card" style="margin-bottom:8px;">
                <div style="display:flex; gap:10px; align-items:center;">
                    <div style="font-size:1.6rem;">${c.avatar}</div>
                    <div>
                        <div class="font-inter-black" style="font-size:0.9rem;">${c.name}</div>
                        <div class="font-inter-light" style="font-size:0.72rem; color:var(--wa-text-secondary);">${c.status}</div>
                    </div>
                </div>
                <button class="btn-wa-primary" style="padding:5px 12px; font-size:0.75rem;" onclick="handleContactPickerSelect('${id}', '${mode}')">
                    ${mode === 'chat' ? '💬 Chat' : '📞 Llamar'}
                </button>
            </div>
        `;
    }).join('');
}

function handleContactPickerSelect(contactId, mode) {
    closeModals();
    if (mode === 'chat') {
        selectMobileChat(contactId);
        switchMobileTab('chats');
    } else {
        const contact = CONTACTS_DATA[contactId] || { name: 'Contacto P2P', avatar: '👤' };
        window.buyerStorage.addCall({
            id: 'call_' + Date.now(),
            contactId: contactId,
            contactName: contact.name,
            contactAvatar: contact.avatar,
            type: 'outgoing',
            timestamp: new Date().toISOString()
        });
        renderCallsSection();
        // Llamada P2P REAL (voz). Para contactos reales usa WebRTC; si no, avisa.
        if (contact.isReal && window.BBQCall) {
            window.BBQCall.startCall(contactId, false);
        } else if (window.bbqToast) {
            window.bbqToast('Solo podés llamar a contactos reales de BBQ');
        }
    }
}

// Llamar (voz o video) al contacto del chat abierto.
function handleChatCall(withVideo) {
    const contact = (typeof currentChatId !== 'undefined') ? CONTACTS_DATA[currentChatId] : null;
    if (!currentChatId || !contact) { if (window.bbqToast) window.bbqToast('Abrí el chat de un contacto'); return; }
    if (!contact.isReal) { if (window.bbqToast) window.bbqToast('Solo podés llamar a contactos reales de BBQ'); return; }
    if (window.BBQCall) window.BBQCall.startCall(currentChatId, !!withVideo);
}

function handleCreateNewContactPrompt() {
    // Abre el flujo REAL de contactos (buscar por número en el directorio, importar
    // agenda, invitar). Reemplaza el viejo prompt que creaba un contacto falso.
    closeModals();
    if (window.BBQ && typeof window.BBQ.openAddContactModal === 'function') {
        window.BBQ.openAddContactModal();
        return;
    }
    alert('El sistema de contactos todavía se está iniciando. Probá de nuevo en unos segundos.');
}

function renderStorePicker() {
    const listEl = document.getElementById('storePickerListContainer');
    if (!listEl) return;

    const stores = window.buyerStorage.getStoresRankedByVisits();
    listEl.innerHTML = stores.map(s => `
        <div class="wa-store-card" style="margin-bottom:8px;">
            <div style="display:flex; gap:10px; align-items:center;">
                <div style="font-size:1.6rem;">${s.icon}</div>
                <div>
                    <div class="font-inter-black" style="font-size:0.9rem;">${s.name}</div>
                    <div class="font-inter-light" style="font-size:0.72rem; color:var(--wa-text-secondary);">${s.category} • ${s.region}</div>
                </div>
            </div>
            <button class="btn-wa-primary" style="padding:5px 12px; font-size:0.75rem;" onclick="openStoreChatFromList('${s.id}'); closeModals();">
                🏬 Abrir Tienda
            </button>
        </div>
    `).join('');
}

function renderCommunityPicker() {
    const listEl = document.getElementById('communityPickerListContainer');
    if (!listEl) return;

    const communities = window.buyerStorage.getCommunities();
    listEl.innerHTML = communities.map(c => `
        <div class="wa-store-card" style="margin-bottom:8px;">
            <div style="display:flex; gap:10px; align-items:center;">
                <div style="font-size:1.6rem; width:40px; height:40px; border-radius:50%; background:${c.bgColor}; display:flex; align-items:center; justify-content:center; color:#fff;">${c.icon}</div>
                <div>
                    <div class="font-inter-black" style="font-size:0.9rem;">${c.name}</div>
                    <div class="font-inter-light" style="font-size:0.72rem; color:var(--wa-text-secondary);">${c.membersCount} miembros • ${c.category}</div>
                </div>
            </div>
            <button class="btn-wa-primary" style="padding:5px 12px; font-size:0.75rem; background:#8b5cf6;" onclick="alert('👥 Uniqueció a la comunidad: ${c.name}'); closeModals();">
                Unirse
            </button>
        </div>
    `).join('');
}

function handleSaveCommunity() {
    const name = document.getElementById('commInputName').value.trim();
    const category = document.getElementById('commInputCategory').value;
    const desc = document.getElementById('commInputDesc').value.trim();

    if (!name) return;

    const newComm = {
        id: `comm_${Date.now()}`,
        name: `${name} 👥`,
        category: category,
        description: desc || 'Comunidad creada por el usuario en BBQ P2P.',
        icon: category === 'Logistics' ? '🚚' : category === 'Comerciantes' ? '🏬' : '👥',
        bgColor: category === 'Logistics' ? '#06b6d4' : category === 'Comerciantes' ? '#8b5cf6' : '#ec4899',
        membersCount: 1,
        region: 'metrosur'
    };

    window.buyerStorage.addCommunity(newComm);
    closeModals();
    switchMobileTab('community');
    renderCommunitySection();
    alert(`🎉 ¡Comunidad "${name}" creada exitosamente!`);
}

function renderCallsSection() {
    const container = document.getElementById('callsListContainer');
    if (!container) return;

    const calls = window.buyerStorage.getCalls();

    if (calls.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--wa-text-secondary);">No hay llamadas recientes</div>`;
        return;
    }

    container.innerHTML = calls.map(c => `
        <div class="call-log-item">
            <div class="call-avatar">${c.contactAvatar || '👤'}</div>
            <div class="call-info">
                <div class="font-inter-black" style="font-size:0.9rem;">${c.contactName}</div>
                <div class="font-inter-light" style="font-size:0.75rem; color:${c.type === 'incoming' ? 'var(--wa-green)' : 'var(--wa-text-secondary)'};">
                    <i class="bi bi-arrow-${c.type === 'incoming' ? 'down-left' : 'up-right'}"></i> ${c.type === 'incoming' ? 'Entrante' : 'Saliente'} (${formatTime(c.timestamp)})
                </div>
            </div>
            <button class="btn-call-action" onclick="alert('📞 Llamando a ${c.contactName} por P2P...')"><i class="bi bi-telephone-out-fill"></i></button>
        </div>
    `).join('');
}

function renderCommunitySection() {
    const container = document.getElementById('communityListContainer');
    if (!container) return;

    const communities = window.buyerStorage.getCommunities();

    container.innerHTML = communities.map(c => `
        <div class="community-card" style="margin-bottom:10px;">
            <div class="community-icon" style="background:${c.bgColor}; font-size:1.4rem;">${c.icon}</div>
            <div style="flex:1;">
                <div class="font-inter-black" style="font-size:0.9rem;">${c.name}</div>
                <div class="font-inter-light" style="font-size:0.75rem; color:var(--wa-text-secondary);">${c.description}</div>
                <div class="font-inter-light" style="font-size:0.7rem; color:var(--wa-green); margin-top:2px;">👥 ${c.membersCount} Miembros activos</div>
            </div>
            <button class="btn-wa-secondary" style="font-size:0.72rem; padding:4px 8px;" onclick="alert('💬 Entrando al chat del grupo ${c.name}')">Entrar</button>
        </div>
    `).join('');
}

function switchStoresSubTab(tab) {
    currentStoresSubTab = tab;
    const btnRecent = document.getElementById('btnStoresTabRecent');
    const btnSugg = document.getElementById('btnStoresTabSuggestions');

    if (btnRecent) btnRecent.classList.toggle('active', tab === 'recent');
    if (btnSugg) btnSugg.classList.toggle('active', tab === 'suggestions');

    renderStoresSection(tab);
}

function handleStoreInlineSearch() {
    const input = document.getElementById('storeInlineSearchInput');
    if (!input) return;
    const query = input.value.toLowerCase().trim();

    const container = document.getElementById('storesMainListContainer');
    if (!container) return;

    const storeCards = container.querySelectorAll('.store-card-large');
    storeCards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(query) ? 'block' : 'none';
    });

    if (query.length > 2) {
        window.buyerStorage.saveSearchQuery(query);
    }
}

function handleCommunityInlineSearch() {
    const input = document.getElementById('communityInlineSearchInput');
    if (!input) return;
    const query = input.value.toLowerCase().trim();

    const container = document.getElementById('communityListContainer');
    if (!container) return;

    const cards = container.querySelectorAll('.community-card');
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(query) ? 'flex' : 'none';
    });
}

/* ==========================================================================
   14. VIVOS P2P (LIVE STREAMING & SHOPPING), SCREEN RECORDING & EMOJI REACTIONS
   ========================================================================== */

async function handleStartLiveHostPrompt() {
    openModal('modalLiveBroadcastHost');
    const res = await window.p2pLiveEngine.startCameraStream('hostLiveVideoElement');
    if (res.success) {
        const countEl = document.getElementById('hostLiveViewerCount');
        if (countEl) countEl.textContent = `👥 ${window.p2pLiveEngine.viewerCount} Espectadores conectados`;
    }
}

function handleToggleLiveRecord() {
    const btn = document.getElementById('btnHostToggleRecord');
    const pill = document.getElementById('hostRecordStatusPill');

    if (!window.p2pLiveEngine.isRecording) {
        const res = window.p2pLiveEngine.startRecording();
        if (res.success) {
            if (btn) {
                btn.innerHTML = '⏹️ Detener & Guardar';
                btn.style.background = '#00a884';
            }
            if (pill) pill.style.display = 'block';
        }
    } else {
        window.p2pLiveEngine.stopRecording();
        if (btn) {
            btn.innerHTML = '⏺️ Grabar Vivo';
            btn.style.background = '#ef4444';
        }
        if (pill) pill.style.display = 'none';
    }
}

function handleEndLiveHost() {
    window.p2pLiveEngine.stopStream();
    closeModals();
    alert('🔴 Transmisión en Vivo finalizada.');
}

function handleHostPinProductPrompt() {
    const products = window.merchantStorage.getProducts();
    if (products.length === 0) {
        alert('No tienes productos guardados en tu catálogo para fijar.');
        return;
    }

    const prodNames = products.map((p, i) => `${i + 1}. ${p.name} ($${p.price.toFixed(2)})`).join('\n');
    const choice = prompt(`Selecciona el número del producto a fijar en la pantalla del Vivo:\n\n${prodNames}`, '1');
    if (!choice) return;

    const index = parseInt(choice, 10) - 1;
    if (products[index]) {
        window.p2pLiveEngine.pinnedProduct = products[index];
        alert(`📌 Producto "${products[index].name}" fijado en pantalla para todos los espectadores.`);
    }
}

function handleHostFlipCamera() {
    if (window.p2pLiveEngine) window.p2pLiveEngine.flipCamera();
}

function openLiveViewer(hostId) {
    const live = (window.LIVE_HOSTS || {})[hostId];
    openModal('modalLiveBroadcastViewer');
    // Mostrar el nombre del anfitrión y su producto fijado (si lo mandó).
    const titleEl = document.getElementById('viewerLiveHostTitle');
    if (titleEl && live) titleEl.textContent = live.hostName || 'En vivo';
    window.p2pLiveEngine.watch(hostId, 'viewerLiveVideoElement');
}

function closeLiveViewer() {
    window.p2pLiveEngine.stopStream();
    closeModals();
}

function handleSendLiveEmoji(emoji) {
    window.p2pLiveEngine.sendFloatingEmoji(emoji, 'viewerFloatingEmojiContainer');
    window.p2pLiveEngine.sendFloatingEmoji(emoji, 'hostFloatingEmojiContainer');
}

function handleSendLiveChatMessage() {
    const input = document.getElementById('viewerLiveChatInput');
    if (!input || !input.value.trim()) return;

    const text = input.value.trim();
    input.value = '';

    window.p2pLiveEngine.sendFloatingEmoji('💬', 'viewerFloatingEmojiContainer');
    window.buyerNode.sendDirectMessage('p2p_store_techzone', `[En Vivo P2P] ${text}`);
}

function handleSendStoryReaction(emoji) {
    if (!currentActiveStatusObj) return;

    window.p2pLiveEngine.sendFloatingEmoji(emoji, 'storyPlayerContent');
    const targetContactId = currentActiveStatusObj.authorId || 'p2p_store_techzone';

    window.buyerNode.sendDirectMessage(targetContactId, `Reaccionó con ${emoji} a tu historia ("${currentActiveStatusObj.authorName}")`);
    alert(` Reacción ${emoji} enviada al chat de ${currentActiveStatusObj.authorName}!`);
}

/* ==========================================================================
   15. VOICE NOTES & P2P AUDIO MESSAGING ENGINE
   ========================================================================== */

let voiceRecordTimerInterval = null;
let voiceRecordSeconds = 0;
let bbqMediaRecorder = null;
let bbqAudioChunks = [];
let bbqAudioStream = null;
let bbqVoiceShouldSend = false;
const bbqVoiceURLs = {}; // id de nota de voz -> objectURL (para reproducir en la sesión)

function handleChatInputTyping() {
    const input = document.getElementById('mTextInput');
    const btnMic = document.getElementById('mBtnMic');
    const btnSend = document.getElementById('mSendBtn');

    if (!input || !btnMic || !btnSend) return;

    if (input.value.trim().length > 0) {
        btnMic.style.display = 'none';
        btnSend.style.display = 'flex';
    } else {
        btnMic.style.display = 'flex';
        btnSend.style.display = 'none';
    }
}

async function handleStartVoiceRecording() {
    const bar = document.getElementById('mVoiceRecordBar');
    const timerEl = document.getElementById('mVoiceRecordTimer');

    // Grabación REAL con micrófono.
    try {
        bbqAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
        if (window.bbqToast) window.bbqToast('🎤 Sin permiso de micrófono'); else alert('No se pudo acceder al micrófono.');
        return;
    }
    bbqAudioChunks = [];
    bbqVoiceShouldSend = false;
    try {
        bbqMediaRecorder = new MediaRecorder(bbqAudioStream);
    } catch (e) {
        console.error('MediaRecorder no soportado:', e);
        stopVoiceStream();
        return;
    }
    bbqMediaRecorder.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) bbqAudioChunks.push(ev.data); };
    bbqMediaRecorder.onstop = () => finalizeVoiceRecording();
    bbqMediaRecorder.start();

    if (bar) bar.style.display = 'flex';
    voiceRecordSeconds = 0;
    if (timerEl) timerEl.textContent = '00:00';
    if (voiceRecordTimerInterval) clearInterval(voiceRecordTimerInterval);
    voiceRecordTimerInterval = setInterval(() => {
        voiceRecordSeconds++;
        const mins = String(Math.floor(voiceRecordSeconds / 60)).padStart(2, '0');
        const secs = String(voiceRecordSeconds % 60).padStart(2, '0');
        if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
}

function stopVoiceStream() {
    if (voiceRecordTimerInterval) clearInterval(voiceRecordTimerInterval);
    if (bbqAudioStream) { bbqAudioStream.getTracks().forEach(t => t.stop()); bbqAudioStream = null; }
    const bar = document.getElementById('mVoiceRecordBar');
    if (bar) bar.style.display = 'none';
}

function handleCancelVoiceRecording() {
    bbqVoiceShouldSend = false;
    if (bbqMediaRecorder && bbqMediaRecorder.state !== 'inactive') bbqMediaRecorder.stop();
    stopVoiceStream();
}

function handleSendVoiceRecording() {
    bbqVoiceShouldSend = true;
    if (bbqMediaRecorder && bbqMediaRecorder.state !== 'inactive') {
        bbqMediaRecorder.stop(); // dispara onstop → finalizeVoiceRecording()
    }
    stopVoiceStream();
}

async function finalizeVoiceRecording() {
    if (!bbqVoiceShouldSend) { bbqAudioChunks = []; return; }

    const durationSec = Math.max(1, voiceRecordSeconds);
    const durationStr = `${String(Math.floor(durationSec / 60)).padStart(2, '0')}:${String(durationSec % 60).padStart(2, '0')}`;
    const blob = new Blob(bbqAudioChunks, { type: (bbqAudioChunks[0] && bbqAudioChunks[0].type) || 'audio/webm' });
    bbqAudioChunks = [];
    const vnId = 'vn_' + Date.now();

    // El audio va a IndexedDB (no a localStorage), y una URL en memoria para reproducir ya.
    try { await window.BBQDB.set('messages', vnId, blob); } catch (e) {}
    bbqVoiceURLs[vnId] = URL.createObjectURL(blob);

    const msgObj = {
        id: 'msg_' + Date.now(),
        sender: window.MY_PEER_ID || 'me',
        text: `🎤 Nota de voz (${durationStr})`,
        timestamp: new Date().toISOString(),
        payloadCard: { type: 'voice_note', id: vnId, durationStr: durationStr }
    };
    window.buyerStorage.appendChatMessage(currentChatId, msgObj);
    renderMobileMessages();
    renderMobileChatList();

    // Enviar por P2P al contacto real (audio en base64 por el DataChannel).
    const contact = CONTACTS_DATA[currentChatId];
    if (contact && contact.isReal && window.BBQNet) {
        const b64 = await bbqBlobToBase64(blob);
        window.BBQNet.send(currentChatId, { type: 'voice', message: msgObj, audio: b64 }).then(r => {
            if (!r.ok && window.bbqToast) window.bbqToast('⚠️ Nota no entregada (contacto offline)');
        });
    }
}

function bbqBlobToBase64(blob) {
    return new Promise((resolve) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result);
        r.readAsDataURL(blob);
    });
}

// Transcribe una nota de voz con Whisper on-device y muestra el texto debajo.
async function transcribeVoiceNote(id) {
    const out = document.getElementById('vnText_' + id);
    if (out) { out.style.color = 'var(--wa-text-secondary)'; out.textContent = '📝 Transcribiendo (la 1ª vez descarga ~40MB)...'; }
    try {
        const blob = await window.BBQDB.get('messages', id);
        if (!blob) { if (out) out.textContent = 'Audio no disponible'; return; }
        const text = await window.BBQSTT.transcribe(blob, (p) => {
            if (out && p && p.status === 'progress' && typeof p.progress === 'number') {
                out.textContent = '⬇️ Cargando modelo ' + Math.round(p.progress) + '%';
            }
        });
        if (out) { out.style.color = 'var(--wa-text-primary)'; out.textContent = '📝 ' + (text || '(sin texto reconocido)'); }
    } catch (e) {
        if (out) { out.style.color = '#f87171'; out.textContent = 'No se pudo transcribir: ' + e.message; }
    }
}

async function handlePlayVoiceNote(noteId) {
    const btn = document.getElementById(`btnPlayVoice_${noteId}`);
    let url = bbqVoiceURLs[noteId];
    if (!url) {
        try {
            const blob = await window.BBQDB.get('messages', noteId);
            if (blob) { url = URL.createObjectURL(blob); bbqVoiceURLs[noteId] = url; }
        } catch (e) {}
    }
    if (!url) { if (window.bbqToast) window.bbqToast('Audio no disponible'); return; }

    const audio = new Audio(url);
    if (btn) btn.innerHTML = '<i class="bi bi-pause-fill"></i>';
    audio.onended = () => { if (btn) btn.innerHTML = '<i class="bi bi-play-fill"></i>'; };
    audio.play().catch(() => { if (btn) btn.innerHTML = '<i class="bi bi-play-fill"></i>'; });
}


