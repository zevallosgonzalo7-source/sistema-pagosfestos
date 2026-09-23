# FESTOS V29.11 · Dashboard compacto + categoría general de cotización

## Cambios
- La tarjeta verde agrupa el Valor de proyectos y cuatro tarjetas blancas: Utilidad proyectada, Costo estimado, Proyectos, Clientes vinculados. Se elimina solo el indicador «Proveedores activos» del Dashboard; el módulo Proveedores sigue existiendo.
- Los filtros usan fechas locales YYYY-MM-DD y la fecha de pedido comercial (`fecha_pedido`), con `created_at` como respaldo si no existe. Los filtros «Por mes», «Por trimestre» y «Por año» permiten escoger el período de calendario completo (incluidas fechas de pedido posteriores a hoy); «Todo el historial» recupera los demás meses/años. Si no hay registros en un período, se indica explícitamente.
- Participación por ejecutivo es un gráfico circular por valor de venta SIN IGV; GONZALO azul, MAR verde; leyenda con porcentaje y monto.
- Las tarjetas de gráficos quedan distribuidas en filas con separación y comportamiento adaptable a pantallas pequeñas.
- La categoría se selecciona solo UNA VEZ en la cabecera de la cotización (`cotizaciones.lob`). Se retira el selector por ítem, su columna en Excel y la categoría por ítem en detalles/PDF. Las nuevas grabaciones de ítems dejan la categoría individual vacía. Al editar y guardar cotizaciones antiguas, sus categorías por ítem antiguas se dejan vacías. No se modifica ningún registro histórico hasta que alguien edite y guarde esa cotización.
- El motor de voz interpreta también las frases antiguas «categoría del ítem» como categoría de la cotización.

## Base de datos y PRY
No necesita SQL nuevo. Se mantiene `cotizaciones.lob` por compatibilidad y la columna opcional `cotizacion_items.categoria` para no romper bases previas; ya no se solicita ni muestra la segunda. No toca `proyectos.codigo`, correlativos, funciones ni triggers PRY. No se migran registros ni se borran categorías históricas masivamente.

## Pruebas sugeridas
1. En Dashboard selecciona «Todo el historial», «Por año», «Por trimestre», «Por mes» (con año y mes elegidos) y un rango personalizado que incluya una fecha_pedido conocida. Compara cantidad y valor con Proyectos.
2. Abre Cotizaciones > Nueva: selecciona categoría general y agrega dos ítems. Guarda un borrador, reabre y comprueba que la categoría se conserva en la cabecera, sin selector por ítem.
3. Comprueba el gráfico de ejecutivo en distintas resoluciones. Antes de generar el instalador para terceros, ejecuta `npm install`, `npm run build` y `npm run desktop:dev` en tu PC.
4. Esta versión no incluye el modelo pesado de voz. Conserva `public/voice-assets/` (y otros assets locales) en tu proyecto al actualizar. Para producir instaladores, ejecuta `npm run voice:check` antes de `npm run desktop:build`.
