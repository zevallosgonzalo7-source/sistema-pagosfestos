# FESTOS V29.34.6 · Registro de Compras

Cambios incluidos:
- Resumen superior: Valor compra, Crédito fiscal, Precio de compra y Compras sin adjunto (rojo).
- Filtros redimensionados y alineados en una grilla estable; menús buscables con fondo sólido y prioridad visual correcta.
- Proyecto se habilita únicamente cuando Categoría de gasto = Costos Directos; sigue permitiendo escribir para buscar.
- Si se cambia a otra categoría de gasto, se limpia el proyecto seleccionado.
- Adjuntos disponibles: PDF, XML, COTIZACIÓN y BOLETA.
- PDF/XML ya no muestran la palabra FACTURA y CTZ se muestra como COTIZACIÓN.
- Número de documento sigue siendo editable manualmente y el PDF intenta detectarlo automáticamente.
- Se agrega `boleta_path` a `public.compras` mediante SQL.

Ejecutar primero `supabase/FESTOS_V29_34_6_COMPRAS_VISUAL_ADJUNTOS.sql`.

Hotfix lector PDF:
- Lectura de hasta 5 páginas en vez de 2.
- Reconstrucción del texto por líneas/posición para PDFs donde serie y correlativo vienen separados.
- Reconoce F001-000123, B001-000123, E001-000123 y variantes con espacios o etiquetas Serie/Número.
- Fallback al nombre del archivo.
- Mensaje visual de éxito o advertencia cuando el PDF no contiene texto seleccionable.
- El número de documento sigue siendo editable manualmente.

Importante: `pdfjs-dist` está declarado en package.json. Si el equipo local venía de una versión anterior, ejecutar `npm install pdfjs-dist` o `npm install` antes de `npm run dev`.
