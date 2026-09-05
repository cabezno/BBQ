/**
 * NEXUS P2P - In-App AI Automation Engine
 * Manages automated rules created, edited, and executed by the AI:
 * - Auto-Courier Dispatch on Escrow Payment
 * - Low Stock Supplier Reorder Alert (< 3 units)
 * - Auto-Escrow Refund on Timeout
 * - Dynamic Bulk Discount Rule
 */
class InAppAutomationEngine {
    constructor() {
        this.storageKey = 'nexus_ai_automations';
        this.initDefaultRules();
    }

    initDefaultRules() {
        if (!localStorage.getItem(this.storageKey)) {
            const defaultRules = [
                {
                    id: 'rule_courier_dispatch',
                    name: '🚚 Auto-Despacho a Courier',
                    description: 'Al registrarse un pago Escrow, la IA notifica automáticamente a la empresa de transporte.',
                    trigger: 'ESCROW_PAYMENT_CREATED',
                    enabled: true,
                    action: 'DISPATCH_COURIER',
                    executionCount: 5
                },
                {
                    id: 'rule_low_stock',
                    name: '📦 Alerta & Reabastecimiento de Stock',
                    description: 'Si el stock cae a < 3 unidades, la IA genera un pedido P2P de reposición al proveedor.',
                    trigger: 'STOCK_BELOW_THRESHOLD',
                    enabled: true,
                    action: 'REORDER_STOCK',
                    executionCount: 2
                },
                {
                    id: 'rule_auto_refund',
                    name: '⏳ Auto-Reembolso por Expiración',
                    description: 'Si la entrega excede el límite de tiempo sin escáner, la IA devuelve la retención a Google Wallet.',
                    trigger: 'DELIVERY_TIMEOUT',
                    enabled: true,
                    action: 'REFUND_ESCROW',
                    executionCount: 1
                },
                {
                    id: 'rule_bulk_discount',
                    name: '🏷️ Descuento Dinámico por Volumen',
                    description: 'Aplica automáticamente un 10% de bonificación en compras de 2 o más productos.',
                    trigger: 'BULK_PURCHASE',
                    enabled: true,
                    action: 'APPLY_DISCOUNT',
                    executionCount: 8
                }
            ];
            localStorage.setItem(this.storageKey, JSON.stringify(defaultRules));
        }
    }

    getRules() {
        return JSON.parse(localStorage.getItem(this.storageKey)) || [];
    }

    saveRules(rules) {
        localStorage.setItem(this.storageKey, JSON.stringify(rules));
    }

    toggleRule(ruleId) {
        const rules = this.getRules();
        const rule = rules.find(r => r.id === ruleId);
        if (rule) {
            rule.enabled = !rule.enabled;
            this.saveRules(rules);
        }
        return rules;
    }

    addRule(name, description, trigger, action) {
        const rules = this.getRules();
        const newRule = {
            id: `rule_${Date.now()}`,
            name,
            description,
            trigger,
            action,
            enabled: true,
            executionCount: 0
        };
        rules.push(newRule);
        this.saveRules(rules);
        return newRule;
    }

    evaluateTrigger(triggerEvent, payload) {
        const rules = this.getRules();
        const activeRule = rules.find(r => r.enabled && r.trigger === triggerEvent);

        if (activeRule) {
            activeRule.executionCount++;
            this.saveRules(rules);

            console.log(`[AUTOMATION ENGINE] ⚡ Regla ejecutada: ${activeRule.name}`);
            return {
                executed: true,
                rule: activeRule,
                message: `⚡ [AUTOMATIZACIÓN IA EJECUTADA] Regla: ${activeRule.name}`
            };
        }

        return { executed: false };
    }
}

window.automationEngine = new InAppAutomationEngine();
