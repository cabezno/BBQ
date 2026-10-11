# Públicos y plataformas: hoja de ruta

> **Decisión del dueño (2026-10-07):** llegar a **todos los públicos a la vez**: usuarios comunes, tiendas, servicios de entrega y quien busca privacidad, en celular (Android e iOS) y en compu (Mac, Windows y Linux).

## Principio

**Un solo código** (`www/`), varios envases, y una interfaz que **se adapta al rol**, no a la plataforma. La base es WhatsApp: cada rol (tienda, entrega) se "enciende" solo para quien lo necesita, así la app no se vuelve pesada para el usuario común.

| Público | Dónde | Qué necesita |
|---|---|---|
| Usuarios comunes | Celular | Que sea WhatsApp: rápido, liviano, sin curva de aprendizaje |
| Tiendas | Celular para atender; compu para gestionar | Catálogo, pedidos, agente e IA local en la compu |
| Servicios de entrega | Celular, en la calle | Pedidos asignados, QR, poca batería y mala señal |
| Privacidad | Cualquiera | Cifrado y verificación visibles y auditables |

## Envases (mismo código)

| Envase | Plataformas | Estado | Requisitos |
|---|---|---|---|
| **PWA** | Navegador en cualquier dispositivo; "Agregar al Dock" en Mac e inicio en el celular | ✅ Funciona | HTTPS (Render) |
| **Capacitor** | Android e iOS | Configurado (`capacitor.config.json`), sin build | Android Studio; Mac + Xcode + Apple Developer para iOS. Falta CORS y `BBQ_SERVER` (ver CAMBIOS) |
| **Tauri** | Mac, Windows y Linux | Por hacer | Rust toolchain; firma y notarización de Apple para Mac; los builds se pueden hacer en GitHub Actions |

## Actualizaciones OTA (sin pasar por las tiendas)

| Envase | ¿OTA? | Cómo |
|---|---|---|
| **PWA** | ✅ Ya funciona | Cada deploy en Render sube `CACHE_NAME` en `sw.js`. La app busca versión nueva al volver a primer plano y cada 30 min, el service worker nuevo toma el control y aparece "Hay una versión nueva · Actualizar" (no recarga sola, para no cortar una llamada o un mensaje a medio escribir). |
| **Capacitor (Android/iOS)** | Posible, falta armarlo | Hoy `www/` va empaquetado dentro del APK/IPA: sin OTA, cada cambio requiere publicar en las tiendas. Opciones abajo. |
| **Tauri (escritorio)** | Posible | `tauri-plugin-updater`: descarga el binario nuevo firmado desde una URL propia (GitHub Releases o el server). |

**Opciones para Capacitor**
1. **Live update con bundle firmado (recomendada):** plugin `@capgo/capacitor-updater` (código abierto) en modo autoalojado. El server publica `www.zip` con su versión y firma; la app lo baja, verifica y lo aplica en el próximo arranque, con vuelta atrás si falla. Funciona sin conexión con la última versión bajada.
2. **`server.url` apuntando a Render:** la app nativa es un marco que carga la web en vivo. Es lo más simple, pero sin conexión no abre y Apple puede rechazarla por ser "solo una web".

**Límites:**
- Por OTA solo se puede cambiar HTML/CSS/JS. Un plugin nativo nuevo (cámara, push, contactos) o un cambio de permisos sigue necesitando versión en la tienda.
- Apple y Google lo permiten mientras no cambie el propósito de la app.

**Privacidad:** quien sirve el código puede cambiarlo. Con E2E eso importa: un JS adulterado podría leer los mensajes antes de cifrarlos. Por eso los bundles OTA deberían ir **firmados con una clave que no esté en el server** (la del dueño, offline), y la app solo aplicar los que verifiquen. La PWA hoy no tiene esa protección: confía en lo que sirva Render.

## Cimientos (sirven a todos los públicos)

1. ✅ **La interfaz se adapta al rol**, y cualquiera puede activar "Vender" o "Hacer entregas" desde Yo → Modos. "Yo" muestra herramientas de vendedor o de repartidor solo a quien tiene tienda o servicio; el resto ve chats y compras.
2. **Dispositivos vinculados.** Misma identidad en celular y compu, al estilo WhatsApp Web:
   - **Vincular:** el teléfono firma una autorización para la clave del nuevo dispositivo, verificable sin servidor.
   - **Cifrado:** E2E con un sobre por dispositivo; el emisor cifra para todos los dispositivos del destinatario.
   - **Historial:** se pasa por P2P entre tus dispositivos.
3. **Layout de escritorio.** En pantallas anchas: lista + chat + panel (pedidos, catálogo o agente), como WhatsApp Web. Hoy la app se ve dentro de un "marco de teléfono" con una barra de simulación de roles, que hay que reemplazar.
4. ✅ **Llamadas y audios robustos** (falta verificar la llamada con el código de seguridad):
   - historial de llamadas;
   - que no se pierdan los candidatos ICE;
   - timeout si nadie atiende;
   - TURN configurable;
   - audios y adjuntos por el outbox.
5. **Celulares modestos y datos caros:** carga liviana; los modelos de IA (Whisper, voz neural) siguen siendo opcionales y se descargan solo si el usuario los pide.

## Por rol (después de los cimientos)

- **Tiendas:** Mi tienda y Catálogo separados (alta, edición, stock y foto); configuración del agente; panel de escritorio.
- **Servicios de entrega:** pedidos asignados, escaneo del QR del escrow, zonas y tarifas (la publicación ya está).
- **Privacidad:** código de seguridad por QR con la cámara, exportar o borrar mis datos y verificación de dispositivos vinculados.
- **Comercio con dinero real:** depende de [`MODELO-NEGOCIO.md`](MODELO-NEGOCIO.md) y del estudio [`MODELO-PAGOS-Y-ENTREGAS.md`](MODELO-PAGOS-Y-ENTREGAS.md).
