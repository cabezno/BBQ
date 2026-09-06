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
        return String(str == null ? '' : str).replace(/\{\{(\w+)\}\}/g, (_, k) => (ctx[k] != null ? String(ctx[k]) : ''));
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

    // Flujo por defecto: asistente de tienda (3 etapas acotadas).
    const DEFAULT_STORE_FLOW = {
        id: 'store-assistant',
        name: 'Asistente de tienda',
        start: 'clasificar',
        stages: [
            {
                id: 'clasificar', type: 'classify',
                system: 'Sos el asistente de una tienda. Clasificá la consulta del cliente en una categoría.',
                prompt: '{{input}}',
                options: ['saludo', 'precio', 'stock', 'envio', 'otro'],
                out: 'intent',
                routes: { saludo: 'saludar', precio: 'responder', stock: 'responder', envio: 'responder', otro: 'responder' }
            },
            { id: 'saludar', type: 'reply', text: '¡Hola! Bienvenido a la tienda 🛍️ ¿Qué producto te interesa?', next: 'end' },
            {
                id: 'responder', type: 'llm',
                system: 'Sos el asistente de una tienda BBQ. Respondé breve y en español según la consulta (categoría: {{intent}}). Si no tenés el dato, ofrecé ayuda para conseguirlo.',
                prompt: '{{input}}', out: 'respuesta', next: 'enviar'
            },
            { id: 'enviar', type: 'reply', text: '{{respuesta}}', next: 'end' },
            { id: 'end', type: 'end' }
        ]
    };

    return { runFlow, tpl, validate, DEFAULT_STORE_FLOW };
});
