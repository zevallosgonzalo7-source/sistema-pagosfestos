# FESTOS V29.36.2 — Compras + Proveedores

Cambios:
- Se elimina el ojo de las tarjetas de Registro de Compras.
- Fecha de control queda editable manualmente.
- Proveedor rápido: sin Categoría; agrega Nombre comercial, RUC/Documento, Producto/Servicio y contactos Nombre + Teléfono con botón Agregar contacto.
- Módulo Proveedores replica la misma estructura y elimina Categoría de la UI/filtros.
- Proyectos generales de compras se guardan en un catálogo nuevo y se reutilizan.
- Orden de filtros en Compras: CeCo → Categoría de gasto → LOB → Proyecto → Proveedor.
- Sin Categoría o en categorías distintas de Costos Directos, Proyecto muestra solo proyectos generales.
- Con Costos Directos, Proyecto muestra los PRY existentes.
- Compras sin adjunto solo cuenta FACTURA y RECIBO POR HONORARIOS sin archivo. Boletas y otros comprobantes no generan alerta por falta de adjunto.
- Dashboard Compras replica la lógica de filtros y adjuntos, y carga catálogos aunque todavía existan 0 compras.

SQL requerido: supabase/V29_36_2_COMPRAS_PROVEEDORES.sql
