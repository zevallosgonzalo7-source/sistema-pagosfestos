# FESTOS V29.15 · Categorías y gráfico mensual

- El campo físico de `public.proyectos` sigue llamándose `lob` por compatibilidad con los disparadores y funciones vigentes. En la aplicación se presenta como Categoría.
- Las diez categorías actuales se muestran siempre; `TEXTIL`, `Textil` y variantes de tildes/espacios se agrupan en Textil.
- Los proyectos con las tres LOB históricas aparecen como «Pendiente de clasificar». Se pueden abrir con clic y reclasificar individualmente en Proyectos. No se reasignan sin que el usuario decida a cuál de las diez categorías corresponde cada uno.
- Los proyectos con valor venta cero aparecen con valor cero en el gráfico. Para que su valor se sume, registre el valor de venta sin IGV.
- El dashboard escucha cambios de proyectos en Supabase cuando está configurado Realtime; además se recarga al volver a la ventana o pulsar Actualizar.
- El gráfico mensual mantiene la línea sin cortes blancos y el tooltip flotante muestra solamente el importe de ese mes junto al punto.
- No es necesario ejecutar ningún SQL nuevo y no se cambia el correlativo ni los códigos PRY.
- Para diagnosticar un proyecto de prueba, ejecute opcionalmente el SQL de solo lectura `supabase/V29_15_REVISAR_CATEGORIA_PROYECTO.sql`.

- Los nombres Ene–Dic debajo del gráfico, sus puntos y las celdas del mapa mensual son clicables: abren Proyectos filtrados por fecha de pedido del mes/año seleccionado y conservan filtros de ejecutivo comercial y categoría.
- El gráfico mensual siempre muestra los doce meses del año seleccionado, incluso si los KPI usan otro período. El año se puede elegir en el filtro del Dashboard; la cifra en la cabecera del gráfico es la suma de ese año.

## Pausa temporal de voz
- No se monta el componente FESTOS Voz, no se activa el micrófono y no se muestran widgets, botones ni indicadores de voz. El código fuente de voz se conserva sin ejecutar, para volver a activarlo después.
- Compilar escritorio no requiere `voice:check` mientras el módulo está oculto. Los comandos manuales `voice:prepare` y `voice:check` continúan disponibles para la futura reactivación.

## Comprobación manual importante
- Crear un proyecto Textil con valor de venta cero lo cuenta como proyecto, pero no aumenta el valor monetario de esa categoría. Para incrementar el valor del gráfico hay que registrar su valor de venta sin IGV.
- El gráfico y Proyectos agrupan `TEXTIL`, `Textil` y diferencias de tildes de las categorías actuales; las tres LOB históricas siguen sin reasignación automática.
- El gráfico del Dashboard se refresca al volver a él, al recuperar el foco y al recibir cambios de Supabase Realtime cuando esté habilitado en la base.
- Los meses del gráfico usan la fecha de pedido del proyecto, o la fecha de creación cuando no se registró fecha de pedido.
