# FESTOS V29.8 · FECHA DE PEDIDO + VENDEDOR EN PROYECTOS Y DASHBOARD

Esta versión conecta visualmente los campos históricos cargados desde ECONOMICS FESTOS con la interfaz.

## Cambios
- Proyectos muestra `fecha_pedido` como fecha comercial principal.
- Proyectos muestra `ejecutivo` como Ejecutivo / vendedor.
- Los filtros Desde/Hasta de Proyectos usan `fecha_pedido`; si un registro antiguo no la tiene, usan `created_at` como respaldo.
- La ficha completa separa Fecha de pedido de Fecha de registro en FESTOS.
- El formulario de proyecto permite editar Fecha de pedido cuando la columna está disponible.
- Dashboard proyectos filtra y agrupa por mes usando `fecha_pedido` para los proyectos.
- Participación por ejecutivo usa `proyectos.ejecutivo`, por lo que refleja MAR/GONZALO importados desde el Excel.
- FESTOS AI usa también `fecha_pedido` para sus consultas por período y por mes.
- Centro de trabajo usa Fecha de pedido como referencia comercial, conservando `created_at` como fecha técnica.

## PRY
No se modifica el campo `codigo`, ni el trigger, ni la secuencia/correlativo PRY.

## Base de datos
Esta versión presupone que ya se ejecutó `FESTOS_ACTUALIZAR_FECHAS_VENDEDOR_SIN_TOCAR_PRY.sql`.

## Verificación rápida en Supabase
Ejecuta `supabase/V29_08_VERIFICAR_FECHA_VENDEDOR.sql`. Es de solo lectura. Para los 55 históricos importados se espera que las fechas estén cargadas y que el reparto del Excel sea MAR 48 / GONZALO 7, siempre que no se hayan agregado otros proyectos o cambiado ejecutivos después.
