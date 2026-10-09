# FESTOS V29.34.3 — Selectores buscables

Mejora UX sin cambios de lógica ni Supabase.

## Qué cambia
- Los selectores largos ahora permiten escribir directamente para filtrar opciones.
- Navegación con teclado: flechas, Enter y Escape.
- Búsqueda sin distinguir mayúsculas/minúsculas ni tildes.
- Mantiene las opciones "Todos", "Sin proyecto" y similares.

## Aplicado en
- Registro de Compras: Proyecto, LOB, Categoría y Proveedor; también en el formulario.
- Proyectos: Ejecutivo comercial, Categoría y Cliente en registro/edición.
- Cotizaciones: Ejecutivo comercial; Cliente, Proyecto y Categoría general del formulario.
- Dashboard: Ejecutivo comercial y Categoría.
- Calendario Global: Responsable y Proyecto relacionado.

Los selectores simples de pocos valores (Estado, tipo de comprobante, etc.) se mantienen nativos para no recargar la interfaz.

No requiere SQL nuevo.
