# FESTOS V29.23 — Valor venta en Cotizaciones

- El PDF para clientes presenta VALOR VENTA como subtotal sin IGV y muestra por separado el IGV y el importe con IGV.
- La función de correo de revisión de cotizaciones presenta Valor venta (sin IGV) e Importe con IGV por separado. Para aplicar esta modificación al correo de Supabase, desplegar de nuevo la Edge Function `send-quote-review-email`; el despliegue web por sí solo no actualiza la función.
- No se modifican datos ni columnas de la base de datos: no requiere SQL.
