# FESTOS V29.32.3

- Cotizaciones: los botones Todas/Aprobadas/En Revisión/Borradores se reemplazaron por un desplegable `Estado` para evitar que los filtros sobresalgan.
- Excel: se fuerza el bundle de navegador de ExcelJS, el logo se inserta como Base64 (en vez de ArrayBuffer) y la descarga se genera desde un Uint8Array para evitar archivos XLSX dañados en Excel de Windows.
- Se conserva el diseño corporativo y los cambios de V29.32.2.
