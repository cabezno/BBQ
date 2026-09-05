# 🔥 BBQ — Mobile P2P Commerce, Local AI & Escrow

**BBQ** es una *Progressive Web App* (PWA) con estética de WhatsApp que simula un ecosistema de **comercio P2P móvil**: mensajería, tiendas, IA local, pagos con retención (escrow) tri-parte, logística y transmisiones en vivo — **todo del lado del cliente, sin servidores centrales**.

> ⚠️ **Proyecto de demostración / prototipo.** Los pagos, la red P2P, el escrow y los conectores de IA están **simulados** en el navegador (usando `localStorage`, `BroadcastChannel`, `crypto.getRandomValues`, etc.). No procesa dinero real ni se conecta a servicios de producción.

---

## ✨ Características

- **📱 Interfaz estilo WhatsApp** — lista de chats, estados/historias, perfil, marco de teléfono simulado y roles (Comprador / Tienda + IA / Repartidor).
- **🌐 Red P2P** — malla entre nodos mediante `BroadcastChannel`, mensajería directa y difusión de catálogos por región (soberanía de datos: cada dispositivo es dueño de su propia base de datos).
- **⚡ Orquestador de IA local** — conector universal (Gemini, ChatGPT/OpenAI, Claude, DeepSeek, Ollama, WASM in-app) con **cortafuegos de privacidad por niveles de acceso** y auto-respuestas de tienda.
- **🔒 Escrow tri-parte de doble fase** — pre-autorización tipo *Auth & Hold*, nonce criptográfico `Kr` + hash de validación, código QR y liquidación simultánea (producto → tienda, envío → repartidor) o reembolso por expiración.
- **🚚 Motor de logística** — matriz de tarifas por zona, cálculo de envío y órdenes de despacho.
- **🤖 Motor de automatizaciones** — reglas ejecutadas por la IA (auto-despacho a courier, reabastecimiento por bajo stock, auto-reembolso por timeout, descuentos por volumen).
- **📹 Live Shopping P2P** — transmisiones en vivo con cámara (`getUserMedia`), grabación local (`MediaRecorder`), producto fijado y reacciones flotantes.
- **🎁 Programa de referidos** — invitaciones hacia hitos que desbloquean recompensas de tiendas participantes.

---

## 🏗️ Arquitectura

La app es 100 % estática (HTML + CSS + JavaScript vanilla, sin build). La lógica se divide en motores independientes que se cargan en orden desde `index.html`:

| Módulo | Responsabilidad |
|---|---|
| `js/storage-engine.js` | Base de datos local por nodo (simulación SQLite sobre `localStorage`). |
| `js/p2p-node.js` | Capa de red/transporte P2P (malla `BroadcastChannel`, mensajería directa, difusión de catálogo). |
| `js/logistics-engine.js` | Tarifas de envío por zona y órdenes de despacho. |
| `js/ai-orchestrator.js` | Interceptor de mensajes, cortafuegos de privacidad y auto-respuestas de IA. |
| `js/escrow-engine.js` | Escrow de doble fase, nonce/hash, QR y liquidación. |
| `js/referral-engine.js` | Referidos y recompensas. |
| `js/automation-engine.js` | Reglas de automatización ejecutadas por IA. |
| `js/p2p-live-engine.js` | Live shopping, captura y grabación de video. |
| `js/app.js` | Controlador de UI: navegación, chats, modales, roles del simulador. |

---

## 🚀 Cómo ejecutar

No requiere instalación ni compilación. Al usar módulos con `fetch`/APIs del navegador conviene servir los archivos por HTTP en lugar de abrir el `index.html` con `file://`.

```bash
# Opción 1: Python
python -m http.server 8000

# Opción 2: Node
npx serve .
```

Luego abre <http://localhost:8000> en el navegador (idealmente en vista móvil / DevTools responsive).

Para probar la malla P2P entre nodos, abre la app en **varias pestañas** y cambia de rol (Comprador / Tienda / Repartidor).

---

## 🧰 Stack tecnológico

- HTML5, CSS3, JavaScript (ES6+, sin frameworks ni bundler)
- [Bootstrap Icons](https://icons.getbootstrap.com/) y [Google Fonts (Inter)](https://fonts.google.com/specimen/Inter) vía CDN
- APIs del navegador: `BroadcastChannel`, `localStorage`, `MediaRecorder`, `getUserMedia`, `Canvas`, `Web Crypto`
- PWA: `manifest.json` (instalable)

---

## 📁 Estructura del proyecto

```
.
├── index.html          # Estructura de la app y todas las pantallas
├── style.css           # Estilos (tema oscuro estilo WhatsApp)
├── manifest.json       # Manifiesto PWA
└── js/
    ├── app.js
    ├── storage-engine.js
    ├── p2p-node.js
    ├── ai-orchestrator.js
    ├── escrow-engine.js
    ├── logistics-engine.js
    ├── automation-engine.js
    ├── referral-engine.js
    └── p2p-live-engine.js
```

---

## 📄 Licencia

Distribuido bajo la licencia MIT. Consulta el archivo [`LICENSE`](LICENSE) para más detalles.
