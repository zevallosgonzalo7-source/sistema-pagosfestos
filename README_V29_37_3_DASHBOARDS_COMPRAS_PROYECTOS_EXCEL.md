# FESTOS V29.37.3 — Dashboards Proyectos / Compras + Excel

## Cambios

### Dashboard Proyectos
- El resumen ejecutivo adopta el mismo lenguaje visual del Dashboard Compras.
- Un solo panel petróleo con Valor de proyectos como métrica principal.
- Utilidad proyectada, Costo estimado, Proyectos y Clientes vinculados quedan dentro del mismo panel.
- Responsive conservado.

### Dashboard Compras
- Se elimina el espacio vertical vacío entre Compras por CeCo y Valor por LOB.
- El análisis usa dos columnas independientes: CeCo + LOB a la izquierda, Categoría de gasto + Top proveedores a la derecha.
- En pantallas menores se apila en una sola columna.

### Exportar Excel desde Dashboard Compras
- Nuevo botón `Exportar Excel` en la cabecera.
- Usa exactamente el mismo generador y formato premium del Dashboard Proyectos.
- Respeta los filtros activos del Dashboard Compras.
- Incluye hoja/listado con Código, Fecha compra, Fecha control, CeCo, Categoría de gasto, LOB, Proyecto, Proveedor, Descripción, Comprobante, N° documento, Valor compra, Crédito fiscal, Precio compra y estado de adjunto.
- Incluye resumen filtrado: Compras, Valor compra, Crédito fiscal, Precio compra y Sin adjunto.

No requiere SQL.
