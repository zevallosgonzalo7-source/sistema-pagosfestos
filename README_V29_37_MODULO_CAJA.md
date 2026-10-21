# FESTOS V29.37 — Módulo Caja

Se incorpora un único módulo **Caja** con acceso hover/submenú a:
- CAJA IBK
- CAJA CHICA

Incluye:
- saldo inicial configurable por caja;
- saldo disponible calculado en tiempo real;
- ingresos, egresos y neto;
- historial tipo banco;
- filtros por caja, fechas, ingreso/egreso y origen;
- movimientos manuales;
- asociación de egresos con Registro de Compras;
- pagos parciales de compras;
- transferencia entre CAJA IBK y CAJA CHICA con doble movimiento enlazado;
- estructura preparada para asociar Registro de Ventas después;
- vista rápida de compras pagadas y saldo pendiente.

## Antes de probar
Ejecutar en Supabase SQL Editor:
`supabase/FESTOS_V29_37_CAJA.sql`

Luego iniciar la web normalmente.

Los Excel históricos de Caja IBK y Caja Chica se migrarán después de revisar sus columnas y cuadrar saldos iniciales/finales.
