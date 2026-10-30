# FESTOS V29.42.19 — Ajuste visual de la cabecera de Registro de Ventas

Base: V29.42.18.

- Se conserva solo el chip de estado dinámico (COBRADO, PENDIENTE, PARCIAL, VENCIDO, etc.) en la cabecera; se ocultan los importes de Cobrado y Por cobrar de esa misma cabecera.
- Valor venta y margen permanecen uno al lado del otro.
- Si costo registrado = 0, el chip de margen muestra «Por verificar» en vez de 100.0 %, sin modificar el margen numérico, costo o utilidad guardados. Si el costo es positivo, se muestra el porcentaje calculado existente.
- No se alteran formularios, pagos, totales, filtros, funciones SQL ni la base de datos.

No requiere SQL adicional.

Nota: cuando el costo sea realmente cero y esté validado, el margen matemático puede ser 100 %. La indicación «Por verificar» es deliberadamente conservadora para evitar mostrar esa rentabilidad como confirmada sin verificar los costos.

Validar la compilación y la vista en el entorno operativo antes de pasar a producción.
