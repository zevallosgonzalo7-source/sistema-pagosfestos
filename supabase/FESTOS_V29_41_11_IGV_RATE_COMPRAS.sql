-- FESTOS V29.41.11 — Tasa de IGV seleccionable en Registro de Compras
-- Ejecutar una sola vez en Supabase SQL Editor.

alter table public.compras
  add column if not exists igv_rate numeric(6,4) not null default 0.18;

update public.compras
set igv_rate = 0.18
where igv_rate is null;

do $$
begin
  alter table public.compras
    add constraint compras_igv_rate_check
    check (igv_rate in (0.18, 0.105));
exception
  when duplicate_object then null;
end $$;

comment on column public.compras.igv_rate is
'Tasa de IGV utilizada en la compra. FESTOS admite 18% o 10.5%.';

notify pgrst, 'reload schema';
