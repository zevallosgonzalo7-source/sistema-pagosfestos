# FESTOS V29.42.21 — Margen en listado con costo cero

- Cambio único sobre la V29.42.20: en la cabecera compacta de Registro de Ventas, si el costo registrado es cero y el valor de venta es positivo, el margen se muestra como **100.0 %** en vez de «Por verificar».
- Si el costo es mayor que cero, continúa mostrándose el margen numérico del registro.
- No se alteraron importes guardados, compras, utilidad ni cálculos de Supabase.
- No requiere SQL adicional.
- El 100 % depende de que el costo cero sea correcto en el registro; no constituye una validación de las compras vinculadas.
