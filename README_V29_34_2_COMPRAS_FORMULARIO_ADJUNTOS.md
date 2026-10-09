# FESTOS V29.34.2 · Registro de Compras

Cambios del formulario:
- Fecha de compra
- CeCo
- LOB
- Categoría
- Proyecto opcional
- Descripción
- Proveedor
- Alta rápida de proveedor desde Compras
- Monto total + switch IGV 18%
- Tipo de comprobante
- Si es FACTURA: PDF FACTURA / XML FACTURA / CTZ

Cambios del listado:
- Se eliminó visualmente todo lo relacionado con pagado / pendiente / saldo.
- "Monto compra" pasa a "Valor compra".
- Cabecera limpia: código + descripción + indicador de adjuntos + valor compra + fecha.
- Indicador rojo si a una factura le faltan adjuntos y verde si la documentación requerida está completa.
- Los datos completos se muestran solo al expandir el detalle.

Antes de usar esta versión ejecutar:
`supabase/FESTOS_V29_34_2_COMPRAS_DOCUMENTOS.sql`
