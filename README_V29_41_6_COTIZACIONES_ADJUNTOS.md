# FESTOS V29.41.6 — Cotizaciones: Proforma aprobada + Adjuntos

## Nuevo por cada cotización

### PROFORMA APROBADA
- 1 archivo máximo por cotización.
- Se visualiza como documento principal dentro del detalle.
- Permite descargar y, con permiso de gestión, eliminar/reemplazar.

### ADJUNTOS
- Hasta 5 archivos complementarios por cotización.
- Contador visible 0/5, 1/5, etc.
- Permite descarga individual.
- Quien tenga `gestionar_cotizaciones` puede subir y eliminar.

## Supabase
Ejecutar:
`supabase/FESTOS_V29_41_6_COTIZACIONES_ADJUNTOS.sql`

El SQL crea:
- `public.cotizacion_adjuntos`
- bucket privado `cotizaciones-adjuntos`
- límite DB de 1 proforma y 5 adjuntos por cotización
- RLS / Storage policies para usuarios autenticados

## Favicon
También se actualizó el favicon de FESTOS con el archivo entregado para esta versión.
