# FESTOS V29.41.5 — Eliminar adjuntos de Planilla

## Cambio
En Planilla > detalle del colaborador > Almacén de RXH y adjuntos, los usuarios con permiso de gestionar Planilla ahora tienen un botón de eliminar junto al botón de descarga.

## Comportamiento
- Pide confirmación mostrando el nombre del archivo.
- Elimina el archivo del bucket privado `planilla-rxh`.
- Elimina el registro correspondiente de `planilla_documentos`.
- Actualiza la lista inmediatamente.
- El botón de borrar solo aparece si `puedeGestionar` es verdadero.

## Base de datos
No requiere SQL nuevo si ya se ejecutó `FESTOS_V29_39_PLANILLA.sql`, porque ese script ya incluía permisos DELETE para los adjuntos de Planilla.
