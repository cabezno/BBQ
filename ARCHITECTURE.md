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
- `WS /ws` — señalización: `HELLO`, `SIGNAL {to, from, data}`, `IS-ONLINE`, `PING`
- Persistencia: `directory.json` (solo teléfono + nombre + peerId + publicKey)

### Cliente (`www/`) — web app dentro de Capacitor
- `js/storage-engine.js` — DB local (→ IndexedDB)
- `js/identity.js` *(nuevo)* — clave de dispositivo + peerId + registro en directorio
- `js/contacts.js` *(nuevo)* — leer agenda, match, invitar
- `js/p2p-node.js` — transporte WebRTC (DataChannel) + señalización
- `js/crypto-e2e.js` *(nuevo, opcional)* — cifrado de mensajes
- Motores existentes: `ai-orchestrator`, `escrow-engine`, `google-pay-engine`, `logistics-engine`, `automation-engine`, `referral-engine`, `p2p-live-engine`, `app.js`

### Capacitor
- `capacitor.config.json` — `appId`, `webDir: "www"`
- Plugins: `@capacitor-community/contacts` (agenda), `@capacitor/share` (invitar), `@capacitor/push-notifications` (push)

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
