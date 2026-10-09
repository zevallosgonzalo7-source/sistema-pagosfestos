# FESTOS V29.34 — Registro de Compras

Primera versión funcional del Registro de Compras.

## Concepto
- Compra = lo que la empresa adquiere / obligación contraída.
- Pago = salida real de dinero; se implementará después desde Caja Interbank y Caja Chica.
- Una compra puede tener proyecto o ser una compra general sin proyecto.

## Incluye
- Nuevo módulo “Registro de compras”.
- Alta, edición y eliminación de compras.
- Proyecto opcional.
- Proveedor registrado o nombre libre.
- Categorías de compra.
- Comprobante opcional.
- Condición CONTADO / CREDITO y vencimiento.
- Estado de pago preparado: PENDIENTE / PARCIAL / PAGADA.
- Resumen: total comprado, compras de proyectos, compras generales y pendiente de pago.
- Filtros por fecha, proyecto, categoría y estado de pago.
- Realtime.
- En detalle de Proyectos se muestra Compras registradas y Utilidad real preliminar.

## Requisito
Ejecutar `supabase/FESTOS_V29_34_REGISTRO_COMPRAS.sql` antes de usar el módulo.
