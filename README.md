# Versión actual: FESTOS V28 · Centro de trabajo (1.2.0)

Leer primero **README_V28_CENTRO_DE_TRABAJO.md**. La migración opcional de fechas está en `supabase/V28_FECHAS_PROYECTOS_OPCIONAL.sql`. Para seguridad y actualizaciones: **PLAN_SEGURIDAD_ACTUALIZACIONES_V28.md**.

---

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

## V29.5 · FESTOS AI con voz
Antes de probar el asistente inteligente en Electron, consulta `README_V29_5_FESTOS_AI_VOZ.md`: la Edge Function de Supabase y su secreto de API deben desplegarse por separado. El ZIP no lleva una clave privada ni activa automáticamente el servicio de IA.
