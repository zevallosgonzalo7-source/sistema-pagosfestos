# FESTOS V29.37.2 — Hotfix Proveedores

Cambios:
- RUC / Documento deja de ser obligatorio en Proveedores.
- Edición de proveedores migrados ya no falla si teléfono, contacto, observaciones, nombre comercial o RUC vienen NULL.
- Se protegen los `.trim()` del formulario de proveedor y de contactos.
- CONTADO guarda `plazo_dias = NULL`.
- El formulario rápido de proveedor dentro de Registro de Compras recibe el mismo ajuste.
- En CONTADO el campo de plazo queda vacío/deshabilitado.

Base: FESTOS V29.37.0 MODULO CAJA.
No requiere SQL adicional.

Validación técnica:
- Se revisaron los puntos de guardado/edición afectados.
- No se pudo completar `npm run build` en el entorno de generación porque la instalación de dependencias (`npm ci`) agotó el tiempo disponible.
