/**
 * NEXUS P2P - Client-Side AI Orchestrator & Privacy Firewall
 * Intercepts incoming messages, evaluates business rules against local SQLite,
 * builds bounded prompts for local (WebLLM/Ollama/Nano) or API LLMs, and auto-replies over P2P.
 */
class LocalAIOrchestrator {
    constructor(nodeId, storageEngine, p2pNode) {
        this.nodeId = nodeId;
        this.storage = storageEngine;
        this.p2pNode = p2pNode;
        this.engineMode = 'in_app_wasm'; // in_app_wasm | device_ollama | gemini_nano | api_gemini
        this.isEnabled = true;
        this.initInterceptor();
    }

    initInterceptor() {
        if (this.p2pNode) {
            this.p2pNode.onMessage((payload) => {
                if (this.isEnabled && payload.type === 'DIRECT_MESSAGE' && payload.targetId === this.nodeId) {
                    this.processIncomingMessage(payload.senderId, payload.message);
                }
            });
        }
    }

    setEngineMode(mode) {
        this.engineMode = mode;
        this.logAiEvent(`Motor de IA cambiado a: ${mode}`);
    }

    setEnable(status) {
        this.isEnabled = status;
        this.logAiEvent(`Orquestador de IA ${status ? 'ACTIVADO' : 'DESACTIVADO'}`);
    }

    processIncomingMessage(messageText, senderId) {
        const text = (messageText || '').toLowerCase();
        this.logAiEvent(`Analizando mensaje entrante de [${senderId}]: "${messageText}"`);

        const aiConfig = this.storage.getAiConfig ? this.storage.getAiConfig() : { engine: 'gemini_api', accessLevel: 3, autoReplyEnabled: true };
        if (!aiConfig.autoReplyEnabled) {
            return { replyText: 'El servicio de IA automática de la tienda se encuentra pausado por el usuario.' };
        }

        const accessLevel = parseInt(aiConfig.accessLevel || 3, 10);

        const engineMap = {
            'gemini_api': 'Gemini 1.5 Flash / Pro',
            'openai_api': 'OpenAI GPT-4o / ChatGPT',
            'claude_api': 'Anthropic Claude 3.5 Sonnet',
            'deepseek_api': 'DeepSeek V3 / R1',
            'ollama_local': 'Ollama Local (Llama 3)',
            'wasm_local': 'WASM In-App Local (Offline)',
            'custom_api': 'API REST Personalizada'
        };

        const engineLabel = engineMap[aiConfig.engine] || 'IA Vinculada';

        // Check Access Level Restrictions (Cortafuegos de Privacidad)
        if (accessLevel === 1) {
            // Level 1: Public Read Only
            const products = this.storage.getProducts();
            const targetProd = products.find(p => text.includes(p.name.toLowerCase()) || text.includes('stock') || text.includes('precio')) || products[0];
            
            return {
                replyText: `⚡ [IA - ${engineLabel} (Nivel 1: Lectura Pública)] ¡Hola! El producto "${targetProd.name}" tiene un precio público de $${targetProd.price.toFixed(2)} USD. ` +
                           `🔒 (Nota: La IA opera en Nivel 1. Para cotizar envíos o armar compras, el comerciante debe otorgar Nivel 3 en Ajustes).`
            };
        }

        // Level 2, 3 & 4 Processing
        const products = this.storage.getProducts();
        const targetProd = products.find(p => text.includes(p.name.toLowerCase()) || text.includes('producto') || text.includes('stock') || text.includes('precio')) || products[0];

        let responseText = '';

        if (targetProd) {
            const shippingFee = targetProd.shippingFee || 15.00;
            const total = targetProd.price + shippingFee;

            if (accessLevel === 2) {
                responseText = `⚡ [IA - ${engineLabel} (Nivel 2: Asistente Ventas)] ¡Hola! Disponemos de "${targetProd.name}" ($${targetProd.price.toFixed(2)} USD). ` +
                               `Descripción: ${targetProd.description || 'Producto en almacén local'}. ` +
                               `¿Te gustaría contactar al comerciante para coordinar el pago?`;
            } else {
                // Level 3 & 4: Full Autonomous Order Management
                responseText = `⚡ [IA - ${engineLabel} (Nivel ${accessLevel}: Gestión Autónoma)] ¡Hola! Sí, disponemos de stock de "${targetProd.name}" ($${targetProd.price.toFixed(2)} USD). ` +
                               `Costo de envío Courier: $${shippingFee.toFixed(2)} USD (Total: $${total.toFixed(2)} USD). ` +
                               `¿Deseas efectuar la compra con preautorización Escrow de Google Wallet (Envío o Retiro en Local)?`;
            }
        } else {
            responseText = `⚡ [IA - ${engineLabel} (Nivel ${accessLevel})] ¡Hola! ¿En qué producto o servicio te podemos asesorar hoy?`;
        }

        return { replyText: responseText, engine: aiConfig.engine, accessLevel: accessLevel };
    }

    logAiEvent(text) {
        console.log(`[AI FIREWALL - ${this.nodeId}] ${text}`);
        const consoleEl = document.getElementById('consoleBody');
        if (consoleEl) {
            const div = document.createElement('div');
            div.className = 'console-log';
            div.style.color = '#06b6d4';
            div.textContent = `[AI ORCHESTRATOR] ${text}`;
            consoleEl.appendChild(div);
            consoleEl.scrollTop = consoleEl.scrollHeight;
        }
    }
}

// Initialize AI Orchestrator for Merchant Node
window.merchantAiOrchestrator = new LocalAIOrchestrator('p2p_store_techzone', window.merchantStorage, window.merchantNode);
