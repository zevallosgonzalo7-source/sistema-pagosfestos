# FESTOS V29.42.10 — Reglas comerciales de Registro de Ventas

## Cambios
- Registro de Ventas define el LOB y lo sincroniza al Proyecto y sus Compras.
- LOB disponibles: GRAFICA PUBLICITARIA, MERCH & GIFTS, ESPACIOS Y ESTRUCTURAS, AGENCIA 360°.
- Categoría de Proyecto queda separada de LOB mediante `proyectos.categoria`.
- `Fecha factura` se usa automáticamente como `fecha_control` de las Compras vinculadas.
- El usuario ingresa **Valor venta** (sin IGV); FESTOS calcula IGV 18% y Precio venta.
- Clientes incorpora **Agente retenedor: Sí/No**.
- Precio venta <= S/ 700: no aplica retención ni detracción.
- Precio venta > S/ 700 + cliente agente retenedor: retención automática 3%.
- Si se activa detracción: 12% automática y retención se desactiva.
- Comisión se oculta y se guarda en 0 por ahora.
- Registrar detracción ya no solicita Referencia / operación.
- El pago de detracción acepta cualquier monto positivo para permitir redondeos reales.
- Costos de Compras vinculadas alimentan costo real, utilidad y margen.

## SQL obligatorio
Ejecutar una vez:
`supabase/FESTOS_V29_42_10_REGLAS_VENTAS_LOB_RETENCION.sql`

Luego recargar FESTOS con Ctrl + F5.
