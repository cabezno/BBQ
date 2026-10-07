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
