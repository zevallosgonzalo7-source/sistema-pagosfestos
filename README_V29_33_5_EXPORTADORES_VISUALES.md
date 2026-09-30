# FESTOS V29.33.5 – Exportadores y ajustes visuales

Cambios sobre V29.33.4:

- Exportador por filtros disponible solo en Dashboard, Proyectos y Cotizaciones.
- Clientes y Proveedores ya no muestran botón Exportar Excel.
- Proyectos normaliza Ejecutivo comercial en mayúsculas y evita duplicados MAR/mar, GONZALO/gonzalo.
- Botón Exportar Excel de Proyectos movido a una fila propia junto al subtotal para evitar desbordes.
- Filtros de Cotizaciones ampliados y responsive; el exportador filtrado queda en una fila de acciones separada.
- Cotizaciones conserva intacto el exportador individual existente de cada cotización.
- Dashboard Proyectos incorpora Exportar Excel usando exactamente los filtros activos del Dashboard.
- Excel filtrado mantiene estilo corporativo amarillo/lima + negro y usa logo FESTOS disponible en /public.
- Se eliminó la altura fija de filas del Excel filtrado para evitar texto cortado/encimado y permitir autoajuste.

No requiere SQL nuevo.
