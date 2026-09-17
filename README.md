# Control Festos V13 — PDF comercial profesional

V13 mantiene el flujo de Cotizaciones de V12 y mejora únicamente la salida PDF para cliente.

## Cambios del PDF
- Se elimina del documento enviado al cliente: Costo total, Utilidad y Margen global.
- Se muestra claramente el RUC del cliente.
- Logo FESTOS más grande y mejor integrado en el encabezado.
- Tabla de ítems rediseñada con columnas alineadas: Descripción, Cantidad, Valor unitario y Total.
- Resumen comercial limpio: Valor de venta, IGV 18% y Precio total.
- Condición de pago y plazo, cuando están disponibles.
- Encabezado/pie de página y numeración para un acabado más profesional.
- Diseño moderno en formato A4 y compatible con varias páginas.

## Instalación
Si ya tienes V12 funcionando, solo reemplaza el proyecto por esta versión y ejecuta:

```bash
npm install
npm run dev
```

La dependencia `jspdf` ya está incluida en `package.json`.
