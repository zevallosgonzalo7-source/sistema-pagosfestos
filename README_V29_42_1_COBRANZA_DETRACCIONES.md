# FESTOS V29.42.1 — Cobranza, vencimientos y detracciones

- Clientes es la fuente del tipo de pago y plazo de crédito.
- La factura guarda un snapshot del plazo para que cambios futuros del cliente no alteren facturas antiguas.
- Fecha de vencimiento = fecha de factura + plazo de crédito.
- Detracción configurable por factura, con 12% como valor inicial cuando aplica.
- Se separa el pago comercial de la detracción.
- Historial de pagos por factura (`ventas_cobros`).
- Estados visuales: Pendiente, Parcial, Vencido, Pendiente detracción y Cobrado.
- Alertas superiores para vencidos, próximos a vencer y detracciones pendientes.
- El pago comercial esperado descuenta detracción y retención del precio total.

## SQL
Ejecutar después de V29.42:
`supabase/FESTOS_V29_42_1_COBRANZA_DETRACCIONES.sql`
