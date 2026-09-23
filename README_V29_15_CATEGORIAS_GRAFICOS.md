# FESTOS V29.15

- Las 10 categorías reemplazan las antiguas opciones en los selectores de Proyectos y Cotizaciones. Por compatibilidad el campo físico en Supabase sigue siendo `lob`.
- El Dashboard agrupa solo las 10 categorías, normaliza diferencias de mayúsculas/tildes/espacios y vuelve a consultar al regresar a la ventana. Los registros históricos con las 3 LOB antiguas quedan sin clasificar hasta que se editen individualmente; no se asignan categorías inventadas.
- El filtro de categoría de Proyectos coincide con las 10 categorías normalizadas.
- Los puntos del gráfico son verde petróleo y el único texto emergente es mes + importe. Pulsar un punto, la etiqueta del mes o una celda del mapa abre Proyectos filtrados por ese mes del año seleccionado.
- FESTOS Voz queda oculto y no se monta su componente, por lo que no activa el micrófono. Su código se conserva para una futura activación.
- No se modifican tablas, códigos PRY ni correlativos. Si un proyecto nuevo no aparece, comprueba que su fecha de pedido cae dentro del período seleccionado, y que `lob` contiene una de las 10 categorías.
- No se ha verificado la compilación completa en este entorno. Probar `npm install` y `npm run desktop:dev` antes de distribuir.
