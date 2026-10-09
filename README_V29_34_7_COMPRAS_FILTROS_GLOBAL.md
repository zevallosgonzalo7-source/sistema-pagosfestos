# FESTOS V29.34.7 — Compras + filtros globales

## Registro de Compras
- Filtros pasan arriba de KPIs.
- Proyecto permite multiselección en filtros.
- Nuevo filtro de Proveedor.
- Se elimina Categoría del módulo; queda Categoría de gasto.
- Proyecto: Costos Directos = selector de proyectos existentes; otras categorías = texto libre.
- Factura genera crédito fiscal 18%; Boleta no genera crédito fiscal.
- Se elimina el switch manual de IGV.
- Tipo de comprobante: se elimina Ticket y Recibo pasa a Recibo por Honorarios.
- Adjuntos visibles: PDF, XML y COTIZACIÓN. Se elimina casillero BOLETA.
- Tarjeta muestra proyecto debajo de la descripción.
- Detalle elimina Categoría, Valor base, Valor compra y Proyecto; muestra Precio de compra.
- Alta rápida de proveedor incluye RUC / Documento.

## Filtros globales
Se normalizaron alturas, anchos, grillas y responsive en Clientes, Proveedores, Proyectos, Cotizaciones, Dashboard, Calendario y Registro de Compras.

## SQL
Ejecutar `supabase/FESTOS_V29_34_7_COMPRAS_Y_FILTROS.sql` una vez.
