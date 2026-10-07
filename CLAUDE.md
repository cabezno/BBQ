# BBQ — notas para Claude

## Reglas de trabajo
- **Documentar y commitear todo lo que se haga.** Cada cambio va con:
  - un commit con un mensaje claro en español;
  - una entrada en `docs/CAMBIOS.md` (qué, por qué, cómo se probó, qué queda pendiente);
  - una actualización de `README.md` / `ARCHITECTURE.md` / `docs/` si cambia el comportamiento o el diseño.
- Pushear a la rama de trabajo al terminar cada tanda.

## Idea del proyecto (no perderla)
- P2P, servidor mínimo (directorio + señalización + relay ciego), libertad del usuario.
- IA del usuario: API propia, on-device o vía su PC de escritorio. **Puede no haber IA** (sin saldo): todo tiene que seguir funcionando sin IA.
- Comercio libre y seguro (escrow), sin intermediario que decida. Las disputas las resuelven comprador y vendedor, los dos ponen un respaldo para litigar, y BBQ solo abre el canal y se deslinda de lo que pase entre usuarios (ver `docs/MODELO-NEGOCIO.md`).

## Diseño
- **Sobrio, como WhatsApp**: que se sienta familiar para que el usuario se adapte rápido. El naranja es solo **acento** (`--bbq-accent`): botones primarios, pestaña activa y chips activos. Sin degradados, sin brillos y sin bordes llamativos.
- Ver `docs/UX.md` para la dirección acordada.

## Convenciones técnicas
- Todo dato que venga de otro peer o del directorio se pinta con `escHtml()` / `safeId()` (`www/js/sanitize.js`).
- El server nunca confía en el `from` del cliente: usa la identidad autenticada del socket.
- Mensajes entre personas: cifrados E2E (`www/js/e2e.js`). No agregar caminos que manden contenido en claro.
- Al cambiar archivos de `www/`, subir `CACHE_NAME` en `www/sw.js`.
- Chequeo rápido: `for f in server.js www/js/*.js www/sw.js; do node --check $f; done`
