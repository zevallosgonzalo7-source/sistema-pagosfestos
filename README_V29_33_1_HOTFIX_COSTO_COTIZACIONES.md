# FESTOS V29.33.1 — Hotfix costo de cotizaciones

## Problema corregido
Al editar una cotización, el listado recargaba el Valor venta desde Supabase, pero el detalle podía seguir usando los ítems que estaban guardados en memoria antes de la edición. Por eso se podía ver un Valor venta nuevo con un Costo/Utilidad/Margen antiguos.

## Corrección
- Ver detalle siempre vuelve a consultar `cotizacion_items` en Supabase.
- Después de guardar una edición se invalida el detalle almacenado de esa cotización.
- Se escucha Realtime de `cotizacion_items` para invalidar detalles si otro usuario modifica una cotización.
- No se cambia la fórmula de creación ni la lógica comercial de cotizaciones.
- No requiere SQL nuevo.
