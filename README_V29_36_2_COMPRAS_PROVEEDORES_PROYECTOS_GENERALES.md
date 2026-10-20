# FESTOS V29.36.2 — Compras, proveedores y proyectos generales

Cambios incluidos:
- Se elimina el icono de ojo del listado de Registro de Compras.
- Fecha de control queda editable manualmente por ahora.
- Proveedor rápido: se elimina Categoría y se agrega Nombre comercial.
- Proveedor rápido: contactos múltiples Nombre + Teléfono con botón Agregar contacto.
- Módulo Proveedores actualizado con Razón social, Nombre comercial, RUC/Documento, Producto/Servicio, contacto principal Nombre + Teléfono y contactos adicionales.
- Filtros de Registro de Compras ordenados: CeCo → Categoría de gasto → LOB → Proyecto → Proveedor.
- Proyecto en filtros: sin Costos Directos muestra proyectos generales; con Costos Directos muestra proyectos PRY.
- Los proyectos manuales escritos en Registro de Compras se guardan automáticamente en el catálogo compras_proyectos_generales.
- Compras sin adjunto solo considera FACTURA y RECIBO POR HONORARIOS.
- Dashboard Compras usa la misma regla para el KPI de Sin adjunto.
- Incluye SQL V29_36_2_COMPRAS_PROVEEDORES.sql.

IMPORTANTE: ejecutar el SQL antes de probar esta versión.
