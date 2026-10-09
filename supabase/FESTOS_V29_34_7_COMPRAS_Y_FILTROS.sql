-- FESTOS V29.34.7
-- Registro de Compras: proyecto libre + documento de proveedor.
-- Seguro e idempotente.

alter table public.compras
  add column if not exists proyecto_texto text;

comment on column public.compras.proyecto_texto is
'Proyecto o referencia escrita libremente cuando la categoría de gasto no es Costos Directos.';

create index if not exists compras_proyecto_texto_idx
  on public.compras(proyecto_texto);

alter table public.proveedores
  add column if not exists ruc_documento text;

comment on column public.proveedores.ruc_documento is
'RUC, DNI u otro documento del proveedor.';

create index if not exists proveedores_ruc_documento_idx
  on public.proveedores(ruc_documento);
