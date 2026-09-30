# FESTOS V29.33.4 — Excel filtrado

## Alcance
- Cotizaciones: SIN CAMBIOS. Su código y exportación Excel permanecen idénticos a V29.33.3.
- Proyectos: Exportar Excel usa exactamente la lista filtrada visible.
- Clientes: Exportar Excel usa exactamente la lista filtrada visible.
- Proveedores: Exportar Excel usa exactamente la lista filtrada visible.

## Formato
- Cabecera visual inspirada en el Excel de Cotizaciones.
- Colores amarillo/lima y negro del formato existente.
- Logo FESTOS cuando el navegador puede cargar `/festoslogo.png`.
- Filtros aplicados al pie del archivo.
- Cantidad de registros exportados al pie.
- Proyectos agrega resumen de cantidad y Valor venta filtrado.

## Base de datos
No requiere SQL ni cambios de Supabase.

## Prueba recomendada
1. Abrir Proyectos, Clientes o Proveedores.
2. Aplicar uno o varios filtros.
3. Pulsar Exportar Excel.
4. Confirmar que el Excel contiene solo los registros visibles por el filtro.
5. Revisar el bloque FILTROS APLICADOS al final.
