# BBQ — Modelo de pagos, entregas y estructura legal

> Documento de trabajo (2026-09-25). Resume el análisis hecho con Claude. **Orientativo: no es
> asesoramiento legal, fiscal ni contable.** Todo lo marcado "a confirmar" hay que validarlo con
> abogado, contador y adquirentes antes de invertir.

> **Origen:** estudio hecho en la PC del dueño (sesión del 25 y 26/09/2026, archivo `docs/MODELO-PAGOS-Y-ENTREGAS.md` de la copia local).
> Se subió al repo el 2026-10-07 sin cambios de fondo, más la sección 8b que había quedado solo en el chat.
> Cómo se cruza con lo que ya está construido: [`MODELO-NEGOCIO.md`](MODELO-NEGOCIO.md).

---

## 1. La propuesta de valor que hay que proteger

**"Pagás tranquilo: el dinero se libera cuando recibís."**
BBQ controla el pago contra entrega. Ese control no se puede delegar en un tercero sin perder el
diferencial del producto.

## 2. Estructura: el modelo PedidosYa

PedidosYa opera en Uruguay con **dos empresas** (según sus Términos y Condiciones):

| Empresa | Rol |
|---|---|
| Delivery Hero Uruguay Marketplace S.A. | La plataforma. Se define como **intermediaria**, no vendedora. |
| Delivery Hero Payments Uruguay S.A. | La empresa de pagos. **Inscripta en el BCU como Proveedor de Servicios de Pago y Cobranza (PSPC)** — comunicado BCU del 16/03/2023. |

Lección: para cobrar por cuenta de terceros **hizo falta la inscripción en el BCU**, y separar
plataforma de pagos permite **controlar el cobro y los reembolsos sin ser el vendedor** de cada
producto (menos responsabilidad ante el consumidor).

**Modelo para BBQ:**

| Empresa | Qué hace |
|---|---|
| **BBQ Marketplace (SAS uruguaya)** | App: feed de estados y productos, chat, Agente Tienda, pedidos. Intermediaria. Factura su comisión. |
| **BBQ Pagos (SAS inscripta en BCU como PSPC)** | Cobra con tarjeta por cuenta de vendedores y repartidores, **retiene hasta la entrega**, cobra o cancela, liquida a cada parte. |

Alternativa evaluada: **comisionista** (BBQ vende en nombre propio por cuenta ajena; DGI tiene el
CFE "e-Ticket / e-Factura venta por cuenta ajena"). Da control total pero BBQ pasa a ser parte de la
venta y responde por el producto. El esquema PedidosYa logra el mismo control del pago con menos
responsabilidad. **Decidir con abogado/contador.**

Descartado:
- **Corredor puro** (solo conecta, no toca el dinero): pierde el pago contra entrega.
- **Empresa en el exterior / otro régimen fiscal**: la Ley 19.535 (2018) grava igual a plataformas
  extranjeras que intermedian en Uruguay (100% fuente uruguaya si ambas partes están acá; IRNR + IVA),
  y facturar CFE, contratar adquirente local y liquidar a vendedores exige presencia local.
- **Zona franca**: pensada para exportar; no sirve para vender a consumidores en Uruguay.
- **Crédito propio / BNPL con fondos de inversores**: es intermediación financiera + usura
  (Ley 18.212) + eventualmente crowdfunding (Ley 19.820, autorización BCU, garantía UI 250.000).
  Solo como etapa muy posterior, con socios del rubro. Mientras tanto: cuotas vía terceros.
- **Escrow en blockchain / stablecoins**: choca con la Ley 20.345 de activos virtuales (autorización
  BCU para custodia/transferencia) y con la facilidad de uso.

Si más adelante entran inversores del exterior: holding afuera (típicamente Delaware) dueña de las
SAS uruguayas. No hace falta al inicio.

## 3. Pagos: cómo funciona la retención

Mecanismo: **reserva de fondos / captura diferida** (preautorización de tarjeta de crédito).
El banco del comprador **reserva** el monto sin cobrarlo; BBQ decide después si **captura** (cobra) o
**cancela** (libera). Nadie de BBQ custodia el dinero durante la espera.

- Plazo para capturar: **5 a 7 días** según documentación de Mercado Pago (a confirmar para Uruguay
  y para el adquirente que se use). Pasado el plazo, la reserva se cae sola.
- Funciona con **tarjeta de crédito**. Débito y otros medios, en general no.
- Para entregas de más de ~5 días: variante **cobro inmediato + liberación diferida al vendedor**.
- Después de capturar, el comprador todavía puede hacer un **contracargo** en su banco: la prueba de
  entrega (QR) es la defensa.

### Etapas de implementación
1. **Ya (sin empresa de pagos propia):** Mercado Pago marketplace + reserva de fondos. La protección
   **igual la orquesta BBQ** (BBQ decide capturar/cancelar); el comprador ve "Pago protegido por BBQ".
2. **Capa de pagos intercambiable** en el código: `reservar / cobrar / cancelar / liquidar / facturar`
   sin depender del proveedor.
3. **Con volumen:** BBQ Pagos inscripta como PSPC + contrato directo con adquirentes (Fiserv, Getnet,
   OCA — multiadquirencia desde 2021). Cambiar la pieza de abajo sin que el usuario note nada.
   Referencia de facilitador local: **Handy**.

### Pago directo (opcional, sin protección)
Transferencia bancaria instantánea (7x24 desde junio 2023) o efectivo, para contactos de confianza.
Rotulado claramente como "sin protección". BBQ no toca el dinero.

## 4. Entregas (diseño ya existente en BBQ, a volver real)

Base: `www/js/escrow-engine.js` (escrow de 3 partes) + `www/js/logistics-engine.js` (tarifas por zona).

### El flujo
```
Pedido confirmado
  └─► PAGO RESERVADO (producto + envío)
        ├─► EN PREPARACIÓN ─► EN CAMINO
        │     └─► ENTREGA: quien entrega ESCANEA EL QR DEL COMPRADOR
        │           └─► código válido ─► COBRO ─► reparto: producto → vendedor, envío → repartidor
        │                              ─► FACTURACIÓN automática
        ├─► RECLAMO ─► se frena el cobro automático ─► resolución
        └─► sin entrega en plazo ─► CANCELACIÓN ─► se libera la reserva
```

**Por qué el QR lo tiene el comprador:** el repartidor solo puede liberar el pago si está físicamente
con el comprador. Es una prueba de entrega mucho más fuerte que un botón "recibido".

### Decisión (25/09): el envío es un servicio de BBQ, tercerizado

Cuando el comprador paga envío, **BBQ vende el envío en nombre propio** y lo **terceriza** con
empresas de logística:

| Qué | Quién vende / factura | A quién |
|---|---|---|
| Producto | Vendedor (esquema PedidosYa) o BBQ por cuenta ajena (comisionista) | Comprador |
| **Envío** | **BBQ (en nombre propio)** — e-Ticket con IVA | Comprador |
| Transporte | Empresa de logística | BBQ |

- **Margen de BBQ en envíos** = envío cobrado − costo de la logística (BBQ descuenta el IVA compras).
- **El cadete cobra al entregar, igual que el negocio** (decisión 25/09). Al escanear el QR se cobra
  y se reparte en el acto:
  ```
  Negocio: precio del producto − comisión BBQ
  Cadete:  tarifa del cadete
  BBQ:     comisión + (envío cobrado − tarifa del cadete)
  ```
  El cadete / la cadetería le factura su tarifa a BBQ (automatizable o resumen periódico).
- **"Cobra al entregar" ≠ dinero en el instante:** el adquirente deposita a BBQ días después.
  Opciones: (a) acreditar "cobrado" al entregar y transferir cuando llegan los fondos (lo usual);
  (b) adelantar al instante con transferencia 7x24 → requiere **capital de trabajo** y asumir el riesgo
  de contracargos.
- **BBQ retiene TODO hasta que el cadete entrega** (idea central): ni negocio ni cadete reciben nada
  antes del escaneo. La retención es (a) reserva en la tarjeta (entregas ≤ 5–7 días) o (b) cobro
  inmediato con el dinero guardado por BBQ Pagos en cuenta separada hasta la entrega (entregas largas;
  actividad propia del PSPC, como PedidosYa).
- **Evitar saldos guardados en la app DESPUÉS de la entrega:** una vez liberado, si negocio o cadete
  acumulan saldo dentro de BBQ para retirarlo cuando quieran, puede
  considerarse **dinero electrónico** (lo más regulado, Libro VII BCU). Preferir liquidar directo a la
  cuenta bancaria. Hoy `escrow-engine.js` tiene `merchantWallet` con saldo y retiro → revisar con abogado.
- Cadete individual contratado vía BBQ → Ley 20.396 aplica a BBQ y el cadete debe poder facturar
  (unipersonal / monotributo). Cadetería o empresa de logística → la ley aplica a ella.
- **BBQ responde ante el comprador por la entrega** → el contrato con la logística debe cubrir
  pérdida, demora, daño y **quién paga el envío fallido** (el comprador no paga si se cancela).
- **Ley 20.396:** tercerizando con **empresas** de logística, en principio aplica a ellas y no a BBQ.
  Contratar repartidores individuales vía la app volvería a aplicarle a BBQ. Confirmar con abogado.
- El **QR de entrega** lo escanea el repartidor de la empresa de logística (integración o su app).
- A confirmar con contador: ¿producto y envío en uno o dos comprobantes? ¿Qué SAS factura el envío?
  (lo lógico: BBQ Marketplace).

### Modalidades de entrega
| Modalidad | Quién escanea | Estado |
|---|---|---|
| **Retiro en el local** | El vendedor | En el diseño (`deliveryMode: 'PICKUP'`, envío $0) |
| **Envío propio del vendedor** | El vendedor o su empleado | A agregar (mismo flujo) |
| **Empresa de logística** (DAC, UES, etc.) | El cadete de la empresa, vía su app o integración | A investigar integraciones |
| **Red de repartidores BBQ** | El repartidor | En el diseño (couriers como nodos). **Postergar**: ver Ley 20.396 |

**Ley 20.396 (vigente desde 13/05/2025):** regula el trabajo en plataformas de reparto y transporte:
derechos mínimos, capacitación previa obligatoria, herramientas de trabajo, distinción dependiente /
autónomo. Tener repartidores propios implica cumplirla. Empezar con retiro, envío del vendedor y
empresas de logística.

### Qué hay que hacer real (hoy es simulación)
- [ ] **Código de entrega real**: token por pedido **firmado por el servidor de pagos** (no el
      `simpleHash` actual). `verifyAndSettleScan` hoy **no compara el código escaneado**: cualquier
      escaneo libera el pago.
- [ ] **Código numérico de respaldo** (4–6 dígitos) para cuando no hay cámara, como el "código de
      entrega" de las apps de delivery.
- [ ] Verificación **en el servidor** antes de capturar; la app del repartidor puede quedar offline y
      sincronizar después.
- [ ] Opcional: foto y ubicación al entregar, para reclamos y contracargos.
- [ ] Pedidos **persistentes** en el servidor de pagos (hoy hay un pedido de ejemplo en memoria).
- [ ] Tarifas en **pesos uruguayos** (hoy USD) y configurables por vendedor / zona.
- [ ] Regla de vencimiento: si no hubo escaneo ni reclamo, **cancelar** (o capturar si hay otra prueba
      de entrega) antes de que venza la reserva.
- [ ] Liquidación en el acto de la entrega a **negocio y cadete** desde BBQ Pagos (se mantiene el split
      del diseño original), con BBQ reteniendo comisión + margen de envío. Liquidar a cuenta bancaria,
      sin saldos guardados en la app.

## 5. Facturación automática

- Facturación electrónica **obligatoria desde 1/1/2025** para contribuyentes de IVA (incluye
  Literal E). **Monotributistas exceptuados.** Formato CFE v25.1 vigente desde 3/3/2026.
- Cada venta: **e-Ticket** (consumidor final) o **e-Factura** (comprador con RUT), emitida
  **automáticamente al cobrar**, vía API de un proveedor habilitado de facturación electrónica.
- Quién emite depende del modelo (a definir con contador):
  - Esquema PedidosYa: el vendedor factura su venta (BBQ lo automatiza en su nombre, con autorización);
    BBQ factura su comisión al vendedor.
  - **Envío (si el comprador lo paga): lo factura BBQ al comprador en nombre propio**; la empresa de
    logística le factura a BBQ (ver §4).
  - Comisionista: BBQ emite "venta por cuenta ajena" y liquida al vendedor.
- Emitir al **cobrar**, no al reservar (la venta se concreta con el cobro). Confirmar con contador.

## 6. Vendedores particulares (sin empresa)

Principio general (a confirmar con contador/DGI): IVA e IRAE alcanzan la **actividad empresarial**
(habitual y organizada). Quien vende algo propio **de vez en cuando** en principio no necesita ser
empresa; quien vende **seguido** o compra para revender debe inscribirse (p. ej. **monotributo**).

Dos tipos de cuenta:

| | **Particular** | **Comercio** |
|---|---|---|
| Requiere | Cédula, identidad verificada, cuenta bancaria a su nombre | RUT, datos fiscales, cuenta bancaria |
| Factura el producto | No: el comprador recibe un **comprobante de compra de BBQ** (no fiscal) | Sí, automática (e-Ticket / e-Factura) |
| Pago protegido + QR de entrega | Igual | Igual |
| Límites | Sí: pasado cierto nº de ventas o monto, BBQ le pide pasar a Comercio | Sin límite |

- Los cargos propios de BBQ **siempre** se facturan: envío y protección al comprador; comisión al
  particular (como consumidor final).
- La verificación de identidad se necesita igual por prevención de lavado (empresa de pagos).
- Los límites evitan comercios encubiertos y sirven para ofrecer: "vendés seguido → pasate a
  monotributo y facturamos por vos".
- Otro punto a favor del **esquema intermediario** (tipo PedidosYa): como comisionista, BBQ tendría que
  emitir "venta por cuenta ajena" a nombre de alguien sin RUT.

## 7. Modelo de ingresos (borrador)

| # | Fuente | Paga | Cuándo |
|---|---|---|---|
| 1 | Comisión por venta | Negocio (% del producto) | Por venta entregada |
| 2 | Margen de envío | Comprador (envío cobrado − tarifa del cadete) | Por venta con envío |
| 3 | **Cargo "Pago protegido"** | Comprador (monto chico por la garantía) — modelo **Vinted** | Por venta protegida |
| 4 | Suscripción para negocios | Negocio: catálogo, estadísticas, facturación automática, destacados | Mensual |
| 5 | Publicidad en el feed | Negocio | Por campaña |
| 6 | (Opcional) IA administrada por BBQ | Negocio que no quiera gestionar su propia clave | Mensual / por uso |

- **La IA NO es costo de BBQ:** cada comercio conecta su propia IA (clave de API o modelo en el
  dispositivo). La opción 6 es solo para quien prefiera que BBQ la gestione, cobrando más de lo que cuesta.
- Ejemplo ilustrativo (supuestos, no datos): producto $1.000 + envío $150 → comisión 10% (+$100) +
  margen envío (+$30) + protección 3% (+$30) − procesamiento de tarjeta ~4% (−$47) ≈ **$113 por
  pedido (~10%)**. Las tasas reales hay que pedirlas a adquirentes y cadeterías.
- **Costos fijos:** servidor(es), mantenimiento, la empresa o cooperativa (contador, DGI, BPS),
  proveedor de facturación electrónica, cumplimiento de la empresa de pagos (prevención de lavado),
  cuentas de desarrollador de las tiendas de apps, seguro de responsabilidad civil, asesoramiento legal.
- **Costos variables:** procesamiento de tarjetas, contracargos/fraude, envíos,
  **almacenamiento de fotos y videos del feed** (lo que más crece con los usuarios).
- Encendido en el tiempo: (1) arranque con comisión 0 o muy baja a negocios, cobrando envío +
  protección al comprador; (2) suscripción; (3) publicidad cuando haya audiencia; (4) con volumen,
  subir comisión y bajar costo de tarjetas con empresa de pagos propia.
- Métrica que manda: **volumen de ventas × % que BBQ retiene**.

## 7b. Bonos por nuevos usuarios (premios que ceden los comercios)

Idea del usuario: si un usuario trae **10 usuarios nuevos**, gana premios que **ponen los comercios**.
Base existente: `www/js/referral-engine.js` (meta de 20 contactos, premios de ejemplo, **simulado**).

- **Gana todo el mundo:** el usuario obtiene premios; el comercio gana visibilidad y un cliente que va
  a canjear (y suele comprar algo más); BBQ crece **sin costo** (los premios los pone el comercio).
- **Doble lado:** premio para quien invita **y** cupón de bienvenida para el invitado.
- **Escalones:** algo chico a los 3 invitados, el premio fuerte a los 10.
- **Premios = cupones del comercio** (envío gratis, descuento, producto de regalo) con **cupo** y
  **vencimiento**; el comercio define condiciones. **Canje con QR** (misma tecnología que la entrega)
  → el comercio mide cuántos clientes le trajo el programa.
- **Antifraude (lo más importante):**
  - un invitado cuenta solo si es real: teléfono verificado + **primera acción real** (ideal: primera
    compra entregada; mínimo: X días de uso);
  - una cuenta por teléfono y por dispositivo;
  - **el conteo lo lleva el servidor**, no la app (hoy `referral-engine.js` cuenta en el propio
    teléfono → inflable).
- **Legal:** premios por **alcanzar una meta**, no sorteos (un sorteo suele requerir autorización).
  Bases y condiciones claras, revisadas por abogado.

## 8. Opción (NO definitiva): cooperativa de cadetes

> El usuario aclaró (25/09): **es una opción a evaluar, no el modelo definitivo.**

Referencia: "cooperativismo de plataforma" — **CoopCycle** (federación europea de ~60 cooperativas de
repartidores, app de código abierto) y **Mensakas** (Barcelona).

Ventajas en Uruguay (Ley 18.407, cooperativas de trabajo — confirmar con contador): exoneración de
tributos nacionales salvo IVA e IMESI; sin aportes patronales salvo FONASA y jubilatorio → envío más
barato y cadetes que ganan más. Ordena la parte laboral (socios trabajadores, no "falsos autónomos"),
genera fidelidad y es una buena historia ("reparto justo").

Variantes:
- **A — BBQ empresa + cooperativa de cadetes (preferida si se usa):** BBQ (SAS) conserva tecnología,
  marca y pagos; terceriza el envío con la cooperativa (lo que ya estaba definido, cambia quién reparte).
  Se puede reforzar con contrato de largo plazo, tarifa acordada o participación en ingresos de envío.
  Futuro posible: ofrecer la app de reparto a otras cooperativas (como CoopCycle).
- **B — todo BBQ como cooperativa:** coherencia total, pero 1 socio = 1 voto, excedentes por trabajo
  (no por capital), no entran inversores con participación, decisiones más lentas, y el fundador pasa
  a ser un socio más (¿cómo se reconoce la tecnología aportada?).

### Detalle de la variante B: BBQ entera como cooperativa, por roles y comisiones

Idea del usuario: BBQ es la cooperativa, con socios en distintas tareas; **cadetes y vendedores
motivados por comisión**. En una cooperativa de trabajo el reglamento interno (votado en asamblea)
define cómo se paga cada tarea.

| Rol | Anticipo | Incentivo |
|---|---|---|
| **Cadete** | **Comisión por entrega**: % del envío (p. ej. 70–80%) o base por zona + extras (pico, lluvia, distancia, calificación) | Más entregas → más ingreso |
| **Vendedor (alta de comercios)** | **0,4% de cada venta entregada de sus comercios** (+ bono chico opcional por alta tras las primeras ventas) | Sumar comercios y acompañarlos para que vendan |
| Tecnología, atención, administración | Fijo por horas / rol | — |

Reglas de la comisión del vendedor (0,4%):
- Sobre **ventas entregadas** (post-QR), neto de cancelaciones y contracargos; se calcula al entregar,
  con el mismo módulo que la del cadete, y se ve al instante en su panel.
- **Duración a definir**: mientras el vendedor esté activo, o plazo largo (p. ej. 24 meses). Evitar
  comisiones perpetuas por comercios de alguien que ya no está.
- Cada comercio queda asignado al vendedor que lo activó (código/link de alta — evolución de
  `www/js/referral-engine.js`, que hoy es invitación de usuarios con premios simulados). Bono revertible
  si el comercio se da de baja o hay fraude en los primeros meses; solo comercios verificados.
- Economía (ejemplo $1.000): con comisión 10% al comercio BBQ queda ≈ $109 tras el 0,4%; **en el
  arranque con comisión 0 al comercio queda ≈ $9** → aguanta pero justo, vigilarlo.
- Ilustrativo: comercio de $200.000/mes → $800/mes al vendedor; 30 comercios de $100.000 → $12.000/mes.

Flujo común: todos los ingresos entran a la cooperativa → costos fijos → anticipos fijos → reservas
legales. **Excedente de fin de año en proporción a los anticipos cobrados** → el cadete que más
entregó y el vendedor con más ventas de sus comercios reciben más.

Crecimiento complementario: comercios que refieren comercios (crédito en su comisión) y usuarios que
invitan usuarios (programa existente, con premios que ponen los comercios — ver §7b).

A resolver con abogado cooperativista: piso mínimo de anticipos (¿laudo de la categoría? → "mínimo
garantizado + comisión"), límite de trabajadores no socios, **aporte de la tecnología del fundador como
capital en especie**, equilibrio de votos (cadetes mayoría → estatuto con comisiones por área o mayorías
especiales para decisiones técnicas), y si la cooperativa puede inscribirse como PSPC o conviene una
entidad de pagos controlada por ella.

Sostenibilidad: una cooperativa en marcha se sostiene con sus socios (los costos fijos son bajos y la
IA la pone cada comercio). El hueco es el **arranque** (tecnología, primeros usuarios, empresa de pagos,
capital de trabajo). Fuentes sin inversores: aportes de socios, programas públicos (INACOOP, ANII),
préstamos, capital de terceros sin voto previsto en la ley de cooperativas (confirmar), o crecer
despacio con los propios ingresos.

## 8b. Comparación: todo tercerizado con comisiones vs cooperativa

> Agregada al repo el 2026-10-07. Salió en la charla del 26/09 y **no había entrado al documento**. **La decisión sigue abierta**; lo de abajo es la recomendación de esa charla, no algo decidido.

Pregunta del dueño: *"¿Y cómo sería al revés, si fuera todo tercerizado y se ofrecen comisiones?"*

Pregunta del usuario: *"Y como sería al revés si fuera todo tercerizados y ofrece comisiones?"*

Es el modelo de la mayoría de las plataformas, como Uber o Rappi en sus inicios: **BBQ como empresa (SAS) con un equipo chico, y todos los que hacen la operativa como independientes que cobran por comisión.**

#### Cómo funcionaría
| Rol | Quién es | Cómo cobra | Qué factura |
|---|---|---|---|
| **Cadetes** | **Cadeterías o empresas de logística**, o cadetes independientes (monotributo o unipersonal) | Por entrega (% del envío) | Le facturan a BBQ |
| **Vendedores** | **Agentes comerciales independientes** con contrato de agencia | 0,4% de las ventas de sus comercios | Le facturan a BBQ |
| **Tecnología, pagos, marca** | BBQ (SAS), vos y un equipo mínimo | — | — |

#### A favor
- **Lo más rápido y barato para arrancar:** no hay que armar la cooperativa, ni asambleas, ni estatuto. Pagás solo por resultados.
- **Control total de la plataforma** y posibilidad de traer inversores.
- **La comisión pura motiva:** el que más entrega o más vende, más gana.
- **Escala fácil:** sumar gente es firmar un contrato más.

#### En contra y riesgos
1. **El riesgo laboral es el más serio.** Si BBQ contrata **cadetes individuales**, le aplica la **Ley 20.396** de repartidores de plataformas. Además, si BBQ les fija horarios, les impone tarifas, los sanciona o les exige exclusividad, **un juez puede considerarlos empleados**, con todos los aportes y beneficios retroactivos. En Uruguay ya hubo fallos judiciales en ese sentido con choferes de aplicaciones. Lo mismo aplica a los vendedores.
2. **Menos control sobre la calidad.** Para que sigan siendo independientes, no les podés dirigir demasiado el trabajo, y eso choca con la promesa de "BBQ responde por la entrega".
3. **Menos compromiso y más rotación.** Un independiente trabaja con varias apps a la vez y se va a la que pague mejor.
4. **Pierde las ventajas de la cooperativa:** las exoneraciones de impuestos y aportes, y la historia de "reparto justo".

#### Si vas por este camino, cómo cuidarte
- **Preferir cadeterías y empresas de logística** antes que cadetes individuales, así la Ley 20.396 y la relación laboral quedan del lado de ellas.
- **Vendedores con contrato de agencia claro:** sin horarios, sin exclusividad, libres de vender otras cosas, cobrando solo por resultados.
- **No dar señales de dependencia:** nada de sanciones, horarios obligatorios ni exclusividad.

#### Comparación rápida
| | Todo tercerizado | Cooperativa |
|---|---|---|
| **Velocidad para arrancar** | ✅ Muy rápida | Más lenta (armar la cooperativa) |
| **Costos fijos** | ✅ Mínimos | Bajos |
| **Costo por entrega** | Más alto (el independiente paga sus aportes e IVA) | ✅ Más bajo (exoneraciones) |
| **Riesgo laboral** | ⚠️ Alto si hay cadetes individuales | ✅ Bajo (socios dueños) |
| **Control de la plataforma** | ✅ Total | Compartido |
| **Compromiso de la gente** | Bajo, alta rotación | ✅ Alto |
| **Inversores** | ✅ Posibles | Difícil |

#### Lo que haría
Los dos modelos no se excluyen y se pueden **encadenar**:
1. **Arrancar tercerizado**, con **cadeterías** para el reparto y **agentes comerciales** para vender. Es lo más rápido para validar que BBQ funciona.
2. **Cuando se forme un grupo estable** de cadetes y vendedores comprometidos, **proponerles la cooperativa**. Ellos pasan a ser dueños de la operativa, y BBQ gana en costos, compromiso y seguridad laboral.

Las comisiones que definiste (el % del envío y el 0,4% para vendedores) **sirven igual en los dos modelos**, así que el cambio de uno a otro no toca la app.

---

## 9. Preguntas para llevar

**Abogado (regulación BCU):**
1. Para replicar el esquema PedidosYa (marketplace + empresa de pagos), ¿qué requisitos, costos,
   plazos y obligaciones de prevención de lavado tiene la inscripción como PSPC (Libro IX)?
2. ¿Hay diferencia regulatoria entre ser intermediario (esquema PedidosYa) y comisionista?
3. Términos y condiciones: responsabilidad ante el consumidor, reclamos, contracargos.
4. Ley 20.396: diferencia entre tercerizar con cadeterías/empresas de logística y contratar cadetes
   individuales vía la app.
5. Si negocios y cadetes ven un "saldo cobrado" en la app antes de la transferencia, ¿cuenta como
   dinero electrónico? ¿Cómo diseñarlo para que no lo sea?
6. Adelantar pagos a cadetes con capital propio: ¿implicancias regulatorias?

**Contador:**
1. IVA e IRAE en cada esquema (intermediario vs comisionista / venta por cuenta ajena).
2. Vendedores monotributistas o sin RUT.
3. Facturación automática en nombre del vendedor; momento de emisión.
4. Beneficios posibles (Ley de Inversiones, programas ANII).
5. Envío vendido por BBQ en nombre propio y comprado a cadetes/cadeterías: IVA, y cómo factura el
   cadete individual (unipersonal / monotributo). ¿Producto y envío en uno o dos comprobantes?
6. Particulares: ¿dónde está el límite entre venta ocasional y habitual? ¿BBQ / la empresa de pagos
   debe informar a DGI esas ventas? ¿Cómo se factura la comisión a un particular?
7. Si se evalúa la cooperativa de cadetes: régimen tributario y de aportes real de una cooperativa de
   trabajo de reparto, y cómo factura a BBQ.

**Adquirentes (Fiserv, Getnet, OCA) y Handy:**
1. ¿Nos dan de alta como comercio, como marketplace o nos exigen ser facilitador de pagos?
2. ¿Soportan preautorización / captura diferida? ¿Plazo máximo?
3. Requisitos, garantías, tasas y plazos de liquidación.

---

## Fuentes
- PedidosYa Uruguay — Términos y condiciones: https://www.pedidosya.com.uy/about/terminos-condiciones
- BCU — Delivery Hero Payments Uruguay S.A., inscripción: https://www.bcu.gub.uy/Comunicados/seggco23048.pdf
- BCU — Libro IX (PSPC): https://www.bcu.gub.uy/Acerca-de-BCU/Normativa/Documents/Recopilacion-de-Normas/Sistema-de-Pagos/LIBRO%20IX.pdf
- BCU — Libro VII (dinero electrónico): https://www.bcu.gub.uy/Acerca-de-BCU/Normativa/Documents/Recopilacion-de-Normas/Sistema-de-Pagos/LIBRO%20VII.pdf
- Mercado Pago — Reservar, capturar y cancelar fondos: https://www.mercadopago.com.ar/developers/es/docs/checkout-api-v2/payment-management/reserve-capture-cancel
- Mercado Pago Uruguay — Marketplace: https://www.mercadopago.com.uy/developers/es/docs/split-payments/integration-configuration/integrate-marketplace
- Multiadquirencia en Uruguay: https://www.montevideo.com.uy/Negocios-y-Tendencias/La-nueva-competencia-por-procesar-las-ventas-de-los-comercios-uruguayos-uc817940
- DGI — Venta por cuenta ajena (instructivo CFE): https://www.efactura.dgi.gub.uy/files/esta-disponible-nuevo-instructivo-con-el-procedimiento-a-seguir-para-el-ingreso-al-sistema-de-cfe--incluye-cfe-venta-por-cuenta-ajena
- DGI — Universalización de la facturación electrónica: https://www.efactura.dgi.gub.uy/principal/ampliacion_de_contenido/universalizacion-de-facturacion-electronica-plazo-para-restantes-contribuyentes-de-iva
- Plataformas digitales, tributación (Ley 19.535): https://ccea.com.uy/items/informe-tecnico-tratamiento-fiscal-de-las-plataformas-digitales-en-uruguay/
- SAS: https://www.uruguayemprendedor.uy/tramite/sociedades-por-acciones-simplificadas-2/
- Ley 20.396 (trabajo en plataformas): https://www.impo.com.uy/bases/leyes-originales/20396-2025
- Ley 20.345 (activos virtuales): https://www.brumcosta.com/es/notes/ley-de-activos-virtuales-n020-345
- Ley 18.212 (usura): https://www.bcu.gub.uy/Leyes%20y%20Decretos/ernp18212.pdf
- Ley 18.407 (cooperativas): https://www.impo.com.uy/bases/leyes/18407-2008
- Tratamiento tributario de cooperativas en Uruguay: https://dec.revistas.deusto.es/article/download/2676/3253
- CoopCycle: https://blog.emprendimientocolectivo.org/el-cooperativismo-de-plataforma-como-una-alternativa-tecnologica-pero-no-solo-tecnologica-el-caso-de-coopcycle-y-su-importancia-para-la-economia-social/
- Mensakas: https://mensakas.com/nueva-web-mensakas/
- Formas de tributación (monotributo): https://www.uruguayemprendedor.uy/tramite/formas-de-tributacion/
- Crowdfunding (Ley 19.820): https://www.ferrere.com/es/novedades/el-banco-central-del-uruguay-emite-la-nueva-reglamentacion-para-regular-el-crowdfunding/
