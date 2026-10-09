-- FESTOS V29.34.6 · Registro de Compras
-- Soporte para adjunto BOLETA. PDF/XML/COTIZACIÓN reutilizan columnas existentes.

alter table public.compras
  add column if not exists boleta_path text;

comment on column public.compras.boleta_path is
'Ruta privada del adjunto BOLETA en el bucket compras-adjuntos.';

create index if not exists compras_boleta_path_idx
  on public.compras(boleta_path)
  where boleta_path is not null;
