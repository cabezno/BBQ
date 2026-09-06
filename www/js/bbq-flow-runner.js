/**
 * bbq-flow-runner.js — Ejecutor de flujos en el MÓVIL + routing
 *
 * Corre el MISMO flujo (bbq-flow.js) en el teléfono usando la IA disponible:
 *   1) proveedor por API (proxy /api/ai) si hay key configurada,
 *   2) modelo on-device (WorkflowAI) si el dispositivo lo soporta,
 *   3) si no, mensaje claro.
 *
 * Routing: si el worker de PC del agente está ONLINE → se lo mandamos (responde la PC);
 * si está OFFLINE → el teléfono corre el flujo localmente. Misma definición, distinto ejecutor.
 */
(function () {
    async function browserRunLLM(system, user, opts) {
        const cfg = (window.merchantStorage && window.merchantStorage.getAiConfig && window.merchantStorage.getAiConfig()) || {};
        const providerMap = { gemini_api: 'gemini', openai_api: 'openai', claude_api: 'anthropic', deepseek_api: 'deepseek', ollama_local: 'ollama' };
        const provider = providerMap[cfg.engine];
        const hasKey = cfg.apiKey && String(cfg.apiKey).trim();
        // 1) API por proxy
        if (provider && (hasKey || provider === 'ollama')) {
            try {
                const r = await fetch(`${window.BBQ_SERVER}/api/ai`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ provider, apiKey: cfg.apiKey, model: cfg.model, system, prompt: user, endpoint: cfg.endpointUrl })
                });
                const j = await r.json();
                if (j.ok && j.text) return j.text;
            } catch (e) {}
        }
        // 2) on-device
        if (window.WorkflowAI && window.WorkflowAI.supported && window.WorkflowAI.supported()) {
            try { return await window.WorkflowAI.run(system, user, opts); } catch (e) {}
        }
        // 3) sin IA
        return 'No hay IA disponible en el teléfono. Configurá una API key en Ajustes de IA, o encendé el worker de PC del agente.';
    }

    async function getFlow(flowId) {
        try {
            const r = await fetch(`${window.BBQ_SERVER}/api/flows/${flowId || 'store-assistant'}`);
            const j = await r.json();
            if (j.ok) return j.flow;
        } catch (e) {}
        return (window.BBQFlow && window.BBQFlow.DEFAULT_STORE_FLOW) || null;
    }

    async function isWorkerOnline(agentId) {
        try {
            const r = await fetch(`${window.BBQ_SERVER}/api/agent/online?agent=${encodeURIComponent(agentId)}`);
            const j = await r.json();
            return !!j.online;
        } catch (e) { return false; }
    }

    async function runAgentLocally(agentId, text, onReply) {
        const flow = await getFlow('store-assistant');
        if (!flow || !window.BBQFlow) { onReply('(no se pudo cargar el flujo del agente)'); return; }
        await window.BBQFlow.runFlow(flow, text, { runLLM: browserRunLLM, onReply });
    }

    window.BBQFlowRunner = { browserRunLLM, getFlow, isWorkerOnline, runAgentLocally };
})();
