# FESTOS V29.36.1 — Dashboard Compras vacío + corrección filtros

Cambios:
- Dashboard de Compras funciona visualmente incluso con 0 registros.
- KPIs mantienen S/. 0.00 / 0 correctamente.
- CeCo conserva la dona en S/. 0.00 y muestra un estado inicial elegante.
- Categoría de gasto, LOB, Top proveedores, Evolución mensual y Compras recientes ya no muestran "Sin datos" de forma brusca.
- Los filtros SearchableSelect vuelven a mostrar correctamente su texto.
- Se corrigió el CSS que estaba estirando el botón interno del selector y dejaba visible solamente la flecha.
- Se mantiene la consulta real a Supabase; cuando existan compras, el dashboard se poblará automáticamente.
- No requiere SQL.
