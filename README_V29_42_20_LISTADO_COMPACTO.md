# FESTOS V29.42.20 — Listado de ventas compacto

Versión basada en V29.42.19. Se cambió **exclusivamente CSS** de la lista de Reg. Ventas.

- Tarjetas cerradas más bajas, menor padding y menor separación vertical.
- En pantallas amplias, valor de venta, margen amarillo y estado de cobranza en una misma línea a la derecha.
- Número de documento y nombre de proyecto permanecen a la izquierda.
- Al abrir una tarjeta se mantienen todos sus detalles, controles y datos.
- En pantallas pequeñas se distribuye en dos filas para evitar recortes.

No requiere ejecutar SQL. No se alteraron cálculos, el margen, adjuntos ni sincronización. El problema de 'Por verificar' con costo válido no se corrige en esta entrega exclusivamente visual.

Validar a nivel visual en el navegador y comprobar el resultado de `npm run build` antes de subir a producción.
