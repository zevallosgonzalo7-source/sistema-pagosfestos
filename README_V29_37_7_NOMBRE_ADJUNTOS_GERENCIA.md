# FESTOS V29.37.7 — Nombre automático de adjuntos según Gerencia

Cambio aplicado en Registro de Compras:

- Todo archivo adjunto nuevo toma como nombre base:
  `AÑOMES_RAZONSOCIAL_NUMERODEDOCUMENTO`
- Ejemplo:
  `202610_ENTEL_PERU_SA_F001-000245.pdf`
- AÑOMES sale de `fecha_compra` (`YYYYMM`).
- RAZONSOCIAL sale del proveedor seleccionado (`proveedor_nombre`).
- NUMERODEDOCUMENTO sale de `numero_documento`.
- Se convierte a mayúsculas, se eliminan tildes/caracteres incompatibles y los espacios se convierten en `_`.
- Si no existe fecha: `SINFECHA`.
- Si no existe número de documento: `SIN-DOC`.
- La ruta sigue separada por compra/tipo de adjunto:
  `<compraId>/pdf/<nombre>`
  `<compraId>/xml/<nombre>`
  `<compraId>/cotizacion/<nombre>`
- No requiere SQL.
