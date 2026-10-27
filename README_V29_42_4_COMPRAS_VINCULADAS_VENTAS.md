# FESTOS V29.42.4 — Compras vinculadas en Registro de Ventas

## Cambios
- En Registrar venta se agregó un bloque desplegable **Compras vinculadas al proyecto**.
- Muestra proveedor, comprobante, descripción, fecha y valor de cada compra.
- Muestra una vista previa **antes → después** del LOB y Fecha de control que se aplicarán al confirmar la venta.
- Si el proyecto no tiene compras vinculadas, se informa claramente y el costo real permanece en S/. 0.00.
- No requiere SQL nuevo.

## Importante
La sincronización real de LOB y Fecha de control continúa ejecutándose en la RPC de Registro de Ventas creada en V29.42.
