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

## Decisión del dueño (2026-10-11): identidad verificada para comerciar y pagos con freno en la captura

> "El que instala la app escanea su documento vía chip NFC; una vez lo valida, puede usar tarjetas vía Google Pay o tarjeta con chip vía NFC, y la app para el proceso de la transacción en el cobro." Se exige para **comprar, vender o repartir: todo lo que implique transacciones**.

- **La mensajería sigue libre.** El documento no se pide para instalar ni para chatear. Solo se pide para comerciar o repartir.
- **Verificación con el chip del documento:**
  - **Pasaporte:** estándar ICAO 9303. Los datos y la foto vienen firmados por el país emisor y se pueden verificar en el teléfono.
  - **Cédula uruguaya con chip:** a confirmar qué se lee sin PIN y cómo se valida (Agesic / ID Uruguay).
- **Privacidad (Ley 18.331):** la verificación se hace en el teléfono. Al servidor o al directorio llega solo "identidad verificada" más un hash, nunca la foto ni el número de documento.
- **Para qué sirve:**
  - es el **respaldo** de las dos partes para litigar (ver la decisión de disputas);
  - sirve para el paso de Particular a Comercio;
  - y evita las cuentas falsas en los referidos.
- **Medios de pago**, los dos dentro de la app nativa (en la PWA no hay acceso a NFC para pagos):
  - **Google Pay:** con la API de Google Pay, no con la facturación de Google Play, que es para cosas digitales.
  - **Tarjeta con chip por NFC:** el teléfono del vendedor o del cadete hace de posnet (SoftPOS / Tap to Pay), mediante el kit certificado de un proveedor con adquirente.
- **"Parar la transacción en el cobro" = autorizar ahora y capturar después.** La app no puede pausar el intercambio entre la tarjeta y el lector. Lo que hace es pedir solo la **autorización** (el banco del comprador bloquea el monto) y dejar la **captura** en suspenso hasta que se cumpla la regla:
  - se captura con el QR de entrega escaneado o con el acuerdo de las partes;
  - se cancela cuando vence el plazo.

  La plata nunca pasa por BBQ, y esto es coherente con el estudio (§3) y con no arbitrar.

- **El titular de la tarjeta tiene que coincidir con el documento verificado** (agregado el 11/10). Cómo se puede comprobar:
  - **Leer el nombre de la tarjeta por NFC no alcanza.** Muchas tarjetas sin contacto no traen el nombre (va vacío por privacidad), y Google Pay entrega un token sin nombre.
  - **Lo confiable es preguntarle al banco emisor:** las consultas de nombre del titular (Visa y Mastercard "Account Name Inquiry") devuelven "coincide / parcial / no coincide" en una verificación de monto cero. Además, 3-D Secure prueba que quien paga controla la cuenta.
  - **Comparar nombres no es trivial:** hay abreviaturas, tildes, segundos nombres y nombres recortados en el plástico. Hace falta tolerar coincidencias parciales.
  - **Casos a definir:**
    - tarjeta de un familiar (no se podría);
    - tarjeta adicional a nombre propio sobre la cuenta de otro;
    - tarjeta de empresa en una cuenta Comercio, que se compararía contra el RUT o la razón social.
  - **Simetría del lado de quien cobra:** la cuenta bancaria donde se liquida al vendedor o al cadete también tendría que estar a nombre del verificado.

**A confirmar con proveedores y adquirentes:**
- quién ofrece SoftPOS en Uruguay;
- si permiten la preautorización en cobros sin contacto;
- el plazo máximo de la retención por tarjeta y por rubro;
- el PIN para montos altos;
- el permiso de Apple para Tap to Pay en iPhone.

## Decisión del dueño (2026-10-11, b): cada vendedor cobra en su cuenta, compra firmada y vías de cobro por NFC

### Quién cobra: cada vendedor en su propia cuenta ("modelo A")
- El vendedor (y la cadetería, por el envío) tiene **su propia cuenta** en el proveedor de pagos (p. ej. Mercado Pago) y la conecta a BBQ.
- BBQ crea el pago **en nombre del vendedor**:
  - pide solo la autorización;
  - **controla la captura** (QR de entrega, acuerdo de las partes o vencimiento);
  - cobra su comisión con un reparto automático (split).
- **El que cobra ante la red de tarjetas es el vendedor, así que los contracargos le llegan a él.** BBQ solo pierde su comisión de esa venta.
- **Factura** el vendedor. Ojo: lo que define quién recibe el contracargo no es quién factura, sino a nombre de quién está la cuenta que procesó la tarjeta.
- **Cambia el estudio:** reemplaza al "modelo B" (BBQ Pagos cobra a nombre propio y reparte, esquema PedidosYa) como dirección preferida.
  - Simplifica lo regulatorio: BBQ no cobra a nombre propio y la plata no pasa por BBQ ni de paso.
  - El envío deja de venderlo BBQ en nombre propio: lo cobra el vendedor o la cadetería en su cuenta.
  - A confirmar con el abogado: si orquestar la captura igual exige registrarse como PSPC.

### Contracargos: por qué existen y cómo se pelean
- El titular puede reclamar en su banco ("no lo reconozco", "no me llegó"). El banco le devuelve la plata y se la descuenta a quien cobró. Decide el banco del titular, con las reglas de Visa o Mastercard: es una instancia por encima de BBQ y de las partes que no se puede evitar.
- **Las pruebas que la red reconoce siempre** son el criptograma del chip (pago presencial certificado) y 3-D Secure (pago online). Con 3-D Secure, la responsabilidad del fraude pasa al banco emisor.
- **Los términos no pueden quitarle al comprador el derecho al contracargo** ni sus derechos como consumidor (Ley 17.250). Lo que sí se puede es juntar pruebas que hagan perder un reclamo de mala fe.

### Compra firmada con identidad digital
Al comprar, el comprador **firma** un resumen: qué compra, a quién, el monto, la versión de los términos y la fecha. Hay dos niveles:
1. **Con la cédula uruguaya con chip:** firma electrónica avanzada (Ley 18.600), que equivale a la firma de puño y letra. A confirmar si Agesic permite firmar desde el celular por NFC.
2. **Con la clave de identidad de la app** (ECDSA, la que ya existe), atada a la persona que verificó su documento. Es más débil legalmente, pero no depende de terceros.

El comprobante firmado queda **en los teléfonos de comprador y vendedor**, y al servidor solo llega un hash.

**Paquete de pruebas:**
1. Identidad verificada con el documento.
2. Compra firmada: contra el "no fui yo".
3. QR de entrega escaneado y firmado por quien entrega: contra el "no me llegó".

El vendedor lo presenta ante un contracargo, y también es el respaldo de las partes en las disputas entre ellas.

### Vías de cobro con tarjeta por NFC
| Vía | Cómo funciona | Qué hace falta | Contracargos | Estado |
|---|---|---|---|---|
| **1. SoftPOS certificado (cobro directo por NFC)** | El comprador acerca su tarjeta o celular al teléfono del vendedor o cadete, que hace de posnet. Autorización ahora, captura al entregar | Kit (SDK) de un proveedor con kernel EMV certificado (EMVCo/marcas) y certificación del teléfono como terminal (PCI MPoC), más un adquirente. App nativa; en iPhone, el permiso de Apple | El criptograma del chip prueba que la tarjeta estuvo presente | **Viable** si un proveedor lo ofrece en Uruguay con preautorización sin contacto |
| **2. NFC para leer + pago online con 3-D Secure** | El comprador acerca su tarjeta a **su propio** teléfono para no tipear, escribe el código de seguridad y paga como compra online con 3-D Secure, solo autorizada | Kit del procesador que tokeniza (el número no lo toca BBQ). No hace falta certificar el teléfono como posnet | 3-D Secure pasa la responsabilidad al banco | **Viable**, la más simple para arrancar. Se pierde el "acercá la tarjeta al cadete" |
| **3. Lectura y cobro directo sin certificación (programado desde cero)** | El comprador acerca su tarjeta a **su propio** teléfono, la app lee número y vencimiento por NFC y se cobra como **MOTO / tarjeta no presente** (sin criptograma, con o sin código de seguridad), solo autorizada, en la cuenta del vendedor | Un adquirente o procesador que habilite MOTO / tarjeta no presente a los vendedores (caso por caso, con límites y tasas más altas). El número va directo al kit del procesador para tokenizarlo, sin guardarse en la app ni en el servidor | El riesgo queda en el vendedor (modelo A). Se pelea con el paquete de pruebas: identidad, nombre del titular, factura de servicios, compra firmada y QR de entrega. Visa "Compelling Evidence 3.0": las compras anteriores sin reclamos desde el mismo dispositivo o identidad ganan un "no fui yo" | **En exploración (dueño, 11/10):** viable si un adquirente habilita MOTO / tarjeta no presente. Conviene arrancar con límites de monto para medir contracargos |

- **Google Pay en la app:** mismo camino que la vía 2 (token y procesador), con autorización y captura diferida.
- **Factura de servicios a nombre del titular:** prueba de domicilio para "conocer al cliente". Se pide para subir límites, pasar a Comercio y para quien cobra (vendedores y cadetes). No requiere IA: puede ser una revisión manual.

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
| **Identidad para comerciar** | No existe | Leer el chip del documento (pasaporte o cédula) en el teléfono y exigirlo para comprar, vender y repartir (decisión del 11/10) |
| **Cobro con tarjeta** | No existe (solo Google Pay en TEST) | Google Pay y SoftPOS por NFC en la app nativa, con autorización ahora y captura al entregar |
| **Cuenta de cobro del vendedor** | No existe | Cada vendedor y cadetería conecta su propia cuenta en el proveedor de pagos. BBQ crea el pago en su nombre, controla la captura y cobra la comisión con split |
| **Compra firmada** | Existe la clave ECDSA de identidad, pero no se firman compras | Firmar el resumen de la compra con los términos (con la cédula si se puede, si no con la clave de la app), guardarlo en los dos teléfonos y mandar solo el hash al servidor |
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
