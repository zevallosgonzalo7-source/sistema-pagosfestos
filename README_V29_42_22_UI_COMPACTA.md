# FESTOS V29.42.22 — Correcciones de interfaz

- Selector múltiple compacto y casillas alineadas.
- Distribución visible por proyecto eliminada. **Advertencia funcional:** para mantener las asignaciones exigidas por el backend, las ventas nuevas con varios proyectos se reparten internamente en partes iguales al guardar; si se edita una venta y el reparto previo coincide con el total, se conserva. Esta regla debe validarse con dirección comercial antes del uso en producción, pues afecta los reportes por proyecto.
- Filtro de Estado muestra Todos, Pendiente, Vencido y Cobrado. Los estados reales de la base permanecen sin cambios.
- Compras, Proyectos, Clientes y Proveedores tienen tarjetas compactas; clic en cabecera abre el detalle y se elimina el enlace redundante.
- No ejecutar SQL adicional; mantener migraciones de V29.42.15 y V29.42.17.
- Validar antes de producción, especialmente facturación multiproyecto, estados y navegación con teclado.
