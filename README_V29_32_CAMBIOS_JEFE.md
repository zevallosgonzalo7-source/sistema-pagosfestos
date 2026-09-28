# FESTOS V29.32 — Cambios solicitados

Cambios incluidos sobre la copia VF recuperada:

- Cotizaciones y Proyectos ahora abren primero su listado; la creación queda en sus botones internos.
- Cotizaciones incorpora filtro por Ejecutivo comercial.
- Nueva/Editar cotización permite seleccionar Ejecutivo comercial.
- Se elimina "Desarrollos especiales" del catálogo de categorías nuevas.
- En cotizaciones se oculta la línea IGV y "Importe con IGV" pasa a llamarse "Precio venta".
- Costo y Utilidad se recalculan a partir de los ítems para el detalle y la exportación.
- Valor venta queda resaltado al abrir "Ver detalle".
- En el detalle de ítems se muestran exactamente: Valor venta, Utilidad y Margen.
- El formulario de ítems muestra Valor venta, Utilidad y Margen.
- Excel corporativo mantiene el estilo de referencia y usa Valor venta, Precio venta, Costo, Utilidad y Margen, sin fila IGV.
- PDF comercial deja de mostrar la fila IGV y muestra Precio venta junto a Valor venta.

Nota: no se requiere una migración SQL nueva para estos cambios porque la columna de ejecutivo ya existe en la versión recuperada.
