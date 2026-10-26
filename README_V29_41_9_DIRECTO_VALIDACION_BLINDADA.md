# FESTOS V29.41.9 — Cotización Directa: validación blindada

## Corrección
- Directo ya no valida ítems bajo ninguna variante de mayúsculas/minúsculas del modo.
- `Directo`, `DIRECTO` y `directo` se normalizan a `directo` al guardar.
- Solo Detallado exige al menos un ítem con descripción y valor.
- Directo exige únicamente Valor venta total > 0.
- El payload y los items usan el mismo modo normalizado.
- En Directo se envía siempre una lista vacía de ítems.

## SQL
No requiere SQL nuevo si ya se ejecutó V29.41.7.
