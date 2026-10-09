-- FESTOS V29.34.4
-- Registro de Compras: Fecha de control + Número de documento.
-- Ejecutar una vez en Supabase > SQL Editor.

alter table public.compras
  add column if not exists fecha_control date,
  add column if not exists numero_documento text;

comment on column public.compras.fecha_control is
'Fecha de control. Se completará automáticamente desde Registro de Ventas cuando dicho módulo esté disponible.';

comment on column public.compras.numero_documento is
'Número del comprobante. Puede ingresarse manualmente o detectarse de forma asistida desde el PDF de factura.';

create index if not exists compras_fecha_control_idx
  on public.compras(fecha_control);

create index if not exists compras_numero_documento_idx
  on public.compras(numero_documento);
