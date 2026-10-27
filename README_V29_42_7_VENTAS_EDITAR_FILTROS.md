# FESTOS V29.42.7 — Registro de Ventas: editar, eliminar y filtros

- Reg. Ventas adopta filtros con formato consistente con Cotizaciones/Proyectos: búsqueda, Desde/Hasta, Cliente, LOB, Ejecutivo y Estado.
- Botón Limpiar filtros y contador de ventas visibles.
- En el detalle de cada venta: Editar venta / Eliminar.
- Editar conserva el historial de cobros y recalcula saldos, vencimiento, detracción, utilidad y comisión.
- Eliminar pide confirmación, borra cobros vinculados por cascade y recalcula el estado de facturación de proyectos asociados.
- Las facturas multiproyecto pueden editar metadatos, pero su monto total queda protegido para no desalinear la distribución por proyecto.
- Requiere ejecutar `supabase/FESTOS_V29_42_7_VENTAS_EDITAR_ELIMINAR.sql`.
