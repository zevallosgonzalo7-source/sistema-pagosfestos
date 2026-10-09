# FESTOS V29.34.7 · Registro de Compras

Cambios principales:
- Filtros movidos arriba de los KPI.
- Proyecto permite multiselección en filtros.
- Nuevo filtro Proveedor.
- Se elimina Categoría comercial del módulo Compras; queda Categoría de gasto.
- Proyecto: para Costos Directos se selecciona desde Proyectos; para otras categorías se escribe libremente.
- Proyecto visible debajo de la descripción en la tarjeta.
- Detalle simplificado: se retira Categoría, Proyecto, Valor base, IGV y Valor compra; se muestra Precio de compra.
- Adjuntos: PDF, XML y COTIZACIÓN. Se retira BOLETA como casillero independiente.
- Tipo de comprobante: se retira TICKET y RECIBO pasa a RECIBO POR HONORARIOS.
- FACTURA aplica 18% de IGV y genera crédito fiscal.
- BOLETA aplica 18% de IGV pero NO genera crédito fiscal.
- Alta rápida de proveedor incluye RUC / Documento.
- SQL: `supabase/FESTOS_V29_34_7_COMPRAS_AJUSTES.sql`.
