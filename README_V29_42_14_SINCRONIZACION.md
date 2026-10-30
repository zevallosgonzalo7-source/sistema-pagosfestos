# FESTOS V29.42.14 — Conciliación y sincronización de Proyectos

Base: V29.42.13. No modifica tablas ni registros de Supabase y no requiere SQL.

## Ajustes

- `src/projectMetrics.js`: fuente común de selección de cotizaciones, venta sin IGV, costo y utilidad.
- Proyectos y Dashboard utilizan la misma prioridad: `valor_base` positivo → `valor_venta` positivo → subtotal de cotización vinculada.
- Las cotizaciones vinculadas se resuelven por `project_id` antes que por nombre y se ordenan de manera determinista por fecha descendente e identificador.
- Dashboard escucha cambios de `proyectos` y `cotizaciones`, además del sondeo preventivo de 20 segundos, del retorno a la pestaña y de los eventos internos.
- Secuencia de solicitudes: una respuesta antigua no puede sobrescribir una consulta posterior.
- Se muestra la hora de última consulta exitosa o una alerta de sincronización fallida.
- `.gitignore` excluye `.env` y la caché temporal de Supabase.

## Validación

1. `npm install` (si aún no hay dependencias).
2. `node --test tests/project-metrics.test.mjs`.
3. `npm run build`.
4. Abrir Proyectos y Dashboard filtrando septiembre 2026, todos los ejecutivos/categorías. Confirmar 19 registros y S/ 76,437.90 según exportación del 30/10/2026.
5. Editar un valor desde Proyectos, guardar y comprobar la cifra en Dashboard, incluso con ambas pantallas abiertas en distintas sesiones.
6. Si la actualización instantánea no llega pero sí la de los 20 segundos, verificar en Supabase la publicación Realtime y los permisos RLS sobre `proyectos` y `cotizaciones`.

## Límites

La prueba automatizada verifica consistencia de las fórmulas con datos sintéticos. No se dispone de conexión al Supabase de producción, por lo que el resultado exacto de S/ 76,437.90 requiere la prueba de integración en el entorno del usuario. El sondeo de 20 segundos funciona como respaldo; tiempo real estricto requiere Realtime habilitado y conectado.

## Seguridad

No incluya `.env`, claves secretas, ni archivos de caché `.temp` en GitHub. La clave de Supabase detectada anteriormente por GitHub debe revocarse/rotarse, incluso si ya fue retirada de los commits.
