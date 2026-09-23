# FESTOS V29.21 — Desarrollos especiales

Se añade «Desarrollos especiales» como novena categoría en el catálogo compartido `src/categories.js`. Lo consumen los selectores de Proyectos y Cotizaciones, los filtros y la visualización del Dashboard. Se conservan las ocho categorías anteriores y las asociaciones existentes.

El SQL adjunto es opcional para las instalaciones que crearon `public.categorias_festos` mediante el SQL propuesto anteriormente: añade la fila al catálogo auxiliar si existe. FESTOS usa actualmente el catálogo del código, no consulta esa tabla. No asigna categorías a proyectos ni cambia datos de negocio.

Instala el nuevo ZIP de código y vuelve a compilar/desplegar la aplicación. Si tu base de datos tiene validaciones CHECK o ENUM personalizadas para `lob`, revisa sus definiciones antes de guardar proyectos de la categoría nueva: el esquema real de tu Supabase no está incluido en este ZIP.
