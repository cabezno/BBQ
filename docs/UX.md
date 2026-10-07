# Diseño y UX: diagnóstico

Revisión hecha el 2026-10-07 sobre capturas de la app en tamaño de celular (390×844), en modo oscuro y claro, recorriendo onboarding, chats, un chat abierto, llamadas, estados, tiendas, comunidad y perfil.

## Lo que está bien
- **Onboarding claro y corto:** nombre y número, más una línea que explica que la identidad es del teléfono.
- **Identidad visual reconocible:** el fuego 🔥 y el gradiente naranja/amarillo, con buen contraste en el modo oscuro.
- **El chat se entiende a primera vista**, porque toma el patrón de WhatsApp: burbujas, hora y estado.
- **Hay modo claro y oscuro**, y siguen al sistema.

## Problemas, por impacto

### 1. La app parece un mockup, no una app
- **Barra de estado falsa** (`.phone-status-bar`, "23:50 · 5G · 100%"). En un teléfono real se duplica con la del sistema y la hora no coincide: los mensajes dicen 12:03 AM y la barra 23:50.
- **Datos de demo presentados como reales:**
  - 4 tiendas inventadas ("MÁS VISITADA (5)", 4.9 ★);
  - llamadas que nunca existieron (TechZone, Courier, Juan Pérez);
  - comunidades con "148 miembros activos".

  Un usuario nuevo no puede distinguir qué es real.

### 2. Lo primero que ve el usuario es un popup de referidos
Apenas termina el onboarding, aparece "🎁 DESAFÍO DIARIO DE REFERIDOS". Tapa la pantalla de inicio y vuelve a aparecer en cada arranque. Además, el botón "Invitar 5 contactos" no invita a nadie: solo suma al contador.

### 3. Pantallas vacías sin guía
- **Chats vacío:** no dice qué hacer. Agregar un contacto está escondido en un botón flotante sin texto.
- **Estados vacío:** solo muestra un título y un espacio en blanco.
- **Falta un camino guiado al primer chat:** "agregá a alguien por su número" o "invitá a un amigo".

### 4. Demasiadas pestañas y filtros redundantes
- **Seis pestañas abajo:** Chats, Llamadas, Estados, Tiendas, Comunidad y Perfil. WhatsApp usa 4. "Perfil" no es una pestaña: abre un modal.
- **Tiendas tiene dos filas de filtros que se pisan:** "Recientes / Ofertas / Retiro $0 / Con envío" y "Recientes primero / Sugerencias personalizadas".
- **Chips cortados:** "Con En…" y "Encriptad…" se ven cortados en el borde derecho, sin ninguna señal de que hay más.

### 5. Detalles del chat
- **🔊 en cada burbuja:** ensucia la lectura. Sería mejor en un menú al mantener presionado el mensaje.
- **⏳ eterno con bots:** los mensajes al bot se quedan en ⏳ para siempre, porque el bot no manda ACK.
- **El toast tapa el campo de escribir:** el aviso "💬 BBQ Test (bot)" queda encima del input.
- **Botón de enviar ambiguo:** es un círculo naranja que no dice si envía o graba.

### 6. Perfil
- **El formulario aparece vacío:** no trae el nombre ni el número ya registrados.
- **El candado se dice dos veces:** "Identidad protegida…" aparece en el recuadro y otra vez en el texto de abajo.

### 7. Robustez visual
- **Íconos de un CDN externo:** vienen de jsDelivr (`bootstrap-icons`). Si no cargan (offline o red bloqueada), la barra de pestañas, el botón flotante y el de enviar quedan como círculos vacíos. El service worker no los guarda.
- **El botón flotante tapa contenido:** se superpone a la última tarjeta de tiendas.

### 8. El valor diferencial no se ve
Lo que hace distinta a BBQ casi no aparece en la interfaz: P2P, servidor mínimo, cifrado E2E, IA propia y comercio sin intermediario. Lo único visible es "🟢 Conectado" y el banner de cifrado en un chat vacío.

## Preguntas abiertas de diseño
- **Identidad:** ¿la app tiene que parecerse a WhatsApp (familiar, sin aprendizaje) o tener una identidad propia más marcada?
- **Lugar del comercio:** ¿pestaña aparte (Tiendas) o integrado en los chats (una tienda es un contacto con catálogo)?
- **Contenido de demo:** ¿se saca del todo o se muestra marcado como "ejemplo"?

---

## Dirección acordada (2026-10-07)

Decisiones del dueño del proyecto:

- **Chat:** igual a WhatsApp, familiar y sin curva de aprendizaje.
- **Tiendas y servicios de entrega:** siguen funcionando como hoy, como directorios propios (pestaña Tiendas), no solo como contactos.
- **Referidos:** el programa pasa a Configuración. No más popup al arrancar.
- **Seguridad y privacidad:** destacarlas en la interfaz.
- **Operativa de tiendas:** mejorarla con funciones preparadas para que las use un agente (IA o reglas).
- **Fidelización:** programas tanto para tiendas como para clientes.
- **Modelo de negocio y figura jurídica:** hay un estudio hecho, que todavía no está en el repo. Hay que sumarlo para alinear la fidelización, las comisiones y el escrow.

- **Estilo visual (decidido el 2026-10-07):** sobrio, como WhatsApp. El naranja es solo acento; sin degradados ni brillos.

### Propuesta de estructura (a validar)

**Pestañas (5):** Chats · Estados (con los vivos) · Tiendas (con sub-secciones Tiendas | Entregas) · Llamadas · Yo.
"Yo" junta el perfil, Mi tienda / Mi servicio de entrega, IA, Privacidad, Referidos y Ajustes.

**Seguridad y privacidad visibles:**
- Una pantalla del onboarding que explique en 3 puntos qué ve y qué no ve el servidor.
- 🔒 en la cabecera de cada chat cifrado.
- "Código de seguridad" para verificar un contacto en persona (QR).
- "Centro de privacidad" en Yo: qué datos hay en el teléfono, qué hay en el directorio, cómo exportar o borrar.
- En una compra: "🛡️ Compra protegida: el pago se libera cuando recibís".

**Operativa de tiendas, pensada para agentes.** Todo como herramientas de `BBQTools`; las sensibles requieren confirmación.
- **Catálogo:** variantes, stock, precios y fotos.
- **Pedidos:** estados nuevo → confirmado → preparando → enviado → entregado, más cancelado.
- **Datos de la tienda:** horarios, zonas y costos de envío, respuestas rápidas.
- **Bandeja "El agente propone":** el dueño confirma o rechaza con un toque. Hoy falta esta UI.
- **Configuración del agente:** tono, qué puede hacer solo y qué requiere confirmación, horarios de atención.
- **Servicios de entrega:** pedidos asignados, escaneo del QR del escrow, tarifas y zonas.

**Fidelización, compatible con el P2P (sin base central):**
- **Clientes:** tarjeta de sellos o puntos por tienda, firmados por la tienda y guardados en el teléfono del cliente. Se pueden verificar sin servidor. Más cupones y beneficios por recompra.
- **Tiendas y entregas:** reputación con reseñas firmadas por compradores que pasaron por un escrow real (no se pueden inventar), insignias por cumplimiento y tiempos de respuesta. Los beneficios concretos dependen del modelo de negocio.

### Estado de la dirección acordada

- [x] Sin mockup, 5 pestañas, Yo, referidos en Configuración, pantallas vacías y marcas de ejemplo (tanda 1)
- [x] Seguridad visible: onboarding, 🔒 en el chat, Centro de privacidad y código de seguridad con verificación
- [x] Directorio real de tiendas y servicios de entrega, con fichas firmadas
- [x] Operativa de tiendas: pedidos con estados y aviso al cliente; bandeja "El agente propone"
- [x] Fidelización de clientes: sellos firmados, Mis tarjetas y pedido de canje
- [ ] Fidelización de tiendas, reseñas de compras reales y dinero real: dependen de `docs/MODELO-NEGOCIO.md` (estudio ya en el repo: `docs/MODELO-PAGOS-Y-ENTREGAS.md`)
- [ ] Código de seguridad por QR (cámara)

