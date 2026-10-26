# FESTOS V29.41.7 — Cotización Directa sin ítems

- Modo Directo ya no exige descripción/valor en un ítem.
- En Directo solo se valida que exista un Valor venta total mayor a 0.
- Al guardar Directo no se crean ítems ficticios.
- El modo se guarda ahora en `cotizaciones.modo`, por lo que al reabrir sigue siendo Directo aunque tenga cero ítems.
- En el detalle se aclara que las cotizaciones directas no requieren ítems.

Ejecutar una vez:
`supabase/FESTOS_V29_41_7_COTIZACION_DIRECTA_SIN_ITEMS.sql`
