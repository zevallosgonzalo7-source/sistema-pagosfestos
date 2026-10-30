# FESTOS V29.42.17 — Registro de Ventas (cambios 09–14)

Base: V29.42.16. Mantiene archivos del proyecto, sin sustituir datos de Supabase.

## Cambios
- Selección múltiple de proyectos del mismo cliente.
- Distribución **manual y obligatoria** del valor de venta sin IGV entre los proyectos seleccionados. La suma debe ser igual al valor del comprobante. Una factura se registra una sola vez.
- Se elimina el recuadro Categoría del formulario.
- Check **Modificar costo total manualmente**: cuando está activado se guarda el costo manual y se separa del cálculo automático de compras; los costos de los proyectos y compras no se modifican por este check.
- Se retiran los KPI y alertas superiores de cobranza del módulo Reg. Ventas. Las cobranzas almacenadas se conservan.
- Los adjuntos se gestionan desde Editar venta; en el detalle únicamente se muestran los archivos existentes para consulta.
- Se sustituye «F. control» por «Fecha de emisión factura»; se retira el bloque «Pago comercial» del detalle y se conserva «Detracción».
- Cabecera de comprobante: número, nombre del proyecto (o proyectos), valor de venta sin IGV y margen resaltado en amarillo. No se presenta allí el saldo «Por regularizar», fecha, tipo de documento ni cliente.

## Migración SQL OBLIGATORIA
Ejecutar, **en un entorno de pruebas con copia de seguridad previa**, `supabase/FESTOS_V29_42_17_MULTI_COSTO.sql` después de la migración V29.42.15. La nueva RPC `guardar_venta_festos_v4` exige instalación antes de usar la nueva interfaz.

La función valida que todos los proyectos pertenezcan al mismo cliente y que la suma de asignaciones coincida con la venta; almacena en `venta_proyectos` las asignaciones sin duplicar la venta en `ventas`. El costo manual se almacena como valor de factura, sin sustituir los costos reales del proyecto.

## Límites y advertencias
- No se ha validado la migración contra una instancia de Supabase ni se ha ejecutado la compilación Vite (dependencias no disponibles localmente).
- Dos pruebas heredadas de `dashboard-links.test.mjs` fallan también en el código base; no se pueden considerar corregidas en esta entrega.
- En edición, para una venta que ya tenía múltiples proyectos, se mantiene la restricción de no alterar el importe total en el mismo paso. Se pueden ajustar asignaciones manteniendo el total.
- La opción «Nota de crédito» no tiene aún tratamiento tributario/contable completo. No registrar notas de crédito reales hasta implementarlo.
- La rentabilidad individual de factura con costo manual no debe mezclarse con el costo real consolidado del proyecto en reportes gerenciales.

## Verificación necesaria en pruebas
1. Crear venta con un proyecto y confirmar importe/IGV/costo automático.
2. Crear venta con dos proyectos del mismo cliente, asignar 60/40 y verificar un solo comprobante y dos vínculos.
3. Intentar incluir otro cliente o asignaciones que no sumen el total; debe bloquearse.
4. Activar costo manual, guardar y reabrir: verificar que se conserva y que no altera Compras.
5. Desactivar el check y guardar: debe recalcular desde compras únicas de los proyectos.
6. Comprobar registro de detracción, edición, adjuntos y Dashboard.
