/**
 * bbq-flow.js — Motor de flujos de agentes BBQ (ISOMÓRFICO)
 *
 * El MISMO archivo corre en el navegador (móvil) y en Node (worker de PC).
 * Un "flujo" es un JSON portable de etapas ACOTADAS. El intérprete recorre las
 * etapas llamando a un `runLLM` inyectable (on-device / API / claude CLI / ollama),
 * así el mismo flujo se ejecuta en el móvil o en la PC sin cambiar la definición.
 *
 * Tipos de etapa:
 *  - llm:      llama al modelo con {system, prompt} → guarda en ctx[out] → next
 *  - classify: elige UNA de {options} (salida acotada) → ramifica por routes[opción]
 *  - reply:    manda texto al usuario (onReply) → next
 *  - tool:     ejecuta tools[name](args, ctx) → ctx[out] → next
 *  - end:      termina
 *
 * Plantillas: {{input}} y {{var}} se reemplazan desde el contexto.
 */
(function (root, factory) {
    const mod = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = mod;
    else root.BBQFlow = mod;
})(typeof self !== 'undefined' ? self : this, function () {

    function tpl(str, ctx) {
        // Soporta {{var}} y {{obj.campo.subcampo}} (rutas con punto).
        return String(str == null ? '' : str).replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
            const val = path.split('.').reduce((o, k) => (o == null ? o : o[k]), ctx);
            return val != null ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : '';
        });
    }

    async function runFlow(flow, input, opts) {
        opts = opts || {};
        const runLLM = opts.runLLM || (async () => '(sin modelo)');
        const tools = opts.tools || {};
        const onReply = opts.onReply || (() => {});
        const ctx = Object.assign({ input: input }, opts.vars || {});

        const stages = {};
        (flow.stages || []).forEach(s => { stages[s.id] = s; });
        let cur = flow.start || (flow.stages && flow.stages[0] && flow.stages[0].id) || null;

        const replies = [];
        let guard = 0;
        while (cur && guard++ < 100) {
            const s = stages[cur];
            if (!s || s.type === 'end') break;

            if (s.type === 'llm') {
                const out = await runLLM(tpl(s.system, ctx), tpl(s.prompt || '{{input}}', ctx), { maxTokens: s.maxTokens || 200 });
                if (s.out) ctx[s.out] = out;
                cur = s.next || null;

            } else if (s.type === 'classify') {
                const opts2 = s.options || [];
                const sys = tpl(s.system, ctx) + '\nRespondé SOLO con una de estas opciones exactas: ' + opts2.join(', ') + '. Sin ninguna otra palabra.';
                const raw = (await runLLM(sys, tpl(s.prompt || '{{input}}', ctx), { maxTokens: 8 }) || '').toLowerCase();
                const pick = opts2.find(o => raw.includes(String(o).toLowerCase())) || opts2[0];
                if (s.out) ctx[s.out] = pick;
                cur = (s.routes && s.routes[pick]) || s.next || null;

            } else if (s.type === 'reply') {
                const text = tpl(s.text, ctx);
                replies.push(text);
                await onReply(text);
                cur = s.next || null;

            } else if (s.type === 'tool') {
                const fn = tools[s.tool];
                let res = null;
                try { res = fn ? await fn(s.args || {}, ctx) : null; } catch (e) { res = '(tool error: ' + e.message + ')'; }
                if (s.out) ctx[s.out] = res;
                cur = s.next || null;

            } else {
                cur = s.next || null;
            }
        }
        return { ctx, replies };
    }

    // Validación mínima de un flujo (para el editor).
    function validate(flow) {
        if (!flow || typeof flow !== 'object') return 'El flujo debe ser un objeto JSON.';
        if (!Array.isArray(flow.stages) || !flow.stages.length) return 'Falta "stages" (array con al menos una etapa).';
        const ids = new Set(flow.stages.map(s => s.id));
        if (flow.start && !ids.has(flow.start)) return 'El "start" no coincide con ninguna etapa.';
        for (const s of flow.stages) {
            if (!s.id || !s.type) return 'Cada etapa necesita "id" y "type".';
            if (s.next && !ids.has(s.next)) return `La etapa "${s.id}" apunta a un next inexistente: ${s.next}`;
        }
        return null; // ok
    }

    // Flujo por defecto: asistente de tienda. Carga el catálogo REAL (tool) y responde
    // con esos datos. Si el ejecutor no tiene la tool (p.ej. worker sin datos locales),
    // {{catalogo}} queda vacío y el modelo responde de forma genérica (degrada bien).
    const DEFAULT_STORE_FLOW = {
        id: 'store-assistant',
        name: 'Asistente de tienda',
        start: 'cargar_catalogo',
        stages: [
            { id: 'cargar_catalogo', type: 'tool', tool: 'store.catalogText', out: 'catalogo', next: 'clasificar' },
            {
                id: 'clasificar', type: 'classify',
                system: 'Sos el asistente de una tienda. Clasificá la consulta del cliente en una categoría.',
                prompt: '{{input}}',
                options: ['saludo', 'precio', 'stock', 'envio', 'comprar', 'otro'],
                out: 'intent',
                routes: { saludo: 'saludar', precio: 'responder', stock: 'responder', envio: 'responder', comprar: 'responder', otro: 'responder' }
            },
            { id: 'saludar', type: 'reply', text: '¡Hola! Bienvenido a la tienda 🛍️ ¿Qué producto te interesa?', next: 'end' },
            {
                id: 'responder', type: 'llm',
                system: 'Sos el asistente de una tienda BBQ. Respondé breve y en español. Usá SOLO estos datos reales del catálogo:\n{{catalogo}}\nSi el cliente quiere comprar, confirmá el producto y el precio y ofrecé continuar la compra. Si no tenés el dato, decilo con honestidad.',
                prompt: '{{input}}', out: 'respuesta', next: 'enviar'
            },
            { id: 'enviar', type: 'reply', text: '{{respuesta}}', next: 'end' },
            { id: 'end', type: 'end' }
        ]
    };

    return { runFlow, tpl, validate, DEFAULT_STORE_FLOW };
});
