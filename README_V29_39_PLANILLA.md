# FESTOS V29.39.1 — Módulo Planilla mejorado

## Reglas confirmadas
- **Gonzalo**: modalidad **Planilla**, pago **mensual**, sin comisiones.
- **Jesús**: **Recibo por honorarios**, pago **quincenal (cada 15 días)**, sin comisiones.
- **Mar**: **Recibo por honorarios**, pago **mensual**, **única colaboradora con comisiones**.
- **Rodrigo**: **Recibo por honorarios**, pago **quincenal (cada 15 días)**, sin comisiones.
- Los montos base pueden quedar en **NULL / Por confirmar** hasta definirlos.

## Mejoras incluidas
- Vista de **Planilla más estirada y premium**, alineada al diseño de referencia.
- Cards del equipo más grandes y visuales.
- **Detalle ampliado por colaborador** al hacer click.
- Edición completa de:
  - nombre
  - cargo
  - correo
  - número / teléfono
  - modalidad de pago
  - frecuencia
  - monto base
  - banco
  - cuenta bancaria
  - CCI
  - DNI / documento
  - RUC
  - fecha de ingreso
- Registro manual de comisiones **solo para Mar**.
- **Almacén de RXH y adjuntos por persona** usando Supabase Storage.
- Liquidación mensual por período.
- Integración visual con Cotizaciones, Proyectos, Caja, Adjuntos y Reg. de Ventas.

## Privacidad por defecto
- Gonzalo: ver + gestionar Planilla.
- Rodrigo: ver + gestionar Planilla.
- Jesús y Mar: sin acceso inicial al módulo. Se puede habilitar desde Roles y Permisos.

## Paso obligatorio en Supabase
Ejecutar una vez en SQL Editor:

`supabase/FESTOS_V29_39_PLANILLA.sql`

Este script:
- crea/actualiza tablas de planilla
- agrega campos de contacto y bancarios
- crea la tabla de documentos de planilla
- crea el bucket **planilla-rxh**
- crea políticas para leer/subir/descargar adjuntos

## Nota sobre Caja
La integración con Caja sigue preparada visualmente. Aún no se genera egreso automático al marcar una liquidación como pagada porque faltan reglas finales del flujo contable.
