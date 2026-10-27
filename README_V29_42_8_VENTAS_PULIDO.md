# FESTOS V29.42.8 — Reg. Ventas pulido

- RPC `eliminar_venta_festos` recreada y visible para PostgREST.
- RPC `editar_venta_festos` recreada.
- Nuevo helper `recalcular_facturacion_proyecto_festos`.
- Eliminar recalcula proyecto(s), incluyendo facturas multiproyecto.
- Editar actualiza fecha de control de compras de todos los proyectos relacionados.
- Frontend incluye fallback seguro si PostgREST todavía reporta `PGRST202 / schema cache`.
- Cobros y vínculos se eliminan por cascade al borrar una venta.
- Se agrega feedback de error real; no se deja una acción silenciosamente fallida.

## SQL obligatorio
Ejecutar `supabase/FESTOS_V29_42_8_VENTAS_ACCIONES_BLINDADAS.sql`.
Al final deben listarse 3 funciones.
