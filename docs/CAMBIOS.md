# Registro de cambios

Qué se cambió, por qué, cómo se probó y qué queda pendiente. Lo más nuevo, arriba.

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
