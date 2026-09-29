# FESTOS V29.33.2 — Cotizaciones READY

Hotfix de consistencia para uso frecuente.

## Correcciones
- Editar una cotización ahora guarda cabecera + ítems en una única transacción PostgreSQL.
- Los ítems eliminados se eliminan realmente al guardar cambios.
- Si algo falla al reemplazar ítems, la transacción completa falla en vez de dejar totales e ítems desincronizados.
- Al cambiar `cotizacion_items` por Realtime se cierra cualquier detalle abierto y se limpia la caché.
- Después de guardar se limpia todo detalle en memoria; `Ver detalle` vuelve a consultar Supabase.
- Se verifica la cantidad de ítems guardados.

## Obligatorio antes de desplegar
Ejecutar en Supabase SQL Editor:
`supabase/FESTOS_V29_33_2_GUARDADO_ATOMICO_COTIZACIONES.sql`

No requiere cambiar tablas ni borrar datos.
