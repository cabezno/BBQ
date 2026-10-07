# Registro de cambios

Qué se cambió, por qué, cómo se probó y qué queda pendiente. Lo más nuevo, arriba.

---

## 2026-10-07 — Estilo sobrio tipo WhatsApp (tanda 4)

**Decisión del dueño:** la app tiene que sentirse como WhatsApp para que el usuario se adapte rápido. El naranja queda solo como acento. Quedó registrado en `CLAUDE.md` y en `docs/UX.md`.

**Qué cambió** (bloque "SOBRIO TIPO WHATSAPP" al final de `www/style.css`)
- **Un solo acento sólido:** las variables de degradado (`--bbq-gradient-primary`, `--wa-green-fab`) pasan a ser el color de acento, así que los degradados desaparecen en toda la app de una vez.
- **Botón flotante:** cuadrado redondeado, con sombra suave y sin brillo naranja.
- **Botones** de enviar, grabar, reproducir audio y los primarios: sólidos, sin bordes rojos ni brillo.
- **Chips activos, segmento Tiendas | Entregas y pestaña activa:** fondo tenue con texto en acento, como los filtros de WhatsApp.
- **Anillos de estados:** sólidos, en lugar del degradado tipo Instagram.
- **Tiendas de ejemplo:** sin marquesina estridente ni insignias llamativas.
- **Onboarding y Agregar contacto:** botón sólido.
- **Cabecera del chat:** el estado en gris.
- `sw.js`: cache `v40`.

**Cómo se probó:** capturas de tiendas, lista de chats y chat, en modo claro y oscuro.

---

## 2026-10-07 — Refinamiento de interfaz (tanda 3)

**Qué cambió**
- **Avatares con iniciales y color propio** por contacto (`bbqAvatar()` en `sanitize.js`):
  - Muestran la foto si hay; si el nombre arranca con emoji (bots, tiendas), ese emoji.
  - Se ven en la lista de chats, la cabecera del chat, el selector de contactos, la pantalla de llamada, "Yo" y "Tu estado". Antes todos eran 👤.
- **Menos ruido:**
  - La píldora "Conectado" solo aparece si hay un problema de conexión.
  - Se sacó el 🔒 de cada burbuja: queda en la cabecera.
  - El 🔊 queda solo en respuestas de IA.
  - No se avisa con un cartel de un mensaje del chat que estás mirando.
  - La hora se muestra en formato 24 h (es-AR).
  - El punto "en línea" de la lista solo aparece si el contacto está en línea de verdad.
- **Tarjetas sin duplicar:** las de pedido y las de sello ya no repiten su título como texto arriba. En modo claro, la tarjeta de pedido tiene un fondo más liviano.
- **Bug de Mi tienda:** al abrirse, ahora carga la tienda guardada (nombre, rubro, zona, courier). Antes mostraba "Mi Tienda P2P".
- **Íconos que no existían** en la versión local de los íconos: el botón flotante de Chats aparecía vacío. Ahora usa `bi-pencil-square` (nuevo chat) y `bi-telephone-outbound-fill` (volver a llamar).
- **Registro de llamadas:**
  - Cada fila muestra avatar, nombre escapado y tipo (entrante, saliente o perdida).
  - El botón llama de verdad (`BBQCall.startCall`). Antes era un `alert` que interpolaba el nombre sin escapar.
- **Modo claro:** mejor contraste en la pestaña activa.
- `sw.js`: cache `v39`.

**Cómo se probó**
- Capturas de chat, lista de chats, Yo y Mi tienda, en modo claro y oscuro.
- Volvieron a pasar las pruebas de XSS, E2E, comercio (tres usuarios) y confiabilidad.

**Pendiente** (propuesto, no hecho)
- Separar "Mi tienda" (datos de la tienda) de "Catálogo" (lista de productos con alta, edición, stock y foto).
- En "Yo", mostrar las herramientas de vendedor solo a quien tiene tienda; a los demás, un botón "Abrir mi tienda".
- Unificar el estilo de las fichas de ejemplo con las reales.
- Decidir con el dueño cuánto protagonismo tiene el naranja.
- **Llamadas y audios:**
  - Guardar el historial de llamadas: hoy el motor no registra nada.
  - No perder los candidatos ICE de quien llama.
  - Timeout cuando el otro no atiende.
  - TURN configurable.
  - Notas de voz y adjuntos por el outbox.

---

## 2026-10-07 — Comercio, tanda 2: directorio real, pedidos, agente, fidelidad y código de seguridad

**Qué cambió**
- **Directorio real de tiendas y servicios de entrega:**
  - Server: `POST /api/stores`, `POST /api/stores/unpublish` y `GET /api/stores?kind=store|delivery`.
  - Cada ficha va **firmada** por su dueño (`bbq-listing-v1|peerId|kind|ts|json`). El server la verifica y la guarda tal cual, y el cliente la vuelve a verificar antes de mostrarla (`www/js/listings.js`). Nadie, ni el server, puede inventar o modificar una tienda.
  - La ficha incluye la clave de cifrado firmada del dueño, así que "Chatear" queda cifrado desde el primer mensaje.
  - `store.js` tiene espacios separados (`Store.ns('stores')` → `bbq:stores` / `stores.json`), sin mezclarse con la guía telefónica.
  - En Tiendas y Entregas, lo real aparece arriba ("En BBQ", con ✔ de firma) y los ejemplos abajo.
  - En Yo están "Publicar en el directorio" y "Mi servicio de entrega" (zonas, precio y demora).
- **Pedidos (`www/js/orders.js`):**
  - Estados nuevo → confirmado → preparando → enviado → entregado (o cancelado).
  - Se guardan en el teléfono del dueño. Cada cambio llega al cliente por chat cifrado como tarjeta, y el cliente lo ve en **Yo → Mis pedidos** con su progreso.
  - Se crean desde Yo → Pedidos o desde el chat (📎 → Crear pedido).
- **Bandeja "El agente propone":** las acciones sensibles del agente quedan guardadas y el dueño las confirma o rechaza con un toque. Al confirmar, se ejecutan con `BBQTools.runDirect`.
- **Herramientas nuevas para agentes:**
  - `order.create`: ahora guarda el pedido y avisa al cliente.
  - `order.list`.
  - `order.setStatus` (sensible).
  - `loyalty.giveStamp` (sensible).
- **Fidelización (`www/js/loyalty.js`):**
  - La tienda configura sellos necesarios y premio, y da sellos desde el chat (📎 → Dar sello).
  - Cada sello va **firmado por la tienda**. El cliente lo verifica (tiene que llegar cifrado y con la firma de esa tienda) y lo guarda en **Yo → Mis tarjetas**, donde puede pedir el premio al completar la tarjeta.
  - Los sellos falsos se rechazan y se marcan.
- **Código de seguridad:**
  - Tocando la línea de estado del chat se ven 60 dígitos derivados de las dos claves de identidad, iguales en los dos teléfonos.
  - Se puede marcar como verificado y la cabecera pasa a decir "🔒 Verificado". Si el contacto cambia de clave, la verificación se pierde.
- **El nombre del emisor viaja dentro del sobre cifrado:** quien te escribe por primera vez aparece con su nombre (el server no lo ve) y se guarda como contacto, solo si vino cifrado.
- **Cabecera del chat:** los nombres largos se cortan con "…" y no se pisan con el estado.
- `sw.js`: cache `v38`.

**Cómo se probó** (Playwright, 3 usuarios: tienda, cliente y servicio de entrega)

| Prueba | Resultado |
|---|---|
| Ana publica su tienda y Caro su servicio de entrega | ok; Beto los ve arriba, con firma verificada |
| Ficha con firma inválida | el server responde 403 |
| Beto chatea desde la ficha | Ana recibe cifrado y ve el nombre "Beto" |
| Pedido creado y luego confirmado | Beto lo ve en Mis pedidos, en estado confirmado |
| Propuesta del agente "pasar a preparando", confirmada por Ana | Beto ve "preparando" |
| 3 sellos de Ana | Beto tiene 3/3 verificados, con "Pedir mi premio" |
| Sello con firma falsa | rechazado |
| Código de seguridad | igual en los dos teléfonos; la cabecera pasa a "🔒 Verificado" |
| Nombre de tienda con HTML | se ve como texto |
| Pruebas anteriores (E2E, XSS, suplantación, ACK, reconexión, duplicados, guardar tienda) | siguen pasando |

**Huecos que dejé a propósito** (ver [`docs/MODELO-NEGOCIO.md`](MODELO-NEGOCIO.md))
- Dinero real y escrow real, comisiones, fidelización de tiendas, reseñas de compras reales, disputas y facturación: dependen del estudio de modelo de negocio y figura jurídica.
- Escaneo del código de seguridad por QR con la cámara: por ahora se comparan los números.
- El agente local corre en el teléfono de quien escribe si el worker de PC está apagado (pendiente desde la revisión). Sus propuestas quedan en ese teléfono.

---

## 2026-10-07 — Rediseño, tanda 1: sacar el mockup, guiar y mostrar la privacidad

Aplica la "Dirección acordada" de [`docs/UX.md`](UX.md).

**Qué cambió**
- **Sin mockup:**
  - Se sacaron la barra de estado falsa ("23:50 · 5G · 100%") y el notch.
  - Se ocultó la fila que repetía el nombre de la pestaña.
  - Se ocultó la barra de filtros: sus chips no estaban conectados a nada.
- **Referidos:** el popup ya no se abre al arrancar. El programa está en **Yo → Referidos**.
- **5 pestañas:** Chats · Estados · Tiendas · Llamadas · **Yo**.
  - La nueva pestaña "Yo" (`www/js/ux.js`) junta perfil, Mi tienda, Cobrar, Mi servicio de entrega (próximamente), Conectar IA, Automatizaciones, **Centro de privacidad**, Referidos, Comunidades y Ajustes.
  - Comunidad deja de ser pestaña y se entra desde Yo.
- **Tiendas | Entregas:** Tiendas tiene un segmento con un directorio de servicios de entrega (por ahora de ejemplo, con zonas y tarifas).
  - Los chips del directorio de tiendas ahora dicen "Más visitadas" y "Para vos".
- **Contenido de demo, sin engañar:**
  - Las tiendas, las entregas y las comunidades llevan la marca "de ejemplo".
  - Se borraron las 3 llamadas inventadas, también en teléfonos que ya las tenían guardadas.
  - Se borraron las visitas inventadas del ranking de tiendas.
- **Pantallas vacías que guían:**
  - Chats: "Agregar contacto".
  - Estados: "Crear estado".
  - Llamadas: "Llamar a un contacto".
- **Privacidad visible:**
  - El onboarding explica en 3 puntos: mensajes cifrados, chats en tu teléfono y compras protegidas.
  - La cabecera de cada chat cifrado muestra "🔒 Cifrado".
  - **Centro de privacidad:** qué queda en el teléfono, qué hay en el directorio, qué no ve el servidor y qué todavía no está cifrado.
- **Detalles del chat:**
  - El 🔊 queda solo en los mensajes recibidos.
  - Los mensajes a bots ya no quedan en ⏳ para siempre: los bots no mandan ACK.
  - El aviso flotante ya no tapa el campo de escribir.
- **Perfil:** viene completo con el nombre y el número del onboarding.
- **Íconos locales:** `bootstrap-icons` está ahora en `www/vendor/` (MIT) y lo guarda el service worker. Ya no depende de jsDelivr, así que los íconos se ven sin conexión.
- **Detalles visuales:**
  - El buscador mostraba la lupa dos veces.
  - La píldora "Conectado" estaba desalineada.
  - La insignia "Tienda similar" se partía en dos líneas.
- `sw.js`: cache `v36`.

**Cómo se probó**
- Capturas de todas las pantallas en tamaño de celular (390×844), en modo claro y oscuro, sin errores de JS.
- Volvieron a pasar las pruebas de E2E, XSS, suplantación, ACK, reconexión, duplicados y guardar tienda.

**Pendiente de diseño**
- Operativa de tiendas para agentes: pedidos con estados y la bandeja "El agente propone".
- Fidelización: sellos firmados y reseñas de compras reales.
- Código de seguridad por QR.
- Directorio real de tiendas y de servicios de entrega en el servidor.
- Alinear todo con el estudio de modelo de negocio.

---

## 2026-10-07 — Diagnóstico de diseño y UX

- Se capturaron todas las pantallas en tamaño de celular, en modo claro y oscuro (Playwright), y se revisaron.
- El resultado está en [`docs/UX.md`](UX.md):
  - lo que está bien;
  - 8 grupos de problemas por impacto (mockup y demo, popup de referidos, pantallas vacías, exceso de pestañas, detalles del chat, perfil, íconos externos, valor diferencial invisible);
  - preguntas abiertas de diseño.
- No se cambió código todavía.
- Se agregó en `docs/UX.md` la dirección acordada con el dueño:
  - chat como WhatsApp;
  - Tiendas y Entregas como directorios propios;
  - referidos dentro de Configuración;
  - seguridad y privacidad visibles;
  - operativa de tiendas para agentes;
  - fidelización P2P.

  Queda pendiente sumar el estudio de modelo de negocio y figura jurídica.

---

## 2026-10-06 — Revisión a fondo + seguridad, confiabilidad, E2E y agente sin IA

Rama: `claude/rc-51vifu`.

### Revisión inicial (estado de partida)

Se revisó el servidor, el núcleo P2P del cliente y la app/motores. Para eso se levantó el server en una copia aparte, se abrió la app con varios usuarios en Chromium (Playwright) y se atacaron los endpoints con scripts.

- **Real:** chat 1:1 P2P (texto, adjuntos, voz, outbox), contactos, onboarding, llamadas, TTS del sistema, IA por API.
- **Demo o maqueta:** escrow (el hash es falso y la verificación acepta cualquier secreto), Google Pay (modo TEST, con una hoja de respaldo que siempre aprueba), cobros, tiendas sembradas, logística, referidos, comunidades, automatizaciones (solo suman contadores) y el historial de llamadas.
- **Fallas graves encontradas:**
  - Cualquier usuario podía mandarle código a otro (XSS) a través de mensajes, nombres o tarjetas.
  - El server reenviaba el `from` que mandaba el cliente, así que cualquiera podía hacerse pasar por otro.
  - El token del puente estaba escrito en el código.
  - No había E2E.

### 1. Seguridad: remitente verificado y escapado de datos ajenos

- **Server (`server.js`):**
  - En el WebSocket, el remitente es siempre la identidad que probó ese socket (`msg.from = myPeerId`), sin importar lo que diga el cliente.
  - Un socket ya autenticado no puede volver a hacer `HELLO` para cambiar de identidad.
- **Cliente (`www/js/sanitize.js`):**
  - `escHtml()` y `safeId()` se aplican en la lista de chats, las burbujas, las tarjetas de pago, las notificaciones, el selector de contactos, los vivos, las llamadas, el alta de contacto y la hoja de Google Pay.
  - Las tarjetas que llegan de otro peer se normalizan: números a número, `deliveryMode` limitado a `PICKUP`/`COURIER` e ids seguros.
- **ACK:** solo se acepta si viene del destinatario de ese mensaje. Antes otro peer podía borrarte la cola.

### 2. Confiabilidad

- **Server:**
  - El cierre de un socket viejo ya no deja offline a un peer que ya se reconectó.
  - El heartbeat corta las conexiones muertas: si no responden al ping, `terminate()`.
  - `maxPayload` del WebSocket: 16 MB (antes 100 MB).
- **Cliente (`webrtc-node.js`):**
  - Hay un solo WebSocket vivo a la vez y los eventos de sockets viejos se ignoran.
  - La reconexión no se duplica.
- **Recepción:** se deduplican los mensajes por id. Un reenvío del outbox no se guarda dos veces.
- **Tienda:** faltaba el campo **Stock** que leía `handleSaveStore`, por eso guardar explotaba siempre.
- **Service worker:** el fallback offline a `index.html` ahora funciona. Antes era una Promise en un `||`, que nunca caía al fallback.

### 3. Cifrado de extremo a extremo (E2E)

Ver la sección "Cifrado de extremo a extremo" en `ARCHITECTURE.md`.

- **Registro firmado:** al registrarse, la clave ECDH se firma con la clave de identidad (`ecdhSig`). El server la verifica, la guarda y la devuelve en el directorio. Los clientes la verifican solos, sin confiar en el server.
- **Cifrado (`www/js/e2e.js`):** ECDH → HKDF-SHA256 → AES-GCM 256, con un nonce por mensaje y AAD `emisor|receptor`.
- **Qué se cifra:** todo lo que va entre personas, tanto por P2P como por relay. El server solo ve `{type:'e2e'}`.
- **Mensajes en claro:** si ya tengo las claves de un contacto, descarto lo que llegue de él en claro o adulterado.
- **Contactos viejos:** al arrancar, la app trae sus claves del directorio.
- **Sin cifrar por ahora:** bots y agentes, porque no tienen claves. La UI lo avisa.
- **En la UI:** 🔒 en los mensajes recibidos cifrados y un aviso en los chats que no lo están.

### 4. El agente de tienda responde sin IA

Antes, si no había IA (sin API key o sin saldo), el agente **siempre saludaba**: tomaba la primera opción del clasificador.

- `browserRunLLM` devuelve `null` cuando no hay IA.
- `bbq-flow.js`:
  - `classify` elige por **palabras clave** (precio, stock, envío, comprar, saludo). "Saludo" solo gana si no hay otra intención; sin coincidencias, elige "otro".
  - `llm` usa el texto `fallback` de la etapa. El flujo por defecto responde con el **catálogo real**: productos, precio, envío y stock.
- **Con IA:** funciona igual que antes.

### Cómo se probó

Los scripts de prueba no están en el repo: corrieron contra una copia del server en un puerto aparte.

| Prueba | Resultado |
|---|---|
| Nombre de directorio con `<img onerror>` | se ve como texto, no corre |
| Mensaje con código | se ve como texto |
| Factura armada para inyectar código (y sus botones) | no corre nada |
| Hacerse pasar por otro peer (`from` falso) | llega con el id real del emisor |
| ACK falso de un tercero | no borra la cola; el ACK real sí |
| Cuatro reconexiones seguidas del WebSocket | sigue online y el chat anda |
| Mismo mensaje enviado dos veces | se guarda una vez |
| Texto y adjunto por relay y por P2P | en la red solo hay sobres `e2e` |
| B recibe de A sin tenerlo agendado | descifra y contesta cifrado |
| Mensaje en claro inyectado, sobre adulterado, impostor | descartados |
| Bot de prueba | sigue respondiendo (en claro) |
| Agente sin IA: "cuánto sale el mate?" | intención `precio`, responde con el catálogo |

### Pendiente

- **Puente con la PC:**
  - El token `bbq-bridge-7k2p` sigue escrito en el código por defecto: hay que exigirlo por variable de entorno.
  - `/api/agent/reply` acepta cualquier `agent` como remitente.
  - Las colas `claudeInbox`/`agentInbox` guardan texto en claro.
  - Lo ideal es que cada worker se autentique con la clave de su dueño y tenga sus propias claves E2E.
  - Toca `claude-bridge.js` y `bbq-agent-worker.js`, que no están en el repo.
- **`POST /api/flows`:** no pide autenticación. Cualquiera puede pisar el flujo `store-assistant` de todos.
- **`/api/ai`:** el `endpoint` libre permite SSRF cuando el proveedor es `ollama`.
- **App nativa (Capacitor):** `BBQ_SERVER` apunta a `https://localhost` y el server no tiene CORS.
- **Render free:** el disco es efímero y el directorio se pierde en cada deploy. Falta configurar Upstash (`UPSTASH_*`) en `render.yaml`.
- **WebRTC:**
  - Glare: cuando los dos lados conectan a la vez, falla con "wrong state: stable". Falta perfect negotiation.
  - Las `RTCPeerConnection` muertas no se limpian.
  - No hay TURN.
- **Adjuntos y notas de voz:** no pasan por el outbox y se pierden si el otro está offline.
- **Demo presentado como real:** escrow, Google Pay, cobros, logística, referidos, comunidades y automatizaciones.
- **E2E:** falta forward secrecy (ratchet) y un código de seguridad para verificar las claves cara a cara.
- **Límites de tasa:** no hay en `register` y `match`. Con eso se pueden acaparar números y volcar el directorio.

---

## Herramientas

- `tools/guardar-sesion.ps1`: guarda la sesión de la consola de PowerShell actual (comandos y contenido de la pantalla) en un `.txt` en `Escritorio\Sesiones de consola\`, y deja un acceso directo en el Escritorio. Hay que correrlo dentro de la consola que se quiere guardar.
