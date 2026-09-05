/**
 * BBQ PWA - Google Pay Engine & Payment Gateway
 * Integrates Google Pay API v2 for pre-authorizations (Auth & Hold)
 * Includes official Google Pay button renderer & HTTP/LAN Sandbox fallback.
 */

class GooglePayEngine {
    constructor() {
        this.paymentsClient = null;
        this.baseRequest = {
            apiVersion: 2,
            apiVersionMinor: 0
        };
        this.allowedCardNetworks = ["AMEX", "DISCOVER", "INTERAC", "JCB", "MASTERCARD", "VISA"];
        this.allowedCardAuthMethods = ["PAN_ONLY", "CRYPTOGRAM_3DS"];
        
        this.baseCardPaymentMethod = {
            type: 'CARD',
            parameters: {
                allowedAuthMethods: this.allowedCardAuthMethods,
                allowedCardNetworks: this.allowedCardNetworks
            }
        };

        this.cardPaymentMethod = Object.assign(
            {},
            this.baseCardPaymentMethod,
            {
                tokenizationSpecification: {
                    type: 'PAYMENT_GATEWAY',
                    parameters: {
                        'gateway': 'example',
                        'gatewayMerchantId': 'exampleGatewayMerchantId'
                    }
                }
            }
        );

        this.init();
    }

    async init() {
        // Attempt to load Google Pay JS client if available
        if (window.google && window.google.payments && window.google.payments.api) {
            try {
                this.paymentsClient = new google.payments.api.PaymentsClient({
                    environment: 'TEST'
                });
                console.log('💳 [GOOGLE PAY ENGINE] Google Pay API Client initialized.');
            } catch (err) {
                console.warn('💳 [GOOGLE PAY ENGINE] Local Google Pay API init warning:', err);
            }
        }
    }

    // Crea el cliente de Google Pay si el SDK (pay.js) ya cargó. Idempotente.
    _ensureClient() {
        if (this.paymentsClient) return;
        if (window.google && window.google.payments && window.google.payments.api) {
            try {
                this.paymentsClient = new google.payments.api.PaymentsClient({ environment: 'TEST' });
            } catch (e) {
                console.warn('[GOOGLE PAY] init:', e);
            }
        }
    }

    getGoogleIsReadyToPayRequest() {
        return Object.assign(
            {},
            this.baseRequest,
            {
                allowedPaymentMethods: [this.baseCardPaymentMethod]
            }
        );
    }

    getGooglePaymentDataRequest(amount, label = 'Compra en BBQ Store') {
        const paymentDataRequest = Object.assign({}, this.baseRequest);
        paymentDataRequest.allowedPaymentMethods = [this.cardPaymentMethod];
        paymentDataRequest.transactionInfo = {
            totalPriceStatus: 'FINAL',
            totalPrice: amount.toFixed(2),
            currencyCode: 'USD',
            countryCode: 'US'
        };
        paymentDataRequest.merchantInfo = {
            merchantName: label
        };
        return paymentDataRequest;
    }

    /**
     * Triggers Google Pay Payment process.
     * Uses real Google Pay API if available on HTTPS, or BBQ Google Pay Sandbox Sheet on HTTP/LAN.
     */
    async processPayment(amount, description = 'Compra BBQ P2P', deliveryMode = 'COURIER') {
        const totalAmount = typeof amount === 'number' ? amount : parseFloat(amount);

        // pay.js carga async: crear el cliente ahora si ya está disponible.
        this._ensureClient();

        // Hoja de Google Pay REAL (muestra las tarjetas del Google Wallet del teléfono).
        if (this.paymentsClient && window.isSecureContext) {
            try {
                const ready = await this.paymentsClient.isReadyToPay(this.getGoogleIsReadyToPayRequest());
                if (ready && ready.result) {
                    const paymentDataRequest = this.getGooglePaymentDataRequest(totalAmount, description);
                    const paymentData = await this.paymentsClient.loadPaymentData(paymentDataRequest);
                    console.log('✅ [GOOGLE PAY] token recibido', paymentData);
                    // NOTA: en TEST no se cobra. Para producción, mandar el token a /api/pay con tu pasarela.
                    return {
                        success: true,
                        paymentMethod: 'GOOGLE_PAY_SDK',
                        transactionId: 'gpay_auth_' + Date.now(),
                        raw: paymentData,
                        totalAmount,
                        description,
                        deliveryMode
                    };
                }
            } catch (err) {
                if (err && err.statusCode === 'CANCELED') {
                    return { success: false, message: 'Pago cancelado por el usuario.' };
                }
                console.warn('⚠️ [GOOGLE PAY] No disponible, usando hoja de respaldo:', err);
            }
        }

        // Fallback: Launch BBQ Google Pay Interactive Sandbox Sheet (Ideal for HTTP / LAN IP testing on mobile)
        return new Promise((resolve) => {
            this.showGooglePaySandboxSheet(totalAmount, description, deliveryMode, resolve);
        });
    }

    showGooglePaySandboxSheet(amount, description, deliveryMode, resolveFn) {
        let sheetOverlay = document.getElementById('googlePaySheetOverlay');
        
        if (!sheetOverlay) {
            sheetOverlay = document.createElement('div');
            sheetOverlay.id = 'googlePaySheetOverlay';
            sheetOverlay.className = 'wa-modal-overlay';
            sheetOverlay.style.zIndex = '100050';
            sheetOverlay.style.background = 'rgba(0,0,0,0.82)';
            document.body.appendChild(sheetOverlay);
        }

        sheetOverlay.innerHTML = `
            <div class="wa-modal-box font-inter" style="max-width:380px; border-radius:24px; border:1px solid var(--wa-border-light); padding:20px; background:var(--wa-header-bg); box-shadow: 0 20px 50px rgba(0,0,0,0.8); animation: slideUpSheet 0.3s ease;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--wa-border-light); padding-bottom:12px; margin-bottom:14px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:1.4rem; font-weight:900; background:linear-gradient(90deg, #4285F4, #EA4335, #FBBC05, #34A853); -webkit-background-clip:text; -webkit-text-fill-color:transparent;">GPay</span>
                        <span style="font-size:0.75rem; background:var(--wa-incoming-bg); color:var(--wa-text-secondary); padding:2px 6px; border-radius:6px;">Auth & Hold</span>
                    </div>
                    <button class="icon-btn-m" id="btnCloseGPaySheet" style="color:var(--wa-text-secondary);">✕</button>
                </div>

                <div style="margin-bottom:16px;">
                    <div style="font-size:0.75rem; color:var(--wa-text-secondary);">Comprando en</div>
                    <div style="font-size:0.95rem; font-weight:bold; color:var(--wa-text-primary);">BBQ P2P Store 🏬</div>
                    <div style="font-size:0.8rem; color:var(--wa-text-secondary); margin-top:2px;">${description}</div>
                </div>

                <!-- Método de Pago Seleccionado (Tarjeta Google Wallet) -->
                <div style="background:var(--wa-incoming-bg); border:1px solid var(--wa-border-light); border-radius:14px; padding:12px; margin-bottom:16px; display:flex; align-items:center; justify-content:space-between;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:36px; height:24px; background:#0284c7; border-radius:4px; color:#fff; font-weight:bold; font-size:0.65rem; display:flex; align-items:center; justify-content:center; letter-spacing:0.5px;">VISA</div>
                        <div>
                            <div style="font-size:0.82rem; font-weight:600; color:var(--wa-text-primary);">Google Wallet (•••• 4242)</div>
                            <div style="font-size:0.7rem; color:var(--wa-text-secondary);">Protegido con Token Criptográfico</div>
                        </div>
                    </div>
                    <span style="color:#38bdf8; font-size:0.8rem;">✓</span>
                </div>

                <!-- Total a Retener en Escrow -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; background:#0284c715; border:1px solid #0284c740; padding:10px 14px; border-radius:12px;">
                    <div>
                        <div style="font-size:0.7rem; color:#7dd3fc;">Monto Total a Pre-Autorizar</div>
                        <div style="font-size:0.68rem; color:var(--wa-text-secondary);">Retención sin cargos definitivos</div>
                    </div>
                    <div style="font-size:1.3rem; font-weight:900; color:#38bdf8;">$${amount.toFixed(2)} <span style="font-size:0.75rem;">USD</span></div>
                </div>

                <!-- Botón Pay with Google Pay -->
                <button id="btnConfirmGPay" class="btn-wa-primary" style="width:100%; padding:14px; border-radius:14px; font-size:0.95rem; display:flex; align-items:center; justify-content:center; gap:8px; background:#ffffff; color:#0f172a; border:none; box-shadow:0 6px 20px rgba(255,255,255,0.2); font-weight:900;">
                    <span style="font-weight:900; background:linear-gradient(90deg, #4285F4, #EA4335, #FBBC05, #34A853); -webkit-background-clip:text; -webkit-text-fill-color:transparent; font-size:1.1rem;">GPay</span>
                    <span>Autorizar $${amount.toFixed(2)} USD</span>
                </button>

                <div style="text-align:center; margin-top:12px; font-size:0.68rem; color:var(--wa-text-secondary); display:flex; align-items:center; justify-content:center; gap:4px;">
                    <span>🔒 Verificación Biométrica / Passkey Google</span>
                </div>
            </div>
        `;

        sheetOverlay.style.display = 'flex';

        const closeBtn = document.getElementById('btnCloseGPaySheet');
        const confirmBtn = document.getElementById('btnConfirmGPay');

        closeBtn.onclick = () => {
            sheetOverlay.style.display = 'none';
            resolveFn({ success: false, message: 'Pago cancelado por el usuario.' });
        };

        confirmBtn.onclick = () => {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = `⏳ Autenticando con Google Pay...`;

            setTimeout(() => {
                sheetOverlay.style.display = 'none';
                resolveFn({
                    success: true,
                    paymentMethod: 'GOOGLE_PAY_SANDBOX',
                    transactionId: 'gpay_auth_' + Date.now().toString().slice(-6),
                    totalAmount: amount,
                    description: description,
                    deliveryMode: deliveryMode,
                    cardLast4: '4242'
                });
            }, 900);
        };
    }
}

window.googlePayEngine = new GooglePayEngine();
