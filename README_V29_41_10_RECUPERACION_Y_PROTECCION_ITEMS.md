# FESTOS V29.41.10 — Recuperación y protección de ítems de Cotizaciones

## Incidente corregido
Al cambiar/guardar una cotización en modo Directo, el frontend podía enviar `p_items = []`. La función `actualizar_cotizacion_con_items` eliminaba primero los ítems existentes y luego no insertaba ninguno.

## Protección nueva
- Directo sigue permitiendo 0 ítems para cotizaciones nuevas.
- Directo ya no significa borrar ítems existentes.
- Si una cotización directa existente llega con lista vacía por error, PostgreSQL conserva sus ítems.
- Si una cotización directa sí tiene ítems cargados, estos se vuelven a guardar normalmente.
- Antes de reemplazar ítems se guarda un snapshot en `cotizacion_items_historial`.

## Recuperación COT-2026-953312
El SQL incluido reconstruye los 20 ítems y cantidades visibles en el PDF recuperado.

El PDF del cliente no muestra costo interno ni valor individual de los ítems, por lo que `costo`, `valor_unitario`, `valor_total` y `margen` se restauran en 0. Esos valores internos deben reingresarse si correspondían.

## SQL
Ejecutar:
`supabase/FESTOS_V29_41_10_PROTECCION_Y_RECUPERACION_ITEMS.sql`
