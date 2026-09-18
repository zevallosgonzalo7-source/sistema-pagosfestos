# Excel y actualización en tiempo real

## Exportar cotizaciones
En Cotizaciones > ⋮ > Exportar Excel se genera un archivo `.xlsx` real con dos hojas:
- **Cotización:** datos comerciales, cliente, proyecto, LOB, fechas, usuario, IGV y rentabilidad.
- **Ítems:** todos los ítems con cantidad, venta, costos y margen.

No se genera como CSV, por lo que Excel recibe valores normales y no los muestra entre comillas.

## Realtime
Ejecuta una sola vez `supabase/realtime_directorios.sql` en Supabase para que Clientes, Proveedores, Proyectos y Cotizaciones reciban cambios en vivo. Esto permite que una alta, edición o eliminación realizada en otra pestaña/dispositivo se refleje sin recargar manualmente.
