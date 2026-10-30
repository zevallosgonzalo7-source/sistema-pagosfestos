# FESTOS V29.42.18 — Corrección visual de Registro de Ventas

Base: V29.42.17. Se restaura el estado dinámico **PENDIENTE / PARCIAL / COBRADO / VENCIDO / PENDIENTE DETRACCIÓN** en las tarjetas, y se muestran **Cobrado** y **Por cobrar** en una línea compacta. Valor venta y margen amarillo están alineados horizontalmente. Se reducen los espacios verticales de cada cabecera.

No se modifican procedimientos SQL, sumatorias ni pagos. Los KPI superiores siguen fuera del módulo, conforme a la decisión anterior de separarlos en otros módulos; la información por factura permanece visible.

Verificar en navegador estados de facturas pendientes, parcialmente cobradas, cobradas y vencidas, junto con vista móvil. No requiere migración SQL adicional con respecto a V29.42.17.
