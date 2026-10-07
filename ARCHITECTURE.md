# BBQ — Arquitectura

App de mensajería y comercio P2P estilo WhatsApp, **app nativa** (Android + iPhone) vía **Capacitor**, con el **mínimo intermediario posible**.

---

## Principios

1. **El teléfono es el dueño de los datos.** Historial, contactos y perfil viven en el dispositivo (DB local).
2. **El servidor es lo más "tonto" posible.** Solo hace de guía telefónica y de señalización transitoria. **Nunca guarda mensajes.**
3. **El contenido viaja P2P** (WebRTC), directo teléfono↔teléfono.
4. **Identidad atada al aparato**, no cambiable por el usuario.

---

## Decisiones cerradas

| Tema | Decisión |
|---|---|
| Plataforma | App **nativa** vía **Capacitor** (mismo código web adentro) |
| Identidad | **Clave criptográfica del dispositivo** (no exportable, atada al móvil). El número de teléfono es una **etiqueta de búsqueda, sin verificar** (MVP, sin SMS) |
| DB local | **IndexedDB** en el teléfono (historial, contactos, perfil, productos) |
| Servidor | **Mínimo**: directorio (teléfono + nombre + peerId + publicKey) + señalización WebRTC transitoria. **No guarda mensajes** |
| Entrega de mensajes | **Solo si ambos están online** (P2P). Sin buzón offline |
| Transporte | **WebRTC** (DataChannel para chat/estados; media para vivos/llamadas) |
| Descubrimiento | Leés tu **agenda** → match contra el directorio → ves quién tiene BBQ. A los que no, los **invitás** por WhatsApp/SMS (share nativo) |
| Vivos / llamadas | WebRTC media, con formato de señalización **SBL v1** (compatible con el ecosistema SAMBA) |
| Notificaciones | Push (APNs/FCM) para despertar la app; tiempo real solo con app activa |

### Por qué estas decisiones (límites reales del navegador/móvil)
- El SO **no** entrega un número de teléfono verificado (iOS lo prohíbe; Android es poco fiable) → la identidad fuerte es una **clave de dispositivo**, no el número.
- Una web/PWA **no puede leer la agenda ni dar push confiable** (menos en iOS) → por eso **Capacitor** (app nativa).
- P2P por internet **no puede** entregar a alguien offline sin un buzón → elegimos **"solo ambos online"** para mantener el server mínimo.
- El background en móvil es limitado (iOS suspende) → tiempo real = app activa; con app cerrada, push.

---

## Componentes

### Servidor (`server.js`) — Node + Express + WebSocket
- `POST /api/register` — alta/actualización: `{ phone, name, peerId, publicKey }`
- `POST /api/contacts/match` — le paso mi agenda, me devuelve quiénes tienen BBQ
- `GET /api/user/:phone` — lookup individual
- `GET /api/status` — estado
- `POST /api/stores` · `POST /api/stores/unpublish` · `GET /api/stores?kind=store|delivery` — directorio de tiendas y servicios de entrega. Las fichas van firmadas por su dueño y los clientes las verifican.
- `WS /ws` — señalización: `HELLO`, `SIGNAL {to, from, data}`, `IS-ONLINE`, `PING`
- Persistencia: `directory.json` (solo teléfono + nombre + peerId + publicKey)

### Cliente (`www/`) — web app dentro de Capacitor
- `js/storage-engine.js` — DB local (→ IndexedDB)
- `js/identity.js` *(nuevo)* — clave de dispositivo + peerId + registro en directorio
- `js/contacts.js` *(nuevo)* — leer agenda, match, invitar
- `js/p2p-node.js` — transporte WebRTC (DataChannel) + señalización
- `js/e2e.js` — cifrado de extremo a extremo de los mensajes entre personas (ver abajo)
- `js/listings.js` — publicar y leer fichas firmadas del directorio de tiendas y entregas
- `js/orders.js` — pedidos con estados (aviso al cliente por chat cifrado) y bandeja "El agente propone"
- `js/loyalty.js` — fidelización: sellos firmados por la tienda y guardados por el cliente
- `js/ux.js`, `js/ux-commerce.js` — pestaña Yo, Centro de privacidad, código de seguridad y pantallas de comercio
- Motores existentes: `ai-orchestrator`, `escrow-engine`, `google-pay-engine`, `logistics-engine`, `automation-engine`, `referral-engine`, `p2p-live-engine`, `app.js`

### Capacitor
- `capacitor.config.json` — `appId`, `webDir: "www"`
- Plugins: `@capacitor-community/contacts` (agenda), `@capacitor/share` (invitar), `@capacitor/push-notifications` (push)

---

## Cifrado de extremo a extremo (E2E)

- Cada teléfono tiene dos claves: **firma** (ECDSA P-256, el `peerId` es su hash) y **cifrado** (ECDH P-256).
- La clave de cifrado va **firmada** con la de identidad (`ecdhSig` = firma de `bbq-ecdh-v1|peerId|ecdhPub`).
  Cualquiera verifica que una clave es de un `peerId` **sin confiar en el server** (no puede cambiarla).
- Clave por contacto: `ECDH → HKDF-SHA256 → AES-GCM 256`, nonce aleatorio por mensaje, `AAD = emisor|receptor`.
- Se cifra **todo** payload entre personas (texto, adjuntos, voz, avisos de vivo), vaya por P2P o por relay.
  El server solo ve `{ type: 'e2e', ... }`.
- Cada sobre lleva las claves públicas del emisor (autoverificables): el receptor descifra y contesta cifrado
  aunque todavía no lo tenga agendado.
- Si ya tengo las claves verificadas de un contacto, **descarto** cualquier mensaje suyo en claro o adulterado.
- **Sin cifrar (por ahora):** bots y agentes (`bbq_testbot`, `bbq_claude`, `agent_*`), porque no publican claves.
  La UI lo avisa. Para cifrarlos, el worker de PC tiene que tener sus propias claves.
- Pendiente: *forward secrecy* (ratchet tipo Signal) y verificación de claves cara a cara (código de seguridad).

---

## Roadmap

- **M1** ✅ Reestructura `www/` + servidor mínimo (directorio + señalización) + este doc
- **M2** DB local (IndexedDB) + identidad (clave de dispositivo) + registro en directorio
- **M3** Transporte WebRTC P2P + señalización + (opcional) E2E
- **M4** Capacitor + plugins (Contactos, Compartir, Push) + build Android/iOS
- **M5** Vivos SBL v1 + pulido

---

## Cómo correr (desarrollo)

```bash
npm install
npm run server        # http://localhost:3000  (y http://<IP-LAN>:3000 para teléfonos)
```

## Cómo compilar la app nativa (cuando llegue M4)

```bash
npm install
npx cap add android          # requiere Android Studio
npx cap add ios              # requiere Xcode (macOS)
npm run cap:sync
npx cap open android         # compilar/firmar desde Android Studio
```

> El servidor mínimo se despliega aparte (Render/Railway free). La app apunta a esa URL.
