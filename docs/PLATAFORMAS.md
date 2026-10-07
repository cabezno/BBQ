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
