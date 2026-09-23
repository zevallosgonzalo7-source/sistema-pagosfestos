# FESTOS V29.9 — Categorías y Dashboard lateral

## Orden seguro de activación
1. Haz una copia del proyecto y un respaldo de Supabase.
2. Supabase > SQL Editor: ejecuta **supabase/V29_09_CATEGORIAS_ITEMS_SIN_TOCAR_PRY.sql**.
3. Actualiza el código de FESTOS con este ZIP completo. En el directorio del proyecto ejecuta `npm install` y `npm run desktop:dev`.
4. Prueba nueva cotización con categorías distintas en dos ítems; guarda borrador, recarga y confirma que ambas persisten.
5. Prueba selección y filtros de categoría en Proyectos y Dashboard proyectos.
6. Prueba Dashboard > Proyectos y Dashboard > Ventas desde flecha en menú lateral; Ventas sigue sin datos.
7. Antes de repartir `.exe`, compila y prueba localmente `npm run desktop:build`.

## Compatibilidad e históricos
- En la base, `proyectos.lob` y `cotizaciones.lob` **mantienen su nombre técnico** por compatibilidad con los RPC actuales, pero la interfaz los muestra como **Categoría** con las 10 opciones nuevas.
- `cotizacion_items.categoria` es la nueva columna independiente para cada ítem. Ítems históricos quedan sin categoría hasta que se clasifiquen manualmente.
- Los registros históricos que tengan las 3 LOB antiguas se muestran como categorías anteriores, sin reasignarlos automáticamente. Pueden reclasificarse manualmente al editar.
- No se modifican `codigo`, PRY, triggers, secuencias, fechas, precios ni valores de proyectos.
- Las categorías de proveedores son un catálogo diferente: no se sustituyen por las categorías comerciales de proyectos/cotizaciones.
- El Dashboard ventas sigue siendo solo un prototipo, sin consultar datos.
- No necesitas volver a ejecutar `voice:prepare` si tu modelo de voz local ya funciona. Para distribuir el instalador, `voice:check` sí debe pasar.

## Pruebas pendientes
Esta entrega no ejecuta SQL en tu Supabase ni sustituye las pruebas manuales de guardar/aprobar cotizaciones y de la instalación real en Windows/macOS.
