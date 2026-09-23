# FESTOS V29.16 · categorías, meses y adaptación móvil

- La categoría comercial sigue almacenada en el campo `proyectos.lob` por compatibilidad con la base actual. El dashboard identifica valores con mayúsculas, tildes y espacios distintos; usa `categoria` si dicha columna existe y contiene una categoría válida.
- `Textil` debe estar guardado como `proyectos.lob = Textil` para que aparezca en la categoría Textil. Antes de concluir que el gráfico falla, verifica la fecha de pedido y los filtros activos. El SQL `supabase/V29_16_DIAGNOSTICO_CATEGORIAS.sql` es solo de lectura.
- Los meses son botones y abren Proyectos filtrados por ese mes. El punto del gráfico muestra únicamente el monto; se elimina la apariencia blanca de los puntos inactivos. En teléfonos, usa las etiquetas mensuales táctiles.
- FESTOS Voz permanece desactivado y oculto visualmente, sin borrar el código ni el modelo preparado.
- Los filtros del Dashboard y de Proyectos pueden plegarse en móvil; se ajustaron tarjetas, formularios, listas y controles a pantallas pequeñas. Las pruebas visuales reales en Safari/iPhone y Chrome/Android siguen pendientes.
- No cambia datos de Supabase, códigos PRY, numeración, ni funciones de seguridad. No requiere ejecutar SQL.
