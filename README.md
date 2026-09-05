# 🔥 BBQ — Mensajería y Comercio P2P

**BBQ** es una app de mensajería y comercio estilo WhatsApp, pensada para **Android e iPhone**, con el **mínimo intermediario posible**: el contenido viaja **P2P (WebRTC)** directo entre teléfonos, la base de datos vive **en tu teléfono**, y el servidor es solo una **guía telefónica + señalización** (nunca ve tus mensajes).

> Estado: en construcción activa. Ver [`ARCHITECTURE.md`](ARCHITECTURE.md) para el diseño completo y el roadmap.

---

## ✨ Cómo funciona

- **Identidad atada al dispositivo** — una clave criptográfica **no exportable** se genera en tu teléfono. El número de teléfono es solo una etiqueta para que te encuentren.
- **Servidor mínimo** — guarda únicamente `{ teléfono, nombre, peerId, clave pública }` y hace de **señalización transitoria** WebRTC. No almacena mensajes.
- **Mensajería P2P** — chat directo teléfono↔teléfono por WebRTC (cifrado DTLS). Entrega cuando ambos están en línea.
- **Contactos** — agregás por número (o desde tu agenda en la app nativa) y ves quién ya tiene BBQ; a los que no, los invitás por WhatsApp/SMS.
- **Comercio** — IA local, Escrow con QR, Google Pay (sandbox), logística, automatizaciones, referidos y Vivos.

---

## 🚀 Probar en teléfonos (rápido, sin APK)

La forma más simple: desplegar el servidor (que **también sirve la app**) y abrir su URL en el teléfono.

1. **Deploy en [Render](https://render.com) (gratis)**: creá un *Web Service* conectando este repo. Render detecta `render.yaml` y corre `npm install` + `npm start`. Te da una URL con **HTTPS**, ej: `https://bbq-xxx.onrender.com`.
2. En cada teléfono (Android/iPhone), abrí esa URL en el navegador → **"Agregar a pantalla de inicio"**.
3. Completá el onboarding (nombre + número) en cada teléfono.
4. En un teléfono: **➕** → número del otro → **"Buscar en BBQ y agregar"** → **Abrir chat** → mandá un mensaje.
5. Llega en tiempo real, **P2P directo**. 🎉

> HTTPS es necesario para WebRTC, PWA y Google Pay — Render lo da automáticamente.

## 💻 Correr en local (desarrollo / LAN)

```bash
npm install
npm run server      # http://localhost:3000 y http://<IP-LAN>:3000
```
Abrí `http://<IP-LAN>:3000` en teléfonos de la **misma WiFi**.

## 📱 App nativa (agenda real + push)

Para leer la agenda del teléfono y push, se compila con **Capacitor**. Ver [`CAPACITOR.md`](CAPACITOR.md).

---

## 🗂️ Estructura

```
.
├── server.js              # Servidor mínimo: directorio + señalización (no guarda mensajes)
├── capacitor.config.json  # Config app nativa
├── render.yaml            # Deploy en Render
├── ARCHITECTURE.md        # Diseño y decisiones
├── CAPACITOR.md           # Guía de build nativo
└── www/                   # La app (se sirve por HTTP y se empaqueta en Capacitor)
    ├── index.html
    ├── style.css
    ├── manifest.json / sw.js
    ├── icons/
    └── js/
        ├── db.js                 # IndexedDB (DB local)
        ├── identity.js           # Identidad del dispositivo (clave no exportable)
        ├── webrtc-node.js        # Transporte P2P (WebRTC)
        ├── contacts.js           # Contactos + match + invitar
        ├── onboarding.js         # Alta primera vez
        ├── bbq-integration.js    # Integración con la UI
        ├── storage-engine.js     # Historial local
        ├── ai-orchestrator.js · escrow-engine.js · google-pay-engine.js
        ├── logistics-engine.js · automation-engine.js · referral-engine.js
        ├── p2p-live-engine.js · p2p-node.js · app.js
```

---

## 🧰 Stack

- Web: HTML/CSS/JS vanilla, WebRTC, IndexedDB, Web Crypto, Service Worker (PWA)
- Servidor: Node + Express + WebSocket (`ws`)
- Nativo: Capacitor (Android/iOS) + plugins Contacts/Share/Push

## 📄 Licencia

MIT — ver [`LICENSE`](LICENSE).
