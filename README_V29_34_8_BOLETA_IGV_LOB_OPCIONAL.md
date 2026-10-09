FESTOS V29.34.8 — REGISTRO DE COMPRAS

CAMBIOS
- FACTURA: aplica IGV 18% y genera crédito fiscal.
- BOLETA: aplica IGV 18% al Precio de compra, pero NO genera crédito fiscal.
- Otros comprobantes: no aplican IGV automático ni crédito fiscal.
- Se separó internamente aplicar_igv de genera_credito_fiscal.
- El KPI Crédito fiscal suma únicamente comprobantes que generan crédito fiscal.
- Al seleccionar BOLETA, el Precio de compra se recalcula inmediatamente incluyendo 18% de IGV.
- LOB deja de ser obligatorio al registrar o editar una compra.
- Se incluye SQL para crear genera_credito_fiscal, hacer LOB nullable y corregir boletas existentes.

SQL
supabase/FESTOS_V29_34_8_BOLETA_IGV_LOB_OPCIONAL.sql
