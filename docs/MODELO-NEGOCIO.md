# Modelo de negocio y figura jurídica

> **Estado:** hay un estudio hecho (25 y 26/09/2026), ahora en el repo: [`MODELO-PAGOS-Y-ENTREGAS.md`](MODELO-PAGOS-Y-ENTREGAS.md).
> Es **orientativo**: no es asesoramiento legal ni contable. Lo marcado "a confirmar" se valida con abogado, contador y adquirentes.
> Este archivo resume el estudio y lo cruza con lo que ya está construido.

## Resumen del estudio

- **País:** Uruguay.
- **Promesa a proteger:** "Pagás tranquilo: el dinero se libera cuando recibís." BBQ controla el pago contra entrega; eso no se delega.
- **Estructura de referencia (esquema PedidosYa):** dos SAS uruguayas.
  - **BBQ Marketplace:** la app, intermediaria (no vende), factura su comisión.
  - **BBQ Pagos:** inscripta en el BCU como PSPC (Libro IX); reserva, cobra o cancela, y liquida a cada parte.
- **Alternativa:** comisionista (venta por cuenta ajena). Da el mismo control con más responsabilidad sobre el producto. A decidir con abogado y contador.
- **Descartado:** corredor puro (pierde el pago contra entrega), empresa en el exterior, zona franca, crédito propio o BNPL, escrow en blockchain.
- **Cómo se retiene:** reserva en la tarjeta y captura diferida (5 a 7 días). Nadie de BBQ custodia el dinero durante la espera.
- **Etapas de pagos:**
  1. Mercado Pago marketplace con reserva de fondos, orquestado por BBQ.
  2. Capa de pagos intercambiable.
  3. Con volumen, PSPC propio con adquirentes (Fiserv, Getnet, OCA).
- **Entregas:**
  - **Prueba de entrega:** quien entrega escanea el QR del comprador; ahí se cobra y se reparte en el acto.
  - **El envío lo vende BBQ** en nombre propio y lo terceriza con empresas de logística.
  - **Red propia de repartidores:** se posterga por la Ley 20.396.
- **Saldos después de la entrega:** nada de saldos guardados en la app, porque pueden contar como dinero electrónico (Libro VII). Se liquida directo a la cuenta bancaria.
- **Facturación electrónica:** obligatoria desde 1/1/2025, emitida automáticamente al cobrar.
- **Tipos de cuenta:** dos, **Particular** (con límites) y **Comercio**.
- **Ingresos:** comisión, margen de envío, cargo "Pago protegido", suscripción, publicidad, e IA administrada como opción.
  - **Ejemplo:** cerca de $113 por un pedido de $1.000.
  - **Arranque:** comisión 0 o baja.
- **Vendedores de BBQ:** cobran el 0,4% de las ventas entregadas de los comercios que suman.
- **Referidos:** quien trae 10 usuarios nuevos gana premios que ponen los comercios. El conteo lo lleva el servidor.
- **Cooperativa:** es una opción y no lo definitivo.
  - **Variante A:** SAS más una cooperativa de cadetes.
  - **Variante B:** toda BBQ como cooperativa.

## Decisión del dueño (2026-10-07): disputas y responsabilidad

> "Las disputas las resuelven entre vendedor y comprador. Las tiendas tienen que respaldar, al igual que el comprador, para poder litigar. BBQ se deslinda de todas las responsabilidades de las compras, ventas o interacciones entre los usuarios: solo abre el canal de comunicación."

- **Quién decide:** comprador y vendedor. BBQ no arbitra ni define quién tiene razón.
- **Respaldo de las dos partes:** para litigar, tanto la tienda como el comprador tienen que poner un respaldo. Queda por definir qué es:
  - un depósito o garantía;
  - identidad verificada;
  - pruebas;
  - o una combinación.
- **Rol de BBQ:** canal de comunicación (y, si hay dinero real, la herramienta que retiene). No es parte de la operación.

**Tensiones con el estudio, a revisar con abogado:**
- **Control del cobro:** en el esquema PedidosYa, BBQ Pagos decide capturar o cancelar. Ante un reclamo, esa decisión resuelve la disputa en los hechos, aunque nadie la llame arbitraje. Para ser coherente, el cobro tendría que liberarse por reglas fijas (QR escaneado, acuerdo de las dos partes o vencimiento) y no por criterio de BBQ.
- **Responsabilidad por el envío:** el estudio propone que BBQ venda el envío en nombre propio y responda por la entrega. Eso choca con deslindarse.
- **Defensa del consumidor:** la ley de relaciones de consumo (Ley 17.250) puede alcanzar al intermediario aunque los términos digan lo contrario. Hasta dónde se puede deslindar es una pregunta para el abogado.

## Decisiones abiertas

| Tema | Opciones | Lo que dice el estudio |
|---|---|---|
| Figura | Intermediario (esquema PedidosYa) o comisionista | Esquema PedidosYa, a confirmar con abogado y contador |
| Operativa de reparto y venta | Todo tercerizado con comisiones, o cooperativa | Encadenar: arrancar tercerizado (cadeterías y agentes comerciales) y proponer la cooperativa cuando haya un grupo estable. Ver §8b |
| Cooperativa | Una o varias; variante A o B | Sin resolver |
| Duración del 0,4% del vendedor | Mientras esté activo, o un plazo (p. ej. 24 meses) | Sin resolver |
| Comprobantes | Producto y envío en uno o en dos | Pregunta para el contador |

Las comisiones (porcentaje del envío para el cadete y 0,4% para el vendedor) **sirven en los dos modelos**, así que elegir entre tercerizado y cooperativa no cambia la app.

## Cruce con lo que ya está construido

### Lo que ya funciona y no choca con el estudio
- **Directorio de tiendas y servicios de entrega** con fichas firmadas (`/api/stores`). Publicar es gratis.
- **Pedidos con estados**, avisados por chat cifrado.
- **Bandeja "El agente propone"**: el agente propone y el dueño confirma.
- **Sellos de fidelidad firmados** por la tienda, guardados en el teléfono del cliente.
- **E2E, Centro de privacidad y código de seguridad.**
- **IA del comercio y no de BBQ:** coincide con el estudio ("la IA no es costo de BBQ").

Nada de esto toca dinero.

### Lo que el estudio pide cambiar (huecos, todavía sin código)

| Tema | Hoy en el código | Qué pide el estudio |
|---|---|---|
| **Código de entrega** | `escrow-engine.js` usa `simpleHash` y `verifyAndSettleScan` **no compara el código escaneado**: cualquier escaneo libera (en TEST) | Token por pedido firmado por el servidor de pagos, verificado en el servidor antes de capturar, más un código numérico de respaldo |
| **Saldos** | `merchantWallet` acumula saldo y permite "retirar" (`app.js`, `escrow-engine.js`) | Sin saldos guardados después de la entrega: liquidar directo a la cuenta bancaria. Rehacer el panel como "cobrado / en camino a tu cuenta" |
| **Capa de pagos** | `google-pay-engine.js` en TEST y `/api/pay` como stub | Interfaz `reservar / cobrar / cancelar / liquidar / facturar` con el proveedor intercambiable (primero Mercado Pago) |
| **Reparto al entregar** | Split de 3 partes simulado | Negocio: producto − comisión. Cadete: tarifa. BBQ: comisión + margen de envío |
| **Envío** | `logistics-engine.js` con tarifas en USD | Pesos uruguayos, configurable por vendedor y zona. El envío lo vende BBQ |
| **Modalidades** | Retiro en el local (`PICKUP`) y couriers como nodos | Empezar con retiro, envío del vendedor y empresas de logística. La red propia de repartidores se posterga (Ley 20.396). El directorio de "Entregas" sirve para cadeterías que se publican |
| **Vencimiento** | No existe | Cancelar la reserva si no hubo escaneo ni reclamo antes de que venza |
| **Tipos de cuenta** | No existe | Particular o Comercio, con límites y un paso a Comercio |
| **Facturación** | No existe | e-Ticket o e-Factura automática al cobrar, vía un proveedor habilitado |
| **Referidos** | `referral-engine.js` cuenta en el propio teléfono (inflable) | Conteo en el servidor, invitado real (teléfono verificado + primera compra), escalones de 3 y 10, premios = cupones del comercio con canje por QR |
| **Vendedores de BBQ (0,4%)** | No existe | Código o link de alta de comercio y panel de comisiones sobre ventas entregadas |
| **Fidelización de tiendas** | En Yo se ve como "se define con el modelo de negocio" | Comisión más baja al arrancar, visibilidad y comercios que refieren comercios |

### Lo que el estudio no cubre
- **Reseñas y reputación.** El diseño previsto es que solo reseñe quien pasó por un escrow real, con la reseña firmada por el comprador; encaja con el QR de entrega.
- **Resolución de disputas.** El estudio solo dice "reclamo → se frena el cobro → resolución". Ya está decidido: entre las partes, con respaldo de ambas (ver arriba).
- **Protección de datos (Ley 18.331) y P2P.**
  - BBQ Pagos va a necesitar datos del pedido en el servidor (monto, partes, estado, prueba de entrega), cuando hoy los pedidos viven solo en los teléfonos.
  - Un reclamo puede necesitar pruebas, y el chat es E2E, así que el servidor no las ve. Una opción es que el comprador las aporte voluntariamente.
  - Hay que definir el mínimo de datos que ve el servidor de pagos y documentarlo en el Centro de privacidad.

## Decisiones anteriores (5 al 8/09/2026)
- **Pasarela:** "Solo Google Pay en TEST por ahora". El estudio del 25/09 propone Mercado Pago marketplace como primera etapa real.
- **Hitos:** v1 es "atención real + dinero TEST"; v2 es dinero real con escrow real. Este estudio define cómo sería v2.
- **Documento visual de la app:** https://claude.ai/code/artifact/907712e6-4685-45ef-aa53-e4c1299e9a35

## Próximo paso según el estudio
Llevar las preguntas de la §9 de [`MODELO-PAGOS-Y-ENTREGAS.md`](MODELO-PAGOS-Y-ENTREGAS.md) a abogado, contador y adquirentes antes de invertir en dinero real.
