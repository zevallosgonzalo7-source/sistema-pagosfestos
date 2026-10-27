# FESTOS V29.42.5 — Excel global sin franja amarilla

Cambios:
- Nuevo estándar global para reportes Excel.
- Eliminadas las franjas amarillas de los exportadores comunes.
- Cabecera única resaltada: `REPORTE DE [MÓDULO]`.
- Resumen y filtros mantienen información pero sin bloques amarillos.
- Cotización individual también adopta `REPORTE DE COTIZACIÓN` sin amarillo.
- Registro de Ventas incorpora botón `Exportar Excel` y exporta los registros filtrados, KPIs de facturación/cobranza/detracción y estado.
- No requiere SQL nuevo.

Aplica a los módulos que utilizan el exportador corporativo compartido, incluidos Clientes, Proveedores, Proyectos, Cotizaciones filtradas, Dashboard Proyectos y Dashboard Compras.
