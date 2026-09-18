# CSSFESTOS V3 – LOB, contactos y filtros de Proyectos

## Cambios
- Proveedores: filtro por categoría + condición de pago + fechas.
- Clientes: se elimina el filtro de categoría; el contacto de cliente usa Teléfono, Nombre y Cargo (ya no solicita correo).
- Cotizaciones: campo LOB obligatorio con Espacio de estructuras, Producción gráfica y Producción 360.
- Proyectos: estados EN PROCESO, FINALIZADO y FACTURADO.
- Proyectos: muestra quién cargó el proyecto, heredado de `cotizaciones.created_by` al aprobar.
- Proyectos: filtro por estado, cargador y fechas.
- Proyectos: subtotal dinámico de Valor venta de todos los proyectos visibles con los filtros actuales.
- Eliminación de proyectos: solo GONZALO mediante RPC controlada.
- Valor venta usa separadores de miles mediante el helper de dinero existente.

## Supabase
Ejecutar en SQL Editor, después de las migraciones anteriores:

`supabase/v3_lob_proyectos_filtros.sql`

La migración:
- crea `cotizaciones.lob`;
- crea `proyectos.created_by`;
- normaliza estados antiguos;
- crea `cliente_contactos.nombre`;
- actualiza `aprobar_cotizacion` para heredar `created_by`;
- bloquea DELETE directo de proyectos y crea `eliminar_proyecto_gonzalo`.

No elimina datos de clientes, proveedores, cotizaciones ni proyectos.
