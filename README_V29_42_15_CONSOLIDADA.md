# FESTOS V29.42.15 — Versión consolidada (candidata a validación)

Base: V29.42.14. Se conserva la sincronización y conciliación del dashboard incorporada en esa versión.

## Cambios

- Proyectos: se intercambian únicamente los fondos y bordes visuales de EN PROCESO y FACTURADO.
- Registro de Ventas: se retiran los dos recuadros superiores de Compras vinculadas y Costo real. Se conserva el detalle desplegable de compras y su comportamiento.
- Se retiran textos de ayuda redundantes identificados en Registro de Ventas y el panel Impacto al confirmar. No se eliminan las validaciones.
- Selector Documento: se incorpora NOTA DE CRÉDITO. **Solo se añade al selector**: NO se implementa aplicación contable ni vinculación automática a factura de origen. Registrar notas de crédito como ventas positivas distorsionaría los indicadores; NO utilizar esta opción para emitir notas reales hasta implementar y validar el tratamiento contable correspondiente.
- Se elimina la tarjeta resumen Valor venta (se conserva el campo de entrada).
- Detracción: porcentaje editable, 12 % como valor por defecto, con recálculo y persistencia mediante nuevas RPC V3.
- COSTO REAL pasa a denominarse COSTO TOTAL en indicadores del formulario, detalle y Excel. Se mantiene su fórmula.
- Adjuntos múltiples en Registro de Ventas, con carga, apertura, descarga, eliminación individual y conservación al editar.
- Campo EJECUTIVO manual, independiente del ejecutivo del proyecto; lista de sugerencias locales que permite escribir otros nombres. Se persiste por cada venta, se conserva en edición, filtros y Excel.

## Obligatorio: instalar migración SQL ANTES de usar la nueva versión

1. Hacer respaldo de la base de Supabase.
2. En SQL Editor de la instancia correspondiente, ejecutar `supabase/FESTOS_V29_42_15_CAMBIOS_FINAL.sql`.
3. Confirmar que las funciones `registrar_venta_festos_v3` y `editar_venta_festos_v3` están disponibles y que existe el bucket privado `ventas-adjuntos` y la tabla `ventas_adjuntos`.
4. Instalar dependencias (`npm ci`) y ejecutar `npm run build`, y después probar con datos de prueba: crear, editar, adjuntar, eliminar adjunto y porcentaje variable. No usar producción sin validación.
5. Comprobar permisos de las políticas RLS del nuevo almacenamiento para el esquema concreto de roles de FESTOS; el SQL da acceso a usuarios autenticados igual que la implementación actual y podría requerir restricción por rol.

## Limitaciones de validación

- JSX revisado mediante parser TypeScript, sin errores de sintaxis.
- No se ha ejecutado build completo (dependencias npm no disponibles en este entorno), ni prueba de conexión contra Supabase o reglas RLS reales.
- No se han alterado datos de Supabase durante la preparación del paquete.
- La limpieza global de instrucciones requiere revisión visual funcional por módulo; en esta entrega se retiraron los textos explícitamente mostrados en Registro de Ventas y un bloque explicativo adicional.
- El valor de septiembre del dashboard solo puede verificarse contra la base de producción tras la instalación.

## Seguridad

Se excluyen `.env`, `.env.*` (excepto `.env.example`), `node_modules`, y compilados. Rotar cualquier secreto Supabase expuesto previamente en Git.
