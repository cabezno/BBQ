# Modelo de negocio y figura jurídica: hueco reservado

> **Estado:** pendiente. Hay un estudio hecho sobre el modelo de negocio y la figura jurídica, pero todavía no está en el repo (posiblemente esté en la PC del dueño del proyecto). Cuando aparezca, va en este archivo y se alinea con lo que ya está construido.

## Lo que ya se decidió (sesión del 5 al 8 de septiembre de 2026)

- **Pasarela de pago:** se habló de Mercado Pago (opción para Argentina y LatAm, con soporte de retención), Stripe (con captura manual) u otra. El dueño eligió **"Solo Google Pay en TEST por ahora"**.
- **Alcance de los agentes:** v1 es "atención real + dinero TEST". **v2 es dinero real**, con escrow real (hash, QR y validación de verdad) y una pasarela real. Es un hito propio, independiente de los agentes.
- **Dónde buscar el estudio:**
  - En la PC hay una carpeta `D:/Desktop/SOFTWARE/legal_drafts/` que nunca se abrió. Puede ser ahí.
  - Documento visual de la app (definición completa, ~60 funciones con su estado): https://claude.ai/code/artifact/907712e6-4685-45ef-aa53-e4c1299e9a35

## Qué ya funciona y no depende del modelo

- **Directorio de tiendas y servicios de entrega:** cada dueño publica una ficha firmada (`/api/stores`). Publicar es gratis.
- **Pedidos con estados:** se avisa al cliente por chat cifrado.
- **Bandeja "El agente propone":** el agente propone y el dueño confirma.
- **Fidelización de clientes:** sellos firmados por la tienda, guardados en el teléfono del cliente.
- **Privacidad:** cifrado E2E, Centro de privacidad y código de seguridad.

Nada de esto cobra comisión ni retiene dinero. La plataforma no intermedia en ninguna de estas funciones.

## Qué depende del estudio (huecos en la app)

| Tema | Dónde queda el hueco | Qué hay que decidir |
|---|---|---|
| **Dinero real y escrow** | `google-pay-engine.js` y `escrow-engine.js` están en modo TEST; `/api/pay` es un stub | Quién retiene el dinero: una pasarela con captura diferida (Mercado Pago, Stripe), las partes o la entidad. Retener fondos de terceros suele requerir una figura regulada o delegar en la pasarela. |
| **Comisiones o suscripción** | No hay ninguna en el código | Gratis, comisión por venta, suscripción de tienda, o aportes si es una cooperativa. |
| **Fidelización de tiendas** | En Yo → Programa de fidelidad se ve como "se define con el modelo de negocio" | Beneficios por volumen o antigüedad, menores comisiones, visibilidad en el directorio. |
| **Reseñas y reputación** | Todavía no implementado | Diseño previsto: solo puede reseñar quien completó una compra con escrow real. La reseña va firmada por el comprador y no se puede inventar. Depende de que exista el escrow real. |
| **Resolución de disputas** | Todavía no implementado | Árbitro elegido por las partes, moderadores de la comunidad o la entidad. |
| **Referidos con premio** | Yo → Referidos (los contadores todavía son de prueba) | Qué se gana y quién lo paga. |
| **Facturación y datos fiscales** | No implementado | Si cada tienda factura por su cuenta o la plataforma intermedia. |

## Preguntas para cruzar con el estudio

1. ¿Qué figura jurídica? (SAS, cooperativa, fundación o asociación, u otra). ¿En qué país opera primero?
2. ¿La entidad **toca dinero** de terceros o solo provee la herramienta?
3. ¿Cómo se sostiene el servidor mínimo (directorio, señalización y relay)?
4. ¿Las tiendas y los servicios de entrega son **miembros** (gobernanza) o **clientes**?
5. ¿Qué datos está obligada a conservar la entidad? Hoy el servidor guarda solo nombre, número, claves públicas y las fichas publicadas.
