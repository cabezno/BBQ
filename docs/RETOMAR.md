# Dónde quedamos (para retomar en otra sesión)

> Actualizado: 2026-10-11. Rama de trabajo: `claude/rc-51vifu`. PR abierto: https://github.com/cabezno/BBQ/pull/1 (sin conflictos, sin comentarios ni CI).

## Cómo seguir
1. `git fetch origin && git checkout claude/rc-51vifu && git pull`
2. Leer `CLAUDE.md` (reglas de trabajo), `docs/CAMBIOS.md` (historial) y este archivo.
3. Chequeo rápido: `for f in server.js www/js/*.js www/sw.js; do node --check $f; done`

## Lo último que se hizo
- **OTA en la PWA:** aviso "Hay una versión nueva de BBQ" y búsqueda de actualizaciones al volver a la app y cada 30 minutos (`www/js/app.js`, `www/sw.js` en `bbq-pwa-v43`). Las opciones para la app nativa y la de escritorio están en `docs/PLATAFORMAS.md`.
- **Modelo de negocio:** el estudio completo está en `docs/MODELO-PAGOS-Y-ENTREGAS.md` y el resumen, cruzado con el código, en `docs/MODELO-NEGOCIO.md`.
- **Decisión de disputas:** las resuelven comprador y vendedor, los dos ponen un respaldo y BBQ solo abre el canal.
- **Decisión del 11/10:** identidad verificada con el chip del documento para comprar, vender o repartir; cobro con Google Pay o NFC, con autorización ahora y captura al entregar. Ver `docs/MODELO-NEGOCIO.md`.
- **Decisión del 11/10 (b):**
  - cada vendedor cobra en su propia cuenta y BBQ orquesta la captura;
  - la compra se firma con identidad digital;
  - tabla de vías de cobro por NFC: SoftPOS certificado, NFC para leer más 3-D Secure, y cobro directo sin certificación (en exploración, como MOTO / tarjeta no presente). **Vía 4 preferida:** validar la tarjeta por NFC (posesión, autenticidad y titular) y cobrar por camino aprobado. Próximo paso sugerido: prototipo nativo que lea tarjeta y documento por NFC, sin cobrar.

- **Decisión del 11/10 (c):** contrato de compraventa firmado por compra (identidad, rostro, tarjeta validada y firma), considerado por el dueño la vía más sólida contra el fraude y los falsos reclamos.

## Para probar en Render
Mergear el PR (o apuntar Render a la rama) y cargar las variables de Upstash.

## Ideas en exploración (sin documentar todavía)
- "Quizá BBQ solo media como plataforma de entrega y comisiones, donde cada uno tiene su parte." Se podría agregar como alternativa en `MODELO-NEGOCIO.md`.

## Próximos pasos posibles (elige el dueño)
- Layout de escritorio.
- Dispositivos vinculados.
- Separar "Mi tienda" y "Catálogo".
- Seguridad del server:
  - token del bridge solo por variable de entorno;
  - autenticación en `/api/flows`;
  - SSRF en `/api/ai`.
- Escrow, según `MODELO-NEGOCIO.md`:
  - comparar el código escaneado;
  - sacar `simpleHash`;
  - sin saldos;
  - vencimiento.
- OTA de la app nativa (Capacitor) con bundles firmados por una clave del dueño.
- Capacitor: CORS y `BBQ_SERVER`.
- Verificar la huella DTLS y resolver el "glare" de WebRTC.
