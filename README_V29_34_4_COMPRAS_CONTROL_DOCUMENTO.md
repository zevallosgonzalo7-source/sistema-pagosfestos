# FESTOS V29.34.4 — Registro de Compras

Cambios:
- Filtros de Compras reorganizados en filas para evitar solapamientos.
- Nuevo campo **Fecha de control**, solo lectura por ahora. Queda preparado para llenarse desde Registro de Ventas.
- IGV desactivado en Registro de Compras; el Valor compra es exactamente el valor ingresado.
- Nuevo campo **Número de documento** editable manualmente.
- Al seleccionar PDF FACTURA, FESTOS intenta detectar automáticamente el número del comprobante leyendo las primeras páginas del PDF. El usuario puede corregirlo manualmente.
- Se agrega `pdfjs-dist` para lectura local del PDF en navegador.
- Requiere ejecutar `supabase/FESTOS_V29_34_4_COMPRAS_CONTROL_DOCUMENTO.sql`.
