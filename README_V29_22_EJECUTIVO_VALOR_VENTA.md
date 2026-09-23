# FESTOS V29.22 — Ejecutivo y Valor venta

- Dashboard: vuelve a consultar proyectos al guardar cambios, al volver a la pestaña y cada 20 segundos mientras esté visible. El gráfico y los filtros usan `proyectos.ejecutivo` (no el creador).
- Proyectos: subtotal filtrado ahora indica **Valor venta filtrado (sin IGV)**. La cotización vinculada indica el valor antes de IGV.
- Cotizaciones: la tarjeta principal muestra **Valor venta** calculado a partir de `cotizaciones.subtotal`; el resumen indica **Valor venta (sin IGV)** y presenta aparte IGV e **Importe con IGV** para evitar llamar valor venta a una cantidad que incluye impuestos. El importe de PDF y los cálculos no se alteran.
- La aprobación sigue usando `aprobar_cotizacion` en Supabase. El proyecto actualiza su valor a partir de `subtotal` según la función ya instalada; si su base tiene una función diferente, verificar la configuración SQL antes de cambiar importes históricos.
- No requiere migración SQL para corregir la sincronización ni los rótulos.
- Para desplegar: no subir `release/`, `node_modules/` ni binarios de Electron a GitHub.
