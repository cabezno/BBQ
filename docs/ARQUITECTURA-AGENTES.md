# Arquitectura de Agentes — BBQ

> Estado: **diseño acordado + v1 en construcción**. Este documento es la referencia
> de qué puede hacer un agente en BBQ, cómo se integra con la plataforma y qué es
> real vs. simulado hoy.

## 1. Principio: un agente no es "una IA", es un actor con manos atadas a la plataforma

El LLM es solo el **cerebro que decide**. Las **capacidades ("tools")** son las **manos**.
El motor `bbq-flow.js` ya separa esto (stages `classify` / `llm` / `reply` / `tool`).

Un agente = **4 capas**:

| Capa | Qué es | Ejemplo |
|---|---|---|
| **1. Perfil (rol)** | Plantilla de para qué sirve | "Vendedor de tienda", "Secretario", "Productor" |
| **2. Flujo** | Lógica paso a paso (portable PC↔móvil) | clasificar → precio → consultar catálogo → responder |
| **3. Tools (capacidades)** | Acciones concretas sobre la plataforma | `store.getProduct`, `pay.charge`, `escrow.hold` |
| **4. Permisos + límites** | Qué tools tiene, sobre qué datos, con qué topes | "puede responder, NO cobrar sin confirmar" |

El **ejecutor** (dónde corre: API en la nube / PC "bridgia" / modelo on-device) es
ortogonal: el flujo es el mismo, cambia quién lo ejecuta.

## 2. La capa de integración: `BBQTools` (registro de capacidades)

El motor soporta stages `tool` con firma `(args, ctx) => resultado`, pero **no había
ninguna tool registrada** y las acciones vivían como funciones sueltas en `app.js`.
`BBQTools` es el registro namespaced que envuelve lo existente:

```js
BBQTools.register('store.getProduct', {
  desc: 'Devuelve un producto por id o nombre',   // el LLM lee esto para decidir
  input: { idOrName: 'string' },
  permiso: 'store.read',
  sensible: false,                                 // lectura → ejecuta directo
  run: (args, ctx) => merchantStorage.getProducts().find(...)
});

// buildToolset(permisos, { onProposal }) → { toolId: fn } listo para runFlow.
// Envuelve cada tool con: check de permiso + gate de confirmación si es sensible.
```

Contrato de una tool: `{ id, desc, input, output, permiso, sensible, run(args, ctx) }`.

## 3. Catálogo del Agente Tienda (real vs. a construir)

| Tool | Qué hace | Se cablea a | Estado | Sensible |
|---|---|---|:--:|:--:|
| `store.listProducts` | Lista el catálogo | `merchantStorage.getProducts()` | ✅ real | no |
| `store.getProduct` | Detalle por id/nombre | idem + filtro | ✅ real | no |
| `store.checkStock` | Stock de un producto | `producto.stock` | ✅ real | no |
| `store.info` | Datos de la tienda | `getUserStore()` | ✅ real | no |
| `chat.reply` | Responder al cliente | `onReply` del flujo | ✅ real | no |
| `store.upsertProduct` | Crear/editar producto | `saveProduct()` | ✅ real | **sí** |
| `store.setPrice` / `store.setStock` | Ajustar precio/stock | `saveProduct()` | ✅ real | **sí** |
| `order.create` | Tomar un pedido | entidad "pedido" (nueva) | 🔨 a crear | **sí** |
| `pay.charge` | Generar cobro | `handleSendMerchantCharge` / Google Pay | ⚠️ **TEST (no cobra)** | **sí** |
| `escrow.hold` | Retener pago | `escrowEngine.createAuthAndHoldEscrow` | ⚠️ simulado | **sí** |
| `escrow.confirmDelivery` | Liberar contra entrega | `verifyAndSettleScan` | ⚠️ simulado | **sí** |
| `escrow.refund` | Reembolsar | `simulateRefundTimeout` | ⚠️ simulado | **sí** |

**Verdad del terreno:** todo lo que toca **dinero** (`pay.*`, `escrow.*`) hoy es
**TEST/simulado** (QR decorativo, "SHA-256" falso, escaneo que siempre liquida,
Google Pay sin captura, gateway `'example'`). Por eso el Agente Tienda tiene dos niveles:

- **v1 (este hito):** atención real (catálogo, precio, stock, responder, tomar pedido)
  + tools de dinero que **disparan el flujo TEST actual** como propuestas.
- **v2:** dinero real — escrow real (hash/QR/validación) + pasarela real. Hito propio,
  independiente de los agentes.

## 4. Gate de confirmación humana ("confirmación siempre")

Decisión: las acciones sensibles **nunca se ejecutan solas**.

1. El agente corre libre las tools de **lectura + respuesta**.
2. Al querer una tool **sensible**, el wrapper **no ejecuta**: encola una **propuesta**
   en el dispositivo del dueño y la muestra en el chat:
   > 🤖 El agente quiere: **cobrar $2.500 a Juan por 2× Auriculares**. `[Confirmar] [Rechazar]`
3. Al **Confirmar**, se ejecuta la tool real. Todo queda **logueado en el dispositivo**
   (auditable, sin server).

## 5. Permisos y seguridad

- El agente actúa **en nombre de un usuario**, con permisos delegados. Se apoya en la
  identidad firmada (peerId autenticado — ver el server: challenge-response en el WS).
- Namespacing: `agent_<userId>_<nombre>` — un agente solo toca los datos de ESE usuario.
- Acciones sensibles → confirmación humana (v1) o topes pre-aprobados (futuro).
- Log de acciones del agente en el teléfono/PC del dueño, no en el server.

## 6. Ejecutores (dónde corre el flujo)

- **On-device (móvil):** `runAgentLocally` → tools cableadas a `merchantStorage` local.
  **v1 corre acá** (donde viven los datos de la tienda del dueño).
- **PC (bridgia):** `bbq-agent-worker.js` drena la cola del agente y corre el flujo.
  Para tools de datos locales necesita **sync del catálogo PC↔móvil** (v1.1/v2).
- **API (nube):** el LLM va por `/api/ai`; las tools requieren datos accesibles al ejecutor.

Limitación de v1: el Agente Tienda con tools reales se ejecuta en el **dispositivo del
dueño**. Ejecutar en PC/multi-cliente requiere sincronizar el catálogo (pendiente).

## 7. Flujo de ejemplo (Agente Tienda)

```
clasificar (classify: precio/stock/comprar/otro)
 ├ precio  → tool store.getProduct → reply "{{p.name}} sale ${{p.price}}"
 ├ stock   → tool store.checkStock → reply "Quedan {{s}} unidades"
 ├ comprar → tool order.create (SENSIBLE → propuesta) → reply "Te paso el cobro al confirmar"
 └ otro    → llm (responde con contexto de la tienda) → reply
```

## 8. Roadmap

**v1 (en curso) — atención real + dinero TEST**
1. `BBQTools` (registro + `buildToolset` con permisos y gate de confirmación).
2. Tools de lectura + respuesta cableadas.
3. Pasar el toolset a `runFlow` (runner + worker).
4. Cola de acciones pendientes + UI de confirmación.
5. Entidad "pedido" + `order.create`.
6. Tools de dinero como propuestas (disparan el checkout TEST).

**v2 — dinero real:** escrow real + pasarela real.
**Futuro:** agentes personales multi-usuario (token por usuario), sync de catálogo a PC,
más perfiles (Secretario, Productor), topes pre-aprobados.

## 9. Decisiones registradas

- **2026-09-06:** Primer agente = **Tienda (comercio completo)**.
- **2026-09-06:** Acciones sensibles = **confirmación humana siempre**.
- **2026-09-06:** Alcance v1 = **atención real + dinero TEST** (no se pausa por el dinero real).
