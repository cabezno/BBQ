/**
 * BBQ - Workflow AI (LLM on-device, acotado por etapa)
 *
 * Corre un modelo chico EN EL TELÉFONO (WebLLM sobre WebGPU), offline y sin API key.
 * La clave es mantenerlo ACOTADO: en cada tarea se le da un rol chico y una salida
 * estructurada (JSON con opciones fijas), así un modelo de 0.5B rinde bien y no se
 * sobrecarga. El modelo se descarga una vez y queda cacheado.
 *
 * Requiere WebGPU (Android/Chrome moderno; iOS parcial). Si no está, tira error claro.
 */
window.WorkflowAI = {
    engine: null,
    // Modelo chico y liviano (~350MB, se descarga una sola vez).
    modelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    loading: null,
    ready: false,
    onProgress: null,

    supported() {
        return typeof navigator !== 'undefined' && !!navigator.gpu;
    },

    async ensureEngine(progressCb) {
        if (this.ready) return true;
        if (!this.supported()) throw new Error('Este dispositivo no soporta WebGPU (IA on-device). Probá un Android/Chrome reciente.');
        if (this.loading) return this.loading;

        this.loading = (async () => {
            const webllm = await import('https://esm.run/@mlc-ai/web-llm');
            this.engine = await webllm.CreateMLCEngine(this.modelId, {
                initProgressCallback: (p) => { if (progressCb) progressCb(p); }
            });
            this.ready = true;
            return true;
        })();
        try {
            await this.loading;
        } finally {
            this.loading = null;
        }
        return true;
    },

    // Ejecución acotada: rol chico + límite de tokens bajo.
    async run(system, user, { maxTokens = 128, temperature = 0.2 } = {}) {
        await this.ensureEngine(this.onProgress);
        const res = await this.engine.chat.completions.create({
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user }
            ],
            max_tokens: maxTokens,
            temperature
        });
        return (res.choices[0].message.content || '').trim();
    },

    _parseJson(text) {
        const m = text.match(/\{[\s\S]*\}/);
        if (!m) return null;
        try { return JSON.parse(m[0]); } catch (e) { return null; }
    },

    // TAREA ACOTADA 1: describir una automatización → {trigger, action, name}
    async describeRuleToWorkflow(description) {
        const triggers = ['ESCROW_PAYMENT_CREATED', 'STOCK_BELOW_THRESHOLD', 'DELIVERY_TIMEOUT', 'BULK_PURCHASE'];
        const actions = ['DISPATCH_COURIER', 'REORDER_STOCK', 'REFUND_ESCROW', 'APPLY_DISCOUNT'];
        const system =
            'Sos un configurador de automatizaciones de una tienda. Dada una descripción del usuario, ' +
            'elegí EXACTAMENTE un trigger y una action de estas listas, y respondé SOLO un JSON ' +
            '{"trigger":"...","action":"...","name":"nombre corto"} sin texto extra ni explicación.\n' +
            'Triggers válidos: ' + triggers.join(', ') + '\n' +
            'Actions válidas: ' + actions.join(', ');
        const out = await this.run(system, description, { maxTokens: 100, temperature: 0.1 });
        const obj = this._parseJson(out);
        if (!obj || !triggers.includes(obj.trigger) || !actions.includes(obj.action)) return null;
        return { trigger: obj.trigger, action: obj.action, name: (obj.name || 'Regla IA').toString().slice(0, 60) };
    },

    // TAREA ACOTADA 2: clasificar una consulta de cliente en una categoría fija
    async classifyIntent(text, categories = ['precio', 'stock', 'envio', 'otro']) {
        const system =
            'Clasificá la consulta del cliente en UNA sola de estas categorías y respondé SOLO la palabra: ' +
            categories.join(', ') + '. Sin explicación.';
        const out = await this.run(system, text, { maxTokens: 8, temperature: 0 });
        const found = categories.find(c => out.toLowerCase().includes(c));
        return found || 'otro';
    },

    // TAREA ACOTADA 3: respuesta breve del asistente de tienda (con contexto de catálogo)
    async storeReply(userMsg, productContext) {
        const system = 'Sos el asistente de una tienda BBQ. Respondé en español, breve (1-2 frases), sin inventar. Contexto:\n' + (productContext || '');
        return this.run(system, userMsg, { maxTokens: 120, temperature: 0.3 });
    }
};
