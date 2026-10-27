# FESTOS V29.42 — REG. VENTAS V1

## Incluye
- Nuevo módulo REG. VENTAS en el launcher y navegación.
- Registro de múltiples facturas por proyecto.
- Acción “Facturar proyecto” desde Proyectos.
- Registro de fecha de factura y fecha de control.
- Sincronización automática de LOB y Fecha de control hacia Compras vinculadas.
- Costo real calculado desde `compras.monto_base` del proyecto.
- Valor venta, utilidad, margen, vencimiento, comisión y saldo calculados automáticamente.
- Actualización de avance de facturación en Proyectos (`NO FACTURADO`, `PARCIAL`, `FACTURADO`).
- Impacto visible antes de confirmar la venta.

## SQL obligatorio
Ejecutar una vez:
`supabase/FESTOS_V29_42_REG_VENTAS_V1.sql`

## Nota
La Fecha de control se propone igual a la fecha de factura, pero queda editable antes de confirmar para respetar el control administrativo usado en el Excel.
