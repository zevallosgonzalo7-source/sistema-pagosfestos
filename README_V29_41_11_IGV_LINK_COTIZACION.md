# FESTOS V29.41.11 — IGV 18%/10.5% + cotización vinculada

## Registro de Compras
- Selector clickeable de tasa IGV: 18% o 10.5%.
- Recalcula crédito fiscal y precio de compra.
- La tasa queda persistida en `compras.igv_rate`.
- Al editar una compra, se recupera la tasa usada.
- SIN COMPROBANTE y comprobantes sin IGV mantienen IGV automático en 0.

## Proyectos
- El bloque `Cotización vinculada` ahora es clickeable.
- Abre el módulo Cotizaciones y despliega directamente la cotización relacionada.
- Incluye hover premium y flecha de navegación.

## SQL
Ejecutar una vez: `supabase/FESTOS_V29_41_11_IGV_RATE_COMPRAS.sql`.
